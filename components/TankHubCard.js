import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getTankHealthScore, tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { GradientButton } from "./GradientButton";

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
      <Text style={{ color: "#fff", fontSize: 24, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.5, marginBottom: 14 }}>Your Tanks</Text>

      <GradientButton label="Add a Tank" icon="add" variant="secondary" onPress={onAdd} />

      <View style={{ gap: 10, marginTop: 12 }}>
        {tanks.map((tk) => {
          const h = getTankHealthScore({ tank: tk.stock, tankGallons: tk.gallons, waterTests: tk.waterTests, maintenance: tk.maintenance, quantities: tk.quantities });
          const on = tk.id === activeTankId;
          const expanded = on && expandedId === tk.id;
          const n = tk.stock ? tk.stock.length : 0;
          return (
            <View key={tk.id} style={{ backgroundColor: on ? "rgba(56,225,198,0.08)" : theme.well, borderRadius: 16, borderWidth: 1, borderColor: on ? theme.accent : theme.border, overflow: "hidden" }}>
              <Pressable
                onPress={() => onRowPress(tk)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`${tk.name}, ${n} stocked, ${h.score == null ? "health not yet measurable" : `${h.score} percent healthy`}, ${expanded ? "collapse" : "open"}`}
              >
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(56,225,198,0.12)", borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>{tk.emoji || "🐠"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{tk.name}{on ? " · active" : ""}</Text>
                  <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>{formatVolume(tk.gallons)} · {n} stocked</Text>
                </View>
                <View style={{ backgroundColor: `${h.color}22`, borderColor: `${h.color}55`, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: h.color, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{h.score == null ? "—" : `${h.score}%`}</Text>
                </View>
                <Text style={{ color: theme.accent, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", width: 16, textAlign: "center" }}>{expanded ? "▾" : "▸"}</Text>
              </Pressable>

              {expanded && renderDetail ? (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>{renderDetail()}</View>
              ) : null}
            </View>
          );
        })}
      </View>

      <GradientButton label="Quick Add Fish" icon="flash" onPress={onQuickAdd} style={{ marginTop: 12 }} />
    </View>
  );
}
