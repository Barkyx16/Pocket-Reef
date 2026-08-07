import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getWaterDelta, paramStatusColor } from "../core";

// A free, at-a-glance "what changed since last test" — each parameter's newest
// reading with the direction and size of its move. Complements the premium
// trend charts without giving them away.
export function WaterDeltaCard({ waterTests = [], waterType = "fresh" }) {
  const deltas = getWaterDelta(waterTests, waterType);
  if (!deltas.length) {
    return <Text style={styles.cardText}>Log two water tests and the change between them will show here.</Text>;
  }
  return (
    <View style={{ gap: 8 }}>
      {deltas.map((d) => {
        const arrow = d.diff > 0 ? "▲" : d.diff < 0 ? "▼" : "＝";
        const c = paramStatusColor(d.status);
        return (
          <View key={d.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{d.label}</Text>
            <Text style={{ color: c, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{d.value}{d.unit ? ` ${d.unit}` : ""}</Text>
            <Text style={{ width: 66, textAlign: "right", color: d.diff === 0 ? theme.secondaryText : c, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              {arrow}{d.diff !== 0 ? ` ${Math.abs(d.diff)}` : ""}
            </Text>
          </View>
        );
      })}
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>Change vs your previous test.</Text>
    </View>
  );
}
