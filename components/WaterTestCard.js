import { useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { assessParam, paramStatusColor, getTodayKey, tapHaptic, validateParam, failureHaptic, successHaptic, TROUBLESHOOTING } from "../core";
import { MAX_FONT_SCALE_COMPACT, touchSlop } from "../lib/a11y";
import { displayParams } from "../lib/targets";
import { checkReadings } from "../lib/anomaly";
import { tempToDisplay, tempFromInput } from "../lib/units";
import { TEXT_LIMITS } from "../lib/textLimits";
import { dayKeyProblem } from "../lib/day";
import { decimalText } from "../lib/numericInput";

// The reading a test kit gives you most of the time. Ammonia and nitrite in a
// cycled tank are zero on the overwhelming majority of test days, and typing
// "0" into two fields every single time is the app charging rent on the good
// news. One tap fills the ones that are almost always the same.
const ZERO_BY_DEFAULT = new Set(["ammonia", "nitrite"]);

// Which emergency flow answers a dangerous reading. Ammonia and nitrite are the
// same emergency; a temperature swing is its own. Anything not listed falls
// back to the parameter's own tip, which every parameter has.
const EMERGENCY_FOR = { ammonia: "ammonia", nitrite: "ammonia", temp: "temp" };

// Trims the float noise a subtraction leaves behind — 8.2 - 8.1 is
// 0.10000000000000053, and that is not a delta anyone wants to read.
const tidy = (n) => Math.round(n * 1000) / 1000;

// How many readings the history shows before "Show all".
const HISTORY_PAGE = 6;

// Log a water test and get an instant read on each parameter — the aquarium
// equivalent of Pocket Planter's watering log. Values assess live as you type.
export function WaterTestCard({ waterType = "fresh", history = [], onLog, onUpdate, onDelete }) {
  // Localised: the field, its placeholder and its live grade are all in the
  // keeper's unit, and the typed value is converted back to °F on save.
  const params = displayParams(waterType);
  const [vals, setVals] = useState({});
  // The date the reading was actually taken. Everything was stamped with
  // today's date and there was no way to say otherwise, so a Saturday test
  // logged on Sunday went into the trends on the wrong day — and a keeper
  // catching up on a week of readings could only file them all as today.
  const [date, setDate] = useState(getTodayKey());
  const [editingDate, setEditingDate] = useState(false);
  // Index of the history entry being corrected, or null when logging a new one.
  const [editingIndex, setEditingIndex] = useState(null);
  // The dangerous readings from the test just logged, or null. Kept after the
  // form resets — see the triage panel below.
  const [alarm, setAlarm] = useState(null);
  // Readings that are possible but wrong for this tank, held while the keeper
  // decides. Null means nothing outstanding.
  const [oddities, setOddities] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // The reading each field is compared against: the most recent test that isn't
  // the one being corrected. Comparing an edit to itself would report a delta
  // of zero on every field and quietly hide the change being made.
  const reference = editingIndex != null ? history[editingIndex + 1] : history[0];

  // A previous value in the same units the field is typed in.
  const priorOf = (p) => {
    const raw = reference && reference.values ? reference.values[p.key] : null;
    if (raw == null || raw === "") return null;
    return p.key === "temp" ? tempToDisplay(raw) : Number(raw);
  };

  // One ref per field, so the keyboard's "next" key can walk the form instead
  // of dismissing itself and making you tap the next box by hand — ten times,
  // on a reef tank.
  const inputs = useRef({});
  const focusNext = (index) => {
    const next = params[index + 1];
    if (next && inputs.current[next.key]) inputs.current[next.key].focus();
  };

  const filled = params.some((p) => vals[p.key] != null && vals[p.key] !== "");
  const filledCount = params.filter((p) => vals[p.key] != null && vals[p.key] !== "").length;

  // Fills only the fields that are still empty, so it can't overwrite a real
  // reading you've already typed.
  const markZeros = () => {
    tapHaptic("light");
    setVals((v) => {
      const next = { ...v };
      params.forEach((p) => {
        if (ZERO_BY_DEFAULT.has(p.key) && (next[p.key] == null || next[p.key] === "")) next[p.key] = "0";
      });
      return next;
    });
  };
  const zerosAvailable = params.some((p) => ZERO_BY_DEFAULT.has(p.key) && (vals[p.key] == null || vals[p.key] === ""));

  const prefillLast = () => {
    const last = history[0];
    if (!last || !last.values) return;
    tapHaptic("light");
    const next = {};
    params.forEach((p) => {
      if (last.values[p.key] == null) return;
      next[p.key] = String(p.key === "temp" ? tempToDisplay(last.values[p.key]) : last.values[p.key]);
    });
    setVals(next);
  };

  const submit = (force = false) => {
    if (!filled) return;
    // Reject an impossible reading before it's stored. A mistyped pH of 78
    // silently poisons every average, trend and forecast built on it
    // afterwards, and nothing downstream can tell it was a typo.
    // Plausibility bounds live in storage units (°F), so the temperature has to
    // be converted before it's checked. Validating the raw input meant a metric
    // keeper typing a perfectly normal 26 was told their reading was
    // impossible — it fell below the 32°F floor.
    const bad = params
      .map((p) => ({ p, v: validateParam(p, p.key === "temp" ? tempFromInput(vals[p.key]) : vals[p.key]) }))
      .find((r) => !r.v.ok);
    if (bad) {
      failureHaptic();
      Alert.alert("Check that reading", bad.v.reason);
      return;
    }
    // A date the app can't parse would silently sort to the wrong place in
    // every trend, so it's checked as strictly as a reading is.
    // Blank means "today" in the fields that offer a default; this one carries a
    // real date the keeper can clear, so an empty box is a mistake here.
    const dateProblem = date ? dayKeyProblem(date) : "Use YYYY-MM-DD, like 2026-03-14.";
    if (dateProblem) {
      failureHaptic();
      Alert.alert("Check that date", dateProblem);
      return;
    }
    // Possible, but not possible *here*. validateParam has already rejected the
    // impossible; this catches the misread colour card and the slipped decimal,
    // which are the errors that survive into the trends and poison them.
    const odd = checkReadings(params, vals, history, { toDisplay: (raw, prm) => (prm.key === "temp" ? tempToDisplay(raw) : raw) });
    if (odd.length && !force) {
      failureHaptic();
      setOddities(odd);
      return;
    }
    setOddities(null);

    tapHaptic("medium");

    // What was dangerous about this reading, captured before the form is
    // cleared. Logging ammonia at 2ppm used to produce a green tick and a row
    // in the history — the app knew the tank was in trouble and said nothing
    // until the next time you opened Home. The advice already existed in
    // TROUBLESHOOTING; nothing routed a reading to it.
    const dangerous = params
      .filter((p) => assessParam(p, vals[p.key]).status === "danger")
      .map((p) => ({ key: p.key, label: p.label, unit: p.unit, value: vals[p.key], ideal: p.ideal, tip: p.tip }));

    const entry = { date, water: waterType, values: {} };
    params.forEach((p) => {
      if (vals[p.key] === "" || vals[p.key] == null) return;
      // Temperature is stored in °F whatever the keeper types, so a metric
      // entry of 26 becomes 78.8 and every existing reading stays comparable.
      entry.values[p.key] = p.key === "temp" ? tempFromInput(vals[p.key]) : Number(vals[p.key]);
    });
    if (editingIndex != null && onUpdate) onUpdate(editingIndex, entry);
    else onLog(entry);
    // A dangerous reading gets the failure buzz, not the success chime. The
    // log succeeded, but that is not the news.
    if (dangerous.length) failureHaptic(); else successHaptic();
    reset();
    setAlarm(dangerous.length ? { date, items: dangerous } : null);
  };

  const reset = () => {
    setOddities(null);
    setVals({});
    setDate(getTodayKey());
    setEditingIndex(null);
    setEditingDate(false);
  };

  // The emergency steps that answer whatever was dangerous, deduplicated —
  // ammonia and nitrite both point at the same flow, and printing it twice
  // reads as two different emergencies.
  const alarmSteps = () => {
    if (!alarm) return [];
    const ids = [...new Set(alarm.items.map((i) => EMERGENCY_FOR[i.key]).filter(Boolean))];
    return ids
      .map((id) => TROUBLESHOOTING.find((tr) => tr.id === id))
      .filter(Boolean)
      .flatMap((tr) => tr.steps.slice(0, 3));
  };

  // Loads a logged test back into the form so it can be corrected.
  //
  // There was no way to fix or remove a stored reading at all. A pH typed as
  // 8.7 instead of 8.1 passes the plausibility check, and from then on it is
  // permanently baked into every average, delta, trend, forecast and health
  // score — with journal entries, feedings and costs all deletable, and the
  // most consequential data in the app the one thing you were stuck with.
  const startEdit = (index) => {
    const h = history[index];
    if (!h) return;
    tapHaptic("light");
    const next = {};
    params.forEach((p) => {
      if (!h.values || h.values[p.key] == null) return;
      next[p.key] = String(p.key === "temp" ? tempToDisplay(h.values[p.key]) : h.values[p.key]);
    });
    setVals(next);
    setDate(h.date || getTodayKey());
    setEditingIndex(index);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* "Fill in what you tested" is the honest instruction. Every field
            being blank read as a form that wanted all ten, which is why people
            skipped logging on the days they only checked one thing. */}
        <Text style={[styles.cardText, { flex: 1, marginTop: 0 }]}>Fill in what you tested — blanks are skipped, and each value grades itself against the {waterType === "salt" ? "reef" : "freshwater"} safe range.</Text>
      </View>

      {/* WHEN. Defaults to today and gets out of the way, but is always
          changeable — the reading belongs to the day you took it. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Ionicons name="calendar-outline" size={14} color={theme.secondaryText} />
        {editingDate ? (
          <TextInput
            value={date}
            onChangeText={setDate}
            onBlur={() => setEditingDate(false)}
            autoFocus
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.secondaryText}
            style={{ flex: 1, backgroundColor: theme.well, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, color: theme.text, borderWidth: 1, borderColor: theme.accent, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
            accessibilityLabel="Date this test was taken"
          
            maxLength={TEXT_LIMITS.date}
          />
        ) : (
          <Pressable onPress={() => { tapHaptic("light"); setEditingDate(true); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel={`Tested on ${date === getTodayKey() ? "today" : date}. Tap to change the date.`}>
            <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
              Tested <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{date === getTodayKey() ? "today" : date}</Text>
            </Text>
          </Pressable>
        )}
        {date !== getTodayKey() && !editingDate ? (
          <Pressable onPress={() => { tapHaptic("light"); setDate(getTodayKey()); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel="Set the date back to today">
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {editingIndex != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", paddingHorizontal: 11, paddingVertical: 9 }}>
          <Ionicons name="create-outline" size={14} color={theme.accent} />
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>Correcting the test from {history[editingIndex] ? history[editingIndex].date : ""}</Text>
          <Pressable onPress={() => { tapHaptic(); reset(); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel="Cancel the correction">
            <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Shortcut row. Two taps here cover the common case: a cycled tank
          reading zero on ammonia and nitrite, with everything else the same as
          last time. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {zerosAvailable ? (
          <Pressable
            onPress={markZeros}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Mark ammonia and nitrite as zero"
          >
            <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Ammonia &amp; nitrite are 0</Text>
          </Pressable>
        ) : null}
        {history[0] && history[0].values ? (
          <Pressable
            onPress={prefillLast}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Prefill with last readings"
          >
            <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>↺ Same as last time</Text>
          </Pressable>
        ) : null}
        {filled ? (
          <Pressable
            onPress={() => { tapHaptic("light"); setVals({}); }}
            style={({ pressed }) => [{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Clear all readings"
          >
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Two columns. Six full-width rows ran past the fold on a phone, so the
          submit button — the whole point of the card — was never visible while
          filling it in. Rows are shorter too: the target range now sits inside
          the field as a placeholder instead of taking its own line. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {params.map((p, i) => {
          const a = assessParam(p, vals[p.key]);
          const c = paramStatusColor(a.status);
          const prior = priorOf(p);
          // Only a real movement is a delta. An unchanged reading says so by
          // showing nothing, which keeps the arrows meaningful.
          const typed = vals[p.key] === "" || vals[p.key] == null ? null : Number(vals[p.key]);
          const diff = prior != null && typed != null && !Number.isNaN(typed) ? tidy(typed - prior) : 0;
          const delta = diff ? { up: diff > 0, amount: Math.abs(diff) } : null;
          return (
            <View key={p.key} style={{ width: "48.5%", backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: a.status === "none" ? theme.border : `${c}55`, paddingHorizontal: 10, paddingVertical: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ flexShrink: 1, color: theme.text, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                {/* Verdict sits beside the label, not below the field — in a
                    narrow column it would otherwise add a third line to every
                    tile and undo the compaction.
                    The same slot carries last time's reading, which is the
                    question actually being asked while typing: not "is 20 ok"
                    but "is 20 worse than last time". Before this, answering it
                    meant logging the test, scrolling to the history and
                    reading the row below — the comparison the whole log exists
                    to make was the one thing the form wouldn't show you. It
                    costs no height because the unit it replaces is already in
                    the placeholder ("< 40 ppm", "72–80°F"). */}
                {a.status !== "none" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    {delta ? (
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                        {delta.up ? "↑" : "↓"}{delta.amount}
                      </Text>
                    ) : null}
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: c, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase" }}>
                      {a.status === "good" ? "Good" : a.status === "caution" ? "Watch" : "High"}
                    </Text>
                  </View>
                ) : prior != null ? (
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_700Bold", fontWeight: "700" }}>was {prior}</Text>
                ) : (
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{p.unit}</Text>
                )}
              </View>
              <TextInput
                ref={(el) => { inputs.current[p.key] = el; }}
                value={vals[p.key] ?? ""}
                onChangeText={(t) => setVals((v) => ({ ...v, [p.key]: decimalText(t) }))}
                keyboardType="decimal-pad"
                // decimal-pad has no return key on iOS, so "next" is wired to
                // submitEditing for the platforms that do show one, and the
                // blur-on-last behaviour keeps the keyboard from trapping you.
                returnKeyType={i === params.length - 1 ? "done" : "next"}
                blurOnSubmit={i === params.length - 1}
                onSubmitEditing={() => focusNext(i)}
                placeholder={p.ideal}
                placeholderTextColor="rgba(165,212,234,0.42)"
                accessibilityLabel={`${p.label}${p.unit ? ` in ${p.unit}` : ""}, target ${p.ideal}`}
                maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT}
                style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6, color: theme.text, borderWidth: 1, borderColor: !validateParam(p, vals[p.key]).ok ? theme.danger : a.status === "none" ? theme.border : c, fontSize: 15, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
              
            maxLength={TEXT_LIMITS.number}
          />

            </View>
          );
        })}
      </View>

      {(() => {
        const issues = params.filter((p) => {
          const st = assessParam(p, vals[p.key]).status;
          return st === "caution" || st === "danger";
        });
        if (!issues.length) return null;
        return (
          <View style={{ marginTop: 12, backgroundColor: "rgba(255,216,107,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,216,107,0.24)" }}>
            <Text style={{ color: theme.warn, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", marginBottom: 2 }}>⚠️ Watch these</Text>
            {issues.map((p) => (
              <Text key={p.key} style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18, marginTop: 4 }}>
                <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.label}: </Text>{p.tip}
              </Text>
            ))}
          </View>
        );
      })()}

      {/* Possible, but not for this tank. Offered as a question rather than a
          block: the keeper is the one holding the test kit, and a tank really
          can crash. Refusing the reading would just teach people to log
          somewhere else. */}
      {oddities ? (
        <View style={{ marginTop: 14, backgroundColor: "rgba(255,216,107,0.10)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,216,107,0.35)", padding: 13 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons name="help-circle" size={16} color={theme.warn} />
            <Text style={{ flex: 1, color: theme.warn, fontSize: 13.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              {oddities.length === 1 ? oddities[0].title : `${oddities.length} readings look unusual`}
            </Text>
          </View>

          {oddities.map((o) => (
            <View key={o.key} style={{ marginTop: 7 }}>
              <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>{o.message}</Text>
              {o.suggestion != null ? (
                <Pressable
                  onPress={() => { tapHaptic("light"); setVals((v) => ({ ...v, [o.key]: String(o.suggestion) })); setOddities(null); }}
                  style={[styles.pill, { alignSelf: "flex-start", marginTop: 6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${o.label} to ${o.suggestion}`}
                >
                  <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Use {o.suggestion}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => { tapHaptic("light"); setOddities(null); }}
              style={[styles.ghostBtn, { flex: 1, paddingVertical: 11 }]}
              accessibilityRole="button"
              accessibilityLabel="Go back and change the reading"
            >
              <Text style={styles.ghostBtnText}>Let me check</Text>
            </Pressable>
            <Pressable
              onPress={() => submit(true)}
              style={[styles.primaryBtn, { flex: 1, paddingVertical: 11 }]}
              accessibilityRole="button"
              accessibilityLabel="Log the reading as typed"
            >
              <Text style={styles.primaryBtnText}>It's right</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => submit()} disabled={!filled} style={[filled ? styles.primaryBtn : styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button" accessibilityLabel={editingIndex != null ? "Save the corrected test" : "Log this water test"} accessibilityState={{ disabled: !filled }}>
        {/* The count is the reassurance that blanks are fine — the button
            naming what it's about to save is what makes a partial test feel
            like a complete action rather than an unfinished form. */}
        <Text style={filled ? styles.primaryBtnText : styles.ghostBtnText}>
          {!filled ? "Enter a reading to log" : editingIndex != null ? `Update ${filledCount} reading${filledCount === 1 ? "" : "s"}` : `Log ${filledCount} reading${filledCount === 1 ? "" : "s"}`}
        </Text>
      </Pressable>

      {/* TRIAGE. Sits directly under the log button, which is where the eye
          already is at the moment it appears, and stays until dismissed —
          an alert dialog would be gone before the keeper could act on it, and
          gone forever if it were tapped away by reflex. */}
      {alarm ? (
        <View style={{ marginTop: 14, backgroundColor: "rgba(255,107,107,0.10)", borderRadius: 14, borderWidth: 1, borderColor: `${theme.danger}66`, padding: 13 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons name="warning" size={16} color={theme.danger} />
            <Text style={{ flex: 1, color: theme.danger, fontSize: 13.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              {alarm.items.length === 1 ? `${alarm.items[0].label} is dangerous` : `${alarm.items.length} readings are dangerous`}
            </Text>
            <Pressable onPress={() => { tapHaptic("light"); setAlarm(null); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel="Dismiss this warning">
              <Ionicons name="close" size={16} color={theme.secondaryText} />
            </Pressable>
          </View>

          <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 6 }}>
            Logged for {alarm.date === getTodayKey() ? "today" : alarm.date}. The reading is saved — this is what to do about it.
          </Text>

          {alarm.items.map((it) => (
            <View key={it.key} style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <Text style={{ color: theme.danger, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {it.label} {it.value}{it.unit ? ` ${it.unit}` : ""}
              </Text>
              <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" }}>target {it.ideal}</Text>
            </View>
          ))}

          {/* Steps first when there's an emergency flow for it; the
              parameter's own tip when there isn't. Something actionable
              always renders — an alarm with no answer is just an alarm. */}
          {(() => {
            const steps = alarmSteps();
            const body = steps.length ? steps : alarm.items.map((i) => i.tip);
            return (
              <View style={{ marginTop: 10, gap: 6 }}>
                {body.map((line, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: theme.danger, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{i + 1}</Text>
                    <Text style={{ flex: 1, color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>{line}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      ) : null}

      {/* HISTORY */}
      {history.length ? (
        <View style={{ marginTop: 16 }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 8 }]}>
            {showAllHistory ? `All ${history.length} tests` : "Recent tests"}
          </Text>

          {/* The range each parameter has actually covered, over every reading
              on file. Shown only with the full list open, where the question
              stops being "what did I log last time" and becomes "what does
              this tank normally do" — the one thing a long history is for and
              the one thing six rows could never answer. */}
          {showAllHistory ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {params.map((p) => {
                const vals = history
                  .map((h) => (h.values && h.values[p.key] != null ? (p.key === "temp" ? tempToDisplay(h.values[p.key]) : Number(h.values[p.key])) : null))
                  .filter((v) => v != null && !Number.isNaN(v));
                if (!vals.length) return null;
                const lo = tidy(Math.min(...vals));
                const hi = tidy(Math.max(...vals));
                const avg = tidy(vals.reduce((a, b) => a + b, 0) / vals.length);
                return (
                  <View key={p.key} style={{ backgroundColor: theme.well, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 9, paddingVertical: 6 }}>
                    <Text style={{ color: theme.secondaryText, fontSize: 9.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textTransform: "uppercase" }}>{p.label}</Text>
                    <Text style={{ color: theme.text, fontSize: 11.5, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 1 }}>
                      {lo === hi ? `${lo}` : `${lo}–${hi}`}
                      <Text style={{ color: theme.secondaryText, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{`  avg ${avg}`}</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {/* Row, correct-tap area and delete are SIBLINGS, never nested.
              Putting the delete button inside the row button produced a
              <button> inside a <button> — invalid on web, and on native a
              nested touchable whose parent can swallow the child's press. This
              codebase has fixed the same shape twice before, in SpeciesCard and
              TankSwitcher; this row had quietly reintroduced it. */}
          {(showAllHistory ? history : history.slice(0, HISTORY_PAGE)).map((h, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
            >
              <Pressable
                onPress={onUpdate ? () => startEdit(i) : undefined}
                disabled={!onUpdate}
                style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }, pressed && { opacity: 0.6 }]}
                accessibilityRole={onUpdate ? "button" : undefined}
                accessibilityLabel={onUpdate ? `Test from ${h.date}. Tap to correct it.` : undefined}
              >
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", width: 78 }}>{h.date}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                {(displayParams(h.water)).map((p) => {
                  if (h.values[p.key] == null) return null;
                  // Both sides in the same unit, or a stored 78°F would be
                  // graded against a 23–27°C band.
                  const shown = p.key === "temp" ? tempToDisplay(h.values[p.key]) : h.values[p.key];
                  const a = assessParam(p, shown);
                  const c = paramStatusColor(a.status);
                  return (
                    <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${c}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.label}</Text>
                      <Text style={{ color: c, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }}>{shown}</Text>
                    </View>
                  );
                })}
              </View>
              </Pressable>
              {onDelete ? (
                <Pressable
                  onPress={() => onDelete(i)}
                  hitSlop={touchSlop(20)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete the test from ${h.date}`}
                >
                  <Ionicons name="close" size={13} color={theme.secondaryText} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {/* Everything past the sixth reading had no route to it anywhere in
              the app — the history stopped at six, the trends chart draws the
              last sixteen, and the rest was write-only. */}
          {history.length > HISTORY_PAGE ? (
            <Pressable
              onPress={() => { tapHaptic("light"); setShowAllHistory((v) => !v); }}
              style={[styles.ghostBtn, { marginTop: 10, paddingVertical: 11 }]}
              accessibilityRole="button"
              accessibilityLabel={showAllHistory ? `Show only the ${HISTORY_PAGE} most recent tests` : `Show all ${history.length} tests`}
            >
              <Text style={styles.ghostBtnText}>
                {showAllHistory ? "Show fewer" : `Show all ${history.length} tests`}
              </Text>
            </Pressable>
          ) : null}

          {onUpdate ? (
            <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 8 }}>
              Tap a test to correct a mistyped reading.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
