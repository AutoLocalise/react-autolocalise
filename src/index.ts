export {
  TranslationProvider,
  useAutoTranslate,
} from "./context/TranslationContext";

// Next.js specific exports
export { getServerSideTranslations } from "./nextjs";

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

export default autoTranslate;
