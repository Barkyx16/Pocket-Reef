import { Text, View } from "react-native";
import { styles } from "../styles";

// A small colored tag — used for care level, temperament, compatibility, etc.
export function Chip({ label, color }) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.chipText, { color, textTransform: "uppercase", letterSpacing: 0.5 }]}>{label}</Text>
    </View>
  );
}
