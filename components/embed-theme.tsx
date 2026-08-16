"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import { listenToParents, postToParents } from "./embed-channel";

export function EmbedTheme({ parents }: { parents: string[] }) {
  const { setTheme } = useTheme();
  const apply = useRef(setTheme);

  useEffect(() => {
    apply.current = setTheme;
  }, [setTheme]);

  useEffect(() => {
    if (window.parent === window) return;

    const stop = listenToParents(parents, (data) => {
      if (data.type !== "theme") return;
      if (data.theme === "dark" || data.theme === "light")
        apply.current(data.theme);
    });
    postToParents(parents, { type: "embed:ready" });
    return stop;
  }, [parents]);

  return null;
}
