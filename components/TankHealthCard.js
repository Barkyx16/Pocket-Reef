import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme, radius, type } from "../styles";
import { tapHaptic, getHealthImprovements } from "../core";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// The overall reef-health score with a factor breakdown. The score ring shows at
// a glance; tap the header to expand or collapse the six-factor breakdown so the
// card stays compact inside the Your Tank overview.
const ICON = { true: "✓", partial: "~", false: "✕" };
const CLR = { true: theme.accent, partial: theme.warn, false: theme.danger };

export function TankHealthCard({ health, defaultOpen = false, onGoToTab }) {
  // A score with no next step is just a grade. These are the same factors,
  // priced and ranked, so the number becomes something you can act on.
  const improvements = getHealthImprovements(health, 3);
  const [open, setOpen] = useState(defaultOpen);
  if (!health) return null;
  return (
    <View>
      <Pressable
        onPress={() => { tapHaptic("light"); setOpen((v) => !v); }}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 16 }, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={health.score == null ? `Tank health not yet measurable, ${open ? "hide" : "show"} breakdown` : `Tank health ${health.score} of 100, ${open ? "hide" : "show"} breakdown`}
      >
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: health.color, alignItems: "center", justifyContent: "center", backgroundColor: `${health.color}14`, shadowColor: health.color, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 4 }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{health.score == null ? "—" : health.score}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: health.color, fontSize: type.titleLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{health.label}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>Overall health, out of 100.</Text>
          <Text style={{ color: theme.accent, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4 }}>{open ? "Hide breakdown ▲" : "Tap for breakdown ▾"}</Text>
        </View>
      </Pressable>

      {open ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {health.factors.map((f) => (
            <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: radius.xs, backgroundColor: `${CLR[String(f.state)]}22`, borderWidth: 1, borderColor: `${CLR[String(f.state)]}88`, alignItems: "center", justifyContent: "center" }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color: CLR[String(f.state)], fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{ICON[String(f.state)]}</Text>
              </View>
              <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{f.label}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{f.detail}</Text>
            </View>
          ))}

          {improvements.length ? (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
                Raise your score
              </Text>
              <View style={{ gap: 10 }}>
                {improvements.map((imp) => (
                  <Pressable
                    key={imp.label}
                    onPress={() => { if (onGoToTab) { tapHaptic(); onGoToTab(imp.to); } }}
                    style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10 }, pressed && onGoToTab && { opacity: 0.7 }]}
                    accessibilityRole={onGoToTab ? "button" : undefined}
                    accessibilityLabel={`${imp.action}, worth up to ${imp.points} points`}
                  >
                    <View style={{ minWidth: 40, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center" }}>
                      <Text style={{ color: theme.accent, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>+{imp.points}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{imp.action}</Text>
                      {imp.why ? <Text style={{ color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 1, lineHeight: 15 }}>{imp.why}</Text> : null}
                    </View>
                    {onGoToTab ? <Text style={{ color: theme.accent, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
