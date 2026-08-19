import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { reminderStatus, requestPermission } from "../lib/notifications";
import { tapHaptic } from "../core";
import { Pill } from "./Pill";

// Care reminder preferences — and, since this upgrade, whether they are
// actually going to arrive.
//
// The card used to set a cadence and say nothing else, with a line of hedging
// prose about EAS builds. Every way this can fail is silent: permission denied
// at the prompt, permission revoked in Settings a month later, or running in
// Expo Go where nothing can be scheduled at all. In all three the pickers still
// read "Weekly" and no notification ever fired. A reminder you believe is set
// is worse than one you know isn't.
const FREQ = [
  { id: "off", label: "Off" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 wks" },
];

function Row({ label, value, onChange }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {FREQ.map((f) => (
          <Pill key={f.id} fill label={f.label} active={value === f.id} onPress={() => onChange(f.id)} />
        ))}
      </View>
    </View>
  );
}

// "in 3 days" / "tomorrow at 9am" — the reassurance that something is armed.
export function describeNext(date, now = new Date()) {
  if (!date) return null;
  const ms = new Date(date).getTime() - new Date(now).getTime();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const hours = Math.round(ms / 3600000);
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function RemindersCard({ prefs, onChange, tank = null, onChangeTankReminders }) {
  const p = prefs || {};
  const set = (key, val) => onChange({ ...p, [key]: val });
  const wantsAny = ["waterTest", "waterChange", "feeding"].some((k) => p[k] && p[k] !== "off");

  const [status, setStatus] = useState(null);
  const refresh = useCallback(() => { reminderStatus().then(setStatus).catch(() => {}); }, []);

  // Re-checked on return from the OS Settings app, so granting permission there
  // and coming back doesn't leave a stale "blocked" banner on screen.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    return () => sub?.remove?.();
  }, [refresh]);

  // Scheduling is rebuilt by App whenever prefs change; give it a moment to
  // land before re-reading the count.
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(refresh, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed to the prefs that change scheduling; `refresh` is stable.
  }, [p.waterTest, p.waterChange, p.feeding]);

  const enable = async () => {
    tapHaptic();
    const ok = await requestPermission();
    if (!ok) Linking.openSettings().catch(() => {});
    refresh();
  };

  const banner = (() => {
    if (!wantsAny || !status) return null;
    const { state, scheduled, next } = status;

    if (state === "unsupported") {
      return {
        tone: theme.secondaryText,
        icon: "phone-portrait-outline",
        text: "Notifications can't run in Expo Go. Your schedule is saved and starts working in a build installed on your device.",
      };
    }
    if (state === "blocked") {
      return {
        tone: theme.danger,
        icon: "notifications-off",
        text: "Notifications are turned off for Pocket Reef, so none of these will arrive.",
        action: "Open Settings",
      };
    }
    if (state === "ask") {
      return {
        tone: theme.warn,
        icon: "notifications-outline",
        text: "Pocket Reef hasn't been allowed to send notifications yet — nothing will arrive until it is.",
        action: "Allow notifications",
      };
    }
    // Granted. `scheduled` is null when the list couldn't be read.
    if (scheduled === 0) {
      return { tone: theme.warn, icon: "alert-circle-outline", text: "Allowed, but nothing is scheduled yet. Reopen the app if this doesn't clear." };
    }
    const when = describeNext(next);
    return {
      tone: theme.accent,
      icon: "checkmark-circle",
      text: scheduled == null
        ? "Notifications are allowed."
        : `${scheduled} reminder${scheduled === 1 ? "" : "s"} scheduled${when ? ` — next ${when}` : ""}.`,
    };
  })();

  return (
    <View>
      <Text style={styles.cardText}>Set your care schedule. Reminders arrive as notifications and land on the screen where you act on them.</Text>

      {banner ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 12, backgroundColor: `${banner.tone}14`, borderRadius: radius.md, borderWidth: 1, borderColor: `${banner.tone}44`, paddingHorizontal: 11, paddingVertical: 10 }}>
          <Ionicons name={banner.icon} size={15} color={banner.tone} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>{banner.text}</Text>
            {banner.action ? (
              <Pressable onPress={enable} style={{ marginTop: 8 }} accessibilityRole="button" accessibilityLabel={banner.action}>
                <Text style={{ color: banner.tone, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{banner.action} ›</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 14 }}>
        <Row label="Test water" value={p.waterTest || "weekly"} onChange={(v) => set("waterTest", v)} />
        <Row label="Water change" value={p.waterChange || "weekly"} onChange={(v) => set("waterChange", v)} />
        <Row label="Feeding check-in" value={p.feeding || "off"} onChange={(v) => set("feeding", v)} />
      </View>

      {/* A per-tank override. A quarantine box and a display reef want
          completely different schedules, and one cadence for both meant the
          bare QT box was reported overdue on the display's rhythm. Defaults to
          "follow the above", so a single-tank keeper never sees a decision. */}
      {tank && onChangeTankReminders ? (
        <View style={{ marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            Just for {tank.name || "this tank"}
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 3, marginBottom: 10 }}>
            Leave these on “Same as above” unless this tank runs to its own schedule.
          </Text>

          {[
            ["waterTest", "Test water"],
            ["waterChange", "Water change"],
            ["feeding", "Feeding check-in"],
          ].map(([key, label]) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 6 }}>{label}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[{ id: "", label: "Same as above" }, ...FREQ].map((f) => {
                  const current = (tank.reminders || {})[key] || "";
                  return (
                    <Pill
                      key={f.id || "inherit"}
                      label={f.label}
                      active={current === f.id}
                      onPress={() => onChangeTankReminders({ ...(tank.reminders || {}), [key]: f.id || undefined })}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
