import type { Place } from "./places";

const SPEAKER =
  '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
const STOP = '<rect x="6" y="6" width="12" height="12" rx="1.5"/>';

// One element for the page, so a second place cannot talk over the first.
let player: HTMLAudioElement | null = null;

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function buildListenButton(place: Place): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bim-popup-listen";
  button.title = "Listen";
  button.setAttribute("aria-label", "Listen");
  button.innerHTML = icon(SPEAKER);

  const reset = () => {
    button.innerHTML = icon(SPEAKER);
    button.removeAttribute("data-busy");
  };

  button.addEventListener("click", () => {
    if (player && !player.paused && player.dataset.place === place.title) {
      player.pause();
      reset();
      return;
    }

    player?.pause();
    button.dataset.busy = "true";

    const url = `/api/place/audio?name=${encodeURIComponent(place.title)}&kind=${encodeURIComponent(place.kind)}&lang=en`;

    player = new Audio(url);
    player.dataset.place = place.title;
    player.addEventListener("playing", () => {
      button.innerHTML = icon(STOP);
      button.removeAttribute("data-busy");
    });
    player.addEventListener("ended", reset);
    player.addEventListener("error", () => {
      button.title = "No audio for this one";
      reset();
    });
    player.play().catch(reset);
  });

  return button;
}

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

    const actions = document.createElement("div");
    actions.className = "bim-popup-ai-actions";

    const listen = buildListenButton(place);

    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "bim-popup-ask";
    ask.textContent = "Ask more";
    ask.addEventListener("click", onAsk);

    actions.append(listen, ask);
    footer.append(source, actions);
    root.append(footer);
  }

  return root;
}
