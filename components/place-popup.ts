import type { Place } from "./places";

export function buildPlacePopup(place: Place, onAsk: () => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "bim-place-popup";

  const title = document.createElement("strong");
  title.className = "bim-popup-title";
  title.textContent = place.title;

  const kind = document.createElement("span");
  kind.className = "bim-popup-kind";
  kind.textContent = place.kind;

  root.append(title, kind);

  if (place.detail) {
    const detail = document.createElement("span");
    detail.className = "bim-popup-detail";
    if (place.pending) detail.dataset.pending = "true";
    detail.textContent = place.detail;
    root.append(detail);
  }

  if (place.described) {
    const footer = document.createElement("div");
    footer.className = "bim-popup-ai";

    const source = document.createElement("span");
    source.className = "bim-popup-source";
    source.textContent = "AI summary";

    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "bim-popup-ask";
    ask.textContent = "Ask more";
    ask.addEventListener("click", onAsk);

    footer.append(source, ask);
    root.append(footer);
  }

  return root;
}
