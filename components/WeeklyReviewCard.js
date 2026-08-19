import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { buildReview } from "../lib/review";
import { interpret } from "../lib/correlate";

// The week, in one card.
//
// Every other surface in this app is about now. This is the only one that looks
// back at a stretch of time and says what happened in it — which is the
// timescale a reef actually changes on, and the one a keeper has no way to hold
// in their head across three months of readings.

const FOCUS_TONE = {
  inventory: { color: theme.warn, icon: "cart" },
  stability: { color: theme.danger, icon: "swap-vertical" },
  correlation: { color: theme.warn, icon: "git-compare" },
  activity: { color: theme.muted, icon: "time" },
  good: { color: theme.accent, icon: "checkmark-circle" },
};

export function WeeklyReviewCard({ tank = {}, waterType = "fresh", onGoToTab, now }) {
  const [days, setDays] = useState(7);
  const review = useMemo(() => buildReview(tank, { waterType, days, ...(now ? { now } : {}) }), [tank, waterType, days, now]);

  // Nothing logged and nothing to say — a card of zeroes is worse than no card.
  if (review.empty && !review.stability.ok) return null;

  const tone = review.focus ? FOCUS_TONE[review.focus.kind] || FOCUS_TONE.activity : null;
  const counts = [
    { n: review.activity.tests, label: "tests", icon: "flask-outline" },
    { n: review.activity.waterChanges, label: "changes", icon: "water-outline" },
    { n: review.activity.feedings, label: "feedings", icon: "restaurant-outline" },
    { n: review.activity.doses, label: "doses", icon: "eyedrop-outline" },
  ].filter((c) => c.n > 0);

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>{days === 7 ? "Your week" : "Your month"}</Text>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {[7, 30].map((d) => (
            <Pressable
              key={d}
              onPress={() => { tapHaptic("light"); setDays(d); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: days === d }}
              accessibilityLabel={d === 7 ? "Review the last 7 days" : "Review the last 30 days"}
            >
              <Text style={{ color: days === d ? theme.accent : theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{d}d</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.xs }}>{review.headline}</Text>

      {counts.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
          {counts.map((c) => (
            <View key={c.label} style={{ flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: theme.well, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border, paddingHorizontal: space.md, paddingVertical: space.xs }}>
              <Ionicons name={c.icon} size={12} color={theme.accent} />
              <Text style={{ color: theme.text, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{c.n}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* What moved. Only parameters that moved beyond kit error are here, so
          an empty list genuinely means "nothing changed". */}
      {review.movements.length ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>What moved</Text>
          {review.movements.slice(0, 4).map((m) => (
            <View key={m.key} style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
              <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", minWidth: 76 }}>{m.label}</Text>
              <Text style={{ color: m.direction === "up" ? theme.warn : theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {m.direction === "up" ? "↑" : "↓"}{Math.abs(m.delta)}{m.unit ? ` ${m.unit}` : ""}
              </Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{m.from} → {m.to}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* A pattern found in the log — the thing no keeper can spot unaided. */}
      {review.correlations.length ? (() => {
        const c = review.correlations[0];
        const note = interpret(c);
        return (
          <View style={{ marginTop: space.md, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: space.md }}>
            <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Pattern in your log</Text>
            <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18, marginTop: space.xs }}>{c.text}</Text>
            {note && note.note ? (
              <Text style={{ color: note.tone === "warn" ? theme.warn : theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>{note.note}</Text>
            ) : null}
          </View>
        );
      })() : null}

      {/* One thing to do about all of it. */}
      {review.focus ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm, marginTop: space.md, backgroundColor: `${tone.color}14`, borderRadius: radius.md, borderWidth: 1, borderColor: `${tone.color}40`, padding: space.md }}>
          <Ionicons name={tone.icon} size={15} color={tone.color} style={{ marginTop: space.hair }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: tone.color, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
              {review.focus.kind === "good" ? "All clear" : "Worth your attention"}
            </Text>
            <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: space.xs }}>{review.focus.text}</Text>
            {onGoToTab && review.focus.kind !== "good" ? (
              <Pressable
                onPress={() => { tapHaptic(); onGoToTab(review.focus.kind === "inventory" ? "tank" : "log"); }}
                style={{ marginTop: space.sm }}
                accessibilityRole="button"
              >
                <Text style={{ color: tone.color, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  {review.focus.kind === "inventory" ? "Open the shelf ›" : "Open the log ›"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
