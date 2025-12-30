/**
 * Configuration constants for the translation SDK
 */

/**
 * Client-side debounce time for batch translation requests (in milliseconds)
 * This allows multiple translation requests to be batched together to reduce API calls
 */
export const CLIENT_BATCH_DEBOUNCE_MS = 100;

/**
 * Server-side batch translation timeout (in milliseconds)
 * This allows multiple concurrent translation requests to be merged into a single batch
 */
export const SERVER_BATCH_TIMEOUT_MS = 10;

/**
 * Cache refresh time-to-live (in milliseconds)
 * After this period, the cache will be fully refreshed by not sending lastRefreshTime
 */
export const CACHE_REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * API base URL for the translation service
 */
export const API_BASE_URL = "https://autolocalise-main-53fde32.zuplo.app";