import {
  BUS_BLUE,
  METRO_COLOR,
  SBAHN_BLUE,
  TRAM_RED,
  forNight,
} from "@/lib/vehicles/colors";
import type { BoardRow, StopBoard } from "@/lib/vehicles/board";
import { lateness } from "./vehicle-popup";
import type { StopSelection } from "./stops";
import type { Exit } from "./exits";
import { badgeMarkup, type StationMode } from "./stop-icons";
import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import {
  SWITCH_ROOT,
  SWITCH_THUMB,
  SWITCH_TRACK,
} from "@/components/ui/switch-classes";

export const rowKey = (row: BoardRow) => `${row.line}|${row.towards}`;

// What a rider would call it, not what the feed calls it.
const modeLabel = (dict: Dictionary, mode: string): string | undefined =>
  (dict.stop.modes as Record<string, string>)[mode];

const describeModes = (modes: string[], dict: Dictionary) =>
  modes
    .map((mode) => modeLabel(dict, mode))
    .filter(Boolean)
    .join(" · ");

// The same marks the map draws, so the popup confirms what was clicked.
function buildModes(modes: string[], dict: Dictionary): HTMLElement {
  const row = document.createElement("div");
  row.className = "bim-stop-modes";

  for (const mode of modes) {
    const label = modeLabel(dict, mode);
    if (!label) continue;
    const badge = document.createElement("span");
    badge.className = "bim-stop-mode";
    badge.title = label;
    badge.innerHTML = badgeMarkup(mode as StationMode, 13);
    row.append(badge);
  }

  const label = document.createElement("span");
  label.className = "bim-popup-kind";
  label.textContent = describeModes(modes, dict);
  row.append(label);

  return row;
}

export function rowColour(row: BoardRow, dark: boolean): string {
  const base =
    row.mode === "metro"
      ? (METRO_COLOR[row.line] ?? TRAM_RED)
      : row.mode === "tram"
        ? TRAM_RED
        : row.mode === "train"
          ? SBAHN_BLUE
          : BUS_BLUE;
  return dark ? forNight(base) : base;
}

export type BoardView = {
  selection: StopSelection;
  dark: boolean;
  dict: Dictionary;
  tracing: string | null;
  // Rows the schedule has no geometry for — the Badner Bahn and other lines
  // Wiener Linien publishes departures for but does not operate.
  untraceable: Set<string>;
  onTrace: (row: BoardRow) => void;
  // Only the stations whose doors are mapped get these.
  exits?: Exit[];
  exitsShown?: boolean;
  onToggleExits?: () => void;
};

// The rows share one grid, so the "min" heading sits directly over the numbers
// it labels rather than being stranded at the foot of the popup.
function buildHeading(dict: Dictionary): HTMLElement {
  const element = document.createElement("li");
  element.className = "bim-stop-row";

  const unit = document.createElement("span");
  unit.className = "bim-stop-unit";
  unit.textContent = dict.stop.minutes;

  element.append(
    document.createElement("span"),
    document.createElement("span"),
    unit,
  );
  return element;
}

function buildRow(row: BoardRow, view: BoardView): HTMLElement {
  const element = document.createElement("li");
  element.className = "bim-stop-row";

  const active = view.tracing === rowKey(row);

  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "bim-stop-pick";
  pick.dataset.active = String(active);
  pick.title = fill(
    active ? view.dict.stop.untrace : view.dict.stop.trace,
    { line: row.line, towards: row.towards },
  );
  pick.addEventListener("click", () => view.onTrace(row));

  const badge = document.createElement("span");
  badge.className = "bim-stop-badge";
  badge.style.setProperty("--line", rowColour(row, view.dark));
  badge.textContent = row.line;

  const towards = document.createElement("span");
  towards.className = "bim-stop-towards";
  towards.textContent = `→ ${row.towards}`;

  const times = document.createElement("span");
  times.className = "bim-stop-times";

  for (const departure of row.departures) {
    const time = document.createElement("span");
    time.className = "bim-stop-time";
    time.textContent =
      departure.countdown === 0
        ? view.dict.stop.now
        : `${departure.countdown}`;
    if (departure.delay === null) {
      time.dataset.scheduled = "true";
      time.title = view.dict.vehicle.scheduled;
    } else {
      time.title = lateness(departure.delay, view.dict);
    }
    times.append(time);
  }

  pick.append(badge, towards, times);
  element.append(pick);
  return element;
}

function buildBoard(board: StopBoard, view: BoardView): HTMLElement {
  if (!board.rows.length) {
    const empty = document.createElement("span");
    empty.className = "bim-stop-note";
    empty.textContent = view.dict.stop.noDepartures;
    return empty;
  }

  const list = document.createElement("ul");
  list.className = "bim-stop-rows";
  list.append(buildHeading(view.dict));
  for (const row of board.rows) list.append(buildRow(row, view));
  return list;
}

// The doors themselves belong on the map, not listed twice, so the popup keeps
// only the count and the switch that puts them there.
function buildExits(exits: Exit[], view: BoardView): HTMLElement {
  const { dict } = view;
  const on = Boolean(view.exitsShown);

  const row = document.createElement("div");
  row.className = "bim-stop-exits";

  const label = document.createElement("span");
  label.className = "bim-exits-label";
  const stepFree = exits.filter((exit) => exit.access === "free").length;
  label.textContent = stepFree
    ? fill(dict.exits.withStepFree, {
        count: String(exits.length),
        stepFree: String(stepFree),
      })
    : fill(dict.exits.count, { count: String(exits.length) });

  // The same control as the map settings panel, built by hand because a popup is
  // DOM rather than React. Merged rather than concatenated: the track colour and
  // the root's default are the same property, and only tailwind-merge drops the
  // loser — plain concatenation leaves both and the cascade picks the wrong one.
  const track = document.createElement("button");
  track.type = "button";
  track.role = "switch";
  track.className = cn(SWITCH_ROOT, SWITCH_TRACK);
  track.dataset.slot = "switch";
  track.dataset.size = "sm";
  track.setAttribute("aria-checked", String(on));
  track.setAttribute("aria-label", dict.exits.show);
  track.setAttribute(on ? "data-checked" : "data-unchecked", "");

  const thumb = document.createElement("span");
  thumb.className = SWITCH_THUMB;
  thumb.dataset.slot = "switch-thumb";
  thumb.setAttribute(on ? "data-checked" : "data-unchecked", "");
  track.append(thumb);

  if (view.onToggleExits) {
    track.addEventListener("click", view.onToggleExits);
  }

  row.append(label, track);
  return row;
}

export function buildStopPopup(view: BoardView): HTMLElement {
  const { selection, dict } = view;

  const root = document.createElement("div");
  root.className = "bim-stop-popup";

  const title = document.createElement("strong");
  title.className = "bim-popup-title";
  title.textContent = selection.name;

  root.append(title);

  if (view.exits?.length) {
    root.append(buildExits(view.exits, view));
  }


  if (selection.modes.length) {
    root.append(buildModes(selection.modes, dict));
  } else {
    const kind = document.createElement("span");
    kind.className = "bim-popup-kind";
    kind.textContent = dict.stop.departures;
    root.append(kind);
  }

  if (selection.board) {
    root.append(buildBoard(selection.board, view));
  } else {
    const note = document.createElement("span");
    note.className = "bim-stop-note";
    if (selection.failed) {
      note.textContent = dict.stop.unavailable;
    } else {
      note.dataset.pending = "true";
      note.textContent = dict.stop.reading;
    }
    root.append(note);
  }

  // Only worth explaining the faded numbers when some are actually faded.
  const anyScheduled = selection.board?.rows.some((row) =>
    row.departures.some((departure) => departure.delay === null),
  );

  const source = document.createElement("span");
  source.className = "bim-popup-source";
  source.textContent = selection.board?.rows.length
    ? anyScheduled
      ? dict.stop.tapToTraceFaded
      : dict.stop.tapToTrace
    : dict.stop.operator;
  root.append(source);

  return root;
}
