import { Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { accentGradient, styles, theme } from "../styles";
import { tapHaptic } from "../core";

// The app's primary call-to-action — a glowing teal gradient with a springy
// press. Falls back to a solid look via the accent gradient stops.
export function GradientButton({ label, onPress, style, haptic = "medium" }) {
  return (
    <Pressable
      onPress={() => { tapHaptic(haptic); onPress && onPress(); }}
      style={({ pressed }) => [{ borderRadius: 16, overflow: "hidden", shadowColor: theme.accent, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: "center" }}>
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
