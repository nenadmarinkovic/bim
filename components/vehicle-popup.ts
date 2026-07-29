import type { Vehicle } from "@/lib/vehicles/types";
import type { Dictionary } from "@/lib/i18n";
import { fill, plural } from "@/lib/i18n/locales";

export type PopupActions = {
  onToggleRoute: () => void;
  onToggleFollow: () => void;
  routeShown: boolean;
  following: boolean;
};

export function lateness(delay: number, dict: Dictionary): string {
  if (delay === 0) return dict.vehicle.onTime;
  const minutes = Math.round(Math.abs(delay) / 60) || dict.vehicle.lessThanOne;
  return fill(delay > 0 ? dict.vehicle.late : dict.vehicle.early, {
    n: minutes,
  });
}

function basis(vehicle: Vehicle, dict: Dictionary): string {
  if (vehicle.certainty === "measured") return dict.vehicle.measured;
  if (vehicle.certainty === "interpolated") {
    return plural(dict.vehicle.interpolated, vehicle.stopsFromReport);
  }
  return dict.vehicle.scheduled;
}

export function buildVehiclePopup(
  vehicle: Vehicle,
  actions: PopupActions,
  dict: Dictionary,
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
    lateness(vehicle.delay, dict),
    vehicle.underground ? dict.vehicle.inTunnel : null,
    basis(vehicle, dict),
  ]
    .filter(Boolean)
    .join(" · ");

  const buttons = document.createElement("div");
  buttons.className = "bim-popup-actions";

  const routeButton = document.createElement("button");
  routeButton.type = "button";
  routeButton.textContent = actions.routeShown
    ? dict.vehicle.hideRoute
    : dict.vehicle.showRoute;
  routeButton.addEventListener("click", actions.onToggleRoute);

  const followButton = document.createElement("button");
  followButton.type = "button";
  followButton.textContent = actions.following
    ? dict.vehicle.unfollow
    : dict.vehicle.follow;
  followButton.dataset.active = String(actions.following);
  followButton.addEventListener("click", actions.onToggleFollow);

  buttons.append(routeButton, followButton);
  root.append(heading, meta, buttons);
  return root;
}
