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
  private translations: Map<string, string>;
  private pendingTexts: Set<string>;

  constructor(config: TranslationConfig) {
    this.service = new TranslationService(config);
    this.config = config;
    this.translations = new Map();
    this.pendingTexts = new Set();
  }

  /**
   * Mark text for translation and return a translation proxy
   * @param text Text to be translated
   * @returns A proxy that will return the translated text once translations are ready
   */
  t(text: string): string {
    if (!text) return text;
    this.pendingTexts.add(text);
    return text;
  }

  /**
   * Execute all pending translations in one batch and update the translations map
   */
  async execute(): Promise<void> {
    if (this.pendingTexts.size === 0) return;

    if (this.config.sourceLocale === this.config.targetLocale) {
      this.pendingTexts.forEach((text) => this.translations.set(text, text));
      this.pendingTexts.clear();
      return;
    }

    await this.service.init();
    const texts = Array.from(this.pendingTexts);
    const batchRequest = texts.map((text) => ({
      hashkey: this.service.generateHash(text),
      text,
      persist: true,
    }));

    try {
      const batchTranslations = await this.service.translateBatch(batchRequest);
      texts.forEach((text) => {
        this.translations.set(text, batchTranslations[text] || text);
      });
    } catch (error) {
      console.error("Batch translation error:", error);
      texts.forEach((text) => this.translations.set(text, text));
    }

    this.pendingTexts.clear();
  }

  /**
   * Get the translated text for a previously marked text
   */
  get(text: string): string {
    return this.translations.get(text) || text;
  }
}

export { TranslationConfig };
