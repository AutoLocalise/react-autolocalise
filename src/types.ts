export interface TranslationConfig {
  /** Long-lived API key for backward compatibility */
  apiKey?: string;
  /** Callback to get access token. Called on init and when token expires. */
  getAccessToken?: () => Promise<AccessTokenResponse>;
  sourceLocale: string;
  targetLocale: string;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresAt: number | string;
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string;
  };
}

export interface TranslationRequest {
  texts: Array<{
    hashkey: string;
    text: string;
    persist: boolean;
    reference?: string;
  }>;
  sourceLocale: string;
  targetLocale: string;
  apiKey?: string; // Either apiKey or accessToken is required
  accessToken?: string; // Either apiKey or accessToken is required
  version: string;
}

export interface TranslationResponse {
  [hashkey: string]: string;
}

export interface GetTranslationsRequest {
  apiKey?: string; // Either apiKey or accessToken is required
  accessToken?: string; // Either apiKey or accessToken is required
  targetLocale: string;
  lastRefreshTime?: number; // Timestamp for incremental updates
}

export interface GetTranslationsResponse {
  [hashkey: string]: string;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class AccessTokenError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'AccessTokenError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface TranslationContextType {
  translate: (text: string, persist?: boolean, reference?: string) => string;
  loading: boolean;
  error: Error | null;
}
