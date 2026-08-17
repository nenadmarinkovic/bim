# Bim

A live map of Vienna's public transport — trams, buses, U-Bahn and the ÖBB
S-Bahn — at [bim.nenadmarinkovic.com](https://bim.nenadmarinkovic.com).

## How the vehicles get on the map

Wiener Linien does not publish vehicle positions. Its real-time API only says
how many minutes until the next departure at a given stop.

So Bim works the positions out. It takes the timetable, the real track geometry,
and the reported delays, and places each vehicle where it should be between the
stop behind it and the stop ahead. Every scheduled trip is drawn, with live
delays applied wherever the feed provides them.

This means **a dot is an estimate, not a GPS fix.** Accuracy is about one stop
apart — close on the U-Bahn, looser for a tram stuck in traffic. Each vehicle
carries how confident it is, which you can see in its opacity and read in its
popup:

| Certainty      | Meaning                                       |
| -------------- | --------------------------------------------- |
| `measured`     | between two stops the feed just reported on    |
| `interpolated` | live data, but in a stretch nobody reports on  |
| `scheduled`    | no live data at all — timetable only           |

The S-Bahn is always `scheduled`. It is run by ÖBB, and no live feed covers it.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Mapbox token
npm run ingest               # builds the data (~80 MB download, takes a while)
npm run dev
```

Node 22.6 or newer. The ingest scripts are TypeScript run directly by `node`.

## What's on the map

Vehicles, stations, place labels and street names are on when you open it.
Everything else is in Settings:

- **Districts** — the 23 Bezirke
- **Bike paths** — the cycling network, split by what it actually gives a rider
- **Pedestrian zones** — including the hours they apply
- **Roadworks** — live, refreshed every half hour
- **Drinking fountains** — the drinkable ones, dog troughs marked
- **Public toilets** — step-free ones and men-only pissoirs marked

Click a station for its live departure board. Click a vehicle to draw its route
and follow it. Search with ⌘K. The last button in the stack finds where you are.

Available in English and German. Installs as a PWA.

## Environment variables

Only the first one is needed. Without the others, those features quietly switch
off — nothing breaks.

| Variable                     | What you lose without it       |
| ---------------------------- | ------------------------------ |
| `NEXT_PUBLIC_MAPBOX_TOKEN`   | the map itself                 |
| `MISTRAL_API_KEY`            | descriptions when you click a place |
| `ELEVENLABS_API_KEY`         | hearing those descriptions read aloud |
| `BREVO_API_KEY` + sender/recipient | the contact form         |
| `EMBED_PARENTS`              | embedding the map in another site |

The Mapbox token must be set **at build time**, not just at runtime — Next bakes
`NEXT_PUBLIC_*` into the browser bundle. The rest are read on the server and can
live in the service environment.

## Running it

An ordinary Next.js server behind a reverse proxy.

```bash
npm ci
npm run ingest    # data/ is gitignored, so build it on the server
npm run build
npm run start     # port 3000
```

Budget about 1 GB of disk. `data/` is ~42 MB; `.cache/` grows to a few hundred
MB and is safe to delete.

### The ingest has to run every day

`npm run ingest` builds the timetable for **one service day**. Run it daily at
04:00, and **restart the app afterwards** — the schedule is parsed once and held
in memory, so without a restart the old one keeps serving.

```
0 4 * * * cd /srv/bim && npm run ingest && systemctl restart bim
```

`deploy/` has this as a systemd timer, which is what the server actually runs,
plus a failure alert by email. If an ingest fails you have until about 05:00
before the map goes empty — after that `/api/vehicles` returns a 503 explaining
that the data is stale, rather than showing a wrongly empty city.

## Where the data comes from

- **Wiener Linien** open data — stops, lines, routes, and the live departure API
- **GTFS** (zuugle-services, CC BY 4.0) — timetables and track geometry
- **ÖBB** (`data.oebb.at`, CC BY 4.0) — the S-Bahn
- **Stadt Wien** open data — districts, bike paths, zones, roadworks, fountains, toilets
- **OpenStreetMap** — U-Bahn tunnels and station entrances

Station entrances come from OpenStreetMap, so plenty are still missing. Adding
one there puts it here at the next ingest.
