# React AutoLocalise

This is SDK for [AutoLocalise](https://www.autolocalise.com).

A lightweight, efficient auto-translation SDK for React and Next.js applications. This SDK provides seamless integration for automatic content translation with support for server-side rendering.

You don't need to prepare any translation files, just provide your API key and the SDK will handle the rest.

## Features

- 🌐 React and Next.js support
- 🚀 Automatic string detection and translation
- 🎯 Dynamic parameter interpolation
- 🔍 Static translation tracking
- ⚙️ Configurable cache TTL
- ⚡️ Tree-shakeable and side-effect free
- 🔄 Server-side rendering support
- 🌍 Automated locale detection via middleware
- ⚡️ Hybrid client/server translation hydration

## Installation

```bash
npm install react-autolocalise
# or
yarn add react-autolocalise
```

## Usage

### Initialize the SDK

```typescript
import { TranslationProvider } from "react-autolocalise";

const App = () => {
  const config = {
    apiKey: "your-api-key",
    sourceLocale: "fr",
    targetLocale: "en",
    // cacheTTL: 24, // Cache validity in hours (optional, defaults to 24)
  };

  return (
    <TranslationProvider config={config}>
      <YourApp />
    </TranslationProvider>
  );
};
```

### Use the Translation Hook

Basic usage:

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  return (
    <div>
      <h1>{t("Welcome to our app!", "static")}</h1>
      <p>{t("This text will be automatically translated")}</p>
    </div>
  );
};
```

Use with params:

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t } = useAutoTranslate();
  const name = "John";

  return (
    <div>
      <p>
        {t("Welcome, {{1}}!, Nice to meet you. {{2}}.")
          .replace("{{1}}", name)
          .replace("{{2}}", t("Have a great day!"))}
      </p>
    </div>
  );
};
```

## Next.js Server-Side Rendering Support

This SDK provides comprehensive SSR support through middleware-based locale detection and server components. Here's how to implement end-to-end server-side translation:

### Middleware Setup

Create a middleware file to detect user's locale from request headers or URL parameters:

```tsx:/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const defaultLocale = "en";

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get("locale");

  const acceptLanguage = request.headers.get("accept-language");
  const browserLocale = acceptLanguage?.split(',')[0].split(';')[0].substring(0,2);

  const locale = localeParam || browserLocale || defaultLocale;

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: "/:path*",
};
```

### Server Component Implementation

Create server components that utilize the detected locale:

```tsx:/src/app/components/ServerComponent.tsx
import { ServerTranslation } from "react-autolocalise/server";
import { headers } from "next/headers";

export default async function ServerComponent() {
  const headersList = headers();
  const targetLocale = headersList.get("x-locale") || "en";

  const serverTranslation = new ServerTranslation({
    apiKey: "your-api-key",
    sourceLocale: "en",
    targetLocale
  });

  const translations = await serverTranslation.translateTexts([
    "Hello from Server Component",
    "This component is rendered on the server side"
  ]);

  return (
    <div>
      <h1>{translations["Hello from Server Component"]}</h1>
      <p>{translations["This component is rendered on the server side"]}</p>
    </div>
  );
}
```

### SEO Considerations

While our SDK currently supports server-side rendering of translated content, achieving full locale-specific visibility in search engine results requires additional implementation. We're working on this step by step example and welcome community contributions to:

- Implement canonical URL handling for localized content
- Develop locale-specific sitemap generation
- Show hreflang tag implementation

If you'd like to contribute examples or implementations for these features, please submit a Pull Request!

## Locale Format

The locale format follows the ISO 639-1 language code standard, optionally combined with an ISO 3166-1 country code:

- Language code only: 'en', 'fr', 'zh', 'ja', etc.
- Language-Region: 'en-US', 'fr-FR', 'zh-CN', 'pt-BR', etc.

## How to get the locale

In React web applications, you can get the user's preferred locale from the browser:

```typescript
// Get the primary locale
const browserLocale = navigator.language; // e.g., 'en-US'

// Get all preferred locales
const preferredLocales = navigator.languages; // e.g., ['en-US', 'en']

// Extract just the language code if needed
const languageCode = browserLocale.split("-")[0]; // e.g., 'en'
```

## API Reference

### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

### TranslationConfig

| Property     | Type   | Required | Description                                  |
| ------------ | ------ | -------- | -------------------------------------------- |
| apiKey       | string | Yes      | Your API key for the translation service     |
| sourceLocale | string | Yes      | Source locale for translations               |
| targetLocale | string | Yes      | Target locale for translations               |
| cacheTTL     | number | No       | Cache validity period in hours (default: 24) |

**Tips**: When `sourceLocale` === `targetLocale` no translation requests will be send.

### useAutoTranslate Hook

Returns an object with:

- `t`: Translation function
- `loading`: Boolean indicating initialization of translations
- `error`: Error object if translation loading failed

### Static persist

When you pass the 'static' parameter to the translation function, the translation will be persisted so that you can review and edit in the dashboard, default is non-static, nothing will be persisted.

```typescript
import { useAutoTranslate } from "react-autolocalise";
const MyComponent = () => {
  const { t } = useAutoTranslate();
  return (
    <div>
      <h1>{t("Welcome to our app!", "static")}</h1>
    </div>
  );
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
