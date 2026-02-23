import { TranslationConfig, ConfigurationError } from "../types";

/**
 * Validate locale format (BCP 47 compliant)
 * Accepts formats like: 'en', 'fil', 'zh-TW', 'es-419', 'bs-Cyrl'
 * Supports: 2-3 letter language codes, optional script codes, optional region codes (letters or digits)
 */
export function validateLocale(locale: string, fieldName: string): void {
  if (locale === null || locale === undefined || typeof locale !== "string") {
    throw new ConfigurationError(`${fieldName} must be a non-empty string`);
  }

  // Trim whitespace
  const trimmedLocale = locale.trim();

  if (trimmedLocale.length === 0) {
    throw new ConfigurationError(`${fieldName} cannot be empty or whitespace only`);
  }

  // Check format: language code (2-3 letters) optionally followed by -script (4 letters) or -region (2-3 letters or 3 digits)
  const localeRegex = /^[a-z]{2,3}(-[A-Za-z0-9]{2,3})?(-[A-Za-z]{4})?$/;

  if (!localeRegex.test(trimmedLocale)) {
    throw new ConfigurationError(
      `Invalid ${fieldName} format: "${locale}". Expected format: "en", "fil", "en-US", "es-419", "bs-Cyrl" (BCP 47 compliant)`
    );
  }
}

/**
 * Validate translation configuration
 * @throws ConfigurationError if configuration is invalid
 */
export function validateConfig(config: TranslationConfig): void {
  if (config === null || config === undefined) {
    throw new ConfigurationError("Configuration is required");
  }

  const hasApiKey = config.apiKey !== null && config.apiKey !== undefined && typeof config.apiKey === "string";
  const hasGetAccessToken = typeof config.getAccessToken === "function";

  if (!hasApiKey && !hasGetAccessToken) {
    throw new ConfigurationError("Either apiKey or getAccessToken must be provided");
  }

  if (hasApiKey && hasGetAccessToken) {
    throw new ConfigurationError("Only one of apiKey or getAccessToken should be provided, not both");
  }

  if (hasApiKey) {
    const trimmedApiKey = config.apiKey!.trim();
    if (trimmedApiKey.length === 0) {
      throw new ConfigurationError("API key cannot be empty or whitespace only");
    }
    if (trimmedApiKey.length < 8) {
      console.warn("API key appears to be invalid (too short)");
    }
  }

  validateLocale(config.sourceLocale, "sourceLocale");
  validateLocale(config.targetLocale, "targetLocale");

  if (config.sourceLocale === config.targetLocale) {
    // This is not an error, but worth noting - translations will be skipped
    console.warn(
      `Source locale and target locale are the same (${config.sourceLocale}). Translations will be skipped.`
    );
  }
}