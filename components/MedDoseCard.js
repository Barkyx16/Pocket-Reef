import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { getSpecies, tapHaptic } from "../core";
import { touchSlop } from "../lib/a11y";
import { MED_CLASSES, classOf, planMedDose, safetyFor, newMedDose, courseTotal } from "../lib/meds";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";

// The arithmetic between "dose per the label" and a syringe.
//
// It does not know what your medication is or how strong it is, and says so —
// the label's numbers go in, and the three things people get wrong come out:
// real volume, the top-up after a water change, and what this class of
// medication will do to the tank.
export function MedDoseCard({ tank = {}, tankGallons = 0, onLogMedDose, onDeleteMedDose }) {
  const [labelDose, setLabelDose] = useState("");
  const [labelPer, setLabelPer] = useState("");
  const [cls, setCls] = useState("other");
  const [changePct, setChangePct] = useState("");
  const [medName, setMedName] = useState("");

  // Anything that isn't a fish is at risk from most medications.
  const hasInverts = useMemo(
    () => (tank.stock || []).map(getSpecies).filter(Boolean).some((s) => s.kind === "invert" || s.kind === "coral"),
    [tank]
  );

  const plan = useMemo(
    () => planMedDose({ labelDose, labelPer, ratedGallons: tankGallons, waterChangePct: changePct }),
    [labelDose, labelPer, tankGallons, changePct]
  );
  const warnings = useMemo(() => safetyFor(cls, { hasInverts }), [cls, hasInverts]);

  // What has actually gone into this tank. The app records every millilitre of
  // alkalinity supplement and, until now, nothing at all about medication —
  // the one thing where losing count is dangerous rather than untidy.
  const doses = tank.medDoses || [];
  const course = doses.length ? courseTotal(doses, doses[doses.length - 1].date) : 0;

  const logDose = (amount) => {
    const entry = newMedDose({ name: medName.trim() || classOf(cls).label, amount, unit: "ml" });
    if (!entry || !onLogMedDose) return;
    tapHaptic("medium");
    onLogMedDose(entry);
  };

  return (
    <View>
      <Text style={styles.cardText}>
        Read the dose off the bottle and Pocket Reef does the rest. It never guesses a strength — products differ, and the label always wins.
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
        <TextInput
          value={labelDose}
          onChangeText={(t) => setLabelDose(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="5"
          placeholderTextColor={theme.secondaryText}
          accessibilityLabel="Dose from the label"
          style={[styles.authInput, { width: 74, textAlign: "center" }]}
        
            maxLength={TEXT_LIMITS.number}
          />
        <Text style={{ color: theme.bodyText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>ml per</Text>
        <TextInput
          value={labelPer}
          onChangeText={(t) => setLabelPer(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="10"
          placeholderTextColor={theme.secondaryText}
          accessibilityLabel="Gallons that dose treats"
          style={[styles.authInput, { width: 74, textAlign: "center" }]}
        
            maxLength={TEXT_LIMITS.number}
          />
        <Text style={{ color: theme.bodyText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>gallons</Text>
      </View>

      <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 14 }}>What kind is it?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {MED_CLASSES.map((c) => (
          <Pill key={c.id} label={c.label} active={cls === c.id} onPress={() => { tapHaptic("light"); setCls(c.id); }} />
        ))}
      </View>

      {plan.ok ? (
        <View style={{ backgroundColor: "rgba(56,225,198,0.10)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", padding: 14, marginTop: 14 }}>
          <Text style={{ color: theme.accentLight, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Full dose</Text>
          <Text style={{ color: "#fff", fontSize: 30, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 2 }}>{plan.fullDose} {plan.unit}</Text>
          <Text style={{ color: theme.bodyText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 6 }}>{plan.volumeNote}</Text>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 14 }}>{plan.reason}</Text>
      )}

      {/* The re-dose people get wrong in both directions. */}
      {plan.ok ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Re-dosing after a water change</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <TextInput
              value={changePct}
              onChangeText={(t) => setChangePct(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Percent of water changed"
              style={[styles.authInput, { width: 74, textAlign: "center" }]}
            
            maxLength={TEXT_LIMITS.number}
          />
            <Text style={{ flex: 1, color: theme.bodyText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
              % changed → <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{plan.topUp} {plan.unit}</Text>
            </Text>
          </View>
          {plan.topUpNote ? (
            <Text style={{ color: theme.bodyText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 6 }}>{plan.topUpNote}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Recording it. A dose you can't remember giving is a dose you give
          twice. */}
      {plan.ok && onLogMedDose ? (
        <View style={{ marginTop: 14 }}>
          <TextInput
            value={medName}
            onChangeText={setMedName}
            placeholder={`What's it called? (optional — defaults to "${classOf(cls).label}")`}
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="Medication name"
            style={styles.authInput}
          
            maxLength={TEXT_LIMITS.name}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable onPress={() => logDose(plan.fullDose)} style={[styles.primaryBtn, { flex: 1, paddingVertical: 11 }]} accessibilityRole="button" accessibilityLabel={`Record a full dose of ${plan.fullDose} millilitres`}>
              <Text style={styles.primaryBtnText}>Log {plan.fullDose} ml</Text>
            </Pressable>
            {plan.topUp > 0 ? (
              <Pressable onPress={() => logDose(plan.topUp)} style={[styles.ghostBtn, { flex: 1, paddingVertical: 11 }]} accessibilityRole="button" accessibilityLabel={`Record a top-up of ${plan.topUp} millilitres`}>
                <Text style={styles.ghostBtnText}>Log {plan.topUp} ml top-up</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {doses.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>
            This course · {course} ml so far
          </Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {doses.slice(0, 6).map((d) => (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="flask-outline" size={13} color={theme.secondaryText} />
                <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  {d.name} · {d.amount} {d.unit}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{d.date}</Text>
                {onDeleteMedDose ? (
                  <Pressable onPress={() => onDeleteMedDose(d.id)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Delete the ${d.amount} ml dose from ${d.date}`}>
                    <Ionicons name="close" size={13} color={theme.secondaryText} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ backgroundColor: "rgba(255,107,107,0.08)", borderRadius: 14, borderWidth: 1, borderColor: `${theme.danger}44`, padding: 12, marginTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="warning" size={14} color={theme.danger} />
          <Text style={{ color: theme.danger, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Before you dose</Text>
        </View>
        {warnings.map((w, i) => (
          <Text key={i} style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 5 }}>• {w}</Text>
        ))}
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 8 }}>
          {classOf(cls).label} · these are general to the class. The product label overrides everything here.
        </Text>
      </View>
    </View>
  );
}
