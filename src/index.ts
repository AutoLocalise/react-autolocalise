export {
  TranslationProvider,
  useAutoTranslate,
} from "./context/TranslationContext";
export type { TranslationProviderSSRProps } from "./context/TranslationContext";

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

export default autoTranslate;
