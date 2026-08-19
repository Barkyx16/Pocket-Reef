import { Text, View } from "react-native";
import { theme, radius, type } from "../styles";
import { getTodayKey } from "../core";

// Starter prompts for a blank or stale journal — the hardest part of keeping one
// is knowing what to write. Rotates daily off the date, the same deterministic
// trick TIPS/getTipOfDay uses, so it feels fresh without any stored state.
const PROMPTS = [
  "What changed in the tank this week?",
  "Photograph the coral you're proudest of right now.",
  "Which fish is behaving differently lately?",
  "Log today's algae situation — future you will want the baseline.",
  "What's the newest addition, and how is it settling in?",
  "Snap a full-tank shot. In six months this is the one you'll want.",
  "What maintenance did you skip, and did it matter?",
  "Describe the corner of the tank you're least happy with.",
  "Any new growth on the rockwork worth noting?",
  "What would you tell someone starting this tank over?",
];

function promptsFor(dateKey, count = 3) {
  const seed = dateKey.split("-").reduce((n, p) => n + Number(p), 0);
  return Array.from({ length: count }, (_, i) => PROMPTS[(seed + i * 3) % PROMPTS.length]);
}

// `daysSinceLast` is null when nothing has ever been logged.
export function JournalPromptCard({ daysSinceLast }) {
  const stale = daysSinceLast === null || daysSinceLast >= 7;
  if (!stale) return null;

  const prompts = promptsFor(getTodayKey());
  const first = daysSinceLast === null;

  return (
    <View style={{ backgroundColor: "rgba(56,225,198,0.04)", borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", padding: 16, marginBottom: 16 }}>
      <Text style={{ color: theme.accentLight, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
        {first ? "✍️ Start your log" : `✍️ ${daysSinceLast} days since your last entry`}
      </Text>
      <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19, marginTop: 6 }}>
        {first
          ? "Not sure what to write? Any of these works — a line is better than nothing."
          : "Pick one of these up and get back into it:"}
      </Text>
      {prompts.map((p) => (
        <View key={p} style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
          <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 19 }}>{p}</Text>
        </View>
      ))}
    </View>
  );
}
