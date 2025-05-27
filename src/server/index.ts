import { TranslationConfig } from "../types";
import { TranslationService } from "../services/translation";
import {
  extractTextAndStyles,
  restoreStyledText,
} from "../utils/textFormatting";
import React from "react";

/**
 * Simple server-side translation utility for Next.js
 * Uses batch execution to avoid rate limits and improve performance
 */
export class ServerTranslation {
  private static sharedService: TranslationService | null = null;
  private static initPromise: Promise<void> | null = null;
  private config: TranslationConfig;
  private pendingTexts: Set<string> = new Set();

  constructor(config: TranslationConfig) {
    this.config = config;
  }

  /**
   * Initialize the shared translation service once
   */
  private static async ensureInitialized(
    config: TranslationConfig
  ): Promise<void> {
    if (ServerTranslation.sharedService) {
      return;
    }

    if (ServerTranslation.initPromise) {
      await ServerTranslation.initPromise;
      return;
    }

    ServerTranslation.initPromise = (async () => {
      ServerTranslation.sharedService = new TranslationService(config);
      await ServerTranslation.sharedService.init();
    })();

    await ServerTranslation.initPromise;
  }

  /**
   * Mark text for translation (returns original text immediately)
   */
  t(text: string): string {
    if (!text) return text;

    // Return original text if source and target locales are the same
    if (this.config.sourceLocale === this.config.targetLocale) {
      return text;
    }

    this.pendingTexts.add(text);
    return text;
  }

  /**
   * Mark formatted text with nested styling for translation (server-side version of FormattedText)
   * @param children React nodes with nested styling
   * @returns Original text template for translation
   */
  tFormatted(children: React.ReactNode): string {
    const { text } = extractTextAndStyles(children);
    return this.t(text);
  }

  /**
   * Get formatted text with restored styling after translation
   * @param children Original React nodes with nested styling
   * @returns Translated React nodes with restored styling
   */
  getFormatted(children: React.ReactNode): React.ReactNode[] {
    const { text, styles } = extractTextAndStyles(children);
    const translatedText = this.get(text);
    return restoreStyledText(translatedText, styles);
  }

  /**
   * Execute all pending translations in a single batch
   * This is the key to avoiding rate limits!
   */
  async execute(): Promise<Record<string, string>> {
    if (this.pendingTexts.size === 0) {
      return {};
    }

    // Ensure service is initialized
    await ServerTranslation.ensureInitialized(this.config);

    if (!ServerTranslation.sharedService) {
      throw new Error("Translation service not initialized");
    }

    const textsArray = Array.from(this.pendingTexts);
    const results: Record<string, string> = {};
    const textsToTranslate: string[] = [];

    // Check existing translations first
    for (const text of textsArray) {
      const existingTranslation =
        ServerTranslation.sharedService.getCachedTranslation(text);
      if (existingTranslation) {
        results[text] = existingTranslation;
      } else {
        textsToTranslate.push(text);
      }
    }

    // Batch translate only the texts that don't exist
    if (textsToTranslate.length > 0) {
      const batchRequest = textsToTranslate.map((text) => ({
        hashkey: ServerTranslation.sharedService!.generateHash(text),
        text,
        persist: true,
      }));

      try {
        const batchTranslations =
          await ServerTranslation.sharedService.translateBatch(batchRequest);
        Object.assign(results, batchTranslations);
      } catch (error) {
        console.error("Batch translation error:", error);
        // Fallback to original texts
        textsToTranslate.forEach((text) => {
          results[text] = text;
        });
      }
    }

    this.pendingTexts.clear();
    return results;
  }

  /**
   * Get translated text (must call after execute())
   */
  get(text: string): string {
    if (!text) return text;

    // Return original text if source and target locales are the same
    if (this.config.sourceLocale === this.config.targetLocale) {
      return text;
    }

    if (!ServerTranslation.sharedService) {
      return text;
    }

    const translation =
      ServerTranslation.sharedService.getCachedTranslation(text);
    return translation || text;
  }
}

export { TranslationConfig };
export default ServerTranslation;
