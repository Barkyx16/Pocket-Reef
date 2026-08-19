import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import { getTankHealthScore, tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { GradientButton } from "./GradientButton";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// The Tank tab's hub — add a tank, plus a tappable row per tank that expands in
// place to reveal that tank's full contents (stats, health, conflicts, fish),
// rendered via `renderDetail` for the active tank. Quick shortcuts below.
export function TankHubCard({ tanks = [], activeTankId, onSwitch, onAdd, onQuickAdd, renderDetail }) {
  const [expandedId, setExpandedId] = useState(null); // collapsed by default — tap to open

  const onRowPress = (tk) => {
    tapHaptic();
    if (tk.id !== activeTankId) { onSwitch && onSwitch(tk.id); setExpandedId(tk.id); }
    else setExpandedId(expandedId === tk.id ? null : tk.id);
  };

  return (
    <View style={styles.card}>
      <Text style={{ color: "#fff", fontSize: type.headline, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, marginBottom: space.lg }}>Your Tanks</Text>

      <GradientButton label="Add a Tank" icon="add" variant="secondary" onPress={onAdd} />

      <View style={{ gap: space.md, marginTop: space.md }}>
        {tanks.map((tk) => {
          const h = getTankHealthScore({ tank: tk.stock, tankGallons: tk.gallons, waterTests: tk.waterTests, maintenance: tk.maintenance, quantities: tk.quantities, waterType: tk.water });
          const on = tk.id === activeTankId;
          const expanded = on && expandedId === tk.id;
          const n = tk.stock ? tk.stock.length : 0;
          return (
            <View key={tk.id} style={{ backgroundColor: on ? "rgba(56,225,198,0.08)" : theme.well, borderRadius: radius.xl, borderWidth: 1, borderColor: on ? theme.accent : theme.border, overflow: "hidden" }}>
              <Pressable
                onPress={() => onRowPress(tk)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`${tk.name}, ${n} stocked, ${h.score == null ? "health not yet measurable" : `${h.score} percent healthy`}, ${expanded ? "collapse" : "open"}`}
              >
                <View style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: type.headline, letterSpacing: -0.4 }}>{tk.emoji || "🐠"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{tk.name}{on ? " · active" : ""}</Text>
                  <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.hair }}>{formatVolume(tk.gallons)} · {n} stocked</Text>
                </View>
                <View style={{ backgroundColor: `${h.color}22`, borderColor: `${h.color}55`, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                  <Text style={{ color: h.color, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{h.score == null ? "—" : `${h.score}%`}</Text>
                </View>
                <Text style={{ color: theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", width: 16, textAlign: "center" }}>{expanded ? "▾" : "▸"}</Text>
              </Pressable>

              {expanded && renderDetail ? (
                <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>{renderDetail()}</View>
              ) : null}
            </View>
          );
        })}
      </View>

      <GradientButton label="Quick Add Fish" icon="flash" onPress={onQuickAdd} style={{ marginTop: space.md }} />
    </View>
  );
}
