import { validateLocale, validateConfig } from "../validation";

describe("Validation Utils", () => {
  describe("validateLocale", () => {
    it("should accept valid 2-letter language codes", () => {
      expect(() => validateLocale("en")).not.toThrow();
      expect(() => validateLocale("fr")).not.toThrow();
      expect(() => validateLocale("zh")).not.toThrow();
      expect(() => validateLocale("ja")).not.toThrow();
    });

    it("should accept valid 3-letter language codes", () => {
      expect(() => validateLocale("fil")).not.toThrow();
      expect(() => validateLocale("spa")).not.toThrow();
    });

    it("should accept valid locale codes with region (letters)", () => {
      expect(() => validateLocale("en-US")).not.toThrow();
      expect(() => validateLocale("fr-CA")).not.toThrow();
      expect(() => validateLocale("zh-TW")).not.toThrow();
      expect(() => validateLocale("pt-BR")).not.toThrow();
    });

    it("should accept valid locale codes with numeric region", () => {
      expect(() => validateLocale("es-419")).not.toThrow();
    });

    it("should accept valid locale codes with script", () => {
      expect(() => validateLocale("bs-Cyrl")).not.toThrow();
      expect(() => validateLocale("zh-Hant")).not.toThrow();
    });

    it("should throw ValidationError for empty string", () => {
      expect(() => validateLocale("")).toThrow();
      expect(() => validateLocale("   ")).toThrow();
    });

    it("should throw ValidationError for invalid format", () => {
      expect(() => validateLocale("e")).toThrow();
      expect(() => validateLocale("english")).toThrow();
      expect(() => validateLocale("EN")).toThrow();
      expect(() => validateLocale("en_US")).toThrow();
      expect(() => validateLocale("en/US")).toThrow();
      expect(() => validateLocale("en-1")).toThrow();
    });

    it("should throw ValidationError for non-string input", () => {
      expect(() => validateLocale(null as any)).toThrow();
      expect(() => validateLocale(undefined as any)).toThrow();
      expect(() => validateLocale(123 as any)).toThrow();
    });
  });

  describe("validateConfig", () => {

      const validConfig = {

        apiKey: "test-api-key-123456",

        sourceLocale: "en",

        targetLocale: "es",

      };

  

      it("should accept valid configuration", () => {

        expect(() => validateConfig(validConfig)).not.toThrow();

      });

  

      it("should throw for missing config", () => {

        expect(() => validateConfig(null as any)).toThrow();

        expect(() => validateConfig(undefined as any)).toThrow();

      });

  

      it("should throw for missing API key", () => {

        expect(() =>

          validateConfig({ ...validConfig, apiKey: "" })

        ).toThrow();

        expect(() =>

          validateConfig({ ...validConfig, apiKey: "   " })

        ).toThrow();

      });

  

      it("should throw for short API key", () => {

        expect(() =>

          validateConfig({ ...validConfig, apiKey: "short" })

        ).toThrow();

      });

  

      it("should throw for invalid source locale", () => {

        expect(() =>

          validateConfig({ ...validConfig, sourceLocale: "invalid" })

        ).toThrow();

      });

  

      it("should throw for invalid target locale", () => {

        expect(() =>

          validateConfig({ ...validConfig, targetLocale: "invalid" })

        ).toThrow();

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
