import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { PROFILES, newLightSchedule, assessLighting, suggestProfile, suggestSchedule, dailyHours, hasSchedule } from "../lib/lighting";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";
import { integerText } from "../lib/numericInput";

// How long the lights are on — the third lever, after nutrients and flow, and
// the only one that costs nothing to pull.
export function LightScheduleCard({ tank = {}, onSave }) {
  const existing = hasSchedule(tank.lightSchedule) ? tank.lightSchedule : null;
  const [editing, setEditing] = useState(!existing);
  const [on, setOn] = useState((existing && existing.on) || "10:00");
  const [off, setOff] = useState((existing && existing.off) || "20:00");
  const [ramp, setRamp] = useState(String((existing && existing.rampMinutes) || 0));
  const [profile, setProfile] = useState((existing && existing.profile) || suggestProfile(tank));

  const assessment = useMemo(() => assessLighting(tank), [tank]);
  const draftHours = useMemo(() => dailyHours(newLightSchedule({ on, off, rampMinutes: ramp })), [on, off, ramp]);
  const better = useMemo(() => (assessment.ok && assessment.excess > 0 ? suggestSchedule(tank) : null), [assessment, tank]);

  const save = (schedule) => {
    tapHaptic("medium");
    onSave && onSave(schedule || newLightSchedule({ on, off, rampMinutes: ramp, profile }));
    setEditing(false);
  };

  const tone = !assessment.ok ? theme.secondaryText
    : assessment.verdict === "too-long" ? theme.danger
      : assessment.verdict === "long" ? theme.warn
        : assessment.verdict === "short" ? theme.warn : theme.accent;

  return (
    <View>
      {!editing && assessment.ok ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${tone}14`, borderRadius: radius.xl, borderWidth: 1, borderColor: `${tone}40`, padding: 14 }}>
            <View style={{ alignItems: "center", minWidth: 54 }}>
              <Text style={{ color: tone, fontSize: 26, fontFamily: "Inter_900Black", fontWeight: "900" }}>{assessment.hours}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>hours</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tone, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {assessment.schedule.on} – {assessment.schedule.off} · {assessment.profile.label}
              </Text>
              <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 3 }}>{assessment.note}</Text>
            </View>
          </View>

          {better ? (
            <Pressable
              onPress={() => save(better)}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(56,225,198,0.35)", padding: 12 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={`Change the schedule to ${better.on} to ${better.off}`}
            >
              <Ionicons name="timer-outline" size={16} color={theme.accent} />
              <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>
                Set it to <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{better.on} – {better.off}</Text> and it lands in range.
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => { tapHaptic(); setEditing(true); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Change schedule</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.cardText}>
            Photoperiod drives algae as much as nutrients do, and it's the only one of the two that's free to change. Times are 24-hour.
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>On</Text>
              <TextInput value={on} onChangeText={setOn} placeholder="10:00" placeholderTextColor={theme.secondaryText} accessibilityLabel="Time the lights come on" style={styles.authInput} 
            maxLength={TEXT_LIMITS.time}
          />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>Off</Text>
              <TextInput value={off} onChangeText={setOff} placeholder="20:00" placeholderTextColor={theme.secondaryText} accessibilityLabel="Time the lights go off" style={styles.authInput} 
            maxLength={TEXT_LIMITS.time}
          />
            </View>
            <View style={{ width: 88 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>Ramp</Text>
              <TextInput value={ramp} onChangeText={(t) => setRamp(integerText(t))} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.secondaryText} accessibilityLabel="Ramp minutes" style={styles.authInput} 
            maxLength={TEXT_LIMITS.number}
          />
            </View>
          </View>

          <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>
            {draftHours != null ? `${draftHours} hours a day` : "Use times like 10:00 and 20:00"}
          </Text>

          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 14 }}>What's it lighting?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {PROFILES.map((p) => (
              <Pill key={p.id} label={p.label} active={profile === p.id} onPress={() => { tapHaptic("light"); setProfile(p.id); }} />
            ))}
          </View>
          <Text style={{ color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 6 }}>
            {(PROFILES.find((p) => p.id === profile) || PROFILES[0]).blurb}
          </Text>

          <Pressable onPress={() => save()} disabled={draftHours == null} style={[draftHours != null ? styles.primaryBtn : styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
            <Text style={draftHours != null ? styles.primaryBtnText : styles.ghostBtnText}>Save schedule</Text>
          </Pressable>
          {existing ? (
            <Pressable onPress={() => setEditing(false)} style={styles.authLinkBtn} accessibilityRole="button">
              <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Cancel</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
