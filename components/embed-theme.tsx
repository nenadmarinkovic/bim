"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { listenToParents, postToParents } from "./embed-channel";

export function EmbedTheme({ parents }: { parents: string[] }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (window.parent === window) return;

    const stop = listenToParents(parents, (data) => {
      if (data.type !== "theme") return;
      if (data.theme === "dark" || data.theme === "light") setTheme(data.theme);
    });
    postToParents(parents, { type: "embed:ready" });
    return stop;
  }, [parents, setTheme]);

  return null;
}
