import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { runningCost, ownershipTotal, categoryLabel, DEFAULT_RATE } from "../lib/running";
import { equipmentSummary } from "../lib/equipment";
import { livestockSpend } from "../lib/livestock";
import { EmptyState } from "./EmptyState";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";
import { fmtMoney } from "../lib/format";


// What it costs to keep running, as opposed to what it cost to buy.
//
// The purchase total only goes up and can't be acted on. This one has levers —
// the two biggest draws in almost every tank are the heater and the lights, and
// the lights are on a schedule the keeper controls.
export function RunningCostCard({ tank = {}, costs = [], onGoToTab }) {
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const perKWh = Number(rate) > 0 ? Number(rate) : DEFAULT_RATE;

  const running = useMemo(() => runningCost(tank, { rate: perKWh }), [tank, perKWh]);

  // Everything spent, from the three ledgers the cost card already unified.
  const spent = useMemo(() => {
    const typed = costs.reduce((n, c) => n + (Number(c.amount) || 0), 0);
    const gear = equipmentSummary(tank.equipment || []).spend;
    const stock = livestockSpend(tank.stock || [], tank.stockMeta || {}, tank.quantities || {}, tank.losses || []).total;
    return typed + gear + stock;
  }, [costs, tank]);

  const ownership = useMemo(() => ownershipTotal(tank, { rate: perKWh, spent }), [tank, perKWh, spent]);

  if (!running.ok) {
    return (
      <View>
        <EmptyState emoji="⚡" title="Nothing to cost yet" subtitle={running.reason} />
        <Pressable onPress={() => { tapHaptic(); onGoToTab && onGoToTab("tank"); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Add your equipment</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }}>
        <LinearGradient colors={["rgba(56,225,198,0.14)", "rgba(56,225,198,0.04)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: "center", paddingVertical: 18 }}>
          <Text style={{ color: theme.accentLight, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Electricity, per month</Text>
          <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4, fontVariant: ["tabular-nums"] }}>{fmtMoney(running.perMonth)}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>
            {running.kWhPerMonth} kWh · {fmtMoney(running.perYear)} a year
          </Text>
        </LinearGradient>
      </View>

      {/* Never let a guessed watt read as a measured one. */}
      {running.confidence !== "measured" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Ionicons name="information-circle-outline" size={14} color={theme.secondaryText} />
          <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16 }}>
            {running.estimatedCount} item{running.estimatedCount === 1 ? "" : "s"} use a typical wattage for their type. Add real figures in the equipment record for an accurate bill.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Your rate</Text>
        <TextInput
          value={rate}
          onChangeText={(t) => setRate(decimalText(t))}
          keyboardType="decimal-pad"
          placeholder="0.17"
          placeholderTextColor={theme.secondaryText}
          accessibilityLabel="Electricity rate per kilowatt hour"
          style={[styles.authInput, { width: 90, paddingVertical: 8 }]}
        
            maxLength={TEXT_LIMITS.number}
          />
        <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>per kWh</Text>
      </View>

      <View style={{ gap: 8, marginTop: 14 }}>
        {running.rows.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 11 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{r.name}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>
                {r.watts}W{r.estimated ? " (typical)" : ""} · {r.hoursPerDay}h a day · {categoryLabel(r.category)}
              </Text>
            </View>
            <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fmtMoney(r.costPerMonth)}</Text>
          </View>
        ))}
      </View>

      {/* The lever. An hour of photoperiod with a price on it is a different
          argument from "consider reducing your lighting". */}
      {running.perLightHour ? (
        <View style={{ flexDirection: "row", gap: 9, marginTop: 12, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 11 }}>
          <Ionicons name="bulb-outline" size={15} color={theme.accent} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>
            Each hour of photoperiod costs about <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fmtMoney(running.perLightHour)}</Text> a month{running.lightHours ? `, and you run ${running.lightHours}` : ""}.
          </Text>
        </View>
      ) : null}

      {ownership.ok && ownership.total != null ? (
        <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Since you set it up</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <Text style={{ color: "#fff", fontSize: type.titleLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fmtMoney(ownership.total)}</Text>
            <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
              {fmtMoney(ownership.spent)} bought · {fmtMoney(ownership.electricity)} run · {ownership.months} months
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
