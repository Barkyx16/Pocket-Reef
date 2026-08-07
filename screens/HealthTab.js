import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { DISEASES, SYMPTOMS, getDiseasesBySymptom, tapHaptic } from "../core";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { TroubleshooterCard } from "../components/TroubleshooterCard";
import { t } from "../lib/i18n";

// Disease guide index + a symptom checker — tap symptoms you're seeing to narrow
// the list to the likely culprits, or browse every illustrated guide.
export function HealthTab({ openDisease }) {
  const PAGE = 6;
  const [visible, setVisible] = useState(PAGE);
  const [symptoms, setSymptoms] = useState([]);

  const toggleSymptom = (s) => {
    tapHaptic("light");
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  // Diseases matching ANY selected symptom, ranked by how many match.
  const matches = useMemo(() => {
    if (!symptoms.length) return null;
    const scored = DISEASES.map((d) => ({ d, n: symptoms.filter((s) => (d.symptoms || []).includes(s)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    return scored;
  }, [symptoms]);

  const list = matches ? matches.map((x) => x.d) : DISEASES;

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
      {badge ? <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", marginRight: 6 }}>{badge}</Text> : null}
      <Text style={styles.cleanArrow}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={t("health.eyebrow")}
        title={t("health.title")}
        subtitle={t("health.sub")}
        emoji="🩺"
        colors={["#123f4a", "#0d2f3d", "#082031"]}
      />

      {/* EMERGENCY TROUBLESHOOTER */}
      <CollapsibleCard storageKey="troubleshoot" title="🚨 Something Wrong?" eyebrow="Fast fixes for common problems">
        <TroubleshooterCard />
      </CollapsibleCard>

      {/* SYMPTOM CHECKER */}
      <View style={styles.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={styles.cardEyebrow}>🔎 Symptom checker</Text>
          {symptoms.length ? (
            <Pressable onPress={() => { tapHaptic(); setSymptoms([]); }} accessibilityRole="button">
              <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.cardText, { marginTop: 0, marginBottom: 10 }]}>Tap what you're seeing — matching guides rise to the top.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <Pressable key={s} onPress={() => toggleSymptom(s)} style={[styles.pill, { paddingVertical: 7, backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border }]} accessibilityRole="button">
                <Text style={{ color: on ? "#04202a" : theme.text, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.cleanMeta, { marginBottom: 10 }]}>
        {matches
          ? (list.length ? `${list.length} guide${list.length > 1 ? "s" : ""} match your symptoms` : "No guides match — browse all below")
          : `Showing ${Math.min(visible, DISEASES.length)} of ${DISEASES.length} guides`}
      </Text>

      {matches ? (
        list.length
          ? matches.map(({ d, n }) => <Row key={d.name} d={d} badge={n > 1 ? `${n} match` : undefined} />)
          : DISEASES.slice(0, visible).map((d) => <Row key={d.name} d={d} />)
      ) : (
        DISEASES.slice(0, visible).map((d) => <Row key={d.name} d={d} />)
      )}

      {!matches && DISEASES.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 8, DISEASES.length)); }} style={[styles.ghostBtn, { marginTop: 4 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({DISEASES.length - visible})</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
