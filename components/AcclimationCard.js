import { Text, View } from "react-native";
import { styles, theme } from "../styles";

// New-fish acclimation guide — the reef version of Pocket Planter's step-by-step
// planting guide. A calm, correct routine for adding a new arrival.
const STEPS = [
  "Turn off the aquarium lights to keep the new arrival calm.",
  "Float the sealed bag in your tank for about 15 minutes so the temperature matches.",
  "Open the bag and add half a cup of tank water every 5 minutes for 30–45 minutes (or use a slow drip line).",
  "Gently net the fish into the tank — never pour the bag water in with it.",
  "Leave the lights off and don't feed for the first few hours while it settles.",
  "Best practice: quarantine new arrivals in a separate tank for 2–4 weeks to protect your main tank.",
];

export function AcclimationCard() {
  return (
    <View>
      <Text style={[styles.cardText, { marginBottom: 12 }]}>Adding a new fish? Take it slow — a careful acclimation prevents shock and disease.</Text>
      {STEPS.map((step, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", width: 26 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(56,225,198,0.14)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{i + 1}</Text>
            </View>
            {i < STEPS.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: "rgba(56,225,198,0.30)", marginTop: 2, minHeight: 14 }} /> : null}
          </View>
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 20, paddingBottom: 14 }}>{step}</Text>
        </View>
      ))}
    </View>
  );
}
