"use client";

import { useEffect, useState } from "react";

// TEMPORARY — diagnosing the band of background along the bottom edge of the
// installed iOS app. Delete this file, its import in app/[lang]/page.tsx, and
// put the themeColor in app/[lang]/layout.tsx back to #fafafa / #242c45 once we
// know which side of the viewport edge that band is on.
//
// Read it like this:
//   · the LIME line is pinned to the bottom of the layout viewport. If there is
//     background visible BELOW the lime line, the viewport itself stops short of
//     the screen and the fix is layout.
//   · the band turning RED means iOS is painting it with theme-color, which is
//     set to red for this build. Then the fix is the meta tag, not the layout.
//   · if the lime line sits on the true bottom edge and the band is red, both
//     agree: it is outside the page and theme-color owns it.

type Reading = {
  inner: number;
  screen: number;
  visual: number;
  insetTop: number;
  insetBottom: number;
  canvasBottom: number;
  standalone: boolean;
  dpr: number;
};

function read(): Reading {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;bottom:0;width:1px;pointer-events:none;" +
    "height:env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const insetBottom = probe.getBoundingClientRect().height;
  probe.style.height = "env(safe-area-inset-top)";
  const insetTop = probe.getBoundingClientRect().height;
  probe.remove();

  const canvas = document.querySelector(".bim-map canvas");

  return {
    inner: Math.round(window.innerHeight),
    screen: Math.round(window.screen.height),
    visual: Math.round(window.visualViewport?.height ?? 0),
    insetTop: Math.round(insetTop),
    insetBottom: Math.round(insetBottom),
    canvasBottom: canvas
      ? Math.round(canvas.getBoundingClientRect().bottom)
      : -1,
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    dpr: window.devicePixelRatio,
  };
}

export function SafeAreaDebug() {
  const [now, setNow] = useState<Reading | null>(null);

  useEffect(() => {
    const tick = () => setNow(read());
    // The canvas is not in the DOM on the first paint, and iOS settles its
    // viewport a beat after launch, so sample a few times rather than once.
    tick();
    const timers = [400, 1200, 3000].map((ms) => window.setTimeout(tick, ms));
    window.addEventListener("resize", tick);
    window.visualViewport?.addEventListener("resize", tick);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", tick);
      window.visualViewport?.removeEventListener("resize", tick);
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] h-[3px] bg-lime-400" />
      {now && (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[100] rounded-lg bg-black/80 px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300">
          <div>
            inner {now.inner} · screen {now.screen} · vis {now.visual}
          </div>
          <div>
            insetTop {now.insetTop} · insetBottom {now.insetBottom}
          </div>
          <div>
            canvasBottom {now.canvasBottom} · gap {now.inner - now.canvasBottom}
          </div>
          <div>
            standalone {String(now.standalone)} · dpr {now.dpr}
          </div>
        </div>
      )}
    </>
  );
}
