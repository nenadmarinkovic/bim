import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import { ThemeColorSync } from "@/components/theme-color-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "bim",
  description: "A live map of the Wiener Linien network.",
};

export async function generateViewport(): Promise<Viewport> {
  // Read the in-app theme cookie (set by ThemeColorSync). If present, emit a
  // single theme-color matching the user's pick — prevents the iOS notch from
  // flashing the OS-default color when in-app theme differs from system theme.
  const pref = (await cookies()).get("theme-color")?.value;
  const base: Viewport = {
    viewportFit: "cover",
  };
  if (pref === "dark") return { ...base, themeColor: "#000000" };
  if (pref === "light") return { ...base, themeColor: "#fafafa" };
  return {
    ...base,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#fafafa" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
  };
}

const THEME_COLOR_SCRIPT = `(function(){try{
var t=localStorage.getItem("theme");
if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
var color=t==="dark"?"#000000":"#fafafa";
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
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SCRIPT }} />
        <Providers>
          <ThemeColorSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}
