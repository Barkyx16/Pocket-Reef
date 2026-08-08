import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import { PARAMS, assessParam, paramStatusColor, getTodayKey, tapHaptic } from "../core";

// Log a water test and get an instant read on each parameter — the aquarium
// equivalent of Pocket Planter's watering log. Values assess live as you type.
export function WaterTestCard({ waterType = "fresh", history = [], onLog }) {
  const params = PARAMS[waterType] || PARAMS.fresh;
  const [vals, setVals] = useState({});

  const filled = params.some((p) => vals[p.key] != null && vals[p.key] !== "");

  const prefillLast = () => {
    const last = history[0];
    if (!last || !last.values) return;
    tapHaptic("light");
    const next = {};
    params.forEach((p) => { if (last.values[p.key] != null) next[p.key] = String(last.values[p.key]); });
    setVals(next);
  };

  const submit = () => {
    if (!filled) return;
    tapHaptic("medium");
    const entry = { date: getTodayKey(), water: waterType, values: {} };
    params.forEach((p) => { if (vals[p.key] !== "" && vals[p.key] != null) entry.values[p.key] = Number(vals[p.key]); });
    onLog(entry);
    setVals({});
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={[styles.cardText, { flex: 1, marginTop: 0 }]}>Enter today's readings — each grades itself against the {waterType === "salt" ? "reef" : "freshwater"} safe range.</Text>
        {history[0] && history[0].values ? (
          <Pressable onPress={prefillLast} hitSlop={6} accessibilityRole="button" accessibilityLabel="Prefill with last readings">
            <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>↺ Use last</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Two columns. Six full-width rows ran past the fold on a phone, so the
          submit button — the whole point of the card — was never visible while
          filling it in. Rows are shorter too: the target range now sits inside
          the field as a placeholder instead of taking its own line. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {params.map((p) => {
          const a = assessParam(p, vals[p.key]);
          const c = paramStatusColor(a.status);
          return (
            <View key={p.key} style={{ width: "48.5%", backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: a.status === "none" ? theme.border : `${c}55`, paddingHorizontal: 10, paddingVertical: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: theme.text, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                {/* Verdict sits beside the label, not below the field — in a
                    narrow column it would otherwise add a third line to every
                    tile and undo the compaction. */}
                {a.status !== "none" ? (
                  <Text style={{ color: c, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase" }}>
                    {a.status === "good" ? "Good" : a.status === "caution" ? "Watch" : "High"}
                  </Text>
                ) : (
                  <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{p.unit}</Text>
                )}
              </View>
              <TextInput
                value={vals[p.key] ?? ""}
                onChangeText={(t) => setVals((v) => ({ ...v, [p.key]: t.replace(/[^0-9.]/g, "") }))}
                keyboardType="decimal-pad"
                placeholder={p.ideal}
                placeholderTextColor="rgba(165,212,234,0.42)"
                style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6, color: theme.text, borderWidth: 1, borderColor: a.status === "none" ? theme.border : c, fontSize: 15, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
              />

            </View>
          );
        })}
      </View>

      {(() => {
        const issues = params.filter((p) => {
          const st = assessParam(p, vals[p.key]).status;
          return st === "caution" || st === "danger";
        });
        if (!issues.length) return null;
        return (
          <View style={{ marginTop: 12, backgroundColor: "rgba(255,216,107,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,216,107,0.24)" }}>
            <Text style={{ color: theme.warn, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", marginBottom: 2 }}>⚠️ Watch these</Text>
            {issues.map((p) => (
              <Text key={p.key} style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18, marginTop: 4 }}>
                <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.label}: </Text>{p.tip}
              </Text>
            ))}
          </View>
        );
      })()}

      <Pressable onPress={submit} disabled={!filled} style={[filled ? styles.primaryBtn : styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
        <Text style={filled ? styles.primaryBtnText : styles.ghostBtnText}>Log test</Text>
      </Pressable>

      {/* HISTORY */}
      {history.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 8 }]}>Recent tests</Text>
          {history.slice(0, 6).map((h, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", width: 78 }}>{h.date}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                {(PARAMS[h.water] || PARAMS.fresh).map((p) => {
                  if (h.values[p.key] == null) return null;
                  const a = assessParam(p, h.values[p.key]);
                  const c = paramStatusColor(a.status);
                  return (
                    <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${c}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                      <Text style={{ color: c, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }}>{h.values[p.key]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
