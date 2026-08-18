import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { HAS_NATIVE_MODULES } from "./runtime";

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
// Registering this in Expo Go produces the "functionality is not fully
// supported" and "Android push was removed in SDK 53" warnings on every launch,
// for a feature that cannot run there anyway.
if (HAS_NATIVE_MODULES) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Actionable reminders ─────────────────────────────────────────────────────
//
// Every reminder this app sends can only be tapped, which opens the app to the
// screen where you do the thing. That's the right fallback and a poor default:
// a keeper glancing at their lock screen at 9am has already decided whether
// they fed the tank, and making them open an app, find a tab and press a
// button to record a decision they made two seconds ago is how a reminder
// becomes something people swipe away.
//
// iOS and Android both support buttons on a notification. "Done" records it
// without opening anything; "Later" defers without leaving a false record,
// which matters because the alternative — swiping it away — leaves the app
// believing the job is still outstanding while the keeper believes they
// answered it.
export const CATEGORY = {
  chore: "reef-chore",     // something that can be marked done from the shade
  info: "reef-info",       // a forecast or alert; nothing to tick
};

export const ACTION = { done: "done", snooze: "snooze" };

// Registered once, before anything is scheduled. A notification referencing a
// category that was never registered still arrives — just without its buttons —
// so a failure here degrades rather than breaks.
export async function registerCategories() {
  if (!HAS_NATIVE_MODULES) return false;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY.chore, [
      { identifier: ACTION.done, buttonTitle: "Done", options: { opensAppToForeground: false } },
      { identifier: ACTION.snooze, buttonTitle: "Later", options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORY.info, [
      { identifier: ACTION.snooze, buttonTitle: "Remind me tomorrow", options: { opensAppToForeground: false } },
    ]);
    return true;
  } catch (e) {
    return false;
  }
}

// Android needs a channel or reminders arrive silently and low-priority.
export async function ensureAndroidChannel() {
  if (!HAS_NATIVE_MODULES || Platform.OS !== "android") return;
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
  if (!HAS_NATIVE_MODULES) return false;
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
  if (!HAS_NATIVE_MODULES) return false;
  try {
    return Boolean((await Notifications.getPermissionsAsync()).granted);
  } catch (e) {
    return false;
  }
}

// What the reminder system is ACTUALLY doing right now.
//
// The settings card offered three cadence pickers and no feedback, so every
// failure mode looked identical to success: permission denied at the OS prompt,
// permission revoked in Settings months later, or running in Expo Go where
// scheduling cannot work at all. In every one of those cases the card still
// read "Weekly" and nothing ever fired — the app quietly promising to remind
// someone to test their water, and then not doing it.
//
//   state: "unsupported" — no native module (Expo Go); nothing can be scheduled
//          "blocked"     — the OS said no and won't ask again; needs Settings
//          "ask"         — permission not granted yet, but we can still prompt
//          "on"          — permission granted
export async function reminderStatus() {
  if (!HAS_NATIVE_MODULES) return { state: "unsupported", scheduled: 0, next: null };
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      return { state: perms.canAskAgain === false ? "blocked" : "ask", scheduled: 0, next: null };
    }
    let scheduled = [];
    try {
      scheduled = (await Notifications.getAllScheduledNotificationsAsync()) || [];
    } catch (e) {
      // Permission is real but the list is unavailable — report the permission
      // truthfully rather than claiming zero reminders exist.
      return { state: "on", scheduled: null, next: null };
    }
    return { state: "on", scheduled: scheduled.length, next: nextFireDate(scheduled) };
  } catch (e) {
    return { state: "unsupported", scheduled: 0, next: null };
  }
}

// The soonest trigger across the scheduled set. DATE triggers carry their
// instant directly; interval triggers only carry seconds from when they were
// armed, which is not recoverable here — those are skipped rather than guessed.
export function nextFireDate(scheduled = []) {
  const times = scheduled
    .map((n) => {
      const t = n && n.trigger;
      if (!t) return null;
      const raw = t.value != null ? t.value : t.date;
      if (raw == null) return null;
      const ms = typeof raw === "number" ? raw : new Date(raw).getTime();
      return Number.isNaN(ms) ? null : ms;
    })
    .filter((ms) => ms != null && ms > Date.now());
  return times.length ? new Date(Math.min(...times)) : null;
}

// The cadence that actually applies to one tank: its own override where it has
// one, the account default otherwise. Kept here so App, the Today hub and the
// scheduler can't disagree about whose schedule a tank is on.
export function cadenceFor(tank = {}, globalPrefs = {}, key) {
  const own = tank && tank.reminders ? tank.reminders[key] : undefined;
  return own || globalPrefs[key];
}

// Cadence → days between reminders. "off" means no reminder of that kind.
const CADENCE_DAYS = { weekly: 7, biweekly: 14 };

// Morning-ish local hour for routine care, evening for the streak nudge (when
// someone still has time to act on it before the day rolls over).
const CARE_HOUR = 9;
// Past a fortnight a forecast is a trend, not an appointment — and a
// notification about something two months out trains people to ignore them.
const FORECAST_ALERT_HORIZON = 14;
const STREAK_HOUR = 19;

// Builds the reminder set from prefs plus whatever the tank actually needs.
// `topAction` is the highest-priority item from getTodayActions, or null.
// Names the tanks a reminder is actually about.
//
// Reminders were built from the ACTIVE tank alone — so a keeper with three
// tanks, which is a paid feature, was reminded about whichever one they last
// happened to open and never told about the other two. Worse, the body said
// "in The Reef" while the tank that was actually overdue was the nano.
//
// One notification per cadence still, because three tanks × three cadences is
// nine alerts a week and nobody keeps those switched on. The body carries which
// tanks are due instead.
export function nameTanks(names = []) {
  const list = names.filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return ` in ${list[0]}`;
  if (list.length === 2) return ` in ${list[0]} and ${list[1]}`;
  return ` in ${list[0]} and ${list.length - 1} others`;
}

function buildReminders({ reminderPrefs = {}, tanks = [], tankName = "your tank", topAction = null, streakAtRisk = false, forecasts = [] }) {
  const out = [];
  // Falls back to the single-tank phrasing when no per-tank detail was passed,
  // so an older caller still produces a sensible reminder.
  const fallback = tankName ? ` in ${tankName}` : "";

  const add = (key, days, title, body, to) => {
    const interval = CADENCE_DAYS[days];
    if (!interval) return; // "off"
    // `days` is the cadence in days; the reminder fires at CARE_HOUR on the
    // day it comes due, not `interval` seconds after whenever this last ran.
    // A cadence reminder is a chore: it can be answered from the shade.
    out.push({ key, title, body, to, intervalDays: interval, hour: CARE_HOUR, category: CATEGORY.chore, action: key });
  };

  const dueFor = (flag) => {
    const names = tanks.filter((t) => t && t[flag]).map((t) => t.name);
    return names.length ? nameTanks(names) : null;
  };

  const testNamed = dueFor("testDue");
  const changeNamed = dueFor("changeDue");

  add(
    "waterTest",
    reminderPrefs.waterTest,
    "🧪 Time to test your water",
    // A single-tank keeper keeps the specific Today action, which is more
    // useful than a generic line. Multi-tank keepers need to know which tank.
    testNamed && tanks.length > 1
      ? `Due${testNamed}.`
      : (topAction && topAction.text ? topAction.text : `A quick test keeps problems small${testNamed || fallback}.`),
    "log"
  );
  add(
    "waterChange",
    reminderPrefs.waterChange,
    "🔁 Water change due",
    `Fresh water${changeNamed || fallback} — the calculator has your volume ready.`,
    "log"
  );
  add(
    "feeding",
    reminderPrefs.feeding,
    "🍤 Feeding check-in",
    `Log what you fed${tanks.length > 1 ? "" : fallback} to keep the record straight.`,
    "log"
  );

  // ── Predictive alerts ──────────────────────────────────────────────────────
  //
  // Every reminder above fires on a calendar. None of them knows anything about
  // the tank, so the most useful notification the app could possibly send — the
  // one that says a parameter is on course to leave its safe range on Thursday
  // — could not exist. getParamForecasts has been computing exactly that and
  // showing it only to somebody who opens the Forecast tool and scrolls.
  //
  // These fire once, timed to land a day or two BEFORE the crossing, which is
  // the entire point: an alert that arrives on the day is just the bad news.
  (forecasts || []).forEach((f) => {
    if (!f || !f.daysToEdge || f.daysToEdge <= 0) return;
    // Only forecasts the engine itself is confident in. It already refuses to
    // put a date on a weak fit; this refuses to wake somebody up for one.
    if (!f.confident) return;
    if (f.daysToEdge > FORECAST_ALERT_HORIZON) return;

    // A day of warning at minimum, two where the timeline allows.
    const lead = f.daysToEdge >= 4 ? 2 : 1;
    out.push({
      key: `forecast_${f.key}`,
      title: `📈 ${f.label} is heading out of range`,
      body: `At the current rate it leaves the safe range in about ${f.daysToEdge} days${tanks.length > 1 && tankName ? ` in ${tankName}` : ""}. Easier to correct now than after.`,
      to: "log",
      // The notification names a parameter; landing on a bare Log tab then
      // asks the keeper to go and find the thing they were just told about.
      // The forecast tool is the card that explains exactly this.
      tool: "forecast",
      intervalDays: Math.max(1, f.daysToEdge - lead),
      hour: CARE_HOUR,
    });
  });

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
// The next time this cadence comes due: CARE_HOUR, `days` from today.
//
// A DATE trigger is one-shot, so it's re-armed on the next launch — which is
// fine, and much safer than a repeating interval that silently drifts. Anchored
// to the calendar day rather than the current clock, so rescheduling twice in
// one day produces the same instant both times.
function nextOccurrence(days, hour) {
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  target.setDate(target.getDate() + Math.max(1, days));
  return target;
}

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
  await registerCategories();

  const reminders = buildReminders(state);
  let scheduled = 0;

  for (const r of reminders) {
    try {
      // Cadence reminders repeat at their interval; the streak nudge is a
      // one-shot for this evening only.
      // Cadence reminders used TIME_INTERVAL repeating from *now*, which had
      // two consequences nobody would guess from the code:
      //
      //   1. The reminder landed at whatever time of day you last edited the
      //      tank. Log a feeding at 11:47pm and your reminder became an
      //      11:47pm reminder. CARE_HOUR was collected and then never used,
      //      because `r.seconds` always won the ternary.
      //   2. syncReminders cancels everything and reschedules, and it ran on
      //      every tank edit — so the 7-day countdown restarted each time. A
      //      keeper who touched the app more often than weekly could never
      //      receive a weekly reminder at all.
      //
      // A fixed clock time fixes both: the schedule no longer depends on when
      // it was last written.
      const trigger = r.intervalDays
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextOccurrence(r.intervalDays, r.hour) }
        : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsUntilHour(r.hour), repeats: false };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: r.body,
          data: { to: r.to, key: r.key, tool: r.tool || null, action: r.action || null },
          sound: "default",
          // A chore can be ticked from the shade; a forecast has nothing to
          // tick, so it only offers to come back tomorrow.
          categoryIdentifier: r.category || CATEGORY.info,
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
// Reads a notification response into something the app can act on, without
// touching any React Native API — so the routing rules are testable rather than
// only observable on a device.
//
//   { kind: "open",   to }        — tapped the body; go to that screen
//   { kind: "done",   key, to }   — pressed Done; record it, don't navigate
//   { kind: "snooze", key, to }   — pressed Later; reschedule, don't navigate
export function readResponse(response) {
  const request = response && response.notification && response.notification.request;
  const content = (request && request.content) || {};
  const data = content.data || {};
  const action = response && response.actionIdentifier;

  if (action === ACTION.done) return { kind: "done", key: data.key || null, to: data.to || null, action: data.action || null };
  if (action === ACTION.snooze) return { kind: "snooze", key: data.key || null, to: data.to || null };
  // Everything else — including the OS's default "tapped the notification"
  // identifier — is an open.
  if (!data.to) return null;
  // `tool` rides along so a reminder that names a parameter can open the card
  // that explains it rather than dumping the keeper on the tab it lives in.
  return { kind: "open", to: data.to, key: data.key || null, tool: data.tool || null };
}

export function onReminderTap(handler) {
  if (!HAS_NATIVE_MODULES) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const parsed = readResponse(response);
      if (parsed) handler(parsed.to, parsed);
    });
    return () => { try { sub.remove(); } catch (e) {} };
  } catch (e) {
    return () => {};
  }
}
