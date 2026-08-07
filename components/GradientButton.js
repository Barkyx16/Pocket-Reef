import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { accentGradient, styles, theme } from "../styles";
import { tapHaptic } from "../core";

// The app's call-to-action.
//
// `variant="secondary"` exists because screens were stacking two full-bleed
// glowing gradients on top of each other — "Add a Tank" directly above "Quick
// Add Fish". Two equal primaries is the same as none: the eye has nowhere to
// land, and it's one of the clearest signals of an unfinished interface. One
// primary per view; everything else is secondary.
export function GradientButton({ label, onPress, style, haptic = "medium", variant = "primary", icon }) {
  if (variant === "secondary") {
    return (
      <Pressable
        onPress={() => { tapHaptic("light"); onPress && onPress(); }}
        style={({ pressed }) => [
          {
            borderRadius: 16,
            paddingVertical: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            backgroundColor: "rgba(56,225,198,0.10)",
            borderWidth: 1,
            borderColor: "rgba(56,225,198,0.34)",
          },
          pressed && { opacity: 0.75 },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon ? <Ionicons name={icon} size={16} color={theme.accent} /> : null}
        <Text style={{ color: theme.accent, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => { tapHaptic(haptic); onPress && onPress(); }}
      style={({ pressed }) => [{ borderRadius: 16, overflow: "hidden", shadowColor: theme.accent, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
        {icon ? <Ionicons name={icon} size={17} color="#04202a" /> : null}
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
