import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic, successHaptic, warningHaptic } from "../core";
import { touchSlop } from "../lib/a11y";
import { listRestorePoints, createRestorePoint, restoreToPoint, deleteRestorePoint, describeAge, describeSize, MAX_POINTS } from "../lib/restore";

// Local restore points, and the way back.
//
// Export protects data the keeper remembers to protect. Cloud sync replicates
// a mistake to every device within seconds. This is the third thing: automatic
// local snapshots, so the answer to "I've just wrecked four years of readings"
// is a tap rather than an email to support.

export function RestorePointsCard({ onRestored }) {
  const [points, setPoints] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { listRestorePoints().then(setPoints).catch(() => setPoints([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const take = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const entry = await createRestorePoint("Manual");
      if (entry) successHaptic();
      refresh();
    } finally { setBusy(false); }
  };

  // Restoring overwrites everything. It is confirmed, it says what it will do,
  // and — because it snapshots the present first — it is itself undoable.
  const restore = (entry) => {
    warningHaptic();
    Alert.alert(
      `Restore from ${describeAge(entry.at)}?`,
      `Every tank, reading and journal entry goes back to how it was ${describeAge(entry.at)}. Anything logged since is replaced.\n\nA snapshot of right now is taken first, so this can be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await restoreToPoint(entry.id);
              if (!res.ok) { Alert.alert("Couldn't restore", res.reason); return; }
              successHaptic();
              refresh();
              // The app is holding stale state in memory; the caller decides
              // how to reload rather than this card guessing.
              onRestored && onRestored();
            } finally { setBusy(false); }
          },
        },
      ]
    );
  };

  const remove = (entry) => {
    tapHaptic("light");
    deleteRestorePoint(entry.id).then(setPoints).catch(() => {});
  };

  return (
    <View>
      <Text style={styles.cardText}>
        Pocket Reef keeps the last {MAX_POINTS} snapshots of everything on this device, taking one automatically each day and before anything destructive. They live here, not in the cloud — a bad sync can't reach them.
      </Text>

      {points === null ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} />
      ) : !points.length ? (
        <Text style={{ color: theme.secondaryText, fontSize: type.small, lineHeight: 18, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 12 }}>
          No snapshots yet — the first is taken automatically next time the app opens.
        </Text>
      ) : (
        <View style={{ gap: 8, marginTop: 12 }}>
          {points.map((e) => (
            <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 11 }}>
              <Ionicons name={e.auto ? "time-outline" : "bookmark-outline"} size={15} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{describeAge(e.at)}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>
                  {e.reason} · {describeSize(e.bytes)}
                </Text>
              </View>
              <Pressable
                onPress={() => restore(e)}
                disabled={busy}
                style={[styles.pill, { paddingHorizontal: 12 }]}
                accessibilityRole="button"
                accessibilityLabel={`Restore everything to how it was ${describeAge(e.at)}`}
              >
                <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Restore</Text>
              </Pressable>
              <Pressable onPress={() => remove(e)} hitSlop={touchSlop(22)} accessibilityRole="button" accessibilityLabel={`Delete the snapshot from ${describeAge(e.at)}`}>
                <Ionicons name="close" size={14} color={theme.secondaryText} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={take} disabled={busy} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button" accessibilityLabel={busy ? "Taking a snapshot" : "Take a snapshot now"} accessibilityState={{ busy }}>
        {busy ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Take a snapshot now</Text>}
      </Pressable>
    </View>
  );
}
