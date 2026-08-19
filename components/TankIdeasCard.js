import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import { TANK_IDEAS } from "../data/tankIdeas";
import { tapHaptic } from "../core";
import { SpeciesThumb } from "./SpeciesThumb";
import { formatVolume } from "../lib/units";

// Ready-made, compatibility-checked stocking templates. One tap loads the tank
// size + species — the reef version of Pocket Planter's guild templates.
const PAGE = 3;

export function TankIdeasCard({ onLoad }) {
  const [visible, setVisible] = useState(PAGE);
  return (
    <View style={{ gap: space.lg }}>
      <Text style={styles.cardText}>Proven, conflict-free setups. Tap "Use this setup" to load the tank size and species — then tweak from there.</Text>
      {TANK_IDEAS.slice(0, visible).map((idea) => (
        <View key={idea.id} style={{ backgroundColor: theme.well, borderRadius: radius.xl, padding: space.lg, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Text style={{ fontSize: 22, letterSpacing: -0.4 }}>{idea.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{idea.name}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                {formatVolume(idea.gallons)} · {idea.water === "salt" ? "🌊 Saltwater" : "💧 Freshwater"} · {idea.species.length} species
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18, marginTop: space.sm }}>{idea.blurb}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {idea.species.map((n) => (
              <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: radius.pill, paddingLeft: space.xs, paddingRight: space.sm, paddingVertical: space.xs }}>
                <SpeciesThumb name={n} size={18} radius={9} />
                <Text style={{ color: theme.text, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{n}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => { tapHaptic("medium"); onLoad && onLoad(idea); }} style={[styles.primaryBtn, { marginTop: space.md, paddingVertical: space.md }]} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Use this setup</Text>
          </Pressable>
        </View>
      ))}
      {TANK_IDEAS.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 5, TANK_IDEAS.length)); }} style={styles.ghostBtn} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more setups ({TANK_IDEAS.length - visible})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
