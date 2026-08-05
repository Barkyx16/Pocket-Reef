import { Image, Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getFishOfDay, careLevelColor, temperamentColor, tapHaptic } from "../core";
import { formatTempRange, formatVolume } from "../lib/units";
import { getSpeciesImage } from "../data/speciesImageMap";
import { Chip } from "./Chip";

// A deterministic daily species spotlight on Home — a fresh fish to discover
// each day, tapping through to its full detail page.
export function FishOfDayCard({ onOpenSpecies }) {
  const s = getFishOfDay();
  if (!s) return null;
  const img = getSpeciesImage(s.name);
  return (
    <Pressable
      onPress={() => { tapHaptic(); onOpenSpecies && onOpenSpecies(s.name); }}
      style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
      accessibilityRole="button"
      accessibilityLabel={`Fish of the day: ${s.name}`}
    >
      <View style={styles.cleanImageWrap}>
        {img ? <Image source={img} style={styles.cleanImage} resizeMode="cover" /> : <Text style={styles.cleanEmoji}>{s.emoji}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cleanName} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.cleanMeta} numberOfLines={2}>
          {s.water === "salt" ? "🌊 Saltwater" : "💧 Freshwater"} · {formatVolume(s.minGallons)}+ · {formatTempRange(s.tempMinF, s.tempMaxF)}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 7 }}>
          <Chip label={s.careLevel} color={careLevelColor(s.careLevel)} />
          <Chip label={s.temperament} color={temperamentColor(s.temperament)} />
        </View>
      </View>
      <Text style={styles.cleanArrow}>›</Text>
    </Pressable>
  );
}
