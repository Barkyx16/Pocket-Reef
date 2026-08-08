import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tapHaptic } from "../core";

// The "More" menu — styled like Pocket Planter's More sheet: a big title, a close
// button, and a list of green icon-tile rows for the secondary sections.
export function MoreTab({ items = [], onNavigate, onClose, lockedIds }) {
  const isLocked = (id) => Boolean(lockedIds && lockedIds.has(id));
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 24 }}>
        <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.6 }}>More</Text>
        {onClose ? (
          <Pressable onPress={() => { tapHaptic(); onClose(); }} hitSlop={10} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ color: theme.text, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
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
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center", opacity: isLocked(it.id) ? 0.5 : 1 }}>
              <Ionicons name={it.icon} size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 17, fontFamily: "Inter_900Black", fontWeight: "900", opacity: isLocked(it.id) ? 0.6 : 1 }}>{it.label}</Text>
              {/* The description lived in MORE_ITEMS all along and was never
                  rendered, which is why this sheet read as five bare words. */}
              {isLocked(it.id) ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Ionicons name="lock-closed" size={11} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Premium</Text>
                </View>
              ) : it.desc ? (
                <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{it.desc}</Text>
              ) : null}
            </View>
            <Text style={{ color: theme.accent, fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
