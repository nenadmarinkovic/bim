// The English dictionary is the shape every other locale is checked against.
// Plain data only: it crosses the server/client boundary as part of the RSC
// payload, where a function would not survive.
export const en = {
  meta: {
    title: "Bim — live transit map for Vienna",
    description:
      "An unofficial live map of the Wiener Linien network, built on open data.",
  },

  header: {
    tagline: "Live transit map for Vienna",
  },

  count: {
    loading: "Loading live positions…",
    moving: { one: "{n} vehicle moving", other: "{n} vehicles moving" },
    estimated: "{n} estimated",
  },

  map: {
    tokenMissing: "Mapbox token missing.",
    tokenAddBefore: "Add ",
    tokenAddBetween: " to ",
    tokenAddAfter: " and restart the dev server.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    alignNorth: "Align north",
    centre: "Centre on Stephansdom",
    dataSources: "Data sources",
    improve: "Improve this map",
    routeStart: "Start",
  },

  settings: {
    lines: "Line numbers",
    stops: "Stops",
    places: "Places",
    streets: "Streets",
    districts: "Districts",
    theme: "Theme",
    language: "Language",
  },

  exits: {
    show: "Show exits on the map",
    count: "{count} exits",
    withStepFree: "{count} exits · {stepFree} step-free",
    stepFree: "Step-free entrance",
  },

  theme: {
    label: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  vehicle: {
    onTime: "on time",
    late: "{n} min late",
    early: "{n} min early",
    lessThanOne: "<1",
    measured: "measured at this stop",
    interpolated: {
      one: "interpolated, {n} stop from a measured one",
      other: "interpolated, {n} stops from a measured one",
    },
    scheduled: "timetable only — no live data",
    inTunnel: "in tunnel",
    showRoute: "Show route",
    hideRoute: "Hide route",
    follow: "Follow",
    unfollow: "Stop following",
  },

  stop: {
    modes: {
      metro: "U-Bahn",
      train: "S-Bahn",
      tram: "Tram",
      bus: "Bus",
    },
    minutes: "min",
    trace: "Trace the {line} to {towards}",
    untrace: "Hide the {line} to {towards}",
    now: "now",
    noDepartures: "No departures right now.",
    departures: "Departures",
    unavailable: "Departures unavailable.",
    reading: "Reading the board…",
    tapToTrace: "Tap a line to trace it",
    tapToTraceFaded: "Tap a line to trace it · faded = timetable only",
    operator: "Wiener Linien",
    drawFailed: "{name} — could not draw the board.",
  },

  place: {
    lookingUp: "Looking up…",
    landmark: "Landmark",
    place: "Place",
    listen: "Listen",
    noAudio: "No audio for this one",
    aiSummary: "AI summary",
    askMore: "Ask more",
  },

  chat: {
    prompt: "What would you like to know more about?",
    openers: ["Who built it?", "What was here before?", "Why does it matter?"],
    thinking: "Thinking…",
    failed: "Could not answer that one. Try again?",
    placeholder: "Ask about this place…",
    ariaAsk: "Ask about this place",
    send: "Send",
    disclaimer:
      "Written by Mistral AI — it can be wrong about dates and details.",
  },

  search: {
    open: "Find a station",
    openWithKey: "Find a station  (⌘F)",
    description: "Search the Wiener Linien network by station name.",
    loadingStations: "Loading stations…",
    searchStations: "Search stations…",
    nothingMatching: "Nothing matching",
    recent: "Recent",
    clear: "Clear",
    readingNetwork: "Reading the network…",
    typeName: "Type a station name.",
    results: { one: "{n} station", other: "{n} stations" },
    hintOpen: "open",
  },

  nav: {
    about: "About",
    contribute: "Contribute",
  },

  contact: {
    email: "Your email",
    emailPlaceholder: "so I can reply",
    message: "Message",
    messagePlaceholder: "What is wrong, or what would you like to know?",
    send: "Send",
    sending: "Sending…",
    sent: "Thanks — got it. I will reply to the address you gave.",
    errors: {
      email: "That address does not look right. Could you check it?",
      message: "A few more words would help.",
      rate: "That is a few messages in a minute. Try again in a moment.",
      unconfigured:
        "Sending is not set up yet. A GitHub issue works in the meantime.",
      failed: "That did not go through. Try again, or open a GitHub issue.",
    },
  },
  contribute: {
    title: "Contribute",
    subtitle: "Bim is open source. You do not need to write code to help.",
    lead: "If something on the map looks wrong, or a station is missing a detail, you can fix it yourself — or just tell me.",
    osmTitle: "Add a station entrance",
    osmBody:
      "The station doors on this map come from OpenStreetMap: what they are called, and whether you can get in without stairs. Plenty are still missing. If you know one, you can add it there, and it shows up here the next time the data is rebuilt.",
    codeTitle: "Report something wrong",
    codeBody:
      "A departure that does not match the platform, a station in the wrong place, anything that looks off. GitHub is the best place for it.",
    writeTitle: "Write to me",
    askBody: "Questions are welcome. So is telling me I got something wrong.",
    openIssues: "Open an issue",
    editOsm: "Edit in OpenStreetMap",
  },

  about: {
    moreInfo: "More about me and other projects:",
    howTitle: "How a vehicle gets placed",
    dataTitle: "Where the data comes from",
    title: "Bim",
    subtitle: "Unofficial live map of the Wiener Linien network.",
    lead: "Wiener Linien publishes no vehicle positions. Every tram, bus and U-Bahn here is placed by taking its timetable, bending it by the delay reported at nearby stops, and sliding it along the real track geometry.",
    purpose:
      "Bim is an observatory for the network rather than a trip planner. It is built on Wiener Linien’s open data and is not affiliated with them.",
    trustTitle: "How much to trust a vehicle",
    trustBody:
      "It varies. Wiener Linien only measures departures at part of the network. Click any vehicle to see whether its position was just measured at a stop, interpolated between reporting stops, or is running on the timetable alone.",
    accuracy:
      "Positions are accurate to roughly one stop-to-stop segment: near exact on the U-Bahn, looser for a tram in traffic.",
    dataNote:
      "Data from Wiener Linien and Stadt Wien open data, with track geometry from a community GTFS conversion (CC BY 4.0).",
    openSource: "Open-source",
    projectBy: "project by",
  },
};

export type Dictionary = typeof en;
