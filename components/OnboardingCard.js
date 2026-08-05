import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { GradientButton } from "./GradientButton";
import { Pill } from "./Pill";

// First-run onboarding — the reef version of Pocket Planter's welcome flow.
// Feature slides → tank setup → a Premium showcase finale. Shown once (App
// persists a seen flag).
const SLIDES = [
  {
    emoji: "🐠", eyebrow: "Welcome to Pocket Reef", title: "Build a reef\nthat thrives",
    text: "Plan a tank where every fish, invert, and coral gets along — then keep it healthy.",
    features: [
      { icon: "🔎", title: "316 species", text: "Fish, inverts & corals with full care data." },
      { icon: "🤝", title: "Smart compatibility", text: "Know what can live together before you buy." },
    ],
  },
  {
    emoji: "🌊", eyebrow: "Plan with confidence", title: "Stock it\nthe right way",
    text: "Take the guesswork out of a balanced, beautiful tank.",
    features: [
      { icon: "📊", title: "Bioload & stocking", text: "See how full your tank is at a glance." },
      { icon: "💡", title: "Ready-made setups", text: "One-tap, conflict-free tank builds." },
      { icon: "🌡️", title: "Ideal water window", text: "The temp & pH that keeps everyone happy." },
    ],
  },
  {
    emoji: "🧪", eyebrow: "Build the habit", title: "Test, log,\nlevel up",
    text: "Small daily touches keep your reef thriving — and it's fun.",
    features: [
      { icon: "🧪", title: "Water testing", text: "Graded vs the safe range, fresh & reef." },
      { icon: "📓", title: "Journal & photos", text: "A visual history of your tank." },
      { icon: "🔥", title: "Streaks & XP", text: "Grow from Fry to Reef Master." },
    ],
  },
];

const PREMIUM = [
  { icon: "🐠", title: "Unlimited tanks", text: "Plan and track every aquarium you keep." },
  { icon: "📈", title: "Parameter trends & alerts", text: "Charts for each reading, with drift warnings." },
  { icon: "🤝", title: "Advanced compatibility", text: "Full pairing reasons and stocking limits." },
  { icon: "🩺", title: "Complete disease library", text: "Every illustrated guide, plus symptom lookup." },
  { icon: "🔔", title: "Smart care reminders", text: "Water tests, changes & feedings on schedule." },
  { icon: "☁️", title: "Cloud backup & sync", text: "Your tanks & logs safe across devices." },
];

const TANK_PRESETS = [5, 10, 20, 30, 55, 75, 125];

export function OnboardingCard({ onFinish, onStartPremium }) {
  const [step, setStep] = useState(0);
  const [gallons, setGallons] = useState(20);
  const [water, setWater] = useState("fresh");

  const total = SLIDES.length + 2; // feature slides + size + premium
  const sizeStep = SLIDES.length;
  const premiumStep = SLIDES.length + 1;
  const isSize = step === sizeStep;
  const isPremium = step === premiumStep;
  const current = SLIDES[step];

  const finish = () => onFinish({ gallons, water });
  const hero = isPremium
    ? { emoji: "👑", eyebrow: "One more thing", title: "Go Premium", text: "Unlock the full reef toolkit — free to try anytime.", colors: ["#3a2f12", "#20320f", "#08202f"], glow: "rgba(255,211,114,0.20)" }
    : isSize
      ? { emoji: "📏", eyebrow: "Last bit of setup", title: "Your tank", text: "Pick your water type and size — you can change it anytime.", colors: ["#0e3a52", "#0a2c42", "#082031"], glow: "rgba(56,225,198,0.20)" }
      : { emoji: current.emoji, eyebrow: current.eyebrow, title: current.title, text: current.text, colors: ["#0e3a52", "#0a2c42", "#082031"], glow: "rgba(56,225,198,0.20)" };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <LinearGradient colors={["#0a2f45", "#08243a", "#061826", "#04101b"]} locations={[0, 0.35, 0.7, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
          {/* HERO */}
          <View style={styles.heroBanner}>
            <LinearGradient colors={hero.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", right: -60, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: hero.glow }} />
            <Text style={{ position: "absolute", right: -6, top: -24, fontSize: 150, opacity: 0.16 }}>{hero.emoji}</Text>
            <View style={styles.heroEyebrowPill}><Text style={styles.heroEyebrow}>{hero.eyebrow}</Text></View>
            <Text style={[styles.heroTitle, { fontSize: 32 }]}>{hero.title}</Text>
            <Text style={styles.heroSub}>{hero.text}</Text>
          </View>

          {/* BODY */}
          {isPremium ? (
            <View style={styles.card}>
              <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Everything Premium unlocks</Text>
              <View style={{ gap: 12 }}>
                {PREMIUM.map((f) => (
                  <View key={f.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                    <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{f.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{f.title}</Text>
                      <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", marginTop: 1, lineHeight: 17 }}>{f.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : isSize ? (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>Water type</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {[{ id: "fresh", label: "💧 Freshwater" }, { id: "salt", label: "🌊 Saltwater" }].map((w) => (
                  <Pill key={w.id} fill label={w.label} active={water === w.id} onPress={() => setWater(w.id)} />
                ))}
              </View>
              <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>Tank size</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {TANK_PRESETS.map((g) => (
                  <Pill key={g} label={`${g} gal`} active={gallons === g} onPress={() => setGallons(g)} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              {current.features.map((f) => (
                <View key={f.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <View style={styles.iconSquare}><Text style={{ fontSize: 16 }}>{f.icon}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{f.title}</Text>
                    <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", marginTop: 2 }}>{f.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* DOTS */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 16 }}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 999, backgroundColor: i === step ? theme.accent : "rgba(255,255,255,0.2)" }} />
            ))}
          </View>

          {/* ACTIONS */}
          {isPremium ? (
            <>
              <GradientButton label="Start Premium 👑" onPress={() => { onStartPremium && onStartPremium(); finish(); }} />
              <Pressable onPress={finish} style={{ alignItems: "center", paddingVertical: 14 }} accessibilityRole="button">
                <Text style={{ color: theme.secondaryText, fontSize: 14, fontWeight: "800" }}>Continue with the free version</Text>
              </Pressable>
            </>
          ) : (
            <>
              <GradientButton label={isSize ? "Almost there →" : "Next"} onPress={() => setStep((s) => s + 1)} />
              <Pressable onPress={finish} style={{ alignItems: "center", paddingVertical: 14 }} accessibilityRole="button">
                <Text style={{ color: theme.secondaryText, fontSize: 14, fontWeight: "800" }}>Skip</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
