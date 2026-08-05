import { useEffect, useRef, useState } from "react";
import { Alert, Image, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "./styles";
import { tapHaptic, getTodayKey, getSpecies, getTodayActions, getStreak } from "./core";
import { supabase, isCloudConfigured } from "./lib/supabase";
import { pushSnapshot, pullSnapshot, fetchServerEntitlement } from "./lib/cloudSync";
import { queueSnapshot, resumePendingSync, cancelPendingSync, hasPendingSync } from "./lib/syncQueue";
import { backupTankPhotos, hydrateTankPhotos } from "./lib/photoSync";
import { getJSON, getRaw, setRaw, safeSetJSON, commitJSON } from "./lib/storage";
import { runMigrations, ensureTanksShape } from "./lib/migrations";
import { initPurchases, checkEntitlement, onEntitlementChange, restorePurchases, getOfferingPlans, purchasePackage, identifyUser, forgetUser } from "./lib/purchases";
import { LockedTab } from "./components/LockedTab";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { track, EVENTS } from "./lib/analytics";
import { syncReminders, requestPermission, onReminderTap } from "./lib/notifications";
import { AuthScreen } from "./screens/AuthScreen";
import { ResetPasswordModal } from "./components/ResetPasswordModal";
import { t, setLanguage } from "./lib/i18n";
import { setUnit } from "./lib/units";
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

// Bottom bar: four primary tabs + a "More" entry (Pocket Planter pattern).
const TABS = [
  { id: "home", emoji: "🏠", label: "Home" },
  { id: "species", emoji: "🐠", label: "Species" },
  { id: "tank", emoji: "🌊", label: "Tank" },
  { id: "log", emoji: "🧪", label: "Log" },
  { id: "more", emoji: "☰", label: "More" },
];
// Everything behind the "More" tab, ordered by how often it gets opened:
// Profile first, Premium last.
const MORE_ITEMS = [
  { id: "profile", emoji: "👤", label: "Profile", desc: "Account, stats & settings" },
  { id: "journal", emoji: "📓", label: "Journal", desc: "Your dated log & photo gallery" },
  { id: "health", emoji: "🩺", label: "Health", desc: "Disease guides & symptom checker" },
  { id: "games", emoji: "🎮", label: "Games", desc: "Play reef games & earn XP" },
  { id: "premium", emoji: "👑", label: "Premium", desc: "Unlock the full reef toolkit" },
];
const MORE_IDS = MORE_ITEMS.map((m) => m.id);

// ── The paywall ──────────────────────────────────────────────────────────────
// This is the ONE list that decides paid access. The tab bar, the More sheet,
// jumpTo() and the render guard all read it, so a tab can't end up
// half-protected — and a Today-card deep link can't route around it either.
//
// Free tier: Home, plus a preview of Species. "more" is the menu shell and
// "premium" is where you pay, so neither can be locked.
const PREMIUM_TAB_IDS = new Set(["tank", "log", "health", "journal", "games", "profile"]);

// What a free account gets.
const FREE_STOCK_LIMIT = 5;   // fish saved to a tank
const FREE_SPECIES_LIMIT = 7; // species visible in the catalog

// Copy for each locked tab — what they'd get, so the wall sells rather than scolds.
const LOCKED_COPY = {
  tank: { emoji: "🌊", title: "Your tank, unlocked", blurb: "Track your full stock with live compatibility, bioload, and stocking guidance.", perks: ["Unlimited fish per tank", "Real-time compatibility matrix", "Bioload & stocking planner", "Multiple tanks, quarantine & tank ideas"] },
  log: { emoji: "🧪", title: "Log everything", blurb: "Water chemistry, maintenance, feeding, costs — all tracked and trended.", perks: ["Water tests with trends & deltas", "Nitrogen cycle tracker", "Water-change calculator", "Cost tracking & CSV export"] },
  health: { emoji: "🩺", title: "Health toolkit", blurb: "Find out what's wrong and what to do about it.", perks: ["10 illustrated disease guides", "Symptom checker", "Emergency troubleshooter"] },
  journal: { emoji: "📓", title: "Your reef journal", blurb: "A dated, searchable record of your tank with photos.", perks: ["Photo journal & gallery", "Search and mood filters", "Timeline view"] },
  games: { emoji: "🎮", title: "Reef games", blurb: "Play, learn, and earn XP toward your reef-keeper level.", perks: ["Every reef mini-game", "Earn XP and records"] },
  profile: { emoji: "👤", title: "Profile & cloud save", blurb: "Your stats, achievements, and your reef backed up to your account.", perks: ["Cloud save across devices", "86 achievements", "Lifetime stats & collection insights", "Export and import your data"] },
};

const EMPTY_TANK = { name: "My Tank", gallons: 20, water: "fresh", emoji: "🐠", stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], createdAt: null };
const newTank = (name, gallons = 20, water = "fresh", emoji = "🐠") => ({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name, gallons, water, emoji, stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], createdAt: new Date().toISOString() });
// Tanks hold everything a user would actually mourn, so they get the two-phase
// write: a crash mid-save can never leave truncated JSON as the only copy.
// Every save also stamps pr_lastEdit, which is what stops an older cloud
// snapshot from silently overwriting newer work on this device.
const persistTanks = (next) => {
  setRaw("pr_lastEdit", String(Date.now()));
  return safeSetJSON("pr_tanks", next);
};

// The exported root wraps the app in an error boundary, so a render crash
// anywhere inside shows a recovery screen that says the data is safe — instead
// of a white screen, which is what makes people delete and reinstall.
export default function App() {
  return (
    <ErrorBoundary>
      <PocketReef />
    </ErrorBoundary>
  );
}

function PocketReef() {
  const [activeTab, setActiveTab] = useState("home");
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
  const [lang, setLangState] = useState("en");
  const [unit, setUnitState] = useState("imperial");
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
  const syncTimer = useRef(null);

  // Keep the loading screen up for a short beat, even if hydration is instant.
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    (async () => {
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
      const [x, a, rm, ob, lg, un] = await Promise.all(
        ["pr_xp", "pr_activeDays", "pr_reminders", "pr_onboarded", "pr_lang", "pr_unit"].map((k) => getRaw(k))
      );
      if (x) setXp(Number(x) || 0);
      if (ob === "1") setSeenOnboarding(true);
      if (lg) { setLanguage(lg); setLangState(lg); }
      if (un) { setUnit(un); setUnitState(un); }
      if (a) setActiveDays((await getJSON("pr_activeDays", [])) || []);
      if (rm) { const p = await getJSON("pr_reminders", null); if (p) setReminderPrefs(p); }

      setWishlist(await getJSON("pr_wishlist", []));
      setCareDone(await getJSON("pr_careDone", {}));
      setRecent(await getJSON("pr_recent", []));
      setSpeciesNotes(await getJSON("pr_speciesNotes", {}));

      const [pn, sinceRaw, lb, fsd, bn] = await Promise.all(
        ["pr_profileName", "pr_since", "pr_lastBackup", "pr_fodSeen", "pr_banner"].map((k) => getRaw(k))
      );
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
        if (JSON.stringify(list) !== JSON.stringify(stored)) persistTanks(list);
      } else {
        const d = newTank("My Tank");
        setTanks([d]);
        setActiveTankId(d.id);
        await persistTanks([d]);
        setRaw("pr_activeTank", d.id);
      }
     } finally {
      // Never leave the app stuck behind the splash, whatever happened above.
      setHydrated(true);
     }
    })();
  }, []);

  // ── Care reminders ─────────────────────────────────────────────────────────
  // Rebuilt whenever the inputs change. The body is written from the user's
  // actual top Today action, so a reminder says what's wrong with THEIR tank
  // rather than pinging them generically.
  useEffect(() => {
    if (!hydrated || !activeTank) return;
    const actions = getTodayActions({
      tank: activeTank.stock || [],
      waterTests: activeTank.waterTests || [],
      maintenance: activeTank.maintenance || {},
      quarantine: activeTank.quarantine || [],
      careDoneCount: (careDone[getTodayKey()] || []).length,
      reminderPrefs,
      quantities: activeTank.quantities || {},
    });
    const streak = getStreak(activeDays);
    syncReminders({
      reminderPrefs,
      tankName: activeTank.name,
      topAction: actions && actions.length ? actions[0] : null,
      // Only nudge when there's a streak to lose and today isn't logged yet.
      streakAtRisk: streak > 0 && !activeDays.includes(getTodayKey()),
    }).catch(() => {});
  }, [hydrated, reminderPrefs, activeTankId, activeTank, activeDays, careDone]);

  // Tapping a reminder lands on the tab where you act on it — same deep-link
  // contract the Today card uses. jumpTo enforces the paywall, so a reminder
  // can't be a back door into a locked tab.
  useEffect(() => onReminderTap((to) => jumpTo(to)), [premiumUnlocked]);

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
  const restorePremium = async () => {
    const res = await restorePurchases();
    if (res.entitled) {
      track(EVENTS.RESTORE_SUCCESS);
      setPremiumUnlocked(true);
      Alert.alert("Premium restored", "Welcome back — everything's unlocked.");
    } else if (res.ok) {
      Alert.alert("Nothing to restore", "No active subscription was found for this store account.");
    } else {
      Alert.alert("Couldn't restore", res.error || "Please try again in a moment.");
    }
  };

  // ── Cloud save ─────────────────────────────────────────────────────────────
  // Writes a pulled snapshot into state and mirrors it to AsyncStorage, so the
  // device copy matches the account even if the next launch is offline.
  const applySnapshot = (snap) => {
    if (!snap || typeof snap !== "object") return;
    const put = (key, value) => AsyncStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)).catch(() => {});
    if (Array.isArray(snap.tanks) && snap.tanks.length) {
      setTanks(snap.tanks);
      persistTanks(snap.tanks);
      const id = snap.tanks.find((tk) => tk.id === snap.activeTankId) ? snap.activeTankId : snap.tanks[0].id;
      setActiveTankId(id);
      put("pr_activeTank", id);
    }
    if (typeof snap.xp === "number") { setXp(snap.xp); put("pr_xp", String(snap.xp)); }
    if (Array.isArray(snap.activeDays)) { setActiveDays(snap.activeDays); put("pr_activeDays", snap.activeDays); }
    if (snap.careDone) { setCareDone(snap.careDone); put("pr_careDone", snap.careDone); }
    if (Array.isArray(snap.wishlist)) { setWishlist(snap.wishlist); put("pr_wishlist", snap.wishlist); }
    if (snap.reminderPrefs) { setReminderPrefs(snap.reminderPrefs); put("pr_reminders", snap.reminderPrefs); }
    if (typeof snap.profileName === "string") { setProfileName(snap.profileName); put("pr_profileName", snap.profileName); }
    if (snap.since) { setSince(snap.since); put("pr_since", String(snap.since)); }
    if (Array.isArray(snap.recent)) { setRecent(snap.recent); put("pr_recent", snap.recent); }
    if (snap.speciesNotes) { setSpeciesNotes(snap.speciesNotes); put("pr_speciesNotes", snap.speciesNotes); }
    if (snap.bannerId) { setBannerId(snap.bannerId); put("pr_banner", snap.bannerId); }
    if (snap.lang) { setLanguage(snap.lang); setLangState(snap.lang); put("pr_lang", snap.lang); }
    if (snap.unit) { setUnit(snap.unit); setUnitState(snap.unit); put("pr_unit", snap.unit); }
    // premiumUnlocked is deliberately NOT applied from the snapshot. Entitlement
    // is decided by RevenueCat; accepting it from synced data is what would let
    // a patched client write itself Premium and have it stick forever.
  };

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
      if (alive && uploaded) { setTanks(next); persistTanks(next); }
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
      if (!url) return;
      const fragment = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
      if (!fragment) return;
      const params = {};
      fragment.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) params[k] = decodeURIComponent(v || "");
      });
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        }).catch(() => {});
      }
      if (params.type === "recovery" || url.includes("reset-password")) setShowResetPassword(true);
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
          Alert.alert(
            "Which copy should we keep?",
            "This device has newer changes than your account's saved copy. Keeping the cloud copy will replace what's on this device.",
            [
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
            if (alive && withUrls !== res.data.tanks) { setTanks(withUrls); persistTanks(withUrls); }
          }).catch(() => {});
        }
      } else {
        setSyncError(true);
      }
      cloudLoaded.current = true;
      setSyncing(false);
    })();
    return () => { alive = false; };
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
        profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit,
      }, (r) => {
        setSyncing(false);
        setSyncError(!r.ok);
        setSyncPending(Boolean(r.pending));
        if (r.ok) setLastSyncedAt(Date.now());
      });
    }, 2500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [user, tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs, profileName, recent, speciesNotes, challengesDone, bannerId, lang, unit]);

  const syncNow = async () => {
    if (!supabase || !user) return;
    setSyncing(true);
    await queueSnapshot(user.id, {
      tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
      profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit,
    }, (r) => {
      setSyncing(false);
      setSyncError(!r.ok);
      setSyncPending(Boolean(r.pending));
      if (r.ok) setLastSyncedAt(Date.now());
    });
  };

  // Sign-out drops back to the auth gate. Local data stays on the device — the
  // next account to sign in pulls its own copy over it.
  const handleSignOut = () => {
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
  };

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

  // Mutate the active tank and persist.
  const updateActiveTank = (updater) => {
    setTanks((prev) => {
      const next = prev.map((tk) => (tk.id === (activeTankId || (prev[0] && prev[0].id)) ? { ...tk, ...(typeof updater === "function" ? updater(tk) : updater) } : tk));
      persistTanks(next);
      return next;
    });
  };

  // ── User-level settings ──
  const changeUnit = (u) => { setUnit(u); setUnitState(u); AsyncStorage.setItem("pr_unit", u).catch(() => {}); };
  const changeLanguage = (code) => { setLanguage(code); setLangState(code); AsyncStorage.setItem("pr_lang", code).catch(() => {}); };
  // Turning a reminder on is the moment a permission prompt makes sense — the
  // user has just asked to be reminded, so the ask has obvious context.
  const changeReminders = (next) => {
    setReminderPrefs(next);
    setRaw("pr_reminders", JSON.stringify(next));
    const wantsAny = ["waterTest", "waterChange", "feeding"].some((k) => next[k] && next[k] !== "off");
    if (wantsAny) requestPermission().catch(() => {});
  };
  // Buys Premium. The app never sets entitlement itself — it asks the store,
  // and the resulting CustomerInfo is what flips the flag.
  const buyPremium = async (plan) => {
    if (buying || !plan || !plan.pkg) return;
    setBuying(true);
    try {
      track(EVENTS.PAYWALL_CTA, paywallReason);
      const res = await purchasePackage(plan.pkg);
      if (res.cancelled) { track(EVENTS.PURCHASE_CANCELLED); return; }
      if (!res.ok) track(EVENTS.PURCHASE_FAILED);
      if (res.entitled) {
        track(EVENTS.PURCHASE_SUCCESS);
        setPremiumUnlocked(true);
        Alert.alert("Welcome to Premium 👑", "Everything's unlocked. Thanks for supporting Pocket Reef.");
      } else if (!res.ok) {
        Alert.alert("Purchase failed", res.error || "Please try again.");
      }
    } finally {
      setBuying(false);
    }
  };

  // Debug-only entitlement override, for testing gated screens without a
  // sandbox purchase. __DEV__ is compile-time, so this is dead code in release.
  const setPremium = (on) => {
    if (!__DEV__) return;
    tapHaptic("medium");
    setPremiumUnlocked(!!on);
  };
  const toggleWishlist = (name) => {
    tapHaptic("light");
    setWishlist((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      AsyncStorage.setItem("pr_wishlist", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const goPremium = (reason) => {
    const r = typeof reason === "string" ? reason : null;
    if (r) track(EVENTS.GATE_HIT, r);
    track(EVENTS.PAYWALL_VIEW, r);
    setPaywallReason(r);
    setSelectedSpecies(null);
    setSelectedDisease(null);
    setActiveTab("premium");
  };
  const finishOnboarding = ({ gallons, water } = {}) => {
    const patch = {};
    if (gallons) patch.gallons = gallons;
    if (water) patch.water = water;
    if (Object.keys(patch).length) updateActiveTank(patch);
    setSeenOnboarding(true);
    AsyncStorage.setItem("pr_onboarded", "1").catch(() => {});
  };

  const recordActivity = (points) => {
    const today = getTodayKey();
    setActiveDays((prev) => {
      if (prev.includes(today)) return prev;
      const next = [...prev, today].slice(-400);
      AsyncStorage.setItem("pr_activeDays", JSON.stringify(next)).catch(() => {});
      return next;
    });
    setXp((prev) => { const next = prev + points; AsyncStorage.setItem("pr_xp", String(next)).catch(() => {}); return next; });
  };
  const toggleCare = (taskId) => {
    tapHaptic("light");
    const today = getTodayKey();
    const todayList = careDone[today] || [];
    const has = todayList.includes(taskId);
    const next = { ...careDone, [today]: has ? todayList.filter((x) => x !== taskId) : [...todayList, taskId] };
    setCareDone(next);
    AsyncStorage.setItem("pr_careDone", JSON.stringify(next)).catch(() => {});
    if (!has) recordActivity(2);
  };

  // ── Active-tank data actions ──
  const changeTankGallons = (g) => updateActiveTank({ gallons: g });
  const toggleTank = (name) => {
    tapHaptic();
    // Free accounts stop at FREE_STOCK_LIMIT fish. Removing is always allowed —
    // a cap that traps you above it is worse than no cap.
    const stocked = (activeTank.stock || []).includes(name);
    if (!premiumUnlocked && !stocked && (activeTank.stock || []).length >= FREE_STOCK_LIMIT) {
      track(EVENTS.STOCK_CAP_HIT);
      Alert.alert(
        "Free plan holds 5 fish",
        `You've saved ${FREE_STOCK_LIMIT} — upgrade to Premium for unlimited stock, plus compatibility, bioload, and the full logging toolkit.`,
        [{ text: "Maybe later", style: "cancel" }, { text: "See Premium", onPress: () => goPremium("stockCap") }]
      );
      return;
    }
    updateActiveTank((tk) => {
      const has = tk.stock.includes(name);
      const stock = has ? tk.stock.filter((n) => n !== name) : [...tk.stock, name];
      const quantities = { ...(tk.quantities || {}) };
      if (has) delete quantities[name]; // drop count when a species leaves the tank
      return { stock, quantities };
    });
  };
  const setQuantity = (name, n) => {
    const q = Math.max(1, Math.min(999, Math.round(n) || 1));
    updateActiveTank((tk) => ({ quantities: { ...(tk.quantities || {}), [name]: q } }));
  };
  const logTest = (entry) => { updateActiveTank((tk) => ({ waterTests: [entry, ...tk.waterTests].slice(0, 60) })); recordActivity(10); };
  const addJournal = (entry) => { updateActiveTank((tk) => ({ journal: [entry, ...tk.journal].slice(0, 200) })); recordActivity(5); };
  const deleteJournal = (id) => updateActiveTank((tk) => ({ journal: tk.journal.filter((e) => e.id !== id) }));
  const editJournal = (id, patch) => updateActiveTank((tk) => ({ journal: tk.journal.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addCost = (entry) => updateActiveTank((tk) => ({ costs: [entry, ...tk.costs].slice(0, 300) }));
  const deleteCost = (id) => updateActiveTank((tk) => ({ costs: tk.costs.filter((c) => c.id !== id) }));
  const logMaintenance = (taskId) => { tapHaptic(); updateActiveTank((tk) => ({ maintenance: { ...tk.maintenance, [taskId]: new Date().toISOString() } })); recordActivity(2); };
  const addQuarantine = (entry) => updateActiveTank((tk) => ({ quarantine: [entry, ...tk.quarantine].slice(0, 50) }));
  const removeQuarantine = (id) => updateActiveTank((tk) => ({ quarantine: tk.quarantine.filter((q) => q.id !== id) }));
  const graduateQuarantine = (item) => updateActiveTank((tk) => {
    const canAdd = getSpecies(item.name) && !tk.stock.includes(item.name);
    return { stock: canAdd ? [...tk.stock, item.name] : tk.stock, quarantine: tk.quarantine.filter((q) => q.id !== item.id) };
  });
  const addFeeding = (entry) => { updateActiveTank((tk) => ({ feedings: [entry, ...(tk.feedings || [])].slice(0, 300) })); recordActivity(2); };
  const deleteFeeding = (id) => updateActiveTank((tk) => ({ feedings: (tk.feedings || []).filter((f) => f.id !== id) }));
  // Tank ideas write a whole stock list at once, so they'd walk straight past
  // the per-fish cap. Premium only.
  const loadTankIdea = (idea) => {
    if (!premiumUnlocked) { goPremium("tankIdea"); return; }
    tapHaptic("medium");
    updateActiveTank({ gallons: idea.gallons, stock: idea.species, quantities: {} });
    setActiveTab("tank");
  };
  const clearStock = () => { tapHaptic("medium"); updateActiveTank({ stock: [], quantities: {} }); };

  // ── Tank management (multiple tanks) ──
  const switchTank = (id) => { tapHaptic(); setActiveTankId(id); AsyncStorage.setItem("pr_activeTank", id).catch(() => {}); };
  const openNewTank = () => {
    if (tanks.length >= 1 && !premiumUnlocked) { goPremium("secondTank"); return; }
    tapHaptic(); setTankSheet({ mode: "new" });
  };
  const openEditTank = (id) => { tapHaptic(); setTankSheet({ mode: "edit", id }); };
  const saveTank = (config) => {
    if (tankSheet && tankSheet.mode === "edit") {
      const next = tanks.map((tk) => (tk.id === tankSheet.id ? { ...tk, ...config } : tk));
      setTanks(next); persistTanks(next);
    } else {
      const nt = newTank(config.name && config.name.trim() ? config.name.trim() : `Tank ${tanks.length + 1}`, config.gallons || 20, config.water || "fresh", config.emoji || "🐠");
      if (config.notes) nt.notes = config.notes;
      const next = [...tanks, nt];
      setTanks(next); persistTanks(next);
      setActiveTankId(nt.id); AsyncStorage.setItem("pr_activeTank", nt.id).catch(() => {});
      setActiveTab("home");
    }
    setTankSheet(null);
  };
  const duplicateTank = (id) => {
    if (!premiumUnlocked) { goPremium("secondTank"); return; }
    const src = tanks.find((tk) => tk.id === id);
    if (!src) return;
    tapHaptic("medium");
    const copy = newTank(`${src.name} copy`, src.gallons, src.water, src.emoji);
    copy.stock = [...(src.stock || [])];
    copy.quantities = { ...(src.quantities || {}) };
    copy.notes = src.notes || "";
    const next = [...tanks, copy];
    setTanks(next); persistTanks(next);
    setActiveTankId(copy.id); AsyncStorage.setItem("pr_activeTank", copy.id).catch(() => {});
    setActiveTab("home");
  };
  const deleteTank = (id) => {
    if (tanks.length <= 1) return;
    tapHaptic();
    const next = tanks.filter((tk) => tk.id !== id);
    setTanks(next); persistTanks(next);
    if (activeTankId === id) { setActiveTankId(next[0].id); AsyncStorage.setItem("pr_activeTank", next[0].id).catch(() => {}); }
  };

  const changeName = (name) => { setProfileName(name); AsyncStorage.setItem("pr_profileName", name).catch(() => {}); };
  const exportData = async () => {
    tapHaptic();
    const payload = { app: "Pocket Reef", version: 1, exportedAt: new Date().toISOString(), tanks, xp, activeDays, careDone, reminderPrefs, premiumUnlocked, unit, lang, profileName, wishlist };
    try {
      const res = await Share.share({ message: JSON.stringify(payload) });
      if (!res || res.action !== Share.dismissedAction) { const now = Date.now(); setLastBackup(now); AsyncStorage.setItem("pr_lastBackup", String(now)).catch(() => {}); }
    } catch (e) {}
  };
  const importData = (raw) => {
    try {
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.tanks) || !p.tanks.length) return false;
      setTanks(p.tanks); persistTanks(p.tanks);
      setActiveTankId(p.tanks[0].id); AsyncStorage.setItem("pr_activeTank", p.tanks[0].id).catch(() => {});
      if (typeof p.xp === "number") { setXp(p.xp); AsyncStorage.setItem("pr_xp", String(p.xp)).catch(() => {}); }
      if (Array.isArray(p.activeDays)) { setActiveDays(p.activeDays); AsyncStorage.setItem("pr_activeDays", JSON.stringify(p.activeDays)).catch(() => {}); }
      if (p.careDone) { setCareDone(p.careDone); AsyncStorage.setItem("pr_careDone", JSON.stringify(p.careDone)).catch(() => {}); }
      if (Array.isArray(p.wishlist)) { setWishlist(p.wishlist); AsyncStorage.setItem("pr_wishlist", JSON.stringify(p.wishlist)).catch(() => {}); }
      if (p.reminderPrefs) changeReminders(p.reminderPrefs);
      if (p.unit) changeUnit(p.unit);
      if (p.lang) changeLanguage(p.lang);
      setShowImport(false);
      return true;
    } catch (e) { return false; }
  };

  const setSpeciesNote = (nm, text) => {
    setSpeciesNotes((prev) => {
      const next = { ...prev, [nm]: text };
      if (!text) delete next[nm];
      AsyncStorage.setItem("pr_speciesNotes", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const markFodSeen = () => {
    const tk = getTodayKey();
    setFodSeen(tk);
    AsyncStorage.setItem("pr_fodSeen", tk).catch(() => {});
  };
  const setBanner = (id) => { tapHaptic(); setBannerId(id); AsyncStorage.setItem("pr_banner", id).catch(() => {}); };
  // XP-only reward (games) — grants XP without touching the daily streak.
  const addXp = (n) => setXp((prev) => { const next = prev + n; AsyncStorage.setItem("pr_xp", String(next)).catch(() => {}); return next; });
  const completeChallenge = (id) => {
    setChallengesDone((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      AsyncStorage.setItem("pr_challengesDone", JSON.stringify({ date: getTodayKey(), ids: next })).catch(() => {});
      return next;
    });
    recordActivity(3); // small reward for completing a challenge
  };
  const openSpecies = (name) => {
    tapHaptic();
    setSelectedSpecies(name);
    setRecent((prev) => {
      const next = [name, ...prev.filter((n) => n !== name)].slice(0, 12);
      AsyncStorage.setItem("pr_recent", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  // Disease guides are Health-tab content, but they're also reachable from the
  // free Species tab's search results and from species detail. Gate the opener
  // itself, or locking the tab would only lock the front door.
  const openDisease = (name) => {
    tapHaptic();
    if (!premiumUnlocked) { goPremium("disease"); return; }
    setSelectedDisease(name);
  };
  // Every navigation in the app funnels through here — the tab bar, the More
  // sheet, Today-card deep links, and each screen's onGoToTab. Gating at this
  // one choke point is why a locked tab can't be reached by any route.
  const jumpTo = (id) => {
    tapHaptic();
    if (PREMIUM_TAB_IDS.has(id) && !premiumUnlocked) { goPremium(id); return; }
    setSelectedSpecies(null);
    setSelectedDisease(null);
    setActiveTab(id);
  };
  const detailOpen = selectedSpecies || selectedDisease || tankSheet || showImport;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <BackgroundDecoration />
        {/* The reset-password sheet rides above every state — the deep link can
            arrive whether or not someone is signed in. */}
        <ResetPasswordModal
          visible={showResetPassword}
          onDone={() => setShowResetPassword(false)}
          onCancel={() => setShowResetPassword(false)}
        />

        {(!hydrated || !splashDone || !authChecked) ? (
          // The branded loading screen lives here in JS, not in the native splash
          // (app.json's splash is a bare #061826 field, no artwork). That keeps it
          // editable with a reload instead of a native rebuild, and because both
          // sides use the same background the native-to-JS handoff is invisible.
          // "contain" so the whole title card fits any aspect ratio uncropped.
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#061826" }]}>
            <Image source={require("./assets/loading-screen.png")} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
        ) : (!user && !offlineMode) ? (
          <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
            <StatusBar style="light" />
            <AuthScreen onContinueOffline={() => setOfflineMode(true)} />
          </SafeAreaView>
        ) : !seenOnboarding ? (
          <OnboardingCard onFinish={finishOnboarding} onStartPremium={goPremium} />
        ) : (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <StatusBar style="light" />

          {tankSheet ? (
            <NewTankSheet mode={tankSheet.mode} initial={tankSheet.mode === "edit" ? tanks.find((tk) => tk.id === tankSheet.id) : null} onSave={saveTank} onClose={() => setTankSheet(null)} />
          ) : showImport ? (
            <ImportSheet onImport={importData} onClose={() => setShowImport(false)} />
          ) : selectedDisease ? (
            <DiseaseDetail name={selectedDisease} tank={tank} onBack={() => setSelectedDisease(null)} onOpenSpecies={(n) => { setSelectedDisease(null); setSelectedSpecies(n); }} />
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
            />
          ) : PREMIUM_TAB_IDS.has(activeTab) && !premiumUnlocked ? (
            // Belt and braces behind jumpTo(): if activeTab ever lands on a
            // locked tab by any other route — a stale state restore, a future
            // setActiveTab call that forgets the gate — the tab still doesn't
            // render. The paid screen is never mounted, so its data never
            // reaches the tree at all.
            <LockedTab
              emoji={(LOCKED_COPY[activeTab] || {}).emoji}
              title={(LOCKED_COPY[activeTab] || {}).title || "Premium feature"}
              blurb={(LOCKED_COPY[activeTab] || {}).blurb || "Upgrade to unlock this part of Pocket Reef."}
              perks={(LOCKED_COPY[activeTab] || {}).perks || []}
              onOpenPremium={() => goPremium(activeTab)}
            />
          ) : (
            <>
              {activeTab === "home" && (
                <HomeTab
                  tankGallons={tankGallons} setTankGallons={changeTankGallons} tank={tank} toggleTank={toggleTank} openSpecies={openSpecies}
                  activeDays={activeDays} xp={xp} waterTests={waterTests} journal={journal} feedings={feedings} careDoneToday={careDone[getTodayKey()] || []} onToggleCare={toggleCare}
                  maintenance={maintenance} quarantine={quarantine} quantities={quantities} tankWater={activeTank.water}
                  tanks={tanks} activeTankId={activeTankId} onSwitchTank={switchTank} onAddTank={openNewTank} onEditTank={openEditTank} onDeleteTank={deleteTank} onDuplicateTank={duplicateTank}
                  premiumUnlocked={premiumUnlocked} onOpenPremium={goPremium} onExport={exportData} onImport={() => setShowImport(true)}
                  reminderPrefs={reminderPrefs} onChangeReminders={changeReminders} lang={lang} onSetLanguage={changeLanguage} unit={unit} onSetUnit={changeUnit}
                  onGoToTab={jumpTo} wishlist={wishlist} onToggleWishlist={toggleWishlist} profileName={profileName}
                  fishOfDaySeen={fodSeen === getTodayKey()} onSeeFishOfDay={markFodSeen}
                  challengesDone={challengesDone} onCompleteChallenge={completeChallenge}
                />
              )}
              {activeTab === "species" && <SpeciesTab tankGallons={tankGallons} tank={tank} toggleTank={toggleTank} openSpecies={openSpecies} openDisease={openDisease} wishlist={wishlist} onToggleWishlist={toggleWishlist} recent={recent} premiumUnlocked={premiumUnlocked} freeLimit={FREE_SPECIES_LIMIT} onOpenPremium={() => goPremium("species")} />}
              {activeTab === "tank" && <TankTab tankGallons={tankGallons} setTankGallons={changeTankGallons} tank={tank} tankWater={activeTank.water} tankCreatedAt={activeTank.createdAt} tankNotes={activeTank.notes} waterTests={waterTests} maintenance={maintenance} quantities={quantities} onSetQuantity={setQuantity} toggleTank={toggleTank} openSpecies={openSpecies} onLoadIdea={loadTankIdea} onClearStock={clearStock} quarantine={quarantine} onAddQuarantine={addQuarantine} onRemoveQuarantine={removeQuarantine} onGraduateQuarantine={graduateQuarantine} tanks={tanks} activeTankId={activeTankId} onSwitchTank={switchTank} onAddTank={openNewTank} onGoToTab={jumpTo} />}
              {activeTab === "log" && <LogTab tank={tank} tankGallons={tankGallons} waterTests={waterTests} journal={journal} activeDays={activeDays} costs={costs} feedings={feedings} onLogTest={logTest} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} onAddCost={addCost} onDeleteCost={deleteCost} onAddFeeding={addFeeding} onDeleteFeeding={deleteFeeding} maintenance={maintenance} onLogMaintenance={logMaintenance} premiumUnlocked={premiumUnlocked} onOpenPremium={goPremium} />}
              {activeTab === "more" && <MoreTab items={MORE_ITEMS} onNavigate={jumpTo} onClose={() => jumpTo("home")} lockedIds={premiumUnlocked ? null : PREMIUM_TAB_IDS} />}
              {activeTab === "games" && <GamesTab onEarnXp={addXp} />}
              {activeTab === "journal" && <JournalTab journal={journal} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} />}
              {activeTab === "health" && <HealthTab openDisease={openDisease} />}
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
                  onExport={exportData} onImport={() => setShowImport(true)} onUnlock={goPremium} onOpenPremium={goPremium}
                  reminderPrefs={reminderPrefs} onChangeReminders={changeReminders} lang={lang} onSetLanguage={changeLanguage} unit={unit} onSetUnit={changeUnit}
                />
              )}
            </>
          )}

          {!detailOpen ? (
            <View style={styles.bottomTabs}>
              {TABS.map((tab) => {
                const on = activeTab === tab.id || (tab.id === "more" && MORE_IDS.includes(activeTab));
                const label = t(`tabs.${tab.id}`);
                const locked = PREMIUM_TAB_IDS.has(tab.id) && !premiumUnlocked;
                return (
                  <Pressable
                    key={tab.id}
                    style={({ pressed }) => [styles.bottomTabButton, on && styles.bottomTabButtonActive, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
                    onPress={() => jumpTo(tab.id)}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? `${label}, Premium` : label}
                    accessibilityState={{ selected: on }}
                  >
                    <View>
                      <Text style={[styles.bottomTabEmoji, on && { transform: [{ scale: 1.12 }] }, locked && { opacity: 0.45 }]}>{tab.emoji}</Text>
                      {locked ? (
                        <Text style={{ position: "absolute", right: -8, top: -3, fontSize: 11 }}>🔒</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.bottomTabLabel, on && styles.bottomTabLabelActive, locked && { opacity: 0.55 }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
  );
}
