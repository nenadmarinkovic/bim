# Bim

A live map of the Wiener Linien network.

Wiener Linien publishes no vehicle positions. The public real-time API is
stop-based: it returns departure countdowns per stop, never coordinates. So
positions here are **interpolated** — vehicles are placed along static track
geometry using the countdown deltas at the stops ahead of and behind them.
Expect roughly stop-to-stop accuracy: near-exact on the U-Bahn, looser for
surface trams in traffic.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Mapbox token
npm run ingest               # build the static data layer (~80 MB download, cached 12h)
npm run dev
```

`NEXT_PUBLIC_MAPBOX_TOKEN` is required for the map to render; without it the map
area explains what is missing rather than failing. The base style follows the
colour theme (`light-v11` / `dark-v11`), and `/api/stops` serves the ingested
stop index as GeoJSON — 4,432 points, which is what the map draws today.

Type is Hanken Grotesk with Newsreader italic for brand accents, self-hosted
from `public/fonts` and sharing the token scale used in nomos.

## Data

### Sources

| Source                                   | What it gives                                       |
| ---------------------------------------- | --------------------------------------------------- |
| `wienerlinien-ogd-haltepunkte.csv`       | StopID (the real-time key) → DIVA, name, coordinates |
| `wienerlinien-ogd-haltestellen.csv`      | DIVA → stop name and coordinates                     |
| `wienerlinien-ogd-linien.csv`            | LineID → line name, mode, real-time support          |
| `wienerlinien-ogd-fahrwegverlaeufe.csv`  | LineID + PatternID → ordered StopID sequence         |
| GTFS zip (zuugle-services, CC BY 4.0)    | `stops.txt`, `routes.txt`, `trips.txt`, `shapes.txt` |

`haltepunkte.csv` is not listed in the OGD documentation, and the documented
`steige.csv` is a 449-row stub mapping StopID to a platform letter. Without
`haltepunkte.csv` there is no offline path from a real-time StopID to anything
geographic — the alternative is ~4,500 monitor API calls to harvest the same
mapping.

`shapes.txt` is the only public source of track geometry, and it only ships in
the community GTFS conversion — Wiener Linien does not publish one directly.

### The join

The real-time API speaks StopID. GTFS speaks Austrian national stop ids. The
bridge is arithmetic:

```
StopID  --haltepunkte.csv-->  DIVA  =  60200000 + n  <-->  at:49:<n>:0:<platform>
```

A numeric join is not proof, so every match is classified (`scripts/ingest/match.ts`):
accepted on an exact normalised name, or on proximity within 250 m when the two
sources merely spell the name differently (`Bösendorfer Str., Karlsplatz` vs
`Bösendorferstraße/Karlsplatz`). Anything else is rejected rather than trusted.

GTFS coordinates win over the Wiener Linien ones: six `haltepunkte.csv` rows
place Vienna stops in Lower Austria, up to 116 km out.

### Positioning vehicles

The GTFS-RT feed carries **TripUpdates only — no VehiclePositions**. What it does
carry is the static `trip_id`, which solves vehicle identity outright: there is
no need to guess which countdown at stop B is the same vehicle as the one at
stop A. Each update reports a delay against the timetable.

Position then falls out of `shape_dist_traveled`, which appears in both
`stop_times.txt` and `shapes.txt` in the same units:

```
now → bracketing stop pair (scheduled time + reported delay)
    → distance along shape, interpolated linearly between the two stops
    → coordinate, by binary search on the shape's distance array
```

No geometric projection, no map-matching. Accuracy is roughly one stop-to-stop
segment: near-exact on the U-Bahn, looser for a tram stuck in traffic between
two widely spaced stops.

Two consequences worth knowing:

- **Every scheduled trip is placed, with real-time delays layered on where the
  feed supplies them.** Driving off the timetable rather than off the feed means
  coverage gaps do not blank the map — vehicles the feed omits keep moving on
  schedule and are marked `realtime: false`, drawn hollower and counted
  separately as *estimated*.
- **The feed repeats each trip across several entities** — commonly four — so
  updates are merged per `trip_id`. Without that, one vehicle is drawn once per
  duplicate at identical coordinates.

A delay revision moves the computed point discontinuously: a bus going from
on-time to five minutes late legitimately jumps a kilometre back. Movement over
300 m in one poll is applied instantly rather than animated, since sliding it
would draw a bus at several hundred km/h.

### How much to trust a dot

Wiener Linien measures departures at only part of the network. **About 73% of
the stops on a typical run come back with no reported delay**, and coverage
varies enormously by line — sampled on a Sunday morning, trams ranged from 30%
of vehicles carrying live data (line 12, the worst) to 100% (lines 1, 10, 26,
49, O and others), averaging 82%.

So accuracy is not uniform, and the map says so. Each vehicle reports a
`certainty`, which drives its opacity, and clicking one explains how its
position was arrived at:

| `certainty`    | Meaning                                              | Opacity |
| -------------- | ---------------------------------------------------- | ------- |
| `measured`     | between two stops the feed just reported on           | 1.0     |
| `interpolated` | live data, but in an unmonitored stretch              | 0.7     |
| `scheduled`    | no live data for this trip at all — timetable only    | 0.4     |

Delays are **interpolated between reported stops** rather than held constant
until the next one. Holding lets the error accumulate across the unmonitored
middle and then correct in a single step — on a tram, a jump of several hundred
metres. A run going from 98 s late to 52 s early recovered that time gradually,
not all at one stop. Measured against the live feed, this changes the typical
position not at all (median 0 m) but pulls in the tail: the worst case moved
603 m.

Residual error is dominated by things the data cannot fix — timetable stop
times are quantised to whole minutes (±30 s, or ~120 m at tram speed), and
motion between two stops is assumed linear, so a tram waiting at a light is
drawn still rolling.

### Going to the source: the monitor API

**The community GTFS-RT feed is lossy.** It is a conversion of Wiener Linien's
own monitor API, and comparing the two on line 12:

|                              | GTFS-RT feed | Monitor API directly |
| ---------------------------- | ------------ | -------------------- |
| Stops reporting a delay      | ~27%         | 36 of 36             |
| Departures carrying `timeReal` | —          | 211 of 212 (100%)    |
| Vehicles with live data      | 30%          | —                    |

The monitor API is stop-based and carries no trip id, but every departure comes
with `timePlanned`, which **is** the GTFS scheduled time. That makes matching a
departure back to a trip deterministic rather than probabilistic: measured over
a sweep, 1,242 of 1,273 real-time departures (97.6%) matched a scheduled call,
30 of 36 on the exact second and the rest within 90 s.

So there is substantial headroom over the feed. The obstacle is the quota.

**The endpoint rate-limits aggressively and the limit is not published.** Four
concurrent requests return four 403s — it throttles on concurrency, not just
volume — and sustained polling earns 403s even at 1.5 s spacing, after which
access stays blocked for a while. Sweeping all 4,432 stops on a short cycle is
not a responsible use of it.

The poller is therefore **targeted rather than exhaustive**: it asks only about
the stops vehicles are currently approaching, which is both the cheapest query
and the most useful answer, since the next stop is where a timetable-only
estimate has drifted furthest. Requests are serial, spaced 1.5 s apart, and
capped at four per cycle, with dropped batches reported rather than hidden. The
GTFS-RT feed remains the fallback, and monitor anchors win where both cover the
same stop.

`npm run ingest` also builds the schedule for the current service day plus any
of yesterday's trips that run past midnight, so night service is positioned
correctly. **It must be re-run daily** — the schedule artifact is one service
day only.

### Current state

```
stops     4432/4496 matched (98.6%)   3694 by name, 738 by distance
coverage  4225/4257 locatable stops served by a line (99.2%)
lines     204 lines, 6538 patterns
shapes    5431 shapes, 987710 points
schedule  24372 trips (23424 today + 948 running past midnight), 0 without geometry
```

A Sunday 07:30 sample places 340 vehicles — 182 bus, 118 tram, 40 metro — of
which 283 carry a real-time delay. Median movement between 12 s snapshots is
56 m (~17 km/h) and the fastest thing on the map is the Badner Bahn at 60 km/h,
which is what it actually does. `npm run vehicles:check` re-runs those
plausibility checks against the live feed; `npm run vehicles:lines` breaks the
current placement down by line.

The 558 StopIDs with no DIVA and zeroed coordinates are operational points —
depot runs, short workings, terminus markers. They appear in route patterns but
carry no location by construction, so they are excluded from coverage rather
than counted as failures.

`npm run ingest:verify` checks the built index against the live monitor API,
which is the only check that proves more than internal consistency. Last run:
57/57 StopIDs resolved to the expected DIVA, positions a median 23.9 m from what
the API reports (the gap is stop centroid vs. platform).

Artifacts land in `data/` and downloads cache in `.cache/`; both are gitignored.
