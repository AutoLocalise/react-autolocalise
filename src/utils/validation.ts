import { TranslationConfig } from "../types";

/**
 * Validate locale format (BCP 47 compliant)
 * Accepts formats like: 'en', 'fil', 'zh-TW', 'es-419', 'bs-Cyrl'
 * Supports: 2-3 letter language codes, optional script codes, optional region codes (letters or digits)
 */
export function validateLocale(locale: string): void {
  if (!locale || typeof locale !== "string") {
    throw new Error("Locale must be a non-empty string");
  }

  // Trim whitespace
  const trimmedLocale = locale.trim();

  if (trimmedLocale.length === 0) {
    throw new Error("Locale cannot be empty or whitespace only");
  }

  // Check format: language code (2-3 letters) optionally followed by -script (4 letters) or -region (2-3 letters or 3 digits)
  const localeRegex = /^[a-z]{2,3}(-[A-Za-z0-9]{2,3})?(-[A-Za-z]{4})?$/;

  if (!localeRegex.test(trimmedLocale)) {
    throw new Error(
      `Invalid locale format: "${locale}". Expected format: "en", "fil", "en-US", "es-419", "bs-Cyrl" (BCP 47 compliant)`
    );
  }
}

/**
 * Validate translation configuration
 */
export function validateConfig(config: TranslationConfig): void {
  if (!config) {
    throw new Error("Configuration is required");
  }

  if (!config.apiKey || typeof config.apiKey !== "string") {
    throw new Error("API key must be a non-empty string");
  }

  const trimmedApiKey = config.apiKey.trim();

  if (trimmedApiKey.length === 0) {
    throw new Error("API key cannot be empty or whitespace only");
  }

  if (trimmedApiKey.length < 8) {
    throw new Error("API key appears to be invalid (too short)");
  }

  validateLocale(config.sourceLocale);
  validateLocale(config.targetLocale);

  if (config.sourceLocale === config.targetLocale) {
    // This is not an error, but worth noting - translations will be skipped
    console.warn(
      `Source locale and target locale are the same (${config.sourceLocale}). Translations will be skipped.`
    );
  }
}