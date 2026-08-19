import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { assessDataHealth } from "../lib/dataHealth";
import { listRestorePoints } from "../lib/restore";
import { reminderStatus } from "../lib/notifications";

// One answer to "if my phone went in the tank tonight, what would I lose?"
//
// Willing to say no. A green tick on a device with no account and no export is
// the one output that would actually cost somebody their records, because it's
// the output that stops them making a backup.
const TONE = {
  ok: { color: theme.accent, icon: "checkmark-circle" },
  warn: { color: theme.warn, icon: "alert-circle" },
  missing: { color: theme.danger, icon: "close-circle" },
};

export function DataHealthCard({ tanks = [], signedIn = false, lastSyncedAt = null, syncError = false, lastBackup = null, onExport, onGoToTab }) {
  const [points, setPoints] = useState([]);
  const [reminders, setReminders] = useState(null);

  useEffect(() => {
    let alive = true;
    listRestorePoints().then((p) => { if (alive) setPoints(p || []); }).catch(() => {});
    reminderStatus().then((r) => { if (alive) setReminders(r && r.state); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const health = useMemo(
    () => assessDataHealth({ tanks, signedIn, lastSyncedAt, syncError, lastBackup, restorePoints: points, remindersState: reminders }),
    [tanks, signedIn, lastSyncedAt, syncError, lastBackup, points, reminders]
  );

  const tone = health.level === "safe" ? TONE.ok : health.level === "partial" ? TONE.warn : TONE.missing;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${tone.color}14`, borderRadius: radius.xl, borderWidth: 1, borderColor: `${tone.color}40`, padding: 14 }}>
        <Ionicons name={tone.icon} size={22} color={tone.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: tone.color, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {health.level === "safe" ? "Your records are safe" : health.level === "partial" ? "Mostly protected" : "At risk"}
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 2 }}>
            {health.headline}
          </Text>
        </View>
      </View>

      {/* What's actually at stake, in the things they typed rather than in
          megabytes. */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
        {[
          { label: "Records", value: health.counts.records },
          { label: "Photos", value: health.counts.photos },
          { label: "Tanks", value: health.counts.tanks },
          { label: "Years", value: health.yearsLogged || "—" },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, alignItems: "center", backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, paddingVertical: 9 }}>
            <Text style={{ color: theme.text, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s.value}</Text>
            <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
        {health.checks.map((c) => {
          const t = TONE[c.state] || TONE.ok;
          return (
            <View key={c.id} style={{ flexDirection: "row", gap: 9, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: c.state === "ok" ? theme.border : `${t.color}44`, padding: 11 }}>
              <Ionicons name={t.icon} size={15} color={t.color} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{c.label}</Text>
                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 2 }}>{c.detail}</Text>
                {c.fix ? (
                  <Text style={{ color: t.color, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 16, marginTop: 3 }}>{c.fix}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {onExport ? (
        <Pressable onPress={() => { tapHaptic(); onExport(); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button" accessibilityLabel="Export a backup file now">
          <Text style={styles.ghostBtnText}>Export a backup file</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
