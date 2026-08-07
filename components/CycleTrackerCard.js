import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getCycleStatus, getCyclingCoach } from "../core";
import { ProgressBar } from "./ProgressBar";

// Nitrogen-cycle tracker — reads your latest water test and shows where the new
// tank is on the road to "cycled." Purely derived from your logged tests.
const STAGES = [
  { key: "ammonia", label: "Ammonia", emoji: "🟡" },
  { key: "nitrite", label: "Nitrite", emoji: "🟠" },
  { key: "cycled", label: "Cycled", emoji: "✅" },
];

export function CycleTrackerCard({ waterTests = [], tankCreatedAt = null }) {
  const coach = getCyclingCoach(waterTests, tankCreatedAt);
  const status = getCycleStatus(waterTests);
  return (
    <View>
      {/* What to actually do next — cycling is where beginners lose fish, and
          almost always by stocking during the nitrite spike. */}
      <View style={{ backgroundColor: coach.cycled ? "rgba(56,225,198,0.10)" : "rgba(255,211,114,0.10)", borderWidth: 1, borderColor: coach.cycled ? "rgba(56,225,198,0.30)" : "rgba(255,211,114,0.30)", borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <Text style={{ color: coach.cycled ? theme.accent : theme.warn, fontSize: 13, fontWeight: "900" }}>{coach.action}</Text>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 17 }}>{coach.detail}</Text>
        {!coach.cycled && coach.estimateRemaining > 0 ? (
          <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "700", marginTop: 6 }}>
            Day {coach.daysIn} · typically about {coach.estimateRemaining} more day{coach.estimateRemaining === 1 ? "" : "s"}
            {coach.estimateConfident ? "" : " (rough — cycles vary a lot)"}
          </Text>
        ) : null}
        {coach.needsTest && !coach.cycled ? (
          <Text style={{ color: theme.warn, fontSize: 11, fontWeight: "900", marginTop: 6 }}>Test today — a cycle you aren't measuring isn't being managed.</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {STAGES.map((s, i) => {
          const stageNum = i + 1;
          const reached = status.stage >= stageNum;
          const current = status.stage === stageNum;
          const color = status.cycled && stageNum === 3 ? theme.accent : reached ? theme.warn : theme.border;
          return (
            <View key={s.key} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, backgroundColor: current ? `${color}22` : "rgba(255,255,255,0.03)", borderColor: reached ? color : theme.border }}>
              <Text style={{ fontSize: 20, opacity: reached ? 1 : 0.4 }}>{s.emoji}</Text>
              <Text style={{ color: reached ? "#fff" : theme.secondaryText, fontSize: 11, fontWeight: "900", marginTop: 4 }}>{s.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 12 }}>
        <ProgressBar pct={status.cycled ? 100 : (status.stage / 3) * 100} color={status.cycled ? theme.accent : theme.warn} height={7} />
      </View>
      <View style={{ marginTop: 12, backgroundColor: status.cycled ? "rgba(56,225,198,0.10)" : "rgba(255,216,107,0.08)", borderRadius: 14, borderWidth: 1, borderColor: status.cycled ? "rgba(56,225,198,0.3)" : "rgba(255,216,107,0.22)", padding: 12 }}>
        <Text style={{ color: status.cycled ? theme.accent : theme.warn, fontSize: 13, fontWeight: "900", marginBottom: 4 }}>{status.label}</Text>
        <Text style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{status.guidance}</Text>
      </View>
      {!waterTests.length ? <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "700", marginTop: 10 }}>Log a water test above and this updates automatically.</Text> : null}
    </View>
  );
}
