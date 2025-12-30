import React from "react";
import { extractTextAndStyles, restoreStyledText } from "../textFormatting";

describe("Text Formatting Utils", () => {
  describe("extractTextAndStyles", () => {
    it("should extract plain text without styles", () => {
      const result = extractTextAndStyles("Hello World");
      expect(result.text).toBe("Hello World");
      expect(result.styles).toEqual([]);
    });

    it("should extract text with single styled element", () => {
      const element = React.createElement("span", { style: { color: "red" } }, "World");
      const result = extractTextAndStyles(
        React.createElement("div", null, ["Hello ", element, "!"])
      );
      expect(result.text).toContain("Hello");
      expect(result.text).toContain("<0>World</0>");
      expect(result.text).toContain("!");
      expect(result.styles).toHaveLength(1);
      expect(result.styles[0].text).toBe("World");
    });

    it("should extract text with multiple styled elements", () => {
      const bold = React.createElement("strong", null, "bold");
      const italic = React.createElement("em", null, "italic");
      const result = extractTextAndStyles(
        React.createElement("div", null, ["This is ", bold, " and ", italic, " text"])
      );
      expect(result.text).toContain("This is");
      expect(result.text).toContain("<0>bold</0>");
      expect(result.text).toContain("<1>italic</1>");
      expect(result.text).toContain("text");
      expect(result.styles).toHaveLength(2);
    });

    it("should handle nested styled elements", () => {
      const inner = React.createElement("em", null, "inner");
      const outer = React.createElement("strong", null, ["outer ", inner]);
      const result = extractTextAndStyles(React.createElement("div", null, ["Text: ", outer]));
      expect(result.text).toContain("Text:");
      expect(result.text).toContain("outer");
      expect(result.text).toContain("<0>inner</0>");
      expect(result.styles).toHaveLength(1);
    });

    it("should handle empty input", () => {
      const result = extractTextAndStyles("");
      expect(result.text).toBe("");
      expect(result.styles).toEqual([]);
    });

    it("should handle null/undefined children", () => {
      const result = extractTextAndStyles(
        React.createElement("div", null, [null, "text", undefined])
      );
      expect(result.text).toBe("text");
      expect(result.styles).toEqual([]);
    });
  });

  describe("restoreStyledText", () => {
    it("should restore plain text without styles", () => {
      const result = restoreStyledText("Hello World", []);
      expect(result).toEqual(["Hello World"]);
    });

    it("should restore single styled element", () => {
      const styledNode = React.createElement("span", { style: { color: "red" } }, "World");
      const styles = [{ node: styledNode, text: "World" }];
      const result = restoreStyledText("Hello <0>World</0>!", styles);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Hello ");
      expect(result[1]).toEqual(expect.objectContaining({ type: "span" }));
      expect(result[2]).toBe("!");
    });

    it("should restore multiple styled elements", () => {
      const bold = React.createElement("strong", null, "bold");
      const italic = React.createElement("em", null, "italic");
      const styles = [
        { node: bold, text: "bold" },
        { node: italic, text: "italic" },
      ];
      const result = restoreStyledText("This is <0>bold</0> and <1>italic</1> text", styles);
      expect(result).toHaveLength(5);
    });

    it("should handle missing style indices gracefully", () => {
      const styles = [{ node: React.createElement("span", null, "text"), text: "text" }];
      const result = restoreStyledText("Hello <0>text</0> and <2>missing</2>", styles);
      expect(result).toHaveLength(5);
      expect(result[0]).toBe("Hello ");
      expect(result[1]).toEqual(expect.objectContaining({ type: "span" }));
      expect(result[2]).toBe(" and ");
      expect(result[3]).toBe("<2>missing</2>");
      expect(result[4]).toBe("");
    });

    it("should handle empty styles array", () => {
      const result = restoreStyledText("Hello <0>World</0>", []);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Hello ");
      expect(result[1]).toBe("<0>World</0>");
      expect(result[2]).toBe("");
    });

    it("should handle empty translated text", () => {
      const result = restoreStyledText("", []);
      expect(result).toEqual([""]);
    });
  });

  describe("Integration Tests", () => {
    it("should round-trip text with styles", () => {
      const original = React.createElement("div", null, [
        "Hello ",
        React.createElement("strong", { style: { fontWeight: "bold" } }, "World"),
        "!",
      ]);

      const { text, styles } = extractTextAndStyles(original);
      const translated = text.replace("World", "Mundo");
      const restored = restoreStyledText(translated, styles);

      expect(restored).toHaveLength(3);
      expect(restored[0]).toBe("Hello ");
      expect(restored[1]).toEqual(expect.objectContaining({ type: "strong" }));
      expect(restored[2]).toBe("!");
    });
  });
});