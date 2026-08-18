import { useMemo, useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { buildSitterPlan, sitterSheet, preparationSteps, SAFE_ALONE_DAYS } from "../lib/vacation";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";

// Going away, and handing the tank over.
//
// The sheet is the deliverable. It exists to be shared into a text message or
// printed and stuck on the cabinet, so it's plain text and it leads with what
// NOT to do — that list prevents more deaths than the feeding instructions.
const TRIPS = [3, 7, 14, 21];

export function VacationCard({ tank = {}, waterType = "fresh" }) {
  const [days, setDays] = useState(7);
  const [sitterName, setSitterName] = useState("");
  const [contact, setContact] = useState("");
  const [showPrep, setShowPrep] = useState(false);

  const plan = useMemo(
    () => buildSitterPlan(tank, { days, sitterName, contact, waterType }),
    [tank, days, sitterName, contact, waterType]
  );
  const prep = useMemo(() => preparationSteps(tank, days), [tank, days]);

  const share = () => {
    tapHaptic("medium");
    Share.share({ message: sitterSheet(plan) }).catch(() => {});
  };

  return (
    <View>
      <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>How long are you away?</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {TRIPS.map((d) => (
          <Pill key={d} label={`${d} days`} active={days === d} onPress={() => { tapHaptic("light"); setDays(d); }} />
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, backgroundColor: plan.unattended ? "rgba(56,225,198,0.10)" : "rgba(255,216,107,0.10)", borderRadius: 14, borderWidth: 1, borderColor: plan.unattended ? "rgba(56,225,198,0.35)" : "rgba(255,216,107,0.35)", padding: 12 }}>
        <Ionicons name={plan.unattended ? "checkmark-circle" : "person-outline"} size={16} color={plan.unattended ? theme.accent : theme.warn} />
        <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>{plan.headline}</Text>
      </View>

      {/* The half that actually prevents the disaster, and happens days early. */}
      <Pressable onPress={() => { tapHaptic("light"); setShowPrep((v) => !v); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }} accessibilityRole="button" accessibilityLabel="Before you go">
        <Ionicons name={showPrep ? "chevron-down" : "chevron-forward"} size={13} color={theme.accent} />
        <Text style={{ color: theme.accent, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Before you go ({prep.length})</Text>
      </Pressable>
      {showPrep ? (
        <View style={{ gap: 7, marginTop: 8 }}>
          {prep.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", width: 78 }}>{s.when}</Text>
              <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>{s.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!plan.unattended ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <TextInput
              value={sitterName}
              onChangeText={setSitterName}
              placeholder="Who's looking after it?"
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Sitter's name"
              style={[styles.authInput, { flex: 1 }]}
            
            maxLength={TEXT_LIMITS.name}
          />
          </View>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="Your number, for the call-me list"
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="Your contact details"
            style={[styles.authInput, { marginTop: 8 }]}
          
            maxLength={TEXT_LIMITS.phone}
          />

          <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 14 }}>Each day</Text>
          {plan.doList.map((d, i) => (
            <Text key={i} style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 4 }}>• {d}</Text>
          ))}
        </>
      ) : null}

      {/* Always shown, trip length regardless — a four-day trip still needs the
          neighbour with a key to leave the tank alone. */}
      <Text style={{ color: theme.danger, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 14 }}>Please don't</Text>
      {plan.dontList.map((d, i) => (
        <Text key={i} style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 4 }}>• {d}</Text>
      ))}

      <Pressable onPress={share} style={[styles.primaryBtn, { marginTop: 16 }]} accessibilityRole="button" accessibilityLabel="Share the care notes">
        <Text style={styles.primaryBtnText}>Share the care notes</Text>
      </Pressable>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, textAlign: "center", marginTop: 8 }}>
        Plain text — send it, print it, or stick it on the cabinet.
      </Text>
    </View>
  );
}
