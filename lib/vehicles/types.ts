export type VehicleMode = "tram" | "metro" | "bus";

export type Vehicle = {
  id: string;
  line: string;
  mode: VehicleMode;
  towards: string;
  lon: number;
  lat: number;
  bearing: number;
  /** Seconds behind schedule; negative means running early. */
  delay: number;
  /**
   * False when the position comes from the timetable alone, because the trip
   * had no entry in the real-time feed at the last poll.
   */
  realtime: boolean;
};

export type VehiclesResponse = {
  /** Server time the positions were computed for, in epoch milliseconds. */
  at: number;
  vehicles: Vehicle[];
};
