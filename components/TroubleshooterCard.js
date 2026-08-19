import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme, radius, type } from "../styles";
import { TROUBLESHOOTING, tapHaptic } from "../core";

// Emergency troubleshooter — tap a problem to expand fast, ordered first-response
// steps. For "something's wrong right now" moments, complementing the disease guides.
export function TroubleshooterCard() {
  const [open, setOpen] = useState(null);
  return (
    <View style={{ gap: 8 }}>
      {TROUBLESHOOTING.map((item) => {
        const on = open === item.id;
        return (
          <View key={item.id} style={{ backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: on ? theme.accent : theme.border, overflow: "hidden" }}>
            <Pressable onPress={() => { tapHaptic("light"); setOpen(on ? null : item.id); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }} accessibilityRole="button">
              <Text style={{ fontSize: type.titleLg }}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{item.problem}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>{item.summary}</Text>
              </View>
              <Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{on ? "▲" : "▾"}</Text>
            </Pressable>
            {on ? (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                {item.steps.map((step, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", minWidth: 16 }}>{i + 1}.</Text>
                    <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 19 }}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
