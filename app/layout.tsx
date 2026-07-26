import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import { ThemeColorSync } from "@/components/theme-color-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bim - Wiener Linien Live Map",
  description: "A live map of the Wiener Linien network.",
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

export async function generateViewport(): Promise<Viewport> {
  const pref = (await cookies()).get("theme-color")?.value;
  const base: Viewport = {
    viewportFit: "cover",
  };
  if (pref === "dark") return { ...base, themeColor: "#242c45" };
  if (pref === "light") return { ...base, themeColor: "#fafafa" };
  return {
    ...base,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#fafafa" },
      { media: "(prefers-color-scheme: dark)", color: "#242c45" },
    ],
  };
}

const THEME_COLOR_SCRIPT = `(function(){try{
var t=localStorage.getItem("theme");
if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
var color=t==="dark"?"#242c45":"#fafafa";
var metas=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<metas.length;i++){
if(i===0){metas[i].setAttribute("content",color);metas[i].setAttribute("media","all");}
else{metas[i].setAttribute("media","not all");}
}
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SCRIPT }} />
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
      <body className="h-screen overflow-hidden">
        <Providers>
          <ThemeColorSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}
