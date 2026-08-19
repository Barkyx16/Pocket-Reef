import { Text, View } from "react-native";
import { styles, theme, type } from "../styles";
import { paramStatusColor } from "../core";

// ─────────────────────────────────────────────────────────────────────────────
// Where your water is heading.
//
// The card exists because the danger in a slow drift is invisible reading by
// reading: 20, then 30, then 40 are each individually fine, and only the slope
// says you have a week. Trends already existed as a sparkline; this states the
// conclusion in words.
//
// It shows nothing rather than something vague. getParamForecasts already
// withholds a countdown when the fit is weak, and this renders that honestly —
// a drift with no confident projection says "rising", not a fake deadline.
// ─────────────────────────────────────────────────────────────────────────────

function urgencyColor(days) {
  if (days == null) return theme.secondaryText;
  if (days <= 7) return theme.danger;
  if (days <= 21) return theme.warn;
  return theme.accent;
}

export function ForecastCard({ forecasts = [] }) {
  if (!forecasts.length) {
    return (
      <Text style={styles.cardText}>
        Log three or more water tests and Pocket Reef will project where each parameter is
        heading — and roughly when it leaves the safe range.
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 14 }]}>
        Based on your recent tests. A trend needs a clean fit before we'll put a date on it.
      </Text>

      <View style={{ gap: 14 }}>
        {forecasts.map((f) => {
          const arrow = f.trend === "up" ? "↑" : f.trend === "down" ? "↓" : "→";
          const color = urgencyColor(f.daysToEdge);
          return (
            <View key={f.key} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={[styles.iconSquare, { borderColor: `${color}66`, backgroundColor: `${color}1f` }]}>
                <Text style={{ color, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{arrow}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{f.label}</Text>
                  <Text style={{ color: paramStatusColor(f.status), fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                    {f.current}{f.unit ? ` ${f.unit}` : ""}
                  </Text>
                </View>

                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 17 }}>
                  {f.perWeek > 0 ? "Rising" : "Falling"} about {Math.abs(f.perWeek)}{f.unit ? ` ${f.unit}` : ""} per week
                  {f.n ? ` · ${f.n} readings` : ""}
                </Text>

                {f.daysToEdge != null ? (
                  <Text style={{ color, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4 }}>
                    Out of range in about {f.daysToEdge} day{f.daysToEdge === 1 ? "" : "s"}
                  </Text>
                ) : (
                  // Deliberately not a date. The fit isn't strong enough to
                  // justify one, and a wrong countdown costs more trust than a
                  // vague one earns.
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4 }}>
                    Not enough of a pattern yet to predict a date
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
