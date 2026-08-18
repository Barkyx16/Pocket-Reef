import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getJournalOnThisDay, getTodayKey, journalDaySpan, tapHaptic } from "../core";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";

// Moods that count as a milestone worth putting on the timeline — an arrival or
// a piece of work done, as opposed to a passing observation.
const MILESTONE_MOODS = ["🐠", "🛠️"];

// A single card with three views — "On this day", a milestone timeline, and a
// before/after photo compare. They're all ways of looking backwards, so they
// share one card and a segmented switch rather than sprawling into three.
const STRIP_MAX = 40;

export function JournalMemoriesCard({ journal = [] }) {
  const [view, setView] = useState("onthisday");
  const today = getTodayKey();

  const memories = useMemo(() => getJournalOnThisDay(journal, today), [journal, today]);
  const milestones = useMemo(
    () => journal.filter((e) => MILESTONE_MOODS.includes(e.mood)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [journal]
  );
  const photos = useMemo(
    () => journal.filter((e) => e.photo).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [journal]
  );

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
        <Pill label="On this day" active={view === "onthisday"} onPress={() => setView("onthisday")} fill />
        <Pill label="Milestones" active={view === "milestones"} onPress={() => setView("milestones")} fill />
        <Pill label="Compare" active={view === "compare"} onPress={() => setView("compare")} fill />
      </View>

      {view === "onthisday" ? <OnThisDay memories={memories} /> : null}
      {view === "milestones" ? <Milestones entries={milestones} /> : null}
      {view === "compare" ? <Compare photos={photos} /> : null}
    </View>
  );
}

function EntryLine({ entry, showDate = true }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
      {entry.photo ? (
        <Image source={{ uri: entry.photo }} style={{ width: 46, height: 46, borderRadius: 12 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: theme.well, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 18 }}>{entry.mood || "📓"}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {showDate ? <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{entry.date}</Text> : null}
        <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18, marginTop: 1 }} numberOfLines={3}>
          {entry.text || "(photo only)"}
        </Text>
      </View>
    </View>
  );
}

function OnThisDay({ memories }) {
  if (!memories.length) {
    return (
      <EmptyState
        emoji="🕰️"
        title="Nothing from this date yet"
        subtitle="Once you've been logging for a month or more, past entries from this time of year show up here."
      />
    );
  }
  return (
    <View>
      {memories.map((m) => (
        <View key={m.months} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ height: 1, width: 14, backgroundColor: "rgba(56,225,198,0.42)" }} />
            <Text style={{ color: theme.accentLight, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{m.label}</Text>
            <View style={{ height: 1, flex: 1, backgroundColor: theme.hairline }} />
          </View>
          {m.entries.slice(0, 3).map((e) => <EntryLine key={e.id || e.date} entry={e} />)}
        </View>
      ))}
    </View>
  );
}

function Milestones({ entries }) {
  const [visible, setVisible] = useState(6);
  if (!entries.length) {
    return (
      <EmptyState
        emoji="🐠"
        title="No milestones logged"
        subtitle="Entries tagged 🐠 (new arrivals) or 🛠️ (work done) collect here as your tank's headline moments."
      />
    );
  }
  const shown = entries.slice(0, visible);
  return (
    <View>
      {shown.map((e, i) => {
        const last = i === shown.length - 1;
        return (
          <View key={e.id || `${e.date}-${i}`} style={{ flexDirection: "row", gap: 12 }}>
            {/* Rail — matches the connector style used by TimelineCard. */}
            <View style={{ alignItems: "center", width: 30 }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: e.mood === "🐠" ? "rgba(56,225,198,0.14)" : "rgba(255,216,107,0.14)", borderWidth: 1, borderColor: e.mood === "🐠" ? "rgba(56,225,198,0.42)" : "rgba(255,216,107,0.35)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 15 }}>{e.mood}</Text>
              </View>
              {!last ? <View style={{ width: 2, flex: 1, backgroundColor: "rgba(56,225,198,0.18)", marginTop: 4, minHeight: 14 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{e.date}</Text>
              {e.text ? <Text style={{ color: theme.text, fontSize: 13.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19, marginTop: 2 }}>{e.text}</Text> : null}
              {e.photo ? <Image source={{ uri: e.photo }} style={{ width: "100%", height: 120, borderRadius: 10, marginTop: 8 }} resizeMode="cover" /> : null}
            </View>
          </View>
        );
      })}
      {entries.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => v + 8); }} style={styles.ghostBtn} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({entries.length - visible})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Compare({ photos }) {
  // The picker strip mounts one <Image> per photo, like the gallery did. It's a
  // horizontal scroller you drag through a handful of thumbnails at a time, so
  // a four-year journal was decoding several hundred bitmaps to let you choose
  // two. The oldest and newest are always kept — they're the default
  // before/after pair and the most likely comparison anyone wants.
  const stripPhotos = useMemo(() => {
    if (photos.length <= STRIP_MAX) return photos;
    const head = photos.slice(0, Math.floor(STRIP_MAX / 2));
    const tail = photos.slice(photos.length - Math.ceil(STRIP_MAX / 2));
    return [...head, ...tail];
  }, [photos]);

  // Defaults to the widest span available — oldest vs newest — which is the
  // comparison people actually want on first open.
  const [aId, setAId] = useState(null);
  const [bId, setBId] = useState(null);
  // Tapping a thumbnail fills the "before" slot first, then the "after" slot,
  // so a single tap always does something visible.
  const [next, setNext] = useState("a");

  if (photos.length < 2) {
    return (
      <EmptyState
        emoji="🔀"
        title="Two photos needed"
        subtitle="Attach a photo to at least two journal entries and you can put them side by side to see how far the tank has come."
      />
    );
  }

  const keyOfEntry = (e, i) => e.id ?? `${e.date}-${i}`;
  const first = photos[0];
  const last = photos[photos.length - 1];
  const a = photos.find((e, i) => keyOfEntry(e, i) === aId) || first;
  const b = photos.find((e, i) => keyOfEntry(e, i) === bId) || last;
  const span = journalDaySpan(a.date, b.date);

  const pick = (e, i) => {
    tapHaptic("light");
    const k = keyOfEntry(e, i);
    if (next === "a") { setAId(k); setNext("b"); } else { setBId(k); setNext("a"); }
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ e: a, label: "Before" }, { e: b, label: "After" }].map(({ e, label }) => (
          <View key={label} style={{ flex: 1 }}>
            <Image source={{ uri: e.photo }} style={{ width: "100%", aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderColor: theme.border }} resizeMode="cover" />
            <Text style={{ color: theme.accentLight, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, marginTop: 6, textTransform: "uppercase" }}>{label}</Text>
            <Text style={{ color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{e.date}</Text>
          </View>
        ))}
      </View>

      <View style={{ alignItems: "center", marginTop: 12, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingVertical: 10 }}>
        <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>
          {span === 0 ? "Same day" : `${span} ${span === 1 ? "day" : "days"} apart`}
        </Text>
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>
          Tap a photo below to set the {next === "a" ? "before" : "after"} shot
          {photos.length > STRIP_MAX ? ` · showing the oldest and newest ${STRIP_MAX} of ${photos.length}` : ""}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12, paddingHorizontal: 2 }}>
        {stripPhotos.map((e, i) => {
          const k = keyOfEntry(e, i);
          const on = k === (aId ?? keyOfEntry(first, 0)) || k === (bId ?? keyOfEntry(last, photos.length - 1));
          return (
            <Pressable
              key={k}
              onPress={() => pick(e, i)}
              style={({ pressed }) => [
                { borderRadius: 12, overflow: "hidden", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Photo from ${e.date}`}
            >
              <Image source={{ uri: e.photo }} style={{ width: 62, height: 62 }} resizeMode="cover" />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
