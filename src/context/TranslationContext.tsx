import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { TranslationConfig, TranslationContextType } from "../types";
import { TranslationService } from "../services/translation";
import { isServer } from "../storage";

const TranslationContext = createContext<TranslationContextType | null>(null);

export { TranslationContext };

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
  const [service] = useState(() => {
    const instance = new TranslationService(config);

    // If we have initial translations from SSR, pre-populate the service
    if (initialTranslations && !isServer()) {
      instance.preloadTranslations(initialTranslations);
    }

    return instance;
  });
  const [loading, setLoading] = useState(!initialTranslations);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const { sourceLocale, targetLocale } = config;

  useEffect(() => {
    const initializeTranslations = async () => {
      try {
        // If we have initial translations, we can skip the initial fetch
        if (!initialTranslations) {
          if (sourceLocale !== targetLocale) {
            await service.init();
          }
        }
        // Note: preloadTranslations already sets isInitialized = true
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
  }, [service, initialTranslations, sourceLocale, targetLocale]);

  const translate = useMemo(
    () =>
      (text: string, persist: boolean = true, reference?: string): string => {
        if (!text || loading) return text;

        // Skip translation if source and target languages are the same
        if (sourceLocale === targetLocale) {
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
    [service, loading, version, sourceLocale, targetLocale] // Add version to dependencies to trigger re-render
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      translate,
      loading,
      error,
    }),
    [translate, loading, error]
  );

  return (
    <TranslationContext.Provider value={contextValue}>
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
