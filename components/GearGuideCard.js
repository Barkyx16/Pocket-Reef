import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getEquipmentPlan } from "../lib/planner";
import { getSpecies } from "../core";

// Equipment sizing for the current tank — heater wattage, filter turnover, and
// lighting, all sized from the tank volume and what's stocked.
export function GearGuideCard({ tankGallons = 20, tank = [], tankWater }) {
  // Sized from this tank and its stock rather than generic advice — heater
  // wattage, turnover and flow are arithmetic the app already has the inputs for.
  const equipment = getEquipmentPlan({ gallons: tankGallons, water: tankWater, stockedNames: tank });
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
      {equipment.ok ? (
        <View style={{ gap: 12, marginBottom: 16 }}>
          {equipment.items.map((it) => (
            <View key={it.id} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={{ minWidth: 74, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(56,225,198,0.12)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center" }}>
                <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.value}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.label}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 16 }}>{it.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.cardText}>Recommended gear for your {tankGallons} gal tank:</Text>
      <View style={{ gap: 12, marginTop: 12 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{it.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{it.title}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 19 }}>{it.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
