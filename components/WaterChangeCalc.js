import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { summarise } from "../lib/waterChanges";
import { formatVolume } from "../lib/units";
import { sourceValuesFor, explainsStubborn } from "../lib/sourceWater";
import { getRecommendedChangePercent } from "../core";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";

// Water-change calculator — answers the question every aquarist asks: "how big a
// water change do I need to bring nitrate down?" Dilution math: a p% change
// multiplies a parameter by (1 − p). Pre-fills the current value from your last
// logged nitrate.
function Stat({ label, value, sub, tone }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 9, paddingVertical: 9 }}>
      <Text numberOfLines={1} style={{ color: tone || "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: theme.secondaryText, fontSize: 9.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
      {sub ? <Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

export function WaterChangeCalc({ waterChanges = [], everyDays = 7, tankGallons = 20, waterTests = [], onLogChange, tank = {}, waterType = "fresh" }) {
  const [logged, setLogged] = useState(false);
  const lastNitrate = (() => {
    for (const t of waterTests) if (t.values && t.values.nitrate != null) return t.values.nitrate;
    return null;
  })();
  const [current, setCurrent] = useState(lastNitrate != null ? String(lastNitrate) : "");
  const [target, setTarget] = useState("10");

  // What's in the replacement water. The old arithmetic was `1 - target/current`,
  // which silently assumes the new water is pure — so a keeper with 20ppm out
  // of the tap was told a 75% change would take them from 40 to 10, a result
  // that is not merely optimistic but arithmetically impossible. No amount of
  // water changing gets a tank below its source.
  const sourceNitrate = Number(sourceValuesFor(tank).nitrate) || 0;

  const c = Number(current), tg = Number(target);
  const valid = current !== "" && target !== "" && !Number.isNaN(c) && !Number.isNaN(tg) && c > 0;
  let pct = 0, gal = 0;
  let msg = "Enter your current and target nitrate (ppm).";
  let unreachable = false;
  if (valid) {
    if (c <= tg) msg = "You're already at or below target — no change needed. 🎉";
    else if (tg <= sourceNitrate) {
      // The honest answer, and the one that stops somebody changing water
      // every weekend for a year wondering why nothing moves.
      unreachable = true;
      msg = null;
    } else {
      // Dilution toward the source rather than toward zero:
      //   after = current(1 - f) + source·f  →  f = (current - target) / (current - source)
      const fraction = (c - tg) / (c - sourceNitrate);
      pct = Math.min(90, Math.max(1, Math.round(fraction * 100)));
      gal = Math.round((pct / 100) * tankGallons * 10) / 10;
      msg = null;
    }
  }

  const field = (label, val, set) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 4 }}>{label}</Text>
      <TextInput value={val} onChangeText={(t) => set(decimalText(t))} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={theme.secondaryText}
        style={{ backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 16, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} 
            maxLength={TEXT_LIMITS.number}
          />
    </View>
  );

  // The nitrate figure above answers one parameter. This asks the whole
  // question — the smallest change that brings every diluting parameter back
  // into range, against this tank's actual source water. It has existed since
  // it was written and nothing has ever called it.
  const wholeTank = getRecommendedChangePercent({
    waterTests,
    waterType,
    sourceValues: sourceValuesFor(tank),
    stockedNames: tank.stock || [],
  });

  const history = summarise(waterChanges, { tankGallons, everyDays });

  return (
    <View>
      {/* What actually happened, above the calculator for what to do next.
          Water changes were only ever written into journal prose, so none of
          this could be asked of the data before. */}
      {history.count ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Stat label="Last change" value={history.last === 0 ? "Today" : `${history.last}d ago`} />
          <Stat
            label="Changed (30d)"
            value={history.volume30 ? formatVolume(history.volume30) : "—"}
            sub={history.turnover30 != null ? `${history.turnover30}% of tank` : null}
          />
          <Stat
            label="Typical size"
            value={history.average != null ? `${history.average}%` : "—"}
            sub={history.cadence.ok ? "On schedule" : `${history.cadence.actual} of ~${history.cadence.expected}`}
            tone={history.cadence.ok ? undefined : theme.warn}
          />
        </View>
      ) : null}

      <Text style={styles.cardText}>How big a water change to lower your nitrate — sized to your {formatVolume(tankGallons)} tank{sourceNitrate ? `, and to the ${sourceNitrate} ppm in your source water` : ""}.</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        {field("Current nitrate (ppm)", current, setCurrent)}
        {field("Target nitrate (ppm)", target, setTarget)}
      </View>

      {unreachable ? (
        <View style={{ marginTop: 14, backgroundColor: "rgba(255,216,107,0.10)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,216,107,0.35)", padding: 13 }}>
          <Text style={{ color: theme.warn, fontSize: 13.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>No water change reaches {tg} ppm</Text>
          <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 5 }}>
            Your source water reads {sourceNitrate} ppm, so that's the floor — even a 100% change lands there. {explainsStubborn(tank, "nitrate") ? "" : "Aim above it, or use RO water for changes."}
          </Text>
          {explainsStubborn(tank, "nitrate") ? (
            <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 5 }}>
              {explainsStubborn(tank, "nitrate")}
            </Text>
          ) : null}
        </View>
      ) : valid && msg == null ? (
        <View style={{ marginTop: 14, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: theme.accent, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
          <LinearGradient colors={["rgba(56,225,198,0.18)", "rgba(56,225,198,0.04)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: theme.accent, fontSize: 38, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{pct}%</Text>
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>≈ {formatVolume(gal)}</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4, textAlign: "center" }}>Change this much to drop nitrate from {c} → {tg} ppm.</Text>
          </LinearGradient>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 14 }}>{msg}</Text>
      )}

      {onLogChange ? (
        <Pressable
          onPress={() => { tapHaptic("medium"); onLogChange(valid && msg == null ? { pct, gallons: gal } : null); setLogged(true); setTimeout(() => setLogged(false), 2200); }}
          style={[logged ? styles.ghostBtn : styles.primaryBtn, { marginTop: 14 }]}
          accessibilityRole="button"
          accessibilityLabel={valid && msg == null ? `Log a ${pct}% water change, about ${formatVolume(gal)}` : "Log a water change"}
        >
          {/* The copy names all three things it does now — it records the
              change itself, not just the tick and the note. */}
          <Text style={logged ? styles.ghostBtnText : styles.primaryBtnText}>{logged ? "✓ Recorded" : "✅ Log this water change"}</Text>
        </Pressable>
      ) : null}

      {wholeTank ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 11 }}>
          <Text style={{ color: theme.accent, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>{wholeTank}%</Text>
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>
            is the smallest change that brings every parameter back into range, not just nitrate.
          </Text>
        </View>
      ) : null}

      {valid ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 6 }]}>Quick changes</Text>
          {[25, 50].map((p) => (
            <View key={p} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p}% change ({formatVolume(Math.round((p / 100) * tankGallons * 10) / 10)})</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>nitrate → {Math.round((c * (1 - p / 100) + sourceNitrate * (p / 100)) * 10) / 10} ppm</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
