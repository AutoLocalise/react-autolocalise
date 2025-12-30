import { TranslationConfig } from "../types";

/**
 * Validate locale format (BCP 47 compliant)
 * Accepts formats like: 'en', 'fil', 'zh-TW', 'es-419', 'bs-Cyrl'
 * Supports: 2-3 letter language codes, optional script codes, optional region codes (letters or digits)
 */
export function validateLocale(locale: string): void {
  if (locale === null || locale === undefined || typeof locale !== "string") {
    console.warn("Locale must be a non-empty string");
    return;
  }

  // Trim whitespace
  const trimmedLocale = locale.trim();

  if (trimmedLocale.length === 0) {
    console.warn("Locale cannot be empty or whitespace only");
    return;
  }

  // Check format: language code (2-3 letters) optionally followed by -script (4 letters) or -region (2-3 letters or 3 digits)
  const localeRegex = /^[a-z]{2,3}(-[A-Za-z0-9]{2,3})?(-[A-Za-z]{4})?$/;

  if (!localeRegex.test(trimmedLocale)) {
    console.warn(
      `Invalid locale format: "${locale}". Expected format: "en", "fil", "en-US", "es-419", "bs-Cyrl" (BCP 47 compliant)`
    );
  }
}

/**
 * Validate translation configuration
 */
export function validateConfig(config: TranslationConfig): void {
  if (config === null || config === undefined) {
    console.warn("Configuration is required");
    return;
  }

  if (config.apiKey === null || config.apiKey === undefined || typeof config.apiKey !== "string") {
    console.warn("API key must be a non-empty string");
    return;
  }

  const trimmedApiKey = config.apiKey.trim();

  if (trimmedApiKey.length === 0) {
    console.warn("API key cannot be empty or whitespace only");
    return;
  }

  if (trimmedApiKey.length < 8) {
    console.warn("API key appears to be invalid (too short)");
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