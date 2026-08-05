import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { styles, theme } from "../styles";
import { SPECIES, DISEASES, getSpecies, getCompatibility, speciesFitsTank, tapHaptic } from "../core";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { HeroBanner } from "../components/HeroBanner";
import { SpeciesCard } from "../components/SpeciesCard";
import { CompareCard } from "../components/CompareCard";
import { EmptyState } from "../components/EmptyState";
import { Pill } from "../components/Pill";
import { t } from "../lib/i18n";

const WATER_FILTERS = [
  { id: "all", label: "All" },
  { id: "fresh", label: "💧 Freshwater" },
  { id: "salt", label: "🌊 Saltwater" },
];
const CARE_OPTS = [["all", "Any"], ["Easy", "Easy"], ["Moderate", "Moderate"], ["Advanced", "Advanced"]];
const TEMP_OPTS = [["all", "Any"], ["peaceful", "Peaceful"], ["semi-aggressive", "Semi"], ["aggressive", "Aggressive"]];
const SIZE_OPTS = [["all", "Any"], ["small", 'Small <3"'], ["medium", 'Medium 3–6"'], ["large", 'Large 6"+']];
const SORT_OPTS = [["default", "Default"], ["name", "Name A–Z"], ["size", "Size ↑"], ["care", "Easiest"]];

const sizeBand = (inches) => (inches < 3 ? "small" : inches <= 6 ? "medium" : "large");
const CARE_RANK = { Easy: 0, Moderate: 1, Advanced: 2 };

// Everything a search query can match — name, what it eats, its kind, water type,
// and its description — so "peaceful salt shrimp" or "algae" finds the right fish.
const haystack = (s) =>
  `${s.name} ${s.diet} ${s.kind} ${s.water === "salt" ? "saltwater marine reef" : "freshwater"} ${s.summary || ""}`.toLowerCase();

export function SpeciesTab({ tankGallons, tank, toggleTank, openSpecies, openDisease, wishlist = [], onToggleWishlist, recent = [], premiumUnlocked = false, freeLimit = 7, onOpenPremium }) {
  const [query, setQuery] = useState("");
  const [water, setWater] = useState("all");
  const [fitsOnly, setFitsOnly] = useState(false);
  const [compatOnly, setCompatOnly] = useState(false);
  const [wishOnly, setWishOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSel, setCompareSel] = useState([]);
  const [care, setCare] = useState("all");
  const [temper, setTemper] = useState("all");
  const [size, setSize] = useState("all");
  const [reefOnly, setReefOnly] = useState(false);
  const [sort, setSort] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  const PAGE = 15;
  const [visible, setVisible] = useState(PAGE);

  const activeCount = (care !== "all" ? 1 : 0) + (temper !== "all" ? 1 : 0) + (size !== "all" ? 1 : 0) + (reefOnly ? 1 : 0);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const filtered = SPECIES.filter((s) => {
      if (water !== "all" && s.water !== water) return false;
      if (wishOnly && !wishlist.includes(s.name)) return false;
      if (fitsOnly && !speciesFitsTank(s, tankGallons)) return false;
      if (compatOnly && tank.length && !tank.includes(s.name) && tank.some((n) => getCompatibility(s.name, n).level === "avoid")) return false;
      if (care !== "all" && s.careLevel !== care) return false;
      if (temper !== "all" && s.temperament !== temper) return false;
      if (size !== "all" && sizeBand(s.adultInches || 0) !== size) return false;
      if (reefOnly && s.reefSafe !== true) return false;
      if (q && !haystack(s).includes(q)) return false;
      return true;
    });
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "size") return [...filtered].sort((a, b) => (a.adultInches || 0) - (b.adultInches || 0));
    if (sort === "care") return [...filtered].sort((a, b) => (CARE_RANK[a.careLevel] ?? 3) - (CARE_RANK[b.careLevel] ?? 3));
    return filtered;
  }, [q, water, wishOnly, fitsOnly, compatOnly, care, temper, size, reefOnly, sort, tankGallons, wishlist, tank]);

  const surprise = () => {
    if (!list.length) return;
    tapHaptic("medium");
    openSpecies(list[Math.floor(Math.random() * list.length)].name);
  };

  const toggleCompare = (name) => {
    tapHaptic("light");
    setCompareSel((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 2) return [prev[1], name]; // keep the most recent two
      return [...prev, name];
    });
  };
  const exitCompare = () => { setCompareMode(false); setCompareSel([]); };
  const onCardPress = (name) => (compareMode ? toggleCompare(name) : openSpecies(name));

  const diseaseMatches = useMemo(() => {
    if (!q) return [];
    return DISEASES.filter((d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
  }, [q]);

  // Reset the visible window whenever the filters/search change.
  useEffect(() => { setVisible(PAGE); }, [q, water, wishOnly, fitsOnly, compatOnly, care, temper, size, reefOnly]);

  // How many cards actually render. Free accounts see a fixed preview no matter
  // how they search or filter, so the cap can't be paged or filtered around.
  const shown = premiumUnlocked ? Math.min(visible, list.length) : Math.min(freeLimit, list.length);

  const resetFilters = () => { setCare("all"); setTemper("all"); setSize("all"); setReefOnly(false); };

  const FilterRow = ({ label, opts, value, onChange }) => (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "900", marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {opts.map(([id, lab]) => (
          <Pill key={id} label={String(lab)} active={value === id} onPress={() => onChange(id)} />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <HeroBanner
        eyebrow={t("species.eyebrow", { count: SPECIES.length })}
        title={t("species.title")}
        subtitle={t("species.sub")}
        emoji="🐟"
        colors={["#123a5e", "#0c2a45", "#071d2e"]}
      />

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: query ? theme.accent : theme.border, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 15, marginRight: 8, opacity: 0.8 }}>🔍</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search species, diet, or description…" placeholderTextColor={theme.secondaryText} style={{ flex: 1, paddingVertical: 13, color: theme.text, fontSize: 15 }} />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={{ color: theme.secondaryText, fontSize: 15, fontWeight: "900", paddingLeft: 6 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingRight: 8 }} keyboardShouldPersistTaps="handled">
        {WATER_FILTERS.map((w) => {
          const on = water === w.id;
          return (
            <Pressable key={w.id} onPress={() => { tapHaptic(); setWater(w.id); }} style={[styles.pill, pillStyle(on)]} accessibilityRole="button">
              <Text style={pillText(on)}>{w.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => { tapHaptic(); setFitsOnly((v) => !v); }} style={[styles.pill, pillStyle(fitsOnly)]} accessibilityRole="button">
          <Text style={pillText(fitsOnly)}>🎯 Fits my {tankGallons} gal</Text>
        </Pressable>
        {tank.length ? (
          <Pressable onPress={() => { tapHaptic(); setCompatOnly((v) => !v); }} style={[styles.pill, pillStyle(compatOnly)]} accessibilityRole="button">
            <Text style={pillText(compatOnly)}>🤝 Fits my stock</Text>
          </Pressable>
        ) : null}
        {wishlist.length ? (
          <Pressable onPress={() => { tapHaptic(); setWishOnly((v) => !v); }} style={[styles.pill, pillStyle(wishOnly)]} accessibilityRole="button">
            <Text style={pillText(wishOnly)}>❤️ Wishlist ({wishlist.length})</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => { tapHaptic(); setShowFilters((v) => !v); }} style={[styles.pill, pillStyle(activeCount > 0)]} accessibilityRole="button">
          <Text style={pillText(activeCount > 0)}>⚙ Filters{activeCount ? ` (${activeCount})` : ""} {showFilters ? "▲" : "▾"}</Text>
        </Pressable>
        <Pressable onPress={surprise} disabled={!list.length} style={[styles.pill, pillStyle(false), !list.length && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Show a random species">
          <Text style={pillText(false)}>🎲 Surprise me</Text>
        </Pressable>
        <Pressable onPress={() => { tapHaptic(); compareMode ? exitCompare() : setCompareMode(true); }} style={[styles.pill, pillStyle(compareMode)]} accessibilityRole="button">
          <Text style={pillText(compareMode)}>⚖️ Compare{compareMode ? " ✕" : ""}</Text>
        </Pressable>
      </ScrollView>

      {compareMode ? (
        <View style={{ marginTop: 12 }}>
          {compareSel.length === 2 ? (
            <CompareCard a={compareSel[0]} b={compareSel[1]} />
          ) : (
            <View style={[styles.card, { marginBottom: 0 }]}>
              <Text style={styles.cardEyebrow}>⚖️ Compare mode</Text>
              <Text style={styles.cardText}>Tap {2 - compareSel.length} more species below to compare them side by side.{compareSel.length ? ` Selected: ${compareSel.join(", ")}.` : ""}</Text>
            </View>
          )}
        </View>
      ) : null}

      {showFilters ? (
        <View style={[styles.card, { marginTop: 12 }]}>
          <FilterRow label="SORT BY" opts={SORT_OPTS} value={sort} onChange={setSort} />
          <FilterRow label="CARE LEVEL" opts={CARE_OPTS} value={care} onChange={setCare} />
          <FilterRow label="TEMPERAMENT" opts={TEMP_OPTS} value={temper} onChange={setTemper} />
          <FilterRow label="ADULT SIZE" opts={SIZE_OPTS} value={size} onChange={setSize} />
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => { tapHaptic("light"); setReefOnly((v) => !v); }} style={[styles.pill, pillStyle(reefOnly)]} accessibilityRole="button">
              <Text style={pillText(reefOnly)}>🪸 Reef-safe only</Text>
            </Pressable>
            {activeCount ? (
              <Pressable onPress={() => { tapHaptic(); resetFilters(); }} accessibilityRole="button">
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "900" }}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!compareMode && !q && recent.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "900", marginBottom: 6 }}>🕘 RECENTLY VIEWED</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {recent.map((n) => {
              const sp = getSpecies(n);
              if (!sp) return null;
              return (
                <Pressable key={n} onPress={() => openSpecies(n)} style={[styles.pill, { paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.05)", borderColor: theme.border }]} accessibilityRole="button">
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: "800" }}>{sp.emoji} {n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {diseaseMatches.length && openDisease ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 8 }]}>🩺 Health guides</Text>
          {diseaseMatches.map((d) => (
            <Pressable key={d.name} onPress={() => openDisease(d.name)} style={[styles.cleanRow, { paddingVertical: 10 }]} accessibilityRole="button" accessibilityLabel={`${d.name} guide`}>
              <View style={styles.cleanImageWrap}>
                {getDiseaseImage(d.name) ? (
                  <Image source={getDiseaseImage(d.name)} style={styles.cleanImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.cleanEmoji}>{d.emoji}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanName}>{d.name}</Text>
                <Text style={styles.cleanMeta} numberOfLines={1}>{d.description}</Text>
              </View>
              <Text style={styles.cleanArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[styles.cleanMeta, { marginTop: 12, marginBottom: 10 }]}>
        {list.length ? `Showing ${Math.min(shown, list.length)} of ${list.length} species` : "0 species"}
      </Text>

      {list.slice(0, shown).map((s) => {
        const selected = compareMode && compareSel.includes(s.name);
        return (
          <SpeciesCard
            key={s.name}
            species={s}
            onPress={() => onCardPress(s.name)}
            inTank={tank.includes(s.name)}
            onToggleTank={compareMode ? undefined : () => toggleTank(s.name)}
            inWishlist={wishlist.includes(s.name)}
            onToggleWishlist={compareMode || !onToggleWishlist ? undefined : () => onToggleWishlist(s.name)}
            note={selected ? "⚖️ Selected for compare" : undefined}
          />
        );
      })}
      {!premiumUnlocked && list.length > shown ? (
        // The free preview ends here. Show what's behind the wall rather than
        // just stopping — the number is the pitch.
        <Pressable
          onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }}
          style={({ pressed }) => [styles.card, { marginTop: 6, alignItems: "center" }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Unlock the full species catalog with Premium"
        >
          <Text style={{ fontSize: 30 }}>🔒</Text>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginTop: 10, textAlign: "center" }}>
            {list.length - shown} more species
          </Text>
          <Text style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 19 }}>
            Free accounts preview {freeLimit} species. Unlock all {SPECIES.length} with care guides, compatibility, and wishlist.
          </Text>
          <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "900", marginTop: 12 }}>See Premium 👑</Text>
        </Pressable>
      ) : list.length > shown ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 20, list.length)); }} style={[styles.ghostBtn, { marginTop: 4 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({list.length - shown})</Text>
        </Pressable>
      ) : null}
      {list.length === 0 ? (
        <View style={styles.card}><EmptyState emoji="🔍" title="No matches" subtitle="No species fit those filters. Try loosening one, or reset to see the full catalog." /></View>
      ) : null}
    </ScrollView>
  );
}

const pillStyle = (on) => ({ backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border });
const pillText = (on) => ({ color: on ? "#04202a" : theme.text, fontSize: 12, fontWeight: "900" });
