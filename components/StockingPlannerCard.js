import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { styles, theme, type, space } from "../styles";
import { successHaptic, selectionHaptic } from "../core";
import { generateStockingPlan } from "../lib/planner";
import { SpeciesThumb } from "./SpeciesThumb";
import { ProgressBar } from "./ProgressBar";
import { GradientButton } from "./GradientButton";
import { Pill } from "./Pill";
import { formatVolume } from "../lib/units";

// ─────────────────────────────────────────────────────────────────────────────
// "Design my tank."
//
// The compatibility engine could only ever grade what the user had already
// chosen. This runs it in reverse — every plan it produces is conflict-free by
// construction, fits the tank, respects real schooling minimums, and leaves
// headroom rather than filling to the guideline.
//
// Loading a plan replaces the current stock, so it asks first. That's the one
// destructive action on this screen.
// ─────────────────────────────────────────────────────────────────────────────

const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Some experience" },
  { id: "any", label: "Anything" },
];

export function StockingPlannerCard({ tankGallons = 20, tankWater = "fresh", hasStock = false, onLoadPlan }) {
  const [experience, setExperience] = useState("beginner");
  const [seed, setSeed] = useState(1);

  const plan = generateStockingPlan({ gallons: tankGallons, water: tankWater, experience, seed });

  const load = () => {
    if (!plan.ok) return;
    const apply = () => { successHaptic(); onLoadPlan && onLoadPlan(plan); };
    if (hasStock) {
      Alert.alert(
        "Replace your current stock?",
        "Loading this plan clears what's in this tank and replaces it. Your water history, journal and costs are untouched.",
        [{ text: "Cancel", style: "cancel" }, { text: "Replace", style: "destructive", onPress: apply }]
      );
    } else {
      apply();
    }
  };

  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0 }]}>
        A complete, conflict-free plan for your {tankGallons} gallon {tankWater === "salt" ? "saltwater" : "freshwater"} tank —
        checked against the same engine that grades your stock.
      </Text>

      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.lg, marginBottom: space.sm }}>
        YOUR EXPERIENCE
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {LEVELS.map((l) => (
          <Pill key={l.id} label={l.label} active={experience === l.id} onPress={() => setExperience(l.id)} />
        ))}
      </View>

      {!plan.ok ? (
        <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.lg, lineHeight: 19 }}>
          {plan.reason}
        </Text>
      ) : (
        <>
          <View style={{ marginTop: space.xl, gap: space.lg }}>
            {plan.picks.map((p) => (
              <View key={p.species.name} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                <SpeciesThumb species={p.species} size={42} radius={12} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                      {p.count}× {p.species.name}
                    </Text>
                  </View>
                  <Text style={{ color: theme.accent, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: space.hair }}>
                    {p.roleLabel}
                  </Text>
                  <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.hair, lineHeight: 15 }}>
                    {p.why}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: space.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: space.sm }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>ESTIMATED LOAD</Text>
              <Text style={{ color: theme.accent, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                {plan.load}" of {formatVolume(plan.capacity)} · {plan.headroom}" spare
              </Text>
            </View>
            <ProgressBar pct={plan.pct} height={8} glow label={`Estimated stocking load, ${plan.pct}%`} />
            <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.sm, lineHeight: 16 }}>
              Deliberately under-stocked — headroom is what lets fish grow and gives you room to add later.
            </Text>
          </View>

          {plan.notes.length ? (
            <View style={{ marginTop: space.md }}>
              {plan.notes.map((n) => (
                <Text key={n} style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16 }}>· {n}</Text>
              ))}
            </View>
          ) : null}

          <GradientButton label="Use this plan" onPress={load} style={{ marginTop: space.lg }} />

          <Pressable
            onPress={() => { selectionHaptic(); setSeed((n) => n + 1); }}
            style={({ pressed }) => [{ marginTop: space.md, paddingVertical: space.md, alignItems: "center" }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Generate a different plan"
          >
            <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>🎲 Show me another</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
