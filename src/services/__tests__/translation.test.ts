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
        }),
      );
    });

    it("2. Cached text returns immediately", async () => {
      const hash = service.generateHash("Hello");
      service["cache"]["es"] = { [hash]: "Hola" };
      service["_isInitialized"] = true;

      const result = service.translate("Hello");
      expect(result).toBe("Hola");
    });
  });

  describe("Batch Translation", () => {
    it("translates multiple texts in one call", async () => {
      service["_isInitialized"] = true;

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
        }),
      );
    });
  });

  describe("Server-Side Flow", () => {
    beforeEach(() => {
      service["isSSR"] = true;
    });

    it("1. Server init calls /v1/translations", async () => {
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
        }),
      );
    });

    it("2. Server cached text returns immediately", () => {
      const hash = service.generateHash("Hello");
      service["cache"]["es"] = { [hash]: "Hola" };

      const result = service.getCachedTranslation("Hello");
      expect(result).toBe("Hola");
    });

    it("3. Server batch translate works", async () => {
      service["_isInitialized"] = true;

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

  describe("Access Token Flow", () => {
    let tokenService: TranslationService;
    const tokenConfig = {
      getAccessToken: jest.fn().mockResolvedValue({
        accessToken: "initial-token",
        expiresAt: Date.now() + 900000,
      }),
      sourceLocale: "en",
      targetLocale: "es",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      tokenService = new TranslationService(tokenConfig);
      mockStorageAdapter.getItem.mockResolvedValue(null);
    });

    it("should fetch access token on init", async () => {
      const helloHash = tokenService.generateHash("Hello");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      await tokenService.init();

      expect(tokenConfig.getAccessToken).toHaveBeenCalled();
      expect(tokenService["currentAccessToken"]).toBe("initial-token");
      expect(tokenService["tokenExpiryTime"]).toBeGreaterThan(Date.now());
    });

    it("should include accessToken in request body when using access token", async () => {
      const helloHash = tokenService.generateHash("Hello");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      await tokenService.init();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/translations"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"accessToken":"initial-token"'),
        }),
      );
    });

    it("should detect expired token", async () => {
      tokenService["tokenExpiryTime"] = Date.now() - 10000;

      expect(tokenService["isTokenExpired"]()).toBe(true);
    });

    it("should refresh token when expired", async () => {
      const helloHash = tokenService.generateHash("Hello");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      await tokenService.init();

      tokenConfig.getAccessToken.mockClear();
      tokenConfig.getAccessToken.mockResolvedValue({
        accessToken: "new-token",
        expiresAt: Date.now() + 900000,
      });

      tokenService["tokenExpiryTime"] = Date.now() - 10000;

      await tokenService.translateBatch([
        { hashkey: helloHash, text: "Hello", persist: true },
      ]);

      expect(tokenConfig.getAccessToken).toHaveBeenCalled();
      expect(tokenService["currentAccessToken"]).toBe("new-token");
    });

    it("should queue requests during token refresh", async () => {
      tokenService["_isInitialized"] = true;

      const helloHash = tokenService.generateHash("Hello");
      const worldHash = tokenService.generateHash("World");

      let resolveFetch: (value: unknown) => void;
      tokenConfig.getAccessToken.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      });

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes("translate")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ [helloHash]: "Hola" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      tokenService["tokenExpiryTime"] = Date.now() - 10000;

      const request1 = tokenService.translateBatch([
        { hashkey: helloHash, text: "Hello", persist: true },
      ]);
      const request2 = tokenService.translateBatch([
        { hashkey: worldHash, text: "World", persist: true },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tokenService["pendingRequests"].length).toBe(2);

      resolveFetch!({
        accessToken: "new-token",
        expiresAt: Date.now() + 900000,
      });

      await Promise.all([request1, request2]);

      expect(tokenService["pendingRequests"].length).toBe(0);
      expect(tokenConfig.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("should handle 401 token expired error and retry", async () => {
      const helloHash = tokenService.generateHash("Hello");

      let fetchCallCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: "token_expired" }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ [helloHash]: "Hola" }),
          });
        }
      });

      await tokenService.init();

      expect(tokenConfig.getAccessToken).toHaveBeenCalled();
      expect(fetchCallCount).toBe(2);
    });

    it("should fail gracefully when token fetch fails", async () => {
      tokenConfig.getAccessToken.mockRejectedValue(new Error("Fetch failed"));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "token_expired" }),
      });

      await expect(tokenService.init()).resolves.not.toThrow();
      expect(tokenService.isInitialized).toBe(true);
    });
  });

  describe("Backward Compatibility", () => {
    it("should work with apiKey configuration", async () => {
      const apiKeyConfig = {
        apiKey: "test-api-key",
        sourceLocale: "en",
        targetLocale: "es",
      };

      const apiKeyService = new TranslationService(apiKeyConfig);

      expect(apiKeyService["currentAccessToken"]).toBeNull();
      expect(apiKeyService["isUsingAccessToken"]()).toBe(false);
    });

    it("should include apiKey in request body when using apiKey", async () => {
      const apiKeyConfig = {
        apiKey: "test-api-key",
        sourceLocale: "en",
        targetLocale: "es",
      };

      const apiKeyService = new TranslationService(apiKeyConfig);

      const helloHash = apiKeyService.generateHash("Hello");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [helloHash]: "Hola" }),
      });

      await apiKeyService.init();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/translations"),
        expect.objectContaining({
          method: "POST",
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
          body: expect.stringContaining('"apiKey":"test-api-key"'),
        }),
      );
    });
  });

  describe("Configuration Validation", () => {
    it("should throw error for missing apiKey and getAccessToken", () => {
      expect(() => {
        new TranslationService({
          sourceLocale: "en",
          targetLocale: "es",
        } as never);
      }).toThrow("Either apiKey or getAccessToken must be provided");
    });

    it("should throw error when both apiKey and getAccessToken provided", () => {
      expect(() => {
        new TranslationService({
          apiKey: "test-key",
          getAccessToken: async () => ({
            accessToken: "token",
            expiresAt: Date.now() + 900000,
          }),
          sourceLocale: "en",
          targetLocale: "es",
        });
      }).toThrow("Only one of apiKey or getAccessToken should be provided");
    });
  });
});