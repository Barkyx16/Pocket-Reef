import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { accentGradient, theme } from "../styles";

// A rounded progress bar with a gradient fill and a soft track — used for XP,
// bioload, health, and achievements so every meter in the app reads as one system.
export function ProgressBar({ pct = 0, height = 8, colors, color, track = "rgba(255,255,255,0.08)", glow = false }) {
  const w = Math.max(0, Math.min(100, pct));
  const fill = colors || (color ? [color, color] : accentGradient);
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: track, overflow: "hidden" }}>
      <LinearGradient
        colors={fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          height,
          width: `${w}%`,
          borderRadius: 999,
          ...(glow ? { shadowColor: color || theme.accent, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : null),
        }}
      />
    </View>
  );
}
