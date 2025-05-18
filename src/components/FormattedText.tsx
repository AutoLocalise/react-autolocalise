import React from "react";
import { useAutoTranslate } from "../context/TranslationContext";

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

  /**
   * Extracts text content and styled nodes from the children prop.
   * Converts nested span elements into a template format (e.g., <0>styled text</0>)
   * while preserving the original styled nodes for later restoration.
   *
   * @param nodes - The React nodes to process (typically the children prop)
   * @returns An object containing the template text and an array of styled nodes
   */
  const extractTextAndStyles = (
    nodes: React.ReactNode
  ): {
    text: string;
    styles: Array<{ node: React.ReactElement; text: string }>;
  } => {
    const styles: Array<{ node: React.ReactElement; text: string }> = [];
    let text = "";

    const processNode = (node: React.ReactNode) => {
      if (typeof node === "string") {
        text += node;
        return;
      }

      if (React.isValidElement(node)) {
        const children = node.props.children;
        if (typeof children === "string") {
          text += `<${styles.length}>${children}</${styles.length}>`;
          styles.push({ node, text: children });
        } else if (Array.isArray(children)) {
          children.forEach(processNode);
        } else if (children) {
          processNode(children);
        }
      }
    };

    processNode(nodes);
    return { text, styles };
  };

  /**
   * Restores the styled nodes in the translated text by replacing template markers
   * with the original styled components, but with translated content.
   *
   * @param translatedText - The translated text containing template markers
   * @param styles - Array of original styled nodes and their text content
   * @returns An array of React nodes with restored styling and translated content
   */
  const restoreStyledText = (
    translatedText: string,
    styles: Array<{ node: React.ReactElement; text: string }>
  ): React.ReactNode[] => {
    const parts = translatedText.split(/(<\d+>.*?<\/\d+>)/g);
    return parts.map((part, index) => {
      const match = part.match(/<(\d+)>(.*?)<\/\1>/);
      if (match) {
        const [, styleIndex, content] = match;
        const { node } = styles[parseInt(styleIndex)];
        return React.cloneElement(node, { key: `styled-${index}` }, content);
      }
      return part;
    });
  };

  const { text, styles } = extractTextAndStyles(children);
  const translatedText = t(text, persist);

  return <span style={style}>{restoreStyledText(translatedText, styles)}</span>;
};
