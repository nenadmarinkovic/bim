"use client";

import { useSyncExternalStore } from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", icon: DesktopIcon, key: "system" },
  { value: "light", icon: SunIcon, key: "light" },
  { value: "dark", icon: MoonIcon, key: "dark" },
] as const;

type Size = "sm" | "default";

const PLACEHOLDER: Record<Size, string> = {
  sm: "h-7 w-18.5",
  default: "h-8 w-24",
};

export function ThemeToggle({
  className,
  size = "sm",
}: {
  className?: string;
  size?: Size;
}) {
  const { theme, setTheme } = useTheme();
  const dict = useDict();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className={cn(PLACEHOLDER[size], className)} />;
  }

  return (
    <ToggleGroup
      size={size}
      variant="outline"
      spacing={0}
      value={[theme ?? "system"]}
      onValueChange={(value) => {
        const next = value[0];
        if (next) setTheme(next);
      }}
      aria-label={dict.theme.label}
      className={className}
    >
      {OPTIONS.map(({ value, icon: Icon, key }) => (
        <Tooltip key={value}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={value} aria-label={dict.theme[key]}>
                <Icon
                  weight="regular"
                  className={size === "default" ? "size-3.5" : "size-3"}
                />
              </ToggleGroupItem>
            }
          />
          <TooltipContent side="top">{dict.theme[key]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
