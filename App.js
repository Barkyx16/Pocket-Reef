import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { styles, theme, useResponsiveLayout, TWO_COLUMN_MAX_WIDTH, type, space, radius } from "./styles";
import { tapHaptic, getTodayKey, getSpecies, getTodayActions, getStreak, successHaptic, failureHaptic, warningHaptic, commitHaptic, resolveWaterType, assessAddition, getParamForecasts, BANNERS } from "./core";
import { supabase, isCloudConfigured } from "./lib/supabase";
import { pullSnapshot, fetchServerEntitlement, buildSnapshot } from "./lib/cloudSync";
import { mergeSnapshots } from "./lib/merge";
import { withExtras } from "./lib/todayExtras";
import { inferCreatedAt } from "./lib/existingTank";
import { writeBackupFile, pruneOldBackups } from "./lib/backupFile";
import { queueSnapshot, resumePendingSync, cancelPendingSync, hasPendingSync } from "./lib/syncQueue";
import { backupTankPhotos, hydrateTankPhotos } from "./lib/photoSync";
import { getJSON, getRaw, setRaw, safeSetJSON, commitJSON } from "./lib/storage";
import { scheduleWrite, flushWrites, startAutoFlush, onWriteFailure, writeHealth } from "./lib/persist";
import { useStableCallback } from "./lib/useStableCallback";
import { runMigrations, ensureTanksShape, SCHEMA_VERSION, restorePreMigrationBackup } from "./lib/migrations";
import { initPurchases, checkEntitlement, onEntitlementChange, restorePurchases, getOfferingPlans, purchasePackage, identifyUser, forgetUser } from "./lib/purchases";
import { generateStockingPlan } from "./lib/planner";
import { newStockRecord, newLoss, isMortality } from "./lib/livestock";
import { forgetPhoto } from "./lib/photoStore";
import { collectOrphanPhotos } from "./lib/photoGC";
import { pruneDayMap, isValidDayKey } from "./lib/day";
import { reviewLoss } from "./lib/afterLoss";
import { newUpkeepTask } from "./lib/upkeep";
import { pendingAcrossTanks, flattenPending } from "./lib/pending";
import { newWaterChange } from "./lib/waterChanges";
import { setActiveTargets } from "./lib/targets";
import { attentionFor } from "./lib/attention";
import { maybeAutoPoint, createRestorePoint } from "./lib/restore";
import { addObservation, removeObservation } from "./lib/observations";
import { buildTankReport } from "./lib/report";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LockedTab } from "./components/LockedTab";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LossReviewSheet } from "./components/LossReviewSheet";
import { recordCrash } from "./lib/crashLog";
import { versionLabel } from "./lib/buildInfo";
import { WhatsNewSheet } from "./components/WhatsNewSheet";
import { shouldShow } from "./lib/whatsNew";
import { appVersion } from "./lib/buildInfo";
import { track, EVENTS } from "./lib/analytics";
import { initTelemetry, isOptedIn, setOptIn, flushTelemetry } from "./lib/telemetry";
import { isTelemetryConfigured } from "./lib/posthogConfig";
import { syncReminders, requestPermission, onReminderTap, cadenceFor } from "./lib/notifications";
import { AuthScreen } from "./screens/AuthScreen";
import { ResetPasswordModal } from "./components/ResetPasswordModal";
import { t, setLanguage, deviceLanguage, getLanguage } from "./lib/i18n";
import { setUnit, getUnit, formatVolume } from "./lib/units";
import { setCurrency, getCurrency } from "./lib/currency";
import { BackgroundDecoration } from "./components/BackgroundDecoration";
import { HomeTab } from "./screens/HomeTab";
import { SpeciesTab } from "./screens/SpeciesTab";
import { TankTab } from "./screens/TankTab";
import { LogTab } from "./screens/LogTab";
import { HealthTab } from "./screens/HealthTab";
import { JournalTab } from "./screens/JournalTab";
import { GamesTab } from "./screens/GamesTab";
import { MoreTab } from "./screens/MoreTab";
import { PremiumTab } from "./screens/PremiumTab";
import { ProfileTab } from "./screens/ProfileTab";
import { SpeciesDetail } from "./components/SpeciesDetail";
import { DiseaseDetail } from "./components/DiseaseDetail";
import { OnboardingCard } from "./components/OnboardingCard";
import { NewTankSheet } from "./components/NewTankSheet";
import { ImportSheet } from "./components/ImportSheet";
import { StockRecordSheet } from "./components/StockRecordSheet";
import { MigrationBanner } from "./components/MigrationBanner";
import { AppHeader, TankMenu } from "./components/AppHeader";
import { QuickActionsFab, QuickActionsSheet } from "./components/QuickActionsSheet";
import { UniversalSearch } from "./components/UniversalSearch";
import { TabShortcutSheet } from "./components/TabShortcutSheet";
import { UndoSnackbar } from "./components/UndoSnackbar";
import { getAction } from "./lib/shortcuts";
import { CAPS, capped } from "./lib/caps";
import { classifyLink } from "./lib/deepLink";
import { friendlyAuthError } from "./lib/authErrors";
import { friendlyPurchaseError, OUTCOME } from "./lib/purchaseErrors";
import { ScrollToTopContext } from "./lib/scrollToTop";

// Bottom bar: four primary tabs + a "More" entry (Pocket Planter pattern).
// Vector icons, not emoji. The tab bar is the most-seen chrome in the app and
// emoji there render differently per platform, ignore the accent colour, and
// sit off the optical baseline — the clearest "unfinished" signal a mobile app
// can give. Filled when active, outline when not, which is the platform idiom.
const TABS = [
  { id: "home", icon: "home", label: "Home" },
  { id: "species", icon: "fish", label: "Species" },
  { id: "tank", icon: "water", label: "Tank" },
  { id: "log", icon: "flask", label: "Log" },
  { id: "more", icon: "ellipsis-horizontal", label: "More" },
];
// Everything behind the "More" tab, ordered by how often it gets opened:
// Profile first, Premium last.
const MORE_ITEMS = [
  { id: "profile", icon: "person-outline", label: "Profile", desc: "Account, stats & settings" },
  { id: "journal", icon: "book-outline", label: "Journal", desc: "Your dated log & photo gallery" },
  { id: "health", icon: "medkit-outline", label: "Health", desc: "Disease guides & symptom checker" },
  { id: "games", icon: "game-controller-outline", label: "Games", desc: "Play reef games & earn XP" },
  { id: "premium", icon: "star-outline", label: "Premium", desc: "Unlock the full reef toolkit" },
];
const MORE_IDS = MORE_ITEMS.map((m) => m.id);

// ── The paywall ──────────────────────────────────────────────────────────────
// This is the ONE list that decides paid access. The tab bar, the More sheet,
// jumpTo() and the render guard all read it, so a tab can't end up
// half-protected — and a Today-card deep link can't route around it either.
//
// Free tier: Home, plus a preview of Species. "more" is the menu shell and
// "premium" is where you pay, so neither can be locked.
// Profile is deliberately NOT in here.
//
// It was, and that put a free account's own account controls behind the
// paywall: signing out, exporting your data, changing language or units,
// managing reminders — and deleting the account. An app that lets somebody
// create an account for free and then charges them to delete it is a trust
// problem on its own, and App Store Review 5.1.1(v) requires account deletion
// to be reachable in-app for any app that offers account creation. The auth
// screen this app ships makes that rule apply.
//
// The genuinely paid parts of Profile stay gated inside the screen, where a
// keeper can still see what they'd get; the parts that are theirs — their
// account, their data, their settings — are not something to sell back to them.
const PREMIUM_TAB_IDS = new Set(["tank", "log", "health", "journal", "games"]);

// What a free account gets.
const FREE_STOCK_LIMIT = 5;   // fish saved to a tank
const FREE_SPECIES_LIMIT = 7; // species visible in the catalog

// Copy for each locked tab — what they'd get, so the wall sells rather than scolds.
const LOCKED_COPY = {
  tank: {
    icon: "water-outline", title: "Your tank, unlocked",
    blurb: "Track your full stock with live compatibility, bioload, and stocking guidance.",
    perks: [
      "Unlimited fish per tank, across multiple tanks",
      "Real-time compatibility and bioload",
      "Simulate your wishlist against your actual tank",
      "Quarantine protocol, consumables and care notes for a tank sitter",
    ],
  },
  log: {
    icon: "flask-outline", title: "Log it, then understand it",
    blurb: "The logging is the easy half. This is the half that tells you what your readings mean.",
    perks: [
      "Water tests with trends, forecasts and stability grading",
      "Why a reading won't come down — your tap water, factored in",
      "How often each parameter actually needs testing",
      "Import years of history from a spreadsheet",
    ],
  },
  health: {
    icon: "medkit-outline", title: "Health toolkit",
    blurb: "Find out what's wrong and what to do about it.",
    perks: [
      "10 illustrated disease guides and a symptom checker",
      "Algae diagnosed from your own nutrients and light hours",
      "Medication doses worked out on your real water volume",
      "Emergency troubleshooter",
    ],
  },
  journal: {
    icon: "book-outline", title: "Your reef journal",
    blurb: "A dated, searchable record of your tank with photos.",
    perks: ["Photo journal & gallery", "Search and mood filters", "Timeline view"],
  },
  games: {
    icon: "game-controller-outline", title: "Reef games",
    blurb: "Play, learn, and earn XP toward your reef-keeper level.",
    perks: ["Every reef mini-game", "Earn XP and records"],
  },
};

// Matches the undo bar's own countdown, so a photo is never removed while its
// entry can still be brought back.
const UNDO_WINDOW_MS = 6000;

const EMPTY_TANK = { name: "My Tank", gallons: 20, water: "fresh", emoji: "🐠", stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], treatments: [], createdAt: null };
const newTank = (name, gallons = 20, water = "fresh", emoji = "🐠") => ({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name, gallons, water, emoji, stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], treatments: [], createdAt: new Date().toISOString() });
// The exported root wraps the app in an error boundary, so a render crash
// anywhere inside shows a recovery screen that says the data is safe — instead
// of a white screen, which is what makes people delete and reinstall.
export default function App() {
  return (
    <ErrorBoundary onError={(error, info) => recordCrash(error, info, { version: versionLabel() })}>
      <PocketReef />
    </ErrorBoundary>
  );
}

function PocketReef() {
  // Live layout — re-evaluated on rotation, iPad split view and window resize.
  // Capping the content column here means every screen inherits it from one
  // place instead of each ScrollView carrying its own stale snapshot.
  const layout = useResponsiveLayout();
  // Read live: the bar moves with the device, and Split View changes it.
  const insets = useSafeAreaInsets();

  // Inter, in the weights the design system actually uses. React Native needs a
  // family per weight — fontWeight alone won't select the right file on Android.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const [activeTab, setActiveTab] = useState("home");

  const [scrollSignal, setScrollSignal] = useState(0);
  // Per-tank data now lives inside tank profiles.
  const [tanks, setTanks] = useState([]);
  const [activeTankId, setActiveTankId] = useState(null);
  // User-level (shared across tanks).
  const [xp, setXp] = useState(0);
  const [activeDays, setActiveDays] = useState([]);
  const [careDone, setCareDone] = useState({});
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  // True when a schema migration failed — the pre-migration backup is intact.
  const [migrationFailed, setMigrationFailed] = useState(false);
  // Store availability + in-flight purchase, for the Premium tab UI.
  const [storeReady, setStoreReady] = useState(false);
  const [buying, setBuying] = useState(false);
  // Why the paywall was opened, so it can answer the question the user just
  // asked instead of pitching generically.
  const [paywallReason, setPaywallReason] = useState(null);
  // True when edits are saved locally but haven't reached the account yet.
  const [syncPending, setSyncPending] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [reminderPrefs, setReminderPrefs] = useState({ waterTest: "weekly", waterChange: "weekly", feeding: "off" });
  const [tankSheet, setTankSheet] = useState(null); // null | {mode:"new"} | {mode:"edit", id}
  const [showImport, setShowImport] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [splashDone, setSplashDone] = useState(false); // keep the loading screen up briefly
  // The version whose changes have been acknowledged. null on a brand-new
  // install, which is the case that must NOT see a what's-new sheet.
  const [seenVersion, setSeenVersion] = useState(undefined);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [lang, setLangState] = useState("en");
  const [unit, setUnitState] = useState("imperial");
  const [currency, setCurrencyState] = useState("USD");
  const [profileName, setProfileName] = useState("");
  const [since, setSince] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [recent, setRecent] = useState([]);
  const [speciesNotes, setSpeciesNotes] = useState({});
  const [fodSeen, setFodSeen] = useState(null); // date the Fish of the Day was last viewed
  const [challengesDone, setChallengesDone] = useState([]); // challenge ids marked done today
  const [bannerId, setBannerId] = useState("reef"); // selected profile banner
  // Whether the user has ever actually told us a tank size, as opposed to
  // still sitting on the 20-gallon default. This can't be inferred from the
  // number — somebody really does own a 20-gallon tank, and inferring would
  // leave their setup step permanently unticked.
  const [tankSized, setTankSized] = useState(false);
  // Supplement strengths (dKH or ppm raised by 1ml in 1 gallon), per product.
  // User-level, not per-tank: it's a property of the bottle, not the tank.
  const [strengths, setStrengths] = useState({});

  // ── Shortcuts ──────────────────────────────────────────────────────────────
  // The quick sheet, universal search, the header's tank menu and the tab bar's
  // long-press menus are all overlays over whatever screen is up. They're held
  // here rather than per-screen so they survive a tab change — a shortcut that
  // closed itself the moment it navigated couldn't chain.
  const [showQuick, setShowQuick] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTankMenu, setShowTankMenu] = useState(false);
  const [tabMenu, setTabMenu] = useState(null); // { id, label } of a long-pressed tab
  const [recordFor, setRecordFor] = useState(null); // species name whose record sheet is open
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [telemetryOn, setTelemetryOn] = useState(false);
  // Where a shortcut wants the destination screen to open: { tab, card, tool,
  // nonce }. The nonce is what makes the same shortcut work twice in a row —
  // without it the target card sees an unchanged prop and ignores the second.
  const [intent, setIntent] = useState(null);
  // The pending undo, if any: { id, message, icon, onUndo }.
  const [undo, setUndo] = useState(null);

  // ── Account / cloud save ──
  const [user, setUser] = useState(null);          // supabase user, null when signed out
  const [authChecked, setAuthChecked] = useState(!isCloudConfigured()); // session restored?
  const [offlineMode, setOfflineMode] = useState(!isCloudConfigured()); // running without an account
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  // Guards the sync effect: don't push until the cloud copy has been pulled,
  // or a fresh install would overwrite the account with empty state.
  const cloudLoaded = useRef(false);
  // The last reminder payload actually sent, so an unchanged schedule isn't
  // torn down and rebuilt on every edit.
  const lastReminderSig = useRef(null);
  const syncTimer = useRef(null);

  // Keep the loading screen up for a short beat, even if hydration is instant.
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1900);
    return () => clearTimeout(timer);
  }, []);

  // The whole load, as a callable. It runs on mount, and again after a restore
  // point is applied — the app is holding the pre-restore data in memory at
  // that moment, and the next state write would put it straight back on top of
  // what was just recovered.
  const hydrateAll = useStableCallback(async () => {
     try {
      // Bring data written by an older build up to the current schema before
      // anything reads it. Backs the whole store up first, so a bad migration in
      // some future release is recoverable rather than terminal.
      try {
        const result = await runMigrations();
        if (result.failed.length) setMigrationFailed(true);
      } catch (e) {
        setMigrationFailed(true);
      }

      // Each read below is individually fault-tolerant — getJSON/getRaw never
      // throw, and quarantine anything they can't parse under <key>__corrupt.
      // A single unreadable value costs the user that one setting; it can no
      // longer abort hydration and boot the app looking factory-fresh.
      // pr_premium is deliberately NOT read here. Entitlement comes from
      // RevenueCat, which keeps its own offline-capable cache — a local flag the
      // app can write is a local flag a patched build can write too.
      const [x, a, rm, ob, lg, un, cur] = await Promise.all(
        ["pr_xp", "pr_activeDays", "pr_reminders", "pr_onboarded", "pr_lang", "pr_unit", "pr_currency"].map((k) => getRaw(k))
      );
      if (x) setXp(Number(x) || 0);
      if (ob === "1") setSeenOnboarding(true);
      if (lg) {
        setLanguage(lg); setLangState(getLanguage());
      } else {
        // No stored choice yet — follow the phone. Only ever applied on a fresh
        // install, so it can never override a language the user picked.
        const detected = deviceLanguage();
        if (detected) { setLanguage(detected); setLangState(getLanguage()); }
      }
      if (un) { setUnit(un); setUnitState(getUnit()); }
      if (cur) { setCurrency(cur); setCurrencyState(getCurrency()); }
      if (a) setActiveDays((await getJSON("pr_activeDays", [])) || []);
      if (rm) { const p = await getJSON("pr_reminders", null); if (p) setReminderPrefs(p); }

      setWishlist(await getJSON("pr_wishlist", []));
      // Existing installs carry however many days they accumulated.
      setCareDone(pruneDayMap(await getJSON("pr_careDone", {})));
      setRecent(await getJSON("pr_recent", []));
      setSpeciesNotes(await getJSON("pr_speciesNotes", {}));

      const [pn, sinceRaw, lb, fsd, bn, ts, sv, onboardedRaw] = await Promise.all(
        ["pr_profileName", "pr_since", "pr_lastBackup", "pr_fodSeen", "pr_banner", "pr_tankSized", "pr_seenVersion", "pr_onboarded"].map((k) => getRaw(k))
      );
      if (ts === "1") setTankSized(true);
      // A returning keeper is one who has been through onboarding. Somebody
      // installing for the first time has nothing to catch up on, so they're
      // recorded as already current rather than shown a tour of features they
      // have never met.
      setSeenVersion(sv || (onboardedRaw === "1" ? "1.0.0" : null));
      setStrengths(await getJSON("pr_doseStrengths", {}));
      if (pn) setProfileName(pn);
      if (lb) setLastBackup(Number(lb) || null);
      if (fsd) setFodSeen(fsd);
      if (bn) setBannerId(bn);
      if (sinceRaw) setSince(Number(sinceRaw));
      else { const now = Date.now(); setSince(now); setRaw("pr_since", String(now)); }

      const chd = await getJSON("pr_challengesDone", null);
      if (chd && chd.date === getTodayKey()) setChallengesDone(chd.ids || []);

      // Tanks come through the commit log, so an interrupted save falls back to
      // the staged copy instead of reading as "no tanks". Shape normalization
      // fills in any field this build expects that the stored data predates.
      const stored = await commitJSON("pr_tanks", null);
      const list = ensureTanksShape(stored);
      if (list.length) {
        setTanks(list);
        const at = await getRaw("pr_activeTank");
        setActiveTankId(list.find((tk) => tk.id === at) ? at : list[0].id);
        // Only rewrite when normalization actually changed something.
        // The mirror effect writes the normalised copy once hydration
        // completes; this just marks the device as having newer data.
        if (JSON.stringify(list) !== JSON.stringify(stored)) setRaw("pr_lastEdit", String(Date.now()));
      } else {
        const d = newTank("My Tank");
        setTanks([d]);
        setActiveTankId(d.id);
        await safeSetJSON("pr_tanks", [d]);
        setRaw("pr_activeTank", d.id);
      }
     } finally {
      // Never leave the app stuck behind the splash, whatever happened above.
      setHydrated(true);
     }
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrateAll is a stable useStableCallback and must run exactly once, at mount.
  useEffect(() => { hydrateAll(); }, []);

  // Only after the splash, onboarding and the auth gate are out of the way —
  // a sheet over the loading screen would be dismissed before it was read.
  useEffect(() => {
    if (!hydrated || !splashDone || seenVersion === undefined) return;
    if (!seenOnboarding) return;
    if (shouldShow(seenVersion, appVersion())) setShowWhatsNew(true);
  }, [hydrated, splashDone, seenVersion, seenOnboarding]);

  const dismissWhatsNew = useStableCallback(() => {
    setShowWhatsNew(false);
    const v = appVersion();
    setSeenVersion(v);
    setRaw("pr_seenVersion", v).catch(() => {});
  });

  // Photos nothing references any more. At launch rather than on delete: undo
  // can restore a just-deleted entry, and undo state doesn't survive a
  // relaunch — so by the time this runs, anything unreferenced really is gone
  // for good. Fire-and-forget, well after first paint.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => { collectOrphanPhotos(tanks).catch(() => {}); }, 6500);
    return () => clearTimeout(id);
    // Deliberately launch-only: `tanks` changes constantly and re-running this
    // on every edit would be both wasteful and racy against undo.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launch-only by design; see the comment above.
  }, [hydrated]);

  // One automatic snapshot a day, after the data is loaded and settled. Taken
  // late and fire-and-forget: it must never delay the first paint, and a
  // failure to snapshot is not a reason to stop the app working.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => { maybeAutoPoint().catch(() => {}); }, 4000);
    return () => clearTimeout(id);
  }, [hydrated]);


  // Tapping a reminder lands on the tab where you act on it — same deep-link
  // contract the Today card uses. jumpTo enforces the paywall, so a reminder
  // can't be a back door into a locked tab.
  // A tap opens the app where the work is; a button answers without opening
  // anything. Swiping a reminder away used to be the only way to dismiss it,
  // which left the app believing a job was outstanding while the keeper
  // believed they had answered it.
  useEffect(() => onReminderTap((to, res) => {
    if (!res || res.kind === "open") {
      jumpTo(to);
      // A reminder that names a parameter should open the card that explains
      // it, not just the tab it lives on.
      if (res && res.tool) setIntent({ tab: to, tool: res.tool, card: null, nonce: Date.now() });
      return;
    }
    if (res.kind === "done") {
      // Which tank? A reminder rolls several tanks into one line ("Due in the
      // reef and the frag tank"), and this fires from the lock screen hours
      // later, so "the tank that is open in the app" is not an answer — it was
      // the old one, and it filed the reef's water change against quarantine
      // while leaving the reef overdue. Both tanks wrong, silently.
      //
      // Act only when the reminder is about exactly one tank. Anything else
      // opens the app so the keeper says which, rather than the app choosing.
      const ids = Array.isArray(res.tankIds) ? res.tankIds.filter((id) => tanks.some((tk) => tk.id === id)) : [];
      const only = ids.length === 1 ? ids[0] : (tanks.length === 1 ? tanks[0].id : null);
      if (!only) { jumpTo(res.to || "log"); return; }

      // Only the chores that map onto a real record. A reminder key that
      // doesn't is left alone rather than inventing an entry.
      if (res.key === "waterChange") markJobDone(only, "waterchange", "Water change");
      else if (res.key === "feeding") addFeedingToTank(only, { id: Date.now(), date: getTodayKey(), food: "Fed" });
      else if (res.key === "waterTest") jumpTo("log");
      return;
    }
    // "Later" deliberately records nothing. The next sync reschedules from the
    // tank's real state, so deferring can't leave a false entry behind.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- The notification handler is rebuilt only when entitlement changes; the callbacks it closes over are stable.
  }), [premiumUnlocked]);

  // ── Premium entitlement ────────────────────────────────────────────────────
  // Owned by RevenueCat, never by the app. Configure the SDK, read the current
  // entitlement, then follow it — renewals, expiry, refunds and restores on
  // another device all arrive through the listener.
  //
  // checkEntitlement() returns null when a lookup fails, distinct from false.
  // A paying subscriber must never be locked out by a flaky network, so null
  // leaves the current state alone.
  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    (async () => {
      const ready = await initPurchases();
      if (!alive) return;
      setStoreReady(ready);
      if (!ready) return; // Expo Go has no native module — stays free
      const entitled = await checkEntitlement();
      if (alive && entitled !== null) setPremiumUnlocked(entitled);
      unsubscribe = onEntitlementChange((on) => { if (alive) setPremiumUnlocked(on); });
    })();
    return () => { alive = false; unsubscribe(); };
  }, []);

  // App Store policy requires restore to be reachable, and it's what gets a
  // subscriber their access back after a reinstall or on a new device.
  const restorePremium = useStableCallback(async () => {
    const res = await restorePurchases();
    if (res.entitled) {
      successHaptic();
      track(EVENTS.RESTORE_SUCCESS);
      setPremiumUnlocked(true);
      Alert.alert("Premium restored", "Welcome back — everything's unlocked.");
    } else if (res.ok) {
      // A restore that finds nothing is the moment a paying customer is most
      // likely to think they have been charged for nothing. The old message
      // stated the outcome and stopped, and the cause is almost always the same
      // one — the App Store is signed into a different Apple ID than the one
      // that bought it, which is not something the app can see or fix, but is
      // something it can name.
      Alert.alert(
        "Nothing to restore",
        "No subscription was found on this Apple ID.\n\nIf you bought Premium on a different Apple ID, sign into that one in Settings → your name → Media & Purchases, then try again. A subscription that has lapsed will not restore either — you can resubscribe above."
      );
    } else {
      const f = friendlyPurchaseError(res);
      // Already-owned surfacing here means the receipt is on the device after
      // all, which is a restore that worked.
      if (f.outcome === OUTCOME.owned) {
        setPremiumUnlocked(true);
        Alert.alert(f.title, f.message);
      } else if (f.outcome !== OUTCOME.cancelled) {
        Alert.alert("Couldn't restore", f.message);
      }
    }
  });

  // ── Cloud save ─────────────────────────────────────────────────────────────
  // Writes a pulled snapshot into state. The mirror effects carry it to disk
  // from there, so the device copy still matches the account on an offline
  // launch — and there's no second, hand-maintained list of keys here to fall
  // out of step with the one above.
  const applySnapshot = useStableCallback((snap) => {
    if (!snap || typeof snap !== "object") return;
    if (Array.isArray(snap.tanks) && snap.tanks.length) {
      setTanks(snap.tanks);
      setActiveTankId(snap.tanks.find((tk) => tk.id === snap.activeTankId) ? snap.activeTankId : snap.tanks[0].id);
    }
    if (typeof snap.xp === "number") setXp(snap.xp);
    if (Array.isArray(snap.activeDays)) setActiveDays(snap.activeDays);
    if (snap.careDone) setCareDone(snap.careDone);
    if (Array.isArray(snap.wishlist)) setWishlist(snap.wishlist);
    if (snap.reminderPrefs) setReminderPrefs(snap.reminderPrefs);
    if (typeof snap.profileName === "string") setProfileName(snap.profileName);
    if (snap.since) { setSince(snap.since); scheduleWrite("pr_since", () => String(snap.since), "raw"); }
    if (Array.isArray(snap.recent)) setRecent(snap.recent);
    if (snap.speciesNotes) setSpeciesNotes(snap.speciesNotes);
    if (snap.bannerId) setBannerId(snap.bannerId);
    if (snap.lang) { setLanguage(snap.lang); setLangState(getLanguage()); }
    if (snap.unit) { setUnit(snap.unit); setUnitState(getUnit()); }
    if (snap.currency) { setCurrency(snap.currency); setCurrencyState(getCurrency()); }
    if (snap.strengths && typeof snap.strengths === "object") setStrengths(snap.strengths);
    if (typeof snap.tankSized === "boolean") setTankSized(snap.tankSized);
    // premiumUnlocked is deliberately NOT applied from the snapshot. Entitlement
    // is decided by RevenueCat; accepting it from synced data is what would let
    // a patched client write itself Premium and have it stick forever.
  });

  // Tie the store subscriber to the signed-in account (so webhook events can be
  // attributed), then consult the server-side entitlement row — the copy the
  // client cannot write. Either source saying yes grants access: the SDK works
  // offline, the server survives a patched bundle. Neither can revoke on a
  // failed lookup, since both return null when they simply don't know.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      await identifyUser(user.id);
      const server = await fetchServerEntitlement(user.id);
      if (alive && server === true) setPremiumUnlocked(true);
    })();
    return () => { alive = false; };
  }, [user]);

  // Copy any journal photo that isn't backed up yet into storage. Best-effort
  // and off the critical path — a failed upload just leaves the entry with its
  // local photo, and the next pass retries.
  useEffect(() => {
    if (!user || !hydrated || !tanks.length) return;
    let alive = true;
    backupTankPhotos(user.id, tanks).then(({ tanks: next, uploaded }) => {
      if (alive && uploaded) setTanks(next);
    }).catch(() => {});
    return () => { alive = false; };
  }, [user, hydrated, tanks]);

  // Resume a push that a previous session couldn't finish.
  useEffect(() => {
    if (!user || !hydrated) return;
    resumePendingSync(user.id, (r) => {
      setSyncError(!r.ok);
      setSyncPending(Boolean(r.pending));
      if (r.ok) setLastSyncedAt(Date.now());
    }).catch(() => {});
    hasPendingSync().then((p) => setSyncPending(p)).catch(() => {});
  }, [user, hydrated]);

  // Restore an existing session on launch and follow sign-in/out after that.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession()
      .then(({ data }) => { setUser(data?.session?.user || null); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setAuthChecked(true);
      // The recovery link signs the user in with a short-lived session whose
      // only job is letting them set a new password.
      if (event === "PASSWORD_RECOVERY") setShowResetPassword(true);
      if (event === "SIGNED_OUT") {
        cloudLoaded.current = false;
        setLastSyncedAt(null);
      }
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  // Auth emails come back as pocketreef:// deep links carrying the tokens in the
  // URL fragment. detectSessionInUrl is off (there's no URL bar on native), so
  // the exchange happens here.
  useEffect(() => {
    if (!supabase) return;
    const handleUrl = async (url) => {
      // Any app or web page can open a URL with this app's scheme. A link is
      // acted on only if it claims one of the two destinations we registered —
      // otherwise a crafted link carrying someone else's tokens would sign the
      // keeper into someone else's account, and everything they logged after
      // that would land where they couldn't see it.
      const link = classifyLink(url);
      if (!link) return;
      if (link.error) {
        // Tapping an expired link used to open the app and do nothing, which
        // reads as the app being broken rather than the link being stale.
        Alert.alert("That link didn't work", `${friendlyAuthError(link.error)}\n\nRequest a new one from the sign-in screen.`);
        return;
      }
      if (link.session) {
        await supabase.auth.setSession(link.session).catch(() => {});
      }
      if (link.isRecovery) setShowResetPassword(true);
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub?.remove?.();
  }, []);

  // On sign-in, pull the account's copy over the device copy. A brand-new
  // account has nothing stored, so the local reef becomes its first snapshot.
  useEffect(() => {
    if (!supabase || !user || !hydrated || cloudLoaded.current) return;
    let alive = true;
    (async () => {
      setSyncing(true);
      const res = await pullSnapshot(user.id);
      if (!alive) return;
      if (res.ok) {
        // The cloud copy is not automatically the right copy. If this device has
        // been edited more recently than the account was last written — someone
        // reinstalled and kept logging offline, or a second device wrote an older
        // snapshot — applying it blind destroys the newer work. Ask instead.
        const localEdit = Number(await getRaw("pr_lastEdit", "0")) || 0;
        const cloudEdit = res.updatedAt ? new Date(res.updatedAt).getTime() : 0;
        const localHasData = tanks.some((tk) => (tk.stock || []).length || (tk.journal || []).length || (tk.waterTests || []).length);
        const cloudIsStale = localHasData && localEdit > cloudEdit + 60000;

        if (res.data && cloudIsStale) {
          // Merging is offered first and is the default answer, because both
          // of the old options threw away somebody's work: a keeper who logged
          // on their phone at the tank and their iPad on the sofa had to pick
          // which week of their own records to delete. A water test is an
          // immutable dated fact, so the union of the two copies is simply the
          // correct result — the destructive choices stay available for the
          // rare case where one copy is genuinely wrong.
          const localSnapshot = buildSnapshot({
            tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
            profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, currency,
            strengths, tankSized,
          });
          const { merged, report } = mergeSnapshots(localSnapshot, res.data, { localNewer: true });

          Alert.alert(
            "Two copies of your data",
            `This device has newer changes than your account's saved copy. Merging keeps everything from both — ${report.gained > 0 ? `${report.gained} record${report.gained === 1 ? "" : "s"} would be recovered` : "nothing is lost either way"}.`,
            [
              {
                text: "Merge both",
                onPress: () => {
                  applySnapshot(merged);
                  cloudLoaded.current = true;
                  // The merged copy is now the truth, so it goes straight back
                  // up — otherwise the other device would merge against a stale
                  // cloud row and this would repeat on every launch.
                  setTimeout(() => syncNow(), 0);
                },
              },
              {
                text: "Keep this device",
                // Push local up, making the device the new source of truth.
                onPress: () => { cloudLoaded.current = true; syncNow(); },
              },
              {
                text: "Use cloud copy",
                style: "destructive",
                onPress: () => { applySnapshot(res.data); cloudLoaded.current = true; },
              },
            ],
            { cancelable: false }
          );
          setSyncError(false);
          setLastSyncedAt(cloudEdit || Date.now());
          setSyncing(false);
          return; // cloudLoaded is set by whichever branch the user picks
        }

        if (res.data) applySnapshot(res.data);
        setSyncError(false);
        setLastSyncedAt(res.updatedAt ? new Date(res.updatedAt).getTime() : Date.now());
        // Journal photos arrive as storage paths. Sign them so entries taken on
        // another device actually render here instead of showing as broken.
        if (res.data && Array.isArray(res.data.tanks)) {
          hydrateTankPhotos(res.data.tanks).then((withUrls) => {
            if (alive && withUrls !== res.data.tanks) setTanks(withUrls);
          }).catch(() => {});
        }
      } else {
        setSyncError(true);
      }
      cloudLoaded.current = true;
      setSyncing(false);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs once per sign-in. Listing the profile fields would re-pull the cloud copy on every local edit.
  }, [user, hydrated]);

  // Push changes up, debounced so a burst of edits is one write.
  useEffect(() => {
    if (!supabase || !user || !cloudLoaded.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncing(true);
      // Goes through the queue: the snapshot is written to disk before the
      // network attempt, so a failed or interrupted push is retried with
      // backoff instead of being silently dropped.
      await queueSnapshot(user.id, {
        tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
        profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, currency,
        strengths, tankSized,
      }, (r) => {
        setSyncing(false);
        setSyncError(!r.ok);
        setSyncPending(Boolean(r.pending));
        if (r.ok) setLastSyncedAt(Date.now());
      });
    }, 2500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  // Every field the snapshot above sends has to appear here, or changing it
  // alone never schedules a push — it rides along with the next unrelated
  // edit instead, which looks like the setting not syncing at all. The four
  // that were missing (currency, since, strengths, tankSized) are exactly the
  // ones added to the snapshot later without touching this list.
  }, [user, tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs, profileName, recent, speciesNotes, challengesDone, bannerId, lang, unit, currency, since, strengths, tankSized]);

  const syncNow = useStableCallback(async () => {
    if (!supabase || !user) return;
    setSyncing(true);
    // Land any debounced local writes before uploading. The snapshot is built
    // from state either way, but "Sync now" should also mean the device copy
    // is current — otherwise a crash right after a successful sync could still
    // lose the last few seconds locally.
    await flushWrites();
    await queueSnapshot(user.id, {
      tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
      profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, currency,
      strengths, tankSized,
    }, (r) => {
      setSyncing(false);
      setSyncError(!r.ok);
      setSyncPending(Boolean(r.pending));
      if (r.ok) setLastSyncedAt(Date.now());
    });
  });

  // Sign-out drops back to the auth gate. Local data stays on the device — the
  // next account to sign in pulls its own copy over it.
  // Signing out cancels the pending push, so anything logged since the last
  // successful sync never reaches the account — and the next device to sign in
  // simply won't have it. The app knows this is the case; it just never said
  // so. Offering to sync first is the difference between a deliberate choice
  // and silent loss.
  const handleSignOut = useStableCallback(() => {
    if (syncPending && user) {
      warningHaptic();
      Alert.alert(
        "Changes haven't reached your account",
        "Some of what you've logged hasn't synced yet. Signing out now leaves it on this device only — it won't appear when you sign in elsewhere.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sync, then sign out", onPress: () => { syncNow().finally(() => signOutNow()); } },
          { text: "Sign out anyway", style: "destructive", onPress: () => signOutNow() },
        ]
      );
      return;
    }
    signOutNow();
  });

  const signOutNow = useStableCallback(() => {
    cloudLoaded.current = false;
    // Stop retrying this account's pending push, and detach the RevenueCat
    // subscriber so the next account on this device can't inherit entitlement.
    cancelPendingSync();
    forgetUser().catch(() => {});
    setUser(null);
    setLastSyncedAt(null);
    setSyncError(false);
    setSyncPending(false);
    setActiveTab("home");
  });

  // Derived active tank (safe fallback before hydration).
  const activeTank = tanks.find((tk) => tk.id === activeTankId) || tanks[0] || EMPTY_TANK;
  const tank = activeTank.stock;
  const tankGallons = activeTank.gallons;
  const waterTests = activeTank.waterTests;
  const journal = activeTank.journal;
  const costs = activeTank.costs;
  const maintenance = activeTank.maintenance;
  const quarantine = activeTank.quarantine;
  const quantities = activeTank.quantities || {};
  const feedings = activeTank.feedings || [];

  // Which tanks need something, for the header chip and the switcher. Only the
  // fields the verdict reads are in the dependency list — recomputing this on
  // every journal note would be pure waste, and `tanks` changes on all of them.
  const tankAttention = useMemo(
    () => attentionFor(tanks, { reminderPrefs, exceptId: activeTank.id }),
    [tanks, reminderPrefs, activeTank.id]
  );

  // ── Care reminders ─────────────────────────────────────────────────────────
  // Rebuilt whenever the inputs change. The body is written from the user's
  // actual top Today action, so a reminder says what's wrong with THEIR tank
  // rather than pinging them generically.
  //
  // MUST stay below the derived-tank block: a dependency array is evaluated
  // during render, so depending on activeTank above its declaration threw
  // "Cannot access 'activeTank' before initialization" on every launch.
  useEffect(() => {
    if (!hydrated || !activeTank) return;
    const baseActions = getTodayActions({
      tank: activeTank.stock || [],
      waterTests: activeTank.waterTests || [],
      maintenance: activeTank.maintenance || {},
      quarantine: activeTank.quarantine || [],
      careDoneCount: (careDone[getTodayKey()] || []).length,
      reminderPrefs,
      quantities: activeTank.quantities || {},
      waterType: activeTank.water || "fresh",
      treatments: activeTank.treatments || [],
      upkeep: activeTank.upkeep || [],
    });
    // The same list Home renders, so a notification can't recommend something
    // the app itself no longer believes — and so the analysis engines reach
    // the lock screen rather than stopping at the home screen.
    const actions = withExtras(baseActions, activeTank, {
      waterType: resolveWaterType(activeTank.stock || [], activeTank.water || "fresh"),
    });
    const streak = getStreak(activeDays);
    // Every tank, not just the active one. Multi-tank is a paid feature, and
    // reminders silently covered exactly one of them.
    const cadence = (pref) => (pref === "biweekly" ? 14 : pref === "weekly" ? 7 : null);
    const sinceDays = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity);

    // Each tank on its own schedule where it has one. Previously every tank was
    // measured against the account default, so a quarantine box with reminders
    // deliberately switched off still counted as overdue and still put its name
    // in the notification.
    const tankStates = tanks.map((tk) => {
      const testEvery = cadence(cadenceFor(tk, reminderPrefs, "waterTest"));
      const changeEvery = cadence(cadenceFor(tk, reminderPrefs, "waterChange"));
      return {
        // The id travels with the state so a reminder can say which tank it is
        // about. Without it, ticking a chore off from the lock screen recorded
        // against whichever tank happened to be open in the app.
        id: tk.id,
        name: tk.name,
        testDue: testEvery != null && sinceDays((tk.waterTests || [])[0] && (tk.waterTests || [])[0].date) >= testEvery,
        changeDue: changeEvery != null && sinceDays((tk.maintenance || {}).waterchange) >= changeEvery,
      };
    });

    const reminderPayload = {
      reminderPrefs,
      tanks: tankStates,
      tankName: activeTank.name,
      topAction: actions && actions.length ? actions[0] : null,
      // Only nudge when there's a streak to lose and today isn't logged yet.
      streakAtRisk: streak > 0 && !activeDays.includes(getTodayKey()),
      // The active tank's forecasts drive the predictive alerts. Only this
      // tank's: a notification has to name one tank to be actionable, and the
      // cadence reminders already carry the multi-tank roll-up.
      forecasts: getParamForecasts(
        activeTank.waterTests || [],
        resolveWaterType(activeTank.stock || [], activeTank.water || "fresh"),
        activeTank.stock || []
      ),
    };
    // Rescheduling cancels every pending notification first, so doing it on
    // every keystroke-level tank change was both wasteful and destructive.
    // Skipping identical payloads means a quantity tweak or a journal note no
    // longer disturbs a schedule that hasn't actually changed.
    const signature = JSON.stringify([reminderPayload.reminderPrefs, reminderPayload.tanks, reminderPayload.topAction && reminderPayload.topAction.text, reminderPayload.streakAtRisk, reminderPayload.forecasts.map((f) => [f.key, f.daysToEdge, f.confident])]);
    if (signature === lastReminderSig.current) return;
    lastReminderSig.current = signature;
    syncReminders(reminderPayload).catch(() => {});
  }, [hydrated, reminderPrefs, activeTankId, activeTank, tanks, activeDays, careDone]);

  // Mutate the active tank. Persistence is NOT done here — see the mirror
  // effects below. A setState updater must be a pure function of its argument:
  // React is free to call it more than once, and to throw the result away and
  // re-run it, so a write inside the updater can fire twice for one edit, or
  // persist a value that never becomes state.
  // While an undo is running this holds the tank the original action happened
  // on. Every undo restore in this file goes through updateActiveTank, and
  // "active" is whichever tank is open when Undo is *tapped* — not the one the
  // record came from. The snackbar lasts five seconds and the tank switcher is
  // one tap away in the header, so deleting a water test, switching tanks and
  // hitting undo filed that reading into the wrong tank, and the tank it
  // belonged to never got it back.
  const undoTankRef = useRef(null);

  const updateActiveTank = useStableCallback((updater) => {
    const target = undoTankRef.current || activeTankId;
    setTanks((prev) => prev.map((tk) => (tk.id === (target || (prev[0] && prev[0].id)) ? { ...tk, ...(typeof updater === "function" ? updater(tk) : updater) } : tk)));
  });

  // Mutating a tank by id rather than "whichever is open". The round shows work
  // across every tank, so ticking a job off has to land on the tank that job
  // belongs to — using updateActiveTank there would silently mark the wrong
  // tank's carbon as changed.
  const updateTankById = useStableCallback((tankId, updater) => {
    if (!tankId) return;
    setTanks((prev) => prev.map((tk) => (tk.id === tankId ? { ...tk, ...(typeof updater === "function" ? updater(tk) : updater) } : tk)));
  });

  // ── Persistence ────────────────────────────────────────────────────────────
  // State is the source of truth; these effects mirror it to disk. Every write
  // in the app used to be fired by hand from the handler that changed the
  // state — often from inside the setState updater itself — which had three
  // problems this replaces:
  //
  //   * Correctness. Updaters must be pure. React can invoke one twice, or
  //     discard the result and re-run it, so a write in there is a write that
  //     may double up, or persist state that never commits.
  //   * Drift. Thirty-odd call sites each had to remember to write. Any handler
  //     that forgot lost the edit on relaunch — silently, and only for
  //     whichever field it forgot.
  //   * Cost. Each one hit AsyncStorage immediately. A stepper drag serialised
  //     every tank, journal and photo URI once per tick.
  //
  // scheduleWrite coalesces bursts and flushes on backgrounding, so an effect
  // firing on every change of a slice is cheap.
  //
  // The `hydrated` guard matters: without it the first pass writes the initial
  // empty defaults straight over whatever is on disk, before the read has
  // finished — a factory reset on every launch.
  useEffect(() => {
    if (!hydrated) return;
    // pr_lastEdit is what stops an older cloud snapshot from overwriting newer
    // local work, so it's stamped whenever the tanks actually change.
    scheduleWrite("pr_lastEdit", () => String(Date.now()), "raw");
    scheduleWrite("pr_tanks", () => tanks, "commit");
  }, [tanks, hydrated]);

  useEffect(() => { if (hydrated && activeTankId) scheduleWrite("pr_activeTank", () => activeTankId, "raw"); }, [activeTankId, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_xp", () => String(xp), "raw"); }, [xp, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_activeDays", () => activeDays); }, [activeDays, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_careDone", () => careDone); }, [careDone, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_wishlist", () => wishlist); }, [wishlist, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_recent", () => recent); }, [recent, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_speciesNotes", () => speciesNotes); }, [speciesNotes, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_challengesDone", () => ({ date: getTodayKey(), ids: challengesDone })); }, [challengesDone, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_reminders", () => reminderPrefs); }, [reminderPrefs, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_profileName", () => profileName, "raw"); }, [profileName, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_banner", () => bannerId, "raw"); }, [bannerId, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_lang", () => lang, "raw"); }, [lang, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_unit", () => unit, "raw"); }, [unit, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_currency", () => currency, "raw"); }, [currency, hydrated]);
  useEffect(() => { if (hydrated && fodSeen) scheduleWrite("pr_fodSeen", () => fodSeen, "raw"); }, [fodSeen, hydrated]);
  useEffect(() => { if (hydrated && lastBackup) scheduleWrite("pr_lastBackup", () => String(lastBackup), "raw"); }, [lastBackup, hydrated]);
  useEffect(() => { if (hydrated && seenOnboarding) scheduleWrite("pr_onboarded", () => "1", "raw"); }, [seenOnboarding, hydrated]);
  useEffect(() => { if (hydrated && tankSized) scheduleWrite("pr_tankSized", () => "1", "raw"); }, [tankSized, hydrated]);
  useEffect(() => { if (hydrated) scheduleWrite("pr_doseStrengths", () => strengths); }, [strengths, hydrated]);

  // ── Android's back button ──────────────────────────────────────────────────
  // Nothing handled it. Species detail, disease detail and every non-Home tab
  // are conditional renders rather than routes, so the OS saw no navigation
  // stack and pressing back QUIT THE APP — from the middle of reading a care
  // sheet, with no warning. On Android that reads as a crash.
  //
  // The order mirrors what's visually on top, so back always closes the
  // nearest thing first. Returning false on Home is deliberate: that's the one
  // place where leaving the app is the right answer.
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const onBack = () => {
      if (showSearch) { setShowSearch(false); return true; }
      if (recordFor) { setRecordFor(null); return true; }
      if (tabMenu) { setTabMenu(null); return true; }
      if (showQuick) { setShowQuick(false); return true; }
      if (showTankMenu) { setShowTankMenu(false); return true; }
      if (showImport) { setShowImport(false); return true; }
      if (tankSheet) { setTankSheet(null); return true; }
      if (selectedDisease) { setSelectedDisease(null); return true; }
      if (selectedSpecies) { setSelectedSpecies(null); return true; }
      if (activeTab !== "home") { jumpTo("home"); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- jumpTo is stable; the deps here are the overlays whose open state decides what back does.
  }, [showSearch, recordFor, tabMenu, showQuick, showTankMenu, showImport, tankSheet, selectedDisease, selectedSpecies, activeTab]);

  // Grading reads the active tank's targets from a module-level value (the
  // same pattern as language and units), so it has to be re-pointed whenever
  // the active tank changes — otherwise switching from a reef to a fish-only
  // tank would keep grading against the reef's ranges.
  useEffect(() => { setActiveTargets(activeTank.targets || {}); }, [activeTank]);

  // Remote analytics boots only if a key is configured AND the user has opted
  // in; initTelemetry answers both questions itself and no-ops otherwise.
  useEffect(() => {
    let alive = true;
    (async () => {
      const on = await isOptedIn();
      if (alive) setTelemetryOn(on);
      await initTelemetry();
    })();
    return () => { alive = false; };
  }, []);

  // Drain the queue whenever the app leaves the foreground — the last moment
  // the OS reliably gives us before it can kill the process.
  useEffect(() => startAutoFlush(), []);

  // Writes failing is the one failure that destroys this app's whole promise,
  // and it used to happen in total silence — the reading stayed on screen
  // because it was still in memory, and the next launch had none of it.
  const [writeFailing, setWriteFailing] = useState(false);
  useEffect(() => onWriteFailure(() => setWriteFailing(true)), []);

  // Anything captured but not yet sent goes out with the same backgrounding
  // signal that flushes local writes.
  //
  // The cloud push rides along for the same reason. It's debounced 2.5s so a
  // burst of edits is one write, and the effect's cleanup cancels that timer —
  // so logging a reading and immediately swiping the app away meant the push
  // never happened. The local write survived (that flushes here too), but the
  // account didn't have it until the next unrelated edit fired a new timer.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      flushTelemetry().catch(() => {});
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
        syncNow().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [syncNow]);

  // ── User-level settings ──
  // Store what the module actually accepted, not what it was handed. These
  // arrive from imports and synced profiles as well as from the picker, and
  // setUnit already rejects anything it doesn't know — but the React state used
  // to keep the raw value, so the singleton said "imperial" while the state
  // said "banana", no pill looked selected, and the junk was persisted.
  const changeUnit = useStableCallback((u) => { setUnit(u); setUnitState(getUnit()); });
  // Symbol only — the app has no exchange rates and the figures a keeper typed
  // are already in their own money. Switching relabels; it never converts.
  const changeCurrency = useStableCallback((c) => { setCurrency(c); setCurrencyState(getCurrency()); });
  const changeLanguage = useStableCallback((code) => { setLanguage(code); setLangState(getLanguage()); });
  // Turning a reminder on is the moment a permission prompt makes sense — the
  // user has just asked to be reminded, so the ask has obvious context.
  const changeReminders = useStableCallback((next) => {
    setReminderPrefs(next);
    const wantsAny = ["waterTest", "waterChange", "feeding"].some((k) => next[k] && next[k] !== "off");
    if (wantsAny) requestPermission().catch(() => {});
  });
  // Buys Premium. The app never sets entitlement itself — it asks the store,
  // and the resulting CustomerInfo is what flips the flag.
  const buyPremium = useStableCallback(async (plan) => {
    if (buying || !plan || !plan.pkg) return;
    setBuying(true);
    try {
      track(EVENTS.PAYWALL_CTA, paywallReason);
      const res = await purchasePackage(plan.pkg);
      if (res.cancelled) { track(EVENTS.PURCHASE_CANCELLED); return; }
      if (res.entitled) {
        successHaptic();
        track(EVENTS.PURCHASE_SUCCESS);
        setPremiumUnlocked(true);
        Alert.alert("Welcome to Premium 👑", "Everything's unlocked. Thanks for supporting Pocket Reef.");
        return;
      }
      if (res.ok) return;

      // Not every failure is one. Someone who already owns this was being told
      // "Purchase failed", and a purchase waiting on Ask to Buy approval looked
      // to a parent and child like the thing they just set up was broken.
      const f = friendlyPurchaseError(res);
      if (f.outcome === OUTCOME.owned) {
        successHaptic();
        setPremiumUnlocked(true);
        Alert.alert(f.title, f.message);
        return;
      }
      if (f.outcome === OUTCOME.pending) {
        Alert.alert(f.title, f.message);
        return;
      }
      if (f.outcome === OUTCOME.cancelled) { track(EVENTS.PURCHASE_CANCELLED); return; }
      failureHaptic();
      track(EVENTS.PURCHASE_FAILED);
      Alert.alert(f.title, f.message);
    } finally {
      setBuying(false);
    }
  });

  // Debug-only entitlement override, for testing gated screens without a
  // sandbox purchase. __DEV__ is compile-time, so this is dead code in release.
  const setPremium = (on) => {
    if (!__DEV__) return;
    tapHaptic("medium");
    setPremiumUnlocked(!!on);
  };
  const toggleWishlist = useStableCallback((name) => {
    tapHaptic("light");
    setWishlist((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  });
  const goPremium = useStableCallback((reason) => {
    const r = typeof reason === "string" ? reason : null;
    if (r) track(EVENTS.GATE_HIT, r);
    track(EVENTS.PAYWALL_VIEW, r);
    setPaywallReason(r);
    setSelectedSpecies(null);
    setSelectedDisease(null);
    setActiveTab("premium");
  });
  const finishOnboarding = useStableCallback(({ gallons, water, seedStock } = {}) => {
    const patch = {};
    if (gallons) patch.gallons = gallons;
    if (water) patch.water = water;

    // Onboarding shows real recommendations for the tank the user just
    // described, and then used to drop them into an empty tank — throwing away
    // the one thing that had just proved the app works. If they asked for it,
    // seed the stock from the same generator the Tank planner uses.
    if (seedStock) {
      const plan = generateStockingPlan({ gallons: gallons || 20, water: water || "fresh", experience: "beginner" });
      if (plan.ok) {
        patch.stock = plan.stock;
        patch.quantities = plan.quantities;
      }
    }

    if (gallons) setTankSized(true);
    if (Object.keys(patch).length) updateActiveTank(patch);
    setSeenOnboarding(true);
    track(EVENTS.ONBOARD_DONE);
    if (seedStock) setActiveTab("tank");
  });

  const recordActivity = useStableCallback((points) => {
    const today = getTodayKey();
    setActiveDays((prev) => (prev.includes(today) ? prev : [...prev, today].slice(-400)));
    setXp((prev) => prev + points);
  });
  const toggleCare = useStableCallback((taskId) => {
    tapHaptic("light");
    const today = getTodayKey();
    const todayList = careDone[today] || [];
    const has = todayList.includes(taskId);
    // Pruned on write. Nothing reads any day but today, and an unpruned map
    // followed the keeper into every sync, export and restore point.
    const next = pruneDayMap({ ...careDone, [today]: has ? todayList.filter((x) => x !== taskId) : [...todayList, taskId] });
    setCareDone(next);
    if (!has) recordActivity(2);
  });

  // ── Undo ───────────────────────────────────────────────────────────────────
  // Offers a few seconds to take back a delete. Every caller passes a restore
  // closure that captures the *value* it removed, not an index — by the time
  // Undo is tapped the list has moved on, and an index would put the entry back
  // in the wrong place or over the top of something else.
  const showUndo = useStableCallback((message, restore, icon = "trash-outline") =>
    // The tank is captured here, when the action happens, rather than read back
    // when Undo is tapped.
    setUndo({ id: Date.now(), message, icon, onUndo: restore, tankId: activeTankId }));
  const runUndo = useStableCallback(() => {
    if (undo && undo.onUndo) {
      undoTankRef.current = undo.tankId || null;
      // finally, not just after: a restore that throws must not leave every
      // later write pointed at a tank the keeper closed minutes ago.
      try { undo.onUndo(); } finally { undoTankRef.current = null; }
    }
    setUndo(null);
  });

  // ── Active-tank data actions ──
  const changeTankGallons = useStableCallback((g) => { setTankSized(true); updateActiveTank({ gallons: g }); });
  const toggleTank = useStableCallback((name) => {
    commitHaptic();
    // Free accounts stop at FREE_STOCK_LIMIT fish. Removing is always allowed —
    // a cap that traps you above it is worse than no cap.
    const stocked = (activeTank.stock || []).includes(name);
    if (!premiumUnlocked && !stocked && (activeTank.stock || []).length >= FREE_STOCK_LIMIT) {
      warningHaptic();
      track(EVENTS.STOCK_CAP_HIT);
      Alert.alert(
        "Free plan holds 5 fish",
        `You've saved ${FREE_STOCK_LIMIT} — upgrade to Premium for unlimited stock, plus compatibility, bioload, and the full logging toolkit.`,
        [{ text: "Maybe later", style: "cancel" }, { text: "See Premium", onPress: () => goPremium("stockCap") }]
      );
      return;
    }
    // Say something BEFORE the fish goes in. The warnings on Home have always
    // caught a bad addition, but they catch it after the animal is bought,
    // which is the one point at which the advice is useless. A note (schooling
    // minimums) is informational and never interrupts; a real problem asks.
    if (!stocked) {
      const verdict = assessAddition(name, {
        tank: activeTank.stock || [],
        tankGallons: activeTank.gallons,
        tankWater: activeTank.water,
      });
      if (verdict.severity === "blocked" || verdict.severity === "warn") {
        warningHaptic();
        Alert.alert(
          verdict.title,
          verdict.reason,
          verdict.severity === "blocked"
            // Nothing survives the wrong salinity, so there is no "anyway".
            ? [{ text: "OK", style: "cancel" }]
            : [
                { text: "Cancel", style: "cancel" },
                // The keeper's tank, the keeper's call — a quarantine tank is
                // deliberately undersized, and refusing to record what's
                // actually swimming teaches people to stop telling the truth.
                { text: "Add anyway", style: "destructive", onPress: () => applyStockToggle(name) },
              ]
        );
        return;
      }
    }
    applyStockToggle(name);
  });

  // The actual mutation, split out so the confirmation above can call it once
  // the keeper has said yes. Still a toggle — removal comes through here too,
  // and removal is never gated.
  const applyStockToggle = useStableCallback((name) => {
    const stocked = (activeTank.stock || []).includes(name);
    // Capture the count before it's dropped, so undo puts back "6× Neon Tetra"
    // rather than a single fish.
    const priorQty = (activeTank.quantities || {})[name];
    const priorRecord = (activeTank.stockMeta || {})[name];
    updateActiveTank((tk) => {
      const has = tk.stock.includes(name);
      const stock = has ? tk.stock.filter((n) => n !== name) : [...tk.stock, name];
      const quantities = { ...(tk.quantities || {}) };
      const stockMeta = { ...(tk.stockMeta || {}) };
      if (has) {
        delete quantities[name]; // drop count when a species leaves the tank
        // The record is deliberately NOT deleted here. A removal with a reason
        // goes through recordLoss; a bare toggle-off is a correction, and
        // keeping the record means re-adding the same fish doesn't silently
        // reset the date you've had it.
      } else if (!stockMeta[name]) {
        // Adding a fish dates it automatically. Nobody fills in a form to add
        // a fish, but everybody wants to know how long they've had it.
        stockMeta[name] = newStockRecord();
      }
      return { stock, quantities, stockMeta };
    });
    if (stocked) {
      showUndo(`Removed ${name} from ${activeTank.name || "your tank"}`, () => {
        updateActiveTank((tk) => ({
          stock: tk.stock.includes(name) ? tk.stock : [...tk.stock, name],
          quantities: priorQty != null ? { ...(tk.quantities || {}), [name]: priorQty } : tk.quantities,
          stockMeta: priorRecord ? { ...(tk.stockMeta || {}), [name]: priorRecord } : tk.stockMeta,
        }));
      }, "fish-outline");
    }
  });
  // Dates every name that doesn't already have a record, leaving existing ones
  // alone. Bulk paths (a stocking plan, a tank idea) used to add fish with no
  // record, so a tank built from a plan started life completely undocumented.
  const datedMeta = (existing, names) => {
    const next = { ...(existing || {}) };
    (names || []).forEach((n) => { if (!next[n]) next[n] = newStockRecord(); });
    return next;
  };

  // Editing what's known about an animal — where it came from, what it cost,
  // when it actually went in. Merged, so filling one field never wipes the rest.
  const setStockRecord = useStableCallback((name, patch) => {
    updateActiveTank((tk) => ({
      stockMeta: { ...(tk.stockMeta || {}), [name]: { ...newStockRecord(), ...((tk.stockMeta || {})[name] || {}), ...patch } },
    }));
  });

  // Removing an animal *with* a reason. This is the record the app used to
  // destroy: a tank's mortality history is the most diagnostic thing a keeper
  // owns, and "delete the fish" threw it away.
  // What the record can say about a death, shown once, right after it's logged.
  const [lossReview, setLossReview] = useState(null);

  const recordLoss = useStableCallback(({ name, reason, cause, count, notes }) => {
    const record = (activeTank.stockMeta || {})[name] || null;
    const qty = (activeTank.quantities || {})[name] || 1;
    const n = Math.max(1, Math.min(qty, Math.round(Number(count) || 1)));
    const entry = newLoss({ name, reason, cause, count: n, notes, record });
    // Carry the price forward so spend-to-date survives the animal leaving.
    if (record && typeof record.price === "number") entry.price = record.price;

    // Reviewed against the tank as it stood, including the animal being
    // recorded — its tenure and its tankmates are the point.
    const review = reviewLoss(entry, activeTank, {
      waterType: resolveWaterType(activeTank.stock || [], activeTank.water || "fresh"),
    });

    const removesAll = n >= qty;
    updateActiveTank((tk) => {
      const quantities = { ...(tk.quantities || {}) };
      const stockMeta = { ...(tk.stockMeta || {}) };
      let stock = tk.stock;
      if (removesAll) {
        stock = tk.stock.filter((x) => x !== name);
        delete quantities[name];
        delete stockMeta[name];
      } else {
        // Losing three of a school of six leaves three fish, not none.
        quantities[name] = qty - n;
      }
      return { stock, quantities, stockMeta, losses: capped([entry, ...(tk.losses || [])], CAPS.losses) };
    });

    if (isMortality(reason)) warningHaptic(); else commitHaptic();
    showUndo(
      `${n}\u00d7 ${name} recorded as ${reason === "died" ? "lost" : reason}`,
      () => updateActiveTank((tk) => ({
        stock: tk.stock.includes(name) ? tk.stock : [...tk.stock, name],
        quantities: { ...(tk.quantities || {}), [name]: qty },
        stockMeta: record ? { ...(tk.stockMeta || {}), [name]: record } : tk.stockMeta,
        losses: (tk.losses || []).filter((l) => l.id !== entry.id),
      })),
      isMortality(reason) ? "heart-dislike-outline" : "swap-horizontal-outline"
    );

    // Only when there's something worth saying. A sheet that opens on every
    // loss to say "nothing to report" is a sheet people learn to dismiss
    // before reading, which costs them the one time it matters.
    if (review.ok && review.mortality && review.findings.length) {
      setLossReview({ review, name });
    }
  });

  const deleteLoss = useStableCallback((id) => {
    const gone = (activeTank.losses || []).find((l) => l.id === id);
    updateActiveTank((tk) => ({ losses: (tk.losses || []).filter((l) => l.id !== id) }));
    if (gone) showUndo("Record deleted", () => updateActiveTank((tk) => ({ losses: [gone, ...(tk.losses || []).filter((l) => l.id !== id)] })), "document-outline");
  });

  // Per-tank parameter targets. Passing null for a key restores the built-in.
  const setTarget = useStableCallback((key, target) => {
    updateActiveTank((tk) => {
      const targets = { ...(tk.targets || {}) };
      if (target == null) delete targets[key]; else targets[key] = target;
      return { targets };
    });
  });
  const setAllTargets = useStableCallback((targets) => updateActiveTank({ targets: targets || {} }));

  const setQuantity = useStableCallback((name, n) => {
    const q = Math.max(1, Math.min(999, Math.round(n) || 1));
    updateActiveTank((tk) => ({ quantities: { ...(tk.quantities || {}), [name]: q } }));
  });
  // A logged test is sorted by date, not just prepended, so a backfilled
  // reading from last Tuesday lands where it belongs instead of at the top —
  // every delta, trend and forecast reads position 0 as "most recent".
  const sortTests = (list) => [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const logTest = useStableCallback((entry) => {
    updateActiveTank((tk) => ({ waterTests: capped(sortTests([entry, ...tk.waterTests]), CAPS.waterTests) }));
    recordActivity(10);
  });

  // Correcting a stored reading. There was no route to this at all: a pH typed
  // as 8.7 instead of 8.1 passes the plausibility check and is then permanent,
  // silently wrong in every average and forecast built on it afterwards.
  const updateTest = useStableCallback((index, entry) => {
    const prior = (activeTank.waterTests || [])[index];
    updateActiveTank((tk) => {
      const next = [...(tk.waterTests || [])];
      if (index < 0 || index >= next.length) return {};
      next[index] = entry;
      return { waterTests: sortTests(next) };
    });
    if (prior) {
      showUndo("Test corrected", () => updateActiveTank((tk) => ({
        waterTests: sortTests((tk.waterTests || []).map((t) => (t === entry ? prior : t))),
      })), "flask-outline");
    }
  });

  const deleteTest = useStableCallback((index) => {
    const gone = (activeTank.waterTests || [])[index];
    if (!gone) return;
    updateActiveTank((tk) => ({ waterTests: (tk.waterTests || []).filter((_, i) => i !== index) }));
    showUndo(`Test from ${gone.date} deleted`, () => updateActiveTank((tk) => ({
      waterTests: sortTests([gone, ...(tk.waterTests || [])]),
    })), "flask-outline");
  });
  // ── Treatments ─────────────────────────────────────────────────────────────
  // A course lives on the tank, because "which tank is being treated" is the
  // whole point — the same disease in two tanks is two separate courses.
  const startTreatment = useStableCallback((diseaseName) => {
    updateActiveTank((tk) => {
      const others = (tk.treatments || []).filter((t) => t.disease !== diseaseName);
      return { treatments: [...others, { disease: diseaseName, startedAt: new Date().toISOString(), doneSteps: [] }] };
    });
    recordActivity(3);
  });

  const toggleTreatmentStep = useStableCallback((diseaseName, stepId) => {
    updateActiveTank((tk) => ({
      treatments: (tk.treatments || []).map((t) => {
        if (t.disease !== diseaseName) return t;
        const done = t.doneSteps || [];
        return { ...t, doneSteps: done.includes(stepId) ? done.filter((id) => id !== stepId) : [...done, stepId] };
      }),
    }));
  });

  const stopTreatment = useStableCallback((diseaseName) => {
    updateActiveTank((tk) => ({ treatments: (tk.treatments || []).filter((t) => t.disease !== diseaseName) }));
  });

  const addJournal = useStableCallback((entry) => { updateActiveTank((tk) => ({ journal: capped([entry, ...tk.journal], CAPS.journal) })); recordActivity(5); });
  const deleteJournal = useStableCallback((id) => {
    const gone = (activeTank.journal || []).find((e) => e.id === id);
    updateActiveTank((tk) => ({ journal: tk.journal.filter((e) => e.id !== id) }));
    if (!gone) return;
    // The photo file outlives the entry until undo expires — deleting it here
    // would make "Undo" restore an entry pointing at nothing.
    let undone = false;
    showUndo("Journal entry deleted", () => {
      undone = true;
      updateActiveTank((tk) => ({ journal: [gone, ...tk.journal.filter((e) => e.id !== id)] }));
    }, "book-outline");
    if (gone.photo) {
      setTimeout(() => { if (!undone) forgetPhoto(gone.photo).catch(() => {}); }, UNDO_WINDOW_MS);
    }
  });
  const editJournal = useStableCallback((id, patch) => updateActiveTank((tk) => ({ journal: tk.journal.map((e) => (e.id === id ? { ...e, ...patch } : e)) })));
  const addCost = useStableCallback((entry) => updateActiveTank((tk) => ({ costs: capped([entry, ...tk.costs], CAPS.costs) })));
  const deleteCost = useStableCallback((id) => {
    const gone = (activeTank.costs || []).find((c) => c.id === id);
    updateActiveTank((tk) => ({ costs: tk.costs.filter((c) => c.id !== id) }));
    if (gone) showUndo("Cost deleted", () => updateActiveTank((tk) => ({ costs: [gone, ...tk.costs.filter((c) => c.id !== id)] })), "cash-outline");
  });
  // Marking a job done overwrites its last-done date, and that date is the only
  // record of when the work actually happened. Every other logging action in
  // the app is undoable; this one silently destroyed a 90-day counter on a
  // mis-tap — and the round, being a dense column of Done buttons, makes
  // mis-taps more likely rather than less.
  const markJobDone = useStableCallback((tankId, taskId, label) => {
    const target = tanks.find((tk) => tk.id === tankId) || activeTank;
    const prior = (target.maintenance || {})[taskId] || null;
    tapHaptic();
    updateTankById(tankId, (tk) => ({ maintenance: { ...tk.maintenance, [taskId]: new Date().toISOString() } }));
    recordActivity(2);
    showUndo(
      `Marked ${label || "job"} done`,
      () => updateTankById(tankId, (tk) => {
        const next = { ...(tk.maintenance || {}) };
        // No prior date means the job had never been logged — restoring must
        // remove the key, not leave today's date behind.
        if (prior) next[taskId] = prior; else delete next[taskId];
        return { maintenance: next };
      }),
      "checkmark-done-outline"
    );
  });

  const logMaintenance = useStableCallback((taskId) => markJobDone(activeTankId, taskId));
  // ── Equipment ──────────────────────────────────────────────────────────────
  // ── Supplies ───────────────────────────────────────────────────────────────
  // Stock changes are a running count rather than a log: what matters is how
  // much is on the shelf now, and the usage rate is derived from the water
  // changes and doses already recorded rather than from these edits.
  const addInventory = useStableCallback((item) => {
    if (!item) return;
    updateActiveTank((tk) => ({ inventory: [...(tk.inventory || []), item] }));
  });

  const removeInventory = useStableCallback((id) => {
    const gone = (activeTank.inventory || []).find((i) => i.id === id);
    if (!gone) return;
    updateActiveTank((tk) => ({ inventory: (tk.inventory || []).filter((i) => i.id !== id) }));
    showUndo(`Removed ${gone.name}`, () => updateActiveTank((tk) => ({ inventory: [...(tk.inventory || []), gone] })), "cube-outline");
  });

  const setInventoryStock = useStableCallback((id, stock) => {
    const next = Math.max(0, Number(stock) || 0);
    updateActiveTank((tk) => ({ inventory: (tk.inventory || []).map((i) => (i.id === id ? { ...i, stock: next } : i)) }));
  });

  // Everything in memory is now older than what's on disk, so it's all re-read.
  // cloudLoaded is reset too: without it the next sync would treat the restored
  // data as already-reconciled and push the pre-restore snapshot back up.
  const handleRestored = useStableCallback(async () => {
    cloudLoaded.current = false;
    await hydrateAll();
  });

  // A clearance check is the keeper's judgement, recorded against the arrival.
  const logMedDose = useStableCallback((entry) => {
    if (!entry) return;
    updateActiveTank((tk) => ({ medDoses: capped([entry, ...(tk.medDoses || [])], CAPS.medDoses) }));
  });

  const deleteMedDose = useStableCallback((id) => {
    const gone = (activeTank.medDoses || []).find((d) => d.id === id);
    updateActiveTank((tk) => ({ medDoses: (tk.medDoses || []).filter((d) => d.id !== id) }));
    if (gone) showUndo(`Removed the ${gone.amount} ${gone.unit} dose`, () => updateActiveTank((tk) => ({ medDoses: [gone, ...(tk.medDoses || []).filter((d) => d.id !== id)] })), "flask-outline");
  });

  const setQuarantineCheck = useStableCallback((id, checkId, value) => {
    updateActiveTank((tk) => ({
      quarantine: (tk.quarantine || []).map((q) =>
        q.id === id ? { ...q, checks: { ...(q.checks || {}), [checkId]: value } } : q
      ),
    }));
  });

  // A tank's own cadence. Undefined values mean "follow the account default",
  // so clearing an override is the same gesture as never setting one.
  const setTankReminders = useStableCallback((next) => {
    const clean = {};
    Object.entries(next || {}).forEach(([k, v]) => { if (v) clean[k] = v; });
    updateActiveTank({ reminders: clean });
  });

  const setLightSchedule = useStableCallback((schedule) => {
    if (!schedule) return;
    const prior = activeTank.lightSchedule;
    updateActiveTank({ lightSchedule: schedule });
    // Only when there was a real schedule to lose. Setting one for the first
    // time isn't destructive and an undo bar for it is just noise.
    if (prior && (prior.on || prior.off)) {
      showUndo("Light schedule changed", () => updateActiveTank({ lightSchedule: prior }), "bulb-outline");
    }
  });

  // Describing an existing tank is a patch, never a replacement — the tank
  // already has an id that other records point at.
  const setupExistingTank = useStableCallback((patch) => {
    if (!patch) return;
    updateActiveTank((tk) => ({
      ...patch,
      // A backfilled reading joins the history rather than replacing it.
      waterTests: patch.waterTests ? [...patch.waterTests, ...(tk.waterTests || [])] : tk.waterTests,
    }));
    setTankSized(true);
  });

  const addObservationFor = useStableCallback((name, observation) => {
    updateActiveTank((tk) => ({ observations: addObservation(tk.observations || {}, name, observation) }));
    recordActivity(2);
  });

  const removeObservationFor = useStableCallback((name, id) => {
    // Undoable like everything else destructive in the app. An observation can
    // carry a photograph and half a growth series, and deleting one used to be
    // the only irreversible tap on the species screen.
    const gone = ((activeTank.observations || {})[name] || []).find((o) => o.id === id);
    updateActiveTank((tk) => ({ observations: removeObservation(tk.observations || {}, name, id) }));
    if (gone) {
      showUndo(`Observation deleted`, () => updateActiveTank((tk) => ({
        observations: addObservation(tk.observations || {}, name, gone),
      })), "eye-outline");
    }
  });

  const setSourceWater = useStableCallback((profile) => {
    if (!profile) return;
    const prior = activeTank.sourceWater;
    updateActiveTank({ sourceWater: profile });
    // A source-water profile is a test somebody actually ran; overwriting it
    // by mistake means running it again.
    if (prior && Object.keys(prior.values || {}).length) {
      showUndo("Source water updated", () => updateActiveTank({ sourceWater: prior }), "water-outline");
    }
  });

  // Imported readings merge with what's already there and are re-sorted, so a
  // decade of backfilled history lands in date order rather than on top.
  const importTests = useStableCallback((entries) => {
    if (!entries || !entries.length) return;
    createRestorePoint("Before importing readings").catch(() => {});
    updateActiveTank((tk) => {
      const existing = tk.waterTests || [];
      const seen = new Set(existing.map((t) => t && t.date));
      const fresh = entries.filter((e) => !seen.has(e.date));
      const waterTests = [...fresh, ...existing].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      // Somebody importing four years of readings has a four-year-old tank
      // whether they said so or not. Without this the app accepted the history
      // and went on calling the tank new — "still cycling", maturity day one —
      // contradicting the data it had just been handed.
      const inferred = inferCreatedAt({ ...tk, waterTests });
      const patch = { waterTests };
      if (inferred && (!tk.createdAt || inferred < tk.createdAt)) patch.createdAt = inferred;
      return patch;
    });
  });

  const addEquipment = useStableCallback((item) => {
    if (!item) return;
    updateActiveTank((tk) => ({ equipment: [...(tk.equipment || []), item] }));
  });

  const removeEquipment = useStableCallback((item) => {
    if (!item) return;
    updateActiveTank((tk) => ({ equipment: (tk.equipment || []).filter((e) => e.id !== item.id) }));
    showUndo(`Removed ${item.name}`, () => updateActiveTank((tk) => ({ equipment: [...(tk.equipment || []), item] })), "construct-outline");
  });

  // ── Dosing ─────────────────────────────────────────────────────────────────
  // Doses live on the tank; product strengths are a user-level setting because
  // the bottle on the shelf is the same bottle whichever tank it feeds.
  const logDose = useStableCallback((dose) => {
    if (!dose) return;
    updateActiveTank((tk) => ({ doses: capped([dose, ...(tk.doses || [])], CAPS.doses) }));
    recordActivity(2);
    showUndo(
      `Logged ${dose.ml}ml`,
      () => updateActiveTank((tk) => ({ doses: (tk.doses || []).filter((d) => d.id !== dose.id) })),
      "flask-outline"
    );
  });

  // A water change is now a record as well as a tick. The tick still drives the
  // due date; the record is what answers "how much have I actually changed?".
  const logWaterChange = useStableCallback((info) => {
    markJobDone(activeTankId, "waterchange", "Water change");
    const entry = newWaterChange({ pct: info && info.pct, gallons: info && info.gallons });
    if (entry) updateActiveTank((tk) => ({ waterChanges: capped([entry, ...(tk.waterChanges || [])], CAPS.waterChanges) }));
    addJournal({
      id: Date.now(),
      date: getTodayKey(),
      // The journal entry is permanent and gets read back years later, so it
      // carries the keeper's own unit rather than a hardcoded "gal".
      text: `Water change${entry && entry.pct ? ` (~${entry.pct}%, ${entry.gallons ? formatVolume(entry.gallons) : "?"})` : ""}`,
      mood: "🛠️",
      photo: null,
    });
  });

  const deleteDose = useStableCallback((id) => {
    const gone = (activeTank.doses || []).find((d) => d.id === id);
    if (!gone) return;
    updateActiveTank((tk) => ({ doses: (tk.doses || []).filter((d) => d.id !== id) }));
    showUndo(`Removed ${gone.ml}ml dose`, () => updateActiveTank((tk) => ({ doses: [gone, ...(tk.doses || [])] })), "flask-outline");
  });

  const setDoseStrength = useStableCallback((key, value) => {
    const n = Number(value);
    setStrengths((prev) => {
      const next = { ...prev };
      if (!value || Number.isNaN(n) || n <= 0) delete next[key]; else next[key] = n;
      return next;
    });
  });

  // ── Upkeep ─────────────────────────────────────────────────────────────────
  // Definitions live in tank.upkeep; last-done stays in tank.maintenance, so
  // logMaintenance() already handles ticking any of these off.
  const addUpkeepTask = useStableCallback((task) => {
    if (!task) return;
    updateActiveTank((tk) => ({ upkeep: [...(tk.upkeep || []), task] }));
  });

  // Removing a custom task deletes it; removing a built-in just switches it off
  // for this tank, because the definition isn't ours to delete.
  const removeUpkeepTask = useStableCallback((task) => {
    if (!task) return;
    updateActiveTank((tk) => {
      const list = [...(tk.upkeep || [])];
      if (task.custom) return { upkeep: list.filter((t) => t.id !== task.id) };
      const existing = list.findIndex((t) => t.id === task.id);
      if (existing >= 0) list[existing] = { ...list[existing], disabled: true };
      else list.push({ id: task.id, label: task.label, disabled: true });
      return { upkeep: list };
    });
    showUndo(
      task.custom ? `Deleted "${task.label}"` : `Hid "${task.label}" for this tank`,
      () => updateActiveTank((tk) => {
        const list = (tk.upkeep || []).filter((t) => t.id !== task.id);
        return { upkeep: task.custom ? [...list, task] : list };
      }),
      "construct-outline"
    );
  });

  // Changing how often a job comes round. A built-in is overridden by storing a
  // partial entry under the same id rather than copying the whole definition.
  const setUpkeepInterval = useStableCallback((task, days) => {
    const n = newUpkeepTask({ label: task.label, days });
    if (!n) return;
    updateActiveTank((tk) => {
      const list = [...(tk.upkeep || [])];
      const at = list.findIndex((t) => t.id === task.id);
      if (at >= 0) list[at] = { ...list[at], days: n.days };
      else list.push({ id: task.id, label: task.label, days: n.days, custom: !!task.custom, emoji: task.emoji, kind: task.kind });
      return { upkeep: list };
    });
  });

  const addQuarantine = useStableCallback((entry) => updateActiveTank((tk) => ({ quarantine: capped([entry, ...tk.quarantine], CAPS.quarantine) })));
  const removeQuarantine = useStableCallback((id) => {
    // Removing an arrival discards a running clock and every clearance check
    // ticked against it — three weeks of watching, on one tap.
    const gone = (activeTank.quarantine || []).find((q) => q.id === id);
    updateActiveTank((tk) => ({ quarantine: (tk.quarantine || []).filter((q) => q.id !== id) }));
    if (gone) {
      showUndo(`${gone.name} removed from quarantine`, () => updateActiveTank((tk) => ({
        quarantine: [gone, ...(tk.quarantine || []).filter((q) => q.id !== id)],
      })), "eye-outline");
    }
  });
  const graduateQuarantine = useStableCallback((item) => updateActiveTank((tk) => {
    const canAdd = getSpecies(item.name) && !tk.stock.includes(item.name);
    const stockMeta = { ...(tk.stockMeta || {}) };
    // Graduating out of quarantine is the one moment the app knows exactly when
    // an animal came into your care — you started its 21-day clock. That date
    // was being thrown away, and the fish arrived in the display tank with no
    // record at all.
    if (canAdd && !stockMeta[item.name]) {
      stockMeta[item.name] = newStockRecord({
        addedAt: item.startDate ? String(item.startDate).slice(0, 10) : undefined,
        notes: item.startDate ? "Came through quarantine" : "",
      });
    }
    return { stock: canAdd ? [...tk.stock, item.name] : tk.stock, stockMeta, quarantine: tk.quarantine.filter((q) => q.id !== item.id) };
  }));
  // By id, for the notification handler: a "Fed" tapped from the lock screen
  // belongs to the tank the reminder was about, not the one left open.
  const addFeedingToTank = useStableCallback((tankId, entry) => {
    updateTankById(tankId, (tk) => ({ feedings: capped([entry, ...(tk.feedings || [])], CAPS.feedings) }));
    recordActivity(2);
  });
  const addFeeding = useStableCallback((entry) => { updateActiveTank((tk) => ({ feedings: capped([entry, ...(tk.feedings || [])], CAPS.feedings) })); recordActivity(2); });
  const deleteFeeding = useStableCallback((id) => {
    const gone = (activeTank.feedings || []).find((f) => f.id === id);
    updateActiveTank((tk) => ({ feedings: (tk.feedings || []).filter((f) => f.id !== id) }));
    if (gone) showUndo("Feeding deleted", () => updateActiveTank((tk) => ({ feedings: [gone, ...(tk.feedings || []).filter((f) => f.id !== id)] })), "restaurant-outline");
  });
  // Tank ideas write a whole stock list at once, so they'd walk straight past
  // the per-fish cap. Premium only.
  // A generated plan carries real group sizes, so quantities travel with it —
  // loading a plan that silently drops "6× Neon Tetra" to one fish would
  // recreate the exact schooling problem the planner exists to avoid.
  const loadStockingPlan = useStableCallback((plan) => {
    if (!premiumUnlocked) { goPremium("tankIdea"); return; }
    if (!plan || !plan.ok) return;
    tapHaptic("medium");
    updateActiveTank((tk) => ({ stock: plan.stock, quantities: plan.quantities, stockMeta: datedMeta(tk.stockMeta, plan.stock) }));
    setActiveTab("tank");
  });

  const loadTankIdea = useStableCallback((idea) => {
    if (!premiumUnlocked) { goPremium("tankIdea"); return; }
    tapHaptic("medium");
    updateActiveTank((tk) => ({ gallons: idea.gallons, stock: idea.species, quantities: {}, stockMeta: datedMeta(tk.stockMeta, idea.species) }));
    setActiveTab("tank");
  });
  // Emptying a whole tank in one tap is the single most destructive thing a
  // user can do by accident. It stays one tap — undo is what makes that safe.
  const clearStock = useStableCallback(() => {
    tapHaptic("medium");
    // Same reasoning as deleting a tank: undo dies with the session, and this
    // takes the stock list plus every count and per-animal record with it.
    if ((activeTank.stock || []).length) createRestorePoint("Before clearing stock").catch(() => {});
    const priorStock = [...(activeTank.stock || [])];
    const priorQty = { ...(activeTank.quantities || {}) };
    updateActiveTank({ stock: [], quantities: {} });
    if (priorStock.length) {
      showUndo(`Cleared ${priorStock.length} fish from ${activeTank.name || "your tank"}`, () => updateActiveTank({ stock: priorStock, quantities: priorQty }), "layers-outline");
    }
  });

  // ── Tank management (multiple tanks) ──
  const switchTank = useStableCallback((id) => { tapHaptic(); setActiveTankId(id); });
  const openNewTank = useStableCallback(() => {
    if (tanks.length >= 1 && !premiumUnlocked) { goPremium("secondTank"); return; }
    tapHaptic(); setTankSheet({ mode: "new" });
  });
  const openEditTank = useStableCallback((id) => { tapHaptic(); setTankSheet({ mode: "edit", id }); });
  const saveTank = useStableCallback((config) => {
    if (config && config.gallons) setTankSized(true);
    if (tankSheet && tankSheet.mode === "edit") {
      const next = tanks.map((tk) => (tk.id === tankSheet.id ? { ...tk, ...config } : tk));
      setTanks(next);
    } else {
      const nt = newTank(config.name && config.name.trim() ? config.name.trim() : `Tank ${tanks.length + 1}`, config.gallons || 20, config.water || "fresh", config.emoji || "🐠");
      if (config.notes) nt.notes = config.notes;
      const next = [...tanks, nt];
      setTanks(next);
      setActiveTankId(nt.id);
      setActiveTab("home");
    }
    setTankSheet(null);
  });
  const duplicateTank = useStableCallback((id) => {
    if (!premiumUnlocked) { goPremium("secondTank"); return; }
    const src = tanks.find((tk) => tk.id === id);
    if (!src) return;
    tapHaptic("medium");
    const copy = newTank(`${src.name} copy`, src.gallons, src.water, src.emoji);
    copy.stock = [...(src.stock || [])];
    copy.quantities = { ...(src.quantities || {}) };
    copy.notes = src.notes || "";
    const next = [...tanks, copy];
    setTanks(next);
    setActiveTankId(copy.id);
    setActiveTab("home");
  });
  const deleteTank = useStableCallback((id) => {
    if (tanks.length <= 1) return;
    tapHaptic();
    // Undo covers the mistap; it does not survive the app being closed. A tank
    // holds every reading, journal entry and photo ever written for it, so it
    // gets the same treatment as an import: a snapshot first, recoverable from
    // Profile weeks later.
    createRestorePoint("Before deleting a tank").catch(() => {});
    const gone = tanks.find((tk) => tk.id === id);
    const wasActive = activeTankId === id;
    const next = tanks.filter((tk) => tk.id !== id);
    setTanks(next);
    if (wasActive) setActiveTankId(next[0].id);
    // A tank carries every log, journal entry and photo the user has ever
    // written for it. Whole-tank deletion without a way back is the one thing
    // in the app that could lose years of history to a mistap.
    if (gone) {
      showUndo(`Deleted ${gone.name}`, () => {
        setTanks((prev) => (prev.some((tk) => tk.id === gone.id) ? prev : [...prev, gone]));
        if (wasActive) setActiveTankId(gone.id);
      }, "water-outline");
    }
  });

  const changeName = useStableCallback((name) => setProfileName(name));
  const exportData = useStableCallback(async () => {
    tapHaptic();
    // premiumUnlocked is deliberately NOT exported. Entitlement belongs to a
    // store account, not to a file — including it would imply a backup could
    // carry a subscription between people, which it can't and shouldn't.
    // Everything cloud sync round-trips, so a file backup is as complete as an
    // account. The old payload quietly omitted speciesNotes — text the user
    // wrote by hand — along with the tank's start date, recents, banner and
    // today's challenges. Someone who exported, reinstalled and imported lost
    // every note they'd written and had their tank's age reset.
    const payload = {
      app: "Pocket Reef", version: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
      profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, currency,
      strengths, tankSized,
    };
    try {
      // A real file, not a message body. The old export handed a megabyte of
      // JSON to the share sheet as text, where Messages truncates it, Mail
      // buries it and nothing can save it back out — which is the one thing a
      // backup is for. Falls back to the text share wherever there's no
      // filesystem, because a clumsy export beats a dead button.
      const file = await writeBackupFile(payload);
      const res = file.ok
        ? await Share.share({ url: file.uri, title: file.filename, message: file.filename })
        : await Share.share({ message: file.text });

      if (!res || res.action !== Share.dismissedAction) {
        setLastBackup(Date.now());
        // Only once the sheet has closed: pruning while a destination is still
        // being chosen would pull the file out from under it.
        if (file.ok) pruneOldBackups({ keep: file.filename }).catch(() => {});
      }
    } catch (e) {}
  });
  // Puts the pre-migration copy back and reloads state from it. The flag was
  // being set on a failed upgrade and read by nothing, so the backup existed
  // purely as disk usage.
  const restoreBackup = useStableCallback(async () => {
    if (restoringBackup) return;
    setRestoringBackup(true);
    try {
      const res = await restorePreMigrationBackup();
      if (!res.ok) {
        failureHaptic();
        Alert.alert("Couldn't restore", res.error || "Please try again.");
        return;
      }
      // Re-read the restored store rather than guessing at what changed.
      const stored = await commitJSON("pr_tanks", null);
      const list = ensureTanksShape(stored);
      if (list.length) {
        setTanks(list);
        setActiveTankId(list[0].id);
      }
      setSpeciesNotes(await getJSON("pr_speciesNotes", {}));
      setWishlist(await getJSON("pr_wishlist", []));
      // Existing installs carry however many days they accumulated.
      setCareDone(pruneDayMap(await getJSON("pr_careDone", {})));
      setMigrationFailed(false);
      successHaptic();
      Alert.alert("Restored", "Your data from before the update is back. The app will try the upgrade again next time it launches.");
    } finally {
      setRestoringBackup(false);
    }
  });

  const changeTelemetry = useStableCallback(async (on) => {
    tapHaptic();
    setTelemetryOn(on);
    await setOptIn(on);
  });

  // The paste-able tank report. Distinct from exportData, which produces a
  // JSON backup for the app to read back — this is the block a keeper hands to
  // a fish store or pastes into a forum thread, which is the export people
  // actually reach for and the app didn't have.
  const shareReport = useStableCallback(async () => {
    tapHaptic("medium");
    const text = buildTankReport(activeTank, { strengths });
    if (!text) return;
    try { await Share.share({ message: text }); } catch (e) { /* dismissed */ }
  });

  // Applies a validated payload. Split out so the confirmation step below can
  // call it once the user has actually agreed to overwrite.
  const applyImport = useStableCallback((p) => {
    try {
      // Overwrites everything the keeper owns. Snapshot first, so "I imported
      // the wrong file" is recoverable rather than terminal.
      createRestorePoint("Before importing a backup").catch(() => {});
      // Run imported tanks through the same normalization as stored ones. A
      // backup taken before a field existed would otherwise arrive missing it
      // and crash the first screen that reads it — which is exactly what
      // ensureTanksShape was written to prevent, and import wasn't using it.
      const tanksIn = ensureTanksShape(p.tanks);
      if (!tanksIn.length) return false;

      setTanks(tanksIn);
      // ensureTankShape guarantees an id, so this can't land on undefined.
      setActiveTankId(tanksIn[0].id);
      // typeof NaN is "number", and NaN XP propagates into the level, the
      // progress bar and every achievement that compares against it.
      if (Number.isFinite(p.xp) && p.xp >= 0) setXp(p.xp);
      // Day keys, and the streak engine filters and compares them as strings.
      if (Array.isArray(p.activeDays)) setActiveDays(p.activeDays.filter((d) => isValidDayKey(d)));
      // A map of day key -> list of task ids. Anything else is read as one by
      // `careDone[today] || []`, which quietly yields nothing for the day.
      if (p.careDone && typeof p.careDone === "object" && !Array.isArray(p.careDone)) {
        setCareDone(pruneDayMap(p.careDone));
      }
      if (Array.isArray(p.wishlist)) setWishlist(p.wishlist.filter((n) => typeof n === "string" && n.trim()));
      // Restored to match what export now writes — an import that silently
      // dropped half the file was the other half of the same bug.
      if (p.activeTankId && tanksIn.some((tk) => tk.id === p.activeTankId)) setActiveTankId(p.activeTankId);
      if (p.speciesNotes && typeof p.speciesNotes === "object") setSpeciesNotes(p.speciesNotes);
      if (Array.isArray(p.recent)) setRecent(p.recent.filter((n) => typeof n === "string" && n.trim()));
      if (typeof p.profileName === "string") setProfileName(p.profileName);
      // An unknown id leaves the profile hero with no banner at all.
      if (p.bannerId && BANNERS.some((b) => b.id === p.bannerId)) setBannerId(p.bannerId);
      if (p.strengths && typeof p.strengths === "object") setStrengths(p.strengths);
      if (typeof p.tankSized === "boolean") setTankSized(p.tankSized);
      if (typeof p.since === "number") { setSince(p.since); scheduleWrite("pr_since", () => String(p.since), "raw"); }
      if (p.challengesDone && Array.isArray(p.challengesDone.ids) && p.challengesDone.date === getTodayKey()) setChallengesDone(p.challengesDone.ids);
      else if (Array.isArray(p.challengesDone)) setChallengesDone(p.challengesDone);
      if (p.reminderPrefs) changeReminders(p.reminderPrefs);
      if (p.unit) changeUnit(p.unit);
      if (p.lang) changeLanguage(p.lang);
      setShowImport(false);
      return true;
    } catch (e) { return false; }
  });

  const importData = useStableCallback((raw) => {
    let p;
    try { p = JSON.parse(raw); } catch (e) { return false; }
    // Validate it's actually one of ours before touching anything.
    if (!p || typeof p !== "object") return false;
    if (p.app && p.app !== "Pocket Reef") return false;
    if (!Array.isArray(p.tanks) || !p.tanks.length) return false;

    const incoming = p.tanks.length;
    const existing = tanks.reduce((n, t) => n + (t.stock || []).length + (t.journal || []).length + (t.waterTests || []).length, 0);

    // Import REPLACES everything. Doing that silently to someone with real
    // history is the most destructive thing this app can do, so it asks first
    // — and only when there is actually something to lose.
    if (existing > 0) {
      Alert.alert(
        "Replace everything on this device?",
        `This backup has ${incoming} tank${incoming === 1 ? "" : "s"}. Importing replaces your current tanks, logs and journal on this device. This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: () => applyImport(p) },
        ]
      );
      return true; // the sheet closes; the work happens on confirm
    }
    return applyImport(p);
  });

  const setSpeciesNote = useStableCallback((nm, text) => {
    setSpeciesNotes((prev) => {
      const next = { ...prev, [nm]: text };
      if (!text) delete next[nm];
      return next;
    });
  });
  const markFodSeen = useStableCallback(() => {
    setFodSeen(getTodayKey());
  });
  const setBanner = useStableCallback((id) => { tapHaptic(); setBannerId(id); });
  // XP-only reward (games) — grants XP without touching the daily streak.
  const addXp = useStableCallback((n) => setXp((prev) => prev + n));
  const completeChallenge = useStableCallback((id) => {
    setChallengesDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
    recordActivity(3); // small reward for completing a challenge
  });
  const openSpecies = useStableCallback((name) => {
    tapHaptic();
    setSelectedSpecies(name);
    setRecent((prev) => [name, ...prev.filter((n) => n !== name)].slice(0, 12));
  });
  // Disease guides are Health-tab content, but they're also reachable from the
  // free Species tab's search results and from species detail. Gate the opener
  // itself, or locking the tab would only lock the front door.
  const openDisease = useStableCallback((name) => {
    tapHaptic();
    if (!premiumUnlocked) { goPremium("disease"); return; }
    setSelectedDisease(name);
  });
  // Every navigation in the app funnels through here — the tab bar, the More
  // sheet, Today-card deep links, and each screen's onGoToTab. Gating at this
  // one choke point is why a locked tab can't be reached by any route.
  const jumpTo = useStableCallback((id) => {
    tapHaptic();
    // Already here: the platform habit is that this returns you to the top
    // rather than doing nothing at all.
    if (id === activeTab) { setScrollSignal((n) => n + 1); return; }
    if (PREMIUM_TAB_IDS.has(id) && !premiumUnlocked) { goPremium(id); return; }
    setSelectedSpecies(null);
    setSelectedDisease(null);
    // A plain tab tap clears any shortcut intent, so yesterday's "Log a
    // feeding" doesn't keep re-selecting the Feeding tool every time the Log
    // tab is opened by hand. runAction re-sets it after calling through here.
    setIntent(null);
    setActiveTab(id);
  });
  // ── Running a shortcut ─────────────────────────────────────────────────────
  // One entry point for every fast path: the quick sheet, universal search and
  // the tab bar's long-press menus all call this with an action from
  // lib/shortcuts. Two kinds:
  //
  //   instant — writes the entry here and now, and offers undo. No navigation,
  //             so the user stays wherever they were.
  //   routed  — records an intent (which card to open, which tool to select)
  //             and hands off to jumpTo, which is still the only thing that
  //             decides whether the destination is allowed.
  const runAction = useStableCallback((action) => {
    const a = typeof action === "string" ? getAction(action) : action;
    if (!a) return;
    setShowQuick(false);
    setTabMenu(null);

    // The paywall check happens before the write, not after — an instant
    // action on a locked tab would otherwise log data the user can't then see.
    if (PREMIUM_TAB_IDS.has(a.tab) && !premiumUnlocked) { goPremium(a.tab); return; }

    if (a.instant && a.id === "feed") {
      // Repeat the last food rather than defaulting to Flake. Someone who
      // feeds frozen every day shouldn't have to correct the app every day.
      const food = (feedings[0] && feedings[0].food) || "Flake";
      const entry = { id: Date.now(), date: getTodayKey(), food, note: "" };
      addFeeding(entry);
      successHaptic();
      showUndo(`Logged a ${food.toLowerCase()} feeding`, () => deleteFeeding(entry.id), "restaurant-outline");
      return;
    }

    if (a.instant && a.id === "report") {
      shareReport();
      return;
    }

    if (a.instant && a.id === "waterchange") {
      const entry = { id: Date.now(), date: getTodayKey(), text: "Water change", mood: "🛠️", photo: null };
      const priorStamp = (activeTank.maintenance || {}).waterchange || null;
      logMaintenance("waterchange");
      addJournal(entry);
      successHaptic();
      showUndo("Logged a water change", () => {
        deleteJournal(entry.id);
        updateActiveTank((tk) => {
          const m = { ...(tk.maintenance || {}) };
          if (priorStamp) m.waterchange = priorStamp; else delete m.waterchange;
          return { maintenance: m };
        });
      }, "water-outline");
      return;
    }

    // Order matters: jumpTo clears the intent, so it has to run first.
    jumpTo(a.tab);
    setIntent({ tab: a.tab, card: a.card || null, tool: a.tool || null, nonce: Date.now() });
  });

  // Hoisted so the memoised screens see a stable prop. An inline arrow here is
  // a fresh identity every render, which makes React.memo on the receiving
  // screen a no-op — see __tests__/renderCost.test.js.
  const openImport = useStableCallback(() => setShowImport(true));
  const goHome = useStableCallback(() => jumpTo("home"));
  const openSpeciesPaywall = useStableCallback(() => goPremium("species"));

  // The whole evening round in one list, recomputed as things get ticked off.
  //
  // Premium-gated, and not as an upsell: upkeep, dosing and multi-tank all live
  // behind the wall, so showing a free account a badge listing its overdue
  // filter socks — and letting it tick them off — was a hole straight through
  // the paywall rather than a feature.
  //
  // Memoised because it walks every tank × every task and sorts, and App
  // re-renders on every transient state change (the undo bar, a sheet opening,
  // a timer). Recomputing the whole round to animate a snackbar is exactly the
  // waste the memoisation pass earlier existed to remove.
  const pending = useMemo(
    () => (premiumUnlocked
      ? pendingAcrossTanks(tanks, {
        reminderPrefs,
        waterTypeFor: (tk) => resolveWaterType(tk.stock || [], tk.water),
      })
      : []),
    [premiumUnlocked, tanks, reminderPrefs]
  );
  const pendingItems = flattenPending(pending);

  // Finishing an item from the sheet. Jobs complete in place; anything needing
  // real input routes to the form that collects it, because a one-tap "done"
  // on a water test would be recording a number nobody measured.
  const completePending = useStableCallback((item) => {
    if (!item) return;
    // Belt and braces behind the gate above: if a round item ever reaches here
    // on a free account by any other route, it still can't write.
    if (!premiumUnlocked) { goPremium("log"); return; }
    if (item.kind === "upkeep") {
      // Logged against the item's own tank, whichever tank is currently open,
      // and undoable like every other logging action.
      markJobDone(item.tankId, item.taskId, item.label);
      return; // sheet stays open — a round is several taps, not one
    }
    setShowQuick(false);
    // Anything that needs a form has to happen on that tank, so switch first.
    if (item.tankId && item.tankId !== activeTankId) switchTank(item.tankId);
    if (item.kind === "feed") { runAction(getAction("feed")); return; }
    if (item.kind === "test") { runAction(getAction("watertest")); return; }
    if (item.kind === "dose") { runAction(getAction("dose")); return; }
    if (item.kind === "qt") { jumpTo("tank"); return; }
  });

  const detailOpen = selectedSpecies || selectedDisease || tankSheet || showImport;
  // Chrome that belongs to the tab shell, not to a detail view or the paywall.
  // The floating button over a species detail would cover its Add-to-tank CTA,
  // and a header offering to switch tanks makes no sense on the auth screen.
  const shellVisible = !detailOpen && !(PREMIUM_TAB_IDS.has(activeTab) && !premiumUnlocked) && activeTab !== "premium";

  return (
    <SafeAreaProvider>
      <ScrollToTopContext.Provider value={scrollSignal}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <BackgroundDecoration />
        {/* Saving is broken. Shown above everything, unmissable and not
            dismissible, because carrying on logging into a device that isn't
            storing anything is worse than being interrupted. */}
        {writeFailing ? (
          <View style={{ backgroundColor: theme.danger, paddingTop: 52, paddingHorizontal: space.lg, paddingBottom: space.md }} accessibilityRole="alert">
            <Text style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
              Changes aren't saving
            </Text>
            <Text style={{ color: "#fff", fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>
              This device may be out of storage. Anything you log now could be lost — free up space, then reopen Pocket Reef. Your existing records are untouched.
            </Text>
            <Pressable
              onPress={() => { tapHaptic(); setWriteFailing(!writeHealth().ok); }}
              style={{ marginTop: space.sm, alignSelf: "flex-start" }}
              accessibilityRole="button"
              accessibilityLabel="Check whether saving works again"
            >
              <Text style={{ color: "#fff", fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", textDecorationLine: "underline" }}>
                Check again
              </Text>
            </Pressable>
          </View>
        ) : null}

        <LossReviewSheet
          visible={!!lossReview}
          review={lossReview && lossReview.review}
          name={lossReview && lossReview.name}
          onClose={() => setLossReview(null)}
          onGoToTab={jumpTo}
        />

        {/* The reset-password sheet rides above every state — the deep link can
            arrive whether or not someone is signed in. */}
        <WhatsNewSheet
          visible={showWhatsNew}
          seenVersion={seenVersion}
          currentVersion={appVersion()}
          onDismiss={dismissWhatsNew}
        />

        <ResetPasswordModal
          visible={showResetPassword}
          onDone={() => setShowResetPassword(false)}
          onCancel={() => setShowResetPassword(false)}
        />

        {(!hydrated || !splashDone || !authChecked || !fontsLoaded) ? (
          // The branded loading screen lives here in JS, not in the native splash
          // (app.json's splash is a bare #061826 field, no artwork). That keeps it
          // editable with a reload instead of a native rebuild, and because both
          // sides use the same background the native-to-JS handoff is invisible.
          // "contain" so the whole title card fits any aspect ratio uncropped.
          // Transparent, so the reef backdrop rendered at the app root shows
          // through rather than being hidden behind a flat field. A light scrim
          // keeps the title card legible over the busier parts of the photo.
          <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6,24,38,0.45)" }]} />
            <Image source={require("./assets/loading-screen.png")} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
        ) : (!user && !offlineMode) ? (
          <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
            <StatusBar style="light" />
            <AuthScreen
              onContinueOffline={() => setOfflineMode(true)}
              onPasswordRecovered={() => setShowResetPassword(true)}
            />
          </SafeAreaView>
        ) : !seenOnboarding ? (
          <OnboardingCard onFinish={finishOnboarding} onStartPremium={goPremium} />
        ) : (
        /* A wider ceiling on a large screen now that the content reflows into
           two columns. 700pt was the right clamp for a single column and the
           wrong one for a tablet, which is why an iPad showed a phone layout
           with empty space either side of it. */
        <SafeAreaView style={[styles.safe, layout.isLarge && { maxWidth: TWO_COLUMN_MAX_WIDTH, width: "100%", alignSelf: "center" }]} edges={["top", "left", "right"]}>
          <StatusBar style="light" />

          {/* The tank you're editing and the way out of this screen, on every
              screen. Hidden behind detail views, which have their own back. */}
          {shellVisible ? (
            <AppHeader
              tank={activeTank}
              tankCount={tanks.length}
              syncPending={syncPending}
              attentionElsewhere={tankAttention.elsewhere}
              onOpenTankMenu={() => setShowTankMenu(true)}
              onOpenSearch={() => setShowSearch(true)}
            />
          ) : null}

          {/* A failed upgrade is the one thing worth interrupting every screen
              for — the backup is only useful while the app is still installed. */}
          {migrationFailed && shellVisible ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <MigrationBanner onRestore={restoreBackup} restoring={restoringBackup} />
            </View>
          ) : null}

          {/* The keyboard used to sit on top of whatever you were typing in.
              Only the auth screen handled it, so every actual data-entry form —
              water test, journal, feeding, cost, quarantine, the record sheet —
              hid the field the moment you tapped it, on every phone.
              Wrapping the content region (not the absolutely-positioned tab
              bar) lifts the form instead. */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
          {tankSheet ? (
            <NewTankSheet mode={tankSheet.mode} initial={tankSheet.mode === "edit" ? tanks.find((tk) => tk.id === tankSheet.id) : null} onSave={saveTank} onClose={() => setTankSheet(null)} />
          ) : showImport ? (
            <ImportSheet onImport={importData} onClose={() => setShowImport(false)} />
          ) : selectedDisease ? (
            <DiseaseDetail name={selectedDisease} tank={tank} onBack={() => setSelectedDisease(null)} onOpenSpecies={(n) => { setSelectedDisease(null); setSelectedSpecies(n); }} treatment={(activeTank.treatments || []).find((t) => t.disease === selectedDisease) || null} onStartTreatment={startTreatment} onToggleTreatmentStep={toggleTreatmentStep} onStopTreatment={stopTreatment} />
          ) : selectedSpecies ? (
            <SpeciesDetail
              name={selectedSpecies}
              tank={tank}
              tankGallons={tankGallons}
              onBack={() => setSelectedSpecies(null)}
              onToggleTank={toggleTank}
              onOpenDisease={openDisease}
              onOpenSpecies={(n) => setSelectedSpecies(n)}
              inWishlist={wishlist.includes(selectedSpecies)}
              onToggleWishlist={toggleWishlist}
              tanks={tanks}
              quantity={quantities[selectedSpecies] || 1}
              onSetQuantity={setQuantity}
              onGoToTab={jumpTo}
              note={speciesNotes[selectedSpecies] || ""}
              onChangeNote={(text) => setSpeciesNote(selectedSpecies, text)}
              record={(activeTank.stockMeta || {})[selectedSpecies] || null}
              onOpenRecord={setRecordFor}
              activeTank={activeTank}
              onAddObservation={addObservationFor}
              onRemoveObservation={removeObservationFor}
            />
          ) : PREMIUM_TAB_IDS.has(activeTab) && !premiumUnlocked ? (
            // Belt and braces behind jumpTo(): if activeTab ever lands on a
            // locked tab by any other route — a stale state restore, a future
            // setActiveTab call that forgets the gate — the tab still doesn't
            // render. The paid screen is never mounted, so its data never
            // reaches the tree at all.
            <LockedTab
              icon={(LOCKED_COPY[activeTab] || {}).icon}
              title={(LOCKED_COPY[activeTab] || {}).title || "Premium feature"}
              blurb={(LOCKED_COPY[activeTab] || {}).blurb || "Upgrade to unlock this part of Pocket Reef."}
              perks={(LOCKED_COPY[activeTab] || {}).perks || []}
              onOpenPremium={() => goPremium(activeTab)}
            />
          ) : (
            /* One boundary per screen, keyed by tab so switching away from a
               broken screen resets it. Previously a single boundary wrapped
               the entire app: a render error anywhere replaced the tab bar,
               the header and nine working screens with an apology. The blast
               radius should be the thing that broke. */
            <ErrorBoundary compact key={activeTab} onError={(error, info) => recordCrash(error, info, { screen: activeTab, version: versionLabel() })}>
              {activeTab === "home" && (
                <HomeTab
                  tankGallons={tankGallons} setTankGallons={changeTankGallons} tank={tank} toggleTank={toggleTank} openSpecies={openSpecies}
                  activeDays={activeDays} xp={xp} waterTests={waterTests} journal={journal} feedings={feedings} careDoneToday={careDone[getTodayKey()] || []} onToggleCare={toggleCare}
                  maintenance={maintenance} quarantine={quarantine} quantities={quantities} tankWater={activeTank.water} treatments={activeTank.treatments || []} activeTank={activeTank}
                  tanks={tanks} activeTankId={activeTankId} onSwitchTank={switchTank} onAddTank={openNewTank} onEditTank={openEditTank} onDeleteTank={deleteTank} onDuplicateTank={duplicateTank}
                  premiumUnlocked={premiumUnlocked} onOpenPremium={goPremium} onExport={exportData} onImport={openImport}
                  reminderPrefs={reminderPrefs} onChangeReminders={changeReminders} lang={lang} onSetLanguage={changeLanguage} unit={unit} onSetUnit={changeUnit} currency={currency} onSetCurrency={changeCurrency}
                  onGoToTab={jumpTo} wishlist={wishlist} onToggleWishlist={toggleWishlist} profileName={profileName}
                  fishOfDaySeen={fodSeen === getTodayKey()} onSeeFishOfDay={markFodSeen}
                  challengesDone={challengesDone} onCompleteChallenge={completeChallenge}
                  activeTankHasSize={tankSized}
                  upkeep={activeTank.upkeep || []}
                  activeTank={activeTank}
                />
              )}
              {activeTab === "species" && <SpeciesTab tankGallons={tankGallons} tank={tank} toggleTank={toggleTank} openSpecies={openSpecies} openDisease={openDisease} wishlist={wishlist} onToggleWishlist={toggleWishlist} recent={recent} premiumUnlocked={premiumUnlocked} freeLimit={FREE_SPECIES_LIMIT} onOpenPremium={openSpeciesPaywall} tankWater={resolveWaterType(tank, activeTank.water)} />}
              {activeTab === "tank" && <TankTab tankGallons={tankGallons} setTankGallons={changeTankGallons} tank={tank} tankWater={activeTank.water} tankCreatedAt={activeTank.createdAt} tankNotes={activeTank.notes} waterTests={waterTests} maintenance={maintenance} quantities={quantities} onSetQuantity={setQuantity} toggleTank={toggleTank} openSpecies={openSpecies} onLoadIdea={loadTankIdea} onClearStock={clearStock} quarantine={quarantine} onAddQuarantine={addQuarantine} onRemoveQuarantine={removeQuarantine} onGraduateQuarantine={graduateQuarantine} onSetQuarantineCheck={setQuarantineCheck} tanks={tanks} activeTankId={activeTankId} onSwitchTank={switchTank} onAddTank={openNewTank} onGoToTab={jumpTo} onLoadPlan={loadStockingPlan} stockMeta={activeTank.stockMeta || {}} losses={activeTank.losses || []} onOpenRecord={setRecordFor} onDeleteLoss={deleteLoss} onShareReport={shareReport} equipment={activeTank.equipment || []} onAddEquipment={addEquipment} onRemoveEquipment={removeEquipment} activeTank={activeTank} onAddInventory={addInventory} onRemoveInventory={removeInventory} onSetInventoryStock={setInventoryStock} wishlist={wishlist} onSetupExisting={setupExistingTank} intent={intent && intent.tab === "tank" ? intent : null} targets={activeTank.targets || {}} onSetTarget={setTarget} onSetAllTargets={setAllTargets} />}
              {activeTab === "log" && <LogTab intent={intent && intent.tab === "log" ? intent : null} tank={tank} tankGallons={tankGallons} tankWater={activeTank.water} waterTests={waterTests} journal={journal} activeDays={activeDays} costs={costs} feedings={feedings} onLogTest={logTest} onUpdateTest={updateTest} onDeleteTest={deleteTest} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} onAddCost={addCost} onDeleteCost={deleteCost} onAddFeeding={addFeeding} onDeleteFeeding={deleteFeeding} maintenance={maintenance} onLogMaintenance={logMaintenance} onLogWaterChange={logWaterChange} premiumUnlocked={premiumUnlocked} onOpenPremium={goPremium} activeTank={activeTank} onAddUpkeepTask={addUpkeepTask} onRemoveUpkeepTask={removeUpkeepTask} onSetUpkeepInterval={setUpkeepInterval} strengths={strengths} onLogDose={logDose} onDeleteDose={deleteDose} onSetStrength={setDoseStrength} onSetSourceWater={setSourceWater} onImportTests={importTests} onSetLightSchedule={setLightSchedule} onGoToTab={jumpTo} onLogMedDose={logMedDose} onDeleteMedDose={deleteMedDose} />}
              {activeTab === "more" && <MoreTab items={MORE_ITEMS} onNavigate={jumpTo} onClose={goHome} lockedIds={premiumUnlocked ? null : PREMIUM_TAB_IDS} />}
              {activeTab === "games" && <GamesTab onEarnXp={addXp} />}
              {activeTab === "journal" && <JournalTab journal={journal} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} />}
              {activeTab === "health" && <HealthTab activeTank={activeTank} onGoToTab={jumpTo} openDisease={openDisease} waterType={resolveWaterType(tank, activeTank.water)} />}
              {activeTab === "premium" && (
                <PremiumTab premiumUnlocked={premiumUnlocked} onSetPremium={setPremium} onPurchase={buyPremium} onRestore={restorePremium} storeReady={storeReady} buying={buying} loadPlans={getOfferingPlans} reason={paywallReason} />
              )}
              {activeTab === "profile" && (
                <ProfileTab
                  profileName={profileName} onChangeName={changeName} premiumUnlocked={premiumUnlocked}
                  tanks={tanks} xp={xp} activeDays={activeDays} since={since} lastBackup={lastBackup} wishlist={wishlist}
                  bannerId={bannerId} onSetBanner={setBanner}
                  user={user} lastSyncedAt={lastSyncedAt} syncing={syncing} syncError={syncError}
                  onSyncNow={syncNow} onSignOut={handleSignOut}
                  onExport={exportData} onImport={openImport} onUnlock={goPremium} onOpenPremium={goPremium}
                  reminderPrefs={reminderPrefs} onChangeReminders={changeReminders} lang={lang} onSetLanguage={changeLanguage} unit={unit} onSetUnit={changeUnit} currency={currency} onSetCurrency={changeCurrency}
                  telemetryOn={telemetryOn} onSetTelemetry={changeTelemetry} telemetryConfigured={isTelemetryConfigured()}
                  activeTankId={activeTankId} onSwitchTank={switchTank} onRestored={handleRestored} activeTank={activeTank} onChangeTankReminders={setTankReminders} onGoToTab={jumpTo}
                />
              )}
            </ErrorBoundary>
          )}
          </KeyboardAvoidingView>

          {!detailOpen ? (
            <View style={[styles.bottomTabs, {
              // 16pt from the edge puts the bar inside the 34pt the home
              // indicator reserves, so on every modern iPhone the indicator
              // line was drawn across the tab labels. Sit above it instead,
              // keeping the original gap on devices that have no indicator.
              bottom: Math.max(16, insets.bottom),
            }, layout.isLarge && {
              // alignSelf is ignored on an absolutely-positioned element, so
              // the bar hugged the left edge of the content column. Auto
              // margins against left:0/right:0 is what actually centres it.
              maxWidth: 560,
              left: 0,
              right: 0,
              marginLeft: "auto",
              marginRight: "auto",
            }]}>
              {TABS.map((tab) => {
                const on = activeTab === tab.id || (tab.id === "more" && MORE_IDS.includes(activeTab));
                const label = t(`tabs.${tab.id}`);
                const locked = PREMIUM_TAB_IDS.has(tab.id) && !premiumUnlocked;
                return (
                  <Pressable
                    key={tab.id}
                    style={({ pressed }) => [styles.bottomTabButton, on && styles.bottomTabButtonActive, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
                    onPress={() => jumpTo(tab.id)}
                    // Long-press opens that tab's shortcuts — the home-screen
                    // idiom, and the only way to reach a specific Log tool in
                    // one gesture instead of tab-then-hunt.
                    onLongPress={() => { if (!locked) { commitHaptic(); setTabMenu({ id: tab.id, label }); } }}
                    delayLongPress={320}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? `${label}, Premium` : label}
                    accessibilityHint={locked ? undefined : `Long-press for ${label} shortcuts`}
                    accessibilityState={{ selected: on }}
                  >
                    <View>
                      <Ionicons
                        name={tab.id === "more" ? tab.icon : on ? tab.icon : `${tab.icon}-outline`}
                        size={22}
                        color={on ? theme.accent : "#7ea6bd"}
                        style={locked ? { opacity: 0.45 } : null}
                      />
                      {locked ? (
                        <View style={{ position: "absolute", right: -7, top: -4, backgroundColor: theme.cardSolid, borderRadius: radius.xs }}>
                          <Ionicons name="lock-closed" size={11} color={theme.secondaryText} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.bottomTabLabel, on && styles.bottomTabLabelActive, locked && { opacity: 0.55 }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* ── Shortcut chrome ──────────────────────────────────────────────
              The undo bar sits above the FAB rather than beside it: an Undo
              button the floating button can cover is an Undo button that
              expires unread. */}
          {shellVisible ? <QuickActionsFab onPress={() => setShowQuick(true)} onLongPress={() => setShowSearch(true)} pendingCount={pendingItems.length} urgent={pendingItems.some((p) => p.urgent)} /> : null}
          <UndoSnackbar undo={undo} onUndo={runUndo} onDismiss={() => setUndo(null)} bottom={shellVisible ? 160 : 30} />

          <QuickActionsSheet visible={showQuick} onClose={() => setShowQuick(false)} onRun={runAction} onComplete={completePending} pending={pending} roundEnabled={premiumUnlocked} />

          <StockRecordSheet
            visible={!!recordFor}
            name={recordFor}
            record={recordFor ? (activeTank.stockMeta || {})[recordFor] : null}
            quantity={recordFor ? (quantities[recordFor] || 1) : 1}
            onClose={() => setRecordFor(null)}
            onSave={setStockRecord}
            onRecordLoss={recordLoss}
          />

          <TankMenu
            visible={showTankMenu}
            tanks={tanks}
            activeTankId={activeTankId}
            onClose={() => setShowTankMenu(false)}
            onSwitch={switchTank}
            onEdit={openEditTank}
            onAdd={openNewTank}
            attention={tankAttention.byId}
          />

          <TabShortcutSheet
            visible={!!tabMenu}
            tabId={tabMenu ? tabMenu.id : null}
            tabLabel={tabMenu ? tabMenu.label : ""}
            onClose={() => setTabMenu(null)}
            onRun={runAction}
            onOpenTab={() => tabMenu && jumpTo(tabMenu.id)}
          />

          {/* activeTank is gated: upkeep jobs and equipment are premium records,
              and search is reachable from the header on the free tabs too, so
              passing it unconditionally put paid content in front of free
              accounts. */}
          <UniversalSearch
            visible={showSearch}
            onClose={() => setShowSearch(false)}
            tanks={tanks}
            activeTankId={activeTankId}
            activeTank={premiumUnlocked ? activeTank : {}}
            journal={journal}
            recent={recent}
            onOpenSpecies={openSpecies}
            onOpenDisease={openDisease}
            onRunAction={runAction}
            onGoToTab={jumpTo}
            onSwitchTank={switchTank}
          />
        </SafeAreaView>
        )}
      </View>
      </ScrollToTopContext.Provider>
    </SafeAreaProvider>
  );
}
