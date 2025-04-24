import { TranslationConfig } from "../types";
import { TranslationService } from "../services/translation";

/**
 * Server-side translation utility for Next.js
 * This module provides a dedicated server-side translation implementation
 * that works without React context and is optimized for SSR environments.
 */
export class ServerTranslation {
  private service: TranslationService;
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.service = new TranslationService(config);
    this.config = config;
  }

  /**
   * Initialize the translation service and pre-translate the provided texts
   * @param texts Array of texts to pre-translate
   * @returns A promise that resolves to a record of translations
   */
  async translateTexts(texts: string[]): Promise<Record<string, string>> {
    if (this.config.sourceLocale === this.config.targetLocale) {
      // If source and target locales are the same, return the original texts
      return texts.reduce((acc, text) => {
        acc[text] = text;
        return acc;
      }, {} as Record<string, string>);
    }
    await this.service.init();

    const translations: Record<string, string> = {};

    // Batch process translations for server-side
    const validTexts = texts.filter((text) => !!text);
    if (validTexts.length === 0) return translations;

    // Create batch request with all texts
    const batchRequest = validTexts.map((text) => ({
      hashkey: this.service.generateHash(text),
      text,
      type: "static",
    }));

    try {
      const batchTranslations = await this.service.translateBatch(batchRequest);
      validTexts.forEach((text) => {
        translations[text] = batchTranslations[text] || text;
      });
    } catch (error) {
      console.error("Batch translation error:", error);
      // Fallback to returning original texts on error
      validTexts.forEach((text) => {
        translations[text] = text;
      });
    }

    return translations;
  }
}

export { TranslationConfig };
