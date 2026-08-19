import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { getTodayKey, tapHaptic } from "../core";
import { TEXT_LIMITS } from "../lib/textLimits";

// A lightweight feeding log — tap the food type, optionally note what/how much,
// and log it. Builds the daily-touch habit loop and earns XP.
// Food types are content, but a red circle for "Pellet" communicated nothing.
const FOODS = [["Flake", "🍥"], ["Pellet", "🟤"], ["Frozen", "🧊"], ["Veggie", "🥬"], ["Live", "🦐"], ["Other", "🍽️"]];
const FOOD_EMOJI = Object.fromEntries(FOODS);

export function FeedingLogCard({ feedings = [], onAdd, onDelete }) {
  const [food, setFood] = useState("Flake");
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(6);

  const fedToday = feedings.filter((f) => f.date === getTodayKey()).length;

  const add = () => {
    tapHaptic();
    onAdd({ id: Date.now(), date: getTodayKey(), food, note: note.trim() });
    setNote("");
  };

  return (
    <View>
      <Text style={styles.cardText}>
        {fedToday ? `Fed ${fedToday} time${fedToday > 1 ? "s" : ""} today. ` : "Log each feeding to build your streak. "}
        Small amounts, once or twice a day.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {FOODS.map(([f, e]) => {
          const on = food === f;
          return (
            <Pressable key={f} onPress={() => { tapHaptic("light"); setFood(f); }} style={[styles.pill, { backgroundColor: on ? theme.accent : "rgba(255,255,255,0.05)", borderColor: on ? theme.accent : theme.border }]} accessibilityRole="button">
              <Text style={{ color: on ? theme.onAccent : theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{e} {f}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TextInput value={note} onChangeText={setNote} placeholder="Note (optional) — e.g. mysis + nori" placeholderTextColor={theme.secondaryText}
          style={{ fontFamily: "Inter_400Regular", flex: 1, backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14 }} 
            maxLength={TEXT_LIMITS.shortNote}
          />
        <Pressable onPress={add} style={[styles.primaryBtn, { flex: 0, paddingHorizontal: 18, justifyContent: "center" }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Log</Text>
        </Pressable>
      </View>

      {feedings.length ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {feedings.slice(0, visible).map((f) => (
            <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 16 }}>{FOOD_EMOJI[f.food] || "🍽️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{f.food}{f.note ? ` · ${f.note}` : ""}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{f.date}</Text>
              </View>
              <Pressable onPress={() => onDelete(f.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete feeding">
                <Text style={{ color: theme.secondaryText, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          ))}
          {feedings.length > visible ? (
            <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 12, feedings.length)); }} style={styles.ghostBtn} accessibilityRole="button">
              <Text style={styles.ghostBtnText}>Show more ({feedings.length - visible})</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
