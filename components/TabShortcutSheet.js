import { Modal, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { ACTIONS, TAB_SHORTCUTS } from "../lib/shortcuts";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  // A sheet sits on the bottom edge, where the home indicator lives. The
  // designed gap is kept on devices without one.
  const insets = useSafeAreaInsets();
  const ids = TAB_SHORTCUTS[tabId] || [];
  const items = ids.map((id) => ACTIONS.find((a) => a.id === id)).filter(Boolean);
  if (!items.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={onClose} accessibilityLabel="Close shortcuts">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable accessible={false} importantForAccessibility="no" onPress={(e) => e.stopPropagation()} style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(30, insets.bottom + 12) }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: space.lg }} />
          <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>{tabLabel} shortcuts</Text>

          <View style={{ gap: space.sm, marginTop: space.md }}>
            {items.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => { tapHaptic("medium"); onRun(a); }}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: space.md, paddingVertical: space.md }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={a.icon} size={16} color={theme.accent} />
                </View>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flex: 1, color: "#fff", fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{a.label}</Text>
                {a.instant ? (
                  <Text style={{ color: theme.accent, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", textTransform: "uppercase" }}>1 tap</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
                )}
              </Pressable>
            ))}

            <Pressable
              onPress={() => { onClose(); onOpenTab(); }}
              style={({ pressed }) => [{ alignItems: "center", paddingVertical: space.md, marginTop: space.hair }, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Open the ${tabLabel} tab`}
            >
              <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Open {tabLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
