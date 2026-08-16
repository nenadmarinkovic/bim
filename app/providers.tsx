"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";
import { VehiclesProvider } from "@/components/vehicles-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={pathname?.endsWith("/embed") ? "theme-embed" : "theme"}
    >
      <TooltipProvider delay={200}>
        <VehiclesProvider>{children}</VehiclesProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
