"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle colour theme"
    >
      {/* The label follows the `dark` class rather than component state, so it
          needs no mount guard and cannot mismatch during hydration. */}
      <span className="dark:hidden">dunkel</span>
      <span className="hidden dark:inline">hell</span>
    </button>
  );
}
