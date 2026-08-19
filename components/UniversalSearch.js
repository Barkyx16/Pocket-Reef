import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type } from "../styles";
import { SPECIES, DISEASES, getSpecies, tapHaptic } from "../core";
import { matchesQuery, scoreMatch, buildHaystack, normalize } from "../lib/search";
import { ACTIONS, DESTINATIONS } from "../lib/shortcuts";
import { allTasks, taskStatus, statusLabel } from "../lib/upkeep";
import { ageLabel, warrantyLabel, categoryOf } from "../lib/equipment";
import { kindOf } from "../lib/inventory";
import { forecastItem } from "../lib/inventory";
import { SpeciesThumb } from "./SpeciesThumb";
import { TEXT_LIMITS } from "../lib/textLimits";
import { fmtMoney } from "../lib/format";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// One search box for the whole app, reachable from the header on every screen.
//
// The Species tab already had a good fuzzy search — but only for species, and
// only once you were on the Species tab. Everything else (a disease, a tank,
// a journal entry, the Trends tool, the Profile screen) had to be navigated to
// by memory of where it lives. This searches all of it, and the same forgiving
// matcher the catalog uses handles the typing.
//
// Results are grouped and capped. A flat list of forty hits across five kinds
// of thing is a list you read; grouped and capped, it's a list you scan.
const HAY = new Map(SPECIES.map((s) => [s.name, buildHaystack(s)]));
const CAP = { species: 6, disease: 3, tank: 3, journal: 4, action: 4, destination: 4, upkeep: 4, gear: 4, shelf: 4, note: 4, cost: 4 };

// Actions and destinations match on their own keyword strings, not the fuzzy
// species matcher — "log" should hit the Log tab on the first character, and
// fuzzing a three-letter query against a keyword soup returns everything.
const hits = (item, q) => normalize(`${item.label} ${item.keywords || ""}`).includes(q);

// How well a section's best hit matches, used to order the sections themselves.
//
// Fixed section order looked fine until "ich" — an exact disease name, and the
// most-searched word in the hobby — came back under six cichlids, because
// Species always rendered above Health. Whichever group holds the closest
// match to what was typed goes first.
const RANK = { exact: 4, prefix: 3, word: 2, contains: 1, none: 0 };
function nameRank(name, q) {
  const n = normalize(name);
  if (n === q) return RANK.exact;
  if (n.startsWith(q)) return RANK.prefix;
  if (n.split(" ").some((w) => w === q)) return RANK.word;
  if (n.includes(q)) return RANK.contains;
  return RANK.none;
}
const bestRank = (items, get, q) => items.reduce((best, i) => Math.max(best, nameRank(get(i), q)), RANK.none);

export function UniversalSearch({
  visible, onClose, tanks = [], activeTankId, activeTank = {}, journal = [], recent = [],
  onOpenSpecies, onOpenDisease, onRunAction, onGoToTab, onSwitchTank,
}) {
  const [query, setQuery] = useState("");
  const q = normalize(query);
  // Component scope, not inside the memo — the rows render the live status of
  // each job, so the JSX needs it too.
  const maintenance = activeTank.maintenance || {};

  const results = useMemo(() => {
    if (!q) return null;

    const species = SPECIES
      .filter((s) => matchesQuery(s, q, HAY.get(s.name)))
      .sort((a, b) => scoreMatch(b, q) - scoreMatch(a, q) || a.name.localeCompare(b.name))
      .slice(0, CAP.species);

    const diseases = DISEASES
      .filter((d) => normalize(`${d.name} ${d.description || ""}`).includes(q))
      .slice(0, CAP.disease);

    const tankHits = tanks.filter((tk) => normalize(tk.name).includes(q)).slice(0, CAP.tank);

    // Journal search is the whole reason people keep a journal and then can't
    // use it — "when did I last dose?" was previously answered by scrolling.
    const journalHits = journal
      .filter((e) => normalize(e.text || "").includes(q))
      .slice(0, CAP.journal);

    const actions = ACTIONS.filter((a) => hits(a, q)).slice(0, CAP.action);

    // The tank's own records. Three whole features — upkeep, equipment and the
    // dose log — were unreachable from search, so "skimmer" found nothing even
    // though the tank had both a skimmer job and a skimmer in its equipment.
    const upkeepHits = allTasks(activeTank)
      .filter((t) => normalize(t.label).includes(q))
      .slice(0, CAP.upkeep);

    const gearHits = (activeTank.equipment || [])
      .filter((e) => e && normalize(`${e.name} ${e.brand || ""} ${e.model || ""} ${categoryOf(e.category).label}`).includes(q))
      .slice(0, CAP.gear);
    // Five rounds of features added record types that search had never heard
    // of, so the shelf, the observation log and the ledger were reachable only
    // by remembering which card they live behind. Search is the app's
    // navigation backbone; a record it can't find is a record nobody revisits.
    const shelfHits = (activeTank.inventory || [])
      .filter((i) => i && normalize(`${i.name} ${kindOf(i.kind).label}`).includes(q))
      .slice(0, CAP.shelf);

    // Observations are keyed by species, so each hit carries the animal it
    // belongs to — "spawned" is meaningless without knowing which pair.
    const observationHits = Object.entries(activeTank.observations || {})
      .flatMap(([name, list]) => (list || []).map((o) => ({ ...o, species: name })))
      .filter((o) => normalize(`${o.text} ${o.species}`).includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, CAP.note);

    const costHits = (activeTank.costs || [])
      .filter((c) => c && normalize(`${c.label} ${c.category || ""}`).includes(q))
      .slice(0, CAP.cost);

    const destinations = DESTINATIONS.filter((d) => hits(d, q)).slice(0, CAP.destination);

    // Each group carries the rank of its closest hit, plus a tiebreak that
    // preserves the old order when nothing matches more exactly than anything
    // else. Actions keep a small edge at equal rank: someone typing a verb
    // usually wants to do the thing, not read about it.
    const groups = [
      { key: "actions", title: "Actions", items: actions, tie: 6, rank: bestRank(actions, (a) => a.label, q) },
      { key: "species", title: `Species · ${species.length}`, items: species, tie: 5, rank: bestRank(species, (s) => s.name, q) },
      { key: "health", title: "Health", items: diseases, tie: 4, rank: bestRank(diseases, (d) => d.name, q) },
      { key: "tanks", title: "Tanks", items: tankHits, tie: 3, rank: bestRank(tankHits, (t) => t.name, q) },
      { key: "journal", title: "Journal", items: journalHits, tie: 2, rank: RANK.contains },
      { key: "upkeep", title: "Jobs", items: upkeepHits, tie: 3.5, rank: bestRank(upkeepHits, (t) => t.label, q) },
      { key: "gear", title: "Equipment", items: gearHits, tie: 3.4, rank: bestRank(gearHits, (e) => e.name, q) },
      { key: "shelf", title: "On the shelf", items: shelfHits, tie: 3.3, rank: bestRank(shelfHits, (i) => i.name, q) },
      { key: "notes", title: "Observations", items: observationHits, tie: 2.5, rank: bestRank(observationHits, (o) => o.species, q) },
      { key: "costs", title: "Spending", items: costHits, tie: 2.2, rank: bestRank(costHits, (c) => c.label, q) },
      { key: "goto", title: "Go to", items: destinations, tie: 1, rank: bestRank(destinations, (d) => d.label, q) },
    ];

    const ordered = groups
      .filter((g) => g.items.length)
      .sort((a, b) => b.rank - a.rank || b.tie - a.tie);

    return { groups: ordered, total: groups.reduce((n, g) => n + g.items.length, 0) };
  }, [q, tanks, journal, activeTank]);

  const total = results ? results.total : 0;

  const close = () => { setQuery(""); onClose(); };
  const pick = (fn) => { tapHaptic(); setQuery(""); onClose(); fn(); };

  const recentSpecies = recent.map(getSpecies).filter(Boolean).slice(0, 5);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 54, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.well, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={17} color={theme.accent} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Fish, disease, tank, note or screen…"
              placeholderTextColor={theme.secondaryText}
              returnKeyType="search"
              style={{ flex: 1, color: theme.text, fontSize: type.bodyLg, fontFamily: "Inter_600SemiBold", fontWeight: "600", paddingVertical: 12 }}
              accessibilityLabel="Search everything"
            
            maxLength={TEXT_LIMITS.search}
          />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={theme.secondaryText} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel search">
            <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Done</Text>
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {!q ? (
            <>
              {recentSpecies.length ? (
                <Section title="Recently viewed">
                  {recentSpecies.map((s) => (
                    <Row key={s.name} thumb={s} title={s.name} sub={s.summary} onPress={() => pick(() => onOpenSpecies(s.name))} />
                  ))}
                </Section>
              ) : null}
              <Section title="Do something">
                {ACTIONS.slice(0, 6).map((a) => (
                  <Row key={a.id} icon={a.icon} title={a.label} sub={a.hint} onPress={() => pick(() => onRunAction(a))} />
                ))}
              </Section>
              <Section title="Go to">
                {DESTINATIONS.map((d) => (
                  <Row key={d.id} icon={d.icon} title={d.label} onPress={() => pick(() => onGoToTab(d.id))} />
                ))}
              </Section>
            </>
          ) : total === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 24 }}>
              <Ionicons name="search-outline" size={34} color={theme.secondaryText} />
              <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 12 }}>Nothing matched “{query.trim()}”</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 19 }}>
                Try a common name (“oto”, “nemo”), a symptom (“white spots”), or a screen name.
              </Text>
            </View>
          ) : (
            results.groups.map((g) => (
              <Section key={g.key} title={g.title}>
                {g.key === "actions" && g.items.map((a) => (
                  <Row key={a.id} icon={a.icon} title={a.label} sub={a.hint} onPress={() => pick(() => onRunAction(a))} />
                ))}
                {g.key === "species" && g.items.map((s) => (
                  <Row key={s.name} thumb={s} title={s.name} sub={s.summary} onPress={() => pick(() => onOpenSpecies(s.name))} />
                ))}
                {g.key === "health" && g.items.map((d) => (
                  <Row key={d.name} icon="medkit" title={d.name} sub={d.description} onPress={() => pick(() => onOpenDisease(d.name))} />
                ))}
                {g.key === "tanks" && g.items.map((tk) => (
                  <Row
                    key={tk.id}
                    icon="water"
                    title={`${tk.emoji || "🐠"} ${tk.name}`}
                    sub={tk.id === activeTankId ? "Active tank" : `${(tk.stock || []).length} fish · tap to switch`}
                    onPress={() => pick(() => onSwitchTank(tk.id))}
                  />
                ))}
                {g.key === "journal" && g.items.map((e) => (
                  <Row key={e.id} icon="book" title={e.text} sub={e.date} onPress={() => pick(() => onGoToTab("journal"))} />
                ))}
                {g.key === "upkeep" && g.items.map((t) => (
                  <Row
                    key={t.id}
                    icon="checkmark-circle"
                    title={t.label}
                    sub={statusLabel(taskStatus(t, maintenance))}
                    onPress={() => pick(() => onRunAction({ id: "upkeep", tab: "log", tool: "care" }))}
                  />
                ))}
                {g.key === "gear" && g.items.map((e) => (
                  <Row
                    key={e.id}
                    icon="construct"
                    title={e.name}
                    sub={[ageLabel(e), warrantyLabel(e)].filter(Boolean).join(" · ") || categoryOf(e.category).label}
                    onPress={() => pick(() => onRunAction({ id: "equipment", tab: "tank", card: "equipment" }))}
                  />
                ))}
                {g.key === "shelf" && g.items.map((i) => {
                  const f = forecastItem(i, activeTank, {});
                  return (
                    <Row
                      key={i.id}
                      icon={kindOf(i.kind).icon.replace(/-outline$/, "")}
                      title={i.name}
                      sub={f.headline}
                      onPress={() => pick(() => onRunAction({ id: "inventory", tab: "tank", card: "inventory" }))}
                    />
                  );
                })}
                {g.key === "notes" && g.items.map((o) => (
                  <Row
                    key={o.id}
                    icon="eye"
                    title={o.text || `${o.size} ${o.unit}`}
                    sub={`${o.species} · ${o.date}`}
                    onPress={() => pick(() => onOpenSpecies(o.species))}
                  />
                ))}
                {g.key === "costs" && g.items.map((c) => (
                  <Row
                    key={c.id}
                    icon="cash"
                    title={c.label}
                    sub={`${fmtMoney(c.amount)}${c.category ? ` · ${c.category}` : ""}`}
                    onPress={() => pick(() => onRunAction({ id: "cost", tab: "log", tool: "costs" }))}
                  />
                ))}
                {g.key === "goto" && g.items.map((d) => (
                  <Row key={d.id} icon={d.icon} title={d.label} onPress={() => pick(() => onGoToTab(d.id))} />
                ))}
              </Section>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function Row({ icon, thumb, title, sub, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 10 }, pressed && { opacity: 0.7, borderColor: theme.accent }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {thumb ? (
        <SpeciesThumb species={thumb} size={36} />
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={theme.accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
    </Pressable>
  );
}
