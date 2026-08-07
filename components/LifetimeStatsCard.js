import { Text, View } from "react-native";
import { styles, theme } from "../styles";

// Career totals across every tank — the long-term progress view that makes a
// keeper's history feel tangible. Reads a getLifetimeStats() roll-up.
export function LifetimeStatsCard({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Species collected", value: stats.species, icon: "🐠" },
    { label: "Water tests logged", value: stats.tests, icon: "🧪" },
    { label: "Journal entries", value: stats.journal, icon: "📓" },
    { label: "Photos captured", value: stats.photos, icon: "📷" },
    { label: "Days active", value: stats.daysActive, icon: "🔥" },
    { label: "Tanks kept", value: stats.tanks, icon: "🌊" },
  ];
  return (
    <View>
      <View style={styles.statGrid}>
        {items.map((it) => (
          <View key={it.label} style={styles.statBox}>
            <Text style={styles.statLabel}>{it.icon} {it.label}</Text>
            <Text style={styles.statValue}>{it.value}</Text>
          </View>
        ))}
      </View>
      {stats.spend > 0 ? (
        <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 12 }}>
          💰 ~${stats.spend} tracked across all tanks so far.
        </Text>
      ) : null}
    </View>
  );
}
