import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// Multiple-tank switcher. Free users get one tank; adding more is a premium
// feature. Tap a tank to make it active; ✕ deletes (when more than one).
export function TankSwitcher({ tanks = [], activeTankId, onSwitch, onEdit, onAdd, onDelete, onDuplicate, premiumUnlocked, onOpenPremium }) {
  const canAddFree = tanks.length < 1 || premiumUnlocked;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {tanks.map((tk) => {
          const on = tk.id === activeTankId;
          return (
            // Same nesting problem as SpeciesCard: duplicate and delete were
            // buttons inside the chip button. Split so each is its own control.
            <View key={tk.id} style={{ flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: on ? theme.accent : "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: on ? theme.accent : theme.border, ...(on ? { shadowColor: theme.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 } : null) }}>
            <Pressable onPress={() => (on ? onEdit && onEdit(tk.id) : onSwitch(tk.id))} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 8, paddingVertical: 10 }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={on ? `Edit ${tk.name}` : `Switch to ${tk.name}`}>
              <Text style={{ color: on ? "#04202a" : theme.text, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>{tk.emoji || "🐠"} {tk.name}</Text>
              <View style={{ backgroundColor: on ? "rgba(4,32,42,0.18)" : "rgba(255,255,255,0.08)", borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: "center" }}>
                <Text style={{ color: on ? "#04202a" : theme.secondaryText, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>{tk.stock ? tk.stock.length : 0}</Text>
              </View>
              {on ? <Text style={{ color: "#04202a", fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>✎</Text> : null}
              </Pressable>

              {on && onDuplicate ? (
                <Pressable onPress={() => onDuplicate(tk.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Duplicate ${tk.name}`}>
                  <Text style={{ color: "#04202a", fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}> ⧉</Text>
                </Pressable>
              ) : null}
              {on && tanks.length > 1 ? (
                <Pressable onPress={() => onDelete(tk.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${tk.name}`}>
                  <Text style={{ color: "#04202a", fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}> ✕</Text>
                </Pressable>
              ) : null}
              {on ? <View style={{ width: 8 }} /> : null}
            </View>
          );
        })}
        <Pressable
          onPress={() => { tapHaptic(); canAddFree ? onAdd() : onOpenPremium && onOpenPremium(); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: theme.border }}
          accessibilityRole="button"
          accessibilityLabel="Add a tank"
        >
          <Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>＋ Tank</Text>
          {!canAddFree ? <Text style={{ fontSize: 11 }}>🔒</Text> : null}
        </Pressable>
      </ScrollView>
    </View>
  );
}
