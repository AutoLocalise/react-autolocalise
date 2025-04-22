import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TranslationProvider, useAutoTranslate } from "../TranslationContext";
import { TranslationService } from "../../services/translation";
import React from "react";

// Mock the storage adapter
const mockStorageAdapter = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock the storage adapter to return our shared mock
jest.mock("../../storage", () => ({
  getStorageAdapter: jest.fn(() => mockStorageAdapter),
  isServer: jest.fn(() => false),
}));

// Mock the TranslationService
jest.mock("../../services/translation");

describe("TranslationContext", () => {
  const mockTranslate = jest.fn();
  const mockGetCachedTranslation = jest.fn();
  const mockIsTranslationPending = jest.fn();
  const mockInit = jest.fn();
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock implementation
    (TranslationService as jest.Mock).mockImplementation(() => ({
      translate: mockTranslate,
      getCachedTranslation: mockGetCachedTranslation,
      isTranslationPending: mockIsTranslationPending,
      init: mockInit,
      onUpdate: mockOnUpdate,
    }));
  });

  it("should not call translate when source and target locales are the same", async () => {
    const TestComponent = () => {
      const { t } = useAutoTranslate();
      const text = t("Hello");
      return <div>{text}</div>;
    };

    const config = {
      apiKey: "test-key",
      sourceLocale: "en",
      targetLocale: "en", // Same locale
    };

    await act(async () => {
      render(
        <TranslationProvider config={config}>
          <TestComponent />
        </TranslationProvider>
      );
    });

    // Wait for any pending state updates
    await act(async () => {
      await Promise.resolve();
    });

    // Verify that initialization occurred
    expect(mockInit).toHaveBeenCalled();

    // Verify that translate was not called
    expect(mockTranslate).not.toHaveBeenCalled();

    // Verify that getCachedTranslation was not called
    expect(mockGetCachedTranslation).not.toHaveBeenCalled();

    // Verify that isTranslationPending was not called
    expect(mockIsTranslationPending).not.toHaveBeenCalled();

    // Verify the original text is rendered
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
