import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { tankStability, stabilityHeadline } from "../lib/stability";
import { ParameterChart } from "./ParameterChart";
import { EmptyState } from "./EmptyState";
import { fmt } from "../lib/format";

// How steady the tank is, as opposed to how correct it currently reads.
//
// The two are different questions and the app only ever answered the second.
// This one is the one experienced keepers actually optimise for, and a tank can
// score full marks on every existing grade while failing here.

const TONE = {
  "rock-solid": { color: theme.accent, icon: "shield-checkmark" },
  steady: { color: theme.accent, icon: "checkmark-circle" },
  swinging: { color: theme.warn, icon: "swap-vertical" },
  unstable: { color: theme.danger, icon: "warning" },
};

export function StabilityCard({ tank = {}, waterType = "fresh", now }) {
  const [openParam, setOpenParam] = useState(null);
  const result = useMemo(() => tankStability(tank.waterTests || [], waterType, now ? { now } : {}), [tank, waterType, now]);

  if (!result.ok) {
    return <EmptyState emoji="📉" title="Not enough readings yet" subtitle={result.reason} />;
  }

  const tone = TONE[result.grade] || TONE.steady;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${tone.color}14`, borderRadius: radius.xl, borderWidth: 1, borderColor: `${tone.color}44`, padding: 14 }}>
        <View style={{ alignItems: "center", minWidth: 58 }}>
          <Text style={{ color: tone.color, fontSize: type.display, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{result.score}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Steady</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={tone.icon} size={15} color={tone.color} />
            <Text style={{ color: tone.color, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{result.gradeLabel}</Text>
          </View>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 3 }}>
            {stabilityHeadline(result)}
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 12 }}>
        This grades <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>movement</Text>, not position. A tank averaging a perfect number by swinging to get there is harder on its inhabitants than one sitting slightly off and never moving.
      </Text>

      <View style={{ gap: 8, marginTop: 12 }}>
        {result.items.map((it) => {
          const t = TONE[it.grade] || TONE.steady;
          return (
            <Pressable
              key={it.key}
              onPress={() => { tapHaptic("light"); setOpenParam(it.key); }}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10 }, pressed && { opacity: 0.75, borderColor: t.color }]}
              accessibilityRole="button"
              accessibilityLabel={`${it.label}: ${it.gradeLabel}. Moving ${fmt(it.perDay)} per day against a safe ${it.limit}. Tap for the full chart.`}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.label}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>
                  {it.low}–{it.high}{it.unit ? ` ${it.unit}` : ""} · {it.perDay}/day of {it.limit} allowed
                </Text>
              </View>
              <Text style={{ color: t.color, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.gradeLabel}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.secondaryText} />
            </Pressable>
          );
        })}
      </View>

      <ParameterChart
        visible={!!openParam}
        paramKey={openParam}
        tank={tank}
        waterType={waterType}
        onClose={() => setOpenParam(null)}
      />
    </View>
  );
}
