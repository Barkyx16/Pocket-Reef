import { Pressable, Text, View } from "react-native";
import { theme, radius, type, space } from "../styles";
import { getTankHealthScore, tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// A cross-tank dashboard — every tank's health score and stock at a glance. Tap
// one to make it active. Only shown when you keep more than one tank.
export function TankOverviewCard({ tanks = [], activeTankId, onSwitch }) {
  return (
    <View style={{ gap: space.md }}>
      {tanks.map((tk) => {
        const h = getTankHealthScore({ tank: tk.stock, tankGallons: tk.gallons, waterTests: tk.waterTests, maintenance: tk.maintenance, quantities: tk.quantities, waterType: tk.water });
        const on = tk.id === activeTankId;
        return (
          <Pressable key={tk.id} onPress={() => { tapHaptic(); onSwitch(tk.id); }} style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: theme.well, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: on ? theme.accent : theme.border }} accessibilityRole="button">
            <Text style={{ fontSize: 22, letterSpacing: -0.4 }}>{tk.emoji || "🐠"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{tk.name}{on ? "  ·  active" : ""}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.hair }}>
                {formatVolume(tk.gallons)} · {tk.stock ? tk.stock.length : 0} species · {tk.water === "salt" ? "🌊 Salt" : "💧 Fresh"}
              </Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: radius.card, borderWidth: 3, borderColor: h.color, backgroundColor: `${h.color}14`, alignItems: "center", justifyContent: "center", shadowColor: h.color, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{h.score}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
