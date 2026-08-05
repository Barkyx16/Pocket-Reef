import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// The "More" menu — styled like Pocket Planter's More sheet: a big title, a close
// button, and a list of green icon-tile rows for the secondary sections.
export function MoreTab({ items = [], onNavigate, onClose }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 22 }}>
        <Text style={{ color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: -0.6 }}>More</Text>
        {onClose ? (
          <Pressable onPress={() => { tapHaptic(); onClose(); }} hitSlop={10} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {items.map((it) => (
          <Pressable
            key={it.id}
            onPress={() => { tapHaptic(); onNavigate && onNavigate(it.id); }}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, borderRadius: 16 }, pressed && { opacity: 0.65 }]}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: "rgba(56,225,198,0.16)", borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{it.emoji}</Text>
            </View>
            <Text style={{ flex: 1, color: "#fff", fontSize: 20, fontWeight: "900" }}>{it.label}</Text>
            <Text style={{ color: theme.accent, fontSize: 22, fontWeight: "900" }}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
