import React from "react";

/**
 * Extracts text content and styled nodes from React children for translation.
 * Converts nested span elements into a template format (e.g., <0>styled text</0>)
 * while preserving the original styled nodes for later restoration.
 *
 * @param nodes - The React nodes to process
 * @returns An object containing the template text and an array of styled nodes
 */
export function extractTextAndStyles(nodes: React.ReactNode): {
  text: string;
  styles: Array<{ node: React.ReactElement; text: string }>;
} {
  const styles: Array<{ node: React.ReactElement; text: string }> = [];
  let text = "";

  const processNode = (node: React.ReactNode) => {
    if (typeof node === "string") {
      text += node;
      return;
    }

    if (React.isValidElement(node)) {
      const children = (node as any).props.children;
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

  // Handle array of nodes at the root level
  if (Array.isArray(nodes)) {
    nodes.forEach(processNode);
  } else {
    processNode(nodes);
  }

  return { text, styles };
}

/**
 * Restores the styled nodes in the translated text by replacing template markers
 * with the original styled components, but with translated content.
 *
 * @param translatedText - The translated text containing template markers
 * @param styles - Array of original styled nodes and their text content
 * @returns An array of React nodes with restored styling and translated content
 */
export function restoreStyledText(
  translatedText: string,
  styles: Array<{ node: React.ReactElement; text: string }>
): React.ReactNode[] {
  const parts = translatedText.split(/(<\d+>[^<]*<\/\d+>)/g);
  return parts.map((part, index) => {
    const match = part.match(/<(\d+)>([^<]*)<\/\1>/);
    if (match) {
      const [, styleIndex, content] = match;
      const style = styles[parseInt(styleIndex)];
      if (style) {
        return React.cloneElement(style.node, { key: `styled-${index}` }, content);
      }
      // If style doesn't exist, preserve the full marker
      return part;
    }
    return part;
  });
}
