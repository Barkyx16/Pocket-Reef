import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "../styles";
import { tapHaptic } from "../core";

// The overall reef-health score with a factor breakdown. The score ring shows at
// a glance; tap the header to expand or collapse the six-factor breakdown so the
// card stays compact inside the Your Tank overview.
const ICON = { true: "✓", partial: "~", false: "✕" };
const CLR = { true: "#38e1c6", partial: "#ffd86b", false: "#ff7b7b" };

export function TankHealthCard({ health, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!health) return null;
  return (
    <View>
      <Pressable
        onPress={() => { tapHaptic("light"); setOpen((v) => !v); }}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 16 }, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`Tank health ${health.score} of 100, ${open ? "hide" : "show"} breakdown`}
      >
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: health.color, alignItems: "center", justifyContent: "center", backgroundColor: `${health.color}14`, shadowColor: health.color, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 4 }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{health.score}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: health.color, fontSize: 20, fontWeight: "900" }}>{health.label}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "700", marginTop: 2 }}>Overall health, out of 100.</Text>
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "800", marginTop: 4 }}>{open ? "Hide breakdown ▲" : "Tap for breakdown ▾"}</Text>
        </View>
      </Pressable>

      {open ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {health.factors.map((f) => (
            <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: `${CLR[String(f.state)]}22`, borderWidth: 1, borderColor: `${CLR[String(f.state)]}88`, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: CLR[String(f.state)], fontSize: 12, fontWeight: "900" }}>{ICON[String(f.state)]}</Text>
              </View>
              <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: "800" }}>{f.label}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "700" }}>{f.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
