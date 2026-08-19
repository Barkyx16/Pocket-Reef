import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../styles";
import { tapHaptic } from "../core";
import { ACTIONS, QUICK_ACTION_IDS } from "../lib/shortcuts";
import { pendingSummary } from "../lib/pending";
import { iconForEmoji } from "../lib/icons";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The quick-action sheet, opened by the floating button that rides above the
// tab bar on every screen.
//
// Logging a feeding used to be: Log tab → scroll to Tank Tools → Feeding pill →
// pick a food → Log. Five taps and a scroll, for the thing people do daily.
// From here it's two, from wherever they happen to be standing.
//
// Actions marked `instant` write the entry and close, no navigation at all —
// the row says so, so nobody taps expecting a form and gets a silent success.
// `pending` is a list of { tank, items } groups. With one tank the grouping is
// invisible; with several, each tank gets a heading so a job can never be
// ticked off against the wrong one.
export function QuickActionsSheet({ visible, onClose, onRun, onComplete, pending = [], roundEnabled = true, ids = QUICK_ACTION_IDS }) {
  // A sheet sits on the bottom edge, where the home indicator lives. The
  // designed gap is kept on devices without one.
  const insets = useSafeAreaInsets();
  const items = ids.map((id) => ACTIONS.find((a) => a.id === id)).filter(Boolean);
  const groups = pending;
  const all = groups.flatMap((g) => g.items);
  const summary = pendingSummary(all);
  const multiTank = groups.length > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim is the dismiss target. A sheet you can only close with its
          own small ✕ is a sheet people back out of with the OS gesture, which
          on Android leaves the app rather than the sheet. */}
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={onClose} accessibilityLabel="Close quick actions">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(30, insets.bottom + 12) }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4 }}>Quick actions</Text>
            <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={17} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {/* THE ROUND — everything actually due, finishable here.
                The record-keeping grew across seven cards on two tabs; this is
                the one place that answers "what does my tank need?" and lets
                you do it in the same gesture. */}
            {all.length ? (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Needs you now
                  </Text>
                  <Text style={{ color: summary.urgent ? theme.danger : theme.secondaryText, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                    {summary.text}
                  </Text>
                </View>

                {groups.map((group) => (
                  <View key={group.tank.id} style={{ gap: 6, marginBottom: multiTank ? 12 : 0 }}>
                    {/* Only shown when there's more than one tank — a heading
                        above a single tank's jobs is noise. */}
                    {multiTank ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 13 }}>{group.tank.emoji || "🐠"}</Text>
                        <Text numberOfLines={1} style={{ flex: 1, color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{group.tank.name}</Text>
                        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{group.items.length}</Text>
                      </View>
                    ) : null}
                  {group.items.map((item) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: item.urgent ? "rgba(255,123,123,0.4)" : theme.border, paddingHorizontal: 11, paddingVertical: 10 }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: item.urgent ? "rgba(255,123,123,0.12)" : "rgba(56,225,198,0.13)", borderWidth: 1, borderColor: item.urgent ? "rgba(255,123,123,0.32)" : "rgba(56,225,198,0.28)" }}>
                        {iconForEmoji(item.icon) ? (
                          <Ionicons name={iconForEmoji(item.icon)} size={15} color={item.urgent ? theme.danger : theme.accent} />
                        ) : (
                          <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{item.label}</Text>
                        <Text numberOfLines={1} style={{ color: item.urgent ? theme.danger : theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{item.sub}</Text>
                      </View>

                      {/* A job is finished here. A water test isn't — it needs
                          real numbers, and a Done button that logged one
                          without them would be recording a fiction. */}
                      <Pressable
                        onPress={() => { tapHaptic("medium"); onComplete(item); }}
                        hitSlop={touchSlop(32)}
                        style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel={item.kind === "upkeep" ? `Mark ${item.label} done` : `Open ${item.label}`}
                      >
                        <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                          {item.kind === "upkeep" ? "Done" : "Open"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  </View>
                ))}
              </View>
            ) : roundEnabled ? (
              // Only claim all-clear when the round was actually computed. On a
              // free account it isn't, and telling someone with two overdue
              // jobs that nothing needs them is simply untrue.
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18, backgroundColor: "rgba(56,225,198,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(56,225,198,0.24)", paddingHorizontal: 12, paddingVertical: 11 }}>
                <Ionicons name="checkmark-circle" size={16} color={theme.accent} />
                <Text style={{ flex: 1, color: theme.accent, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                  Nothing needs you right now.
                </Text>
              </View>
            ) : null}

            <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Log something
            </Text>
            <View style={{ gap: 8 }}>
              {items.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => { tapHaptic("medium"); onRun(a); }}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: theme.well, borderRadius: 16, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 12 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  accessibilityHint={a.hint}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={a.icon} size={18} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>{a.label}</Text>
                    <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>{a.hint}</Text>
                  </View>
                  {a.instant ? (
                    <View style={{ backgroundColor: "rgba(56,225,198,0.14)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: theme.accent, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.3 }}>1 tap</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// The floating button itself. Sits clear of the tab bar and hides whenever a
// detail screen or sheet is up, so it never floats over its own sheet.
export function QuickActionsFab({ onPress, onLongPress, bottom = 92, pendingCount = 0, urgent = false }) {
  return (
    <Pressable
      onPress={() => { tapHaptic("medium"); onPress(); }}
      onLongPress={onLongPress}
      style={({ pressed }) => [{
        position: "absolute", right: 18, bottom, width: 56, height: 56, borderRadius: 28,
        alignItems: "center", justifyContent: "center", backgroundColor: theme.accent,
        shadowColor: theme.accent, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 12,
      }, pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={pendingCount ? `Quick actions. ${pendingCount} thing${pendingCount === 1 ? "" : "s"} need doing.` : "Quick actions"}
      accessibilityHint="What your tank needs now, plus logging shortcuts"
    >
      <Ionicons name="add" size={30} color={theme.onAccent} />
      {/* The count is the whole reason this became the one place to look — a
          keeper shouldn't have to open it to find out whether it's worth
          opening. */}
      {pendingCount ? (
        <View
          style={{
            position: "absolute", top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11,
            paddingHorizontal: 5, alignItems: "center", justifyContent: "center",
            backgroundColor: urgent ? theme.danger : theme.cardSolid,
            borderWidth: 2, borderColor: theme.background,
          }}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: urgent ? "#3a0d0d" : theme.accent, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {pendingCount > 9 ? "9+" : pendingCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
