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

This SDK provides reliable SSR support with automatic locale detection and server-side translation. The new approach is simple, predictable, and SEO-friendly.

### Middleware Setup for Dynamic Locale Detection

Create a middleware file to detect user's locale and set up dynamic routing:

```tsx:/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const localeParam = searchParams.get("locale");

  // Get locale from various sources
  const acceptLanguage = request.headers.get("accept-language");
  const browserLocale = acceptLanguage?.split(',')[0].split(';')[0].substring(0,2);

  // Support any locale dynamically - no pre-defined list needed!
  const locale = localeParam || browserLocale || "en";

  // Redirect to locale-specific URL for SEO
  if (!pathname.startsWith(`/${locale}/`) && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Server Component Implementation

**Ultimate Clean API (Recommended - No Duplication!):**

```tsx
// app/[locale]/page.tsx
import { ServerTranslated } from "react-autolocalise/server";

const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
};

export default ServerTranslated(params.locale, config, ({ t, tf }) => (
  <div>
    <h1>{t("Welcome to our app")}</h1> {/* No duplication! */}
    <p>{t("This is the best app ever")}</p> {/* No await! */}
    <h2>{t("Amazing features await you")}</h2> {/* Auto-collected! */}
    {/* Formatted text also works seamlessly */}
    <div>
      {tf(
        <>
          Styled <strong>text</strong> with <em>formatting</em>
        </>
      )}
    </div>
  </div>
));
```

**Alternative: Pre-defined Strings (if you prefer explicit control):**

```tsx
// app/[locale]/page.tsx
import { createServerT } from "react-autolocalise/server";

export default async function Page({ params }: { params: { locale: string } }) {
  // Pre-translate all strings, get synchronous translator
  const strings = [
    "Welcome to our app",
    "This is the best app ever",
    "Amazing features await you",
  ];
  const t = await createServerT(strings, params.locale, config);

  return (
    <div>
      <h1>{t("Welcome to our app")}</h1> {/* No await needed! */}
      <p>{t("This is the best app ever")}</p> {/* Clean and simple! */}
      <h2>{t("Amazing features await you")}</h2> {/* Synchronous! */}
    </div>
  );
}
```

**Even Cleaner with Template Literals:**

```tsx
// app/[locale]/page.tsx
import { createServerTTemplate } from "react-autolocalise/server";

export default async function Page({ params }: { params: { locale: string } }) {
  // Pre-translate all strings for template literals
  const strings = [
    "Welcome to our app",
    "This is the best app ever",
    "Amazing features await you",
  ];
  const t = await createServerTTemplate(strings, params.locale, config);

  return (
    <div>
      <h1>{t`Welcome to our app`}</h1> {/* No await, no quotes! */}
      <p>{t`This is the best app ever`}</p> {/* Super clean! */}
      <h2>{t`Amazing features await you`}</h2> {/* Template literals! */}
    </div>
  );
}
```

**Traditional Array Approach:**

```tsx
// app/[locale]/page.tsx
import { translateServerStrings } from "react-autolocalise/server";

export default async function Page({ params }: { params: { locale: string } }) {
  // Define all strings to translate
  const strings = [
    "Welcome to our app",
    "This is the best app ever",
    "Amazing features await you",
  ];

  // Translate all strings in one reliable call
  const translations = await translateServerStrings(
    strings,
    params.locale,
    config
  );

  return (
    <div>
      <h1>{translations["Welcome to our app"]}</h1>
      <p>{translations["This is the best app ever"]}</p>
      <h2>{translations["Amazing features await you"]}</h2>
    </div>
  );
}
```

**Advanced Usage with Formatted Text:**

For components with styled text, use `translateServerFormatted()`:

```tsx
// app/[locale]/about/page.tsx
import {
  translateServerFormatted,
  translateServerStrings,
} from "react-autolocalise/server";

export default async function AboutPage({
  params,
}: {
  params: { locale: string };
}) {
  // Regular strings
  const strings = ["About Us", "Learn more about our company"];
  const translations = await translateServerStrings(
    strings,
    params.locale,
    config
  );

  // Formatted content with nested styling
  const formattedTexts = [
    <>
      We are <strong style={{ fontWeight: "bold" }}>passionate</strong> about{" "}
      <span style={{ color: "blue" }}>innovation</span>!
    </>,
    <>
      Join our <em style={{ fontStyle: "italic" }}>amazing</em> team today
    </>,
  ];

  const [formattedIntro, formattedCTA] = await translateServerFormatted(
    formattedTexts,
    params.locale,
    config
  );

  return (
    <div>
      <h1>{translations["About Us"]}</h1>
      <p>{translations["Learn more about our company"]}</p>
      <div>{formattedIntro}</div>
      <div>{formattedCTA}</div>
    </div>
  );
}
```

**Alternative: Using ServerTranslator Class**

For more complex scenarios, you can use the ServerTranslator class directly:

```tsx
import { createServerTranslator } from "react-autolocalise/server";

export default async function ComplexPage({
  params,
}: {
  params: { locale: string };
}) {
  const translator = createServerTranslator({
    apiKey: "your-api-key",
    sourceLocale: "en",
    targetLocale: params.locale,
  });

  // Translate regular strings
  const strings = ["Hello", "World", "How are you?"];
  const translations = await translator.translateStrings(strings);

  // Translate formatted content
  const formattedContent = [
    <>
      Welcome to our <strong>amazing</strong> platform!
    </>,
  ];
  const [welcomeMessage] = await translator.translateFormatted(
    formattedContent
  );

  return (
    <div>
      <h1>
        {translations["Hello"]} {translations["World"]}
      </h1>
      <p>{translations["How are you?"]}</p>
      <div>{welcomeMessage}</div>
    </div>
  );
}
```

### SEO Benefits

The new server-side rendering approach provides excellent SEO benefits:

- **Translated content in HTML**: Search engines see fully translated content on first load
- **Locale-specific URLs**: Clean URLs like `/zh/about`, `/fr/contact` for better indexing
- **Dynamic locale support**: Automatically handles any language without pre-configuration
- **Fast server-side translation**: Efficient caching reduces API calls and improves performance

**Generating SEO Metadata:**

```tsx
// app/[locale]/layout.tsx
import { translateServerStrings } from "react-autolocalise/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}) {
  const strings = [
    "Welcome to our amazing app",
    "The best platform for your needs",
  ];

  const translations = await translateServerStrings(strings, params.locale, {
    apiKey: "your-api-key",
    sourceLocale: "en",
  });

  return {
    title: translations["Welcome to our amazing app"],
    description: translations["The best platform for your needs"],
  };
}
```

### Key Improvements

The new SSR implementation offers significant improvements over the previous version:

1. **100% Reliable**: No more race conditions or timing issues
2. **Simple API**: Just call `translateServerStrings()` or `translateServerFormatted()`
3. **SEO-Friendly**: Perfect for search engine indexing
4. **Dynamic Locales**: Supports any language without pre-configuration
5. **Efficient Caching**: Shared cache across all components - only 1 API call per locale per request
6. **Predictable**: Always works the same way, every time

### Efficient Caching Strategy

The new implementation uses a **shared translation cache** across all server components:

- ✅ **Single API call per locale**: All components share the same translation service
- ✅ **Smart batching**: Missing translations are batched together efficiently
- ✅ **Memory efficient**: Cache is shared across the entire request lifecycle
- ✅ **No redundant work**: Each translation is fetched only once

**Example**: If you have 5 server components on a page, instead of 5 separate API calls, you get:

1. **1 initial call** to load existing translations for the locale
2. **1 batch call** to translate any missing strings from all components combined

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

**Note**: The new server-side rendering approach automatically handles persistence and is 100% reliable.

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
