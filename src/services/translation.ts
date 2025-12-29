import {
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
  GetTranslationsRequest,
  GetTranslationsResponse,
} from "../types";
import { getStorageAdapter } from "../storage";
import { VERSION } from "../version";

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage: StorageAdapter | null = null;
  private pendingTranslations: Map<string, boolean> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private cacheKey = "";
  private baseUrl = "https://autolocalise-main-53fde32.zuplo.app";
  public isInitialized = false;
  private isSSR = false;
  private lastRefreshTime: number | undefined;

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;
  constructor(config: TranslationConfig) {
    this.config = {
      ...config,
    };
    this.cacheKey = `autolocalise_${this.config.targetLocale}`;
    // Initialize lastRefreshTime internally - it's not provided by the developer
    this.lastRefreshTime = undefined;

    // Detect if we're running in a server environment
    this.isSSR = typeof window === "undefined";
  }

  /**
   * Preload translations for client-side hydration
   * Used when hydrating client with server-side translations
   */
  public preloadTranslations(translations: Record<string, string>): void {
    if (!this.cache[this.config.targetLocale]) {
      this.cache[this.config.targetLocale] = {};
    }

    // Convert flat translations object to hashkey-based structure
    Object.entries(translations).forEach(([text, translation]) => {
      const hashkey = this.generateHash(text);
      this.cache[this.config.targetLocale][hashkey] = translation;
    });

    this.isInitialized = true;
  }

  /**
   * Clean up resources when component unmounts
   */
  public cleanup(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  public generateHash(text: string): string {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private debounceTime = 100; // 1 second debounce

  public getCachedTranslation(text: string): string | null {
    const hashkey = this.generateHash(text);
    const translation = this.cache[this.config.targetLocale]?.[hashkey] || null;

    return translation;
  }

  private async baseApi<T extends TranslationRequest | GetTranslationsRequest>(
    endpoint: string,
    requestBody: T
  ): Promise<TranslationResponse | GetTranslationsResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed calling ${endpoint}: ${response.statusText}`);
    }

    return response.json();
  }

  private scheduleBatchTranslation(): void {
    // Skip batch translation in server environment
    if (this.isSSR) return;

    if (!this.storage) return;
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
        const request: TranslationRequest = {
          texts: allTexts,
          sourceLocale: this.config.sourceLocale,
          targetLocale: this.config.targetLocale,
          apiKey: this.config.apiKey,
          version: `react-v${VERSION}`,
        };

        try {
          const data = (await this.baseApi(
            "v1/translate",
            request
          )) as TranslationResponse;

          this.cache[this.config.targetLocale] = {
            ...this.cache[this.config.targetLocale],
            ...data,
          };

          if (this.onTranslationsUpdated) {
            this.onTranslationsUpdated(
              this.cache[this.config.targetLocale] || {}
            );
          }

          if (this.storage) {
            await this.storage.setItem(
              this.cacheKey,
              JSON.stringify({
                timestamp: Date.now(),
                data: this.cache[this.config.targetLocale],
                lastRefreshTime: this.lastRefreshTime,
              })
            );
          }
        } catch (error) {
          console.error("Translation fetch error:", error);
          // Don't throw error, just log it - original text will be displayed
        }
      }
    }, this.debounceTime);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For server-side, load existing translations but skip storage
      if (this.isSSR) {
        await this.loadExistingTranslations();
        this.isInitialized = true;
        return;
      }

      this.storage = await getStorageAdapter();
      const cachedData = await this.storage.getItem(this.cacheKey);
      if (cachedData) {
        const { data, lastRefreshTime } = JSON.parse(cachedData);
        this.cache[this.config.targetLocale] = data;
        this.lastRefreshTime = lastRefreshTime;
        this.isInitialized = true;
        return;
      }

      await this.loadExistingTranslations();

      if (this.storage) {
        await this.storage.setItem(
          this.cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: this.cache[this.config.targetLocale],
            lastRefreshTime: this.lastRefreshTime,
          })
        );
      }
      this.isInitialized = true;
    } catch (error) {
      console.error("Translation initialization error:", error);
      // Do not update the cache on error - keep existing cache
      // The app will continue with existing translations or empty cache
      this.isInitialized = true;
    }
  }

  /**
   * Load existing translations from the API
   */
  private async loadExistingTranslations(): Promise<void> {
    const requestBody: GetTranslationsRequest = {
      apiKey: this.config.apiKey,
      targetLocale: this.config.targetLocale,
      lastRefreshTime: this.lastRefreshTime,
    };

    try {
      const response = await this.baseApi("v1/translations", requestBody);

      // Response is GetTranslationsResponse
      const getTranslationsResponse = response as GetTranslationsResponse;

      if (!this.cache[this.config.targetLocale]) {
        this.cache[this.config.targetLocale] = {};
      }

      // Merge received translations with existing cache (treat as incremental)
      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...getTranslationsResponse.translations,
      };

      // Update lastRefreshTime to current time to indicate successful refresh
      this.lastRefreshTime = Date.now();
    } catch (error) {
      console.error("Failed to load existing translations:", error);
      // Do not update the cache on error - keep existing cache or leave empty
      // The app will continue with existing translations or empty cache
    }
  }

  /**
   * Translate text asynchronously with batching (client-side)
   * This method is optimized for client-side usage where batching reduces API calls
   */
  public translate(text: string, persist: boolean = true): string {
    if (!text || !this.isInitialized) return text;

    // Skip blank text (empty or whitespace-only)
    const trimmedText = text.trim();
    if (!trimmedText) {
      return text;
    }

    // Check cache first
    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    this.pendingTranslations.set(text, persist);
    this.scheduleBatchTranslation();

    // Return original text while translation is pending
    return text;
  }

  /**
   * Batch translate multiple texts
   * Used by both client-side and server-side implementations
   * @param texts Array of text items to translate in batch
   */
  public async translateBatch(
    texts: { hashkey: string; text: string; persist: boolean }[]
  ): Promise<Record<string, string>> {
    if (!this.isInitialized || texts.length === 0) {
      return {};
    }

    // Filter out blank texts (empty or whitespace-only)
    const validTexts = texts.filter(({ text }) => text.trim() !== "");

    if (validTexts.length === 0) {
      return {};
    }

    const request: TranslationRequest = {
      texts: validTexts,
      sourceLocale: this.config.sourceLocale,
      targetLocale: this.config.targetLocale,
      apiKey: this.config.apiKey,
      version: `react-v${VERSION}`,
    };

    try {
      const data = (await this.baseApi(
        "v1/translate",
        request
      )) as TranslationResponse;

      // Update cache with batch translations
      if (!this.cache[this.config.targetLocale]) {
        this.cache[this.config.targetLocale] = {};
      }
      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...data,
      };

      // Convert hashkey-based response to text-based response
      const textBasedResponse: Record<string, string> = {};
      texts.forEach(({ text, hashkey }) => {
        textBasedResponse[text] = data[hashkey] || text;
      });

      return textBasedResponse;
    } catch (error) {
      console.error("Batch translation error:", error);
      // Return original texts on error instead of throwing
      const textBasedResponse: Record<string, string> = {};
      texts.forEach(({ text }) => {
        textBasedResponse[text] = text;
      });
      return textBasedResponse;
    }
  }

  public onUpdate(
    callback: (translations: { [key: string]: string }) => void
  ): void {
    this.onTranslationsUpdated = callback;
    // Immediately call with current translations if available
    if (this.cache[this.config.targetLocale]) {
      callback(this.cache[this.config.targetLocale]);
    }
  }

  /**
   * Get all cached translations for the target locale
   */
  public getAllTranslations(): Record<string, string> {
    return this.cache[this.config.targetLocale] || {};
  }
}
