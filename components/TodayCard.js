import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";

// The "Today" hub — a prioritized list of what needs attention right now,
// combining maintenance, testing, quarantine, care, and cycle signals. Each item
// can deep-link to the tab where you'd act on it.
//
// Capped, because a list of eleven urgent things is a list of zero actionable
// ones. A neglected tank plus the analysis engines can produce a wall, and a
// wall on the screen you open every morning is the fastest way to teach
// somebody to scroll past it. The rest is one tap away, never hidden — the
// list is already sorted by rank, so the cut falls on the least urgent.
const SHOWN = 5;

export function TodayCard({ actions = [], onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  if (!actions.length) {
    return (
      <View style={{ alignItems: "center", paddingVertical: space.sm }}>
        <Text style={{ fontSize: 28, letterSpacing: -0.4 }}>🎉</Text>
        <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.sm }}>All caught up</Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>Nothing needs your attention today. Nice work keeping the tank happy.</Text>
      </View>
    );
  }
  const shown = expanded ? actions : actions.slice(0, SHOWN);
  const hidden = actions.length - shown.length;

  return (
    <View style={{ gap: space.sm }}>
      {shown.map((a) => {
        const tappable = onNavigate && a.to;
        const Row = tappable ? Pressable : View;
        return (
          <Row
            // Keyed by what the row says, not by its position. This list
            // re-sorts by rank and grows when "show more" is tapped, so an
            // index key made React reuse a row for a different action — the
            // classic symptom being a tap landing on the wrong item.
            key={`${a.to}:${a.text}`}
            onPress={tappable ? () => { tapHaptic("light"); onNavigate(a.to); } : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: theme.well, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: theme.border }}
            accessibilityRole={tappable ? "button" : undefined}
          >
            <Text style={{ fontSize: type.bodyLg }}>{a.icon}</Text>
            <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{a.text}</Text>
            {tappable ? <Text style={{ color: theme.accent, fontSize: type.title, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text> : null}
          </Row>
        );
      })}

      {hidden > 0 ? (
        <Pressable
          onPress={() => { tapHaptic("light"); setExpanded(true); }}
          style={{ alignItems: "center", paddingVertical: space.sm }}
          accessibilityRole="button"
          accessibilityLabel={`Show ${hidden} more thing${hidden === 1 ? "" : "s"} that need attention`}
        >
          <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {hidden} more {hidden === 1 ? "thing" : "things"} need attention
          </Text>
        </Pressable>
      ) : null}

      {expanded && actions.length > SHOWN ? (
        <Pressable
          onPress={() => { tapHaptic("light"); setExpanded(false); }}
          style={{ alignItems: "center", paddingVertical: space.sm }}
          accessibilityRole="button"
          accessibilityLabel="Show fewer"
        >
          <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Show fewer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
