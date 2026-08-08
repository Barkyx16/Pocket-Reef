import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { getDosingPlan, REEF_TARGETS } from "../lib/dosing";

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
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) { try { setStrengths(JSON.parse(raw) || {}); } catch (e) {} } })
      .catch(() => {})
      .finally(() => setLoaded(true));
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
        <View style={{ backgroundColor: "rgba(255,211,114,0.10)", borderWidth: 1, borderColor: "rgba(255,211,114,0.32)", borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: theme.warn, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Fix magnesium first</Text>
          <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 17 }}>
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
          const statusColor = row.inRange ? theme.accent : row.low ? theme.warn : "#ff7b7b";

          return (
            <View key={key}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900", flex: 1 }}>{row.label}</Text>
                <Text style={{ color: statusColor, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                  {row.current} {row.unit}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
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
                      style={{ width: 78, backgroundColor: theme.well, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
                      accessibilityLabel={`${row.label} product strength`}
                    />
                    <Text style={{ flex: 1, color: theme.bodyText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 15 }}>
                      {STRENGTH_HINT[key]} — from your product label
                    </Text>
                  </View>

                  {row.plan && row.plan.ok && row.plan.totalMl > 0 ? (
                    <View style={{ marginTop: 10, backgroundColor: "rgba(56,225,198,0.08)", borderWidth: 1, borderColor: "rgba(56,225,198,0.28)", borderRadius: 12, padding: 12 }}>
                      <Text style={{ color: theme.accent, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                        {row.plan.capped
                          ? `${row.plan.perDayMl} ml per day for ${row.plan.days} days`
                          : `${row.plan.totalMl} ml, one dose`}
                      </Text>
                      <Text style={{ color: theme.bodyText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 16 }}>
                        Raises {row.plan.needed} {row.unit} across {row.plan.volume} gal of actual water
                        (your {tankGallons} gal tank, less rock and sand).
                        {row.plan.capped
                          ? ` Split because more than ${row.plan.safeDailyRise} ${row.unit} in one day risks shocking your corals.`
                          : ""}
                      </Text>
                    </View>
                  ) : row.plan && !row.plan.ok ? (
                    <Text style={{ color: theme.bodyText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8, lineHeight: 16 }}>
                      {row.plan.reason}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {row.high ? (
                <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, lineHeight: 17 }}>
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
