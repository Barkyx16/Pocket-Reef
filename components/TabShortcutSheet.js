import { Modal, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../styles";
import { tapHaptic } from "../core";
import { ACTIONS, TAB_SHORTCUTS } from "../lib/shortcuts";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// Long-press a tab to jump straight to what that tab is *for*, the way a
// long-pressed home-screen icon works on both platforms.
//
// The Log tab is the clearest case: it holds nine tools behind a pill row, and
// the one you want is never the one that's selected. Long-pressing Log lists
// all six common ones and puts you in the right tool in a single gesture.
//
// The menu is generated from TAB_SHORTCUTS, which references action ids — so a
// shortcut here always does exactly what the same shortcut does in the quick
// sheet and in search.
export function TabShortcutSheet({ tabId, tabLabel, visible, onClose, onRun, onOpenTab }) {
  const ids = TAB_SHORTCUTS[tabId] || [];
  const items = ids.map((id) => ACTIONS.find((a) => a.id === id)).filter(Boolean);
  if (!items.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={onClose} accessibilityLabel="Close shortcuts">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable accessible={false} importantForAccessibility="no" onPress={(e) => e.stopPropagation()} style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />
          <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }}>{tabLabel} shortcuts</Text>

          <View style={{ gap: 6, marginTop: 12 }}>
            {items.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => { tapHaptic("medium"); onRun(a); }}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 11, paddingVertical: 11 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={a.icon} size={16} color={theme.accent} />
                </View>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flex: 1, color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{a.label}</Text>
                {a.instant ? (
                  <Text style={{ color: theme.accent, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase" }}>1 tap</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
                )}
              </Pressable>
            ))}

            <Pressable
              onPress={() => { onClose(); onOpenTab(); }}
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: 12, marginTop: 2 }, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Open the ${tabLabel} tab`}
            >
              <Text style={{ color: theme.accent, fontSize: 13.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Open {tabLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
