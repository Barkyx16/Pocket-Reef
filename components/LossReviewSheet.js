import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// What the record can tell you, shown at the moment something is recorded as
// dead.
//
// Deliberately not an alert: an alert forces a decision from somebody who has
// just lost an animal, and its one button dismisses everything. This is a sheet
// they can read, scroll and close — and it says nothing at all when there's
// nothing worth saying.
const TONE = {
  act: { color: theme.danger, icon: "alert-circle", label: "Do this now" },
  watch: { color: theme.warn, icon: "eye-outline", label: "Worth knowing" },
  good: { color: theme.accent, icon: "checkmark-circle", label: "Rules something out" },
};

export function LossReviewSheet({ visible, review, name, onClose, onGoToTab }) {
  // A sheet sits on the bottom edge, where the home indicator lives. The
  // designed gap is kept on devices without one.
  const insets = useSafeAreaInsets();
  if (!review || !review.ok || !review.mortality || !review.findings.length) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={onClose} accessibilityLabel="Close">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(28, insets.bottom + 12), maxHeight: "84%" }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: space.lg }} />

          <Text style={{ color: "#fff", fontSize: 19, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {name ? `About ${name}` : "About this loss"}
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: space.xs }}>
            {review.headline}
          </Text>

          <ScrollView style={{ marginTop: space.lg }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: space.sm }}>
              {review.findings.map((f) => {
                const t = TONE[f.tone] || TONE.watch;
                return (
                  <View key={f.id} style={{ backgroundColor: `${t.color}12`, borderRadius: radius.lg, borderWidth: 1, borderColor: `${t.color}3d`, padding: space.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <Ionicons name={t.icon} size={15} color={t.color} />
                      <Text style={{ flex: 1, color: t.color, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{f.title}</Text>
                    </View>
                    <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: space.xs }}>
                      {f.body}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.lg, textAlign: "center" }}>
              Drawn from this tank's own record. Animals die of old age and of nothing at all — this is what the log can see, not a verdict.
            </Text>
          </ScrollView>

          {review.urgent > 0 && onGoToTab ? (
            <Pressable
              onPress={() => { tapHaptic(); onClose(); onGoToTab("log"); }}
              style={[styles.primaryBtn, { marginTop: space.lg }]}
              accessibilityRole="button"
              accessibilityLabel="Go and test the water"
            >
              <Text style={styles.primaryBtnText}>Test the water</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={styles.authLinkBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
