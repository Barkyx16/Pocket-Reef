import { Text, View } from "react-native";
import { styles, theme } from "../styles";

// Beginner "start here" path — the correct order of operations for a first tank,
// so new hobbyists don't skip the step that matters most (cycling).
const STEPS = [
  "Research the fish you want, then pick a tank size that fits them — bigger tanks are more stable and forgiving.",
  "Set it up: substrate, a heater, and a filter rated for about 5× turnover. Fill and let it run.",
  "Cycle the tank fishless for 4–8 weeks — add an ammonia source and test the water regularly.",
  "Wait until ammonia and nitrite both read 0 and nitrate appears. That's a 'cycled', fish-ready tank.",
  "Add a small cleanup crew first, then your first hardy fish slowly — just a few at a time.",
  "Quarantine every new arrival for ~3 weeks to keep disease out of your display tank.",
  "Do weekly water changes and test often. Consistency, not gadgets, is what keeps fish alive.",
];

export function StartHereCard() {
  return (
    <View>
      <Text style={[styles.cardText, { marginBottom: 12 }]}>New to the hobby? Follow these in order — patience through the cycle is the #1 thing beginners get wrong.</Text>
      {STEPS.map((step, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", width: 26 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(56,225,198,0.16)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{i + 1}</Text>
            </View>
            {i < STEPS.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: "rgba(56,225,198,0.25)", marginTop: 2, minHeight: 14 }} /> : null}
          </View>
          <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 20, paddingBottom: 14 }}>{step}</Text>
        </View>
      ))}
    </View>
  );
}
