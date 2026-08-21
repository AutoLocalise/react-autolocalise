# react-autolocalise

Runtime auto-translation SDK for React and Next.js. Apps pass source strings in code (`t("Welcome")`). There are no locale JSON files. The SDK hashes strings, caches them, batches misses to the AutoLocalise API, and renders translations.

## Public API

Package exports:

- `.` — `TranslationProvider`, `useAutoTranslate`, `FormattedText`, `extractTextAndStyles`, `restoreStyledText`, `isServer`
- `./server` — `withServerTranslation`, `ServerTranslated`, `translateServerStrings`, `translateServerFormatted`, `createServerT`, `createServerTranslator`, `ServerTranslator`

Do not add other entry points without updating `package.json` `exports`.

## Auth

Exactly one of `apiKey` or `getAccessToken`. Credentials go in the JSON body, not an `Authorization` header. Token refresh: init, 60s before `expiresAt`, one retry on `401`/`token_expired`.

## Client flow

`TranslationProvider` → `TranslationService.init()` (`/v1/translations` + localStorage) → `t()` is sync (cache hit or original text) → 100ms debounce → `/v1/translate` → `onUpdate` re-render. Skip the network when `sourceLocale === targetLocale`. `persist: false` still translates but is not stored for dashboard editing.

## Server flow (Next.js)

`withServerTranslation` / `ServerTranslated` is two-pass: collect strings with identity `t()`/`tf()`, one batch translate, render again with translations. First pass must be side-effect free. Server cache is keyed by auth identity + locales; never key only on `apiKey` (token configs have none).

## Formatted text

Flatten JSX to templates like `Hello <0>world</0>`, translate, restore original elements with translated inner text.

## Tests and changes

- Mock `fetch`. `TranslationService` is the only network owner.
- Cover provider, server HOC, debounce batching, and token auth when changing those paths.
- Run `npm test`, `npm run lint`, and `npm run build` before claiming done.
- Details: `docs/ACCESS_TOKEN_SPEC.md`.
