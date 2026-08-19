import { useMemo } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type, space } from "../styles";
import { testSchedule } from "../lib/cadence";
import { EmptyState } from "./EmptyState";

// A testing schedule built from what this tank actually does.
//
// One cadence for every parameter is wrong in both directions at once: too slow
// for the one that can hurt you in four days, too fast for the one that hasn't
// moved since spring.

const VERDICT = {
  "too-rare": { color: theme.danger, icon: "alert-circle", label: "Test more often" },
  "too-often": { color: theme.muted, icon: "remove-circle-outline", label: "Ease off" },
  "about-right": { color: theme.accent, icon: "checkmark-circle", label: "About right" },
  unknown: { color: theme.muted, icon: "help-circle-outline", label: "No cadence yet" },
};

export function TestScheduleCard({ waterTests = [], waterType = "fresh", now }) {
  const schedule = useMemo(() => testSchedule(waterTests, waterType, now ? { now } : {}), [waterTests, waterType, now]);

  if (!schedule.ok) {
    return <EmptyState emoji="🗓️" title="Not enough readings yet" subtitle={schedule.reason} />;
  }

  return (
    <View>
      <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{schedule.headline}</Text>
      <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: space.sm }}>
        Each interval is half the time this parameter would take to reach the edge of its safe range at the speed it's actually moving — so a problem is caught on the way, not on arrival.
      </Text>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {schedule.items.map((it) => {
          const v = VERDICT[it.verdict] || VERDICT.unknown;
          return (
            <View key={it.key} style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: it.verdict === "too-rare" ? `${v.color}55` : theme.border, padding: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Ionicons name={v.icon} size={14} color={v.color} />
                <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.label}</Text>
                <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  every {it.recommended}d
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs }}>
                <Text style={{ color: v.color, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{v.label}</Text>
                {it.actual != null ? (
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                    · you test every {it.actual}d
                  </Text>
                ) : null}
              </View>

              <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.xs }}>
                {it.reason}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
