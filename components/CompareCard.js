import { Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import { getSpecies, getCompatibility, compatColor } from "../core";
import { formatTempRange, formatVolume } from "../lib/units";
import { Chip } from "./Chip";
import { SpeciesThumb } from "./SpeciesThumb";

// Side-by-side comparison of two species — care stats stacked in two columns,
// plus how the pair gets along. Powers the Species tab's Compare mode.
export function CompareCard({ a, b }) {
  const sa = getSpecies(a);
  const sb = getSpecies(b);
  if (!sa || !sb) return null;
  const c = getCompatibility(a, b);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

  const rows = [
    ["Min tank", formatVolume(sa.minGallons), formatVolume(sb.minGallons)],
    ["Adult size", sa.adultInches ? `${sa.adultInches}"` : "—", sb.adultInches ? `${sb.adultInches}"` : "—"],
    ["Temp", formatTempRange(sa.tempMinF, sa.tempMaxF), formatTempRange(sb.tempMinF, sb.tempMaxF)],
    ["pH", `${sa.phMin}–${sa.phMax}`, `${sb.phMin}–${sb.phMax}`],
    ["Water", sa.water === "salt" ? "Salt" : "Fresh", sb.water === "salt" ? "Salt" : "Fresh"],
    ["Diet", cap(sa.diet), cap(sb.diet)],
    ["Care", sa.careLevel, sb.careLevel],
    ["Temperament", cap(sa.temperament), cap(sb.temperament)],
    ["Group", sa.minGroup > 1 ? `${sa.minGroup}+` : "Solo OK", sb.minGroup > 1 ? `${sb.minGroup}+` : "Solo OK"],
  ];

  return (
    <View style={[styles.card, { marginBottom: 0 }]}>
      {/* Headers */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 96 }} />
        {[sa, sb].map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <SpeciesThumb species={s} size={44} radius={12} />
            <Text style={{ color: "#fff", fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", textAlign: "center", marginTop: space.sm }} numberOfLines={2}>{s.name}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      <View style={{ marginTop: space.md }}>
        {rows.map(([label, va, vb], i) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
            <Text style={{ width: 96, color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{label}</Text>
            <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}>{va}</Text>
            <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}>{vb}</Text>
          </View>
        ))}
      </View>

      {/* Compatibility */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, backgroundColor: `${compatColor(c.level)}18`, borderRadius: radius.md, borderWidth: 1, borderColor: `${compatColor(c.level)}55`, padding: space.md }}>
        <Chip label={c.level} color={compatColor(c.level)} />
        <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>{c.reason}</Text>
      </View>
    </View>
  );
}
