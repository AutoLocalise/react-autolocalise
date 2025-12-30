import { validateLocale, validateConfig } from "../validation";

describe("Validation Utils", () => {
  describe("validateLocale", () => {
    it("should accept valid 2-letter language codes", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("en");
      validateLocale("fr");
      validateLocale("zh");
      validateLocale("ja");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should accept valid 3-letter language codes", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("fil");
      validateLocale("spa");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should accept valid locale codes with region (letters)", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("en-US");
      validateLocale("fr-CA");
      validateLocale("zh-TW");
      validateLocale("pt-BR");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should accept valid locale codes with numeric region", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("es-419");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should accept valid locale codes with script", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("bs-Cyrl");
      validateLocale("zh-Hant");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn for empty string", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("");
      expect(warnSpy).toHaveBeenCalledWith("Locale cannot be empty or whitespace only");

      validateLocale("   ");
      expect(warnSpy).toHaveBeenCalledWith("Locale cannot be empty or whitespace only");

      warnSpy.mockRestore();
    });

    it("should warn for invalid format", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale("e");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid locale format")
      );

      validateLocale("english");
      validateLocale("EN");
      validateLocale("en_US");
      validateLocale("en/US");
      validateLocale("en-1");

      expect(warnSpy).toHaveBeenCalledTimes(6);
      warnSpy.mockRestore();
    });

    it("should warn for non-string input", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateLocale(null as never);
      expect(warnSpy).toHaveBeenCalledWith("Locale must be a non-empty string");

      validateLocale(undefined as never);
      expect(warnSpy).toHaveBeenCalledWith("Locale must be a non-empty string");

      validateLocale(123 as never);
      expect(warnSpy).toHaveBeenCalledWith("Locale must be a non-empty string");

      warnSpy.mockRestore();
    });
  });

  describe("validateConfig", () => {
    const validConfig = {
      apiKey: "test-api-key-123456",
      sourceLocale: "en",
      targetLocale: "es",
    };

    it("should accept valid configuration", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig(validConfig);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn for missing config", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig(null as never);
      expect(warnSpy).toHaveBeenCalledWith("Configuration is required");

      validateConfig(undefined as never);
      expect(warnSpy).toHaveBeenCalledWith("Configuration is required");

      warnSpy.mockRestore();
    });

    it("should warn for missing API key", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({ ...validConfig, apiKey: "" });
      expect(warnSpy).toHaveBeenCalledWith("API key cannot be empty or whitespace only");

      validateConfig({ ...validConfig, apiKey: "   " });
      expect(warnSpy).toHaveBeenCalledWith("API key cannot be empty or whitespace only");

      warnSpy.mockRestore();
    });

    it("should warn for short API key", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({ ...validConfig, apiKey: "short" });
      expect(warnSpy).toHaveBeenCalledWith("API key appears to be invalid (too short)");
      warnSpy.mockRestore();
    });

    it("should warn for invalid source locale", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({ ...validConfig, sourceLocale: "invalid" });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid locale format")
      );
      warnSpy.mockRestore();
    });

    it("should warn for invalid target locale", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({ ...validConfig, targetLocale: "invalid" });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid locale format")
      );
      warnSpy.mockRestore();
    });

    it("should warn when source and target locales are the same", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      validateConfig({
        ...validConfig,
        sourceLocale: "en",
        targetLocale: "en",
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Source locale and target locale are the same")
      );
      warnSpy.mockRestore();
    });
  });
});
