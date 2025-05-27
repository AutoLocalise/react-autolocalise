# React AutoLocalise

This is SDK for [AutoLocalise](https://www.autolocalise.com).

A lightweight, efficient auto-translation SDK for React and Next.js applications. This SDK provides seamless integration for automatic content translation with support for server-side rendering.

You don't need to prepare any translation files, just provide your API key and the SDK will handle the rest.

## Features

- 🌐 React and Next.js support
- 🚀 Automatic string translation
- 🎯 Dynamic parameter interpolation
- 🔍 Persist translation tracking
- 🎨 Nested text formatting support
- ⚙️ Configurable cache TTL
- ⚡️ Tree-shakeable and side-effect free
- 🔄 Server-side rendering support
- ⚡️ Hybrid client/server translation hydration

## Installation

```bash
npm install react-autolocalise
# or
yarn add react-autolocalise
```

## React Client Side Component Usage

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

**Basic usage:**

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  return (
    <div>
      <h1>{t("Welcome to our app!", false)}</h1>
      <p>{t("This text will be automatically translated")}</p>
    </div>
  );
};
```

**Use with nested text formatting:**

```typescript
import React from "react";
import { FormattedText } from "react-autolocalise";

const MyComponent = () => {
  return (
    <div>
      <FormattedText>
        <p>
          Hello, we <div style={{ color: "red" }}>want</div> you to be{" "}
          <span style={{ fontWeight: "bold" }}>happy</span>!
        </p>
      </FormattedText>
      <FormattedText persist={false}>
        Hello,
        <p style={{ color: "red" }}>World</p>
      </FormattedText>
    </div>
  );
};
```

**Use with params:**

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

### Middleware Setup for language detection

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

### Initialize Translation Service (Singleton Pattern)

The SDK uses a singleton pattern for the TranslationService to ensure efficient caching and batch processing. Create a utility file to manage the translator instance:

```typescript
// utils/translator.ts
import ServerTranslation from "react-autolocalise/server";

const config = {
  apiKey: "your-api-key",
  sourceLocale: "fr",
  targetLocale: "en",
};

// Simple function to get a translator instance
export function getTranslator() {
  return new ServerTranslation(config);
}
```

### Server Component Implementation

Create server components that utilize the detected locale:

> **Note**: For server-side rendering, all translations must be completed before sending the response to the client. This requires a two-step process: first mark texts for translation using t() , then execute all translations in a single batch with execute() . This ensures all translations are ready before rendering occurs.

**Basic Usage:**

```tsx
import { getTranslator } from "@/utils/translator";

async function ServerComponent() {
  const translator = getTranslator();

  // Mark texts for translation
  const title = translator.t("Hello from Server Component");
  const description = translator.t(
    "This component is rendered on the server side"
  );

  // Execute all translations in a single batch
  await translator.execute();

  // Get translated texts
  return (
    <div>
      <h1>{translator.get(title)}</h1>
      <p>{translator.get(description)}</p>
    </div>
  );
}

export default ServerComponent;
```

**Use with nested text formatting:**

For components with styled text, use `tFormatted()` and `getFormatted()` to preserve formatting:

```tsx
import { getTranslator } from "@/utils/translator";

async function FormattedServerComponent() {
  const translator = getTranslator();

  // Mark formatted text with nested styling for translation
  const formattedContent = (
    <>
      Hello, we <span style={{ color: "red" }}>want</span> you to be{" "}
      <strong style={{ fontWeight: "bold" }}>happy</strong>!
    </>
  );
  // Mark the formatted texts for translation
  translator.tFormatted(formattedContent);

  // Also mark some regular text
  const subtitle = translator.t("Server-side nested formatting example");

  // Execute all translations in a single batch
  await translator.execute();

  return (
    <div>
      <h3>{translator.get(subtitle)}</h3>
      <p>{translator.getFormatted(formattedContent)}</p>
    </div>
  );
}

export default FormattedServerComponent;
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
- Language-Region: 'pa-Arab', 'fr-CA', 'zh-TW', 'pt-BR', etc.

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

### Persist for Editing

The 'persist' means the string will be persisted so that you can review and edit in the [dashboard](https://dashboard.autolocalise.com), default is true, if the content is dynamic or you don't want to see in the dashboard, pass 'false'.

**Note**: Server-side rendering only works with persist = true by default.

```typescript
import { useAutoTranslate } from "react-autolocalise";
const MyComponent = () => {
  const { t } = useAutoTranslate();
  return (
    <div>
      <h1>{t("Welcome to our app!", false)}</h1>
    </div>
  );
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
