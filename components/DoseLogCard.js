import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { REEF_TARGETS } from "../lib/dosing";
import {
  DOSABLE, newDose, consumptionRate, maintenanceDose,
  describeConsumption, dosedToday,
} from "../lib/dosingLog";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { TEXT_LIMITS } from "../lib/textLimits";
import { fmt } from "../lib/format";

// What you dosed, and what your tank actually uses.
//
// The correction calculator answers "I'm low, how much do I add?". This answers
// the question that follows it every day after: "how much does my tank use, so
// it never gets low again?" That number can't be looked up — it's a property of
// your corals, your volume and your lights, and the only way to it is your own
// tests plus your own dose history. The app had the tests and threw the doses
// away.
//
// The strength field is per-supplement and unavoidable: every bottle is
// different, and inventing a default would be a confidently wrong number
// driving alkalinity, which is how corals get burned.
export function DoseLogCard({
  tank = {}, tankGallons, waterTests = [], strengths = {}, onLogDose, onDeleteDose, onSetStrength,
}) {
  const doses = tank.doses || [];
  const [amounts, setAmounts] = useState({});
  const [showStrength, setShowStrength] = useState(null);

  const today = dosedToday(doses);
  // Individual entries, newest first — a day-total row reads nicely but leaves
  // nothing to correct, and a mistyped 200ml skews the consumption rate that
  // the whole card exists to produce.
  const recent = [...doses]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))
    .slice(0, 12);

  const log = (key) => {
    const dose = newDose({ key, ml: amounts[key] });
    if (!dose) return;
    successHaptic();
    onLogDose(dose);
    setAmounts((a) => ({ ...a, [key]: "" }));
  };

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0 }]}>
        Log what you dose and Pocket Reef works out what your tank actually uses each day — the number that keeps it steady instead of chasing it.
      </Text>

      {DOSABLE.map((key) => {
        const target = REEF_TARGETS[key];
        const strength = strengths[key];
        const rate = consumptionRate({
          key, waterTests, doses, ratedGallons: tankGallons, strengthPerUnit: strength,
        });
        const daily = rate.ok ? maintenanceDose({ perDay: rate.perDay, ratedGallons: tankGallons, strengthPerUnit: strength }) : null;
        const doneToday = today.includes(key);

        return (
          <View key={key} style={{ marginTop: 14, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flex: 1, color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {target.label}
              </Text>
              {doneToday ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={13} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>Dosed today</Text>
                </View>
              ) : null}
            </View>

            {/* The finding, stated plainly — or the specific reason there isn't
                one yet, never a blank or a fabricated figure. */}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: rate.ok ? theme.bodyText : theme.secondaryText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 17 }}>
              {describeConsumption(key, rate)}
            </Text>

            {daily ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", paddingHorizontal: 10, paddingVertical: 8 }}>
                <Ionicons name="repeat" size={13} color={theme.accent} />
                <Text style={{ flex: 1, color: theme.accent, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  Dose {daily} ml/day to hold steady
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <TextInput
                value={amounts[key] ?? ""}
                onChangeText={(v) => setAmounts((a) => ({ ...a, [key]: v.replace(/[^0-9.]/g, "") }))}
                keyboardType="decimal-pad"
                placeholder={daily ? String(daily) : "ml"}
                placeholderTextColor={theme.secondaryText}
                style={{ width: 76, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}
                accessibilityLabel={`Millilitres of ${target.label} dosed`}
              
            maxLength={TEXT_LIMITS.number}
          />
              <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>ml</Text>

              <Pressable
                onPress={() => log(key)}
                disabled={!amounts[key]}
                style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: amounts[key] ? theme.accent : "rgba(255,255,255,0.06)" }, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={`Log ${target.label} dose`}
                accessibilityState={{ disabled: !amounts[key] }}
              >
                <Text style={{ color: amounts[key] ? theme.onAccent : theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Log</Text>
              </Pressable>

              <Pressable
                onPress={() => { tapHaptic("light"); setShowStrength(showStrength === key ? null : key); }}
                hitSlop={touchSlop(28)}
                style={{ marginLeft: "auto" }}
                accessibilityRole="button"
                accessibilityLabel={`Set ${target.label} product strength`}
              >
                <Ionicons name={strength ? "flask" : "flask-outline"} size={16} color={strength ? theme.accent : theme.secondaryText} />
              </Pressable>
            </View>

            {showStrength === key ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 17 }}>
                  How much does 1 ml raise {target.label.toLowerCase()} in 1 gallon? It's on the bottle — every product differs, so there's no sensible default.
                </Text>
                <TextInput
                  defaultValue={strength ? String(strength) : ""}
                  onChangeText={(v) => onSetStrength(key, v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder={`e.g. 0.05 ${target.unit}`}
                  placeholderTextColor={theme.secondaryText}
                  style={{ marginTop: 8, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
                  accessibilityLabel={`${target.label} product strength, ${target.unit} per millilitre per gallon`}
                
            maxLength={TEXT_LIMITS.number}
          />
              </View>
            ) : null}
          </View>
        );
      })}

      {/* THE LOG */}
      {recent.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 8 }]}>Recent doses</Text>
          <View style={{ gap: 6 }}>
            {recent.map((d) => (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, borderWidth: 1, borderColor: theme.hairline, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", width: 78 }}>{d.date}</Text>
                <Text numberOfLines={1} style={{ flex: 1, color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  {(REEF_TARGETS[d.key] || {}).label} {d.ml}ml
                </Text>
                {onDeleteDose ? (
                  <Pressable
                    onPress={() => onDeleteDose(d.id)}
                    hitSlop={touchSlop(20)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete the ${fmt(d.ml)}ml ${(REEF_TARGETS[d.key] || {}).label} dose from ${d.date}`}
                  >
                    <Ionicons name="close" size={13} color={theme.secondaryText} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
