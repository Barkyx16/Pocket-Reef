import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getSpecies } from "../core";

// Equipment sizing for the current tank — heater wattage, filter turnover, and
// lighting, all sized from the tank volume and what's stocked.
export function GearGuideCard({ tankGallons = 20, tank = [], tankWater }) {
  const stocked = tank.map(getSpecies).filter(Boolean);
  const coldwater = stocked.some((s) => s.water === "fresh" && s.tempMaxF <= 75);
  const hasCoral = stocked.some((s) => s.kind === "coral");
  // Use what's stocked, else fall back to the tank's declared water type.
  const saltwater = stocked.length ? stocked.some((s) => s.water === "salt") : tankWater === "salt";
  const heaterW = Math.max(25, Math.round((tankGallons * 4) / 25) * 25);
  const gph = Math.round(tankGallons * 5);

  const items = [
    coldwater
      ? { icon: "❄️", title: "Heater", text: "Your coldwater fish don't need a heater — just keep the room temperature stable." }
      : { icon: "🌡️", title: "Heater", text: `About ${heaterW}W (~4W per gallon) to hold a steady temperature. A controller helps in summer.` },
    { icon: "🌀", title: "Filter", text: `Choose one rated for ~${gph} GPH (about 5× your tank volume per hour) for good turnover.` },
    hasCoral
      ? { icon: "💡", title: "Lighting", text: "Corals need a reef light strong enough for your tank's depth — LPS/soft corals are more forgiving than SPS." }
      : { icon: "💡", title: "Lighting", text: "A basic LED is plenty; more light mainly grows more algae, so start moderate." },
    saltwater
      ? { icon: "🌊", title: "Saltwater extras", text: "You'll also want a powerhead for flow, a hydrometer/refractometer, and a protein skimmer for a reef." }
      : { icon: "🪣", title: "Basics", text: "Keep a dedicated bucket, a gravel vacuum, and a water conditioner on hand for weekly changes." },
  ];

  return (
    <View>
      <Text style={styles.cardText}>Recommended gear for your {tankGallons} gal tank:</Text>
      <View style={{ gap: 12, marginTop: 12 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{it.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{it.title}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "600", marginTop: 2, lineHeight: 19 }}>{it.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
