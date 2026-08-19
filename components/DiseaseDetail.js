import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getDisease, getSpecies } from "../core";
import { getDiseaseImage } from "../data/diseaseImageMap";
import { SpeciesThumb } from "./SpeciesThumb";
import { TreatmentPlanCard } from "./TreatmentPlanCard";

// Disease guide detail — the analog of Pocket Planter's DiseaseDetailScreen.
export function DiseaseDetail({ name, tank = [], onBack, onOpenSpecies, treatment, onStartTreatment, onToggleTreatmentStep, onStopTreatment }) {
  const d = getDisease(name);
  if (!d) return null;
  const img = getDiseaseImage(name);
  const atRisk = tank.map(getSpecies).filter(Boolean).filter((s) => d.water === "both" || s.water === d.water);
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable style={({ pressed }) => [{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, borderRadius: radius.pill, paddingVertical: space.sm, paddingHorizontal: space.lg, marginBottom: space.xs }, pressed && { opacity: 0.7 }]} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
        <>
          <Ionicons name="chevron-back" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>Back</Text>
        </>
      </Pressable>

      <View style={styles.detailHeroWrap}>
        <View style={{ position: "absolute", top: 6, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,216,107,0.10)" }} />
        <View style={{ width: 108, height: 108, borderRadius: 30, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,216,107,0.28)", overflow: "hidden" }}>
          {img ? (
            <Image source={img} style={{ width: 108, height: 108 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 56, letterSpacing: -1 }}>{d.emoji}</Text>
          )}
        </View>
        <Text style={styles.detailName}>{d.name}</Text>
        <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, marginTop: space.sm }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {d.water === "salt" ? "🌊 Saltwater" : d.water === "fresh" ? "💧 Freshwater" : "💧🌊 Fresh & salt"}
          </Text>
        </View>
      </View>

      <Section icon="🔍" title="What it is" text={d.description} color={theme.accent} />
      <Section icon="👀" title="Signs & symptoms" text={d.signs} color={theme.warn} />
      <Section icon="🛡️" title="How to prevent it" text={d.prevent} color={theme.accent} />
      <Section icon="✅" title="How to treat it" text={d.treat} color="#5cff89" />

      {/* A guided course — the part that keeps going after symptoms clear. */}
      {onStartTreatment ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: space.md }]}>Treatment plan</Text>
          <TreatmentPlanCard
            diseaseName={name}
            treatment={treatment}
            onStart={onStartTreatment}
            onToggleStep={onToggleTreatmentStep}
            onStop={onStopTreatment}
          />
        </View>
      ) : null}

      {/* AT RISK IN YOUR TANK */}
      {atRisk.length ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { color: theme.warn }]}>AT RISK IN YOUR TANK</Text>
          <Text style={[styles.cardText, { marginBottom: space.md }]}>These species you're keeping can be affected — watch them closely.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {atRisk.map((s) => (
              <Pressable key={s.name} onPress={() => onOpenSpecies && onOpenSpecies(s.name)} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "rgba(255,216,107,0.10)", borderRadius: radius.pill, paddingLeft: space.xs, paddingRight: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: "rgba(255,216,107,0.32)" }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <SpeciesThumb species={s} size={20} radius={10} />
                <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{s.name}</Text>
                <Text style={{ color: theme.warn, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Section({ icon, title, text, color }) {
  return (
    <View style={[styles.card, { flexDirection: "row", gap: space.md }]}>
      <View style={{ width: 4, borderRadius: radius.pill, backgroundColor: color, opacity: 0.7 }} />
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[styles.cardEyebrow, { color }]}>{icon} {title.toUpperCase()}</Text>
        <Text style={styles.cardText}>{text}</Text>
      </View>
    </View>
  );
}
