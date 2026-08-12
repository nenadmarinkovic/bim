# Bim

A live map of the Wiener Linien network, plus the ÖBB S-Bahn that runs through
it.

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
area explains what is missing rather than failing. The base style is Mapbox
Standard, whose `lightPreset` follows the colour theme — `day` or `night`,
rather than two separate styles.

## What the map draws

| Layer               | Source                                    | Default |
| ------------------- | ----------------------------------------- | ------- |
| Vehicles and labels | `/api/vehicles`, polled every 6 s         | on      |
| Stations            | `/api/stops` — 1,726 GeoJSON points       | on      |
| Places              | Mapbox POI and landmark featuresets       | off     |
| Streets             | the basemap's own road labels             | off     |
| Districts           | `/api/districts` — the 23 Bezirke         | off     |
| Bike paths          | `/api/bike-paths` — the cycling network   | off     |
| Pedestrian zones    | `/api/pedestrian-zones` — 298 zones       | off     |
| Roadworks           | `/api/roadworks` — open sites, live       | off     |
| Drinking fountains  | `/api/fountains` — 1,520 public fountains | off     |

Everything but the vehicles and the stations is off to begin with, so the map
opens on the network and nothing else. Street names are the basemap's own, and
they stay off so the network reads as the only thing written on the city.

A station is drawn twice: a mode badge you read, and an invisible circle you
click. Clicking one reads its departure board from `/api/stop`, which proxies
the Wiener Linien monitor for every platform under that DIVA and refreshes
while the popup is open. Where the station has entrances they are listed with
it, and can be drawn on the map. Clicking a vehicle draws its trip — the shape
it is running, its two termini, and arrows stepping along it in the direction
of travel — and follows it with the camera.

Searching (⌘K, ⌘F, or the search button) is a client-side pass over the same
station index the map draws, matched on the normalised name, with the last five
picks kept in `localStorage`.

Places are off by default because they cost a model call. With
`MISTRAL_API_KEY` set, clicking a POI writes two sentences about it — what it
is and something the map cannot show — cached in `data/place-descriptions.json`
so a place is paid for once. The popup then takes follow-up questions, and with
`ELEVENLABS_API_KEY` set it reads the description aloud from `data/audio`,
which is cached on the same terms.

### The city around the network

Four layers come from Stadt Wien's open data rather than from any transit feed,
because a network is only half of how a city is crossed:

- **Bike paths.** Around 15,000 published segments, kept apart by what they
  actually give a rider: a path of its own, paint on a shared road, a calmed or
  shared street, or a crossing. Paths and lanes are drawn solid, the softer two
  dashed, and the whole set is merged into four lines so it costs four features
  rather than fifteen thousand.
- **Pedestrian zones.** 298 of them, most in force only at certain hours. The
  hours are kept exactly as the city words them, since the exceptions are the
  point.
- **Roadworks.** The one layer that cannot be baked into a file — a site that
  closed last week must stop being drawn — so it is fetched on demand and held
  for half an hour. Sites Wiener Linien applied for are marked, since they are
  usually why a tram is running somewhere it normally does not.
- **Drinking fountains.** 1,520 of them, filtered down to the ones that are
  actually drinkable; the city files ornamental basins and mist sprayers in the
  same layer. The ones with a trough at ground level are marked for dogs.

Station entrances are separate again: 416 of them from OpenStreetMap, covering
99 of the 121 U-Bahn stations, each carrying whether you can get in without
stairs. They are listed in the station popup and drawn on the map on request.
Plenty are still missing, and adding one in OpenStreetMap puts it here at the
next ingest.

## Data

### Sources

| Source                                  | What it gives                                        |
| --------------------------------------- | ---------------------------------------------------- |
| `wienerlinien-ogd-haltepunkte.csv`      | StopID (the real-time key) → DIVA, name, coordinates |
| `wienerlinien-ogd-haltestellen.csv`     | DIVA → stop name and coordinates                     |
| `wienerlinien-ogd-linien.csv`           | LineID → line name, mode, real-time support          |
| `wienerlinien-ogd-fahrwegverlaeufe.csv` | LineID + PatternID → ordered StopID sequence         |
| GTFS zip (zuugle-services, CC BY 4.0)   | `stops.txt`, `routes.txt`, `trips.txt`, `shapes.txt` |
| ÖBB GTFS (`data.oebb.at`, CC BY 4.0)    | the S-Bahn, which Wiener Linien does not run         |
| Stadt Wien WFS                          | districts, bike paths, pedestrian zones, fountains   |
| Stadt Wien WFS, live                    | open roadworks, refetched every half hour            |
| OpenStreetMap, via Overpass             | U-Bahn tunnels, and station entrances                |

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
  separately as _estimated_.
- **The feed repeats each trip across several entities** — commonly four — so
  updates are merged per `trip_id`. Without that, one vehicle is drawn once per
  duplicate at identical coordinates.

A delay revision moves the computed point discontinuously: a bus going from
on-time to five minutes late legitimately jumps a kilometre back. Movement over
300 m in one poll is applied instantly rather than animated, since sliding it
would draw a bus at several hundred km/h.

### The S-Bahn, which Wiener Linien does not run

Vienna's rapid transit is two operators. The S-Bahn is ÖBB's, so it is absent
from every Wiener Linien source, and a map without it has a hole where the
Stammstrecke should be. ÖBB publish a national GTFS, which is merged into the
same schedule at ingest: routes named `S1`…`S80` of GTFS type 2, filtered to a
box around Vienna, since Salzburg and Graz number their lines S1, S2 and S3 as
well. Ids are namespaced `oebb:` — nothing guarantees the two operators never
picked the same string — and the ÖBB platforms are joined onto Wiener Linien
stations, so an interchange badges as both.

`shapes.txt` in that archive is 666 MB uncompressed for a country's worth of
track, and the ten lines that reach Vienna need a sliver of it, so only the
referenced shapes are read out of the zip.

The archive is named after the timetable year — `GTFS_Fahrplan_2026.zip` — which
turns in mid-December, so a hardcoded name is a dated fuse on a nightly job.
`oebbZips` derives the year and offers the neighbouring one as a fallback, and
the ingest takes the first that answers. The fallback matters in both directions:
before ÖBB publish the coming year, and after they do while the current file is
still the correct one.

**No live data covers the S-Bahn.** The GTFS-RT feed is a conversion of the
Wiener Linien monitor, and the monitor knows nothing about ÖBB, so every train
on the map is positioned from the timetable alone and marked `scheduled`. They
are the one mode where a dot is a claim about the schedule rather than about a
vehicle.

### Tunnels

Nothing in any transit export says whether a stretch of track is underground,
which matters for the U-Bahn: half of it is in tunnel, and a dot gliding over
the rooftops of the Innere Stadt is a dot the map should be quieter about.
Level comes from OpenStreetMap instead: a `railway=subway` way counts as
underground if it is tagged `tunnel` or sits below `layer` 0, and never if it
is on a bridge. Those ways are matched onto the GTFS shapes within 30 m and
stored as distance ranges, in the same `shape_dist_traveled` units that placed
the vehicle. Of 303.4 km of metro shape, 161.4 km resolves as underground, and
a vehicle inside one of those ranges says so in its popup.

### How much to trust a dot

Wiener Linien measures departures at only part of the network. **About 73% of
the stops on a typical run come back with no reported delay**, and coverage
varies enormously by line — sampled on a Sunday morning, trams ranged from 30%
of vehicles carrying live data (line 12, the worst) to 100% (lines 1, 10, 26,
49, O and others), averaging 82%.

So accuracy is not uniform, and the map says so. Each vehicle reports a
`certainty`, which drives its opacity, and clicking one explains how its
position was arrived at:

| `certainty`    | Meaning                                            | Opacity |
| -------------- | -------------------------------------------------- | ------- |
| `measured`     | between two stops the feed just reported on        | 1.0     |
| `interpolated` | live data, but in an unmonitored stretch           | 0.7     |
| `scheduled`    | no live data for this trip at all — timetable only | 0.4     |

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

|                                | GTFS-RT feed | Monitor API directly |
| ------------------------------ | ------------ | -------------------- |
| Stops reporting a delay        | ~27%         | 36 of 36             |
| Departures carrying `timeReal` | —            | 211 of 212 (100%)    |
| Vehicles with live data        | 30%          | —                    |

The monitor API is stop-based and carries no trip id, but every departure comes
with `timePlanned`, which **is** the GTFS scheduled time. That makes matching a
departure back to a trip deterministic rather than probabilistic: measured over
a sweep, 1,242 of 1,273 real-time departures (97.6%) matched a scheduled call,
30 of 36 on the exact second and the rest within 90 s.

So there is substantial headroom over the feed. The obstacle is the quota.

**The endpoint rate-limits aggressively and the limit is not published.** Four
concurrent requests return four 403s — it throttles on concurrency, not just
volume — and sustained polling earns 403s even at 1.5 s spacing, after which
access stays blocked for a while. Sweeping all 4,434 stops on a short cycle is
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

A stale artifact is otherwise a silent failure: every trip in it is in the
past, nothing is placed, and an empty map reads as a quiet night. So
`/api/vehicles` compares the clock against the last departure the artifact
knows about and returns 503 with what went wrong once it is past — the same
treatment a missing artifact gets, and the client shows the message. Between
midnight and the end of the night service the artifact is genuinely still
right about the runs it holds, so those keep being placed and the server logs
the warning once instead.

### Current state

The last ingest, on a Sunday — the trip count is the lowest day of the week, and
a Wednesday is around a third higher:

```
stops     4434/4507 matched (98.4%)   3693 by name, 741 by distance
stations  1726 (platforms merged by DIVA)
coverage  4224/4256 locatable stops served by a line (99.2%)
lines     204 lines (174 with real-time), 6550 patterns
shapes    5755 shapes, 979980 points
tunnels   25 metro shapes, 161.4 of 303.4 km underground
exits     416 entrances at 99 of 121 U-Bahn stations, 273 step-free
schedule  25450 trips, 0 without geometry
```

A Wednesday 21:30 sample places 551 vehicles — 272 bus, 186 tram, 47 S-Bahn,
46 metro — of which 352 carry a real-time delay, none of them trains. Median
movement over 30 s is 18.5 km/h, and the fastest things on the map are S-Bahn
runs at 85–90 km/h, which is what they actually do. `npm run vehicles:check`
re-runs those plausibility checks against the live feed; `npm run
vehicles:lines` breaks the current placement down by line.

The 554 StopIDs with no DIVA and zeroed coordinates are operational points —
depot runs, short workings, terminus markers. They appear in route patterns but
carry no location by construction, so they are excluded from coverage rather
than counted as failures.

`npm run ingest:verify` checks the built index against the live monitor API,
which is the only check that proves more than internal consistency. Last run:
57/57 StopIDs resolved to the expected DIVA, positions a median 23.9 m from what
the API reports (the gap is stop centroid vs. platform).

Artifacts land in `data/` and downloads cache in `.cache/`; both are gitignored.

## Deployment

Bim runs as an ordinary Next.js server behind a reverse proxy on a Hetzner VPS.

Node 24 (the ingest scripts are TypeScript executed directly by `node`, which
needs 22.6 or newer). Budget ~1 GB of disk: `data/` is ~42 MB once built, and
`.cache/` grows to a few hundred MB of raw downloads — it is safe to delete
between ingests.

```bash
npm ci
npm run ingest    # data/ is gitignored, so it must be built on the server
npm run build
npm run start     # binds :3000 — put nginx or Caddy in front for TLS
```

`NEXT_PUBLIC_MAPBOX_TOKEN` has to be present **at build time**, not just at
runtime: Next inlines `NEXT_PUBLIC_*` into the client bundle, so setting it only
in the service environment is too late and the map renders its "token missing"
state instead. `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
are read on the server per request and can live in the service environment.
Without the first, place descriptions are omitted; without the second, they are
shown but not spoken. Nothing else changes either way.

### Being embedded

`?embed=1` renders the map as a figure inside someone else's page: no site nav,
no settings panel, and no theme or language toggles, since those belong to
whoever owns the window. It opens on a composed shot of the Nordbahnviertel
(`lib/map-camera.ts`) with places on, and on a touch screen it takes two fingers
to pan so the host page can still be scrolled.

`EMBED_PARENTS` is the origins allowed to frame it and drive it — anything else
is ignored:

```
EMBED_PARENTS=http://localhost:3000,https://nenadmarinkovic.com
```

Over that channel the host pushes the theme in, and the map publishes its layer
controls out — keys, labels, hints and current state, already localised — so the
host can draw them in its own type and toggle them back. Leave the variable
unset and the map still draws, but it neither follows the host's theme nor
offers it anything to draw. The host has to list this app in its own
`EMBED_APPS` for the reverse direction.

### What the open endpoints can spend

Three routes reach a paid API on behalf of anyone who calls them, with no account
and no key: `/api/place` writes through to Mistral, `/api/place/audio` to
ElevenLabs, `/api/place/chat` to Mistral again. A public map cannot ask visitors
to sign in, so the limits are the only thing standing between a curious stranger
and the bill.

**The rate limiter keys on the client IP, per route.** It used to be one bucket
per address for the whole app, which had it backwards twice over: browsing places
ate the contact form's allowance, and the cheapest call and the most expensive
one shared a budget. Now each route names its own scope — 20 place descriptions a
minute, 8 chat turns, 5 syntheses, 5 contact messages, and the departure board
keeps its own. Spoofing `X-Forwarded-For` does not buy a fresh bucket: the
reverse proxy replaces the header before Next sees it, so the first entry is the
real client either way.

**A per-IP limit cannot protect a monthly quota, though**, and the ElevenLabs
free tier is 10,000 credits a month against one credit per character on
`eleven_multilingual_v2`. A description runs about 300 characters with the name
in front of it, so **the whole month is roughly thirty clips** — one enthusiastic
visitor, never mind an unfriendly one. So `data/speech-budget.json` counts
characters against the calendar month and `speak()` refuses before it opens the
connection. The default ceiling is 9,000, under the free tier with room for the
count to drift; `ELEVENLABS_MONTHLY_CHARS` raises it on a paid plan. The month is
the calendar one, not the billing one, so a plan that renews mid-month resets
late rather than early. The ingest only clears `.cache/ingest`, so the ledger and
the clips beside it survive the nightly rebuild.

**`data/audio` is capped at 128 MB, and refuses rather than evicts.** Eviction is
the usual answer and it is the wrong one here: a cached clip is free to serve
forever, and throwing one away to make room spends credits re-reading a
description that was already paid for. On the free tier the monthly ceiling binds
first regardless — thirty clips is a couple of megabytes — so the cap is a
backstop for the day the plan changes.

**The chat no longer takes the summary from the request.** It used to accept 400
characters from the client and interpolate them into the system prompt, which is
a system prompt the caller can write. The server has that text already, keyed by
the same name, kind and language, so it reads its own cache instead. `kind` has
to look like a category — letters, spaces and `&'.-` — and anything else falls
back to `place` rather than travelling into the prompt.

**What is left is the place name.** It comes from Mapbox vector tiles, not from
any list this app holds, so there is nothing to check it against — 120 characters
still reach the prompt, minus the quote marks that made escaping the surrounding
sentence easy. That is a foothold rather than an open door, and the honest
mitigation is not in the code: Mistral carries a monthly spend cap set in its
console, which is what actually bounds the worst case.

### Keeping the timetable fresh

`npm run ingest` builds a static snapshot of **one service day**, so this is a
daily job, not a weekly one — and the app must be restarted afterwards:

```
# the shape of it — refresh the timetable, then restart
0 4 * * * cd /srv/bim && npm run ingest && systemctl restart bim
```

Four in the morning because the artifact covers its own date plus the night
runs spilling past midnight, which end around five. Rebuilding before then
replaces it while it is still serving correctly, and the new build carries the
same night runs forward.

`deploy/` has this as a systemd timer instead, which is what the VPS runs: the
journal keeps the output, `Persistent=true` catches a run missed while the
machine was down, and a failure is visible in `systemctl status` rather than in
a mail spool nobody reads.

```bash
cp deploy/bim-ingest.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bim-ingest.timer
systemctl start bim-ingest.service    # prove it works now, not at 04:00
```

The unit runs as root because `ExecStartPost` restarts the service, and drops to
the app user with `setpriv` for the ingest itself. `ExecStartPost` only fires on
success, so a failed ingest never restarts the app onto whatever it left behind.
Node has to be on a minimal `PATH`, so install it system-wide rather than under
nvm — a login shell's `PATH` is not what the unit gets.

A failed ingest is quiet by default — the map simply goes empty the next morning
— so `deploy/bim-alert@.service` mails the status and the last sixty journal
lines when a unit fails. Wire it up by adding one line to the `[Unit]` section of
whatever should report:

```ini
OnFailure=bim-alert@%n.service
```

The addresses live in the unit, not in the script — `BIM_ALERT_TO` for the
destination and `BIM_ALERT_FROM` for the sender — so the repo carries no personal
address and the VPS copy under `/etc/systemd/system/` is the only place they
appear. `alert.sh` refuses to run rather than mailing nowhere if `BIM_ALERT_TO`
is unset.

Sending needs a relay of its own: Proton has no plain SMTP outside Business, so
the destination can be a Proton address while the relay is a separate account.
`deploy/msmtprc.example` is the `msmtp` side of it, on port 587 — Hetzner blocks
outbound 25 by default. `BIM_ALERT_FROM` has to be a sender that relay allows, or
it will be rejected downstream.

`deploy/ingest.sh` retries three times before giving up, clearing `.cache/ingest`
between attempts. The retry is not just for flaky networks: `fetchCached` judges
freshness by mtime alone, so an interrupted download leaves a truncated file that
counts as fresh for twelve hours and fails the same way on every run inside that
window. Clearing the cache is what breaks the loop. (`Restart=` is no use here —
systemd does not accept it on a `Type=oneshot` unit.)

The restart is not optional. `lib/vehicles/schedule.ts` and
`app/api/stops/route.ts` both memoise their parse in module scope for the life of
the process, so re-ingesting without restarting leaves the old timetable serving.
Restarting also drops the in-process place-description cache, which refills on
demand.

Each artifact is written beside its target and renamed into place, so a run that
dies halfway leaves yesterday's file rather than a truncated one — the next
restart still starts. It does not make the set of them consistent with each
other, though: a failed run can leave a new `schedule.json` beside an old
`shapes.json`, and only a successful rebuild puts that right.

#### When the failure email arrives

**You have about an hour.** The mail goes out at 04:00, and the app is still
serving correctly at that moment — it holds yesterday's artifact, which covers
yesterday plus the night runs spilling past midnight. Those end around five, and
`checkFreshness` starts returning 503 the moment the clock passes the last
departure it knows about. So a fix before roughly 05:00 is invisible to anyone
using the map; after that it is an empty map with an error on it.

Read what actually happened first — the mail carries the last sixty lines, but
the failure is usually further up:

```bash
journalctl -u bim-ingest.service -n 200 --no-pager
```

Four causes account for nearly all of it:

- **An upstream moved or fell over.** `fetchCached` throws `responded 404` or
  `responded 5xx` with the URL in the message. A 5xx is usually transient and the
  three retries have already lost that argument, so try again by hand. A 404 is
  structural — a feed moved. `oebbZips` already tries the neighbouring timetable
  year, so a logged `missing GTFS_Fahrplan_….zip` followed by success is the
  fallback working, not a fault.
- **A poisoned cache.** Extraction errors — bad zip, unexpected end of file —
  after a download was cut off. `ingest.sh` clears `.cache/ingest` between its
  own attempts, so seeing this means all three failed; clear it and run again.
- **Disk.** `ENOSPC`, or a truncated write near the end. `data/` is ~42 MB and
  `.cache/` grows to a few hundred MB; `rm -rf .cache/ingest` is always safe.
- **Node is missing.** `npm: command not found`, or a syntax error from the
  TypeScript entry point, which means a Node older than 22.6. Only ever seen
  after someone changes how Node is installed, since the unit's `PATH` is bare.

Then rerun the whole thing, which restarts the app on success exactly as the
timer would:

```bash
systemctl start bim-ingest.service
```

Confirm it took, rather than assuming — the date has to be today's:

```bash
node -e 'console.log(require("/srv/bim/data/ingest-report.json").schedule)'
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/vehicles
```

A 200 with today's date is the end of it. A 503 that says the service day is over
means the app is still holding the old parse, so the restart did not happen —
check `ExecStartPost` in the journal.

One thing not to do: restarting `bim.service` on its own does not help. It
re-reads the same artifact and buys nothing, and if an ingest is running it can
read a half-swapped `data/`. Fix the ingest, and let it do the restart.

If the upstream is simply down and staying down, there is nothing to fail over
to — the artifact is the only source of positions. The map will 503 from five in
the morning until a rebuild succeeds.

#### The same job on a development machine

A laptop is asleep at four in the morning, and `cron` skips an entry whose time
passed while it was — it does not catch up on wake, so the morning after is a
stale artifact and a 503. On macOS, `launchd` defers a missed
`StartCalendarInterval` and runs it once the machine wakes, which is the
behaviour this job wants. In `~/Library/LaunchAgents/dev.bim.ingest.plist`:

```xml
<key>ProgramArguments</key>
<array>
  <string>/bin/zsh</string>
  <string>-c</string>
  <string>export PATH="$(ls -d "$HOME"/.nvm/versions/node/*/bin | sort -V | tail -1):/usr/bin:/bin"; npm run ingest</string>
</array>
<key>WorkingDirectory</key>
<string>~/Development/bim</string>
<key>StartCalendarInterval</key>
<dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
```

`launchd` starts with a bare environment, so an nvm-managed `node` has to be put
on `PATH` by the job itself. `zsh -lc` does not do it: a non-interactive login
shell reads `.zprofile` but not `.zshrc`, which is where nvm initialises.
Resolving the newest `~/.nvm/versions/node/*/bin` keeps working across nvm
upgrades. Load it with `launchctl bootstrap gui/$(id -u) <plist>`, and fire it
once with `launchctl kickstart -p gui/$(id -u)/dev.bim.ingest` — a `PATH`
mistake otherwise stays invisible until it fails at four in the morning.

Unlike the server job this one only ingests, leaving the restart out. A dev
server is owned by the terminal it was started in, and a scheduled restart would
kill it, orphan its logs and risk a port conflict with nobody watching. Nothing
is silently wrong in the meantime: a process holding yesterday's parse fails
loudly through `checkFreshness` in `lib/vehicles/feed.ts`, and any fresh
`npm run dev` picks up the new artifact anyway.
