import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { compareFleet } from "../lib/fleet";
import { EmptyState } from "./EmptyState";

// Every tank on one screen, ranked, with the gap explained.
//
// Owning three tanks is the paid feature and what it bought was a switcher.
// This is the thing having three tanks is actually for: the second tank is a
// control group for the first, and until now nothing ever ran the comparison.

export function FleetCard({ tanks = [], activeTankId, reminderPrefs, onSwitch, now }) {
  const fleet = useMemo(() => compareFleet(tanks, { reminderPrefs, ...(now ? { now } : {}) }), [tanks, reminderPrefs, now]);

  if (!fleet.ok) {
    return <EmptyState emoji="🪟" title="One tank so far" subtitle={fleet.reason} />;
  }

  return (
    <View>
      <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fleet.headline}</Text>

      <View style={{ gap: 8, marginTop: 12 }}>
        {fleet.ranked.map((p, i) => {
          const on = p.id === activeTankId;
          const alert = p.attention && p.attention.needsAttention;
          const alertColor = alert ? (p.attention.level === "urgent" ? theme.danger : theme.warn) : null;
          return (
            <Pressable
              key={p.id}
              onPress={() => { if (!on && onSwitch) { tapHaptic(); onSwitch(p.id); } }}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: on ? "rgba(56,225,198,0.10)" : theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: on ? theme.accent : alertColor ? `${alertColor}44` : theme.border, padding: 11 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}${on ? ", active" : ""}. ${p.score == null ? "Not enough logged to score." : `Scoring ${p.score}.`}${alert ? ` Needs attention: ${p.attention.reasons.join(", ")}.` : ""}`}
            >
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", width: 14 }}>{i + 1}</Text>
              <Text style={{ fontSize: type.title, letterSpacing: -0.2 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.name}{on ? " · active" : ""}</Text>
                <Text style={{ color: alertColor || theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>
                  {alert ? p.attention.reasons.join(" · ") : `${formatVolume(p.gallons)} · ${p.stocked} stocked${p.measures.testEvery ? ` · tested every ${p.measures.testEvery}d` : ""}`}
                </Text>
              </View>
              <Text style={{ color: p.score == null ? theme.secondaryText : theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {p.score == null ? "—" : p.score}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* The point of the whole card: not which is better, but why. */}
      {fleet.differences.length ? (
        <View style={{ marginTop: 14, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
            What {fleet.best.name} does differently
          </Text>
          <View style={{ flexDirection: "row", marginTop: 10, marginBottom: 4 }}>
            <Text style={{ flex: 1 }} />
            <Text style={{ width: 62, textAlign: "right", color: theme.accent, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }} numberOfLines={1}>{fleet.best.name}</Text>
            <Text style={{ width: 62, textAlign: "right", color: theme.secondaryText, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }} numberOfLines={1}>{fleet.worst.name}</Text>
          </View>
          {fleet.differences.slice(0, 4).map((d) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.hairline }}>
              <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{d.label}</Text>
              <Text style={{ width: 62, textAlign: "right", color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{d.best}</Text>
              <Text style={{ width: 62, textAlign: "right", color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{d.worst}</Text>
            </View>
          ))}
          <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: 8 }}>
            The habits are the difference far more often than the equipment is.
          </Text>
        </View>
      ) : null}

      {fleet.needsAttention.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Ionicons name="alert-circle" size={14} color={theme.warn} />
          <Text style={{ flex: 1, color: theme.warn, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
            {fleet.needsAttention.length} tank{fleet.needsAttention.length === 1 ? "" : "s"} need{fleet.needsAttention.length === 1 ? "s" : ""} something today.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
