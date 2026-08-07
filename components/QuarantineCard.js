import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { ProgressBar } from "./ProgressBar";

// Quarantine tracker — a countdown for each new arrival's QT period (default
// 21 days), the single best habit for keeping disease out of a display tank.
// `items` is [{ id, name, startDate }].
const QT_DAYS = 21;
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export function QuarantineCard({ items = [], onAdd, onRemove, onGraduate }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    tapHaptic();
    onAdd({ id: Date.now(), name: name.trim(), startDate: new Date().toISOString() });
    setName("");
  };

  return (
    <View>
      <Text style={styles.cardText}>Isolate new arrivals for {QT_DAYS} days before adding them to your display tank. Track each one's countdown here.</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TextInput value={name} onChangeText={setName} placeholder="New arrival (e.g. Yellow Tang)" placeholderTextColor={theme.secondaryText}
          style={{ fontFamily: "Inter_400Regular", flex: 1, backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14 }} />
        <Pressable onPress={add} disabled={!name.trim()} style={[name.trim() ? styles.primaryBtn : styles.ghostBtn, { flex: 0, paddingHorizontal: 18, justifyContent: "center" }]} accessibilityRole="button">
          <Text style={name.trim() ? styles.primaryBtnText : styles.ghostBtnText}>Start</Text>
        </Pressable>
      </View>

      {items.length ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {items.map((it) => {
            const elapsed = daysSince(it.startDate);
            const left = QT_DAYS - elapsed;
            const done = left <= 0;
            const color = done ? theme.accent : left <= 3 ? theme.warn : theme.text;
            return (
              <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: done ? "rgba(56,225,198,0.35)" : theme.border }}>
                <Text style={{ fontSize: 18 }}>{done ? "✅" : "⏳"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{it.name}</Text>
                  <Text style={{ color, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2, marginBottom: 7 }}>
                    {done ? "Ready to add to your tank! 🎉" : `${left} day${left === 1 ? "" : "s"} left · day ${elapsed} of ${QT_DAYS}`}
                  </Text>
                  <ProgressBar pct={Math.min(100, (elapsed / QT_DAYS) * 100)} color={done ? theme.accent : theme.warn} height={6} />
                </View>
                {done && onGraduate ? (
                  <Pressable onPress={() => { tapHaptic("medium"); onGraduate(it); }} hitSlop={8} style={{ backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }} accessibilityRole="button" accessibilityLabel={`Add ${it.name} to tank`}>
                    <Text style={{ color: "#04202a", fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>＋ Add to tank</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onRemove(it.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`}>
                    <Text style={{ color: theme.secondaryText, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
