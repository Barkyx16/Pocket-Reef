import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { HeroBanner } from "../components/HeroBanner";
import { GradientButton } from "../components/GradientButton";

// A self-contained Premium tab: what's included, a plan picker, the unlock CTA,
// and — at the very bottom — a developer toggle to unlock/lock the gate while
// building (wire RevenueCat in a real dev build to replace it).
const FEATURES = [
  { icon: "🐠", title: "Unlimited tanks", body: "Plan and track every aquarium you keep." },
  { icon: "📈", title: "Parameter trends & alerts", body: "Charts for each reading, with drift warnings." },
  { icon: "🤝", title: "Advanced compatibility", body: "Full pairing reasons and stocking limits." },
  { icon: "🩺", title: "Complete disease library", body: "Every illustrated guide, plus symptom lookup." },
  { icon: "🔔", title: "Smart care reminders", body: "Water tests, changes, and feedings on schedule." },
  { icon: "☁️", title: "Cloud backup & sync", body: "Your tanks, logs, and journal safe across devices." },
];

const PLANS = [
  { id: "monthly", name: "Monthly", price: "$2.99", per: "/mo", badge: "POPULAR", badgeBg: theme.accent, badgeColor: "#04202a" },
  { id: "yearly", name: "Yearly", price: "$19.99", per: "/yr", badge: "BEST VALUE", badgeBg: theme.warn, badgeColor: "#3d2c00", save: "Save 44%" },
];

export function PremiumTab({ premiumUnlocked, onSetPremium }) {
  const [plan, setPlan] = useState("yearly");

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={premiumUnlocked ? "Premium active" : "Premium"}
        title={premiumUnlocked ? "You're all in 🐠" : "Keep a healthier reef"}
        subtitle={premiumUnlocked ? "Every feature is unlocked — thanks for supporting Pocket Reef." : "Unlock the full toolkit to plan, stock, and keep thriving tanks."}
        emoji="👑"
        colors={["#3a2f12", "#20320f", "#08202f"]}
      />

      {/* Active banner */}
      {premiumUnlocked ? (
        <View style={[styles.cardElevated, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <Text style={{ fontSize: 26 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Premium is active</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "700", marginTop: 2 }}>Everything below is unlocked and ready to use.</Text>
          </View>
        </View>
      ) : null}

      {/* Everything included */}
      <View style={styles.card}>
        <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Everything included</Text>
        <View style={{ gap: 12 }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{f.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{f.title}</Text>
                  {premiumUnlocked ? <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "900" }}>✓</Text> : null}
                </View>
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", marginTop: 1, lineHeight: 17 }}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Plan selector + CTA (only until unlocked) */}
      {!premiumUnlocked ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Choose your plan</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {PLANS.map((p) => {
              const on = plan === p.id;
              return (
                <Pressable key={p.id} onPress={() => setPlan(p.id)} style={({ pressed }) => [{ flex: 1, borderRadius: 16, padding: 14, backgroundColor: on ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.05)", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border }, pressed && { opacity: 0.9 }]} accessibilityRole="button">
                  <View style={{ alignSelf: "flex-start", backgroundColor: p.badgeBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 }}>
                    <Text style={{ color: p.badgeColor, fontSize: 9, fontWeight: "900" }}>{p.badge}</Text>
                  </View>
                  <Text style={{ color: on ? theme.accent : "#fff", fontSize: 15, fontWeight: "900" }}>{p.name}</Text>
                  <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 2, fontVariant: ["tabular-nums"] }}>{p.price}<Text style={{ color: theme.secondaryText, fontSize: 12 }}> {p.per}</Text></Text>
                  {p.save ? <View style={{ marginTop: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,216,107,0.16)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: theme.warn, fontSize: 10, fontWeight: "900" }}>{p.save}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
          <GradientButton label="Unlock Premium" onPress={() => onSetPremium(true)} style={{ marginTop: 16 }} />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12 }}>
            {[["🔒", "Secure"], ["↩️", "Cancel anytime"], ["☁️", "Cloud sync"]].map(([i, l]) => (
              <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={{ fontSize: 13 }}>{i}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "800" }}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Developer toggle */}
      <View style={{ borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.18)", padding: 14, marginBottom: 4 }}>
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>🔧 Developer</Text>
        <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 17 }}>
          Toggle the premium gate for testing. This stands in for the real store purchase.
        </Text>
        <Pressable
          onPress={() => onSetPremium(!premiumUnlocked)}
          style={({ pressed }) => [{ marginTop: 12, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, backgroundColor: premiumUnlocked ? "rgba(255,123,123,0.10)" : "rgba(56,225,198,0.10)", borderColor: premiumUnlocked ? "rgba(255,123,123,0.4)" : "rgba(56,225,198,0.4)" }, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: premiumUnlocked ? theme.danger : theme.accent, fontSize: 14, fontWeight: "900" }}>
            {premiumUnlocked ? "🔒 Lock premium (dev)" : "🔓 Unlock premium (dev)"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
