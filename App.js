import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "./styles";
import { tapHaptic, getTodayKey, getSpecies } from "./core";
import { supabase, isCloudConfigured } from "./lib/supabase";
import { pushSnapshot, pullSnapshot } from "./lib/cloudSync";
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

const EMPTY_TANK = { name: "My Tank", gallons: 20, water: "fresh", emoji: "🐠", stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], createdAt: null };
const newTank = (name, gallons = 20, water = "fresh", emoji = "🐠") => ({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name, gallons, water, emoji, stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [], maintenance: {}, quarantine: [], feedings: [], createdAt: new Date().toISOString() });
const persistTanks = (next) => AsyncStorage.setItem("pr_tanks", JSON.stringify(next)).catch(() => {});

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  // Per-tank data now lives inside tank profiles.
  const [tanks, setTanks] = useState([]);
  const [activeTankId, setActiveTankId] = useState(null);
  // User-level (shared across tanks).
  const [xp, setXp] = useState(0);
  const [activeDays, setActiveDays] = useState([]);
  const [careDone, setCareDone] = useState({});
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
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
        const keys = ["pr_xp", "pr_activeDays", "pr_premium", "pr_reminders", "pr_onboarded", "pr_careDone", "pr_lang", "pr_unit", "pr_wishlist"];
        const [x, a, pm, rm, ob, cd, lg, un, wl] = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
        if (x) setXp(Number(x) || 0);
        if (a) setActiveDays(JSON.parse(a) || []);
        if (pm === "1") setPremiumUnlocked(true);
        if (wl) setWishlist(JSON.parse(wl) || []);
        if (rm) setReminderPrefs(JSON.parse(rm));
        if (ob === "1") setSeenOnboarding(true);
        if (cd) setCareDone(JSON.parse(cd) || {});
        if (lg) { setLanguage(lg); setLangState(lg); }
        if (un) { setUnit(un); setUnitState(un); }
        const [pn, sinceRaw, lb] = await Promise.all(["pr_profileName", "pr_since", "pr_lastBackup"].map((k) => AsyncStorage.getItem(k)));
        if (pn) setProfileName(pn);
        if (lb) setLastBackup(Number(lb) || null);
        const rc = await AsyncStorage.getItem("pr_recent");
        if (rc) setRecent(JSON.parse(rc) || []);
        const sn = await AsyncStorage.getItem("pr_speciesNotes");
        if (sn) setSpeciesNotes(JSON.parse(sn) || {});
        const fsd = await AsyncStorage.getItem("pr_fodSeen");
        if (fsd) setFodSeen(fsd);
        const chd = await AsyncStorage.getItem("pr_challengesDone");
        if (chd) { const p = JSON.parse(chd); if (p && p.date === getTodayKey()) setChallengesDone(p.ids || []); }
        const bn = await AsyncStorage.getItem("pr_banner");
        if (bn) setBannerId(bn);
        if (sinceRaw) setSince(Number(sinceRaw));
        else { const now = Date.now(); setSince(now); AsyncStorage.setItem("pr_since", String(now)).catch(() => {}); }

        // Tanks: load, else migrate legacy single-tank keys, else create a default.
        const tanksRaw = await AsyncStorage.getItem("pr_tanks");
        if (tanksRaw) {
          const parsed = JSON.parse(tanksRaw) || [];
          // Backfill createdAt on tanks saved before age tracking existed —
          // use the oldest logged activity if we have it, else start the clock now.
          let changed = false;
          const list = (parsed.length ? parsed : [newTank("My Tank")]).map((tk) => {
            if (tk.createdAt) return tk;
            changed = true;
            const dates = [
              ...(tk.waterTests || []).map((e) => e.date),
              ...(tk.journal || []).map((e) => e.date),
            ].filter(Boolean).sort();
            return { ...tk, createdAt: dates.length ? new Date(dates[0]).toISOString() : new Date().toISOString() };
          });
          setTanks(list);
          const at = await AsyncStorage.getItem("pr_activeTank");
          setActiveTankId(list.find((tk) => tk.id === at) ? at : list[0].id);
          if (!parsed.length || changed) persistTanks(list);
        } else {
          const [og, ot, ow, oj, oco, omt, oqt] = await Promise.all(
            ["pr_tankGallons", "pr_tank", "pr_waterTests", "pr_journal", "pr_costs", "pr_maint", "pr_qt"].map((k) => AsyncStorage.getItem(k))
          );
          const d = newTank("My Tank", og ? Number(og) : 20);
          if (ot) d.stock = JSON.parse(ot) || [];
          if (ow) d.waterTests = JSON.parse(ow) || [];
          if (oj) d.journal = JSON.parse(oj) || [];
          if (oco) d.costs = JSON.parse(oco) || [];
          if (omt) d.maintenance = JSON.parse(omt) || {};
          if (oqt) d.quarantine = JSON.parse(oqt) || [];
          setTanks([d]); setActiveTankId(d.id); persistTanks([d]);
          AsyncStorage.setItem("pr_activeTank", d.id).catch(() => {});
        }
      } catch (e) {} finally { setHydrated(true); }
    })();
  }, []);

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
    if (typeof snap.premiumUnlocked === "boolean") { setPremiumUnlocked(snap.premiumUnlocked); put("pr_premium", snap.premiumUnlocked ? "1" : "0"); }
  };

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
        if (res.data) applySnapshot(res.data);
        setSyncError(false);
        setLastSyncedAt(res.updatedAt ? new Date(res.updatedAt).getTime() : Date.now());
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
      const res = await pushSnapshot(user.id, {
        tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
        profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, premiumUnlocked,
      });
      setSyncing(false);
      if (res.ok) { setSyncError(false); setLastSyncedAt(Date.now()); }
      else setSyncError(true);
    }, 2500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [user, tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs, profileName, recent, speciesNotes, challengesDone, bannerId, lang, unit, premiumUnlocked]);

  const syncNow = async () => {
    if (!supabase || !user) return;
    setSyncing(true);
    const res = await pushSnapshot(user.id, {
      tanks, activeTankId, xp, activeDays, careDone, wishlist, reminderPrefs,
      profileName, since, recent, speciesNotes, challengesDone, bannerId, lang, unit, premiumUnlocked,
    });
    setSyncing(false);
    if (res.ok) { setSyncError(false); setLastSyncedAt(Date.now()); }
    else setSyncError(true);
  };

  // Sign-out drops back to the auth gate. Local data stays on the device — the
  // next account to sign in pulls its own copy over it.
  const handleSignOut = () => {
    cloudLoaded.current = false;
    setUser(null);
    setLastSyncedAt(null);
    setSyncError(false);
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
  const changeReminders = (next) => { setReminderPrefs(next); AsyncStorage.setItem("pr_reminders", JSON.stringify(next)).catch(() => {}); };
  const unlockPremium = () => { setPremiumUnlocked(true); AsyncStorage.setItem("pr_premium", "1").catch(() => {}); };
  // Set premium on/off — powers the CTA (on) and the dev unlock/lock toggle.
  const setPremium = (on) => { tapHaptic("medium"); setPremiumUnlocked(!!on); AsyncStorage.setItem("pr_premium", on ? "1" : "0").catch(() => {}); };
  const toggleWishlist = (name) => {
    tapHaptic("light");
    setWishlist((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      AsyncStorage.setItem("pr_wishlist", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const goPremium = () => { setSelectedSpecies(null); setSelectedDisease(null); setActiveTab("premium"); };
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
  const loadTankIdea = (idea) => { tapHaptic("medium"); updateActiveTank({ gallons: idea.gallons, stock: idea.species, quantities: {} }); setActiveTab("tank"); };
  const clearStock = () => { tapHaptic("medium"); updateActiveTank({ stock: [], quantities: {} }); };

  // ── Tank management (multiple tanks) ──
  const switchTank = (id) => { tapHaptic(); setActiveTankId(id); AsyncStorage.setItem("pr_activeTank", id).catch(() => {}); };
  const openNewTank = () => {
    if (tanks.length >= 1 && !premiumUnlocked) { goPremium(); return; }
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
    if (!premiumUnlocked) { goPremium(); return; }
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
  const openDisease = (name) => { tapHaptic(); setSelectedDisease(name); };
  const jumpTo = (id) => { tapHaptic(); setSelectedSpecies(null); setSelectedDisease(null); setActiveTab(id); };
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
          <OnboardingCard onFinish={finishOnboarding} onStartPremium={() => setPremium(true)} />
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
              {activeTab === "species" && <SpeciesTab tankGallons={tankGallons} tank={tank} toggleTank={toggleTank} openSpecies={openSpecies} openDisease={openDisease} wishlist={wishlist} onToggleWishlist={toggleWishlist} recent={recent} />}
              {activeTab === "tank" && <TankTab tankGallons={tankGallons} setTankGallons={changeTankGallons} tank={tank} tankWater={activeTank.water} tankCreatedAt={activeTank.createdAt} tankNotes={activeTank.notes} waterTests={waterTests} maintenance={maintenance} quantities={quantities} onSetQuantity={setQuantity} toggleTank={toggleTank} openSpecies={openSpecies} onLoadIdea={loadTankIdea} onClearStock={clearStock} quarantine={quarantine} onAddQuarantine={addQuarantine} onRemoveQuarantine={removeQuarantine} onGraduateQuarantine={graduateQuarantine} tanks={tanks} activeTankId={activeTankId} onSwitchTank={switchTank} onAddTank={openNewTank} onGoToTab={jumpTo} />}
              {activeTab === "log" && <LogTab tank={tank} tankGallons={tankGallons} waterTests={waterTests} journal={journal} activeDays={activeDays} costs={costs} feedings={feedings} onLogTest={logTest} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} onAddCost={addCost} onDeleteCost={deleteCost} onAddFeeding={addFeeding} onDeleteFeeding={deleteFeeding} maintenance={maintenance} onLogMaintenance={logMaintenance} premiumUnlocked={premiumUnlocked} onOpenPremium={goPremium} />}
              {activeTab === "more" && <MoreTab items={MORE_ITEMS} onNavigate={jumpTo} onClose={() => jumpTo("home")} />}
              {activeTab === "games" && <GamesTab onEarnXp={addXp} />}
              {activeTab === "journal" && <JournalTab journal={journal} onAddJournal={addJournal} onDeleteJournal={deleteJournal} onEditJournal={editJournal} />}
              {activeTab === "health" && <HealthTab openDisease={openDisease} />}
              {activeTab === "premium" && (
                <PremiumTab premiumUnlocked={premiumUnlocked} onSetPremium={setPremium} />
              )}
              {activeTab === "profile" && (
                <ProfileTab
                  profileName={profileName} onChangeName={changeName} premiumUnlocked={premiumUnlocked}
                  tanks={tanks} xp={xp} activeDays={activeDays} since={since} lastBackup={lastBackup} wishlist={wishlist}
                  bannerId={bannerId} onSetBanner={setBanner}
                  user={user} lastSyncedAt={lastSyncedAt} syncing={syncing} syncError={syncError}
                  onSyncNow={syncNow} onSignOut={handleSignOut}
                  onExport={exportData} onImport={() => setShowImport(true)} onUnlock={unlockPremium} onOpenPremium={goPremium}
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
                return (
                  <Pressable
                    key={tab.id}
                    style={({ pressed }) => [styles.bottomTabButton, on && styles.bottomTabButtonActive, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
                    onPress={() => jumpTo(tab.id)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.bottomTabEmoji, on && { transform: [{ scale: 1.12 }] }]}>{tab.emoji}</Text>
                    <Text style={[styles.bottomTabLabel, on && styles.bottomTabLabelActive]}>{label}</Text>
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
