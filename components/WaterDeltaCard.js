import { Text, View } from "react-native";
import { theme, radius, type, space } from "../styles";
import { EmptyState } from "./EmptyState";
import { getWaterDelta, paramStatusColor } from "../core";

// A free, at-a-glance "what changed since last test" — each parameter's newest
// reading with the direction and size of its move. Complements the premium
// trend charts without giving them away.
export function WaterDeltaCard({ waterTests = [], waterType = "fresh" }) {
  const deltas = getWaterDelta(waterTests, waterType);
  if (!deltas.length) {
    return <EmptyState emoji="📊" title="Nothing to compare" subtitle="Log two water tests and the change between them shows up here." />;
  }
  return (
    <View style={{ gap: space.sm }}>
      {deltas.map((d) => {
        const arrow = d.diff > 0 ? "▲" : d.diff < 0 ? "▼" : "＝";
        const c = paramStatusColor(d.status);
        return (
          <View key={d.key} style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: theme.well, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{d.label}</Text>
            <Text style={{ color: c, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{d.value}{d.unit ? ` ${d.unit}` : ""}</Text>
            <Text style={{ width: 66, textAlign: "right", color: d.diff === 0 ? theme.secondaryText : c, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              {arrow}{d.diff !== 0 ? ` ${Math.abs(d.diff)}` : ""}
            </Text>
          </View>
        );
      })}
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.hair }}>Change vs your previous test.</Text>
    </View>
  );
}
