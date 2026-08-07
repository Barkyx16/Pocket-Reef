import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { Pill } from "./Pill";

const CATS = ["Equipment", "Livestock", "Food", "Other"];
const CAT_EMOJI = { Equipment: "🔧", Livestock: "🐠", Food: "🍤", Other: "📦" };

// Track what your tank costs — every hobbyist quietly wonders. Logs labeled
// expenses by category with a running total.
export function CostTrackerCard({ costs = [], onAdd, onDelete }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Equipment");
  const [visible, setVisible] = useState(6);
  const total = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Breakdown by category, and spend so far this calendar month (entry ids are
  // Date.now() timestamps, so they double as the logged date).
  const byCat = CATS.map((c) => [c, costs.filter((x) => (x.category || "Other") === c).reduce((s, x) => s + (Number(x.amount) || 0), 0)]).filter(([, v]) => v > 0);
  const now = new Date();
  const monthTotal = costs.reduce((s, c) => {
    const d = new Date(c.id);
    return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() ? s + (Number(c.amount) || 0) : s;
  }, 0);

  const add = () => {
    if (!label.trim() || !amount) return;
    tapHaptic();
    onAdd({ id: Date.now(), label: label.trim(), amount: Number(amount), category: cat });
    setLabel(""); setAmount("");
  };

  return (
    <View>
      <View style={{ borderRadius: 18, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "rgba(56,225,198,0.28)", shadowColor: theme.accent, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
        <LinearGradient colors={["rgba(56,225,198,0.14)", "rgba(56,225,198,0.03)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: "center", paddingVertical: 18 }}>
          <Text style={{ color: theme.accentLight, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Total invested</Text>
          <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4, fontVariant: ["tabular-nums"] }}>${total.toFixed(2)}</Text>
          {monthTotal > 0 ? <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>${monthTotal.toFixed(2)} this month</Text> : null}
        </LinearGradient>
      </View>

      {byCat.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14, justifyContent: "center" }}>
          {byCat.map(([c, v]) => (
            <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.well, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 12 }}>{CAT_EMOJI[c]}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{c}</Text>
              <Text style={{ color: theme.accent, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>${v.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={label} onChangeText={setLabel} placeholder="What did you buy?" placeholderTextColor={theme.secondaryText}
          style={{ fontFamily: "Inter_400Regular", flex: 1, backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14 }} />
        <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="$0" placeholderTextColor={theme.secondaryText}
          style={{ width: 84, backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} />
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <Pill key={c} label={`${CAT_EMOJI[c]} ${c}`} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>
      <Pressable onPress={add} disabled={!label.trim() || !amount} style={[(label.trim() && amount) ? styles.primaryBtn : styles.ghostBtn, { marginTop: 10 }]} accessibilityRole="button">
        <Text style={(label.trim() && amount) ? styles.primaryBtnText : styles.ghostBtnText}>Add expense</Text>
      </Pressable>

      {costs.length ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {costs.slice(0, visible).map((c) => (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 16 }}>{CAT_EMOJI[c.category] || "📦"}</Text>
              <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={1}>{c.label}</Text>
              <Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>${Number(c.amount).toFixed(2)}</Text>
              <Pressable onPress={() => onDelete(c.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete expense">
                <Text style={{ color: theme.secondaryText, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
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
