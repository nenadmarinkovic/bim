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
  underground: boolean;
  path?: number[];
  pd?: number[];
  d?: number;
  dNext?: number;
  stopsFromReport: number;
};

export type VehiclesResponse = {
  at: number;
  vehicles: Vehicle[];
};
