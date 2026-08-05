import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getSpecies } from "../core";

// A feeding plan built from the diets of what you actually keep. Derived — no
// extra data to author.
export function FeedingGuideCard({ tank = [] }) {
  const species = tank.map(getSpecies).filter(Boolean);
  if (!species.length) {
    return <Text style={styles.cardText}>Stock your tank to get a feeding plan tailored to your fish.</Text>;
  }
  const diets = {};
  species.forEach((s) => { diets[s.diet] = (diets[s.diet] || 0) + 1; });
  const plural = (n) => (n > 1 ? "s" : "");
  const recs = [];
  if (diets.omnivore) recs.push({ icon: "🍤", text: `${diets.omnivore} omnivore${plural(diets.omnivore)} — a quality flake or pellet daily, plus occasional frozen treats.` });
  if (diets.carnivore) recs.push({ icon: "🦐", text: `${diets.carnivore} carnivore${plural(diets.carnivore)} — meaty foods like frozen mysis, brine shrimp, or bloodworms.` });
  if (diets.herbivore) recs.push({ icon: "🥬", text: `${diets.herbivore} herbivore${plural(diets.herbivore)} — algae wafers, blanched veggies, or nori sheets, plus grazing surfaces.` });
  if (diets.photosynthetic) recs.push({ icon: "💡", text: `${diets.photosynthetic} coral/photosynthetic — mostly powered by light; target-feed some corals with reef foods.` });

  return (
    <View>
      <Text style={styles.cardText}>Feed small amounts once or twice a day — only what they finish in a couple of minutes. Overfeeding is the #1 cause of bad water.</Text>
      <View style={{ gap: 10, marginTop: 12 }}>
        {recs.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 18 }}>{r.icon}</Text>
            <Text style={{ flex: 1, color: theme.secondaryText, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{r.text}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "700", marginTop: 12 }}>Tip: a weekly fasting day keeps most fish healthy and your water cleaner.</Text>
    </View>
  );
}
