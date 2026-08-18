import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { assessParam, paramStatusColor, tapHaptic } from "../core";
import { displayParams } from "../lib/targets";
import { tempToDisplay } from "../lib/units";
import { layoutSeries, layoutEvents, axisDates } from "../lib/chart";
import { paramStability } from "../lib/stability";
import { findCorrelations, collectEvents, interpret } from "../lib/correlate";
import { instantOf } from "../lib/day";

// One parameter, full screen, over time — with everything that happened to the
// tank drawn underneath it.
//
// Until now the deepest view of a reading was sixteen unlabelled bars in the
// Trends card. A keeper looking at an alkalinity dip could see the dip and had
// no way to ask the only question that matters: what did I do that week? The
// answer was always in the app — water changes, doses and feedings are all
// dated — and no screen had ever put them on the same axis.
//
// Drawn with Views (dots plus rotated 1px segments); the geometry lives in
// lib/chart.js where it can be tested.

const RANGES = [
  { id: 30, label: "30d" },
  { id: 90, label: "3m" },
  { id: 365, label: "1y" },
  { id: 0, label: "All" },
];

const EVENT_STYLE = {
  waterchange: { color: "#5ac8fa", icon: "water", label: "Water change" },
  feeding: { color: theme.warn, icon: "restaurant", label: "Feeding" },
  dose: { color: "#c58cf5", icon: "flask", label: "Dose" },
  upkeep: { color: theme.muted, icon: "construct", label: "Upkeep" },
};
const styleFor = (type) => EVENT_STYLE[String(type).split(":")[0]] || EVENT_STYLE.upkeep;

const short = (iso) => {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${MONTHS[m - 1]} ${d}` : iso;
};

export function ParameterChart({ visible, paramKey, tank = {}, waterType = "fresh", onClose }) {
  const [days, setDays] = useState(90);
  const { width: screenW } = useWindowDimensions();
  const plotW = Math.max(180, Math.min(screenW, 520) - 32 - 40); // padding + y-axis gutter
  const plotH = 190;

  const params = displayParams(waterType);
  const p = params.find((x) => x.key === paramKey) || params[0];

  const view = useMemo(() => {
    if (!p) return null;
    const now = Date.now();
    const cutoff = days ? now - days * 86400000 : 0;

    const readings = (tank.waterTests || [])
      .filter((t) => t && t.values && t.values[p.key] != null && t.values[p.key] !== "")
      .map((t) => ({
        // Stored in °F; the chart, its band and its grading are all in the
        // keeper's unit, so the conversion happens once, here.
        value: p.key === "temp" ? tempToDisplay(t.values[p.key]) : Number(t.values[p.key]),
        date: t.date,
      }))
      .filter((r) => Number.isFinite(r.value) && instantOf(r.date) >= cutoff);

    if (readings.length < 2) return { readings, layout: null };

    const layout = layoutSeries(readings, { width: plotW, height: plotH, band: p.good });
    const events = layoutEvents(collectEvents(tank), {
      width: plotW,
      tMin: layout.span.tMin,
      tMax: layout.span.tMax,
    });
    return { readings, layout, events, ticks: axisDates(layout.span.tMin, layout.span.tMax, 3) };
  }, [p, tank, days, plotW]);

  const stability = useMemo(
    () => (p ? paramStability(p, tank.waterTests || [], {}) : null),
    [p, tank]
  );
  const related = useMemo(
    () => findCorrelations(tank, waterType, {}).filter((c) => c.param === (p && p.key)).slice(0, 3),
    [tank, waterType, p]
  );

  if (!p) return null;
  const latest = view && view.readings.length ? view.readings[0] : null;
  const status = latest ? assessParam(p, latest.value).status : "none";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10 }}>
          <Pressable onPress={() => { tapHaptic("light"); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close chart">
            <Ionicons name="chevron-back" size={24} color={theme.accent} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.label}</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" }}>Target {p.ideal}</Text>
          </View>
          {latest ? (
            <Text style={{ color: paramStatusColor(status), fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              {latest.value}{p.unit ? ` ${p.unit}` : ""}
            </Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
            {RANGES.map((r) => {
              const on = days === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => { tapHaptic("light"); setDays(r.id); }}
                  style={[styles.pill, { flex: 1, alignItems: "center", backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Show ${r.label === "All" ? "all readings" : `the last ${r.label}`}`}
                >
                  <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {!view || !view.layout ? (
            <View style={[styles.card, { alignItems: "center", paddingVertical: 28 }]}>
              <Ionicons name="analytics-outline" size={28} color={theme.secondaryText} />
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 8 }}>Not enough readings</Text>
              <Text style={[styles.cardText, { textAlign: "center" }]}>Two or more {p.label.toLowerCase()} readings in this range will draw a chart here.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={{ flexDirection: "row" }}>
                {/* Y axis. Three labels is enough to read a value off the line
                    without turning the chart into a spreadsheet. */}
                <View style={{ width: 40, height: plotH, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 6 }}>
                  {[view.layout.scale.max, (view.layout.scale.max + view.layout.scale.min) / 2, view.layout.scale.min].map((v, i) => (
                    <Text key={i} style={{ color: theme.secondaryText, fontSize: 9.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                      {Math.round(v * 100) / 100}
                    </Text>
                  ))}
                </View>

                <View style={{ width: plotW, height: plotH, position: "relative" }}>
                  {/* Safe range, behind everything. */}
                  {view.layout.band ? (
                    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: view.layout.band.top, height: view.layout.band.height, backgroundColor: "rgba(56,225,198,0.12)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(56,225,198,0.32)" }} />
                  ) : null}

                  {/* Event markers as full-height guides, so a dip and the water
                      change that caused it are visibly on the same date. */}
                  {(view.events || []).map((e, i) => {
                    const st = styleFor(e.type);
                    return (
                      <View key={`${e.type}-${e.date}-${i}`} pointerEvents="none" style={{ position: "absolute", left: e.x, top: 0, bottom: 0, width: 1, backgroundColor: `${st.color}40` }} />
                    );
                  })}

                  {/* The line: one rotated bar per gap. */}
                  {view.layout.segments.map((s, i) => (
                    <View
                      key={i}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: s.x,
                        top: s.y,
                        width: s.length,
                        height: 2,
                        backgroundColor: theme.accent,
                        borderRadius: 1,
                        // Rotate about the left edge so the bar starts exactly
                        // on its dot rather than about its own centre.
                        transform: [{ translateX: s.length / 2 }, { rotate: `${s.angle}deg` }, { translateX: -s.length / 2 }],
                      }}
                    />
                  ))}

                  {view.layout.dots.map((d, i) => {
                    const c = paramStatusColor(assessParam(p, d.value).status);
                    const isLast = i === view.layout.dots.length - 1;
                    return (
                      <View
                        key={`${d.date}-${i}`}
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: d.x - (isLast ? 5 : 3.5),
                          top: d.y - (isLast ? 5 : 3.5),
                          width: isLast ? 10 : 7,
                          height: isLast ? 10 : 7,
                          borderRadius: 5,
                          backgroundColor: c,
                          borderWidth: isLast ? 2 : 0,
                          borderColor: theme.background,
                        }}
                      />
                    );
                  })}
                </View>
              </View>

              {/* X axis */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginLeft: 40, marginTop: 6 }}>
                {(view.ticks || []).map((d, i) => (
                  <Text key={i} style={{ color: theme.secondaryText, fontSize: 9.5, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{short(d)}</Text>
                ))}
              </View>

              {/* What the guide lines mean. */}
              {view.events && view.events.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginLeft: 40 }}>
                  {[...new Set(view.events.map((e) => String(e.type).split(":")[0]))].map((t) => {
                    const st = styleFor(t);
                    return (
                      <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 2, height: 11, backgroundColor: st.color, borderRadius: 1 }} />
                        <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{st.label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 12 }}>
                {view.layout.dots.length} readings · {short(view.layout.span.from)} to {short(view.layout.span.to)}
              </Text>
            </View>
          )}

          {/* Stability — the reading behind the reading. */}
          {stability ? (
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardEyebrow}>How steady it is</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <Text style={{ color: stability.grade === "unstable" ? theme.danger : stability.grade === "swinging" ? theme.warn : theme.accent, fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  {stability.gradeLabel}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  {stability.readings} readings over {stability.spanDays} days
                </Text>
              </View>
              <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 6 }}>
                Fastest move {stability.perDay}{p.unit ? ` ${p.unit}` : ""} a day, against {stability.limit} that's safe. Ranged {stability.low}–{stability.high}, averaging {stability.mean}.
              </Text>
            </View>
          ) : null}

          {/* What moves it. */}
          {related.length ? (
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardEyebrow}>What moves it</Text>
              {related.map((c, i) => {
                const note = interpret(c);
                return (
                  <View key={i} style={{ marginTop: 8 }}>
                    <Text style={{ color: theme.text, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18 }}>{c.text}</Text>
                    {note && note.note ? (
                      <Text style={{ color: note.tone === "warn" ? theme.warn : theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 2 }}>{note.note}</Text>
                    ) : null}
                  </View>
                );
              })}
              <Text style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 15, marginTop: 10 }}>
                Patterns in your own log, not proof of cause.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
