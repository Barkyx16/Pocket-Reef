import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { displayParams } from "../lib/targets";
import { SOURCE_KINDS, SOURCE_KEYS, kindOf, newSourceProfile, analyseSource } from "../lib/sourceWater";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";

// One test of the water going IN, and what it means for every change coming out.
//
// This is the reading nobody takes and everybody needs. A keeper with 20ppm out
// of the tap can do a water change every weekend for a year and never move
// their nitrate — and until now the app agreed with them that it should have
// worked.
export function SourceWaterCard({ tank = {}, waterType = "fresh", onSave }) {
  const profile = tank.sourceWater;
  const [editing, setEditing] = useState(!profile);
  const [kind, setKind] = useState((profile && profile.kind) || "tap");
  const [vals, setVals] = useState(() => {
    const v = {};
    Object.entries((profile && profile.values) || {}).forEach(([k, n]) => { v[k] = String(n); });
    return v;
  });

  const params = displayParams(waterType).filter((p) => SOURCE_KEYS.includes(p.key));
  const analysis = useMemo(() => analyseSource(tank, waterType), [tank, waterType]);
  const filled = params.some((p) => vals[p.key] != null && vals[p.key] !== "");

  const save = () => {
    if (!filled) return;
    tapHaptic("medium");
    const values = {};
    params.forEach((p) => { if (vals[p.key] !== "" && vals[p.key] != null) values[p.key] = Number(vals[p.key]); });
    onSave && onSave(newSourceProfile({ kind, values }));
    setEditing(false);
  };

  return (
    <View>
      {!editing && analysis.ok ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: analysis.clean ? "rgba(56,225,198,0.10)" : "rgba(255,216,107,0.10)", borderRadius: radius.lg, borderWidth: 1, borderColor: analysis.clean ? "rgba(56,225,198,0.35)" : "rgba(255,216,107,0.35)", padding: 12 }}>
            <Ionicons name={analysis.clean ? "checkmark-circle" : "alert-circle"} size={16} color={analysis.clean ? theme.accent : theme.warn} />
            <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>{analysis.headline}</Text>
          </View>

          <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 10 }}>
            {analysis.kindLabel} · tested {analysis.testedAt}
          </Text>

          <View style={{ gap: 8, marginTop: 10 }}>
            {analysis.findings.map((f) => (
              <View key={f.key} style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: f.harmful ? `${theme.warn}55` : theme.border, padding: 11 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{f.label}</Text>
                  <Text style={{ color: f.harmful ? theme.warn : theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                    {f.source}{f.unit ? ` ${f.unit}` : ""}
                  </Text>
                  {f.tankNow != null ? (
                    <Text style={{ flex: 1, textAlign: "right", color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>tank {f.tankNow}</Text>
                  ) : null}
                </View>
                <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 4 }}>{f.note}</Text>
              </View>
            ))}
          </View>

          {analysis.advice ? (
            <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 17, marginTop: 10 }}>{analysis.advice}</Text>
          ) : null}

          <Pressable onPress={() => { tapHaptic(); setEditing(true); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Update source water</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.cardText}>
            Test what comes out of the tap or the RODI unit once. Every water-change prediction in the app assumes this is pure — and if it isn't, that's the reason a reading won't come down however often you change water.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {SOURCE_KINDS.map((k) => (
              <Pill key={k.id} label={k.label} active={kind === k.id} onPress={() => { tapHaptic("light"); setKind(k.id); }} />
            ))}
          </View>
          <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16, marginTop: 6 }}>{kindOf(kind).blurb}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {params.map((p) => (
              <View key={p.key} style={{ width: "48.5%" }}>
                <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 4 }}>{p.label}</Text>
                <TextInput
                  value={vals[p.key] ?? ""}
                  onChangeText={(t) => setVals((v) => ({ ...v, [p.key]: decimalText(t) }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.secondaryText}
                  accessibilityLabel={`${p.label} in your source water`}
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.bodyLg, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
                
            maxLength={TEXT_LIMITS.number}
          />
              </View>
            ))}
          </View>

          <Pressable onPress={save} disabled={!filled} style={[filled ? styles.primaryBtn : styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
            <Text style={filled ? styles.primaryBtnText : styles.ghostBtnText}>{filled ? "Save source water" : "Enter at least one reading"}</Text>
          </Pressable>
          {profile ? (
            <Pressable onPress={() => setEditing(false)} style={styles.authLinkBtn} accessibilityRole="button">
              <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Cancel</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
