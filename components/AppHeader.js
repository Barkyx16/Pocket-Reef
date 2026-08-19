import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { touchSlop } from "../lib/a11y";

// A slim bar above every tab. Two things live here, and only two, because a
// header that grows becomes a second tab bar:
//
//   • the active tank, as a chip — tap it to switch. Switching tanks used to
//     mean Home → scroll → the tank strip, from any other tab. Every screen in
//     the app reads from the active tank, so "which tank am I looking at?" also
//     belongs on screen at all times, not two navigations away.
//   • search, which opens the universal search over whatever you were doing.
//
// 44pt tall, so it costs one line of a card rather than a hero's worth.
export function AppHeader({ tank, tankCount = 1, onOpenTankMenu, onOpenSearch, syncPending, attentionElsewhere = "ok" }) {
  // A dot on the count badge when a tank you're NOT looking at needs something.
  // It rides the existing badge rather than adding a third element, so the
  // 44pt bar stays a 44pt bar.
  const alertColor = attentionElsewhere === "urgent" ? theme.danger : attentionElsewhere === "due" ? theme.warn : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
      <Pressable
        onPress={() => { tapHaptic("light"); onOpenTankMenu(); }}
        style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 11, paddingVertical: 8 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel={`Active tank: ${tank ? tank.name : "none"}.${alertColor ? " Another tank needs attention." : ""} Tap to switch tanks.`}
      >
        <Text style={{ fontSize: type.bodyLg }}>{(tank && tank.emoji) || "🐠"}</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{(tank && tank.name) || "My Tank"}</Text>
        {syncPending ? <Ionicons name="cloud-upload-outline" size={13} color={theme.warn} /> : null}
        {tankCount > 1 ? (
          <View style={{ backgroundColor: alertColor ? `${alertColor}22` : "rgba(56,225,198,0.14)", borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
            {alertColor ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: alertColor }} /> : null}
            <Text style={{ color: alertColor || theme.accent, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{tankCount}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-down" size={13} color={theme.secondaryText} />
      </Pressable>

      <Pressable
        hitSlop={touchSlop(38)}
        onPress={() => { tapHaptic("light"); onOpenSearch(); }}
        style={({ pressed }) => [{ width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Search"
        accessibilityHint="Find a fish, disease, tank, journal note or screen"
      >
        <Ionicons name="search" size={17} color={theme.accent} />
      </Pressable>
    </View>
  );
}

// The tank menu the chip opens. Switching is one tap; the tank admin that used
// to be the only way in (edit, duplicate, delete) stays on Home, so this list
// can't turn into a settings screen you have to read.
export function TankMenu({ visible, tanks = [], activeTankId, onClose, onSwitch, onAdd, onEdit, attention = {} }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={onClose} accessibilityLabel="Close tank menu">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable accessible={false} importantForAccessibility="no" onPress={(e) => e.stopPropagation()} style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />
          <Text style={{ color: "#fff", fontSize: type.titleLg, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, marginBottom: 14 }}>Switch tank</Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 8 }}>
              {tanks.map((tk) => {
                const on = tk.id === activeTankId;
                // What this tank needs, if anything. The specs line stays —
                // it's how you tell two tanks apart — but it gives up the row
                // to the reason whenever there is one, because "Ammonia
                // dangerous" is the only thing worth reading at that moment.
                const att = attention[tk.id];
                const alert = att && att.needsAttention ? att : null;
                const alertColor = alert ? (alert.level === "urgent" ? theme.danger : theme.warn) : null;
                return (
                  <Pressable
                    key={tk.id}
                    onPress={() => { tapHaptic(); on ? onEdit(tk.id) : onSwitch(tk.id); onClose(); }}
                    style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: on ? "rgba(56,225,198,0.14)" : theme.well, borderColor: on ? theme.accent : alertColor ? `${alertColor}55` : theme.border }, pressed && { opacity: 0.75 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    // Unchanged when the tank is fine — the alert is appended,
                    // never folded into the base phrasing.
                    accessibilityLabel={
                      (on ? `${tk.name}, active. Tap to edit.` : `Switch to ${tk.name}`) +
                      (alert ? ` Needs attention: ${alert.reasons.join(", ")}.` : "")
                    }
                  >
                    <Text style={{ fontSize: type.titleLg }}>{tk.emoji || "🐠"}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text numberOfLines={1} style={{ flexShrink: 1, color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{tk.name}</Text>
                        {alertColor ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: alertColor }} /> : null}
                      </View>
                      {alert ? (
                        <Text numberOfLines={1} style={{ color: alertColor, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>
                          {alert.reasons.join(" · ")}
                        </Text>
                      ) : (
                        <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                          {formatVolume(tk.gallons)} · {tk.water === "salt" ? "Saltwater" : "Freshwater"} · {(tk.stock || []).length} fish
                        </Text>
                      )}
                    </View>
                    <Ionicons name={on ? "create-outline" : "chevron-forward"} size={17} color={on ? theme.accent : alertColor || theme.secondaryText} />
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => { onClose(); onAdd(); }}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.border, borderStyle: "dashed", paddingVertical: 13 }, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Add a tank"
              >
                <Ionicons name="add" size={17} color={theme.accent} />
                <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>New tank</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
