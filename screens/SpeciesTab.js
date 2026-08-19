import { useEffect, useMemo, useState, memo } from "react";
import { FlatList, Image, ScrollView, Text, TextInput, View, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, useResponsiveLayout, radius, type } from "../styles";
import { SPECIES, DISEASES, getSpecies, getCompatibility, speciesFitsTank, tapHaptic } from "../core";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { HeroBanner } from "../components/HeroBanner";
import { SpeciesCard } from "../components/SpeciesCard";
import { CompareCard } from "../components/CompareCard";
import { EmptyState } from "../components/EmptyState";
import { Pill } from "../components/Pill";
import { t } from "../lib/i18n";
import { usePersistedState } from "../lib/usePersistedState";
import { matchesQuery, scoreMatch, buildHaystack } from "../lib/search";
import { formatVolume } from "../lib/units";
import { TEXT_LIMITS } from "../lib/textLimits";
import { CardBoundary } from "../components/CardBoundary";
import { useScrollToTop } from "../lib/scrollToTop";

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
// Built once for the whole catalog, not per keystroke per species.
const HAY = new Map(SPECIES.map((s) => [s.name, buildHaystack(s)]));


export const SpeciesTab = memo(function SpeciesTab({ tankGallons, tank, toggleTank, openSpecies, openDisease, wishlist = [], onToggleWishlist, recent = [], premiumUnlocked = false, freeLimit = 7, onOpenPremium, tankWater = "fresh" }) {
  const scrollRef = useScrollToTop();
  const [query, setQuery] = useState("");
  // These describe what you're shopping for, so they outlive the screen. Only
  // one tab is mounted at a time, which meant a trip into a species detail and
  // back used to wipe every filter you'd set.
  const oneOf = (opts) => (v) => opts.includes(v);
  const isBool = (v) => typeof v === "boolean";
  // Defaults to the tank you actually keep rather than "all". A reef keeper
  // opening the catalog was met with 174 freshwater fish they cannot put in
  // their tank, every single time — the filter existed but nobody's first
  // action should have to be narrowing 316 results down to the relevant half.
  // Still fully persisted, so changing it sticks.
  const [water, setWater] = usePersistedState("pr_f_water", tankWater, { validate: oneOf(WATER_FILTERS.map((w) => w.id)) });
  const [fitsOnly, setFitsOnly] = usePersistedState("pr_f_fits", false, { validate: isBool });
  const [compatOnly, setCompatOnly] = usePersistedState("pr_f_compat", false, { validate: isBool });
  const [wishOnly, setWishOnly] = usePersistedState("pr_f_wish", false, { validate: isBool });
  const [care, setCare] = usePersistedState("pr_f_care", "all", { validate: oneOf(CARE_OPTS.map((o) => o[0])) });
  const [temper, setTemper] = usePersistedState("pr_f_temper", "all", { validate: oneOf(TEMP_OPTS.map((o) => o[0])) });
  const [size, setSize] = usePersistedState("pr_f_size", "all", { validate: oneOf(SIZE_OPTS.map((o) => o[0])) });
  const [reefOnly, setReefOnly] = usePersistedState("pr_f_reef", false, { validate: isBool });
  const [sort, setSort] = usePersistedState("pr_f_sort", "default", { validate: oneOf(SORT_OPTS.map((o) => o[0])) });
  // Transient: compare mode and the expanded filter drawer are about this
  // visit, not about what you're looking for.
  const [compareMode, setCompareMode] = useState(false);
  const [compareSel, setCompareSel] = useState([]);
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
      if (q && !matchesQuery(s, q, HAY.get(s.name))) return false;
      return true;
    });
    // With a query active, relevance beats alphabetical — an exact name match
    // belongs at the top, not wherever the alphabet puts it.
    if (q) {
      return [...filtered].sort((a, b) => {
        const d = scoreMatch(b, q) - scoreMatch(a, q);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
    }
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
  // Two columns once there's room, matching the card reflow on every other tab.
  const layout = useResponsiveLayout();
  const columns = layout.isLarge ? 2 : 1;

  const resetFilters = () => { setCare("all"); setTemper("all"); setSize("all"); setReefOnly(false); };
  // Everything narrowing the catalog right now, including the pills above the
  // drawer. Persisted filters make this essential: a filter set three sessions
  // ago is invisible unless the screen says so and offers one tap out.
  const narrowing =
    activeCount + (water !== "all" ? 1 : 0) + (fitsOnly ? 1 : 0) + (compatOnly ? 1 : 0) + (wishOnly ? 1 : 0);
  const clearAll = () => {
    tapHaptic("medium");
    resetFilters();
    setWater("all"); setFitsOnly(false); setCompatOnly(false); setWishOnly(false); setSort("default");
  };

  const FilterRow = ({ label, opts, value, onChange }) => (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {opts.map(([id, lab]) => (
          <Pill key={id} label={String(lab)} active={value === id} onPress={() => onChange(id)} />
        ))}
      </View>
    </View>
  );

  // The catalog is virtualized. Previously every visible card was mounted inside
  // a ScrollView — with Premium and "show more" that reached 316 mounted rows,
  // and each keystroke in search re-laid-out all of them. FlatList keeps only
  // what's near the viewport alive; the header holds everything above the list.
  const ListHeader = (
    <View>
      <HeroBanner
        eyebrow={t("species.eyebrow", { count: SPECIES.length })}
        title={t("species.title")}
        subtitle={t("species.sub")}
        emoji="🐟"
        colors={["#123a5e", "#0c2a45", "#071d2e"]}
      />

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: radius.xl, borderWidth: 1, borderColor: query ? theme.accent : theme.border, paddingHorizontal: 14 }}>
        <Ionicons name="search" size={16} color={theme.secondaryText} style={{ marginRight: 8 }} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search species, diet, or description…" placeholderTextColor={theme.secondaryText} style={{ fontFamily: "Inter_400Regular", flex: 1, paddingVertical: 12, color: theme.text, fontSize: type.bodyLg }} 
            maxLength={TEXT_LIMITS.search}
          />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={theme.secondaryText} style={{ marginLeft: 6 }} />
          </Pressable>
        ) : null}
      </View>

      {/* What the filters are actually doing, and the way out. Restoring a
          filter set silently is worse than not restoring it — this is the line
          that stops "where did the other 300 fish go?". */}
      {narrowing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Ionicons name="funnel" size={12} color={theme.accent} />
          <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
            Showing {list.length} of {SPECIES.length} · {narrowing} filter{narrowing === 1 ? "" : "s"} on
          </Text>
          <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear all filters">
            <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

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
          <Text style={pillText(fitsOnly)}>Fits my {formatVolume(tankGallons)}</Text>
        </Pressable>
        {tank.length ? (
          <Pressable onPress={() => { tapHaptic(); setCompatOnly((v) => !v); }} style={[styles.pill, pillStyle(compatOnly)]} accessibilityRole="button">
            <Text style={pillText(compatOnly)}>Fits my stock</Text>
          </Pressable>
        ) : null}
        {wishlist.length ? (
          <Pressable onPress={() => { tapHaptic(); setWishOnly((v) => !v); }} style={[styles.pill, pillStyle(wishOnly)]} accessibilityRole="button">
            <Text style={pillText(wishOnly)}>Wishlist ({wishlist.length})</Text>
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
            <CardBoundary name="Compare"><CompareCard a={compareSel[0]} b={compareSel[1]} /></CardBoundary>
          ) : (
            <View style={[styles.card, { marginBottom: 0 }]}>
              <Text accessibilityRole="header" style={styles.cardEyebrow}>Compare mode</Text>
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
                <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!compareMode && !q && recent.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: 6 }}>RECENTLY VIEWED</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {recent.map((n) => {
              const sp = getSpecies(n);
              if (!sp) return null;
              return (
                <Pressable key={n} onPress={() => openSpecies(n)} style={[styles.pill, { paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.05)", borderColor: theme.border }]} accessibilityRole="button">
                  <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{sp.emoji} {n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {diseaseMatches.length && openDisease ? (
        <View style={{ marginTop: 14 }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 8 }]}>Health guides</Text>
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

    </View>
  );

  const ListFooter = (
    <View>
      {!premiumUnlocked && list.length > shown ? (
        // The free preview ends here. Show what's behind the wall rather than
        // just stopping — the number is the pitch.
        <Pressable
          onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }}
          style={({ pressed }) => [styles.card, { marginTop: 6, alignItems: "center" }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Unlock the full species catalog with Premium"
        >
          <Text style={{ fontSize: type.display, letterSpacing: -0.4 }}>🔒</Text>
          <Text style={{ color: "#fff", fontSize: type.title, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 10, textAlign: "center" }}>
            {list.length - shown} more species
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 19 }}>
            Free accounts preview {freeLimit} species. Unlock all {SPECIES.length} with care guides, compatibility, and wishlist.
          </Text>
          <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 12 }}>See Premium 👑</Text>
        </Pressable>
      ) : list.length > shown ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 20, list.length)); }} style={[styles.ghostBtn, { marginTop: 4 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({list.length - shown})</Text>
        </Pressable>
      ) : null}
      {list.length === 0 ? (
        <View style={styles.card}><EmptyState emoji="🔍" title="No matches" subtitle="No species fit those filters. Try loosening one, or reset to see the full catalog." /></View>
      ) : null}
    </View>
  );

  // In grid mode each row is shared between two cards.
  const renderItem = ({ item }) => {
    const selected = compareMode && compareSel.includes(item.name);
    const card = (
      <SpeciesCard
        species={item}
        onPress={() => onCardPress(item.name)}
        inTank={tank.includes(item.name)}
        onToggleTank={compareMode ? undefined : () => toggleTank(item.name)}
        inWishlist={wishlist.includes(item.name)}
        onToggleWishlist={compareMode || !onToggleWishlist ? undefined : () => onToggleWishlist(item.name)}
        note={selected ? "\u2696\ufe0f Selected for compare" : undefined}
      />
    );
    // In one column the card fills the row as it always has. In two, each cell
    // has to claim half the row or the cards keep their content width and sit
    // in a ragged left-hand strip.
    return columns > 1 ? <View style={{ flex: 1 }}>{card}</View> : card;
  };

  return (
    <FlatList
      ref={scrollRef}
      // A single column of 316 species down the middle of an iPad wastes most
      // of the screen. FlatList refuses to change numColumns in place, so the
      // key forces a remount on rotation — which costs one re-render on an
      // event that already re-renders everything.
      key={columns}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
      data={list.slice(0, shown)}
      renderItem={renderItem}
      keyExtractor={(item) => item.name}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
     
      // Tuned for rows of roughly even height. removeClippedSubviews is the
      // setting that actually frees memory on Android.
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={9}
      removeClippedSubviews
    />
  );
})

const pillStyle = (on) => ({ backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border });
const pillText = (on) => ({ color: on ? theme.onAccent : theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" });
