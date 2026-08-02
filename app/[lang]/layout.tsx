import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Providers } from "../providers";
import { LocaleProvider } from "@/components/locale-provider";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { getDictionary, isLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(isLocale(lang) ? lang : "en");

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        {
          url: "/favicon.svg",
          type: "image/svg+xml",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/favicon-dark.svg",
          type: "image/svg+xml",
          media: "(prefers-color-scheme: dark)",
        },
        { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      ],
      apple: {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    },
  };
}

// The browser resolves these itself, so the chrome is already the right colour
// before any of our JavaScript runs. ThemeColorSync takes over at hydration for
// the one case the media queries cannot know about: a theme picked by hand that
// disagrees with the system preference.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#242c45" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang} suppressHydrationWarning className="antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/HankenGrotesk-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Newsreader-Italic-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      {/* dvh, not vh: on phones the URL bar counts against the viewport, and a
          vh-tall map leaves its bottom row of controls under the chrome. */}
      <body className="h-dvh overflow-hidden overscroll-none">
        <LocaleProvider locale={lang} dictionary={getDictionary(lang)}>
          <Providers>
            <ThemeColorSync />
            {children}
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
