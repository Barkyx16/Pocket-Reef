import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { styles, theme } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { iconForEmoji } from "../lib/icons";
import { getSpecies, getTankWarnings, getStreak, getTodayActions, getWeeklyActivity, getTodayKey, getDailyChallenges, getSeasonalChallenges, getTankHealthScore, SPECIES, tapHaptic, successHaptic } from "../core";
import { PremiumTeaserCard } from "../components/PremiumTeaserCard";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { SpeciesCard } from "../components/SpeciesCard";
import { TodayCard } from "../components/TodayCard";
import { TankOverviewCard } from "../components/TankOverviewCard";
import { FishOfDayCard } from "../components/FishOfDayCard";
import { t } from "../lib/i18n";

const CARE_TASKS = [
  { id: "feed", icon: "🍤", text: "Feed the tank (small pinch)" },
  { id: "test", icon: "🧪", text: "Test water — ammonia, nitrite, nitrate" },
  { id: "topoff", icon: "💧", text: "Top off evaporation with fresh water" },
  { id: "observe", icon: "👀", text: "Watch for stress, spots, or nipping" },
];

export function HomeTab({ tankGallons, tank, toggleTank, openSpecies, activeDays = [], xp = 0, waterTests = [], journal = [], feedings = [], careDoneToday = [], onToggleCare, maintenance = {}, quarantine = [], tankWater, tanks = [], activeTankId, onSwitchTank, onEditTank, onAddTank, onDeleteTank, onDuplicateTank, onExport, onImport, premiumUnlocked, onOpenPremium, reminderPrefs, onChangeReminders, lang = "en", onSetLanguage, unit = "imperial", onSetUnit, onGoToTab, wishlist = [], onToggleWishlist, quantities = {}, profileName = "", fishOfDaySeen = false, onSeeFishOfDay, challengesDone = [], onCompleteChallenge, treatments = [] }) {
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}${profileName ? `, ${profileName}` : ""}`;
  const today = getTodayKey();
  const streak = getStreak(activeDays);
  const loggedToday = activeDays.includes(today);
  const wishSpecies = wishlist.map(getSpecies).filter(Boolean);
  const weekly = getWeeklyActivity({ waterTests, journal, activeDays });
  const warnings = getTankWarnings(tankGallons, tank, quantities);
  const doneCount = CARE_TASKS.filter((t) => careDoneToday.includes(t.id)).length;
  const todayActions = getTodayActions({ tank, waterTests, maintenance, quarantine, careDoneCount: doneCount, careTotal: CARE_TASKS.length, reminderPrefs, quantities , waterType: tankWater, treatments });

  // Challenges auto-complete based on today's activity, then disappear.
  const doneMap = {
    test: !!(waterTests[0] && waterTests[0].date === today),
    journal: journal.some((e) => e.date === today),
    feed: feedings.some((f) => f.date === today),
    care: doneCount >= CARE_TASKS.length,
    maintain: Object.values(maintenance || {}).some((v) => typeof v === "string" && v.slice(0, 10) === today),
    change: !!(maintenance && maintenance.waterchange && String(maintenance.waterchange).slice(0, 10) === today),
    fod: fishOfDaySeen,
    active: activeDays.includes(today),
  };
  const CHALLENGE_TO = { test: "log", journal: "journal", feed: "log", maintain: "log", change: "log" };
  const challengeDone = (c) => doneMap[c.signal] || challengesDone.includes(c.id);
  // Today's challenges are shown in full, done or not.
  //
  // Filtering completed ones out meant the list shortened the instant you
  // ticked a box — every card below slid up by a row height, mid-tap, which is
  // exactly the "page jumps around" complaint. Nothing here is stateful: the
  // challenge set is seeded by date and challengesDone is stored against
  // today's key, so tomorrow brings a fresh set and a clean slate on its own.
  const allDaily = getDailyChallenges(today);
  const dailyChallenges = allDaily;
  const seasonal = getSeasonalChallenges(today);
  const seasonalChallenges = seasonal.items;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={greeting}
        title={t("home.title")}
        subtitle={t("home.sub")}
        emoji="🐠"
        colors={["#0f3d55", "#0a2c44", "#071d2e"]}
      />

      {/* STREAK AT RISK */}
      {streak > 0 && !loggedToday ? (
        <Pressable onPress={() => { tapHaptic(); onGoToTab && onGoToTab("log"); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,216,107,0.10)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,216,107,0.4)", padding: 14, marginBottom: 14 }} accessibilityRole="button">
          <Text style={{ fontSize: 22 }}>🔥</Text>
          <Text style={{ flex: 1, color: theme.warn, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18 }}>Keep your {streak}-day streak alive — log a water test or journal note today.</Text>
          <Text style={{ color: theme.warn, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
        </Pressable>
      ) : null}

      {/* DAILY CHALLENGES — auto-complete & disappear; fresh set every day */}
      {allDaily.length ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { marginBottom: 4 }]}>Daily Challenges</Text>
          <Text style={[styles.cardText, { marginTop: 0, marginBottom: 10 }]}>Complete them today — a fresh set arrives tomorrow.</Text>
          <View style={{ gap: 8 }}>
            {dailyChallenges.map((c) => (
              <ChallengeRow key={c.id} c={c} onNavigate={CHALLENGE_TO[c.signal] && onGoToTab ? () => onGoToTab(CHALLENGE_TO[c.signal]) : undefined} done={challengeDone(c)} onComplete={onCompleteChallenge ? () => onCompleteChallenge(c.id) : undefined} />
            ))}
          </View>
        </View>
      ) : null}

      {/* SEASONAL CHALLENGES */}
      {seasonalChallenges.length ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { marginBottom: 4 }]}>{seasonal.label} Challenges</Text>
          <Text style={[styles.cardText, { marginTop: 0, marginBottom: 10 }]}>Seasonal goals for your reef — refresh daily.</Text>
          <View style={{ gap: 8 }}>
            {seasonalChallenges.map((c) => (
              <ChallengeRow key={c.id} c={c} onNavigate={CHALLENGE_TO[c.signal] && onGoToTab ? () => onGoToTab(CHALLENGE_TO[c.signal]) : undefined} done={challengeDone(c)} onComplete={onCompleteChallenge ? () => onCompleteChallenge(c.id) : undefined} />
            ))}
          </View>
        </View>
      ) : null}

      {/* What Premium is holding — their real numbers, not a generic pitch. */}
      {!premiumUnlocked ? (
        <PremiumTeaserCard
          warnings={warnings}
          healthScore={getTankHealthScore({ tank, tankGallons, waterTests, maintenance, quantities }).score}
          tankName={(tanks.find((t) => t.id === activeTankId) || {}).name || "your tank"}
          lockedSpecies={Math.max(0, SPECIES.length - 7)}
          onOpenPremium={onOpenPremium}
        />
      ) : null}

      {/* TODAY — only shown when something actually needs attention */}
      {todayActions.length ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { marginBottom: 10 }]}>Needs Attention</Text>
          <TodayCard actions={todayActions} onNavigate={onGoToTab} />
        </View>
      ) : null}

      {/* ALL TANKS OVERVIEW (multi-tank) */}
      {tanks.length > 1 ? (
        <CollapsibleCard storageKey="alltanks" title="🗂️ All My Tanks" eyebrow={`${tanks.length} tanks`}>
          <TankOverviewCard tanks={tanks} activeTankId={activeTankId} onSwitch={onSwitchTank} />
        </CollapsibleCard>
      ) : null}

      {/* FISH OF THE DAY — disappears once viewed; a new fish returns tomorrow. */}
      {!fishOfDaySeen ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Fish of the Day</Text>
          <FishOfDayCard onOpenSpecies={(n) => { onSeeFishOfDay && onSeeFishOfDay(); openSpecies(n); }} />
        </View>
      ) : null}

      {/* THIS WEEK */}
      <View style={styles.card}>
        <Text style={[styles.cardEyebrow, { marginBottom: 10 }]}>This Week</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Summary label="Active days" value={`${weekly.activeDays}/7`} color={weekly.activeDays >= 5 ? theme.accent : "#fff"} />
          <Summary label="Water tests" value={`${weekly.tests}`} />
          <Summary label="Journal notes" value={`${weekly.journal}`} />
        </View>
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 10, textAlign: "center" }}>
          {weekly.activeDays >= 5 ? "Great consistency this week — your reef thanks you! 🐠" : weekly.activeDays === 0 ? "Log a test or a note to start this week off." : "Keep the momentum going — small daily touches add up."}
        </Text>
      </View>

      {/* TODAY'S CARE — tap to check off; card disappears when all done, back tomorrow. */}
      {doneCount < CARE_TASKS.length ? (
        <CollapsibleCard storageKey="care" title="✅ Today's Care" defaultOpen={true} eyebrow={`${doneCount}/${CARE_TASKS.length} done`}>
          <View style={{ gap: 8 }}>
            {CARE_TASKS.filter((task) => !careDoneToday.includes(task.id)).map((task) => (
              <Pressable
                key={task.id}
                onPress={() => onToggleCare && onToggleCare(task.id)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.04)", borderColor: theme.border }, pressed && { opacity: 0.7, backgroundColor: "rgba(56,225,198,0.10)", borderColor: theme.accent }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 2, borderColor: theme.border }}>
                  <Text style={{ fontSize: 13, color: theme.secondaryText, fontFamily: "Inter_900Black", fontWeight: "900" }}>{task.icon}</Text>
                </View>
                <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{task.text}</Text>
              </Pressable>
            ))}
          </View>
        </CollapsibleCard>
      ) : null}

      {/* WISHLIST */}
      {wishSpecies.length ? (
        <CollapsibleCard storageKey="wishlist" title="❤️ Wishlist" eyebrow={`${wishSpecies.length} saved`}>
          {wishSpecies.map((s) => (
            <SpeciesCard
              key={s.name}
              species={s}
              onPress={() => openSpecies(s.name)}
              inTank={tank.includes(s.name)}
              onToggleTank={toggleTank ? () => toggleTank(s.name) : undefined}
              inWishlist={true}
              onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(s.name) : undefined}
            />
          ))}
        </CollapsibleCard>
      ) : null}

      {/* WARNINGS */}
      {warnings.length ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, { color: theme.warn }]}>Tank Check</Text>
          {warnings.map((w, i) => (
            <Text key={i} style={{ color: w.level === "avoid" ? theme.danger : theme.warn, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 20, marginTop: 6 }}>• {w.text}</Text>
          ))}
        </View>
      ) : null}

    </ScrollView>
  );
}

function ChallengeRow({ c, onNavigate, onComplete, done }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Pressable
        onPress={onNavigate ? () => { tapHaptic("light"); onNavigate(); } : undefined}
        disabled={!onNavigate}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
        accessibilityRole={onNavigate ? "button" : undefined}
      >
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.28)", alignItems: "center", justifyContent: "center" }}>
          {iconForEmoji(c.icon) ? (
            <Ionicons name={iconForEmoji(c.icon)} size={16} color={done ? theme.secondaryText : theme.accent} />
          ) : (
            <Text style={{ fontSize: 17 }}>{c.icon}</Text>
          )}
        </View>
        <Text style={{ flex: 1, color: done ? theme.secondaryText : theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800", textDecorationLine: done ? "line-through" : "none" }}>{c.title}</Text>
      </Pressable>
      {onComplete ? (
        <Pressable
          onPress={() => { successHaptic(); onComplete(); }}
          hitSlop={8}
          disabled={done}
          style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: done ? theme.accent : "rgba(159,196,216,0.45)", backgroundColor: done ? "rgba(56,225,198,0.18)" : "transparent" }, pressed && !done && { borderColor: theme.accent, backgroundColor: "rgba(56,225,198,0.18)" }]}
          accessibilityRole="button"
          accessibilityLabel={`Mark "${c.title}" complete`}
        >
          {/* Empty until actually done — a tick in every ring made incomplete
              challenges look finished. Once done, the tick confirms it in
              place, so the row never disappears out from under the tap. */}
          {done ? <Ionicons name="checkmark" size={15} color={theme.accent} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function Summary({ label, value, color, divider }) {
  return (
    <View style={{ alignItems: "center", flex: 1, borderLeftWidth: divider ? 1 : 0, borderLeftColor: theme.hairline }}>
      <Text style={{ color: color || "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}
