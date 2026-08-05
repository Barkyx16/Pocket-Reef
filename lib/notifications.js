import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Care reminders.
//
// RemindersCard has stored a cadence since the beginning, and getTodayActions
// already knows how to turn that cadence into real, tank-specific advice. What
// was missing was anything that fires when the app is closed — so every
// retention mechanic in the app (streaks, streak-at-risk, Today) only worked
// for someone who had already opened it.
//
// Design notes:
//   * Reminders are rescheduled wholesale on every prefs or tank change. Diffing
//     individual notifications is fiddly and gets out of sync; cancel-and-rebuild
//     is cheap at this volume and always correct.
//   * Bodies are written from the user's ACTUAL top action, not a generic ping.
//     "Nitrate is climbing in Reef Tank" earns an open; "Time to check your
//     tank!" trains people to swipe it away.
//   * Every reminder carries a `to` tab in its payload, so tapping it lands on
//     the screen where you act on it — the same deep-link contract the Today
//     card uses.
// ─────────────────────────────────────────────────────────────────────────────

// Foreground presentation. Without this, a reminder that fires while the app is
// open is silently swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android needs a channel or reminders arrive silently and low-priority.
export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("reef-care", {
      name: "Reef Care Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#38e1c6",
    });
  } catch (e) {}
}

// Asks for permission, but only when there's something to schedule — prompting
// on first launch, before the user has any reason to want reminders, is how you
// get a permanent "no".
export async function requestPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return Boolean(asked.granted);
  } catch (e) {
    return false;
  }
}

export async function hasPermission() {
  try {
    return Boolean((await Notifications.getPermissionsAsync()).granted);
  } catch (e) {
    return false;
  }
}

// Cadence → days between reminders. "off" means no reminder of that kind.
const CADENCE_DAYS = { weekly: 7, biweekly: 14 };

// Morning-ish local hour for routine care, evening for the streak nudge (when
// someone still has time to act on it before the day rolls over).
const CARE_HOUR = 9;
const STREAK_HOUR = 19;

// Builds the reminder set from prefs plus whatever the tank actually needs.
// `topAction` is the highest-priority item from getTodayActions, or null.
function buildReminders({ reminderPrefs = {}, tankName = "your tank", topAction = null, streakAtRisk = false }) {
  const out = [];
  const named = tankName ? ` in ${tankName}` : "";

  const add = (key, days, title, body, to) => {
    const interval = CADENCE_DAYS[days];
    if (!interval) return; // "off"
    out.push({ key, title, body, to, seconds: interval * 24 * 60 * 60, hour: CARE_HOUR });
  };

  add(
    "waterTest",
    reminderPrefs.waterTest,
    "🧪 Time to test your water",
    topAction && topAction.text ? topAction.text : `A quick test keeps problems small${named}.`,
    "log"
  );
  add(
    "waterChange",
    reminderPrefs.waterChange,
    "🔁 Water change due",
    `Fresh water${named} — the calculator has your volume ready.`,
    "log"
  );
  add(
    "feeding",
    reminderPrefs.feeding,
    "🍤 Feeding check-in",
    `Log what you fed${named} to keep the record straight.`,
    "log"
  );

  // The streak nudge is the one reminder that isn't on a cadence — it only
  // exists on days the streak is actually at risk.
  if (streakAtRisk) {
    out.push({
      key: "streak",
      title: "🔥 Your streak is still alive",
      body: "Log anything today to keep it going.",
      to: "home",
      seconds: null,
      hour: STREAK_HOUR,
    });
  }

  return out;
}

// Seconds from now until the next occurrence of `hour` local time.
function secondsUntilHour(hour) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(60, Math.round((target - now) / 1000));
}

// Cancels everything and reschedules from the current state.
// Returns { scheduled, permitted } so callers can surface a real result.
export async function syncReminders(state = {}) {
  const permitted = await hasPermission();
  if (!permitted) return { scheduled: 0, permitted: false };

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    return { scheduled: 0, permitted: true };
  }

  await ensureAndroidChannel();

  const reminders = buildReminders(state);
  let scheduled = 0;

  for (const r of reminders) {
    try {
      // Cadence reminders repeat at their interval; the streak nudge is a
      // one-shot for this evening only.
      const trigger = r.seconds
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: r.seconds, repeats: true }
        : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsUntilHour(r.hour), repeats: false };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: r.body,
          data: { to: r.to, key: r.key },
          sound: "default",
        },
        trigger,
      });
      scheduled++;
    } catch (e) {}
  }

  return { scheduled, permitted: true };
}

// Clears every scheduled reminder — used when the user turns everything off.
export async function clearReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  } catch (e) {
    return false;
  }
}

// Subscribes to reminder taps. The handler receives the `to` tab so the app can
// land the user where they act, not just on the home screen.
export function onReminderTap(handler) {
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const to = response &&
        response.notification &&
        response.notification.request &&
        response.notification.request.content &&
        response.notification.request.content.data &&
        response.notification.request.content.data.to;
      if (to) handler(to);
    });
    return () => { try { sub.remove(); } catch (e) {} };
  } catch (e) {
    return () => {};
  }
}
