import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { TranslationProvider, useAutoTranslate } from "../TranslationContext";

global.fetch = jest.fn();

const Probe = () => {
  const { t, loading } = useAutoTranslate();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="text">{t("Hello")}</span>
    </div>
  );
};

const Outside = () => {
  useAutoTranslate();
  return null;
};

describe("TranslationProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("throws when used outside a provider", () => {
    expect(() => render(<Outside />)).toThrow(
      "useAutoTranslate must be used within a TranslationProvider",
    );
  });

  it("returns the original text while source and target locales match", async () => {
    render(
      <TranslationProvider
        config={{
          apiKey: "test-key-123456",
          sourceLocale: "en",
          targetLocale: "en",
        }}
      >
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("text").textContent).toBe("Hello");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hydrates from initialTranslations without fetching", async () => {
    render(
      <TranslationProvider
        config={{
          apiKey: "test-key-123456",
          sourceLocale: "en",
          targetLocale: "es",
        }}
        initialTranslations={{ Hello: "Hola" }}
      >
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("text").textContent).toBe("Hola");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
