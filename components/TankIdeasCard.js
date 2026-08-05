import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { TANK_IDEAS } from "../data/tankIdeas";
import { tapHaptic } from "../core";
import { SpeciesThumb } from "./SpeciesThumb";

// Ready-made, compatibility-checked stocking templates. One tap loads the tank
// size + species — the reef version of Pocket Planter's guild templates.
const PAGE = 3;

export function TankIdeasCard({ onLoad }) {
  const [visible, setVisible] = useState(PAGE);
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.cardText}>Proven, conflict-free setups. Tap "Use this setup" to load the tank size and species — then tweak from there.</Text>
      {TANK_IDEAS.slice(0, visible).map((idea) => (
        <View key={idea.id} style={{ backgroundColor: theme.well, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{idea.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{idea.name}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "800" }}>
                {idea.gallons} gal · {idea.water === "salt" ? "🌊 Saltwater" : "💧 Freshwater"} · {idea.species.length} species
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 8 }}>{idea.blurb}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {idea.species.map((n) => (
              <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: 999, paddingLeft: 4, paddingRight: 9, paddingVertical: 3 }}>
                <SpeciesThumb name={n} size={18} radius={9} />
                <Text style={{ color: theme.text, fontSize: 11, fontWeight: "800" }}>{n}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => { tapHaptic("medium"); onLoad && onLoad(idea); }} style={[styles.primaryBtn, { marginTop: 12, paddingVertical: 11 }]} accessibilityRole="button">
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
