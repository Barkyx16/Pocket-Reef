import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { displayParams } from "../lib/targets";
import { tempFromInput } from "../lib/units";
import { AGE_OPTIONS, buildSetup, whatsMissing } from "../lib/existingTank";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";

// The short path for a tank that already exists.
//
// Onboarding hands over a tank dated today with nothing in it, which is right
// for a first tank and wrong for nearly everybody who downloads an aquarium
// app — people go looking for one when they already have a tank and it's
// already a problem. For them the app opens on a three-year-old reef presented
// as brand new, and everything it says on day one is wrong.
export function ExistingTankCard({ tank = {}, waterType = "fresh", onApply, onGoToTab }) {
  const [ageId, setAgeId] = useState("months");
  const [readings, setReadings] = useState({});
  const [applied, setApplied] = useState(false);

  const params = displayParams(waterType);
  const missing = useMemo(() => whatsMissing(tank), [tank]);
  const filled = params.some((p) => readings[p.key] != null && readings[p.key] !== "");

  const apply = () => {
    tapHaptic("medium");
    // Temperature is typed in the keeper's unit and stored in °F, same as the
    // main test form — a metric keeper's 26 must not land as 26°F.
    const values = {};
    params.forEach((p) => {
      const raw = readings[p.key];
      if (raw == null || raw === "") return;
      values[p.key] = p.key === "temp" ? tempFromInput(raw) : raw;
    });
    onApply && onApply(buildSetup({ ageId, water: waterType, readings: values }));
    successHaptic();
    setApplied(true);
  };

  if (applied) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 10 }}>
        <Ionicons name="checkmark-circle" size={28} color={theme.accent} />
        <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 8 }}>Tank dated and logged</Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>
          Maturity, health and the cycle tracker now start from the truth rather than from today.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.cardText}>
        Already running? Tell Pocket Reef how long and what it reads, and every score, forecast and maturity figure starts from reality instead of day zero.
      </Text>

      <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 14 }}>How long has it been running?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {AGE_OPTIONS.map((a) => (
          <Pill key={a.id} label={a.label} active={ageId === a.id} onPress={() => { tapHaptic("light"); setAgeId(a.id); }} />
        ))}
      </View>

      <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 16 }}>Where does it sit today?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {params.map((p) => (
          <View key={p.key} style={{ width: "48.5%" }}>
            <Text style={{ color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 4 }}>{p.label}</Text>
            <TextInput
              value={readings[p.key] ?? ""}
              onChangeText={(t) => setReadings((v) => ({ ...v, [p.key]: t.replace(/[^0-9.]/g, "") }))}
              keyboardType="decimal-pad"
              placeholder={p.ideal}
              placeholderTextColor="rgba(165,212,234,0.42)"
              accessibilityLabel={`${p.label} today`}
              style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 15, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
            
            maxLength={TEXT_LIMITS.number}
          />
          </View>
        ))}
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>
        Blanks are fine — whatever you have to hand.
      </Text>

      <Pressable onPress={apply} style={[styles.primaryBtn, { marginTop: 14 }]} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>{filled ? "Set up my existing tank" : "Set the age"}</Text>
      </Pressable>

      {/* What's still missing, and what each one actually unlocks. "Add more
          data" without a reason is how a setup screen gets abandoned. */}
      {missing.length ? (
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Still to fill in</Text>
          <View style={{ gap: 7, marginTop: 8 }}>
            {missing.map((m) => (
              <View key={m.id} style={{ flexDirection: "row", gap: 8 }}>
                <Ionicons name="ellipse-outline" size={12} color={theme.secondaryText} style={{ marginTop: 3 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{m.label}</Text>
                  <Text style={{ color: theme.bodyText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16 }}>{m.why}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
