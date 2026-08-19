import { Text, View } from "react-native";
import { theme, type } from "../styles";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// A consistent, friendly empty state — a soft glowing emoji medallion over a
// short headline and hint. Used wherever a list or tank has nothing yet.
export function EmptyState({ emoji = "🐠", title, subtitle }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 24, paddingHorizontal: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(56,225,198,0.10)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center", shadowColor: theme.accent, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: 34 }}>{emoji}</Text>
      </View>
      {title ? <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 14, textAlign: "center" }}>{title}</Text> : null}
      {subtitle ? <Text style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 19, maxWidth: 300 }}>{subtitle}</Text> : null}
    </View>
  );
}
