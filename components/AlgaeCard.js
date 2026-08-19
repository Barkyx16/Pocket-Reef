import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { typesFor, diagnose } from "../lib/algae";

// Identify it, then work back through this tank's own readings.
//
// Every algae article says "reduce nutrients and light", which is true, useless,
// and the thing the keeper already tried. This says which of those two applies
// HERE, with the number, and puts the free fix first.
export function AlgaeCard({ tank = {}, waterType = "fresh", onGoToTab }) {
  const [picked, setPicked] = useState(null);
  const types = useMemo(() => typesFor(waterType), [waterType]);
  const result = useMemo(() => (picked ? diagnose(picked, tank, waterType) : null), [picked, tank, waterType]);

  return (
    <View>
      <Text style={styles.cardText}>What are you actually looking at?</Text>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {types.map((t) => {
          const on = picked === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => { tapHaptic("light"); setPicked(on ? null : t.id); }}
              style={({ pressed }) => [{ backgroundColor: on ? "rgba(56,225,198,0.10)" : theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: on ? theme.accent : theme.border, padding: space.md }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.label}. ${t.looks}`}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Text style={{ flex: 1, color: on ? theme.accent : theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{t.label}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{t.also}</Text>
                <Ionicons name={on ? "chevron-down" : "chevron-forward"} size={13} color={theme.secondaryText} />
              </View>
              <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16, marginTop: space.xs }}>{t.looks}</Text>
            </Pressable>
          );
        })}
      </View>

      {result && result.ok ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{result.headline}</Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: space.xs }}>{result.type.summary}</Text>

          {/* Where this tank's data disagrees with the usual advice, that comes
              first — it's the part nobody else will tell them. */}
          {result.contradiction ? (
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", padding: space.md }}>
              <Ionicons name="information-circle" size={16} color={theme.accent} style={{ marginTop: space.hair }} />
              <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>{result.contradiction}</Text>
            </View>
          ) : null}

          {result.confirmed.length ? (
            <>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: space.lg }}>
                From your own readings
              </Text>
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {result.confirmed.map((c, i) => (
                  <View key={c.id} style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: i === 0 ? "rgba(56,225,198,0.42)" : theme.border, padding: space.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <Text style={{ color: theme.accent, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{i + 1}</Text>
                      <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{c.label}</Text>
                      {c.free ? (
                        <View style={{ backgroundColor: "rgba(56,225,198,0.16)", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.hair }}>
                          <Text style={{ color: theme.accent, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>FREE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>{c.fix}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Things the record can't measure. Offered to check, never claimed. */}
          {result.possible.length ? (
            <>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: space.lg }}>
                Worth checking — the app can't see these
              </Text>
              {result.possible.map((c) => (
                <Text key={c.id} style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>
                  <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>{c.label}: </Text>{c.fix}
                </Text>
              ))}
            </>
          ) : null}

          {!result.evidence.hasNutrientData ? (
            <Pressable onPress={() => { tapHaptic(); onGoToTab && onGoToTab("log"); }} style={[styles.ghostBtn, { marginTop: space.lg }]} accessibilityRole="button">
              <Text style={styles.ghostBtnText}>Log a water test to narrow this down</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
