import { validateLocale, validateConfig } from "../validation";

describe("Validation Utils", () => {
  describe("validateLocale", () => {
    it("should accept valid 2-letter language codes", () => {
      expect(() => validateLocale("en", "locale")).not.toThrow();
      expect(() => validateLocale("fr", "locale")).not.toThrow();
      expect(() => validateLocale("zh", "locale")).not.toThrow();
      expect(() => validateLocale("ja", "locale")).not.toThrow();
    });

    it("should accept valid 3-letter language codes", () => {
      expect(() => validateLocale("fil", "locale")).not.toThrow();
      expect(() => validateLocale("spa", "locale")).not.toThrow();
    });

    it("should accept valid locale codes with region (letters)", () => {
      expect(() => validateLocale("en-US", "locale")).not.toThrow();
      expect(() => validateLocale("fr-CA", "locale")).not.toThrow();
      expect(() => validateLocale("zh-TW", "locale")).not.toThrow();
      expect(() => validateLocale("pt-BR", "locale")).not.toThrow();
    });

    it("should accept valid locale codes with numeric region", () => {
      expect(() => validateLocale("es-419", "locale")).not.toThrow();
    });

    it("should accept valid locale codes with script", () => {
      expect(() => validateLocale("bs-Cyrl", "locale")).not.toThrow();
      expect(() => validateLocale("zh-Hant", "locale")).not.toThrow();
    });

    it("should throw for empty string", () => {
      expect(() => validateLocale("", "locale")).toThrow(
        "locale cannot be empty or whitespace only",
      );

      expect(() => validateLocale("   ", "locale")).toThrow(
        "locale cannot be empty or whitespace only",
      );
    });

    it("should throw for invalid format", () => {
      expect(() => validateLocale("e", "locale")).toThrow(
        "Invalid locale format",
      );

      expect(() => validateLocale("english", "locale")).toThrow(
        "Invalid locale format",
      );
      expect(() => validateLocale("EN", "locale")).toThrow(
        "Invalid locale format",
      );
      expect(() => validateLocale("en_US", "locale")).toThrow(
        "Invalid locale format",
      );
      expect(() => validateLocale("en/US", "locale")).toThrow(
        "Invalid locale format",
      );
      expect(() => validateLocale("en-1", "locale")).toThrow(
        "Invalid locale format",
      );
    });

    it("should throw for non-string input", () => {
      expect(() => validateLocale(null as never, "locale")).toThrow(
        "locale must be a non-empty string",
      );

      expect(() => validateLocale(undefined as never, "locale")).toThrow(
        "locale must be a non-empty string",
      );

      expect(() => validateLocale(123 as never, "locale")).toThrow(
        "locale must be a non-empty string",
      );
    });
  });

  describe("validateConfig", () => {
    const validConfig = {
      apiKey: "test-api-key-123456",
      sourceLocale: "en",
      targetLocale: "es",
    };

    const validGetAccessTokenConfig = {
      getAccessToken: async () => ({
        accessToken: "test-access-token",
        expiresAt: Date.now() + 900000,
      }),
      sourceLocale: "en",
      targetLocale: "es",
    };

    it("should accept valid configuration with apiKey", () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it("should accept valid configuration with getAccessToken", () => {
      expect(() => validateConfig(validGetAccessTokenConfig)).not.toThrow();
    });

    it("should throw for missing both apiKey and getAccessToken", () => {
      expect(() =>
        validateConfig({ sourceLocale: "en", targetLocale: "es" } as never),
      ).toThrow("Either apiKey or getAccessToken must be provided");
    });

    it("should throw when both apiKey and getAccessToken are provided", () => {
      expect(() =>
        validateConfig({
          apiKey: "test-api-key-123456",
          getAccessToken: async () => ({
            accessToken: "test-access-token",
            expiresAt: Date.now() + 900000,
          }),
          sourceLocale: "en",
          targetLocale: "es",
        }),
      ).toThrow("Only one of apiKey or getAccessToken should be provided");
    });

    it("should throw for missing config", () => {
      expect(() => validateConfig(null as never)).toThrow(
        "Configuration is required",
      );

      expect(() => validateConfig(undefined as never)).toThrow(
        "Configuration is required",
      );
    });

    it("should throw for empty API key", () => {
      expect(() =>
        validateConfig({ ...validConfig, apiKey: "" }),
      ).toThrow("API key cannot be empty or whitespace only");

      expect(() =>
        validateConfig({ ...validConfig, apiKey: "   " }),
      ).toThrow("API key cannot be empty or whitespace only");
    });

    it("should warn for short API key", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({ ...validConfig, apiKey: "short" });
      expect(warnSpy).toHaveBeenCalledWith(
        "API key appears to be invalid (too short)",
      );
      warnSpy.mockRestore();
    });

    it("should throw for invalid source locale", () => {
      expect(() =>
        validateConfig({ ...validConfig, sourceLocale: "invalid" }),
      ).toThrow("Invalid sourceLocale format");
    });

    it("should throw for invalid target locale", () => {
      expect(() =>
        validateConfig({ ...validConfig, targetLocale: "invalid" }),
      ).toThrow("Invalid targetLocale format");
    });

    it("should warn when source and target locales are the same", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({
        ...validConfig,
        sourceLocale: "en",
        targetLocale: "en",
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Source locale and target locale are the same",
        ),
      );
      warnSpy.mockRestore();
    });
  });
});