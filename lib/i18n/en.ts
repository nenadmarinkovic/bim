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
    drawing: "Drawing the network…",
    redrawing: "Redrawing…",
    stations: "Reading the network…",
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
    loading: "Loading the map…",
  },

  settings: {
    groupContext: "On the map",
    clearAll: "Clear all",
    groupApp: "Settings",
    lines: "Line numbers",
    linesHint: "The line each vehicle is running, drawn beside it",
    stops: "Stops",
    stopsHint: "Every stop and station on the network",
    places: "Places",
    placesHint: "Landmarks and points of interest, each with a description",
    streets: "Streets",
    streetsHint: "Street names on the base map",
    districts: "Districts",
    districtsHint: "The 23 districts, outlined and tinted",
    bikes: "Bike paths",
    bikesHint: "Cycle paths and lanes solid, shared and calmed streets dashed",
    zones: "Pedestrian zones",
    zonesHint: "Streets given over to people on foot, most of them by the hour",
    roadworks: "Roadworks",
    roadworksHint:
      "Open building sites on the street, with the day each one is due to clear",
    fountains: "Drinking fountains",
    fountainsHint:
      "Public drinking water, the ones with a trough marked for dogs",
    toilets: "Public toilets",
    toiletsHint:
      "Council toilets, the step-free ones and the men-only pissoirs among them",
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
    clearQuery: "Clear search",
    readingNetwork: "Reading the network…",
    typeName: "Type a station name.",
    results: { one: "{n} station", other: "{n} stations" },
    hintOpen: "open",
  },

  nav: {
    about: "About",
    contribute: "Contribute",
    menu: "Menu",
    menuHint: "Layers and settings",
    showMap: "Show the map",
  },

  contact: {
    email: "Your email",
    emailPlaceholder: "you@example.com",
    message: "Your message",
    messagePlaceholder:
      "A wrong departure, a missing entrance, a question about how something works…",
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
    askBody:
      "All messages are welcome, especially if something is wrong or does not work properly.",
    openIssues: "Open an issue",
    editOsm: "Edit in OpenStreetMap",
  },

  about: {
    howTitle: "How a vehicle gets placed",
    dataTitle: "Where the data comes from",
    estimate:
      "Every vehicle on this map is an estimate, not a live position. Wiener Linien does not publish where its vehicles are.",
    moreInfo: "For more:",
    title: "Bim",
    subtitle: "Unofficial live map of the Wiener Linien network.",
    lead: "Each one is placed from its timetable, shifted by the delay reported at nearby stops, and slid along the real track geometry.",
    accuracy:
      "That lands within roughly one stop-to-stop segment: near exact on the U-Bahn, looser for a tram in traffic.",
    trustTitle: "How much to trust a vehicle",
    trustBody:
      "Wiener Linien measures departures at only part of the network. Click any vehicle to see whether its position was measured at a stop, interpolated between reporting stops, or is running on the timetable alone.",
    trustSbahn:
      "The S-Bahn is run by ÖBB, which publishes no live data for it, so those trains always follow the timetable.",
    exploreTitle: "What else you can do",
    exploreBody:
      "Click a station to read its next departures, its entrances, and which of them are step-free. Tap a line on the board to trace where it goes. Click a vehicle to draw its whole route and follow it across the city.",
    exploreLayers:
      "The settings panel adds more of the city: districts, bike paths, pedestrian zones, roadworks, drinking fountains and public toilets. Landmarks come with a short written description, which you can listen to or ask about.",
    dataNote:
      "Departures and lines from Wiener Linien open data, the S-Bahn from ÖBB. Track geometry from a community GTFS conversion (CC BY 4.0). Districts, bike paths, pedestrian zones, roadworks, fountains and public toilets from Stadt Wien. Station entrances from OpenStreetMap (ODbL).",
    purpose:
      "Bim shows the network rather than planning journeys, and is not affiliated with Wiener Linien.",
    openSource: "Open-source",
    projectBy: "project by",
  },
};

export type Dictionary = typeof en;
