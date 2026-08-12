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
    linesHint:
      "Die Linie, auf der ein Fahrzeug unterwegs ist, daneben notiert.",
    stops: "Haltestellen",
    stopsHint: "Alle Haltestellen und Stationen im Netz.",
    places: "Orte",
    placesHint:
      "Sehenswürdigkeiten und markante Orte, jeweils mit Beschreibung.",
    streets: "Straßen",
    streetsHint: "Straßennamen auf der Grundkarte.",
    districts: "Bezirke",
    districtsHint: "Die 23 Bezirke, umrandet und eingefärbt.",
    bikes: "Radwege",
    bikesHint:
      "Radwege und Radfahrstreifen durchgezogen, gemischte und beruhigte Straßen gestrichelt.",
    zones: "Fußgängerzonen",
    zonesHint:
      "Straßen, die den Zufußgehenden gehören — die meisten davon stundenweise.",
    roadworks: "Baustellen",
    roadworksHint:
      "Offene Baustellen im Straßenraum, mit dem Tag, an dem sie geräumt sein sollen.",
    fountains: "Trinkbrunnen",
    fountainsHint:
      "Öffentliches Trinkwasser, die mit Tränke für Hunde gekennzeichnet.",
    toilets: "Öffentliche WCs",
    toiletsHint: "WCs der Stadt, darunter die barrierefreien und die Pissoirs.",
    theme: "Theme",
    language: "Sprache",
  },

  exits: {
    show: "Ausgänge auf der Karte zeigen",
    count: "{count} Ausgänge",
    withStepFree: "{count} Ausgänge · {stepFree} barrierefrei",
    stepFree: "Barrierefreier Zugang",
  },

  theme: {
    label: "Theme",
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
    close: "Menü schließen",
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
      "Wiener Linien veröffentlicht nicht, wo seine Fahrzeuge sind. Jedes Fahrzeug hier ist deshalb eine Schätzung.",
    title: "Bim",
    subtitle: "Inoffizielle Live-Karte der Wiener Öffis.",
    lead: "Ein Fahrzeug startet auf seinem Fahrplan. Nahe Haltestellen melden die Verspätung, also verschiebt es sich. Dann gleitet es entlang der echten Gleise.",
    accuracy:
      "Das stimmt auf etwa eine Haltestelle genau. Bei der U-Bahn beinahe exakt. Bei einer Straßenbahn im Verkehr ungenauer.",
    trustTitle: "Wie verlässlich ist ein Fahrzeug",
    trustBody:
      "Nur ein Teil des Netzes meldet Abfahrten. Klicken Sie ein Fahrzeug an, und Sie sehen, worauf es fährt: auf einer Messung an der Haltestelle, auf einer Schätzung dazwischen oder allein auf dem Fahrplan.",
    trustSbahn:
      "Die S-Bahn fährt die ÖBB, die nichts Live veröffentlicht. Diese Züge folgen immer dem Fahrplan.",
    exploreTitle: "Was Sie sonst tun können",
    exploreBody:
      "Klicken Sie eine Station an: nächste Abfahrten und Zugänge, stufenlose sind markiert. Tippen Sie eine Linie an, um ihren Weg zu verfolgen. Klicken Sie ein Fahrzeug an, um seine Route zu zeichnen und ihm zu folgen.",
    exploreLayers:
      "Die Einstellungen bringen den Rest der Stadt: Bezirke, Radwege, Fußgängerzonen, Baustellen, Trinkbrunnen und öffentliche WC-Anlagen. Zu Sehenswürdigkeiten gibt es eine kurze Beschreibung zum Anhören oder Nachfragen.",
    dataNote:
      "Abfahrten und Linien aus den offenen Daten der Wiener Linien, die S-Bahn von den ÖBB. Gleisgeometrie aus einer GTFS-Konvertierung der Community (CC BY 4.0). Die Stadt-Ebenen von der Stadt Wien. Stationszugänge aus OpenStreetMap (ODbL).",
    purpose:
      "Bim zeigt das Netz. Es plant keine Fahrten und steht in keiner Verbindung zu Wiener Linien.",
    openSource: "Open-Source-Projekt",
    projectBy: "von",
  },
};
