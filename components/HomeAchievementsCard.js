import { Pressable, Text, View } from "react-native";
import { theme } from "../styles";
import { tapHaptic } from "../core";
import { ProgressBar } from "./ProgressBar";

// Compact achievements summary for Home — surfaces the badge system (which
// otherwise lives only on Profile) with a progress bar and a peek at the next
// few badges still to earn. Tapping jumps to the full Achievements list.
export function HomeAchievementsCard({ achievements = [], onPress }) {
  const earned = achievements.filter((a) => a.earned).length;
  const total = achievements.length;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  const next = achievements.filter((a) => !a.earned).slice(0, 4);

  return (
    <Pressable onPress={() => { tapHaptic(); onPress && onPress(); }} accessibilityRole="button" accessibilityLabel={`Achievements: ${earned} of ${total} unlocked`}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>{earned} <Text style={{ color: theme.secondaryText, fontSize: 14 }}>/ {total} badges</Text></Text>
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "900" }}>View all ›</Text>
      </View>
      <View style={{ marginTop: 10 }}><ProgressBar pct={pct} height={8} /></View>
      {next.length ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {next.map((a) => (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, opacity: 0.5 }}>{a.emoji}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "800" }}>{a.title}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "800", marginTop: 10 }}>Every badge earned — legendary reefer! 🏆</Text>
      )}
    </Pressable>
  );
}
