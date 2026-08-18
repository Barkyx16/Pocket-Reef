// ─────────────────────────────────────────────────────────────────────────────
// The shortcut table.
//
// Every fast path in the app — the quick-action sheet, universal search, and
// the tab bar's long-press menus — reads from this one list. Before it existed
// each surface carried its own hand-written copy of "where does 'log a feeding'
// go?", which is how the Log tab's Feeding tool ended up reachable from the
// quick sheet but not from search.
//
// An action is a destination plus an optional *intent*: the tool or card the
// target screen should open on arrival. Landing on the Log tab with the Cycle
// tracker showing when you asked to log a feeding is a shortcut that still
// makes you hunt, which is no shortcut at all.
//
// `run` is for the ones that need no screen: they write the entry and report
// back what they did, so the undo bar can offer to take it back.
// ─────────────────────────────────────────────────────────────────────────────

// tab    — where jumpTo() sends you
// card   — a CollapsibleCard storageKey to force open on arrival
// tool   — a TankToolkitCard tool id to select on arrival
// instant— true when the action completes without leaving the current screen
export const ACTIONS = [
  // ── The analysis surfaces ─────────────────────────────────────────────────
  //
  // These were unreachable by search. Every one lives behind a tool picker or a
  // collapsed card, so finding the algae diagnoser meant already knowing it
  // existed and which of nineteen pills it hides under. Searching "algae",
  // "stability" or "lights" returned nothing at all — the app had grown a great
  // deal of depth and no way to discover any of it.
  {
    id: "stability",
    label: "How steady is my tank?",
    hint: "Grades movement, not just position",
    icon: "analytics",
    keywords: "stability steady swing swinging volatile volatility drift movement consistent alkalinity",
    tab: "log",
    tool: "stability",
  },
  {
    id: "algae",
    label: "Diagnose an algae problem",
    hint: "Worked back from your own readings",
    icon: "leaf",
    keywords: "algae green hair diatom brown dust cyano slime bloom bryopsis black beard gha film",
    tab: "health",
    card: "algae",
  },
  {
    id: "lights",
    label: "Set the light schedule",
    hint: "Photoperiod drives algae as much as nutrients",
    icon: "bulb",
    keywords: "light lights lighting photoperiod schedule timer hours on off ramp par",
    tab: "log",
    tool: "light",
  },
  {
    id: "sourcewater",
    label: "Test my source water",
    hint: "What your tap or RODI puts in",
    icon: "water",
    keywords: "source water tap rodi ro di well filter tds floor ceiling",
    tab: "log",
    tool: "source",
  },
  {
    id: "cadence",
    label: "How often should I test?",
    hint: "An interval per parameter, from your own data",
    icon: "calendar",
    keywords: "how often cadence frequency schedule testing interval often weekly",
    tab: "log",
    tool: "cadence",
  },
  {
    id: "runningcost",
    label: "What does the tank cost to run?",
    hint: "Electricity, per month",
    icon: "flash",
    keywords: "running cost electricity power watts bill monthly energy kwh expensive",
    tab: "log",
    tool: "power",
  },
  {
    id: "medicate",
    label: "Work out a medication dose",
    hint: "Real volume, and the re-dose after a change",
    icon: "medkit",
    keywords: "medication medicine dose dosing treat copper formalin antibiotic ich velvet ml",
    tab: "log",
    tool: "meds",
  },
  {
    id: "import",
    label: "Import readings from a spreadsheet",
    hint: "Bring an existing log with you",
    icon: "download",
    keywords: "import csv spreadsheet excel migrate history existing readings bring",
    tab: "log",
    tool: "import",
  },
  {
    id: "whatif",
    label: "What if I bought my wishlist?",
    hint: "The whole basket, against this tank",
    icon: "sparkles",
    keywords: "what if wishlist simulate buy plan additions basket stocking would",
    tab: "tank",
    card: "whatif",
  },
  {
    id: "vacation",
    label: "Going away — care notes",
    hint: "A sheet for whoever is watching it",
    icon: "airplane",
    keywords: "vacation holiday away travel sitter trip feeding while gone care notes",
    tab: "tank",
    card: "vacation",
  },
  {
    id: "inventory",
    label: "What's on the shelf?",
    hint: "Salt, media and test kits, with run-out dates",
    icon: "cube",
    keywords: "inventory shelf stock salt supplies consumables media test kit run out restock shopping",
    tab: "tank",
    card: "inventory",
  },
  {
    id: "quarantine",
    label: "Quarantine a new arrival",
    hint: "The protocol, not just a countdown",
    icon: "eye",
    keywords: "quarantine qt isolate new arrival observation clearance ich velvet",
    tab: "tank",
    tool: "quarantine",
  },
  {
    id: "fleet",
    label: "Compare my tanks",
    hint: "Which is doing best, and why",
    icon: "albums",
    keywords: "compare tanks fleet versus best worst difference multiple",
    tab: "profile",
    card: "fleet",
  },
  {
    id: "restore",
    label: "Restore from a snapshot",
    hint: "Local backups a bad sync can't reach",
    icon: "time",
    keywords: "restore snapshot backup undo recover rollback lost data revert",
    tab: "profile",
    card: "restore",
  },

  {
    id: "watertest",
    label: "Log a water test",
    hint: "Ammonia, nitrite, nitrate and the rest",
    icon: "flask",
    keywords: "water test parameters ammonia nitrite nitrate ph salinity alkalinity readings chemistry",
    tab: "log",
    card: "watertest",
  },
  {
    id: "feed",
    label: "Log a feeding",
    hint: "Flake, pellet, frozen — one tap",
    icon: "restaurant",
    keywords: "feed feeding food flake pellet frozen veggie live fed",
    tab: "log",
    tool: "feeding",
    instant: true,
  },
  {
    id: "waterchange",
    label: "Log a water change",
    hint: "Records the task and dates a journal note",
    icon: "water",
    keywords: "water change wc percent gallons siphon vacuum",
    tab: "log",
    tool: "change",
    instant: true,
  },
  {
    id: "journal",
    label: "Add a journal note",
    hint: "What happened today",
    icon: "book",
    keywords: "journal note diary entry log write photo mood",
    tab: "journal",
  },
  {
    id: "cost",
    label: "Add a cost",
    hint: "What the hobby is running you",
    icon: "cash",
    keywords: "cost costs money spend spent price budget receipt expense",
    tab: "log",
    tool: "costs",
  },
  {
    id: "maintenance",
    label: "Tick off maintenance",
    hint: "Filter, glass, gravel, media",
    icon: "construct",
    keywords: "maintenance care chores filter glass gravel media clean task",
    tab: "log",
    tool: "care",
  },
  {
    id: "dose",
    label: "Log a dose",
    hint: "Alkalinity, calcium, magnesium",
    icon: "eyedrop",
    keywords: "dose dosing supplement alk alkalinity calcium magnesium ml two part kalk consumption",
    tab: "log",
    card: "doselog",
  },
  {
    id: "upkeep",
    label: "What's due",
    hint: "Socks, skimmer, carbon, probes — everything on a schedule",
    icon: "checkmark-circle",
    keywords: "due upkeep maintenance chores jobs schedule overdue socks skimmer carbon rodi probe pump clean service",
    tab: "log",
    tool: "care",
  },
  {
    id: "equipment",
    label: "My equipment",
    hint: "Heater, pump, skimmer, light — and their warranties",
    icon: "construct",
    keywords: "equipment gear hardware heater pump skimmer light warranty model brand serial kit",
    tab: "tank",
    card: "equipment",
  },
  {
    id: "trends",
    label: "See water trends",
    hint: "Where every parameter is heading",
    icon: "trending-up",
    keywords: "trends graph chart history averages heading forecast",
    tab: "log",
    tool: "trends",
  },
  {
    id: "cycle",
    label: "Check the cycle",
    hint: "How far along the nitrogen cycle is",
    icon: "sync",
    keywords: "cycle cycling nitrogen new tank syndrome ammonia spike",
    tab: "log",
    tool: "cycle",
  },
  {
    id: "addfish",
    label: "Add a fish",
    hint: "Browse the catalog and stock your tank",
    icon: "fish",
    keywords: "add fish species stock browse catalog buy new coral invert",
    tab: "species",
  },
  {
    id: "stock",
    label: "Review my stock",
    hint: "Compatibility, bioload and counts",
    icon: "layers",
    keywords: "stock tank list compatibility bioload counts quantities who lives",
    tab: "tank",
  },
  {
    id: "report",
    label: "Share a tank report",
    hint: "Everything a fish store or forum will ask",
    icon: "document-text",
    keywords: "report share export summary store shop forum help ask diagnose paste print",
    tab: "tank",
    instant: true,
  },
  {
    id: "symptoms",
    label: "Something looks wrong",
    hint: "Symptom checker and disease guides",
    icon: "medkit",
    keywords: "sick ill disease symptom checker ich spots fungus emergency help wrong dying",
    tab: "health",
  },
];

// The five bottom tabs plus everything behind More, as jump targets. Search
// needs these so typing a screen's name goes there, which is the single most
// common thing people try in a search box.
export const DESTINATIONS = [
  { id: "home", label: "Home", icon: "home", keywords: "home dashboard today start" },
  { id: "species", label: "Species", icon: "fish", keywords: "species catalog fish browse list coral invert" },
  { id: "tank", label: "Tank", icon: "water", keywords: "tank stock my aquarium" },
  { id: "log", label: "Log", icon: "flask", keywords: "log tools water tests" },
  { id: "journal", label: "Journal", icon: "book", keywords: "journal diary photos gallery" },
  { id: "health", label: "Health", icon: "medkit", keywords: "health disease illness treatment" },
  { id: "games", label: "Games", icon: "game-controller", keywords: "games play xp quiz fun" },
  { id: "profile", label: "Profile", icon: "person", keywords: "profile account settings stats achievements backup export sync" },
  { id: "premium", label: "Premium", icon: "star", keywords: "premium upgrade subscribe unlock pro paid" },
];

// Per-tab long-press menus. Keyed by tab id, values are ACTION ids — so the
// menu can never drift from what the actions actually do.
export const TAB_SHORTCUTS = {
  // Home keeps a free destination in the list. Its first three all route to
  // premium tabs, so on a free account long-pressing Home was three doors to
  // the same paywall — a shortcut menu that can only sell you something.
  home: ["watertest", "feed", "journal", "addfish"],
  species: ["addfish", "stock", "symptoms"],
  tank: ["stock", "equipment", "report", "addfish"],
  log: ["watertest", "upkeep", "dose", "feed", "waterchange", "trends"],
  more: ["journal", "symptoms", "report"],
};

export const getAction = (id) => ACTIONS.find((a) => a.id === id) || null;

// What the quick-action sheet offers, in the order it offers it. Kept separate
// from ACTIONS so the sheet stays short: a shortcut list long enough to need
// scrolling has stopped being a shortcut.
export const QUICK_ACTION_IDS = ["watertest", "feed", "waterchange", "journal", "addfish", "cost"];
