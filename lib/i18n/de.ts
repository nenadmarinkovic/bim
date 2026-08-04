import type { Dictionary } from "./en";

export const de: Dictionary = {
  meta: {
    title: "Bim — Live-Verkehrskarte für Wien",
    description:
      "Eine inoffizielle Live-Karte des Wiener-Linien-Netzes, auf Basis offener Daten.",
  },

  header: {
    tagline: "Live-Verkehrskarte für Wien",
  },

  count: {
    drawing: "Das Netz wird gezeichnet…",
    redrawing: "Wird neu gezeichnet…",
    stations: "Das Netz wird geladen…",
    loading: "Live-Positionen werden geladen…",
    moving: { one: "{n} Fahrzeug unterwegs", other: "{n} Fahrzeuge unterwegs" },
    estimated: "{n} geschätzt",
  },

  map: {
    tokenMissing: "Mapbox-Token fehlt.",
    tokenAddBefore: "",
    tokenAddBetween: " in ",
    tokenAddAfter: " eintragen und den Dev-Server neu starten.",
    zoomIn: "Vergrößern",
    zoomOut: "Verkleinern",
    alignNorth: "Nach Norden ausrichten",

    centre: "Auf den Stephansdom zentrieren",
    dataSources: "Datenquellen",
    improve: "Diese Karte verbessern",
    routeStart: "Start",
    loading: "Karte wird geladen…",
  },

  settings: {
    groupContext: "Auf der Karte",
    clearAll: "Alle aus",
    groupApp: "Einstellungen",
    lines: "Liniennummern",
    linesHint: "Die Linie, auf der ein Fahrzeug unterwegs ist, daneben notiert",
    stops: "Haltestellen",
    stopsHint: "Alle Haltestellen und Stationen im Netz",
    places: "Orte",
    placesHint:
      "Sehenswürdigkeiten und markante Orte, jeweils mit Beschreibung",
    streets: "Straßen",
    streetsHint: "Straßennamen auf der Grundkarte",
    districts: "Bezirke",
    districtsHint: "Die 23 Bezirke, umrandet und eingefärbt",
    bikes: "Radwege",
    bikesHint:
      "Radwege und Radfahrstreifen durchgezogen, gemischte und beruhigte Straßen gestrichelt",
    zones: "Fußgängerzonen",
    zonesHint:
      "Straßen, die den Zufußgehenden gehören — die meisten davon stundenweise",
    roadworks: "Baustellen",
    roadworksHint:
      "Offene Baustellen im Straßenraum, mit dem Tag, an dem sie geräumt sein sollen",
    fountains: "Trinkbrunnen",
    fountainsHint:
      "Öffentliches Trinkwasser, die mit Tränke für Hunde gekennzeichnet",
    toilets: "Öffentliche WC-Anlagen",
    toiletsHint:
      "WC-Anlagen der Stadt, darunter die barrierefreien und die Pissoirs",
    theme: "Design",
    language: "Sprache",
  },

  exits: {
    show: "Ausgänge auf der Karte zeigen",
    count: "{count} Ausgänge",
    withStepFree: "{count} Ausgänge · {stepFree} barrierefrei",
    stepFree: "Barrierefreier Zugang",
  },

  theme: {
    label: "Design",
    system: "System",
    light: "Hell",
    dark: "Dunkel",
  },

  vehicle: {
    onTime: "pünktlich",
    late: "{n} Min. Verspätung",
    early: "{n} Min. zu früh",
    lessThanOne: "<1",
    measured: "an dieser Haltestelle gemessen",
    interpolated: {
      one: "interpoliert, {n} Haltestelle von einer Messung entfernt",
      other: "interpoliert, {n} Haltestellen von einer Messung entfernt",
    },
    scheduled: "nur Fahrplan — keine Echtzeitdaten",
    inTunnel: "im Tunnel",
    showRoute: "Route anzeigen",
    hideRoute: "Route ausblenden",
    follow: "Folgen",
    unfollow: "Nicht mehr folgen",
  },

  stop: {
    modes: {
      metro: "U-Bahn",
      train: "S-Bahn",
      tram: "Straßenbahn",
      bus: "Bus",
    },
    minutes: "Min.",
    trace: "Die {line} Richtung {towards} nachzeichnen",
    untrace: "Die {line} Richtung {towards} ausblenden",
    now: "jetzt",
    noDepartures: "Derzeit keine Abfahrten.",
    departures: "Abfahrten",
    unavailable: "Abfahrten nicht verfügbar.",
    reading: "Anzeige wird gelesen…",
    tapToTrace: "Linie antippen, um sie nachzuzeichnen",
    tapToTraceFaded:
      "Linie antippen, um sie nachzuzeichnen · blass = nur Fahrplan",
    operator: "Wiener Linien",
    drawFailed: "Nachzeichnen fehlgeschlagen",
  },

  place: {
    lookingUp: "Wird nachgeschlagen…",
    landmark: "Sehenswürdigkeit",
    place: "Ort",
    listen: "Anhören",
    noAudio: "Dafür gibt es keine Tonaufnahme",
    aiSummary: "KI-Zusammenfassung",
    askMore: "Mehr dazu",
  },

  chat: {
    prompt: "Worüber möchten Sie mehr wissen?",
    openers: [
      "Wer hat es gebaut?",
      "Was war vorher hier?",
      "Warum ist es bedeutend?",
    ],
    thinking: "Denkt nach…",
    failed: "Das konnte nicht beantwortet werden. Noch einmal versuchen?",
    placeholder: "Fragen Sie zu diesem Ort…",
    ariaAsk: "Zu diesem Ort fragen",
    send: "Senden",
    disclaimer:
      "Verfasst von Mistral AI — Daten und Details können falsch sein.",
  },

  search: {
    open: "Station suchen",
    openWithKey: "Station suchen  (⌘F)",
    description: "Das Wiener-Linien-Netz nach Stationsnamen durchsuchen.",
    loadingStations: "Stationen werden geladen…",
    searchStations: "Stationen durchsuchen…",
    nothingMatching: "Nichts gefunden für",
    recent: "Zuletzt",
    clear: "Löschen",
    clearQuery: "Suche löschen",
    readingNetwork: "Netz wird gelesen…",
    typeName: "Stationsnamen eingeben.",
    results: { one: "{n} Station", other: "{n} Stationen" },
    hintOpen: "öffnen",
  },

  nav: {
    about: "Über",
    contribute: "Mitmachen",
    menu: "Menü",
    menuHint: "Ebenen und Einstellungen",
    showMap: "Zur Karte",
  },

  contact: {
    email: "Ihre E-Mail",
    emailPlaceholder: "name@beispiel.at",
    message: "Ihre Nachricht",
    messagePlaceholder:
      "Eine falsche Abfahrt, ein fehlender Zugang, eine Frage dazu wie etwas funktioniert…",
    send: "Senden",
    sending: "Wird gesendet…",
    sent: "Danke — angekommen. Ich antworte an die Adresse, die Sie angegeben haben.",
    errors: {
      email: "Diese Adresse sieht nicht richtig aus. Bitte nachschauen?",
      message: "Ein paar Worte mehr wären hilfreich.",
      rate: "Das sind ein paar Nachrichten in einer Minute. Kurz warten, bitte.",
      unconfigured:
        "Das Senden ist noch nicht eingerichtet. Ein GitHub-Issue geht in der Zwischenzeit.",
      failed:
        "Das ist nicht durchgegangen. Noch einmal versuchen, oder ein GitHub-Issue eröffnen.",
    },
  },
  contribute: {
    title: "Mitmachen",
    subtitle:
      "Bim ist Open Source. Man muss nicht programmieren können, um zu helfen.",
    lead: "Wenn auf der Karte etwas falsch aussieht oder einer Station ein Detail fehlt, können Sie es selbst ausbessern — oder es mir einfach sagen.",
    osmTitle: "Einen Stationszugang ergänzen",
    osmBody:
      "Die Zugänge auf dieser Karte kommen aus OpenStreetMap: wie sie heißen, und ob man ohne Stufen hineinkommt. Viele fehlen noch. Wenn Sie einen kennen, können Sie ihn dort eintragen, und beim nächsten Datenlauf ist er hier zu sehen.",
    codeTitle: "Etwas melden, das falsch ist",
    codeBody:
      "Eine Abfahrt, die nicht zum Bahnsteig passt, eine Station an der falschen Stelle, irgendetwas das nicht stimmt. Am besten auf GitHub.",
    writeTitle: "Schreiben Sie mir",
    askBody:
      "Alle Nachrichten sind willkommen, besonders wenn etwas falsch ist oder nicht richtig funktioniert.",
    openIssues: "Issue eröffnen",
    editOsm: "In OpenStreetMap bearbeiten",
  },

  about: {
    howTitle: "Wie ein Fahrzeug platziert wird",
    dataTitle: "Woher die Daten kommen",
    estimate:
      "Jedes Fahrzeug auf dieser Karte ist eine Schätzung, keine Live-Position. Wiener Linien veröffentlicht nicht, wo seine Fahrzeuge sind.",
    moreInfo: "Mehr unter:",
    title: "Bim",
    subtitle: "Inoffizielle Live-Karte des Wiener-Linien-Netzes.",
    lead: "Jedes wird aus seinem Fahrplan gesetzt, um die an nahen Haltestellen gemeldete Verspätung verschoben und entlang der echten Gleisgeometrie bewegt.",
    accuracy:
      "Das trifft auf etwa einen Abschnitt zwischen zwei Haltestellen genau: bei der U-Bahn beinahe exakt, bei einer Straßenbahn im Verkehr ungenauer.",
    trustTitle: "Wie verlässlich ist ein Fahrzeug",
    trustBody:
      "Wiener Linien misst Abfahrten nur an einem Teil des Netzes. Klicken Sie ein Fahrzeug an, um zu sehen, ob seine Position an einer Haltestelle gemessen, zwischen meldenden Haltestellen interpoliert oder allein aus dem Fahrplan abgeleitet wurde.",
    trustSbahn:
      "Die S-Bahn fährt die ÖBB, die dafür keine Live-Daten veröffentlicht. Diese Züge folgen daher immer dem Fahrplan.",
    exploreTitle: "Was Sie sonst tun können",
    exploreBody:
      "Klicken Sie eine Station an, um die nächsten Abfahrten zu lesen, dazu ihre Zugänge und welche davon stufenlos sind. Tippen Sie eine Linie in der Anzeige an, um ihren Weg zu verfolgen. Klicken Sie ein Fahrzeug an, um seine ganze Route zu zeichnen und ihm durch die Stadt zu folgen.",
    exploreLayers:
      "Über die Einstellungen kommt mehr von der Stadt dazu: Bezirke, Radwege, Fußgängerzonen, Baustellen, Trinkbrunnen und öffentliche WC-Anlagen. Zu Sehenswürdigkeiten gibt es eine kurze Beschreibung, die Sie anhören oder zu der Sie nachfragen können.",
    dataNote:
      "Abfahrten und Linien aus den offenen Daten der Wiener Linien, die S-Bahn von den ÖBB. Gleisgeometrie aus einer GTFS-Konvertierung der Community (CC BY 4.0). Bezirke, Radwege, Fußgängerzonen, Baustellen, Trinkbrunnen und öffentliche WC-Anlagen von der Stadt Wien. Stationszugänge aus OpenStreetMap (ODbL).",
    purpose:
      "Bim zeigt das Netz, plant aber keine Fahrten, und steht in keiner Verbindung zu Wiener Linien.",
    openSource: "Open-Source-Projekt",
    projectBy: "von",
  },
};
