import { useMemo, useState, memo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { DISEASES, SYMPTOMS, tapHaptic } from "../core";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { TroubleshooterCard } from "../components/TroubleshooterCard";
import { AlgaeCard } from "../components/AlgaeCard";
import { t } from "../lib/i18n";
import { AdaptiveColumns } from "../components/AdaptiveColumns";
import { useScrollToTop } from "../lib/scrollToTop";

// Disease guide index + a symptom checker — tap symptoms you're seeing to narrow
// the list to the likely culprits, or browse every illustrated guide.
export const HealthTab = memo(function HealthTab({ openDisease, waterType = "fresh", activeTank = {}, onGoToTab }) {
  const scrollRef = useScrollToTop();
  const PAGE = 6;
  const [visible, setVisible] = useState(PAGE);
  const [symptoms, setSymptoms] = useState([]);
  // Off by default: the guides and the symptom checker both narrow to what can
  // actually happen in this tank.
  const [showAll, setShowAll] = useState(false);

  // Every disease carries a `water` field that this screen ignored entirely,
  // so a freshwater keeper was shown Marine Velvet and Brooklynella and a reef
  // keeper was shown Columnaris. Somebody reading this screen is usually
  // frightened about a specific fish, and offering diagnoses that species
  // cannot possibly have wastes their time and invites the wrong treatment.
  const relevant = useMemo(
    () => DISEASES.filter((d) => !d.water || d.water === "both" || d.water === waterType),
    [waterType]
  );
  const pool = showAll ? DISEASES : relevant;
  const hidden = DISEASES.length - relevant.length;

  const toggleSymptom = (s) => {
    tapHaptic("light");
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  // Diseases matching ANY selected symptom, ranked by how many match.
  const matches = useMemo(() => {
    if (!symptoms.length) return null;
    const scored = pool.map((d) => ({ d, n: symptoms.filter((s) => (d.symptoms || []).includes(s)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    return scored;
  }, [symptoms, pool]);

  const list = matches ? matches.map((x) => x.d) : pool;

  const Row = ({ d, badge }) => (
    <Pressable key={d.name} onPress={() => openDisease(d.name)} style={({ pressed }) => [styles.cleanRow, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9, borderColor: theme.accent }]} accessibilityRole="button" accessibilityLabel={`${d.name} guide`}>
      <View style={styles.cleanImageWrap}>
        {getDiseaseImage(d.name) ? (
          <Image source={getDiseaseImage(d.name)} style={styles.cleanImage} resizeMode="cover" />
        ) : (
          <Text style={styles.cleanEmoji}>{d.emoji}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cleanName}>{d.name}</Text>
        <Text style={styles.cleanMeta} numberOfLines={2}>{d.description}</Text>
      </View>
      {badge ? <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", marginRight: 6 }}>{badge}</Text> : null}
      <Text style={styles.cleanArrow}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AdaptiveColumns lead={1}>
      <HeroBanner
        eyebrow={t("health.eyebrow")}
        title={t("health.title")}
        subtitle={t("health.sub")}
        emoji="🩺"
        colors={["#123f4a", "#0d2f3d", "#082031"]}
      />

      {/* Says plainly what's being hidden and offers the way out, so the
          narrowing can never look like a missing guide. */}
      {hidden > 0 ? (
        <Pressable
          onPress={() => { tapHaptic("light"); setShowAll((v) => !v); }}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 }, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={showAll ? `Showing all guides. Tap to show only ${waterType === "salt" ? "saltwater" : "freshwater"} ones.` : `Showing ${waterType === "salt" ? "saltwater" : "freshwater"} guides only. Tap to show all ${DISEASES.length}.`}
        >
          <Ionicons name={showAll ? "eye-outline" : "filter"} size={14} color={theme.accent} />
          <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
            {showAll
              ? `Showing all ${DISEASES.length} guides, including ${hidden} that can't affect a ${waterType === "salt" ? "saltwater" : "freshwater"} tank.`
              : `Showing the ${relevant.length} guides relevant to your ${waterType === "salt" ? "saltwater" : "freshwater"} tank.`}
          </Text>
          <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{showAll ? "Filter" : "Show all"}</Text>
        </Pressable>
      ) : null}

      {/* EMERGENCY TROUBLESHOOTER */}
      <CollapsibleCard storageKey="troubleshoot" title="🚨 Something Wrong?" eyebrow="Fast fixes for common problems">
        <TroubleshooterCard />
      </CollapsibleCard>

      {/* Algae gets its own card rather than a line in the troubleshooter,
          because the answer depends on this tank's readings rather than on
          general advice — which is the whole difference. */}
      <CollapsibleCard storageKey="algae" title="🌿 Algae Problem?" eyebrow="Diagnosed from your own readings">
        <AlgaeCard tank={activeTank} waterType={waterType} onGoToTab={onGoToTab} />
      </CollapsibleCard>

      {/* SYMPTOM CHECKER */}
      <View style={styles.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text accessibilityRole="header" style={styles.cardEyebrow}>Symptom checker</Text>
          {symptoms.length ? (
            <Pressable onPress={() => { tapHaptic(); setSymptoms([]); }} accessibilityRole="button">
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.cardText, { marginTop: 0, marginBottom: 10 }]}>Tap what you're seeing — matching guides rise to the top.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <Pressable key={s} onPress={() => toggleSymptom(s)} style={[styles.pill, { paddingVertical: 8, backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border }]} accessibilityRole="button">
                <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.cleanMeta, { marginBottom: 10 }]}>
        {matches
          ? (list.length ? `${list.length} guide${list.length > 1 ? "s" : ""} match your symptoms` : "No guides match — browse all below")
          : `Showing ${Math.min(visible, pool.length)} of ${pool.length} guides`}
      </Text>

      {/* Every one of these read straight from DISEASES, bypassing the filtered
          list entirely — which is how a freshwater keeper was still shown
          Marine Velvet under a banner promising only relevant guides. */}
      {matches ? (
        list.length
          ? matches.map(({ d, n }) => <Row key={d.name} d={d} badge={n > 1 ? `${n} match` : undefined} />)
          : pool.slice(0, visible).map((d) => <Row key={d.name} d={d} />)
      ) : (
        pool.slice(0, visible).map((d) => <Row key={d.name} d={d} />)
      )}

      {!matches && pool.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 8, pool.length)); }} style={[styles.ghostBtn, { marginTop: 4 }]} accessibilityRole="button" accessibilityLabel={`Show ${pool.length - visible} more guides`}>
          <Text style={styles.ghostBtnText}>Show more ({pool.length - visible})</Text>
        </Pressable>
      ) : null}
    </AdaptiveColumns>
    </ScrollView>
  );
})
