import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { itemsToShow, unseenReleases } from "../lib/whatsNew";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shown once, to somebody who already had the app.
//
// Not on a fresh install: a tour of features you have never met is noise, and
// the onboarding already does that job.
export function WhatsNewSheet({ visible, seenVersion, currentVersion, onDismiss }) {
  // A sheet sits on the bottom edge, where the home indicator lives. The
  // designed gap is kept on devices without one.
  const insets = useSafeAreaInsets();
  const releases = unseenReleases(seenVersion, currentVersion);
  const items = itemsToShow(seenVersion, currentVersion);
  if (!items.length) return null;

  const title = releases.length === 1 ? releases[0].title : "What's new";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.82)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 18, paddingTop: 12, paddingBottom: Math.max(26, insets.bottom + 12), maxHeight: "86%" }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />

          <Text accessibilityRole="header" style={styles.cardEyebrow}>Updated to {currentVersion}</Text>
          <Text style={{ color: "#fff", fontSize: 24, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.5, marginTop: 2 }}>{title}</Text>

          <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              {items.map((it, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                  <Text style={{ fontSize: 20, width: 26, textAlign: "center" }}>{it.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.title}</Text>
                    <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 2 }}>{it.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 }}>
              <Ionicons name="search" size={14} color={theme.secondaryText} />
              <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16 }}>
                All of it is searchable — tap the search icon and type what you want, like "algae" or "holiday".
              </Text>
            </View>
          </ScrollView>

          <Pressable
            onPress={() => { tapHaptic("medium"); onDismiss && onDismiss(); }}
            style={[styles.primaryBtn, { marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel="Close what's new"
          >
            <Text style={styles.primaryBtnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
