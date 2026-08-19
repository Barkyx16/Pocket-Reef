import { Pressable, Text, View } from "react-native";
import { styles, theme, type, space } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";

// ─────────────────────────────────────────────────────────────────────────────
// What the free user is actually missing — with their own numbers in it.
//
// A locked tab that says "upgrade for more features" creates no desire. The
// same wall that says "we found 3 problems in your 20 gallon" creates a
// question the user now wants answered. Everything here is computed from their
// real tank; nothing is invented, and nothing is shown when there's nothing
// genuinely waiting.
//
// The honesty rule: name the finding, withhold the detail. Claiming problems
// that don't exist would sell one subscription and lose the refund plus the
// review.
// ─────────────────────────────────────────────────────────────────────────────
export function PremiumTeaserCard({ warnings = [], healthScore = null, tankName = "your tank", lockedSpecies = 0, onOpenPremium }) {
  const issues = warnings.length;

  // Build the list of things we can honestly say are waiting.
  const lines = [];
  if (issues) {
    lines.push({
      icon: "⚠️",
      text: `${issues} stocking issue${issues > 1 ? "s" : ""} found in ${tankName}`,
      hint: "See what they are and how to fix them",
    });
  }
  if (typeof healthScore === "number") {
    lines.push({
      icon: healthScore >= 80 ? "💚" : healthScore >= 55 ? "💛" : "❤️",
      text: `Tank health scored ${healthScore}/100`,
      hint: "Unlock the full breakdown of what's pulling it up and down",
    });
  }
  if (lockedSpecies > 0) {
    lines.push({
      icon: "🐠",
      text: `${lockedSpecies} more species in the catalog`,
      hint: "Care guides, compatibility, and what fits your tank",
    });
  }

  if (!lines.length) return null;

  return (
    <Pressable
      onPress={onOpenPremium}
      style={({ pressed }) => [styles.cardElevated, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
      accessibilityRole="button"
      accessibilityLabel="See what Premium unlocks for your tank"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md }}>
        <Ionicons name="lock-closed" size={13} color={theme.accent} />
        <Text accessibilityRole="header" style={styles.cardEyebrow}>Waiting for you</Text>
      </View>

      <View style={{ gap: space.lg }}>
        {lines.map((l) => (
          <View key={l.text} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View style={styles.iconSquare}><Text style={{ fontSize: type.bodyLg }}>{l.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", lineHeight: 19 }}>{l.text}</Text>
              <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.hair, lineHeight: 17 }}>{l.hint}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Unlock with Premium</Text>
        <Text style={{ color: theme.accent, fontSize: type.title, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
      </View>
    </Pressable>
  );
}
