import { Pressable, Text } from "react-native";
import { styles, theme } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tapHaptic } from "../core";

// The standard filter/toggle pill — tonal when off, glowing accent when on, with
// a springy press. Unifies the many inline pills across the app.
export function Pill({ label, active, onPress, haptic = "light", fill = false, icon }) {
  return (
    <Pressable
      onPress={() => { tapHaptic(haptic); onPress && onPress(); }}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center" }, 
        styles.pill,
        fill && { flex: 1, alignItems: "center" },
        {
          backgroundColor: active ? theme.accent : "rgba(255,255,255,0.05)",
          borderColor: active ? theme.accent : theme.border,
          ...(active ? { shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 } : null),
        },
        pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={active ? "#04202a" : theme.accent} style={{ marginRight: 6 }} />
      ) : null}
      <Text style={{ color: active ? "#04202a" : theme.text, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
