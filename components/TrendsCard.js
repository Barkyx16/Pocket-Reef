import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { EmptyState } from "./EmptyState";
import { assessParam, paramStatusColor, tapHaptic } from "../core";
import { activeParams } from "../lib/targets";

// Water-parameter trend charts — a premium payoff. Draws a lightweight sparkline
// (colored bars) per parameter from the test history, so you can see a value
// creeping the wrong way before it becomes a problem. No charting library —
// just Views, so it stays Expo-Go-friendly.

// How many readings the sparkline draws, and how tall the plot area is.
const WINDOW = 16;
const PLOT = 32;

// "Aug 9" — enough to date the ends of the chart without a second line.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1] || ""} ${d}`;
}

// The chart in a sentence. An arrow between the last two readings said almost
// nothing — it flipped on ordinary test-kit noise and ignored the shape of
// everything before it. This compares the ends of the window and, more
// usefully, says when a value is walking out of its safe range while every
// individual step still grades as fine.
function summarise(p, bars) {
  const vals = bars.map((b) => b.v);
  const first = vals[0];
  const last = vals[vals.length - 1];
  const diff = Math.round((last - first) * 1000) / 1000;
  const span = bars.length;

  if (!diff) return { text: `Steady across ${span} tests`, warn: false };

  const dir = diff > 0 ? "Up" : "Down";
  const text = `${dir} ${Math.abs(diff)}${p.unit ? ` ${p.unit}` : ""} over ${span} tests`;

  // Drifting toward trouble: still inside the good band, but heading for the
  // edge it's closest to. This is the whole reason to look at a trend.
  const inBand = last >= p.good[0] && last <= p.good[1];
  const towardCeiling = diff > 0 && last > p.good[1] - (p.good[1] - p.good[0]) * 0.25;
  const towardFloor = diff < 0 && last < p.good[0] + (p.good[1] - p.good[0]) * 0.25;
  const drifting = inBand && (towardCeiling || towardFloor);

  return { text: drifting ? `${text} — nearing the edge` : text, warn: drifting || !inBand };
}
export function TrendsCard({ waterTests = [], waterType = "fresh", premiumUnlocked, onOpenPremium }) {
  const params = activeParams(waterType);
  // Oldest → newest for left-to-right reading.
  const series = [...waterTests].reverse();

  if (!premiumUnlocked) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ fontSize: 34 }}>📈</Text>
        <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 8, textAlign: "center" }}>See your water trends</Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>Premium charts each parameter over time and warns you when a reading drifts the wrong way.</Text>
        <Pressable onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }} style={[styles.primaryBtn, { marginTop: 12, alignSelf: "stretch" }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Unlock with Premium</Text>
        </Pressable>
      </View>
    );
  }

  // Values paired with the day they were read, so the axis can be labelled and
  // the summary can say how long the movement took.
  const withValues = (key) =>
    series
      .filter((t) => t.values && t.values[key] != null)
      .map((t) => ({ v: Number(t.values[key]), date: t.date }));

  if (series.length < 2) {
    return <EmptyState emoji="📈" title="Not enough readings" subtitle="Log at least two water tests and your parameter trends chart here." />;
  }

  return (
    <View style={{ gap: 16 }}>
      {params.map((p) => {
        const points = withValues(p.key);
        if (!points.length) return null;
        const bars = points.slice(-WINDOW);
        const vals = bars.map((b) => b.v);
        const latest = vals[vals.length - 1];
        const first = vals[0];
        const scale = Math.max(p.caution[1] || 1, ...vals) || 1;
        const status = assessParam(p, latest).status;
        const move = summarise(p, bars);

        // Where the safe band sits on the same scale the bars are drawn to.
        // Without it the chart showed movement but never said whether the
        // movement mattered — a nitrate climbing from 5 to 18 and one climbing
        // from 25 to 38 drew the identical picture, and only one of them is a
        // problem. Zero-target parameters (ammonia, nitrite) collapse to a
        // hairline at the axis, which is exactly the right reading of "any
        // bar at all is too much".
        const bandLow = Math.max(0, Math.min(PLOT, Math.round((p.good[0] / scale) * PLOT)));
        const bandHigh = Math.max(0, Math.min(PLOT, Math.round((p.good[1] / scale) * PLOT)));

        return (
          <View key={p.key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
              <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.label}</Text>
              <Text style={{ color: paramStatusColor(status), fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                {latest}{p.unit ? ` ${p.unit}` : ""} {latest > first ? "↑" : latest < first ? "↓" : "→"}
              </Text>
            </View>

            <View style={{ height: 46, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.sm, padding: 6, borderWidth: 1, borderColor: theme.hairline, overflow: "hidden" }}>
              <View style={{ flex: 1, position: "relative" }}>
                {/* Behind the bars, never in front — the readings are the data,
                    the band is the reference. */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute", left: 0, right: 0, bottom: bandLow,
                    height: Math.max(1.5, bandHigh - bandLow),
                    backgroundColor: "rgba(56,225,198,0.13)",
                    borderTopWidth: 1, borderTopColor: "rgba(56,225,198,0.38)",
                  }}
                />
                <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                  {bars.map((b, i) => {
                    const h = Math.max(3, Math.round((b.v / scale) * PLOT));
                    const c = paramStatusColor(assessParam(p, b.v).status);
                    const isLast = i === bars.length - 1;
                    const op = bars.length > 1 ? 0.5 + (i / (bars.length - 1)) * 0.5 : 1;
                    return <View key={i} style={{ flex: 1, height: h, backgroundColor: c, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderRadius: 2, opacity: op, ...(isLast ? { shadowColor: c, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } } : null) }} />;
                  })}
                </View>
              </View>
            </View>

            {/* The axis the chart never had. Sixteen unlabelled bars could have
                covered a fortnight or two years. */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{shortDate(bars[0].date)}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{shortDate(bars[bars.length - 1].date)}</Text>
            </View>

            <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 3 }}>
              <Text style={{ color: move.warn ? theme.warn : theme.secondaryText, fontFamily: "Inter_900Black", fontWeight: "900" }}>{move.text}</Text>
              {`  ·  target ${p.ideal}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
