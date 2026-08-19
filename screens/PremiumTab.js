import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme, useResponsiveLayout, radius, type, space } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HeroBanner } from "../components/HeroBanner";
import { GradientButton } from "../components/GradientButton";
import { useScrollToTop } from "../lib/scrollToTop";
import { usingTestKeys } from "../lib/purchases";

// A self-contained Premium tab: what's included, a plan picker, the unlock CTA,
// and — at the very bottom — a developer toggle to unlock/lock the gate while
// building (wire RevenueCat in a real dev build to replace it).
// Vector icons here matter more than anywhere else: this is the screen that
// asks for money, and six mismatched emoji in accent squares undercut it.
const FEATURES = [
  { icon: "fish-outline", title: "Unlimited tanks", body: "Plan and track every aquarium you keep." },
  { icon: "analytics-outline", title: "Trends, forecasts & stability", body: "Charts per reading, a date on the next problem, and a grade for how steady you hold it." },
  { icon: "bulb-outline", title: "Answers, not just numbers", body: "Why a reading won't come down, what your algae is feeding on, how often to test each parameter." },
  { icon: "grid-outline", title: "Advanced compatibility", body: "Full pairing reasons, stocking limits, and your wishlist simulated against your real tank." },
  { icon: "medkit-outline", title: "Complete health toolkit", body: "Every illustrated guide, symptom lookup, and medication doses on your real water volume." },
  { icon: "notifications-outline", title: "Smart care reminders", body: "Cadence reminders, plus an alert before a parameter leaves its safe range." },
  { icon: "cloud-outline", title: "Cloud sync & restore points", body: "Your tanks and logs across devices, merged rather than overwritten, with local snapshots." },
];

// Legal links are not optional: App Store review rejects a subscription
// paywall that doesn't surface terms, privacy, and the auto-renew disclosure.
const TERMS_URL = "https://pocketplanter.app/terms";
const PRIVACY_URL = "https://pocketplanter.app/privacy";

// Works out the yearly saving from the real store prices, so the badge can't
// advertise a discount that doesn't exist.
function savingLabel(plans) {
  const monthly = plans.find((p) => !p.annual);
  const annual = plans.find((p) => p.annual);
  if (!monthly || !annual || !monthly.price || !annual.price) return null;
  const pct = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

// The paywall answers the question the user just asked. A wall that says
// "you tried to add a 6th fish" converts far better than one that says
// "upgrade for more features" — it's already about them.
const REASON_COPY = {
  stockCap: { eyebrow: "You've filled the free tank", title: "Room for the whole tank", subtitle: "Free saves 5 fish. Premium is unlimited — plus live compatibility and bioload as you stock." },
  species: { eyebrow: "309 more species", title: "The full catalog", subtitle: "Free previews 7. Premium opens all 316 with care guides, compatibility, and your wishlist." },
  disease: { eyebrow: "Something looks wrong?", title: "Find out what it is", subtitle: "Every illustrated disease guide, a symptom checker, and an emergency troubleshooter." },
  tankIdea: { eyebrow: "One-tap stocking", title: "22 tanks, already planned", subtitle: "Curated stocking plans verified conflict-free — load one and you're done." },
  secondTank: { eyebrow: "More than one tank?", title: "Track them all", subtitle: "Premium keeps unlimited tanks, each with its own stock, water history, and journal." },
  tank: { eyebrow: "Your tank", title: "See the whole picture", subtitle: "Live compatibility, bioload, the stocking planner, and your ideal parameter window." },
  log: { eyebrow: "Your logbook", title: "Track it, then understand it", subtitle: "Trends and forecasts, stability grading, and the tap-water ceiling on your water changes." },
  health: { eyebrow: "Health toolkit", title: "Know what to do", subtitle: "Disease guides, a symptom checker, algae diagnosed from your own readings, and medication doses on your real volume." },
  journal: { eyebrow: "Your journal", title: "Remember every stage", subtitle: "A dated, searchable photo record of your tank — backed up to your account." },
  games: { eyebrow: "Reef games", title: "Play and learn", subtitle: "Every mini-game, with XP toward your reef-keeper level." },
  // No `profile` entry: Profile is a free tab now, so nothing routes here for
  // it. Account, settings, export and deletion are not things to sell back.
  analysis: { eyebrow: "Beyond the numbers", title: "Understand your readings", subtitle: "Stability grading, forecasts, and why a reading won't come down — worked out from your own log." },
};

export function PremiumTab({ premiumUnlocked, onSetPremium, onPurchase, onRestore, storeReady = false, buying = false, loadPlans, reason }) {
  const scrollRef = useScrollToTop();
  // The shell is wider now that most screens reflow into two columns; this
  // one doesn't, so it keeps a readable line length instead of stretching.
  const layout = useResponsiveLayout();
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Pull real, localized prices from the store.
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = loadPlans ? await loadPlans() : [];
      if (!alive) return;
      setPlans(list);
      // Default to yearly — it's the better deal and the better retention.
      setPlan((list.find((p) => p.annual) || list[0] || null));
      setLoadingPlans(false);
    })();
    return () => { alive = false; };
  }, [loadPlans, storeReady]);

  const ctx = reason ? REASON_COPY[reason] : null;
  // storeReady only means the SDK configured. Without a fetched package there
  // is nothing to buy, and labelling the button "Unlock Premium" in that state
  // produced a dead CTA — the worst possible thing on a paywall.
  const canBuy = storeReady && !loadingPlans && plans.length > 0 && !!plan;
  const save = savingLabel(plans);
  const trialDays = plan && plan.freeTrialDays ? plan.freeTrialDays : 0;

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, layout.contentStyle]} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={premiumUnlocked ? "Premium active" : ctx ? ctx.eyebrow : "Premium"}
        title={premiumUnlocked ? "You're all in 🐠" : ctx ? ctx.title : "Keep a healthier reef"}
        subtitle={premiumUnlocked ? "Every feature is unlocked — thanks for supporting Pocket Reef." : ctx ? ctx.subtitle : "Unlock the full toolkit to plan, stock, and keep thriving tanks."}
        emoji="👑"
        colors={["#3a2f12", "#20320f", "#08202f"]}
      />

      {/* Active banner */}
      {premiumUnlocked ? (
        <View style={[styles.cardElevated, { flexDirection: "row", alignItems: "center", gap: space.md }]}>
          <Text style={{ fontSize: 26, letterSpacing: -0.4 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>Premium is active</Text>
            <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.hair }}>Everything below is unlocked and ready to use.</Text>
          </View>
        </View>
      ) : null}

      {/* Everything included */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: space.md }]}>Everything included</Text>
        <View style={{ gap: space.md }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <View style={styles.iconSquare}><Ionicons name={f.icon} size={16} color={theme.accent} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{f.title}</Text>
                  {premiumUnlocked ? <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓</Text> : null}
                </View>
                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.hair, lineHeight: 17 }}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Plan selector + CTA (only until unlocked) */}
      {!premiumUnlocked ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: space.md }]}>Choose your plan</Text>
          <View style={{ flexDirection: "row", gap: space.md }}>
            {plans.map((p) => {
              const on = plan && plan.id === p.id;
              const badge = p.annual ? "BEST VALUE" : "POPULAR";
              const badgeBg = p.annual ? theme.warn : theme.accent;
              const badgeColor = p.annual ? "#3d2c00" : theme.onAccent;
              return (
                <Pressable key={p.id} onPress={() => setPlan(p)} style={({ pressed }) => [{ flex: 1, borderRadius: radius.xl, padding: space.lg, backgroundColor: on ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.05)", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border }, pressed && { opacity: 0.9 }]} accessibilityRole="button">
                  <View style={{ alignSelf: "flex-start", backgroundColor: badgeBg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.hair, marginBottom: space.sm }}>
                    <Text style={{ color: badgeColor, fontSize: 9, letterSpacing: 0.6, fontFamily: "Inter_900Black", fontWeight: "900" }}>{badge}</Text>
                  </View>
                  <Text style={{ color: on ? theme.accent : "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.name}</Text>
                  {/* Localized and formatted by the store — never hardcoded. */}
                  <Text style={{ color: "#fff", fontSize: 22, letterSpacing: -0.4, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.hair, fontVariant: ["tabular-nums"] }}>{p.priceString}<Text style={{ color: theme.secondaryText, fontSize: type.small }}> {p.per}</Text></Text>
                  {p.annual && save ? <View style={{ marginTop: space.sm, alignSelf: "flex-start", backgroundColor: "rgba(255,216,107,0.16)", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.hair }}><Text style={{ color: theme.warn, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{save}</Text></View> : null}
                  {p.freeTrialDays ? <Text style={{ color: theme.accent, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.sm }}>{p.freeTrialDays} days free</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {loadingPlans ? (
            <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", marginTop: space.lg }}>Loading plans…</Text>
          ) : !plans.length ? (
            <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", marginTop: space.lg, lineHeight: 18 }}>
              {usingTestKeys()
                ? "This build uses RevenueCat sandbox keys, so no products load. Swap in the production keys before shipping."
                : "Plans aren't available right now. Check your connection and try again."}
            </Text>
          ) : null}
          <GradientButton
            label={
              buying ? "Opening…"
                : loadingPlans ? "Loading…"
                : !canBuy ? "Unavailable right now"
                : trialDays ? `Start ${trialDays} days free`
                : "Unlock Premium"
            }
            onPress={() => canBuy && !buying && onPurchase && onPurchase(plan)}
            style={{ marginTop: space.lg, opacity: canBuy && !buying ? 1 : 0.55 }}
          />
          {!storeReady ? (
            <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", marginTop: space.sm, lineHeight: 16 }}>
              In-app purchases need a device build — they don't run in Expo Go.
            </Text>
          ) : null}
          {/* The App Store requires restore to be reachable, and it's how a
              reinstall or a new device gets an existing subscription back. */}
          <Pressable onPress={() => onRestore && onRestore()} style={({ pressed }) => [{ marginTop: space.md, paddingVertical: space.sm }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textAlign: "center" }}>Restore purchases</Text>
          </Pressable>
          {/* Auto-renew disclosure. App Store review requires this verbatim-ish
              wording next to the CTA, along with reachable terms and privacy. */}
          <Text style={{ color: theme.bodyText, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", textAlign: "center", marginTop: space.md, lineHeight: 15 }}>
            {plan
              ? `${trialDays ? `Free for ${trialDays} days, then ` : ""}${plan.priceString}${plan.per}. `
              : ""}
            Subscriptions renew automatically unless cancelled at least 24 hours before the period
            ends. Manage or cancel in your App Store settings.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: space.xl, marginTop: space.sm }}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} hitSlop={8} accessibilityRole="link" accessibilityLabel="Terms of use, opens in your browser">
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textDecorationLine: "underline" }}>Terms</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} hitSlop={8} accessibilityRole="link" accessibilityLabel="Privacy policy, opens in your browser">
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textDecorationLine: "underline" }}>Privacy</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg, marginTop: space.md }}>
            {[["", "Secure"], ["", "Cancel anytime"], ["", "Cloud sync"]].map(([i, l]) => (
              <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                <Text style={{ fontSize: type.body }}>{i}</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Developer toggle — __DEV__ only. This must never ship in a release
          build: a premium switch the app can flip is a premium switch anyone
          can flip. Entitlement in production comes from RevenueCat alone. */}
      {__DEV__ ? (
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.18)", padding: space.lg, marginBottom: space.xs }}>
        <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>🔧 Developer</Text>
        <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.xs, lineHeight: 17 }}>
          Toggle the premium gate for testing. Debug builds only — stripped from release.
        </Text>
        <Pressable
          onPress={() => onSetPremium && onSetPremium(!premiumUnlocked)}
          style={({ pressed }) => [{ marginTop: space.md, borderRadius: radius.lg, paddingVertical: space.md, alignItems: "center", borderWidth: 1, backgroundColor: premiumUnlocked ? "rgba(255,123,123,0.10)" : "rgba(56,225,198,0.10)", borderColor: premiumUnlocked ? "rgba(255,123,123,0.4)" : "rgba(56,225,198,0.42)" }, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: premiumUnlocked ? theme.danger : theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {premiumUnlocked ? " Lock premium (dev)" : "🔓 Unlock premium (dev)"}
          </Text>
        </Pressable>
      </View>
      ) : null}
    </ScrollView>
  );
}
