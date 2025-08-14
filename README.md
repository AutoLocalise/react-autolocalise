[![Better Stack Badge](https://uptime.betterstack.com/status-badges/v1/monitor/1yfj4.svg)](https://uptime.betterstack.com/?utm_source=status_badge)

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
    sourceLocale: "en", // Your app's original language
    targetLocale: "es", // Language to translate to
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

This SDK provides reliable SSR support with automatic locale detection and server-side translation. The new approach is simple, predictable, and SEO-friendly.

### Middleware Setup for Dynamic Locale Detection

Create a middleware file to detect user's locale and set up dynamic routing:

```tsx
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and Next.js internals or anything you want
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get locale from accept-language header
  const acceptLanguage = request.headers.get("accept-language");
  const browserLocale = acceptLanguage?.split(",")[0]?.split("-")[0] || "en";

  // Support any locale dynamically, you can also predefine a list here to control the target languages
  const locale = browserLocale;

  // Redirect root to locale-specific URL
  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // If path doesn't start with a locale, redirect to add locale
  const pathSegments = pathname.split("/");
  const firstSegment = pathSegments[1];

  // Simple check: if first segment is not a 2-letter code, add locale
  if (!firstSegment || firstSegment.length !== 2) {
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Server Component Implementation

The `withServerTranslation` HOC provides the cleanest server-side translation experience with zero string duplication. Here are the most common use cases:

#### **Dynamic Locale from URL**

```tsx
// app/[locale]/page.tsx
import { withServerTranslation } from "react-autolocalise/server";

const config = {
  apiKey: "your-api-key",
  sourceLocale: "en", // Your app's original language
};

// Clean HOC approach - automatically uses locale from props
const HomePage = withServerTranslation(config, ({ t, tf, locale }) => (
  <div>
    <h1>{t("Welcome to our app")}</h1>
    <p>{t("This content is automatically translated")}</p>
    {tf(
      <>
        Experience <strong>powerful</strong> and <em>reliable</em> translations!
      </>
    )}
    <p>Current language: {locale}</p>
  </div>
));

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomePage locale={locale} />;
}
```

#### **Fixed Target Language**

```tsx
// For apps targeting a specific language (e.g., Spanish market)
const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
  targetLocale: "es", // Always translate to Spanish
};

const Page = withServerTranslation(config, ({ t, tf }) => (
  <div>
    <h1>{t("Welcome to our app")}</h1>
    <p>{t("All content will be in Spanish")}</p>
    {tf(
      <>
        Built for <strong>Spanish</strong> speaking users!
      </>
    )}
  </div>
));

export default Page;
```

### SEO Benefits

The server-side rendering approach provides excellent SEO benefits:

- **Translated content in HTML**: Search engines see fully translated content on first load
- **Locale-specific URLs**: Clean URLs like `/zh/about`, `/fr/contact` for better indexing
- **Dynamic locale support**: Automatically handles any language without pre-configuration
- **Fast server-side translation**: Efficient caching reduces API calls and improves performance

**Generating SEO Metadata:**

```tsx
// app/[locale]/layout.tsx
import { translateServerStrings } from "react-autolocalise/server";

const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const strings = [
    "My Awesome App - Best Solution for Your Business",
    "Discover the most powerful tools to grow your business online",
  ];

  const translations = await translateServerStrings(strings, locale, config);

  return {
    title: translations["My Awesome App - Best Solution for Your Business"],
    description:
      translations[
        "Discover the most powerful tools to grow your business online"
      ],
  };
}
```

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

### Client-Side API

#### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

#### useAutoTranslate Hook

Returns an object with:

- `t`: Translation function
- `loading`: Boolean indicating initialization of translations
- `error`: Error object if translation loading failed

## API Reference

### Client-Side API

#### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

#### useAutoTranslate Hook

Returns an object with:

- `t`: Translation function
- `loading`: Boolean indicating initialization of translations
- `error`: Error object if translation loading failed

### TranslationConfig

| Property     | Type   | Required | Description                                  |
| ------------ | ------ | -------- | -------------------------------------------- |
| apiKey       | string | Yes      | Your API key for the translation service     |
| sourceLocale | string | Yes      | Source locale for translations               |
| targetLocale | string | Yes      | Target locale                                |
| cacheTTL     | number | No       | Cache validity period in hours (default: 24) |

**Tips**: When `sourceLocale` === `targetLocale` no translation requests will be sent.

### Persist for Editing

The 'persist' means the string will be persisted so that you can review and edit in the [dashboard](https://dashboard.autolocalise.com), default is true, if the content is dynamic or you don't want to see in the dashboard, pass 'false'.

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
