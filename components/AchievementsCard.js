import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// Badge grid — the reef version of Pocket Planter's achievements. Earned badges
// glow; locked ones are dimmed with their unlock hint. Earned badges sort first,
// and a "Show more" reveals the rest so the gallery stays tidy.
export function AchievementsCard({ items = [] }) {
  const [visible, setVisible] = useState(12);
  const [filter, setFilter] = useState("all"); // all | earned | locked
  const earned = items.filter((a) => a.earned).length;
  const filtered = items.filter((a) => (filter === "earned" ? a.earned : filter === "locked" ? !a.earned : true));
  const sorted = [...filtered].sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0));
  const shown = sorted.slice(0, visible);

  const FILTERS = [["all", `All ${items.length}`], ["earned", `Earned ${earned}`], ["locked", `Locked ${items.length - earned}`]];

  return (
    <View>
      <Text style={[styles.cardText, { marginBottom: 12 }]}>{earned} of {items.length} unlocked — keep caring for your reef to earn them all.</Text>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
        {FILTERS.map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => { tapHaptic("light"); setFilter(id); setVisible(12); }} style={[styles.pill, { flex: 1, alignItems: "center", paddingVertical: 8, backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border }]} accessibilityRole="button">
              <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {shown.length === 0 ? <Text style={styles.cardText}>Nothing here yet.</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {shown.map((a) => (
          <View
            key={a.id}
            style={{
              width: "31%", minWidth: 96, flexGrow: 1, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 1,
              backgroundColor: a.earned ? "rgba(56,225,198,0.10)" : "rgba(255,255,255,0.03)",
              borderColor: a.earned ? "rgba(56,225,198,0.30)" : theme.border,
              opacity: a.earned ? 1 : 0.5,
              ...(a.earned ? { shadowColor: theme.accent, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 3 } : null),
            }}
          >
            <Text style={{ fontSize: 26 }}>{a.earned ? a.emoji : "🔒"}</Text>
            <Text style={{ color: a.earned ? "#fff" : theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 6, textAlign: "center" }}>{a.title}</Text>
            <Text style={{ color: theme.bodyText, fontSize: 10, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, textAlign: "center", lineHeight: 13 }}>{a.desc}</Text>
          </View>
        ))}
      </View>
      {filtered.length > visible ? (
        <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 18, filtered.length)); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Show more ({filtered.length - visible})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
