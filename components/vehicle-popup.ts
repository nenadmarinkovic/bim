import type { Vehicle } from "@/lib/vehicles/types";

export type PopupActions = {
  onToggleRoute: () => void;
  onToggleFollow: () => void;
  routeShown: boolean;
  following: boolean;
};

function lateness(delay: number): string {
  if (delay === 0) return "on time";
  const minutes = Math.round(Math.abs(delay) / 60) || "<1";
  return delay > 0 ? `${minutes} min late` : `${minutes} min early`;
}

function basis(vehicle: Vehicle): string {
  if (vehicle.certainty === "measured") return "measured at this stop";
  if (vehicle.certainty === "interpolated") {
    const n = vehicle.stopsFromReport;
    return `interpolated, ${n} stop${n === 1 ? "" : "s"} from a measured one`;
  }
  return "timetable only — no live data";
}

export function buildVehiclePopup(
  vehicle: Vehicle,
  actions: PopupActions,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "bim-vehicle-popup";

  const line = document.createElement("strong");
  line.textContent = vehicle.line;
  const towards = document.createElement("span");
  towards.textContent = ` → ${vehicle.towards}`;

  const heading = document.createElement("div");
  heading.append(line, towards);

  const meta = document.createElement("div");
  meta.className = "bim-popup-detail";
  meta.textContent = [
    lateness(vehicle.delay),
    vehicle.underground ? "in tunnel" : null,
    basis(vehicle),
  ]
    .filter(Boolean)
    .join(" · ");

  const buttons = document.createElement("div");
  buttons.className = "bim-popup-actions";

  const routeButton = document.createElement("button");
  routeButton.type = "button";
  routeButton.textContent = actions.routeShown ? "Hide route" : "Show route";
  routeButton.addEventListener("click", actions.onToggleRoute);

  const followButton = document.createElement("button");
  followButton.type = "button";
  followButton.textContent = actions.following ? "Stop following" : "Follow";
  followButton.dataset.active = String(actions.following);
  followButton.addEventListener("click", actions.onToggleFollow);

  buttons.append(routeButton, followButton);
  root.append(heading, meta, buttons);
  return root;
}
