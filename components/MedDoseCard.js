import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { getSpecies, tapHaptic } from "../core";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { MED_CLASSES, classOf, planMedDose, safetyFor, newMedDose, courseTotal } from "../lib/meds";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";
import { fmt } from "../lib/format";
import { decimalText, integerText } from "../lib/numericInput";

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

      {/* Said before a class is chosen, not after.
          The per-class warning is correct and fires the moment copper is
          selected — but by then the keeper has already decided what they are
          dosing. This tank's stock is known from the first render, and on a
          reef the answer to "which medication?" is usually "not in here". */}
      {hasInverts ? (
        <View style={{ flexDirection: "row", gap: space.sm, backgroundColor: "rgba(255,123,123,0.10)", borderWidth: 1, borderColor: "rgba(255,123,123,0.32)", borderRadius: radius.md, padding: space.md, marginTop: space.md }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: type.body, letterSpacing: 0 }}>⚠️</Text>
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, lineHeight: 17, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
            This tank has corals or invertebrates. Copper and formalin will kill them, and copper never fully leaves rock and sand — treat the fish in a separate tank rather than in here.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg }}>
        <TextInput
          value={labelDose}
          onChangeText={(t) => setLabelDose(decimalText(t))}
          keyboardType="decimal-pad"
          placeholder="5"
          placeholderTextColor={theme.secondaryText}
          accessibilityLabel="Dose from the label"
          style={[styles.authInput, { width: 74, textAlign: "center" }]}
        
            maxLength={TEXT_LIMITS.number}
          />
        <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>ml per</Text>
        <TextInput
          value={labelPer}
          onChangeText={(t) => setLabelPer(decimalText(t))}
          keyboardType="decimal-pad"
          placeholder="10"
          placeholderTextColor={theme.secondaryText}
          accessibilityLabel="Gallons that dose treats"
          style={[styles.authInput, { width: 74, textAlign: "center" }]}
        
            maxLength={TEXT_LIMITS.number}
          />
        <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>gallons</Text>
      </View>

      <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: space.lg }}>What kind is it?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
        {MED_CLASSES.map((c) => (
          <Pill key={c.id} label={c.label} active={cls === c.id} onPress={() => { tapHaptic("light"); setCls(c.id); }} />
        ))}
      </View>

      {plan.ok ? (
        <View style={{ backgroundColor: "rgba(56,225,198,0.10)", borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", padding: space.lg, marginTop: space.lg }}>
          <Text style={{ color: theme.accentLight, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Full dose</Text>
          <Text style={{ color: "#fff", fontSize: type.display, letterSpacing: -0.4, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.hair }}>{plan.fullDose} {plan.unit}</Text>
          <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.sm }}>{plan.volumeNote}</Text>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.lg }}>{plan.reason}</Text>
      )}

      {/* The re-dose people get wrong in both directions. */}
      {plan.ok ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Re-dosing after a water change</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
            <TextInput
              value={changePct}
              onChangeText={(t) => setChangePct(integerText(t))}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Percent of water changed"
              style={[styles.authInput, { width: 74, textAlign: "center" }]}
            
            maxLength={TEXT_LIMITS.number}
          />
            <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
              % changed → <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{plan.topUp} {plan.unit}</Text>
            </Text>
          </View>
          {plan.topUpNote ? (
            <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.sm }}>{plan.topUpNote}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Recording it. A dose you can't remember giving is a dose you give
          twice. */}
      {plan.ok && onLogMedDose ? (
        <View style={{ marginTop: space.lg }}>
          <TextInput
            value={medName}
            onChangeText={setMedName}
            placeholder={`What's it called? (optional — defaults to "${classOf(cls).label}")`}
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="Medication name"
            style={styles.authInput}
          
            maxLength={TEXT_LIMITS.name}
          />
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <Pressable onPress={() => logDose(plan.fullDose)} style={[styles.primaryBtn, { flex: 1, paddingVertical: space.md }]} accessibilityRole="button" accessibilityLabel={`Record a full dose of ${plan.fullDose} millilitres`}>
              <Text style={styles.primaryBtnText}>Log {plan.fullDose} ml</Text>
            </Pressable>
            {plan.topUp > 0 ? (
              <Pressable onPress={() => logDose(plan.topUp)} style={[styles.ghostBtn, { flex: 1, paddingVertical: space.md }]} accessibilityRole="button" accessibilityLabel={`Record a top-up of ${plan.topUp} millilitres`}>
                <Text style={styles.ghostBtnText}>Log {plan.topUp} ml top-up</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {doses.length ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
            This course · {course} ml so far
          </Text>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {doses.slice(0, 6).map((d) => (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Ionicons name="flask-outline" size={13} color={theme.secondaryText} />
                <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  {d.name} · {d.amount} {d.unit}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{d.date}</Text>
                {onDeleteMedDose ? (
                  <Pressable onPress={() => onDeleteMedDose(d.id)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Delete the ${fmt(d.amount)} ml dose from ${d.date}`}>
                    <Ionicons name="close" size={13} color={theme.secondaryText} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ backgroundColor: "rgba(255,107,107,0.08)", borderRadius: radius.lg, borderWidth: 1, borderColor: `${theme.danger}44`, padding: space.md, marginTop: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons name="warning" size={14} color={theme.danger} />
          <Text style={{ color: theme.danger, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Before you dose</Text>
        </View>
        {warnings.map((w, i) => (
          <Text key={i} style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>• {w}</Text>
        ))}
        <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.sm }}>
          {classOf(cls).label} · these are general to the class. The product label overrides everything here.
        </Text>
      </View>
    </View>
  );
}
