"use client";

import { useEffect, useState } from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", icon: DesktopIcon, label: "System" },
  { value: "light", icon: SunIcon, label: "Light" },
  { value: "dark", icon: MoonIcon, label: "Dark" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn("h-7 w-18.5", className)} />;
  }

  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      spacing={0}
      value={[theme ?? "system"]}
      onValueChange={(value) => {
        const next = value[0];
        if (next) setTheme(next);
      }}
      aria-label="Theme"
      className={className}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <Tooltip key={value}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={value} aria-label={label}>
                <Icon weight="regular" className="size-3" />
              </ToggleGroupItem>
            }
          />
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
