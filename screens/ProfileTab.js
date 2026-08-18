import { useEffect, useState, memo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { levelFromXp, getStreak, getLongestStreak, getAchievements, getLifetimeStats, getBanner, BANNERS } from "../core";
import { getBannerImage } from "../data/bannerImageMap";
import { ProfileHero } from "../components/ProfileHero";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { AccountCloudCard } from "../components/AccountCloudCard";
import { AchievementsCard } from "../components/AchievementsCard";
import { GameRecordsCard } from "../components/GameRecordsCard";
import { LifetimeStatsCard } from "../components/LifetimeStatsCard";
import { CollectionInsightsCard } from "../components/CollectionInsightsCard";
import { RemindersCard } from "../components/RemindersCard";
import { FleetCard } from "../components/FleetCard";
import { DataHealthCard } from "../components/DataHealthCard";
import { RestorePointsCard } from "../components/RestorePointsCard";
import { CrashLogCard } from "../components/CrashLogCard";
import { Pill } from "../components/Pill";
import { t, LANGUAGES } from "../lib/i18n";
import { supportLine } from "../lib/buildInfo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AdaptiveColumns } from "../components/AdaptiveColumns";

export const ProfileTab = memo(function ProfileTab({ profileName, onChangeName, premiumUnlocked, tanks = [], xp = 0, activeDays = [], since, lastBackup, wishlist = [], bannerId = "reef", onSetBanner, onExport, onImport, onOpenPremium, reminderPrefs, onChangeReminders, lang = "en", onSetLanguage, unit = "imperial", onSetUnit, user, lastSyncedAt, syncing, syncError, onSyncNow, onSignOut, telemetryOn = false, onSetTelemetry, telemetryConfigured = false, activeTankId, onSwitchTank, onRestored, onGoToTab, activeTank = {}, onChangeTankReminders }) {
  const lvl = levelFromXp(xp);
  const streak = getStreak(activeDays);
  const longestStreak = getLongestStreak(activeDays);

  // Best game streak / Blitz across all games — feeds the game achievements.
  const [gameStats, setGameStats] = useState({ streak: 0, blitz: 0 });
  useEffect(() => {
    // Guarded: these read from storage and set state when the promise resolves.
    // Switching tab or closing the sheet before that lands writes to an
    // unmounted component — React logs it and the write is thrown away, which
    // is a warning today and a stale-state bug the moment anything downstream
    // reads it.
    let alive = true;
    const ids = ["guess", "match", "bigger", "trivia"];
    const keys = ids.flatMap((id) => [`pr_game_${id}_streak`, `pr_game_${id}_blitz`]);
    AsyncStorage.multiGet(keys)
      .then((pairs) => {
        let s = 0, b = 0;
        pairs.forEach(([k, v]) => { const n = Number(v) || 0; if (k.endsWith("streak")) s = Math.max(s, n); else b = Math.max(b, n); });
        if (alive) setGameStats({ streak: s, blitz: b });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const achievements = getAchievements({ tanks, activeDays, xp, wishlist, gameStats });
  const earnedCount = achievements.filter((a) => a.earned).length;
  const lifetime = getLifetimeStats({ tanks, activeDays });
  const banner = getBanner(bannerId);
  const unlocked = BANNERS.filter((b) => lvl.level >= b.level);
  const unlockedBanners = unlocked.length;

  // Swap the worn banner. Tapping the one already worn is a no-op, and the
  // haptic lives in App's setBanner so it fires exactly once.
  const wearBanner = (id) => {
    if (id === bannerId || !onSetBanner) return;
    onSetBanner(id);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AdaptiveColumns lead={1}>
      {/* 1 — CLOUD SAVE: account, sync, premium status, security, backup. */}
      <View style={styles.card}>
        <Text style={[styles.cardEyebrow, { marginBottom: 4 }]}>Cloud Save</Text>
        <AccountCloudCard
          user={user}
          lastSyncedAt={lastSyncedAt}
          syncing={syncing}
          syncError={syncError}
          onSyncNow={onSyncNow}
          onSignOut={onSignOut}
          profileName={profileName}
          onChangeName={onChangeName}
          premiumUnlocked={premiumUnlocked}
          tanks={tanks}
          since={since}
          lastBackup={lastBackup}
          onExport={onExport}
          onImport={onImport}
          onOpenPremium={onOpenPremium}
        />
      </View>

      {/* 2 — PROFILE BANNER: the worn artwork shown whole, with level, XP and
          streak in a solid panel beneath it (the art is its own title card, so
          nothing is printed over it). */}
      <ProfileHero
        image={getBannerImage(banner.id)}
        bannerName={banner.name}
        bannerColors={banner.colors}
        profileName={profileName}
        lvl={lvl}
        xp={xp}
        streak={streak}
        longestStreak={longestStreak}
      />

      {/* QUICK SWAP — every unlocked banner, one tap to wear it. */}
      {unlocked.length > 1 ? (
        <View style={{ marginTop: -8, marginBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 2 }}
          >
            {unlocked.map((b) => {
              const on = b.id === bannerId;
              const img = getBannerImage(b.id);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => wearBanner(b.id)}
                  style={({ pressed }) => [
                    { width: 92, height: 52, borderRadius: 12, overflow: "hidden", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border, backgroundColor: b.colors[0] },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={on ? `${b.name} banner, currently worn` : `Wear the ${b.name} banner`}
                >
                  {img ? <Image source={img} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" /> : null}
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: on ? "rgba(6,20,32,0.15)" : "rgba(6,20,32,0.35)" }} />
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                    {on ? (
                      <Text style={{ color: theme.accent, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓ Worn</Text>
                    ) : (
                      <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{b.name}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 3 — BANNER LIBRARY: earn one every 5 levels. */}
      <CollapsibleCard storageKey="banners" title="🎏 Profile Banners" eyebrow={`${unlockedBanners}/${BANNERS.length} unlocked`}>
        <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>Earn a new banner every 5 levels — tap an unlocked one to wear it on your profile. Locked ones stay blurred until you reach their level.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {BANNERS.map((b) => {
            const isUnlocked = lvl.level >= b.level;
            const on = b.id === bannerId;
            const img = getBannerImage(b.id);
            return (
              <Pressable
                key={b.id}
                onPress={() => isUnlocked && wearBanner(b.id)}
                disabled={!isUnlocked}
                style={({ pressed }) => [
                  { width: "48%", borderRadius: 14, overflow: "hidden", borderWidth: on ? 2 : 1, borderColor: on ? theme.accent : theme.border },
                  pressed && isUnlocked && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !isUnlocked }}
                accessibilityLabel={`${b.name} banner, ${isUnlocked ? (on ? "currently worn" : "unlocked — tap to wear") : `locked, unlocks at level ${b.level}`}`}
              >
                {/* 16:9 so each tile previews the whole banner uncropped, matching
                    how it will actually look once worn. */}
                <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: b.colors[0], alignItems: "center", justifyContent: "center" }}>
                  {img ? (
                    // Locked art is blurred + dimmed, so it reads as a teaser rather
                    // than a reward you already have. blurRadius is built into RN's
                    // Image on both platforms — no extra native dependency.
                    <Image
                      source={img}
                      style={{ position: "absolute", width: "100%", height: "100%" }}
                      resizeMode="contain"
                      blurRadius={isUnlocked ? 0 : 14}
                    />
                  ) : null}
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isUnlocked ? "rgba(6,20,32,0.12)" : "rgba(6,20,32,0.55)" }} />
                  {!isUnlocked ? (
                    <Text style={{ fontSize: 18 }}>🔒</Text>
                  ) : on ? (
                    <View style={{ backgroundColor: "rgba(6,20,32,0.6)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓ Worn</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <Text style={{ color: isUnlocked ? "#fff" : theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{b.name}</Text>
                  <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 1 }}>{b.level === 1 ? "Starter" : `Level ${b.level}`}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </CollapsibleCard>

      {/* 4 — LIFETIME STATS, with My Collection folded in below it. */}
      {/* Every tank against every other. Only meaningful past the first one,
          and the card says so itself rather than being hidden. */}
      {/* The single answer to "what would I lose tonight?" — assembled from
          the four protections the app spreads across four different cards. */}
      <CollapsibleCard storageKey="datahealth" title="🔐 Is My Data Safe?" eyebrow="Backups, sync and snapshots" defaultOpen={true}>
        <DataHealthCard
          tanks={tanks}
          signedIn={Boolean(user)}
          lastSyncedAt={lastSyncedAt}
          syncError={syncError}
          lastBackup={lastBackup}
          onExport={onExport}
          onGoToTab={onGoToTab}
        />
      </CollapsibleCard>

      {/* Multi-tank is the paid feature, so its comparison stays paid — but it
          now sits inside a screen a free keeper can reach, where they can see
          what it is rather than hitting a wall in front of their own settings. */}
      {premiumUnlocked ? (
      <CollapsibleCard storageKey="fleet" title="🪟 Compare Tanks" eyebrow={tanks.length > 1 ? `${tanks.length} tanks` : "Needs a second tank"}>
        <FleetCard tanks={tanks} activeTankId={activeTankId} reminderPrefs={reminderPrefs} onSwitch={onSwitchTank} />
      </CollapsibleCard>
      ) : null}

      {/* Only appears if something actually went wrong. */}
      <CrashLogCard />

      <CollapsibleCard storageKey="restore" title="🛟 Restore Points" eyebrow="Local snapshots a bad sync can't reach">
        <RestorePointsCard onRestored={onRestored} />
      </CollapsibleCard>

      <CollapsibleCard storageKey="lifetime" title="📈 Lifetime Stats" defaultOpen={true} eyebrow="Your career & collection">
        <LifetimeStatsCard stats={lifetime} />
        <View style={styles.sectionDivider} />
        <Text style={styles.cardEyebrow}>My Collection</Text>
        <View style={{ marginTop: 10 }}><CollectionInsightsCard tanks={tanks} /></View>
      </CollapsibleCard>

      {/* 5 — ACHIEVEMENTS, with Game Records folded in below them. */}
      <CollapsibleCard storageKey="achievements" title="🏆 Achievements" eyebrow={`${earnedCount}/${achievements.length} unlocked`}>
        <AchievementsCard items={achievements} />
        <View style={styles.sectionDivider} />
        <Text style={styles.cardEyebrow}>Game Records</Text>
        <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4, marginBottom: 10 }}>Best streak & Blitz score from Reef Games.</Text>
        <GameRecordsCard />
      </CollapsibleCard>

      {/* 6 — SETTINGS & MORE, always last. */}
      <CollapsibleCard storageKey="settings" title="⚙️ Settings & More">
        {/* Reminders */}
        <Text style={styles.cardEyebrow}>Care Reminders</Text>
        <View style={{ marginTop: 8 }}><RemindersCard prefs={reminderPrefs} onChange={onChangeReminders} tank={tanks.length > 1 ? activeTank : null} onChangeTankReminders={onChangeTankReminders} /></View>

        {/* Language */}
        <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>🌐 {t("common.language")}</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {LANGUAGES.map((l) => (
            <Pill key={l.code} fill label={l.label} active={lang === l.code} onPress={() => onSetLanguage && onSetLanguage(l.code)} />
          ))}
        </View>

        {/* Units */}
        <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>Units</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {[{ code: "imperial", label: "°F · gal" }, { code: "metric", label: "°C · L" }].map((u) => (
            <Pill key={u.code} fill label={u.label} active={unit === u.code} onPress={() => onSetUnit && onSetUnit(u.code)} />
          ))}
        </View>

        {/* Help improve the app — opt-in, and honest about what that means.
            Hidden entirely when no analytics key is configured, because a
            toggle that does nothing is worse than no toggle. */}
        {telemetryConfigured ? (
          <>
            <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>Help improve Pocket Reef</Text>
            <Pressable
              onPress={() => onSetTelemetry && onSetTelemetry(!telemetryOn)}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: telemetryOn ? theme.accent : theme.border, paddingHorizontal: 12, paddingVertical: 12 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: telemetryOn }}
              accessibilityLabel="Share anonymous usage data"
              accessibilityHint="Sends which screens and features get used. Never your tanks, notes, photos or email."
            >
              <Ionicons name={telemetryOn ? "checkbox" : "square-outline"} size={20} color={telemetryOn ? theme.accent : theme.secondaryText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>Share anonymous usage data</Text>
                {/* Says exactly what does and doesn't leave the device. Vague
                    copy here is what makes a privacy label wrong later. */}
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 3, lineHeight: 17 }}>
                  Which features get used, and your app version — nothing else. Never your tanks, water tests, journal, photos, or email. Off by default; switching it off deletes the anonymous id.
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}

        {/* Version, for when something goes wrong and you need to say which
            build you are on. */}
        <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>About</Text>
        <View style={{ marginTop: 8, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text selectable style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>
            {supportLine()}
          </Text>
          <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4 }}>
            Include this line in any bug report.
          </Text>
        </View>

        {/* Backup */}
        <Text style={[styles.cardEyebrow, { marginTop: 18 }]}>Backup</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => onExport && onExport()} style={({ pressed }) => [styles.ghostBtn, { flex: 1 }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Export a backup of all your data">
            <Text style={styles.ghostBtnText}>Export</Text>
          </Pressable>
          <Pressable onPress={() => onImport && onImport()} style={({ pressed }) => [styles.ghostBtn, { flex: 1 }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Import a backup, replacing everything on this device">
            <Text style={styles.ghostBtnText}>Restore</Text>
          </Pressable>
        </View>
      </CollapsibleCard>
    </AdaptiveColumns>
    </ScrollView>
  );
})
