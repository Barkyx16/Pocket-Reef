import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme, radius, type } from "../styles";
import { getDosingPlan, REEF_TARGETS } from "../lib/dosing";
import { formatVolume } from "../lib/units";
import { TEXT_LIMITS } from "../lib/textLimits";

// ─────────────────────────────────────────────────────────────────────────────
// Reef supplement dosing.
//
// Two inputs the app cannot infer and must not invent: your product's strength,
// and your tank's real volume. Every bottle is different, so a default
// ml-per-gallon would be a confident wrong answer — and confidently wrong
// alkalinity dosing burns corals.
//
// Strengths are remembered per parameter, because nobody wants to re-read the
// label every week.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "pr_doseStrengths";
const ORDER = ["magnesium", "alk", "calcium"];

// What "strength" means, per parameter, in the units the label uses.
const STRENGTH_HINT = {
  alk: "dKH raised per ml, per gallon",
  calcium: "ppm raised per ml, per gallon",
  magnesium: "ppm raised per ml, per gallon",
};

export function DosingCard({ latestValues = {}, tankGallons = 0 }) {
  const [strengths, setStrengths] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Guarded: these read from storage and set state when the promise resolves.
    // Switching tab or closing the sheet before that lands writes to an
    // unmounted component — React logs it and the write is thrown away, which
    // is a warning today and a stale-state bug the moment anything downstream
    // reads it.
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (alive && raw) { try { setStrengths(JSON.parse(raw) || {}); } catch (e) {} } })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const setStrength = (key, text) => {
    const next = { ...strengths, [key]: text };
    setStrengths(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const numericStrengths = {};
  Object.keys(strengths).forEach((k) => {
    const n = Number(strengths[k]);
    if (n > 0) numericStrengths[k] = n;
  });

  const { plans, magnesiumFirst, anyLow } = getDosingPlan({
    latestValues,
    ratedGallons: tankGallons,
    strengths: numericStrengths,
  });

  if (!loaded) return null;

  if (!plans.length) {
    return (
      <Text style={styles.cardText}>
        Log an alkalinity, calcium, or magnesium reading and Pocket Reef will work out how
        much to dose — split safely across days when the correction is a big one.
      </Text>
    );
  }

  return (
    <View>
      {magnesiumFirst ? (
        // Not cosmetic ordering — this is the chemistry. Correcting Ca or Alk
        // over low Mg mostly produces precipitate rather than a higher reading.
        <View style={{ backgroundColor: "rgba(255,211,114,0.10)", borderWidth: 1, borderColor: "rgba(255,211,114,0.32)", borderRadius: radius.lg, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: theme.warn, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Fix magnesium first</Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 17 }}>
            Magnesium holds calcium and alkalinity in solution. Dosing those while magnesium
            is low mostly makes precipitate instead of raising your numbers.
          </Text>
        </View>
      ) : null}

      {!anyLow ? (
        <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>
          Everything's in range — nothing to dose right now.
        </Text>
      ) : null}

      <View style={{ gap: 16 }}>
        {ORDER.map((key) => {
          const row = plans.find((p) => p.key === key);
          if (!row) return null;
          const target = REEF_TARGETS[key];
          const statusColor = row.inRange ? theme.accent : row.low ? theme.warn : theme.danger;

          return (
            <View key={key}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900", flex: 1 }}>{row.label}</Text>
                <Text style={{ color: statusColor, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                  {row.current} {row.unit}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  target {target.min}–{target.max}
                </Text>
              </View>

              {row.low ? (
                <View style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TextInput
                      value={String(strengths[key] ?? "")}
                      onChangeText={(v) => setStrength(key, v)}
                      placeholder="0.0"
                      placeholderTextColor={theme.secondaryText}
                      keyboardType="decimal-pad"
                      style={{ width: 78, backgroundColor: theme.well, borderWidth: 1, borderColor: theme.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
                      accessibilityLabel={`${row.label} product strength`}
                    
            maxLength={TEXT_LIMITS.number}
          />
                    <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 15 }}>
                      {STRENGTH_HINT[key]} — from your product label
                    </Text>
                  </View>

                  {row.plan && row.plan.ok && row.plan.totalMl > 0 ? (
                    <View style={{ marginTop: 10, backgroundColor: "rgba(56,225,198,0.08)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", borderRadius: radius.md, padding: 12 }}>
                      <Text style={{ color: theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                        {row.plan.capped
                          ? `${row.plan.perDayMl} ml per day for ${row.plan.days} days`
                          : `${row.plan.totalMl} ml, one dose`}
                      </Text>
                      <Text style={{ color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 16 }}>
                        Raises {row.plan.needed} {row.unit} across {formatVolume(row.plan.volume)} of actual water
                        (your {formatVolume(tankGallons)} tank, less rock and sand).
                        {row.plan.capped
                          ? ` Split because more than ${row.plan.safeDailyRise} ${row.unit} in one day risks shocking your corals.`
                          : ""}
                      </Text>
                    </View>
                  ) : row.plan && !row.plan.ok ? (
                    <Text style={{ color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8, lineHeight: 16 }}>
                      {row.plan.reason}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {row.high ? (
                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, lineHeight: 17 }}>
                  Above target. Don't dose — let it drift down with water changes and consumption.
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
