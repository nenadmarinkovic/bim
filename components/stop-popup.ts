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

export const rowKey = (row: BoardRow) => `${row.line}|${row.towards}`;

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
  tracing: string | null;
  // Rows the schedule has no geometry for — the Badner Bahn and other lines
  // Wiener Linien publishes departures for but does not operate.
  untraceable: Set<string>;
  onTrace: (row: BoardRow) => void;
};

// The rows share one grid, so the "min" heading sits directly over the numbers
// it labels rather than being stranded at the foot of the popup.
function buildHeading(): HTMLElement {
  const element = document.createElement("li");
  element.className = "bim-stop-row";

  const unit = document.createElement("span");
  unit.className = "bim-stop-unit";
  unit.textContent = "min";

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
  pick.title = active
    ? `Hide the ${row.line} to ${row.towards}`
    : `Trace the ${row.line} to ${row.towards}`;
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
      departure.countdown === 0 ? "now" : `${departure.countdown}`;
    if (departure.delay === null) {
      time.dataset.scheduled = "true";
      time.title = "timetable only — no live data";
    } else {
      time.title = lateness(departure.delay);
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
    empty.textContent = "No departures right now.";
    return empty;
  }

  const list = document.createElement("ul");
  list.className = "bim-stop-rows";
  list.append(buildHeading());
  for (const row of board.rows) list.append(buildRow(row, view));
  return list;
}

export function buildStopPopup(view: BoardView): HTMLElement {
  const { selection } = view;

  const root = document.createElement("div");
  root.className = "bim-stop-popup";

  const title = document.createElement("strong");
  title.className = "bim-popup-title";
  title.textContent = selection.name;

  const kind = document.createElement("span");
  kind.className = "bim-popup-kind";
  kind.textContent = "Departures";

  root.append(title, kind);

  if (selection.board) {
    root.append(buildBoard(selection.board, view));
  } else {
    const note = document.createElement("span");
    note.className = "bim-stop-note";
    if (selection.failed) {
      note.textContent = "Departures unavailable.";
    } else {
      note.dataset.pending = "true";
      note.textContent = "Reading the board…";
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
      ? "Tap a line to trace it · faded = timetable only"
      : "Tap a line to trace it"
    : "Wiener Linien";
  root.append(source);

  return root;
}
