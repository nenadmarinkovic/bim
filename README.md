# bim

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

### Current state

```
stops     4432/4496 matched (98.6%)   3694 by name, 738 by distance
coverage  4225/4257 locatable stops served by a line (99.2%)
lines     204 lines, 6538 patterns
shapes    5431 shapes, 987710 points
```

The 558 StopIDs with no DIVA and zeroed coordinates are operational points —
depot runs, short workings, terminus markers. They appear in route patterns but
carry no location by construction, so they are excluded from coverage rather
than counted as failures.

`npm run ingest:verify` checks the built index against the live monitor API,
which is the only check that proves more than internal consistency. Last run:
57/57 StopIDs resolved to the expected DIVA, positions a median 23.9 m from what
the API reports (the gap is stop centroid vs. platform).

Artifacts land in `data/` and downloads cache in `.cache/`; both are gitignored.
