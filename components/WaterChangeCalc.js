import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// Water-change calculator — answers the question every aquarist asks: "how big a
// water change do I need to bring nitrate down?" Dilution math: a p% change
// multiplies a parameter by (1 − p). Pre-fills the current value from your last
// logged nitrate.
export function WaterChangeCalc({ tankGallons = 20, waterTests = [], onLogChange }) {
  const [logged, setLogged] = useState(false);
  const lastNitrate = (() => {
    for (const t of waterTests) if (t.values && t.values.nitrate != null) return t.values.nitrate;
    return null;
  })();
  const [current, setCurrent] = useState(lastNitrate != null ? String(lastNitrate) : "");
  const [target, setTarget] = useState("10");

  const c = Number(current), tg = Number(target);
  const valid = current !== "" && target !== "" && !Number.isNaN(c) && !Number.isNaN(tg) && c > 0;
  let pct = 0, gal = 0;
  let msg = "Enter your current and target nitrate (ppm).";
  if (valid) {
    if (c <= tg) msg = "You're already at or below target — no change needed. 🎉";
    else {
      pct = Math.min(90, Math.round((1 - tg / c) * 100));
      gal = Math.round((pct / 100) * tankGallons * 10) / 10;
      msg = null;
    }
  }

  const field = (label, val, set) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>{label}</Text>
      <TextInput value={val} onChangeText={(t) => set(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={theme.secondaryText}
        style={{ backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 16, fontWeight: "800" }} />
    </View>
  );

  return (
    <View>
      <Text style={styles.cardText}>How big a water change to lower your nitrate — sized to your {tankGallons} gal tank.</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        {field("Current nitrate (ppm)", current, setCurrent)}
        {field("Target nitrate (ppm)", target, setTarget)}
      </View>

      {valid && msg == null ? (
        <View style={{ marginTop: 14, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", shadowColor: theme.accent, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
          <LinearGradient colors={["rgba(56,225,198,0.18)", "rgba(56,225,198,0.04)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: theme.accent, fontSize: 38, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{pct}%</Text>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>≈ {gal} gallons</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "700", marginTop: 4, textAlign: "center" }}>Change this much to drop nitrate from {c} → {tg} ppm.</Text>
          </LinearGradient>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "700", marginTop: 14 }}>{msg}</Text>
      )}

      {onLogChange ? (
        <Pressable
          onPress={() => { tapHaptic("medium"); onLogChange(valid && msg == null ? { pct, gallons: gal } : null); setLogged(true); setTimeout(() => setLogged(false), 2200); }}
          style={[logged ? styles.ghostBtn : styles.primaryBtn, { marginTop: 14 }]}
          accessibilityRole="button"
        >
          <Text style={logged ? styles.ghostBtnText : styles.primaryBtnText}>{logged ? "✓ Logged to journal & maintenance" : "✅ Log this water change"}</Text>
        </Pressable>
      ) : null}

      {valid ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 6 }]}>Quick changes</Text>
          {[25, 50].map((p) => (
            <View key={p} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: "800" }}>{p}% change ({Math.round((p / 100) * tankGallons * 10) / 10} gal)</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "800" }}>nitrate → {Math.round(c * (1 - p / 100) * 10) / 10} ppm</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
