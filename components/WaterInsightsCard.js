import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getWaterStats, PARAMS, assessParam, paramStatusColor } from "../core";

// Free water-test analytics — average reading per parameter across your whole
// history, how often you test, and how many tests came back fully in range.
export function WaterInsightsCard({ waterTests = [], waterType = "fresh", onExport }) {
  const stats = getWaterStats(waterTests, waterType);
  if (!stats || !stats.averages.length) {
    return <Text style={styles.cardText}>Log a few water tests and your averages will appear here.</Text>;
  }

  // Share of tests where every provided reading graded "good".
  const params = PARAMS[waterType] || PARAMS.fresh;
  let clean = 0, evaluated = 0;
  for (const t of waterTests) {
    if (!t.values) continue;
    const provided = params.filter((p) => t.values[p.key] != null);
    if (!provided.length) continue;
    evaluated++;
    if (provided.every((p) => assessParam(p, t.values[p.key]).status === "good")) clean++;
  }
  const inRangePct = evaluated ? Math.round((clean / evaluated) * 100) : null;
  const pctColor = inRangePct == null ? theme.secondaryText : inRangePct >= 80 ? theme.accent : inRangePct >= 50 ? theme.warn : theme.danger;

  return (
    <View>
      {inRangePct != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, backgroundColor: theme.well, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: "800" }}>Tests fully in range</Text>
          <Text style={{ color: pctColor, fontSize: 18, fontWeight: "900" }}>{inRangePct}%</Text>
        </View>
      ) : null}
      <View style={styles.statGrid}>
        {stats.averages.map((a) => (
          <View key={a.key} style={styles.statBox}>
            <Text style={styles.statLabel}>{a.label} avg</Text>
            <Text style={[styles.statValue, { color: paramStatusColor(a.status) }]}>{a.avg}{a.unit ? ` ${a.unit}` : ""}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "700", marginTop: 12 }}>
        {stats.count} test{stats.count > 1 ? "s" : ""} logged{stats.cadence != null ? ` · about every ${stats.cadence} day${stats.cadence === 1 ? "" : "s"}` : ""}.
        {stats.cadence != null && stats.cadence > 10 ? " Testing a little more often will catch problems sooner." : stats.cadence != null ? " Great testing habit! 🧪" : ""}
      </Text>
      {onExport ? (
        <Pressable onPress={onExport} style={[styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>📤 Export water log (CSV)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
