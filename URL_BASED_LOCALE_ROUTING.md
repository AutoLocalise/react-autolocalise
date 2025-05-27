# Implementing URL-based Locale Routing with React AutoLocalise

This guide explains how to implement URL-based locale routing in your Next.js application using the React AutoLocalise SDK. URL-based locale routing improves SEO, user experience, and makes your application more accessible to international users.

## Benefits of URL-based Locale Routing

- **Improved SEO**: Search engines can properly index your content for each language
- **Better User Experience**: Users can bookmark and share language-specific URLs
- **Language Persistence**: User's language preference persists across sessions
- **Crawlability**: Search engines can discover all language versions of your content
- **Analytics**: Track user engagement by language more effectively

## Implementation Overview

Implementing URL-based locale routing with React AutoLocalise involves:

1. Setting up Next.js middleware to handle locale detection from URLs
2. Configuring the App Router with dynamic locale segments
3. Creating a root layout with locale provider
4. Implementing server components with locale-aware translations
5. Building client components that respect the URL locale

## Step 1: Configure Next.js Middleware

Create or update your middleware to detect and enforce locale prefixes in URLs:

```tsx:/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Configure your supported locales
const locales = ["en", "fr", "es", "de", "ja"];
const defaultLocale = "en";

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Determine locale from accept-language header if not in URL
  const acceptLanguage = request.headers.get("accept-language");
  let locale = defaultLocale;

  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().substring(0, 2))
      .find((lang) => locales.includes(lang));

    if (preferredLocale) {
      locale = preferredLocale;
    }
  }

  // Redirect to the same URL but with locale prefix
  return NextResponse.redirect(
    new URL(
      `/${locale}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`,
      request.url
    )
  );
}

export const config = {
  // Match all pathnames except for assets, api routes, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"]
};
```

## Step 2: Configure App Router with Dynamic Locale Segments

Update your Next.js app directory structure to include a dynamic `[locale]` segment at the root:

```
app/
  [locale]/
    layout.tsx
    page.tsx
    about/
      page.tsx
    products/
      [id]/
        page.tsx
```

## Step 3: Create a Root Layout with Locale Provider

Implement a root layout that extracts the locale from the URL and configures the TranslationProvider:

```tsx:/app/[locale]/layout.tsx
import { TranslationProvider } from "react-autolocalise";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

// Define your supported locales
const locales = ["en", "fr", "es", "de", "ja"];
const defaultLocale = "en";

// Define source locale (the language your content is authored in)
const sourceLocale = "en";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  // Get locale from URL parameters
  const locale = params.locale as string;

  // Validate locale or fallback to default
  const validLocale = locales.includes(locale) ? locale : defaultLocale;

  // Configure translation provider
  const config = {
    apiKey: process.env.AUTOLOCALISE_API_KEY || "",
    sourceLocale: sourceLocale,
    targetLocale: validLocale,
  };

  return (
    <html lang={validLocale}>
      <body>
        <TranslationProvider config={config}>
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
```

## Step 4: Create a LocaleLink Component

Implement a custom Link component that automatically includes the current locale:

```tsx:/components/LocaleLink.tsx
import Link from "next/link";
import { useParams } from "next/navigation";

interface LocaleLinkProps {
  href: string;
  children: React.ReactNode;
  [key: string]: any; // For other Link props
}

export default function LocaleLink({ href, children, ...props }: LocaleLinkProps) {
  const params = useParams();
  const locale = params.locale as string;

  // If href already starts with a locale, don't modify it
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) {
    return <Link href={href} {...props}>{children}</Link>;
  }

  // Add locale prefix to href
  const localizedHref = href.startsWith("/")
    ? `/${locale}${href}`
    : `/${locale}/${href}`;

  return <Link href={localizedHref} {...props}>{children}</Link>;
}
```

## Step 5: Implement Server Components with Locale-aware Translations

Create server components that use the locale from the URL for translations:

```tsx:/app/[locale]/page.tsx
import { ServerTranslation } from "react-autolocalise/server";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

export default async function HomePage({ params }: { params: Params }) {
  const locale = params.locale as string;

  const config = {
    apiKey: process.env.AUTOLOCALISE_API_KEY || "",
    sourceLocale: "en", // Your source language
    targetLocale: locale,
  };

  // Create a server-side translation instance
  const translator = new ServerTranslation(config);

  // Mark texts for translation
  const title = translator.t("Welcome to our multilingual website");
  const description = translator.t(
    "This page is automatically translated based on the URL locale"
  );

  // Execute all translations at once
  await translator.execute();

  return (
    <div>
      <h1>{translator.get(title)}</h1>
      <p>{translator.get(description)}</p>
    </div>
  );
}
```

## Step 6: Create a Locale Switcher Component

Implement a component that allows users to switch between available languages:

```tsx:/components/LocaleSwitcher.tsx
"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";

const locales = ["en", "fr", "es", "de", "ja"];
const localeNames = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  ja: "日本語",
};

export default function LocaleSwitcher() {
  const params = useParams();
  const pathname = usePathname();
  const currentLocale = params.locale as string;

  // Remove the current locale from the pathname
  const pathnameWithoutLocale = pathname.replace(`/${currentLocale}`, "") || "/";

  return (
    <div className="locale-switcher">
      <ul>
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={`/${locale}${pathnameWithoutLocale}`}
              className={locale === currentLocale ? "active" : ""}
            >
              {localeNames[locale as keyof typeof localeNames]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Step 7: Add Metadata for SEO

Enhance SEO by adding proper metadata with hreflang tags:

```tsx:/app/[locale]/layout.tsx
import { Metadata } from "next";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

// Define your supported locales
const locales = ["en", "fr", "es", "de", "ja"];

// Generate metadata with hreflang tags
export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const locale = params.locale as string;
  const path = params.slug ? `/${params.slug.join("/")}` : "";

  // Create alternate links for each locale
  const alternates: Record<string, string> = {};

  locales.forEach((l) => {
    alternates[l] = `https://yourdomain.com/${l}${path}`;
  });

  return {
    alternates: {
      canonical: `https://yourdomain.com/${locale}${path}`,
      languages: alternates,
    },
  };
}
```

## Additional Considerations

### 1. Handling API Routes

For API routes that need to be aware of the locale:

```tsx:/app/api/[locale]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { locale: string } }) {
  const locale = params.locale;

  // Use locale in your API logic
  // ...

  return NextResponse.json({ locale, message: "Localized API response" });
}
```

### 2. Handling Static Generation

For static site generation with all locales:

```tsx
// In any page component
export async function generateStaticParams() {
  const locales = ["en", "fr", "es", "de", "ja"];
  const products = await fetchProducts(); // Your data fetching function

  return locales.flatMap((locale) =>
    products.map((product) => ({
      locale,
      id: product.id,
    }))
  );
}
```

### 3. Handling Dynamic Routes

For dynamic routes with locale parameters:

```tsx:/app/[locale]/products/[id]/page.tsx
import { ServerTranslation } from "react-autolocalise/server";

export default async function ProductPage({
  params
}: {
  params: { locale: string; id: string }
}) {
  const { locale, id } = params;

  // Fetch product data
  const product = await fetchProduct(id);

  // Initialize translator
  const translator = new ServerTranslation({
    apiKey: process.env.AUTOLOCALISE_API_KEY || "",
    sourceLocale: "en",
    targetLocale: locale,
  });

  // Mark texts for translation
  const title = translator.t(product.title);
  const description = translator.t(product.description);

  // Execute translations
  await translator.execute();

  return (
    <div>
      <h1>{translator.get(title)}</h1>
      <p>{translator.get(description)}</p>
    </div>
  );
}
```

## Conclusion

Implementing URL-based locale routing with React AutoLocalise provides a robust foundation for building multilingual applications with Next.js. This approach ensures that your application is SEO-friendly, user-friendly, and ready for international audiences.

By following this guide, you've learned how to:

1. Configure Next.js middleware for locale detection and redirection
2. Structure your application with dynamic locale segments
3. Create locale-aware components for both server and client rendering
4. Implement a locale switcher for user language selection
5. Add proper metadata for SEO optimization

For more information on React AutoLocalise features and capabilities, refer to the main [README.md](./README.md) file.