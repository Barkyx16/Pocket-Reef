import { Text, View } from "react-native";
import { styles, theme, type, space } from "../styles";
import { getSpecies, getFeedingPlan } from "../core";

// A feeding plan built from the diets of what you actually keep. Derived — no
// extra data to author.
export function FeedingGuideCard({ tank = [], quantities = {} }) {
  const feeding = getFeedingPlan(tank, quantities);
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
      {feeding.ok ? (
        <View style={{ marginBottom: space.lg, gap: space.lg }}>
          {feeding.groups.map((g) => (
            <View key={g.diet}>
              <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "capitalize" }}>
                {g.diet}s · {g.fishCount} fish · {g.timesPerDay}× daily
              </Text>
              <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.hair }}>{g.food}</Text>
              <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.hair, lineHeight: 16 }}>{g.note}</Text>
              <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.hair, lineHeight: 16 }}>{g.portion}</Text>
            </View>
          ))}
          <Text style={{ color: theme.warn, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 17 }}>{feeding.goldenRule}</Text>
        </View>
      ) : null}

      <Text style={styles.cardText}>Feed small amounts once or twice a day — only what they finish in a couple of minutes. Overfeeding is the #1 cause of bad water.</Text>
      <View style={{ gap: space.md, marginTop: space.md }}>
        {recs.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <Text style={{ fontSize: type.title, letterSpacing: -0.2 }}>{r.icon}</Text>
            <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19 }}>{r.text}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.md }}>Tip: a weekly fasting day keeps most fish healthy and your water cleaner.</Text>
    </View>
  );
}
