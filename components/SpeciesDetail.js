import { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  careLevelColor, temperamentColor, compatColor, phRange,
  getCompatibility, getSpecies, getDiseasesForSpecies, getTankmates, assessAddition, getCareTips, getSimilarSpecies,
} from "../core";
import { formatTempRange, formatVolume } from "../lib/units";
import { getSpeciesImage } from "../data/speciesImageMap";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { Chip } from "./Chip";
import { SpeciesThumb } from "./SpeciesThumb";
import { GradientButton } from "./GradientButton";
import { tenureLabel } from "../lib/livestock";
import { ObservationsCard } from "./ObservationsCard";
import { TEXT_LIMITS } from "../lib/textLimits";
import { fmtMoney } from "../lib/format";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// Full species detail — modeled on Pocket Planter's plant detail: quick actions,
// a journey prompt, smart-care rows, tappable problems & protection, step-by-step,
// tankmate intelligence, shop links, and personal notes.
export function SpeciesDetail({ name, tank = [], tankGallons = 0, onBack, onToggleTank, onOpenDisease, onOpenSpecies, inWishlist, onToggleWishlist, tanks = [], quantity = 1, onSetQuantity, onGoToTab, note = "", onChangeNote, record = null, onOpenRecord, activeTank = {}, onAddObservation, onRemoveObservation }) {
  const s = getSpecies(name);
  const [noteText, setNoteText] = useState(note);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Resets only when navigating fish-to-fish. Adding `note` would overwrite what is being typed.
  useEffect(() => { setNoteText(note); }, [name]); // reset when navigating fish-to-fish
  if (!s) return null;

  const inTanks = tanks.filter((tk) => (tk.stock || []).includes(name));
  const inTank = tank.includes(name);
  const others = tank.filter((n) => n !== name);
  const diseases = getDiseasesForSpecies(s);
  const mates = getTankmates(name, 6);
  const shopLinks = buildShopLinks(s);
  const watchFor = [...new Set(diseases.flatMap((d) => d.symptoms || []))].slice(0, 7);
  // Both of these have been computed by core.js since the beginning and shown
  // nowhere. The care sheet lists this animal's numbers — size, pH, temperature
  // — and never said what any of them mean for keeping it, which is the half a
  // beginner actually needs.
  const careTips = getCareTips(s);
  const similar = getSimilarSpecies(s, 4);

  // "Will this work in MY tank?" verdict — the same call the add button makes,
  // so the screen and the confirmation can never disagree about a fish.
  const check = assessAddition(name, { tank, tankGallons });
  const verdict = check.ok
    ? tank.length
      ? { good: true, text: "Great fit — compatible with your current tank" }
      : { good: true, text: tankGallons ? `Fits your ${formatVolume(tankGallons)} tank` : "Looks like a solid choice" }
    : { good: false, text: check.title };
  const vColor = verdict.good ? theme.accent : theme.danger;

  const careRows = [
    { icon: "🌊", label: "Water type", value: s.water === "salt" ? "Saltwater" : "Freshwater" },
    { icon: "🌡️", label: "Temperature", value: formatTempRange(s.tempMinF, s.tempMaxF) },
    { icon: "⚗️", label: "pH range", value: phRange(s) },
    { icon: "🪣", label: "Minimum tank", value: formatVolume(s.minGallons) },
    { icon: "📏", label: "Adult size", value: s.adultInches ? `${s.adultInches}"` : "—" },
    { icon: "🍽️", label: "Diet", value: cap(s.diet) },
    { icon: "😊", label: "Temperament", value: cap(s.temperament), color: temperamentColor(s.temperament) },
    { icon: "🎯", label: "Care level", value: s.careLevel, color: careLevelColor(s.careLevel) },
    { icon: "👥", label: "Keep in group", value: s.minGroup > 1 ? `${s.minGroup}+` : "Fine on its own" },
  ];
  if (s.kind === "fish" && s.reefSafe != null) careRows.push({ icon: "🪸", label: "Reef-safe", value: s.reefSafe ? "Yes — coral safe" : "No — not reef-safe", color: s.reefSafe ? theme.accent : theme.danger });

  const shareSpecies = () => {
    Share.share({ message: `${s.emoji} ${s.name} — ${s.water === "salt" ? "Saltwater" : "Freshwater"} ${s.kind}\n${s.summary}\n\nvia Pocket Reef` }).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable style={({ pressed }) => [{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 4 }, pressed && { opacity: 0.7 }]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
        <>
          <Ionicons name="chevron-back" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>Back</Text>
        </>
      </Pressable>

      {/* HERO */}
      <View style={styles.detailHeroWrap}>
        <View style={{ position: "absolute", top: 18, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(56,225,198,0.14)" }} />
        <View style={styles.detailImageWrap}>
          {getSpeciesImage(s.name) ? (
            <Image source={getSpeciesImage(s.name)} style={{ width: 136, height: 136 }} resizeMode="cover" />
          ) : (
            <Text style={styles.detailEmoji}>{s.emoji}</Text>
          )}
        </View>
        <Text style={styles.detailName}>{s.name}</Text>
        <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4 }}>
          {s.water === "salt" ? "Saltwater" : "Freshwater"} {s.kind} · {s.careLevel} care · {cap(s.temperament)}
        </Text>
      </View>

      {/* VERDICT */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${vColor}18`, borderRadius: 14, borderWidth: 1, borderColor: `${vColor}55`, padding: 12, marginBottom: 14 }}>
        <View style={{ width: 30, height: 30, borderRadius: 16, backgroundColor: `${vColor}2e`, borderWidth: 1, borderColor: `${vColor}77`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={verdict.good ? "checkmark-circle" : "warning"} size={17} color={verdict.good ? theme.accent : theme.warn} />
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flex: 1, color: vColor, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>{verdict.text}</Text>
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 10 }]}>Quick Actions</Text>
        <Pressable onPress={() => onToggleTank && onToggleTank(name)} style={inTank ? styles.ghostBtn : styles.primaryBtn} accessibilityRole="button">
          <Text style={inTank ? styles.ghostBtnText : styles.primaryBtnText}>{inTank ? "− Remove from my tank" : "＋ Add to my tank"}</Text>
        </Pressable>

        {inTank && onSetQuantity ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>How many?{s.minGroup > 1 ? <Text style={{ color: quantity < s.minGroup ? theme.warn : theme.secondaryText, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{`  group of ${s.minGroup}+`}</Text> : null}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable onPress={() => onSetQuantity(name, quantity - 1)} hitSlop={6} style={qtyBtn} accessibilityRole="button" accessibilityLabel="Decrease count"><Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>−</Text></Pressable>
              <Text style={{ color: quantity < s.minGroup ? theme.warn : "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", minWidth: 24, textAlign: "center" }}>{quantity}</Text>
              <Pressable onPress={() => onSetQuantity(name, quantity + 1)} hitSlop={6} style={qtyBtn} accessibilityRole="button" accessibilityLabel="Increase count"><Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>+</Text></Pressable>
            </View>
          </View>
        ) : null}

        {/* What YOU know about this animal, not what the catalog knows.
            Records existed but were only visible on the Tank tab — so opening
            the fish you've kept for two years showed generic care notes and no
            sign the app had ever met it. */}
        {inTank ? (
          <Pressable
            onPress={() => onOpenRecord && onOpenRecord(name)}
            disabled={!onOpenRecord}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 11 }, pressed && onOpenRecord && { opacity: 0.75, borderColor: theme.accent }]}
            accessibilityRole={onOpenRecord ? "button" : undefined}
            accessibilityLabel={record && record.addedAt ? `Your record: kept ${tenureLabel(record)}` : "Add your record for this animal"}
          >
            <Ionicons name="bookmark-outline" size={15} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                {record && record.addedAt ? `Yours for ${tenureLabel(record)}` : "Your record"}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                {record && (record.source || record.price != null)
                  ? [record.source, record.price != null ? fmtMoney(record.price) : null].filter(Boolean).join(" · ")
                  : "Add where it came from and what it cost"}
              </Text>
            </View>
            {onOpenRecord ? <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} /> : null}
          </Pressable>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <QuickTile icon={inWishlist ? "heart" : "heart-outline"} label={inWishlist ? "Saved" : "Save"} active={inWishlist} activeColor={theme.coral} onPress={() => onToggleWishlist && onToggleWishlist(name)} />
          <QuickTile icon="share-outline" label="Share" onPress={shareSpecies} />
          <QuickTile icon="cart-outline" label="Shop" onPress={() => Linking.openURL(shopLinks[0].url).catch(() => {})} />
          <QuickTile icon="camera-outline" label="Journal" onPress={() => onGoToTab && onGoToTab("journal")} />
        </View>

        {tanks.length > 1 && inTanks.length ? (
          <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 12, textAlign: "center" }}>
            🐠 In your {inTanks.length === 1 ? "tank" : `${inTanks.length} tanks`}: {inTanks.map((tk) => `${tk.emoji || "🐠"} ${tk.name}`).join(" · ")}
          </Text>
        ) : null}
      </View>

      {/* JOURNEY / TIMELINE */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>{s.name}'s Journey</Text>
        <Text style={[styles.cardText, { marginTop: 6 }]}>{inTank ? `Track ${s.name}'s progress — log photos and notes in your Journal.` : `Add ${s.name} to your tank, then log its journey with dated photos and notes.`}</Text>
        {onGoToTab ? (
          <Pressable onPress={() => onGoToTab("journal")} style={({ pressed }) => [styles.ghostBtn, { marginTop: 12 }, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Open Journal</Text>
          </Pressable>
        ) : null}
      </View>

      {/* SMART CARE */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>Smart Care</Text>
        <Text style={[styles.cardText, { marginTop: 6, marginBottom: 12 }]}>{s.summary}</Text>
        <View style={{ gap: 8 }}>
          {careRows.map((r) => (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
              <Text style={{ fontSize: 18 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.accentLight, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</Text>
                <Text style={{ color: r.color || "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 2 }}>{r.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* GETS ALONG WITH YOUR TANK */}
      {others.length ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardEyebrow}>GETS ALONG WITH YOUR TANK</Text>
          {others.map((n) => {
            const c = getCompatibility(name, n);
            const other = getSpecies(n);
            return (
              <View key={n} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10 }}>
                <SpeciesThumb species={other} size={24} radius={8} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{n}</Text>
                    <Chip label={c.level} color={compatColor(c.level)} />
                  </View>
                  <Text style={[styles.cardText, { marginTop: 2 }]}>{c.reason}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* PROBLEMS & PROTECTION */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>PROBLEMS & PROTECTION</Text>
        <Text style={[styles.cardText, { marginTop: 6, marginBottom: 12 }]}>Diseases to watch for on {s.name} — tap any one for its full guide with treatment steps.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>🩺 Common Ailments</Text>
          <View style={{ backgroundColor: "rgba(255,138,101,0.22)", borderRadius: 999, minWidth: 20, paddingHorizontal: 8, paddingVertical: 1, alignItems: "center" }}>
            <Text style={{ color: theme.coral, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>{diseases.length}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {diseases.map((d) => (
            <Pressable key={d.name} onPress={() => onOpenDisease && onOpenDisease(d.name)} style={({ pressed }) => [{ width: "47.5%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,138,101,0.10)", borderWidth: 1, borderColor: "rgba(255,138,101,0.35)", borderRadius: 14, padding: 8 }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`${d.name} guide`}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {getDiseaseImage(d.name) ? (
                  <Image source={getDiseaseImage(d.name)} style={{ width: 32, height: 32 }} resizeMode="cover" />
                ) : (
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: 18 }}>{d.emoji}</Text>
                )}
              </View>
              <Text style={{ flex: 1, color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={2}>{d.name}</Text>
            </Pressable>
          ))}
        </View>
        {watchFor.length ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <Text style={{ fontSize: 15 }}>⚠️</Text>
            <Text style={{ flex: 1, color: theme.bodyText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19 }}>
              <Text style={{ color: theme.warn, fontFamily: "Inter_900Black", fontWeight: "900" }}>Watch for: </Text>{watchFor.join(", ")}.
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Ionicons name="checkmark-circle" size={17} color={theme.accent} />
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19 }}>
            <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>Prevent & treat: </Text>Quarantine new arrivals, keep water pristine and stable, don't overstock, and act at the very first sign.
          </Text>
        </View>
      </View>

      {/* TANKMATE INTELLIGENCE */}
      {(mates.great.length || mates.caution.length || mates.avoid.length) ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardEyebrow}>TANKMATE INTELLIGENCE</Text>
          <Text style={styles.cardText}>Who gets along with {s.name} — and who to keep apart. Tap any fish to open it.</Text>
          <MateGroup color={theme.accent} label="Great Tankmates" names={mates.great} onOpen={onOpenSpecies} />
          <MateGroup color={theme.warn} label="With Caution" names={mates.caution} onOpen={onOpenSpecies} />
          <MateGroup color={theme.danger} label="Avoid" names={mates.avoid} onOpen={onOpenSpecies} />
        </View>
      ) : null}

      {/* SHOP & SUPPLY */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>SHOP & SUPPLY</Text>
        <Text style={styles.cardText}>Find {s.name}, the right food, and gear from trusted sources.</Text>
        <View style={{ gap: 10, marginTop: 12 }}>
          {shopLinks.map((link) => (
            <Pressable key={link.label} onPress={() => Linking.openURL(link.url).catch(() => {})} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12 }, pressed && { opacity: 0.75, borderColor: theme.accent }]} accessibilityRole="link" accessibilityLabel={link.label}>
              <Text style={{ fontSize: 20 }}>{link.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{link.label}</Text>
                <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>{link.sub}</Text>
              </View>
              <Text style={{ color: theme.accent, fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* WHAT IT NEEDS FROM YOU — the numbers above, turned into instructions. */}
      {careTips.length ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 8 }]}>Keeping {s.name}</Text>
          {careTips.map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: i ? 8 : 0 }}>
              <Ionicons name="ellipse" size={7} color={theme.accent} style={{ marginTop: 6 }} />
              <Text style={{ flex: 1, color: theme.bodyText, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 19 }}>{tip}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* SIMILAR — a browse path for "I like this but it won't fit", which is
          the most common reason somebody is reading a care sheet they can't
          act on. */}
      {similar.length ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 4 }]}>If you like {s.name}</Text>
          <Text style={[styles.cardText, { marginTop: 0, marginBottom: 10 }]}>
            Similar size, temperament and care level — useful when this one doesn't fit your tank.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {similar.map((o) => (
              <Pressable
                key={o.name}
                onPress={() => onOpenSpecies && onOpenSpecies(o.name)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: theme.well, borderRadius: 999, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 7 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
                accessibilityRole="button"
                accessibilityLabel={`${o.name}, ${o.careLevel} care, minimum ${formatVolume(o.minGallons)}`}
              >
                <SpeciesThumb species={o} size={18} />
                <Text style={{ color: theme.text, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{o.name}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{formatVolume(o.minGallons)}+</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* OBSERVATIONS — only for something actually in the tank. A dated log
          for a fish you're browsing is a form with nothing to record. */}
      {inTank && onAddObservation ? (
        <View style={styles.card}>
          <ObservationsCard tank={activeTank} name={name} onAdd={onAddObservation} onRemove={onRemoveObservation} />
        </View>
      ) : null}

      {/* PERSONAL NOTES */}
      {onChangeNote ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardEyebrow}>PERSONAL NOTES</Text>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            onEndEditing={() => onChangeNote(noteText.trim())}
            onBlur={() => onChangeNote(noteText.trim())}
            placeholder={`Write notes about ${s.name}…`}
            placeholderTextColor={theme.secondaryText}
            multiline
            style={{ backgroundColor: theme.well, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, minHeight: 96, textAlignVertical: "top", marginTop: 10 }}
          
            maxLength={TEXT_LIMITS.note}
          />
        </View>
      ) : null}

      {/* BACK (bottom) */}
      <GradientButton label="Back to species" icon="chevron-back" variant="secondary" onPress={onBack} style={{ marginTop: 4, marginBottom: 8 }} />
    </ScrollView>
  );
}

function QuickTile({ icon, label, active, activeColor, onPress }) {
  const c = active ? (activeColor || theme.accent) : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 16, borderWidth: 1, backgroundColor: active ? `${activeColor || theme.accent}18` : "rgba(255,255,255,0.04)", borderColor: active ? (activeColor || theme.accent) : theme.border }, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={19} color={c} />
      <Text style={{ color: c, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

// Category group of tappable tankmate cards (image + name) that navigate fish-to-fish.
function MateGroup({ color, label, names, onOpen }) {
  if (!names || !names.length) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
        <View style={{ backgroundColor: `${color}22`, borderRadius: 999, minWidth: 20, paddingHorizontal: 8, paddingVertical: 1, alignItems: "center" }}>
          <Text style={{ color, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>{names.length}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {names.map((n) => (
          <Pressable key={n} onPress={() => onOpen && onOpen(n)} style={({ pressed }) => [{ width: "47.5%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}44`, borderRadius: 14, padding: 8 }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={n}>
            <SpeciesThumb name={n} size={32} radius={9} />
            <Text style={{ flex: 1, color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={1}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function buildShopLinks(s) {
  const enc = encodeURIComponent;
  const foodQuery = s.diet === "carnivore" ? "frozen mysis brine shrimp fish food"
    : s.diet === "herbivore" ? "algae wafers nori fish food"
    : s.diet === "photosynthetic" ? "coral reef food phytoplankton"
    : "tropical fish flake pellet food";
  return [
    { icon: "📦", label: `Buy ${s.name} supplies on Amazon`, sub: "Ships to your door", url: `https://www.amazon.com/s?k=${enc(s.name + " aquarium")}` },
    { icon: "🍤", label: `Buy ${cap(s.diet)} fish food`, sub: "The right diet for this species", url: `https://www.amazon.com/s?k=${enc(foodQuery)}` },
    { icon: "🐠", label: `Shop ${s.name} at LiveAquaria`, sub: "Trusted aquarium livestock", url: `https://www.liveaquaria.com/search?q=${enc(s.name)}` },
    { icon: "📍", label: "Find fish stores near you", sub: "Local aquarium & pet shops", url: `https://www.google.com/maps/search/${enc("aquarium fish store near me")}` },
    { icon: "🏪", label: "Shop at Petco", sub: "Check local availability", url: `https://www.petco.com/shop/en/petcostore/search?query=${enc(s.name)}` },
  ];
}

const cap = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);
const qtyBtn = { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: theme.accent };
