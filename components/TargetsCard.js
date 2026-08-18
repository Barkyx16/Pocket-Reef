import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { getPresets, builtInParam, effectiveParams, customisedKeys, applyPreset, formatIdeal, validTarget } from "../lib/targets";
import { MAX_FONT_SCALE_COMPACT, touchSlop } from "../lib/a11y";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";

// Your tank's targets, not the app's.
//
// Nitrate "good" was 0–20 for every reef on earth. An SPS tank runs 2–5, a
// mixed reef 10, a fish-only system 40 with nothing wrong — so three of those
// four keepers were being told a healthy tank was out of range. Once an app is
// wrong about your water you stop trusting the rest of it, and a reading graded
// against someone else's tank is worse than an ungraded number.
//
// Presets first, because typing twenty numbers is a worse start than naming the
// tank you're running. Per-parameter overrides underneath for the keepers who
// know exactly what they're chasing.
export function TargetsCard({ waterType = "fresh", targets = {}, onSetTarget, onSetAll }) {
  const [editing, setEditing] = useState(null); // parameter key
  const [draft, setDraft] = useState({ lo: "", hi: "" });

  const params = effectiveParams(waterType, targets);
  const custom = customisedKeys(targets);
  const presets = getPresets(waterType);

  const startEdit = (p) => {
    tapHaptic("light");
    setEditing(p.key);
    setDraft({ lo: String(p.good[0]), hi: String(p.good[1]) });
  };

  const commit = (p) => {
    const lo = Number(draft.lo);
    const hi = Number(draft.hi);
    const next = { good: [lo, hi] };
    // A backwards or non-numeric range is silently dropped rather than stored —
    // a target of 12–8 would grade every reading as danger forever.
    if (validTarget(next)) {
      successHaptic();
      onSetTarget(p.key, next);
    }
    setEditing(null);
  };

  const resetOne = (key) => { tapHaptic(); onSetTarget(key, null); setEditing(null); };
  const resetAll = () => { tapHaptic("medium"); onSetAll({}); setEditing(null); };

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0 }]}>
        Every reading is graded against these. The defaults are a sensible general range — set them to what you actually run and the whole app follows.
      </Text>

      {/* PRESETS */}
      <Text style={[styles.cardEyebrow, { marginTop: 16, marginBottom: 8 }]}>Start from a tank type</Text>
      <View style={{ gap: 6 }}>
        {presets.map((preset) => (
          <Pressable
            key={preset.id}
            onPress={() => { tapHaptic("medium"); onSetAll(applyPreset(targets, preset)); }}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 11, paddingVertical: 10 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel={`Use ${preset.label} targets`}
            accessibilityHint={preset.blurb}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 13.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{preset.label}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{preset.blurb}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
          </Pressable>
        ))}
      </View>
      {/* Says plainly that a preset won't stamp on work you've already done. */}
      <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 8, lineHeight: 17 }}>
        A preset fills in the parameters you haven't set yourself — anything you've hand-tuned is left alone.
      </Text>

      {/* PER-PARAMETER */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 8 }}>
        <Text style={[styles.cardEyebrow, { flex: 1 }]}>Your ranges</Text>
        {custom.length ? (
          <Pressable onPress={resetAll} hitSlop={touchSlop(28)} accessibilityRole="button" accessibilityLabel="Reset every target to the default">
            <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Reset all</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {params.map((p) => {
          const isEditing = editing === p.key;
          const isCustom = !!p.custom;
          const builtIn = builtInParam(waterType, p.key);
          return (
            <View key={p.key} style={{ backgroundColor: isCustom ? "rgba(56,225,198,0.08)" : theme.well, borderRadius: 12, borderWidth: 1, borderColor: isCustom ? "rgba(56,225,198,0.30)" : theme.border, paddingHorizontal: 11, paddingVertical: 10 }}>
              <Pressable
                onPress={() => (isEditing ? setEditing(null) : startEdit(p))}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${p.label} target, currently ${p.ideal}`}
                accessibilityHint="Opens the range editor"
              >
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flex: 1, color: theme.text, fontSize: 13.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: isCustom ? theme.accent : theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.ideal}</Text>
                <Ionicons name={isEditing ? "chevron-down" : "create-outline"} size={14} color={isCustom ? theme.accent : theme.secondaryText} />
              </Pressable>

              {isEditing ? (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TextInput
                      value={draft.lo}
                      onChangeText={(v) => setDraft((d) => ({ ...d, lo: decimalText(v) }))}
                      keyboardType="decimal-pad"
                      style={rangeInput}
                      accessibilityLabel={`${p.label} minimum`}
                    
            maxLength={TEXT_LIMITS.number}
          />
                    <Text style={{ color: theme.secondaryText, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>–</Text>
                    <TextInput
                      value={draft.hi}
                      onChangeText={(v) => setDraft((d) => ({ ...d, hi: decimalText(v) }))}
                      keyboardType="decimal-pad"
                      style={rangeInput}
                      accessibilityLabel={`${p.label} maximum`}
                    
            maxLength={TEXT_LIMITS.number}
          />
                    <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", width: 40 }}>{p.unit}</Text>
                    <Pressable onPress={() => commit(p)} style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.accent }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Save ${p.label} target`}>
                      <Text style={{ color: theme.onAccent, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Set</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600" }}>
                      Default is {builtIn ? formatIdeal(builtIn.good, builtIn.unit) : "—"}
                    </Text>
                    {isCustom ? (
                      <Pressable onPress={() => resetOne(p.key)} hitSlop={touchSlop(28)} accessibilityRole="button" accessibilityLabel={`Reset ${p.label} to the default`}>
                        <Text style={{ color: theme.accent, fontSize: 11.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Use default</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {custom.length ? (
        <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 10, lineHeight: 17 }}>
          {custom.length} parameter{custom.length === 1 ? "" : "s"} set to your tank. Trends, the health score and today's actions all use these.
        </Text>
      ) : null}
    </View>
  );
}

const rangeInput = {
  width: 62, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
  paddingHorizontal: 10, paddingVertical: 7, color: theme.text,
  borderWidth: 1, borderColor: theme.border, fontSize: 14,
  fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center",
};
