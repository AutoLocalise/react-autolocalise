/**
 * Next.js specific utilities for AutoLocalise
 * This file provides helpers for server-side rendering in Next.js applications
 */

import { TranslationConfig } from "./types";
import { TranslationService } from "./services/translation";

/**
 * Fetches translations on the server side for Next.js getServerSideProps or getStaticProps
 *
 * @example
 * // In getServerSideProps or getStaticProps
 * export async function getServerSideProps() {
 *   const translations = await getServerSideTranslations({
 *     apiKey: 'your-api-key',
 *     sourceLocale: 'en',
 *     targetLocale: 'fr'
 *   });
 *
 *   return {
 *     props: {
 *       translations
 *     }
 *   };
 * }
 *
 * // In your page component
 * function MyPage({ translations }) {
 *   return (
 *     <TranslationProvider
 *       config={{
 *         apiKey: 'your-api-key',
 *         sourceLocale: 'en',
 *         targetLocale: 'fr'
 *       }}
 *       initialTranslations={translations}
 *     >
 *       <YourComponent />
 *     </TranslationProvider>
 *   );
 * }
 */
export async function getServerSideTranslations(
  config: TranslationConfig,
  texts?: string[]
): Promise<Record<string, string>> {
  // Create a new translation service instance
  const service = new TranslationService(config);

  // Initialize the service (this will be a no-op in server environment)
  await service.init();

  // If specific texts are provided, pre-translate them
  if (texts && texts.length > 0) {
    // Pre-translate each text
    const translations: Record<string, string> = {};

    // This would ideally call a batch translation API
    // For now, we'll just return an empty object as the actual translation
    // would happen on the client side

    return translations;
  }

  // Return empty translations object
  // In a real implementation, you might want to fetch common translations
  return {};
}