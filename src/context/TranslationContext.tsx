import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import { TranslationConfig, TranslationContextType } from "../types";
import { TranslationService } from "../services/translation";
import { isServer } from "../storage";

const TranslationContext = createContext<TranslationContextType>({
  /**
   * Translates the given text to the target language
   * @param text - The text to translate
   * @param persist - Optional parameter to specify if the translation should be persisted
   * @returns The translated text, or the original text if translation is not yet available
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  translate: (text: string, persist: boolean = true, reference?: string) =>
    text,
  loading: true,
  error: null,
});

interface TranslationProviderProps {
  config: TranslationConfig;
  children: React.ReactNode;
}

interface TranslationProviderSSRProps extends TranslationProviderProps {
  /**
   * Optional initial translations for server-side rendering
   * This allows passing pre-fetched translations from the server to the client
   */
  initialTranslations?: Record<string, string>;
}

export type { TranslationProviderProps, TranslationProviderSSRProps };

export const TranslationProvider: React.FC<TranslationProviderSSRProps> = ({
  config,
  children,
  initialTranslations,
}) => {
  // Use useRef to avoid re-creating the service during hydration
  const serviceRef = useRef<TranslationService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new TranslationService(config);

    // If we have initial translations from SSR, pre-populate the service
    if (initialTranslations && !isServer()) {
      serviceRef.current.preloadTranslations(initialTranslations);
    }
  }

  const service = serviceRef.current;
  const [loading, setLoading] = useState(!initialTranslations);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const isSSR = isServer();

  useEffect(() => {
    // Skip initialization on server-side to prevent fetch requests during SSR
    if (isSSR) {
      setLoading(false);
      return;
    }

    const initializeTranslations = async () => {
      try {
        // If we have initial translations, we can skip the initial fetch
        if (!initialTranslations) {
          if (config.sourceLocale !== config.targetLocale) {
            await service.init();
          }
        } else {
          // Mark as initialized even with preloaded translations
          service.isInitialized = true;
        }
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to initialize translations")
        );
        setLoading(false);
      }
    };

    initializeTranslations();

    // Subscribe to translation updates
    service.onUpdate(() => {
      // Increment version to trigger re-render when translations update
      setVersion((v) => v + 1);
    });

    // Cleanup subscription on unmount
    return () => {
      service.cleanup?.();
    };
  }, [service, initialTranslations, isSSR]);

  // const [translations, setTranslations] = useState<Record<string, string>>({});

  // Remove the translations state
  const translate = useMemo(
    () =>
      (text: string, persist: boolean = true, reference?: string): string => {
        if (!text || loading) return text;

        // Skip translation if source and target languages are the same
        if (config.sourceLocale === config.targetLocale) {
          return text;
        }

        // Return cached translation if available
        const cachedTranslation = service.getCachedTranslation(text);
        if (cachedTranslation) return cachedTranslation;

        // Start async translation if not already pending
        if (!service.isTranslationPending(text)) {
          return service.translate(text, persist, reference);
        }

        // Return original text while translation is pending
        return text;
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, loading, version] // Add version to dependencies to trigger re-render
  );

  return (
    <TranslationContext.Provider value={{ translate, loading, error }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useAutoTranslate = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useAutoTranslate must be used within a TranslationProvider"
    );
  }
  return {
    t: (text: string, persist: boolean = true, reference?: string) =>
      context.translate(text, persist, reference),
    loading: context.loading,
    error: context.error,
  };
};
