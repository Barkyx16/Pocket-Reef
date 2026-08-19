import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { touchSlop } from "../lib/a11y";
import { DEFAULT_DAYS, assessArrival } from "../lib/quarantine";
import { ProgressBar } from "./ProgressBar";
import { TEXT_LIMITS } from "../lib/textLimits";

// Quarantine as a programme, not a countdown.
//
// The card used to run a 21-day timer and nothing else. Twenty-one days is the
// right number and the timer is the least useful part: the point of quarantine
// is that somebody looks at the fish daily and knows what they're looking for.
// A keeper watching an empty progress bar misses the flicking on day three —
// the entire thing quarantine exists to catch — and the old card then declared
// the fish "Ready to add to your tank! 🎉" purely because time had passed.
export function QuarantineCard({ items = [], onAdd, onRemove, onGraduate, onSetCheck }) {
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState(null);

  const add = () => {
    if (!name.trim()) return;
    tapHaptic();
    onAdd({ id: Date.now(), name: name.trim(), startDate: new Date().toISOString(), checks: {} });
    setName("");
  };

  return (
    <View>
      <Text style={styles.cardText}>
        Isolate new arrivals for {DEFAULT_DAYS} days. The card tells you what to watch for each week, and won't call anything clear until you've confirmed it — time on its own has never been clearance.
      </Text>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        <TextInput value={name} onChangeText={setName} placeholder="New arrival (e.g. Yellow Tang)" placeholderTextColor={theme.secondaryText} accessibilityLabel="Name of the new arrival"
          style={{ fontFamily: "Inter_400Regular", flex: 1, backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.body }} 
            maxLength={TEXT_LIMITS.name}
          />
        <Pressable onPress={add} disabled={!name.trim()} style={[name.trim() ? styles.primaryBtn : styles.ghostBtn, { flex: 0, paddingHorizontal: space.xl, justifyContent: "center" }]} accessibilityRole="button">
          <Text style={name.trim() ? styles.primaryBtnText : styles.ghostBtnText}>Start</Text>
        </Pressable>
      </View>

      {items.length ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {items.map((it) => {
            const a = assessArrival(it, {});
            if (!a.ok) return null;
            const open = openId === it.id;
            const tone = a.ready ? theme.accent : a.overdue ? theme.warn : theme.text;
            return (
              <View key={it.id} style={{ backgroundColor: theme.well, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: a.ready ? "rgba(56,225,198,0.32)" : a.overdue ? `${theme.warn}44` : theme.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <Ionicons name={a.ready ? "checkmark-circle" : a.overdue ? "alert-circle" : "eye-outline"} size={18} color={tone} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={1}>{it.name}</Text>
                    <Text style={{ color: tone, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.hair }}>{a.headline}</Text>
                  </View>
                  <Pressable onPress={() => onRemove(it.id)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`}>
                    <Ionicons name="close" size={14} color={theme.secondaryText} />
                  </Pressable>
                </View>

                <View style={{ marginTop: space.md }}>
                  <ProgressBar pct={a.pct} color={a.ready ? theme.accent : theme.warn} height={6} />
                </View>

                {/* What to look for RIGHT NOW — the part the timer never had. */}
                <View style={{ marginTop: space.md }}>
                  <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                    {a.phase.label}
                  </Text>
                  {a.phase.watch.slice(0, 2).map((w, i) => (
                    <Text key={i} style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>• {w}</Text>
                  ))}
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.xs }}>{a.phase.doing}</Text>
                </View>

                <Pressable onPress={() => { tapHaptic("light"); setOpenId(open ? null : it.id); }} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md }} accessibilityRole="button" accessibilityLabel={`Clearance checks for ${it.name}, ${a.met} of ${a.criteria.length} met`}>
                  <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={13} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                    Clearance checks · {a.met} of {a.criteria.length}
                  </Text>
                </Pressable>

                {open ? (
                  <View style={{ gap: space.sm, marginTop: space.sm }}>
                    {a.criteria.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => { if (!c.auto && onSetCheck) { tapHaptic("light"); onSetCheck(it.id, c.id, !c.met); } }}
                        disabled={c.auto || !onSetCheck}
                        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
                        accessibilityRole={c.auto ? undefined : "checkbox"}
                        accessibilityState={{ checked: c.met, disabled: c.auto }}
                        accessibilityLabel={c.label}
                      >
                        <Ionicons name={c.met ? "checkbox" : "square-outline"} size={16} color={c.met ? theme.accent : theme.secondaryText} />
                        <Text style={{ flex: 1, color: c.met ? theme.text : theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                          {c.label}{c.auto ? " · counted for you" : ""}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {a.ready && onGraduate ? (
                  <Pressable
                    onPress={() => { successHaptic(); onGraduate(it); }}
                    style={[styles.primaryBtn, { marginTop: space.md, paddingVertical: space.md }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${it.name} into the display tank`}
                  >
                    <Text style={styles.primaryBtnText}>＋ Move into the display</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
