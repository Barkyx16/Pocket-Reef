import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { getSpecies, getCompatibility, compatColor, tapHaptic } from "../core";
import { SpeciesThumb } from "./SpeciesThumb";

// A pairwise compatibility grid for the current tank — a colored heat-map of who
// gets along with whom. Axes are numbered (emojis repeat across species), with a
// legend beneath. Tap any cell to read why that pair scores the way it does.
export function CompatibilityMatrix({ tank = [] }) {
  const species = tank.map(getSpecies).filter(Boolean);
  const [sel, setSel] = useState(null);
  if (species.length < 2) {
    return <Text style={styles.cardText}>Add at least two species to your tank to see the compatibility grid.</Text>;
  }
  const CELL = 30;

  const Head = ({ label }) => (
    <View style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: theme.accentLight, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
    </View>
  );

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row" }}>
            <Head label="" />
            {species.map((_, i) => <Head key={i} label={String(i + 1)} />)}
          </View>
          {species.map((row, ri) => (
            <View key={row.name} style={{ flexDirection: "row" }}>
              <Head label={String(ri + 1)} />
              {species.map((col, ci) => {
                if (ri === ci) {
                  return (
                    <View key={ci} style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>·</Text>
                    </View>
                  );
                }
                const c = getCompatibility(row.name, col.name);
                const color = compatColor(c.level);
                const isSel = sel && ((sel.a === row.name && sel.b === col.name) || (sel.a === col.name && sel.b === row.name));
                return (
                  <Pressable key={ci} onPress={() => { tapHaptic("light"); setSel({ a: row.name, b: col.name, level: c.level, reason: c.reason }); }} style={({ pressed }) => [{ width: CELL, height: CELL, padding: 2.5 }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${row.name} with ${col.name}: ${c.level}`}>
                    <View style={{ flex: 1, borderRadius: 8, backgroundColor: `${color}3a`, borderWidth: isSel ? 2 : 1, borderColor: isSel ? color : `${color}99` }} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Selected pair reason */}
      {sel ? (
        <View style={{ marginTop: 12, backgroundColor: `${compatColor(sel.level)}18`, borderRadius: 12, borderWidth: 1, borderColor: `${compatColor(sel.level)}55`, padding: 12 }}>
          <Text style={{ color: compatColor(sel.level), fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", textTransform: "uppercase", marginBottom: 3 }}>{sel.level}</Text>
          <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>{getSpecies(sel.a)?.emoji} {sel.a} + {getSpecies(sel.b)?.emoji} {sel.b}: {sel.reason}</Text>
        </View>
      ) : (
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 10 }}>Tap any square to see why that pair scores the way it does.</Text>
      )}

      {/* Legend: numbers → names */}
      <View style={{ marginTop: 12, gap: 6 }}>
        {species.map((s, i) => (
          <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", width: 14 }}>{i + 1}</Text>
            <SpeciesThumb species={s} size={20} radius={7} />
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{s.name}</Text>
          </View>
        ))}
      </View>

      {/* Color key */}
      <View style={{ flexDirection: "row", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {[["excellent", "Great"], ["caution", "Caution"], ["avoid", "Avoid"]].map(([lvl, lab]) => {
          const color = compatColor(lvl);
          return (
            <View key={lvl} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: `${color}3a`, borderWidth: 1, borderColor: `${color}99` }} />
              <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{lab}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
