import {
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
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

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;
  constructor(config: TranslationConfig) {
    this.config = {
      ...config,
      cacheTTL: config.cacheTTL || 24, // Default 24 hours
    };
    this.cacheKey = `autolocalise_${this.config.targetLocale}`;

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

  private async baseApi<
    T extends TranslationRequest | { apiKey: string; targetLocale: string }
  >(endpoint: string, requestBody: T): Promise<TranslationResponse> {
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
          const data = await this.baseApi("v1/translate", request);

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
              })
            );
          }
        } catch (error) {
          console.error("Translation fetch error:", error);
          throw error;
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

      // Client-side: use storage with TTL
      this.storage = await getStorageAdapter();
      const cachedData = await this.storage.getItem(this.cacheKey);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const age = (Date.now() - timestamp) / (1000 * 60 * 60);

        if (age < this.config.cacheTTL!) {
          this.cache[this.config.targetLocale] = data;
          this.isInitialized = true;
          return;
        }
      }

      await this.loadExistingTranslations();

      if (this.storage) {
        await this.storage.setItem(
          this.cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: this.cache[this.config.targetLocale],
          })
        );
      }
      this.isInitialized = true;
    } catch (error) {
      console.error("Translation initialization error:", error);
      throw error;
    }
  }

  /**
   * Load existing translations from the API
   */
  private async loadExistingTranslations(): Promise<void> {
    const requestBody = {
      apiKey: this.config.apiKey,
      targetLocale: this.config.targetLocale,
    };

    const data = await this.baseApi("v1/translations", requestBody);

    if (!this.cache[this.config.targetLocale]) {
      this.cache[this.config.targetLocale] = {};
    }
    this.cache[this.config.targetLocale] = data;
  }

  /**
   * Translate text asynchronously with batching (client-side)
   * This method is optimized for client-side usage where batching reduces API calls
   */
  public translate(text: string, persist: boolean = true): string {
    if (!text || !this.isInitialized) return text;

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

    const request: TranslationRequest = {
      texts,
      sourceLocale: this.config.sourceLocale,
      targetLocale: this.config.targetLocale,
      apiKey: this.config.apiKey,
      version: `react-v${VERSION}`,
    };

    try {
      const data = await this.baseApi("v1/translate", request);

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
      throw error;
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
