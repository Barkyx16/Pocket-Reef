import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { getJournalStats, getJournalMonth, getTodayKey, tapHaptic } from "../core";
import { EmptyState } from "./EmptyState";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// One compact stat tile — the four-across strip at the top of the card.
function Stat({ value, label, tint }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center" }}>
      <Text style={{ color: tint || "#fff", fontSize: 19, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.3, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// Rhythm + mood mix + a month calendar, folded into a single card so the Journal
// tab gains real insight without turning into a wall of separate cards.
export function JournalInsightsCard({ journal = [] }) {
  const today = getTodayKey();
  const s = getJournalStats(journal, today);
  // Month cursor: 0 = this month, -1 = last month, and so on.
  const [offset, setOffset] = useState(0);

  if (!s.total) {
    return (
      <EmptyState
        emoji="📈"
        title="No insights yet"
        subtitle="Log a few entries and your streak, mood mix, and month calendar will fill in here."
      />
    );
  }

  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const cells = getJournalMonth(journal, cursor.getFullYear(), cursor.getMonth());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthCount = cells.filter((c) => c && c.entries.length).length;
  const activeMoods = s.moods.filter((m) => m.count > 0);

  // Only offer "back" as far as the first entry, and never past this month.
  const firstMonth = s.firstDate ? s.firstDate.slice(0, 7) : null;
  const cursorMonth = `${cursor.getFullYear()}-${`${cursor.getMonth() + 1}`.padStart(2, "0")}`;
  const canGoBack = !firstMonth || cursorMonth > firstMonth;
  const canGoFwd = offset < 0;

  const step = (delta) => { tapHaptic("light"); setOffset((o) => o + delta); };

  return (
    <View>
      {/* ── Rhythm ───────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat value={s.streak} label="DAY STREAK" tint={s.streak > 0 ? theme.accent : "#fff"} />
        <Stat value={s.thisMonth} label="THIS MONTH" />
        <Stat value={s.photos} label="PHOTOS" />
        <Stat value={s.longestGap} label="LONGEST GAP" tint={s.longestGap > 14 ? theme.warn : "#fff"} />
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 8 }}>
        {s.daysSinceLast === 0
          ? "Logged today — nice."
          : s.daysSinceLast === 1
          ? "Last entry yesterday."
          : `Last entry ${s.daysSinceLast} days ago.`}
        {s.longestStreak > s.streak ? ` Best run: ${s.longestStreak} days.` : ""}
      </Text>

      {/* ── Mood mix ─────────────────────────────────────────────────────── */}
      <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 18, marginBottom: 8 }]}>Mood mix</Text>
      <View style={{ flexDirection: "row", height: 12, borderRadius: radius.pill, overflow: "hidden", backgroundColor: theme.well, borderWidth: 1, borderColor: theme.border }}>
        {activeMoods.map((m) => (
          <View key={m.mood} style={{ flex: m.count, backgroundColor: m.color }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {activeMoods.map((m) => (
          <View
            key={m.mood}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${m.color}1f`, borderWidth: 1, borderColor: `${m.color}55`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: type.small }}>{m.mood}</Text>
            <Text style={{ color: theme.text, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{m.label}</Text>
            <Text style={{ color: m.color, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", fontVariant: ["tabular-nums"] }}>{m.count}</Text>
          </View>
        ))}
      </View>

      {/* ── Month calendar ───────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 8 }}>
        <Pressable
          onPress={() => canGoBack && step(-1)}
          disabled={!canGoBack}
          hitSlop={10}
          style={{ width: 30, height: 30, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border, opacity: canGoBack ? 1 : 0.3 }}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{monthLabel}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 1 }}>
            {monthCount} {monthCount === 1 ? "day logged" : "days logged"}
          </Text>
        </View>
        <Pressable
          onPress={() => canGoFwd && step(1)}
          disabled={!canGoFwd}
          hitSlop={10}
          style={{ width: 30, height: 30, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border, opacity: canGoFwd ? 1 : 0.3 }}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row" }}>
        {DOW.map((d, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: "center", color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900" }}>{d}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
        {cells.map((c, i) => {
          if (!c) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 34 }} />;
          const isToday = c.date === today;
          const has = c.entries.length > 0;
          return (
            <View key={c.date} style={{ width: `${100 / 7}%`, height: 34, alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: radius.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: has ? `${c.mood.color}2e` : "rgba(255,255,255,0.03)",
                  borderWidth: isToday ? 1.5 : has ? 1 : 0,
                  borderColor: isToday ? theme.accent : has ? `${c.mood.color}77` : "transparent",
                }}
                accessible
                accessibilityLabel={`${c.date}, ${has ? `${c.entries.length} ${c.entries.length === 1 ? "entry" : "entries"}` : "no entries"}`}
              >
                {has ? (
                  <Text style={{ fontSize: type.small }}>{c.mood.mood}</Text>
                ) : (
                  <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", opacity: 0.55 }}>{c.day}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
