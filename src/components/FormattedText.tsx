import React from "react";
import { useAutoTranslate } from "../context/TranslationContext";
import {
  extractTextAndStyles,
  restoreStyledText,
} from "../utils/textFormatting";

/**
 * FormattedText is a component that handles nested text formatting during translation.
 * It preserves styling and structure of nested text elements while allowing the content
 * to be translated.
 *
 * @example
 * ```tsx
 * <FormattedText>
 *   Hello, <span style={{ color: 'red' }}>world</span>!
 * </FormattedText>
 * ```
 */
interface FormattedTextProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  /**
   * Whether to persist the text for review in the dashboard.
   * @default true
   */
  persist?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  children,
  style,
  persist = true,
}) => {
  const { t } = useAutoTranslate();

  const { text, styles } = extractTextAndStyles(children);
  const translatedText = t(text, persist);

  return <span style={style}>{restoreStyledText(translatedText, styles)}</span>;
};
