import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { EmptyState } from "./EmptyState";
import { assessParam, paramStatusColor, tapHaptic } from "../core";
import { activeParams } from "../lib/targets";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// A unified tank timeline — the reef version of Pocket Planter's Garden Timeline.
// Merges journal entries and water tests into one chronological feed with a
// connector line, so the whole history of the tank reads as a single story.
export function TimelineCard({ journal = [], waterTests = [] }) {
  const [visible, setVisible] = useState(8);
  const events = [
    ...journal.map((e) => ({ kind: "journal", date: e.date, sort: e.id || e.date, mood: e.mood, text: e.text, photo: e.photo })),
    ...waterTests.map((t, i) => ({ kind: "test", date: t.date, sort: `${t.date}-${i}`, water: t.water, values: t.values })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (!events.length) {
    return <EmptyState emoji="🕰️" title="Your story starts here" subtitle="Log a water test or a journal entry and your tank's timeline begins." />;
  }

  const shown = events.slice(0, visible);

  return (
    <View>
      {shown.map((ev, i) => {
        const last = i === shown.length - 1;
        return (
          <View key={i} style={{ flexDirection: "row", gap: 12 }}>
            {/* Rail */}
            <View style={{ alignItems: "center", width: 30 }}>
              <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: ev.kind === "test" ? "rgba(56,225,198,0.14)" : "rgba(255,216,107,0.14)", borderWidth: 1, borderColor: ev.kind === "test" ? "rgba(56,225,198,0.42)" : "rgba(255,216,107,0.35)", alignItems: "center", justifyContent: "center" }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: type.bodyLg }}>{ev.kind === "test" ? "🧪" : ev.mood || "📓"}</Text>
              </View>
              {!last ? <View style={{ width: 2, flex: 1, backgroundColor: "rgba(56,225,198,0.18)", marginTop: 4, minHeight: 16 }} /> : null}
            </View>
            {/* Content */}
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 4 }}>{ev.date}</Text>
              {ev.kind === "journal" ? (
                <View>
                  {ev.text ? <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 20 }}>{ev.text}</Text> : null}
                  {ev.photo ? <Image source={{ uri: ev.photo }} style={{ width: "100%", height: 140, borderRadius: radius.sm, marginTop: 8 }} resizeMode="cover" /> : null}
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {(activeParams(ev.water)).map((p) => {
                    if (!ev.values || ev.values[p.key] == null) return null;
                    const c = paramStatusColor(assessParam(p, ev.values[p.key]).status);
                    return (
                      <View key={p.key} style={{ flexDirection: "row", gap: 4, backgroundColor: `${c}18`, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                        <Text style={{ color: c, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{ev.values[p.key]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        );
      })}
      {events.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 12, events.length)); }} style={styles.ghostBtn} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({events.length - visible})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
