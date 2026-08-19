import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { getTodayKey, tapHaptic } from "../core";
import { touchSlop } from "../lib/a11y";
import { equipmentSummary } from "../lib/equipment";
import { livestockSpend } from "../lib/livestock";
import { Pill } from "./Pill";
import { dayKey, isValidDayKey } from "../lib/day";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";
import { fmtMoney } from "../lib/format";

const CATS = ["Equipment", "Livestock", "Food", "Other"];
const CAT_EMOJI = { Equipment: "🔧", Livestock: "🐠", Food: "🍤", Other: "📦" };


// The day an expense belongs to. Entries written before expenses could be dated
// fall back to their id, which has always been Date.now() — so an old ledger
// keeps its dates rather than collapsing to "undated".
export function costDate(c) {
  if (c && typeof c.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) return c.date;
  const d = new Date(c && c.id);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

// Track what your tank costs — every hobbyist quietly wonders. Logs labeled
// expenses by category with a running total.
//
// "Total invested" used to mean "total typed into this box", which made it the
// least accurate number in the app. The equipment record already stores what
// each pump and heater cost, and every livestock record stores what the animal
// cost — a keeper filling both in diligently still saw $0 here. Those ledgers
// are now added in, itemised rather than silently merged, because a keeper who
// logged the return pump in both places needs to be able to see that.
export function CostTrackerCard({ costs = [], tank = {}, onAdd, onDelete }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Equipment");
  const [date, setDate] = useState(getTodayKey());
  const [editingDate, setEditingDate] = useState(false);
  const [visible, setVisible] = useState(6);

  const typed = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // The two ledgers kept elsewhere in the app.
  const gear = equipmentSummary(tank.equipment || []);
  const stock = livestockSpend(tank.stock || [], tank.stockMeta || {}, tank.quantities || {}, tank.losses || []);
  const total = typed + gear.spend + stock.total;

  const sources = [
    { id: "typed", emoji: "🧾", label: "Expenses", value: typed, sub: `${costs.length} logged` },
    { id: "gear", emoji: "🔧", label: "Gear", value: gear.spend, sub: gear.priced < gear.count ? `${gear.priced} of ${gear.count} priced` : `${gear.count} items` },
    { id: "stock", emoji: "🐠", label: "Livestock", value: stock.total, sub: stock.lost ? `${fmtMoney(stock.lost)} of it lost` : "priced records" },
  ].filter((s) => s.value > 0);

  // Both ledgers holding money is the one case where the total can overstate:
  // a heater entered as an Equipment expense AND priced in the gear record is
  // counted twice, and only the keeper can know whether it was.
  const typedEquipment = costs.filter((c) => (c.category || "Other") === "Equipment").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const mayDoubleCount = typedEquipment > 0 && gear.spend > 0;

  const byCat = CATS.map((c) => [c, costs.filter((x) => (x.category || "Other") === c).reduce((s, x) => s + (Number(x.amount) || 0), 0)]).filter(([, v]) => v > 0);

  // Spend this calendar month, from the date the thing was actually bought
  // rather than the moment it was typed in.
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTotal = costs.reduce((s, c) => {
    const d = costDate(c);
    return d && d.slice(0, 7) === thisMonth ? s + (Number(c.amount) || 0) : s;
  }, 0);

  const dateValid = isValidDayKey(date);
  const ready = Boolean(label.trim() && amount && dateValid);

  const add = () => {
    if (!ready) return;
    tapHaptic();
    onAdd({ id: Date.now(), date, label: label.trim(), amount: Number(amount), category: cat });
    setLabel(""); setAmount(""); setDate(getTodayKey()); setEditingDate(false);
  };

  return (
    <View>
      <View style={{ borderRadius: radius.xl, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: theme.accent, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
        <LinearGradient colors={["rgba(56,225,198,0.14)", "rgba(56,225,198,0.04)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: "center", paddingVertical: 18 }}>
          <Text style={{ color: theme.accentLight, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Total invested</Text>
          <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4, fontVariant: ["tabular-nums"] }}>{fmtMoney(total)}</Text>
          {monthTotal > 0 ? <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>{fmtMoney(monthTotal)} this month</Text> : null}
        </LinearGradient>
      </View>

      {/* Where the total came from. Itemised rather than merged: a total that
          silently absorbed two other ledgers would be impossible to reconcile
          against either of them. */}
      {sources.length > 1 ? (
        <View style={{ gap: 6, marginBottom: 12 }}>
          {sources.map((s) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 11, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
              <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{s.label}</Text>
              <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{s.sub}</Text>
              <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fmtMoney(s.value)}</Text>
            </View>
          ))}
          {mayDoubleCount ? (
            <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16 }}>
              Gear priced in your equipment record is counted here too — if you also logged it as an Equipment expense, it's in the total twice.
            </Text>
          ) : null}
        </View>
      ) : null}

      {byCat.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14, justifyContent: "center" }}>
          {byCat.map(([c, v]) => (
            <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.well, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: type.small }}>{CAT_EMOJI[c]}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{c}</Text>
              <Text style={{ color: theme.accent, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900" }}>${v.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={label} onChangeText={setLabel} placeholder="What did you buy?" placeholderTextColor={theme.secondaryText} accessibilityLabel="What you bought"
          style={{ fontFamily: "Inter_400Regular", flex: 1, backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14 }} 
            maxLength={TEXT_LIMITS.name}
          />
        <TextInput value={amount} onChangeText={(t) => setAmount(decimalText(t))} keyboardType="decimal-pad" placeholder="$0" placeholderTextColor={theme.secondaryText} accessibilityLabel="Amount"
          style={{ width: 84, backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} 
            maxLength={TEXT_LIMITS.number}
          />
      </View>

      {/* WHEN. Everything was stamped with the moment it was typed, so the
          "this month" figure counted a heater bought in March against April,
          and a keeper catching up on a month of receipts filed all of them
          against today. Same fix the water-test form already got. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Ionicons name="calendar-outline" size={14} color={theme.secondaryText} />
        {editingDate ? (
          <TextInput
            value={date}
            onChangeText={setDate}
            onBlur={() => setEditingDate(false)}
            autoFocus
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="Date this was bought"
            style={{ flex: 1, backgroundColor: theme.well, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, color: theme.text, borderWidth: 1, borderColor: dateValid ? theme.accent : theme.danger, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}
          
            maxLength={TEXT_LIMITS.date}
          />
        ) : (
          <Pressable onPress={() => { tapHaptic("light"); setEditingDate(true); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel={`Bought ${date === getTodayKey() ? "today" : date}. Tap to change the date.`}>
            <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
              Bought <Text style={{ color: theme.accent, fontFamily: "Inter_900Black", fontWeight: "900" }}>{date === getTodayKey() ? "today" : date}</Text>
            </Text>
          </Pressable>
        )}
        {date !== getTodayKey() && !editingDate ? (
          <Pressable onPress={() => { tapHaptic("light"); setDate(getTodayKey()); }} hitSlop={touchSlop(26)} accessibilityRole="button" accessibilityLabel="Set the date back to today">
            <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <Pill key={c} label={`${CAT_EMOJI[c]} ${c}`} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>
      <Pressable onPress={add} disabled={!ready} style={[ready ? styles.primaryBtn : styles.ghostBtn, { marginTop: 10 }]} accessibilityRole="button" accessibilityState={{ disabled: !ready }}>
        <Text style={ready ? styles.primaryBtnText : styles.ghostBtnText}>
          {label.trim() && amount && !dateValid ? "Check that date" : "Add expense"}
        </Text>
      </Pressable>

      {costs.length ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {costs.slice(0, visible).map((c) => (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 16 }}>{CAT_EMOJI[c.category] || "📦"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={1}>{c.label}</Text>
                {costDate(c) ? (
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>{costDate(c)}</Text>
                ) : null}
              </View>
              <Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{fmtMoney(c.amount)}</Text>
              <Pressable onPress={() => onDelete(c.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${c.label}`}>
                <Text style={{ color: theme.secondaryText, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          ))}
          {costs.length > visible ? (
            <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 12, costs.length)); }} style={styles.ghostBtn} accessibilityRole="button">
              <Text style={styles.ghostBtnText}>Show more ({costs.length - visible})</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
