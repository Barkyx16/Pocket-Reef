import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getSpecies } from "../core";

// A snapshot of what the keeper actually keeps — species by water type and by
// kind — across every tank. A fun "know thyself" view on the Profile.
export function CollectionInsightsCard({ tanks = [] }) {
  const names = new Set();
  tanks.forEach((t) => (t.stock || []).forEach((n) => names.add(n)));
  const species = [...names].map(getSpecies).filter(Boolean);
  if (!species.length) {
    return <Text style={styles.cardText}>Stock a tank and your collection breakdown will appear here.</Text>;
  }
  const fresh = species.filter((s) => s.water === "fresh").length;
  const salt = species.filter((s) => s.water === "salt").length;
  const fish = species.filter((s) => s.kind === "fish").length;
  const invert = species.filter((s) => s.kind === "invert").length;
  const coral = species.filter((s) => s.kind === "coral").length;
  const freshPct = Math.round((fresh / species.length) * 100);

  return (
    <View>
      <View style={styles.statGrid}>
        <View style={styles.statBox}><Text style={styles.statLabel}>🐟 Fish</Text><Text style={styles.statValue}>{fish}</Text></View>
        <View style={styles.statBox}><Text style={styles.statLabel}>🦐 Inverts</Text><Text style={styles.statValue}>{invert}</Text></View>
        <View style={styles.statBox}><Text style={styles.statLabel}>🪸 Corals</Text><Text style={styles.statValue}>{coral}</Text></View>
        <View style={styles.statBox}><Text style={styles.statLabel}>🎣 Total species</Text><Text style={styles.statValue}>{species.length}</Text></View>
      </View>

      {fresh && salt ? (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: theme.accentLight, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>💧 Fresh {fresh}</Text>
            <Text style={{ color: theme.coral, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Salt {salt} 🌊</Text>
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: theme.coral, overflow: "hidden", flexDirection: "row" }}>
            <View style={{ width: `${freshPct}%`, backgroundColor: theme.accent }} />
          </View>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 12 }}>
          You keep {fresh ? "freshwater" : "saltwater"} species — a focused {fresh ? "freshwater" : "reef"} keeper. 🐠
        </Text>
      )}
    </View>
  );
}
