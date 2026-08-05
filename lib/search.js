// ─────────────────────────────────────────────────────────────────────────────
// Species search that forgives how people actually type.
//
// The old search was `haystack(s).includes(q)` — a raw substring match. With a
// 316-species catalog that fails constantly, and always silently:
//
//   "clown fish"  → nothing (the catalog says "Clownfish")
//   "cory"        → nothing (they're "Bronze Cory", but "corydoras" misses too)
//   "pleco"       → fine, but "plec" and "plecostomus" both miss
//   "neon tetra " → nothing, because of one trailing space
//   "otto"        → nothing (it's "Otocinclus", and everyone says "oto")
//
// A search that returns an empty list for a fish the app definitely has reads
// as a missing species, not a missed match — which is exactly the impression
// that makes someone doubt the catalog.
//
// Three layers, cheapest first:
//   1. normalization — case, punctuation, spacing
//   2. aliases       — what people actually call these fish
//   3. fuzzy         — one-character typos, and only for longer words, since
//                      short queries fuzz into noise
// ─────────────────────────────────────────────────────────────────────────────

// Strip accents, punctuation and repeated spaces so "Endler's" == "endlers".
export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Common names, shop names, abbreviations, and the spellings people reach for.
// Maps a typed term to substrings that should match a species name.
const ALIASES = {
  clownfish: ["clownfish"],
  clown: ["clownfish", "clown goby", "clown loach", "clown pleco", "clown rasbora", "clown killifish"],
  nemo: ["clownfish"],
  dory: ["blue tang"],
  regal: ["blue tang"],
  hippo: ["blue tang"],
  cory: ["cory"],
  corys: ["cory"],
  cories: ["cory"],
  corydoras: ["cory"],
  catfish: ["cory", "catfish", "pleco"],
  plec: ["pleco"],
  plecs: ["pleco"],
  plecos: ["pleco"],
  plecostomus: ["pleco"],
  bn: ["bristlenose"],
  bristlenose: ["bristlenose"],
  oto: ["otocinclus"],
  otto: ["otocinclus"],
  ottos: ["otocinclus"],
  otos: ["otocinclus"],
  shrimp: ["shrimp"],
  rcs: ["cherry shrimp"],
  cherryshrimp: ["cherry shrimp"],
  snail: ["snail"],
  snails: ["snail"],
  nerites: ["nerite"],
  betta: ["betta"],
  bettas: ["betta"],
  siamese: ["betta"],
  fightingfish: ["betta"],
  guppies: ["guppy", "endler"],
  guppy: ["guppy", "endler"],
  mollies: ["molly"],
  platies: ["platy"],
  danios: ["danio"],
  cpd: ["celestial pearl danio"],
  galaxy: ["celestial pearl danio"],
  rasboras: ["rasbora"],
  tetras: ["tetra"],
  barbs: ["barb"],
  loaches: ["loach"],
  gouramis: ["gourami"],
  goldfish: ["goldfish", "oranda", "ryukin", "moor", "shubunkin"],
  cichlids: ["cichlid", "ram", "apistogramma", "kribensis", "acara", "severum", "oscar", "discus"],
  cichlid: ["cichlid", "ram", "apistogramma", "kribensis", "acara"],
  mbuna: ["cichlid"],
  africans: ["cichlid"],
  ram: ["ram"],
  rams: ["ram"],
  apisto: ["apistogramma"],
  apistos: ["apistogramma"],
  angel: ["angelfish"],
  angels: ["angelfish"],
  tang: ["tang"],
  tangs: ["tang"],
  surgeonfish: ["tang"],
  wrasse: ["wrasse"],
  wrasses: ["wrasse"],
  goby: ["goby", "firefish"],
  gobies: ["goby", "firefish"],
  blenny: ["blenny"],
  blennies: ["blenny"],
  damsel: ["damsel", "chromis"],
  damsels: ["damsel", "chromis"],
  chromis: ["chromis"],
  anthias: ["anthias"],
  puffer: ["puffer"],
  puffers: ["puffer"],
  trigger: ["triggerfish"],
  triggers: ["triggerfish"],
  lionfish: ["lionfish"],
  eel: ["eel"],
  eels: ["eel"],
  coral: ["coral", "polyp", "zoanthid", "acropora", "montipora", "xenia", "mushroom"],
  corals: ["coral", "polyp", "zoanthid", "acropora", "montipora", "xenia", "mushroom"],
  sps: ["acropora", "montipora", "birdsnest", "stylophora", "digitata", "slimer", "hydnophora"],
  lps: ["frogspawn", "hammer", "torch", "candy cane", "acan", "favia", "brain", "bubble", "blastomussa", "duncan"],
  softie: ["mushroom", "leather", "xenia", "kenya", "colt", "polyp", "zoanthid"],
  softies: ["mushroom", "leather", "xenia", "kenya", "colt", "polyp", "zoanthid"],
  zoa: ["zoanthid"],
  zoas: ["zoanthid"],
  paly: ["zoanthid"],
  gsp: ["green star polyp"],
  clam: ["clam"],
  clams: ["clam"],
  anemone: ["anemone"],
  nem: ["anemone"],
  crab: ["crab"],
  crabs: ["crab"],
  hermit: ["hermit"],
  starfish: ["starfish", "star"],
  star: ["starfish", "star"],
  urchin: ["urchin"],
  cuc: ["snail", "crab", "hermit", "shrimp"],
  cleanupcrew: ["snail", "crab", "hermit", "shrimp"],
  algaeeater: ["otocinclus", "pleco", "snail", "shrimp", "blenny", "tang"],
  nano: [],
  schooling: [],
};

// One-edit-distance check, bailing out as soon as a second difference appears.
// Cheap enough to run against every species name on each keystroke.
function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

// Typo tolerance is only applied to words long enough that a single edit still
// means something. Fuzzing 3-letter words matches nearly everything.
const MIN_FUZZY_LENGTH = 5;

function fuzzyHit(token, haystackWords) {
  if (token.length < MIN_FUZZY_LENGTH) return false;
  return haystackWords.some((w) => w.length >= MIN_FUZZY_LENGTH && withinOneEdit(token, w));
}

// Builds the searchable text for one species, once.
export function buildHaystack(s) {
  return normalize(
    [s.name, s.kind, s.water, s.diet, s.temperament, s.careLevel, s.summary].filter(Boolean).join(" ")
  );
}

// Does this species match the query?
//
// Every token must match somehow (AND, not OR) — so "peaceful tetra" narrows
// rather than returning every peaceful fish plus every tetra.
export function matchesQuery(species, rawQuery, haystack) {
  const q = normalize(rawQuery);
  if (!q) return true;

  const hay = haystack || buildHaystack(species);
  const hayWords = hay.split(" ");
  const name = normalize(species.name);

  // Whole-query substring hit is the common case — check it first and cheaply.
  if (hay.includes(q)) return true;

  const tokens = q.split(" ").filter(Boolean);

  return tokens.every((token) => {
    if (hay.includes(token)) return true;

    // "clown fish" typed as two words should still find "Clownfish".
    if (name.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) return true;

    const aliases = ALIASES[token];
    if (aliases && aliases.some((a) => hay.includes(a))) return true;

    // Trailing-s plurals the alias table doesn't cover.
    if (token.endsWith("s") && hay.includes(token.slice(0, -1))) return true;

    return fuzzyHit(token, hayWords);
  });
}

// Ranks matches so the best answer is the first card, not the 30th.
export function scoreMatch(species, rawQuery) {
  const q = normalize(rawQuery);
  if (!q) return 0;
  const name = normalize(species.name);
  if (name === q) return 100;                       // exact name
  if (name.startsWith(q)) return 80;                // "neon" → Neon Tetra
  if (name.includes(q)) return 60;                  // anywhere in the name
  if (name.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) return 50; // "clown fish"
  if (ALIASES[q]) return 40;                        // known common name
  return 10;                                        // matched on summary/traits
}
