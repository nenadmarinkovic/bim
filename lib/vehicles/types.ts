export type VehicleMode = "tram" | "metro" | "bus";

export type Certainty = "measured" | "interpolated" | "scheduled";

export type Vehicle = {
  id: string;
  line: string;
  mode: VehicleMode;
  towards: string;
  lon: number;
  lat: number;
  bearing: number;
  delay: number;

  realtime: boolean;
  certainty: Certainty;
  /** True while the vehicle is in tunnel — U-Bahn only, from OSM. */
  underground: boolean;
  /**
   * The stretch of track around the vehicle: flat [lon, lat, ...] with the
   * matching shape distances in `pd`, and the vehicle's own distance in `d`.
   * Sent only for vehicles in view — it is what lets the body bend along a
   * curve instead of being drawn as a rigid box on the chord.
   */
  path?: number[];
  pd?: number[];
  d?: number;
  /**
   * Distance one poll interval from now. The client tweens `d` to this in real
   * time, so vehicles move on the first frame instead of standing still until a
   * second sample arrives — and the map is current rather than an interval behind.
   */
  dNext?: number;
  stopsFromReport: number;
};

export type VehiclesResponse = {
  at: number;
  vehicles: Vehicle[];
};
