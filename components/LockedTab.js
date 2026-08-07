import { ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { GradientButton } from "./GradientButton";

// The wall a free user hits on a Premium tab.
//
// This renders INSTEAD of the tab, not on top of it — the gated screen is never
// mounted, so its data never reaches the render tree. That matters: an overlay
// you can screenshot around, or that a layout bug can reveal, isn't a gate.
export function LockedTab({ emoji = "🔒", title, blurb, perks = [], onOpenPremium }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: "center", paddingTop: 40 }}>
        <View
          style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: "rgba(56,225,198,0.10)",
            borderWidth: 1, borderColor: "rgba(56,225,198,0.30)",
            alignItems: "center", justifyContent: "center",
            shadowColor: theme.accent, shadowOpacity: 0.3, shadowRadius: 26, shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Text style={{ fontSize: 44 }}>{emoji}</Text>
        </View>

        <Text style={{ color: "#fff", fontSize: 26, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 24, textAlign: "center", letterSpacing: -0.4 }}>
          {title}
        </Text>
        <Text style={{ color: theme.secondaryText, fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 10, textAlign: "center", lineHeight: 21, maxWidth: 320 }}>
          {blurb}
        </Text>

        {perks.length ? (
          <View style={{ marginTop: 24, alignSelf: "stretch", gap: 12 }}>
            {perks.map((p) => (
              <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(56,225,198,0.16)", borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: theme.accent, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓</Text>
                </View>
                <Text style={{ flex: 1, color: theme.text, fontSize: 14, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 20 }}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <GradientButton label="See Premium" icon="star" onPress={onOpenPremium} style={{ marginTop: 32, alignSelf: "stretch" }} />
      </View>
    </ScrollView>
  );
}
