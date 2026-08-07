import { Text, View } from "react-native";
import { styles, theme } from "../styles";

// A short, season-aware tip. Northern-hemisphere months; harmless if reversed.
function getSeason() {
  const m = new Date().getMonth(); // 0–11
  if (m >= 5 && m <= 7) return { icon: "☀️", title: "Summer", tip: "Watch for overheating — a clip-on fan or chiller helps, and top off more often as evaporation climbs." };
  if (m === 11 || m <= 1) return { icon: "❄️", title: "Winter", tip: "Check your heater is holding temperature, and keep a battery air pump handy in case of power cuts." };
  if (m >= 2 && m <= 4) return { icon: "🌱", title: "Spring", tip: "Algae picks up as days lengthen — trim your light period and stay on top of water changes." };
  return { icon: "🍂", title: "Fall", tip: "A stable season — a good time to deep-clean equipment and refresh your filter media." };
}

export function SeasonTipsCard() {
  const s = getSeason();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(56,225,198,0.12)", borderWidth: 1, borderColor: "rgba(56,225,198,0.24)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 20 }}>{s.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s.title} tip</Text>
        <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 19 }}>{s.tip}</Text>
      </View>
    </View>
  );
}
