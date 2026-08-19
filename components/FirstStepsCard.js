import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";

// The first-run path.
//
// A new tank landed on a Home screen built for a running one: daily challenges,
// a seven-day activity summary, a streak — all reporting zero, all asking you
// to keep up a habit you haven't started. Meanwhile the three things that
// actually make the app useful (tell it your tank, put fish in it, log a test)
// were spread across three tabs with nothing pointing at them.
//
// This replaces that noise until the basics are done, then disappears for good.
// It is deliberately not dismissible while incomplete: the steps ARE the app,
// and a dismissed checklist leaves someone on an empty Home with no next move.
export function FirstStepsCard({ steps = [], onDo }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;

  return (
    <View style={[styles.card, { borderColor: "rgba(56,225,198,0.30)" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>Get your tank set up</Text>
        <Text style={{ color: theme.accent, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900" }}>{done}/{steps.length}</Text>
      </View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>
        Three steps and Pocket Reef can actually tell you something about your water.
      </Text>

      {/* A real progress bar, not a row of ticks: at three steps the difference
          between "nearly there" and "just started" is the thing worth showing. */}
      <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 14 }}>
        <View style={{ width: `${(done / steps.length) * 100}%`, height: "100%", backgroundColor: theme.accent, borderRadius: 3 }} />
      </View>

      <View style={{ gap: 8 }}>
        {steps.map((s) => {
          const isNext = s.id === next.id;
          return (
            <Pressable
              key={s.id}
              onPress={s.done ? undefined : () => { tapHaptic("medium"); onDo(s); }}
              disabled={s.done}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 12,
                borderWidth: 1,
                backgroundColor: isNext ? "rgba(56,225,198,0.10)" : theme.well,
                borderColor: isNext ? theme.accent : theme.border,
                opacity: s.done ? 0.55 : 1,
              }, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={s.done ? `${s.title}, done` : s.title}
              accessibilityState={{ disabled: s.done }}
            >
              <View style={{ width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: s.done ? theme.accent : "rgba(159,196,216,0.4)", backgroundColor: s.done ? "rgba(56,225,198,0.18)" : "transparent" }}>
                {s.done ? <Ionicons name="checkmark" size={15} color={theme.accent} /> : <Ionicons name={s.icon} size={14} color={theme.secondaryText} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: s.done ? theme.secondaryText : "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900", textDecorationLine: s.done ? "line-through" : "none" }}>{s.title}</Text>
                {/* Only the step you're on explains itself. Three subtitles at
                    once is a wall of text where a checklist should be. */}
                {isNext && s.hint ? (
                  <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 3, lineHeight: 17 }}>{s.hint}</Text>
                ) : null}
              </View>
              {!s.done ? <Ionicons name="chevron-forward" size={16} color={isNext ? theme.accent : theme.secondaryText} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
