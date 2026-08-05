import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { PARAMS, assessParam, paramStatusColor, tapHaptic } from "../core";

// Water-parameter trend charts — a premium payoff. Draws a lightweight sparkline
// (colored bars) per parameter from the test history, so you can see a value
// creeping the wrong way before it becomes a problem. No charting library —
// just Views, so it stays Expo-Go-friendly.
export function TrendsCard({ waterTests = [], waterType = "fresh", premiumUnlocked, onOpenPremium }) {
  const params = PARAMS[waterType] || PARAMS.fresh;
  // Oldest → newest for left-to-right reading.
  const series = [...waterTests].reverse();

  if (!premiumUnlocked) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ fontSize: 34 }}>📈</Text>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 8, textAlign: "center" }}>See your water trends</Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>Premium charts each parameter over time and warns you when a reading drifts the wrong way.</Text>
        <Pressable onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }} style={[styles.primaryBtn, { marginTop: 12, alignSelf: "stretch" }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Unlock with Premium</Text>
        </Pressable>
      </View>
    );
  }

  const withValues = (key) => series.filter((t) => t.values && t.values[key] != null).map((t) => Number(t.values[key]));
  if (series.length < 2) {
    return <Text style={styles.cardText}>Log at least two water tests and your trends will chart here.</Text>;
  }

  return (
    <View style={{ gap: 16 }}>
      {params.map((p) => {
        const vals = withValues(p.key);
        if (!vals.length) return null;
        const latest = vals[vals.length - 1];
        const prev = vals.length > 1 ? vals[vals.length - 2] : latest;
        const trend = latest > prev ? "↑" : latest < prev ? "↓" : "→";
        const scale = Math.max(p.caution[1] || 1, ...vals) || 1;
        const status = assessParam(p, latest).status;
        return (
          <View key={p.key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: "900" }}>{p.label}</Text>
              <Text style={{ color: paramStatusColor(status), fontSize: 13, fontWeight: "900" }}>{latest}{p.unit ? ` ${p.unit}` : ""} {trend}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 46, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 6, borderWidth: 1, borderColor: theme.hairline }}>
              {(() => { const bars = vals.slice(-16); const n = bars.length; return bars.map((v, i) => {
                const h = Math.max(3, Math.round((v / scale) * 32));
                const c = paramStatusColor(assessParam(p, v).status);
                const isLast = i === n - 1;
                const op = n > 1 ? 0.5 + (i / (n - 1)) * 0.5 : 1;
                return <View key={i} style={{ flex: 1, height: h, backgroundColor: c, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderRadius: 2, opacity: op, ...(isLast ? { shadowColor: c, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } } : null) }} />;
              }); })()}
            </View>
            <Text style={{ color: theme.secondaryText, fontSize: 10, fontWeight: "700", marginTop: 4 }}>Target {p.ideal}</Text>
          </View>
        );
      })}
    </View>
  );
}
