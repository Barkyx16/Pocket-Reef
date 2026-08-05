import { Image, Text } from "react-native";
import { getSpecies } from "../core";
import { getSpeciesImage } from "../data/speciesImageMap";

// A tiny species image (or its emoji, if no photo is bundled) for use in chips,
// legends, and headers — anywhere a species is named across the app.
export function SpeciesThumb({ name, species, size = 20, radius }) {
  const s = species || getSpecies(name);
  if (!s) return null;
  const img = getSpeciesImage(s.name);
  if (img) {
    const r = radius != null ? radius : Math.round(size / 3.5);
    return <Image source={img} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />;
  }
  return <Text style={{ fontSize: Math.round(size * 0.85) }}>{s.emoji}</Text>;
}
