import { TranslationService } from "../translation";

// Mock storage adapter
const mockStorageAdapter = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock("../../storage", () => ({
  getStorageAdapter: jest.fn(() => mockStorageAdapter),
}));

// Mock fetch
global.fetch = jest.fn();

describe("TranslationService - Basic Functionality", () => {
  let service: TranslationService;
  const config = {
    apiKey: "test-key",
    sourceLocale: "en",
    targetLocale: "es",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TranslationService(config);
  });

  describe("Client-Side Flow", () => {
    it("1. Initialization calls /v1/translations", async () => {
      mockStorageAdapter.getItem.mockResolvedValue(null);

      // Use real hash values for more accurate testing
      const helloHash = service.generateHash("Hello");
      const worldHash = service.generateHash("World");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            [helloHash]: "Hola",
            [worldHash]: "Mundo",
          }),
      });

      await service.init();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/translations"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetLocale":"es"'),
        })
      );
    });

    it("2. Cached text returns immediately", async () => {
      const hash = service.generateHash("Hello");
      service["cache"]["es"] = { [hash]: "Hola" };
      service["isInitialized"] = true;

      const result = service.translate("Hello");
      expect(result).toBe("Hola");
    });

    it("3. Text shows in target locale", async () => {
      // Test that the service can handle translations
      const hash = service.generateHash("Welcome");
      service["cache"]["es"] = { [hash]: "Bienvenido" };
      service["isInitialized"] = true;

      const result = service.translate("Welcome");
      expect(result).toBe("Bienvenido");
    });
  });

  describe("Batch Translation", () => {
    it("translates multiple texts in one call", async () => {
      service["isInitialized"] = true;

      // Use real hash values
      const helloHash = service.generateHash("Hello");
      const worldHash = service.generateHash("World");

      const texts = [
        { hashkey: helloHash, text: "Hello", persist: true },
        { hashkey: worldHash, text: "World", persist: true },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            [helloHash]: "Hola",
            [worldHash]: "Mundo",
          }),
      });

      const result = await service.translateBatch(texts);

      expect(result).toEqual({
        Hello: "Hola",
        World: "Mundo",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/translate"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"texts":['),
        })
      );
    });
  });

  describe("Server-Side Flow", () => {
    beforeEach(() => {
      // Mock server environment
      service["isSSR"] = true;
    });

    it("1. Server init calls /v1/translations", async () => {
      // Use real hash values
      const helloHash = service.generateHash("Hello");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      await service.init();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/translations"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetLocale":"es"'),
        })
      );
    });

    it("2. Server cached text returns immediately", () => {
      const hash = service.generateHash("Hello");
      service["cache"]["es"] = { [hash]: "Hola" };

      const result = service.getCachedTranslation("Hello");
      expect(result).toBe("Hola");
    });

    it("3. Server batch translate works", async () => {
      service["isInitialized"] = true;

      // Use real hash value
      const helloHash = service.generateHash("Hello");
      const texts = [{ hashkey: helloHash, text: "Hello", persist: true }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      const result = await service.translateBatch(texts);

      expect(result).toEqual({ Hello: "Hola" });
      expect(service["cache"]["es"]).toEqual({ [helloHash]: "Hola" });
    });
  });
});
