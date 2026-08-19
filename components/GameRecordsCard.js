import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme, radius, type } from "../styles";

// Mirrors the four games in screens/GamesTab.js. Best streak + blitz score are
// persisted there under pr_game_<id>_streak / pr_game_<id>_blitz; here we just read.
const GAMES = [
  { id: "guess", emoji: "🖼️", name: "Guess the Fish" },
  { id: "match", emoji: "🤝", name: "Tank Match" },
  { id: "bigger", emoji: "📏", name: "Bigger Tank?" },
  { id: "trivia", emoji: "🧠", name: "Reef Trivia" },
];

export function GameRecordsCard() {
  const [records, setRecords] = useState({});

  useEffect(() => {
    // Guarded: these read from storage and set state when the promise resolves.
    // Switching tab or closing the sheet before that lands writes to an
    // unmounted component — React logs it and the write is thrown away, which
    // is a warning today and a stale-state bug the moment anything downstream
    // reads it.
    let alive = true;
    const keys = GAMES.flatMap((g) => [`pr_game_${g.id}_streak`, `pr_game_${g.id}_blitz`]);
    AsyncStorage.multiGet(keys)
      .then((pairs) => {
        const r = {};
        pairs.forEach(([k, v]) => { r[k] = Number(v) || 0; });
        if (alive) setRecords(r);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>Your personal bests across Reef Games — beat them in Practice or 60s Blitz.</Text>
      <View style={{ gap: 8 }}>
        {GAMES.map((g) => {
          const streak = records[`pr_game_${g.id}_streak`] || 0;
          const blitz = records[`pr_game_${g.id}_blitz`] || 0;
          return (
            <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: type.titleLg, letterSpacing: -0.2 }}>{g.emoji}</Text>
              <Text style={{ flex: 1, color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{g.name}</Text>
              <View style={{ alignItems: "center", minWidth: 46 }}>
                <Text style={{ color: theme.warn, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>🔥 {streak}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 9, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>STREAK</Text>
              </View>
              <View style={{ alignItems: "center", minWidth: 46 }}>
                <Text style={{ color: theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>⏱️ {blitz}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 9, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>BLITZ</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
