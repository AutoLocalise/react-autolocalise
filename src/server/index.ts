import { TranslationConfig } from "../types";
import { TranslationService } from "../services/translation";
import {
  extractTextAndStyles,
  restoreStyledText,
} from "../utils/textFormatting";
import React from "react";

/**
 * Shared translation service cache with request-level batching
 * Prevents both initialization and translation API call duplication
 */
class ServerTranslationCache {
  private static services = new Map<string, TranslationService>();
  private static initPromises = new Map<string, Promise<void>>();

  // Request-level batching for translations
  private static pendingBatches = new Map<
    string,
    {
      promise: Promise<Record<string, string>>;
      texts: Set<string>;
    }
  >();

  static async getService(
    config: TranslationConfig
  ): Promise<TranslationService> {
    const cacheKey = `${config.apiKey}-${config.sourceLocale}-${config.targetLocale}`;

    // Return existing service if available
    if (this.services.has(cacheKey)) {
      return this.services.get(cacheKey)!;
    }

    // Check if initialization is in progress
    if (this.initPromises.has(cacheKey)) {
      await this.initPromises.get(cacheKey);
      return this.services.get(cacheKey)!;
    }

    // Start new initialization
    const initPromise = this.initializeService(config, cacheKey);
    this.initPromises.set(cacheKey, initPromise);

    await initPromise;
    this.initPromises.delete(cacheKey);

    return this.services.get(cacheKey)!;
  }

  /**
   * Batch translate with request-level deduplication
   * Multiple concurrent calls with overlapping texts will be merged
   */
  static async batchTranslate(
    texts: string[],
    config: TranslationConfig
  ): Promise<Record<string, string>> {
    // Skip translation if source and target locales are the same
    if (config.sourceLocale === config.targetLocale) {
      return Object.fromEntries(texts.map((str) => [str, str]));
    }

    const service = await this.getService(config);
    const cacheKey = `${config.apiKey}-${config.sourceLocale}-${config.targetLocale}`;

    const results: Record<string, string> = {};
    const textsToTranslate: string[] = [];

    // Check existing translations first
    for (const text of texts) {
      const existingTranslation = service.getCachedTranslation(text);
      if (existingTranslation) {
        results[text] = existingTranslation;
      } else {
        textsToTranslate.push(text);
      }
    }

    if (textsToTranslate.length === 0) {
      return results;
    }

    // Check if there's already a pending batch for this locale
    if (this.pendingBatches.has(cacheKey)) {
      const pendingBatch = this.pendingBatches.get(cacheKey)!;

      // Add our texts to the pending batch
      textsToTranslate.forEach((text) => pendingBatch.texts.add(text));

      // Wait for the batch to complete
      const batchResults = await pendingBatch.promise;

      // Extract our results
      textsToTranslate.forEach((text) => {
        results[text] = batchResults[text] || text;
      });

      return results;
    }

    // Start new batch
    const batchTexts = new Set(textsToTranslate);

    // Create a promise that will be resolved after the delay
    const batchPromise = (async () => {
      // Small delay to allow other components to join the batch
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Execute the batch with all accumulated texts
      const finalTexts = Array.from(this.pendingBatches.get(cacheKey)!.texts);
      const batchResults = await this.executeBatch(finalTexts, service);

      // Clean up
      this.pendingBatches.delete(cacheKey);

      return batchResults;
    })();

    this.pendingBatches.set(cacheKey, {
      promise: batchPromise,
      texts: batchTexts,
    });

    // Wait for the batch to complete
    const batchResults = await batchPromise;

    // Return results for our specific texts
    textsToTranslate.forEach((text) => {
      results[text] = batchResults[text] || text;
    });

    return results;
  }

  private static async executeBatch(
    texts: string[],
    service: TranslationService
  ): Promise<Record<string, string>> {
    const batchRequest = texts.map((text) => ({
      hashkey: service.generateHash(text),
      text,
      persist: true,
    }));

    try {
      return await service.translateBatch(batchRequest);
    } catch (error) {
      console.error("Batch translation error:", error);
      // Fallback to original texts
      return Object.fromEntries(texts.map((text) => [text, text]));
    }
  }

  private static async initializeService(
    config: TranslationConfig,
    cacheKey: string
  ): Promise<void> {
    const service = new TranslationService(config);
    await service.init(); // Step 1: Load existing translations from API (only once per locale!)
    this.services.set(cacheKey, service);
  }
}

/**
 * Reliable server-side translation utility
 * Follows the flow: 1) Load existing translations 2) Translate missing strings
 * Uses shared cache to avoid multiple API calls
 */
export class ServerTranslator {
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.config = config;
  }

  /**
   * Translate multiple strings reliably using shared cache
   * @param strings Array of strings to translate
   * @returns Promise<Record<string, string>> - Translated strings
   */
  async translateStrings(strings: string[]): Promise<Record<string, string>> {
    if (strings.length === 0) {
      return {};
    }

    // Skip translation if source and target locales are the same
    if (this.config.sourceLocale === this.config.targetLocale) {
      return Object.fromEntries(strings.map((str) => [str, str]));
    }

    // Get shared service (only initializes once per locale)
    const service = await ServerTranslationCache.getService(this.config);

    const results: Record<string, string> = {};
    const textsToTranslate: string[] = [];

    // Step 2a: Check existing translations first (from shared cache)
    for (const text of strings) {
      const existingTranslation = service.getCachedTranslation(text);
      if (existingTranslation) {
        results[text] = existingTranslation;
      } else {
        textsToTranslate.push(text);
      }
    }

    // Step 2b: Batch translate missing strings
    if (textsToTranslate.length > 0) {
      const batchRequest = textsToTranslate.map((text) => ({
        hashkey: service.generateHash(text),
        text,
        persist: true,
      }));

      try {
        const batchTranslations = await service.translateBatch(batchRequest);
        Object.assign(results, batchTranslations);
      } catch (error) {
        console.error("Batch translation error:", error);
        // Fallback to original texts
        textsToTranslate.forEach((text) => {
          results[text] = text;
        });
      }
    }

    return results;
  }

  /**
   * Translate formatted text with nested styling
   * @param formattedTexts Array of React nodes with nested styling
   * @returns Promise<React.ReactNode[]> - Array of translated React nodes
   */
  async translateFormatted(
    formattedTexts: React.ReactNode[]
  ): Promise<React.ReactNode[]> {
    if (formattedTexts.length === 0) {
      return [];
    }

    // Extract text templates from formatted content
    const textTemplates: string[] = [];
    const stylesArray: Array<{ node: React.ReactElement; text: string }[]> = [];

    formattedTexts.forEach((children) => {
      const { text, styles } = extractTextAndStyles(children);
      textTemplates.push(text);
      stylesArray.push(styles);
    });

    // Translate the text templates
    const translations = await this.translateStrings(textTemplates);

    // Restore styling to translated text
    return textTemplates.map((template, index) => {
      const translatedText = translations[template];
      const styles = stylesArray[index];
      return restoreStyledText(translatedText, styles);
    });
  }
}

/**
 * Simple function to create a server translator instance
 * @param config Translation configuration
 * @returns ServerTranslator instance
 */
export function createServerTranslator(
  config: TranslationConfig
): ServerTranslator {
  return new ServerTranslator(config);
}

/**
 * Create a synchronous server translator (recommended approach)
 * Pre-translates all strings, returns clean synchronous API
 *
 * @example
 * const t = await createServerT(["Hello", "World"], locale, config);
 *
 * return (
 *   <div>
 *     <h1>{t("Hello")}</h1>  // No await needed!
 *     <p>{t("World")}</p>    // Clean and simple!
 *   </div>
 * );
 */
export async function createServerT(
  strings: string[],
  locale: string,
  config: Omit<TranslationConfig, "targetLocale">
): Promise<(text: string) => string> {
  if (strings.length === 0) {
    return (text: string) => text;
  }

  const fullConfig = { ...config, targetLocale: locale };

  // Skip translation if source and target locales are the same
  if (fullConfig.sourceLocale === fullConfig.targetLocale) {
    return (text: string) => text;
  }

  // Pre-translate all strings upfront
  const translations = await ServerTranslationCache.batchTranslate(
    strings,
    fullConfig
  );

  // Return synchronous translator function
  return (text: string): string => {
    return translations[text] || text;
  };
}

/**
 * Utility function for translating strings in server components
 * Uses shared cache to avoid multiple API calls across components
 * @param strings Array of strings to translate
 * @param locale Target locale
 * @param config Translation configuration (without targetLocale)
 * @returns Promise<Record<string, string>> - Translated strings
 */
export async function translateServerStrings(
  strings: string[],
  locale: string,
  config: Omit<TranslationConfig, "targetLocale">
): Promise<Record<string, string>> {
  if (strings.length === 0) {
    return {};
  }

  const fullConfig = { ...config, targetLocale: locale };

  // Skip translation if source and target locales are the same
  if (fullConfig.sourceLocale === fullConfig.targetLocale) {
    return Object.fromEntries(strings.map((str) => [str, str]));
  }

  // Use request-level batching to minimize API calls
  return await ServerTranslationCache.batchTranslate(strings, fullConfig);
}

/**
 * Utility function for translating formatted text in server components
 * Uses shared cache to avoid multiple API calls across components
 * @param formattedTexts Array of React nodes with nested styling
 * @param locale Target locale
 * @param config Translation configuration (without targetLocale)
 * @returns Promise<React.ReactNode[]> - Array of translated React nodes
 */
export async function translateServerFormatted(
  formattedTexts: React.ReactNode[],
  locale: string,
  config: Omit<TranslationConfig, "targetLocale">
): Promise<React.ReactNode[]> {
  if (formattedTexts.length === 0) {
    return [];
  }

  // Extract text templates from formatted content
  const textTemplates: string[] = [];
  const stylesArray: Array<{ node: React.ReactElement; text: string }[]> = [];

  formattedTexts.forEach((children) => {
    const { text, styles } = extractTextAndStyles(children);
    textTemplates.push(text);
    stylesArray.push(styles);
  });

  // Translate the text templates using shared cache
  const translations = await translateServerStrings(
    textTemplates,
    locale,
    config
  );

  // Restore styling to translated text
  return textTemplates.map((template, index) => {
    const translatedText = translations[template];
    const styles = stylesArray[index];
    return restoreStyledText(translatedText, styles);
  });
}

/**
 * Ultimate clean server translator - no duplication, no await in JSX!
 * Uses a wrapper component approach for maximum cleanliness
 *
 * @example
 * export default ServerTranslated(locale, config, ({ t, tf }) => (
 *   <div>
 *     <h1>{t("Welcome")}</h1>                    // No duplication!
 *     <p>{t("Hello world")}</p>                  // No await!
 *     <div>{tf(<>Styled <b>text</b></>)}</div>   // Formatted text works!
 *   </div>
 * ));
 */
export function ServerTranslated(
  locale: string,
  config: Omit<TranslationConfig, "targetLocale">,
  renderFn: (helpers: {
    t: (text: string) => string;
    tf: (jsx: React.ReactNode) => React.ReactNode;
  }) => React.ReactNode
) {
  return async function ServerTranslatedComponent(): Promise<React.ReactNode> {
    const collectedStrings = new Set<string>();
    const collectedFormatted: React.ReactNode[] = [];
    const fullConfig = { ...config, targetLocale: locale };

    // ========== PASS 1: COLLECTION PHASE ==========
    // Create "collecting" functions that just gather strings without translating
    const collectingT = (text: string): string => {
      collectedStrings.add(text); // Just collect the string
      return text; // Return original text (no translation yet)
    };

    const collectingTf = (jsx: React.ReactNode): React.ReactNode => {
      collectedFormatted.push(jsx); // Collect in order
      return jsx; // Return original JSX (no translation yet)
    };

    // FIRST RENDER: Execute the render function to collect all strings
    // This doesn't produce the final output, just collects what needs translation
    renderFn({ t: collectingT, tf: collectingTf });

    // At this point we have:
    // collectedStrings = Set(["Hello", "Welcome", "Goodbye"])
    // collectedFormatted = Set([<>Styled <b>text</b></>])

    // ========== TRANSLATION PHASE ==========
    // Extract text templates from formatted content
    const formattedTextTemplates: string[] = [];
    const stylesArray: Array<{ node: React.ReactElement; text: string }[]> = [];

    collectedFormatted.forEach((children) => {
      const { text, styles } = extractTextAndStyles(children);
      formattedTextTemplates.push(text);
      stylesArray.push(styles);
    });

    // Combine all strings that need translation (regular + formatted templates)
    const allStringsToTranslate = [
      ...Array.from(collectedStrings),
      ...formattedTextTemplates,
    ];

    // Single batch translation call for all strings
    const allTranslations =
      allStringsToTranslate.length > 0
        ? await ServerTranslationCache.batchTranslate(
            allStringsToTranslate,
            fullConfig
          )
        : {};

    // Split results back into regular strings and formatted templates
    const stringTranslations: Record<string, string> = {};
    const formattedTemplateTranslations: Record<string, string> = {};

    Array.from(collectedStrings).forEach((str) => {
      stringTranslations[str] = allTranslations[str] || str;
    });

    formattedTextTemplates.forEach((template) => {
      formattedTemplateTranslations[template] =
        allTranslations[template] || template;
    });

    // Restore styling to translated formatted text
    const formattedTranslations = formattedTextTemplates.map(
      (template, index) => {
        const translatedText = formattedTemplateTranslations[template];
        const styles = stylesArray[index];
        return restoreStyledText(translatedText, styles);
      }
    );

    // At this point we have:
    // stringTranslations = {"Hello": "你好", "Welcome": "欢迎", "Goodbye": "再见"}
    // formattedTranslations = [<>样式化 <b>文本</b></>]

    // ========== PASS 2: FINAL RENDER PHASE ==========
    // Create "final" functions that return actual translations
    const finalT = (text: string): string => {
      return stringTranslations[text] || text; // Return translated text
    };

    // Use counter-based approach for tf function
    let tfCounter = 0;
    const finalTf = (jsx: React.ReactNode): React.ReactNode => {
      const translatedJsx = formattedTranslations[tfCounter++];
      return translatedJsx || jsx; // Return translated JSX or fallback to original
    };

    // SECOND RENDER: Execute render function again with actual translations
    // This produces the final translated output
    return renderFn({ t: finalT, tf: finalTf });
  };
}

/**
 * THE TWO-PASS APPROACH EXPLAINED:
 *
 * This is the core technique used by ServerTranslated to automatically collect
 * and translate strings without requiring pre-definition.
 *
 * PASS 1 - COLLECTION PHASE:
 * - Render the component with "collecting" functions
 * - t() and tf() functions just collect strings but return original text
 * - No translations happen yet, just string collection
 *
 * PASS 2 - TRANSLATION PHASE:
 * - Translate all collected strings in batch
 * - Render component again with actual translated strings
 * - Return the final translated JSX
 *
 * Example flow:
 * 1. renderFn({ t: collectingT, tf: collectingTf }) // Collects: ["Hello", "World"]
 * 2. await translateStrings(["Hello", "World"])     // Gets: {"Hello": "你好", "World": "世界"}
 * 3. renderFn({ t: finalT, tf: finalTf })          // Returns: <div>你好 世界</div>
 *
 * This approach allows for the clean API where you don't need to pre-define strings!
 */

/**
 * Higher-Order Component for server-side translation (RECOMMENDED)
 * Creates clean, reusable translated components
 *
 * @example
 * const MyComponent = withServerTranslation(config, ({ t, tf, locale, ...props }) => (
 *   <div>
 *     <h1>{t("Hello")} {props.name}</h1>
 *     <p>{tf(<>Welcome <strong>back</strong></>)}</p>
 *   </div>
 * ));
 *
 * // Usage:
 * <MyComponent locale="zh" name="John" />
 */
export function withServerTranslation<
  P extends Record<string, unknown> = Record<string, unknown>
>(
  config: TranslationConfig | Omit<TranslationConfig, "targetLocale">,
  Component: (
    props: P & {
      t: (text: string) => string;
      tf: (jsx: React.ReactNode) => React.ReactNode;
      locale: string;
    }
  ) => React.ReactNode
) {
  return async function TranslatedComponent(
    props: P & { locale?: string }
  ): Promise<React.ReactNode> {
    // Use locale from props if config doesn't have targetLocale, otherwise use config's targetLocale
    const locale =
      "targetLocale" in config ? config.targetLocale : props.locale || "en";

    // Use the config without targetLocale for ServerTranslated (it adds targetLocale internally)
    const configWithoutTarget =
      "targetLocale" in config
        ? { apiKey: config.apiKey, sourceLocale: config.sourceLocale }
        : config;

    const TranslatedJSX = ServerTranslated(
      locale,
      configWithoutTarget,
      ({ t, tf }) => Component({ ...props, locale, t, tf })
    );

    return await TranslatedJSX();
  };
}

export type { TranslationConfig };
export default ServerTranslator;
