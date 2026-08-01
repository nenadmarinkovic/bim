"use client";

import { ThemeProvider } from "next-themes";

import { MapReadyProvider } from "@/components/map-ready";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VehiclesProvider } from "@/components/vehicles-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={200}>
        <VehiclesProvider>
          <MapReadyProvider>{children}</MapReadyProvider>
        </VehiclesProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
