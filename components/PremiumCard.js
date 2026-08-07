import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { GradientButton } from "./GradientButton";

// The full premium page — the reef version of Pocket Planter's premium design
// (hero + stat row + features grid + plan selector + CTA + trust badges).
// DESIGN-FIRST: `onUnlock` is a mock for now; wire RevenueCat in a dev build.
// When `premiumUnlocked` is true it renders the compact "active" state instead,
// meant to sit at the very bottom of the Profile tab.
const FEATURES = [
  { icon: "🐠", title: "Unlimited tanks", body: "Plan and track as many aquariums as you keep." },
  { icon: "🤝", title: "Advanced compatibility", body: "Full pairing reasons, stocking limits, and conflict fixes." },
  { icon: "🩺", title: "Complete disease library", body: "Every illustrated guide, plus symptom lookup." },
  { icon: "📈", title: "Parameter trends & alerts", body: "Charts and warnings when a reading drifts the wrong way." },
  { icon: "🔔", title: "Smart care reminders", body: "Water tests, changes, and feedings — never miss one." },
  { icon: "☁️", title: "Cloud backup & sync", body: "Your tanks, logs, and journal safe across devices." },
];
const TRUST = [{ icon: "🔒", label: "Secure" }, { icon: "↩️", label: "Cancel anytime" }, { icon: "☁️", label: "Cloud sync" }];

export function PremiumCard({ premiumUnlocked, onUnlock }) {
  const [plan, setPlan] = useState("yearly");

  // ── Active state (bottom of Profile) ──
  if (premiumUnlocked) {
    return (
      <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 26 }}>👑</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>Premium active</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" }}>Thanks for supporting Pocket Reef — every feature is unlocked.</Text>
          </View>
        </View>
        <Pressable onPress={() => tapHaptic()} style={[styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Manage subscription</Text>
        </Pressable>
      </View>
    );
  }

  // ── Paywall (prominent) ──
  return (
    <View>
      {/* HERO */}
      <View style={{ borderRadius: 26, padding: 24, overflow: "hidden", borderWidth: 1, borderColor: theme.border, marginBottom: 14 }}>
        <LinearGradient colors={["#0e3a52", "#0a2c42", "#082031"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", right: -50, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,211,114,0.16)" }} />
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(56,225,198,0.16)", borderWidth: 1, borderColor: "rgba(56,225,198,0.3)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 30 }}>👑</Text>
          </View>
          <Text style={{ color: theme.accentLight, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 1, marginTop: 12 }}>POCKET REEF PREMIUM</Text>
          <Text style={{ color: "#fff", fontSize: 26, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 6, textAlign: "center" }}>Keep a healthier reef.</Text>
          <Text style={{ color: "#cfe9f5", fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 6, textAlign: "center", lineHeight: 19 }}>Everything you need to plan, stock, and keep thriving tanks.</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }}>
          {[{ v: "300+", l: "Species" }, { v: "∞", l: "Tanks" }, { v: "Cancel", l: "Anytime" }].map((s, i) => (
            <View key={s.l} style={{ flex: 1, alignItems: "center", borderLeftWidth: i ? 1 : 0, borderLeftColor: theme.border }}>
              <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s.v}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* FEATURES GRID */}
      <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 14 }}>
        <Text style={styles.cardEyebrow}>EVERYTHING INCLUDED</Text>
        <View style={{ gap: 14, marginTop: 10 }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{f.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>{f.title}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 17 }}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* PLAN SELECTOR */}
      <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.accent }}>
        <Text style={styles.cardEyebrow}>CHOOSE YOUR PLAN</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          {[
            { id: "monthly", name: "Monthly", price: "$2.99", per: "/ mo", badge: "POPULAR", badgeBg: theme.accent, badgeColor: "#04202a" },
            { id: "yearly", name: "Yearly", price: "$19.99", per: "/ yr", badge: "BEST VALUE", badgeBg: theme.warn, badgeColor: "#3d2c00", save: "Save 44%" },
          ].map((p) => {
            const on = plan === p.id;
            return (
              <Pressable key={p.id} onPress={() => { tapHaptic(); setPlan(p.id); }} style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: on ? "rgba(56,225,198,0.16)" : "rgba(255,255,255,0.05)", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border }}>
                <View style={{ alignSelf: "flex-start", backgroundColor: p.badgeBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 }}>
                  <Text style={{ color: p.badgeColor, fontSize: 9, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.badge}</Text>
                </View>
                {on ? <View style={{ position: "absolute", top: 12, right: 12 }}><Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓</Text></View> : null}
                <Text style={{ color: on ? theme.accent : "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.name}</Text>
                <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 2 }}>{p.price}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{p.per}</Text>
                {p.save ? <View style={{ marginTop: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,216,107,0.16)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: theme.warn, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.save}</Text></View> : null}
              </Pressable>
            );
          })}
        </View>

        <GradientButton label="Unlock Premium" onPress={() => onUnlock && onUnlock(plan)} style={{ marginTop: 16 }} />
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", marginTop: 10 }}>Cancel anytime. (Demo unlock — wire RevenueCat in a dev build.)</Text>

        {/* TRUST BADGES */}
        <View style={{ flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }}>
          {TRUST.map((tItem, i) => (
            <View key={tItem.label} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 16 }}>{tItem.icon}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{tItem.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
