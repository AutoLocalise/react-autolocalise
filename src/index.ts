export {
  TranslationProvider,
  useAutoTranslate,
} from "./context/TranslationContext";
export type {
  TranslationProviderProps,
  TranslationProviderSSRProps,
} from "./context/TranslationContext";
export type {
  TranslationConfig,
  AccessTokenResponse,
  TranslationContextType,
} from "./types";
export { AccessTokenError, ConfigurationError } from "./types";

// Export isServer utility
export { isServer } from "./storage";

// Initialize function for non-React usage
import { TranslationService } from "./services/translation";
import { TranslationConfig } from "./types";

const autoTranslate = {
  init: (config: TranslationConfig) => {
    const service = new TranslationService(config);
    return service.init();
  },
};

export { FormattedText } from "./components/FormattedText";
export type { FormattedTextProps } from "./components/FormattedText";
export {
  extractTextAndStyles,
  restoreStyledText,
} from "./utils/textFormatting";

export default autoTranslate;
