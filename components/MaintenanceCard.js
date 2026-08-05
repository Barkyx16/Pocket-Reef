import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { ProgressBar } from "./ProgressBar";

// Maintenance log — track when you last did each chore and when it's due next.
// `maintenance` is { [taskId]: ISO date string }.
const TASKS = [
  { id: "waterchange", label: "Water change", emoji: "🔁", days: 7 },
  { id: "filterclean", label: "Filter clean / rinse", emoji: "🧽", days: 30 },
  { id: "gravelvac", label: "Gravel vacuum", emoji: "🌀", days: 14 },
  { id: "glassclean", label: "Glass / algae clean", emoji: "✨", days: 10 },
];

const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export function MaintenanceCard({ maintenance = {}, onLog }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.cardText}>Tap "Done" when you finish a chore — Pocket Reef tracks when each is due next.</Text>
      {TASKS.map((task) => {
        const last = maintenance[task.id];
        let statusText, color, pct = 0;
        if (!last) {
          statusText = `Suggested every ${task.days} days · never logged`;
          color = theme.secondaryText;
        } else {
          const since = daysSince(last);
          const dueIn = task.days - since;
          pct = Math.min(100, (since / task.days) * 100);
          if (dueIn > 0) { statusText = `Done ${since === 0 ? "today" : `${since}d ago`} · due in ${dueIn}d`; color = dueIn <= 2 ? theme.warn : theme.accent; }
          else if (dueIn === 0) { statusText = `Done ${since}d ago · due today`; color = theme.warn; }
          else { statusText = `Overdue by ${-dueIn}d`; color = theme.danger; }
        }
        return (
          <View key={task.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 18 }}>{task.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{task.label}</Text>
              <Text style={{ color, fontSize: 11, fontWeight: "800", marginTop: 2, marginBottom: last ? 7 : 0 }}>{statusText}</Text>
              {last ? <ProgressBar pct={pct} color={color} height={5} /> : null}
            </View>
            <Pressable onPress={() => { tapHaptic(); onLog(task.id); }} style={{ backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel={`Mark ${task.label} done`}>
              <Text style={{ color: "#04202a", fontSize: 12, fontWeight: "900" }}>Done</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
