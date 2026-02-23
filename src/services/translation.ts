import {
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
  GetTranslationsRequest,
  GetTranslationsResponse,
  AccessTokenResponse,
  AccessTokenError,
} from "../types";
import { getStorageAdapter } from "../storage";
import { VERSION } from "../version";
import {
  CLIENT_BATCH_DEBOUNCE_MS,
  API_BASE_URL,
  API_ENDPOINTS,
  CACHE_KEY_PREFIX,
  TOKEN_EXPIRY_SAFETY_BUFFER_MS,
  MAX_RETRY_ATTEMPTS,
} from "../constants";
import { validateConfig } from "../utils/validation";

/**
 * Check if running in server-side environment
 */
const isServerEnvironment = (): boolean => typeof window === "undefined";

interface QueuedRequest {
  endpoint: string;
  requestBody: TranslationRequest | GetTranslationsRequest;
  resolve: (
    value: TranslationResponse | GetTranslationsResponse | null,
  ) => void;
  reject: (error: Error) => void;
  retryAttempt: number;
}

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage: StorageAdapter | null = null;
  private pendingTranslations: Map<string, boolean> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private cacheKey = "";
  private baseUrl = API_BASE_URL;
  private _isInitialized = false;
  private isSSR = false;
  private lastRefreshTime: number | undefined;

  // Token management
  private currentAccessToken: string | null = null;
  private tokenExpiryTime: number | null = null;
  private isTokenRefreshing = false;
  private pendingRequests: QueuedRequest[] = [];

  /** Expose initialization status as read-only */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;

  constructor(config: TranslationConfig) {
    validateConfig(config);

    this.config = { ...config };
    this.cacheKey = `${CACHE_KEY_PREFIX}${this.config.targetLocale}`;
    this.lastRefreshTime = undefined;
    this.isSSR = isServerEnvironment();
  }

  // ============================================
  // Token Management
  // ============================================

  private isUsingAccessToken(): boolean {
    return !!this.config.getAccessToken;
  }

  private isTokenExpired(): boolean {
    if (!this.isUsingAccessToken()) {
      return false;
    }

    // No token yet - need to fetch
    if (!this.currentAccessToken || !this.tokenExpiryTime) {
      return true;
    }

    return Date.now() >= this.tokenExpiryTime - TOKEN_EXPIRY_SAFETY_BUFFER_MS;
  }

  private updateToken(tokenResponse: AccessTokenResponse): void {
    this.currentAccessToken = tokenResponse.accessToken;
    this.tokenExpiryTime =
      typeof tokenResponse.expiresAt === "string"
        ? new Date(tokenResponse.expiresAt).getTime()
        : tokenResponse.expiresAt;
  }

  private async fetchAccessToken(): Promise<void> {
    if (!this.config.getAccessToken) {
      throw new AccessTokenError("No getAccessToken callback provided");
    }

    try {
      const tokenResponse = await this.config.getAccessToken();
      this.updateToken(tokenResponse);
    } catch (error) {
      throw new AccessTokenError("Failed to fetch access token", error);
    }
  }

  // ============================================
  // Request Queue Management
  // ============================================

  private queueRequest(
    endpoint: string,
    requestBody: TranslationRequest | GetTranslationsRequest,
    retryAttempt: number,
  ): Promise<TranslationResponse | GetTranslationsResponse | null> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        endpoint,
        requestBody,
        resolve,
        reject,
        retryAttempt,
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.pendingRequests.length === 0) {
      this.isTokenRefreshing = false;
      return;
    }

    const requestsToProcess = [...this.pendingRequests];
    this.pendingRequests = [];

    try {
      await Promise.all(
        requestsToProcess.map(async (queuedRequest) => {
          try {
            const result = await this.makeApiRequest(
              queuedRequest.endpoint,
              queuedRequest.requestBody,
            );
            queuedRequest.resolve(result);
          } catch (error) {
            queuedRequest.reject(error as Error);
          }
        }),
      );
    } catch (error) {
      console.error("Error processing queued requests:", error);
    }

    this.isTokenRefreshing = false;
  }

  private rejectAllPendingRequests(error: Error): void {
    this.pendingRequests.forEach((req) => {
      req.reject(error);
    });
    this.pendingRequests = [];
    this.isTokenRefreshing = false;
  }

  // ============================================
  // API Communication
  // ============================================

  private async makeApiRequest(
    endpoint: string,
    requestBody: TranslationRequest | GetTranslationsRequest,
  ): Promise<TranslationResponse | GetTranslationsResponse | null> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(
        `API call failed for ${endpoint}: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return response.json();
  }

  private async handleTokenExpiredError(
    endpoint: string,
    requestBody: TranslationRequest | GetTranslationsRequest,
    retryAttempt: number,
  ): Promise<TranslationResponse | GetTranslationsResponse | null> {
    if (!this.isTokenRefreshing) {
      this.isTokenRefreshing = true;

      try {
        await this.fetchAccessToken();
        await this.processQueue();
        return this.makeApiRequest(endpoint, requestBody);
      } catch (error) {
        this.isTokenRefreshing = false;
        console.error("Failed to fetch token after 401 error:", error);
        // Return null instead of throwing - don't block the app
        return null;
      }
    }

    // Token is being fetched, queue this request
    return this.queueRequest(endpoint, requestBody, retryAttempt + 1);
  }

  private async baseApi(
    endpoint: string,
    requestBody: TranslationRequest | GetTranslationsRequest,
    retryAttempt: number = 0,
  ): Promise<TranslationResponse | GetTranslationsResponse | null> {
    // Check if we need to fetch/refresh the token
    if (this.isUsingAccessToken() && this.isTokenExpired()) {
      const queuedPromise = this.queueRequest(endpoint, requestBody, retryAttempt);

      if (!this.isTokenRefreshing) {
        this.isTokenRefreshing = true;
        this.fetchAccessToken()
          .then(() => this.processQueue())
          .catch((error) => {
            this.rejectAllPendingRequests(
              error instanceof AccessTokenError
                ? error
                : new Error("Token fetch failed"),
            );
          });
      }

      return queuedPromise;
    }

    // Make the API call
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Handle token expired errors from server
    if (
      (response.status === 401 || response.status === 403) &&
      retryAttempt < MAX_RETRY_ATTEMPTS
    ) {
      const errorData = await response.json().catch(() => null);
      const isTokenExpired =
        errorData?.error === "token_expired" ||
        errorData?.code === "token_expired";

      if (isTokenExpired && this.isUsingAccessToken()) {
        return this.handleTokenExpiredError(endpoint, requestBody, retryAttempt);
      }
    }

    if (!response.ok) {
      console.error(
        `API call failed for ${endpoint}: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return response.json();
  }

  // ============================================
  // Translation Operations
  // ============================================

  public preloadTranslations(translations: Record<string, string>): void {
    if (!this.cache[this.config.targetLocale]) {
      this.cache[this.config.targetLocale] = {};
    }

    Object.entries(translations).forEach(([text, translation]) => {
      const hashkey = this.generateHash(text);
      this.cache[this.config.targetLocale][hashkey] = translation;
    });

    this._isInitialized = true;
  }

  public cleanup(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // TODO: migrate to a more secure hash function
  public generateHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  public getCachedTranslation(text: string): string | null {
    const hashkey = this.generateHash(text);
    return this.cache[this.config.targetLocale]?.[hashkey] || null;
  }

  private scheduleBatchTranslation(): void {
    if (this.isSSR || !this.storage) return;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      const allTexts: { hashkey: string; text: string; persist: boolean }[] =
        [];

      this.pendingTranslations.forEach((persist, text) => {
        allTexts.push({ hashkey: this.generateHash(text), text, persist });
      });
      this.pendingTranslations.clear();

      if (allTexts.length > 0) {
        try {
          const request: TranslationRequest = {
            texts: allTexts,
            sourceLocale: this.config.sourceLocale,
            targetLocale: this.config.targetLocale,
            apiKey: this.config.apiKey,
            accessToken: this.currentAccessToken || undefined,
            version: `react-v${VERSION}`,
          };

          const data = await this.baseApi(API_ENDPOINTS.TRANSLATE, request);

          if (data) {
            this.cache[this.config.targetLocale] = {
              ...this.cache[this.config.targetLocale],
              ...(data as TranslationResponse),
            };

            if (this.onTranslationsUpdated) {
              this.onTranslationsUpdated(
                this.cache[this.config.targetLocale] || {},
              );
            }

            if (this.storage) {
              await this.storage.setItem(
                this.cacheKey,
                JSON.stringify({
                  timestamp: Date.now(),
                  data: this.cache[this.config.targetLocale],
                  lastRefreshTime: this.lastRefreshTime,
                }),
              );
            }
          }
        } catch (error) {
          // Silently fail - don't block the app, just log
          console.error("Batch translation error:", error);
        }
      }
    }, CLIENT_BATCH_DEBOUNCE_MS);
  }

  // ============================================
  // Initialization
  // ============================================

  public async init(): Promise<void> {
    if (this._isInitialized) return;

    try {
      // Fetch access token first if using token authentication
      if (this.isUsingAccessToken() && this.isTokenExpired()) {
        await this.fetchAccessToken();
      }

      // For server-side, load existing translations but skip storage
      if (this.isSSR) {
        await this.loadExistingTranslations();
        this._isInitialized = true;
        return;
      }

      this.storage = getStorageAdapter();

      // Load from localStorage synchronously for instant availability
      const cachedData = localStorage.getItem(this.cacheKey);
      if (cachedData) {
        try {
          const { data, lastRefreshTime } = JSON.parse(cachedData);
          this.cache[this.config.targetLocale] = data;
          this.lastRefreshTime = lastRefreshTime;
        } catch (e) {
          console.error("Failed to parse cached translations:", e);
        }
      }

      this._isInitialized = true;

      // Always refresh from API to get latest translations
      await this.loadExistingTranslations();

      // Save updated cache to localStorage
      if (this.storage) {
        await this.storage.setItem(
          this.cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: this.cache[this.config.targetLocale],
            lastRefreshTime: this.lastRefreshTime,
          }),
        );
      }
    } catch (error) {
      console.error("Translation initialization error:", error);
      this._isInitialized = true;
    }
  }

  private async loadExistingTranslations(): Promise<void> {
    try {
      const requestBody: GetTranslationsRequest = {
        apiKey: this.config.apiKey,
        accessToken: this.currentAccessToken || undefined,
        targetLocale: this.config.targetLocale,
      };

      if (this.lastRefreshTime) {
        requestBody.lastRefreshTime = this.lastRefreshTime;
      }

      const response = await this.baseApi(
        API_ENDPOINTS.TRANSLATIONS,
        requestBody,
      );

      if (!response) {
        return;
      }

      if (!this.cache[this.config.targetLocale]) {
        this.cache[this.config.targetLocale] = {};
      }

      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...(response as GetTranslationsResponse),
      };

      this.lastRefreshTime = Date.now();

      if (this.onTranslationsUpdated) {
        this.onTranslationsUpdated(this.cache[this.config.targetLocale] || {});
      }
    } catch (error) {
      // Never throw - just log the error and continue
      console.error("Failed to load translations:", error);
    }
  }

  // ============================================
  // Public API
  // ============================================

  public translate(text: string, persist: boolean = true): string {
    if (!text || !this._isInitialized) return text;

    const trimmedText = text.trim();
    if (!trimmedText) {
      return text;
    }

    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    this.pendingTranslations.set(text, persist);
    this.scheduleBatchTranslation();

    return text;
  }

  public async translateBatch(
    texts: { hashkey: string; text: string; persist: boolean }[],
  ): Promise<Record<string, string>> {
    // Return empty object if not initialized or no texts
    if (!this._isInitialized || texts.length === 0) {
      return {};
    }

    // Filter out blank texts
    const validTexts = texts.filter(({ text }) => text.trim() !== "");
    if (validTexts.length === 0) {
      return {};
    }

    try {
      const request: TranslationRequest = {
        texts: validTexts,
        sourceLocale: this.config.sourceLocale,
        targetLocale: this.config.targetLocale,
        apiKey: this.config.apiKey,
        accessToken: this.currentAccessToken || undefined,
        version: `react-v${VERSION}`,
      };

      const data = await this.baseApi(API_ENDPOINTS.TRANSLATE, request);

      if (!data) {
        // API call failed, return original texts
        return this.createFallbackResponse(texts);
      }

      // Update cache
      if (!this.cache[this.config.targetLocale]) {
        this.cache[this.config.targetLocale] = {};
      }
      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...(data as TranslationResponse),
      };

      return this.createResponseFromData(texts, data as TranslationResponse);
    } catch (error) {
      // Never throw - return original texts on any error
      console.error("translateBatch error:", error);
      return this.createFallbackResponse(texts);
    }
  }

  /**
   * Create response with original texts (fallback on error)
   */
  private createFallbackResponse(
    texts: { hashkey: string; text: string; persist: boolean }[],
  ): Record<string, string> {
    const response: Record<string, string> = {};
    texts.forEach(({ text }) => {
      response[text] = text;
    });
    return response;
  }

  /**
   * Create response from API data
   */
  private createResponseFromData(
    texts: { hashkey: string; text: string; persist: boolean }[],
    data: TranslationResponse,
  ): Record<string, string> {
    const response: Record<string, string> = {};
    texts.forEach(({ text, hashkey }) => {
      response[text] = data[hashkey] || text;
    });
    return response;
  }

  public onUpdate(
    callback: (translations: { [key: string]: string }) => void,
  ): void {
    this.onTranslationsUpdated = callback;
    if (this.cache[this.config.targetLocale]) {
      callback(this.cache[this.config.targetLocale]);
    }
  }

  public getAllTranslations(): Record<string, string> {
    return this.cache[this.config.targetLocale] || {};
  }
}