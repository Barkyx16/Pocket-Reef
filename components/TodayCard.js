import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// The "Today" hub — a prioritized list of what needs attention right now,
// combining maintenance, testing, quarantine, care, and cycle signals. Each item
// can deep-link to the tab where you'd act on it.
export function TodayCard({ actions = [], onNavigate }) {
  if (!actions.length) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 6 }}>
        <Text style={{ fontSize: 28 }}>🎉</Text>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", marginTop: 6 }}>All caught up</Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>Nothing needs your attention today. Nice work keeping the tank happy.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {actions.map((a, i) => {
        const tappable = onNavigate && a.to;
        const Row = tappable ? Pressable : View;
        return (
          <Row
            key={i}
            onPress={tappable ? () => { tapHaptic("light"); onNavigate(a.to); } : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border }}
            accessibilityRole={tappable ? "button" : undefined}
          >
            <Text style={{ fontSize: 15 }}>{a.icon}</Text>
            <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: "800" }}>{a.text}</Text>
            {tappable ? <Text style={{ color: theme.accent, fontSize: 18, fontWeight: "900" }}>›</Text> : null}
          </Row>
        );
      })}
    </View>
  );
}
