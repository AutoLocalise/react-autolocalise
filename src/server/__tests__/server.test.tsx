import React from "react";
import {
  withServerTranslation,
  translateServerStrings,
  clearServerTranslationCache,
} from "../index";

global.fetch = jest.fn();

function jsonResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 401,
    json: () => Promise.resolve(data),
  });
}

describe("server translation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearServerTranslationCache();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes("/v1/translations")) {
        return jsonResponse({});
      }
      if (String(url).includes("/v1/translate")) {
        return jsonResponse({});
      }
      return jsonResponse({});
    });
  });

  it("sends getAccessToken when config includes targetLocale", async () => {
    const getAccessToken = jest.fn().mockResolvedValue({
      accessToken: "ssr-token",
      expiresAt: Date.now() + 900000,
    });

    const Page = withServerTranslation(
      {
        getAccessToken,
        sourceLocale: "en",
        targetLocale: "es",
      },
      ({ t }) => <div>{t("Hello")}</div>,
    );

    await Page({});

    expect(getAccessToken).toHaveBeenCalled();
    const bodies = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]: [string, { body: string }]) => JSON.parse(init.body),
    );
    expect(bodies.some((body) => body.accessToken === "ssr-token")).toBe(true);
  });

  it("does not share cache across different token callbacks", async () => {
    const tokenA = jest.fn().mockResolvedValue({
      accessToken: "token-a",
      expiresAt: Date.now() + 900000,
    });
    const tokenB = jest.fn().mockResolvedValue({
      accessToken: "token-b",
      expiresAt: Date.now() + 900000,
    });

    await translateServerStrings(["Hello"], "es", {
      getAccessToken: tokenA,
      sourceLocale: "en",
    });
    await translateServerStrings(["World"], "es", {
      getAccessToken: tokenB,
      sourceLocale: "en",
    });

    expect(tokenA).toHaveBeenCalled();
    expect(tokenB).toHaveBeenCalled();
  });
});
