import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { iconForEmoji } from "../lib/icons";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { allTasks, sortedByUrgency, statusLabel, newUpkeepTask, suggestionsFor } from "../lib/upkeep";
import { TEXT_LIMITS } from "../lib/textLimits";
import { integerText } from "../lib/numericInput";

// Everything this tank needs doing, soonest first.
//
// The old card listed four fixed chores with no way to add a fifth, so a reef
// keeper's actual week — socks, skimmer cup, carbon, ATO, probes, RODI — simply
// wasn't representable. This shows the real list, ordered by urgency, with one
// tap to mark a job done and a way to add whatever the tank actually needs.
//
// Ordering is the whole point: the top row is always the next thing to do, so
// the card answers "what now?" without being read.
const STATE_COLOR = {
  overdue: theme.danger,
  due: theme.warn,
  soon: theme.warn,
  never: theme.secondaryText,
  ok: theme.accent,
};

export function UpkeepCard({ tank = {}, onLog, onAddTask, onRemoveTask, onSetInterval }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: "", days: "30" });
  const [editing, setEditing] = useState(null); // task id whose interval is open

  const rows = sortedByUrgency(allTasks(tank), tank.maintenance || {});
  const waterType = tank.water === "salt" ? "salt" : "fresh";
  const suggestions = suggestionsFor(waterType);
  const needsDoing = rows.filter((r) => ["overdue", "due"].includes(r.status.state)).length;

  const submit = () => {
    const task = newUpkeepTask({ label: draft.label, days: draft.days });
    if (!task) return;
    successHaptic();
    onAddTask(task);
    setDraft({ label: "", days: "30" });
    setAdding(false);
  };

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0 }]}>
        {needsDoing
          ? `${needsDoing} job${needsDoing === 1 ? "" : "s"} ${needsDoing === 1 ? "needs" : "need"} doing. Tap one to mark it done.`
          : "Everything's on schedule. Tap a job when you do it and the countdown resets."}
      </Text>

      <View style={{ gap: 6, marginTop: 12 }}>
        {rows.map(({ task, status }) => {
          const color = STATE_COLOR[status.state];
          const isEditing = editing === task.id;
          return (
            <View key={task.id} style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: status.state === "overdue" ? "rgba(255,123,123,0.4)" : theme.border, paddingHorizontal: 10, paddingVertical: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }}>
                  {iconForEmoji(task.emoji) ? (
                    <Ionicons name={iconForEmoji(task.emoji)} size={15} color={theme.accent} />
                  ) : (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: type.bodyLg }}>{task.emoji}</Text>
                  )}
                </View>

                <Pressable
                  onPress={() => { tapHaptic("light"); setEditing(isEditing ? null : task.id); }}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${task.label}. ${statusLabel(status)}. Tap to change how often.`}
                >
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{task.label}</Text>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>{statusLabel(status)}</Text>
                </Pressable>

                {/* One tap is the whole interaction — the countdown resets and
                    the row re-sorts itself down the list. */}
                <Pressable
                  onPress={() => { successHaptic(); onLog(task.id); }}
                  hitSlop={touchSlop(32)}
                  style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${task.label} done`}
                >
                  <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Done</Text>
                </Pressable>
              </View>

              {/* A progress bar only means something once there's a last-done
                  date to measure from. */}
              {status.state !== "never" ? (
                <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 8, overflow: "hidden" }}>
                  <View style={{ width: `${status.pct}%`, height: "100%", backgroundColor: color, borderRadius: 2 }} />
                </View>
              ) : null}

              {isEditing ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>Every</Text>
                  <TextInput
                    defaultValue={String(status.interval)}
                    onChangeText={(v) => onSetInterval(task, integerText(v))}
                    keyboardType="number-pad"
                    style={{ width: 58, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}
                    accessibilityLabel={`How often ${task.label} is due, in days`}
                  
            maxLength={TEXT_LIMITS.number}
          />
                  <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>days</Text>
                  <Pressable
                    onPress={() => { tapHaptic(); onRemoveTask(task); setEditing(null); }}
                    hitSlop={touchSlop(28)}
                    accessibilityRole="button"
                    accessibilityLabel={task.custom ? `Delete ${task.label}` : `Hide ${task.label} for this tank`}
                  >
                    <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                      {task.custom ? "Delete" : "Not on this tank"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ADD */}
      {adding ? (
        <View style={{ marginTop: 12, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.accent, padding: 12 }}>
          <TextInput
            value={draft.label}
            onChangeText={(v) => setDraft((d) => ({ ...d, label: v }))}
            placeholder="What needs doing?"
            placeholderTextColor={theme.secondaryText}
            autoFocus
            style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600" }}
            accessibilityLabel="Name of the new job"
          
            maxLength={TEXT_LIMITS.name}
          />

          {/* Nobody should have to invent "replace the UV bulb" from a blank
              field, so the common ones are one tap. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {suggestions.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => { tapHaptic("light"); setDraft({ label: s.label, days: String(s.days) }); }}
                style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s.label}, every ${s.days} days`}
              >
                <Text style={{ color: theme.text, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{s.emoji} {s.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
            <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>Every</Text>
            <TextInput
              value={draft.days}
              onChangeText={(v) => setDraft((d) => ({ ...d, days: integerText(v) }))}
              keyboardType="number-pad"
              style={{ width: 58, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}
              accessibilityLabel="How often the new job is due, in days"
            
            maxLength={TEXT_LIMITS.number}
          />
            <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>days</Text>
            <Pressable onPress={() => { tapHaptic(); setAdding(false); }} hitSlop={touchSlop(28)} accessibilityRole="button" accessibilityLabel="Cancel adding a job">
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!draft.label.trim()}
              style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: draft.label.trim() ? theme.accent : "rgba(255,255,255,0.06)" }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Add this job"
              accessibilityState={{ disabled: !draft.label.trim() }}
            >
              <Text style={{ color: draft.label.trim() ? theme.onAccent : theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => { tapHaptic(); setAdding(true); }}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: theme.border }, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Add a job to this tank"
        >
          <Ionicons name="add" size={15} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Add a job</Text>
        </Pressable>
      )}
    </View>
  );
}
