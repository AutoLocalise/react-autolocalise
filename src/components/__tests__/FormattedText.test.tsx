import React from "react";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { FormattedText } from "../FormattedText";
import { TranslationContext } from "../../context/TranslationContext";

// Mock the translation context
const mockTranslate = jest.fn((text: string) => text);

const mockContextValue = {
  translate: mockTranslate,
  loading: false,
  error: null,
};

describe("FormattedText Component", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TranslationContext.Provider value={mockContextValue}>
      {children}
    </TranslationContext.Provider>
  );

  it("should render formatted text with nested styling", () => {
    mockTranslate.mockClear();
    render(
      <FormattedText>
        Hello, <span style={{ color: "red" }}>World</span>!
      </FormattedText>,
      { wrapper }
    );

    // Check what translate was called with
    expect(mockTranslate).toHaveBeenCalledWith("Hello, <0>World</0>!", true, undefined);

    // The component should render the text
    expect(screen.getByText(/Hello/)).toBeTruthy();
    expect(screen.getByText(/World/)).toBeTruthy();
  });

it("should apply custom style prop", () => {
      const { container } = render(
        <FormattedText style={{ fontSize: "16px" }}>Test</FormattedText>,
        { wrapper }
      );

      const span = container.querySelector("span");
      expect(span).toBeTruthy();
      expect(span?.style.fontSize).toBe("16px");
    });

    it("should handle empty children", () => {
      const { container } = render(
        <FormattedText>{null}</FormattedText>,
        { wrapper }
      );
      expect(container).toBeTruthy();
    });

  it("should handle plain text without styling", () => {
    render(<FormattedText>Plain text</FormattedText>, { wrapper });
    expect(screen.getByText("Plain text")).toBeTruthy();
  });

  it("should handle multiple nested styled elements", () => {
    render(
      <FormattedText>
        This is <strong>bold</strong> and <em>italic</em> text
      </FormattedText>,
      { wrapper }
    );

    expect(screen.getByText("bold")).toBeTruthy();
    expect(screen.getByText("italic")).toBeTruthy();
  });

  it("should handle deeply nested elements", () => {
    render(
      <FormattedText>
        Outer <span>inner <strong>deep</strong></span>
      </FormattedText>,
      { wrapper }
    );

    expect(screen.getByText("deep")).toBeTruthy();
  });

  it("should use persist=true by default", () => {
    mockTranslate.mockClear();
    render(
      <FormattedText>Test</FormattedText>,
      { wrapper }
    );
    // The component should call translate with persist=true by default
    expect(mockTranslate).toHaveBeenCalledWith("Test", true, undefined);
  });

  it("should handle persist=false", () => {
    mockTranslate.mockClear();
    render(
      <FormattedText persist={false}>Test</FormattedText>,
      { wrapper }
    );
    expect(mockTranslate).toHaveBeenCalledWith("Test", false, undefined);
  });

  it("should handle special characters", () => {
    render(
      <FormattedText>
        Special: <span>&lt;&gt;&amp;</span>
      </FormattedText>,
      { wrapper }
    );

    expect(screen.getByText(/Special:/)).toBeTruthy();
  });

  it("should handle very long text", () => {
    const longText = "A".repeat(1000);
    render(<FormattedText>{longText}</FormattedText>, { wrapper });
    expect(screen.getByText(longText)).toBeTruthy();
  });

  it("should handle null/undefined in children gracefully", () => {
    render(
      <FormattedText>
        {null} text {undefined}
      </FormattedText>,
      { wrapper }
    );
    expect(screen.getByText("text")).toBeTruthy();
  });
});