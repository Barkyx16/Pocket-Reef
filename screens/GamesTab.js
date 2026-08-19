import { useEffect, useRef, useState, memo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme, useResponsiveLayout, radius, type } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SPECIES, getCompatibility, tapHaptic } from "../core";
import { getSpeciesImage } from "../data/speciesImageMap";
import { HeroBanner } from "../components/HeroBanner";
import { SpeciesThumb } from "../components/SpeciesThumb";
import { GradientButton } from "../components/GradientButton";
import { formatVolume } from "../lib/units";
import { useScrollToTop } from "../lib/scrollToTop";

// Reef Games — four quick, endlessly-randomizing games that earn XP for each
// correct answer (the reef version of Pocket Planter's Garden Games).
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function sample(arr, n) { const b = shuffle(arr); return b.slice(0, n); }
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const IMG_SPECIES = SPECIES.filter((s) => getSpeciesImage(s.name));

function Pill({ label, active, onPress, fill }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ flex: fill ? 1 : undefined, alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? theme.accent : theme.border, backgroundColor: active ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.04)" }, pressed && { opacity: 0.7 }]}>
      <Text style={{ color: active ? theme.accent : theme.secondaryText, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

const GAMES = [
  { id: "guess", icon: "image-outline", name: "Guess the Fish", desc: "Name the fish from its photo." },
  { id: "match", icon: "git-compare-outline", name: "Tank Match", desc: "Will these two get along?" },
  { id: "bigger", icon: "resize-outline", name: "Bigger Tank?", desc: "Which one needs more gallons?" },
  { id: "trivia", icon: "bulb-outline", name: "Reef Trivia", desc: "Test your fishkeeping smarts." },
];

export const GamesTab = memo(function GamesTab({ onEarnXp }) {
  const scrollRef = useScrollToTop();
  // The shell is wider now that most screens reflow into two columns; this
  // one doesn't, so it keeps a readable line length instead of stretching.
  const layout = useResponsiveLayout();
  const [game, setGame] = useState(null);
  if (game) return <GameHost gameId={game} onBack={() => setGame(null)} onEarnXp={onEarnXp} />;

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, layout.contentStyle]} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow="Play & earn XP"
        title="Reef Games"
        subtitle="Four quick games with a fresh round every time — earn XP for every correct answer."
        emoji="🎮"
        colors={["#123a52", "#1a2a52", "#071d2e"]}
      />
      <View style={{ gap: 12 }}>
        {GAMES.map((g) => (
          <Pressable key={g.id} onPress={() => { tapHaptic(); setGame(g.id); }} style={({ pressed }) => [styles.cleanRow, { marginBottom: 0 }, pressed && { opacity: 0.85, borderColor: theme.accent }]} accessibilityRole="button" accessibilityLabel={g.name}>
            <View style={styles.cleanImageWrap}><Ionicons name={g.icon} size={24} color={theme.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cleanName}>{g.name}</Text>
              <Text style={styles.cleanMeta}>{g.desc}</Text>
            </View>
            <Text style={styles.cleanArrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
})

function GameHost({ gameId, onBack, onEarnXp }) {
  // Same clamp as the list above: a game board stretched across a tablet is
  // harder to play, not easier.
  const layout = useResponsiveLayout();
  const meta = GAMES.find((g) => g.id === gameId);
  const makeRound = gameId === "guess" ? makeGuessRound : gameId === "match" ? makeMatchRound : gameId === "bigger" ? makeBiggerRound : makeTriviaRound;
  const [mode, setMode] = useState("practice"); // practice | blitz
  const [bestStreak, setBestStreak] = useState(0);
  const [bestBlitz, setBestBlitz] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Guarded: these read from storage and set state when the promise resolves.
    // Switching tab or closing the sheet before that lands writes to an
    // unmounted component — React logs it and the write is thrown away, which
    // is a warning today and a stale-state bug the moment anything downstream
    // reads it.
    let alive = true;
    AsyncStorage.multiGet([`pr_game_${gameId}_streak`, `pr_game_${gameId}_blitz`]).then((pairs) => {
      if (!alive) return;
      pairs.forEach(([k, v]) => { if (v) { if (k.endsWith("streak")) setBestStreak(Number(v) || 0); else setBestBlitz(Number(v) || 0); } });
    }).catch(() => {});
    return () => { alive = false; };
  }, [gameId]);

  const saveStreak = (s) => { if (s > bestStreak) { setBestStreak(s); AsyncStorage.setItem(`pr_game_${gameId}_streak`, String(s)).catch(() => {}); } };
  const saveBlitz = (s) => { if (s > bestBlitz) { setBestBlitz(s); AsyncStorage.setItem(`pr_game_${gameId}_blitz`, String(s)).catch(() => {}); } };
  const switchMode = (m) => { tapHaptic("light"); setMode(m); setNonce((n) => n + 1); };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, layout.contentStyle]} showsVerticalScrollIndicator={false}>
      <Pressable style={({ pressed }) => [{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12 }, pressed && { opacity: 0.7 }]} onPress={onBack} accessibilityRole="button">
        <Text style={{ color: theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>‹ Games</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={meta.icon} size={22} color={theme.accent} />
        <Text style={{ color: "#fff", fontSize: 26, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.5 }}>{meta.name}</Text>
      </View>
      <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4, marginBottom: 14 }}>{meta.desc}</Text>

      {/* Mode + best scores */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pill fill label="♾️ Practice" active={mode === "practice"} onPress={() => switchMode("practice")} />
        <Pill fill label="⏱️ 60s Blitz" active={mode === "blitz"} onPress={() => switchMode("blitz")} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 10, alignItems: "center" }}>
          <Text style={{ color: theme.warn, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>🔥 {bestStreak}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>BEST STREAK</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 10, alignItems: "center" }}>
          <Text style={{ color: theme.accent, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>⏱️ {bestBlitz}</Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>BLITZ BEST</Text>
        </View>
      </View>

      <Quiz key={`${mode}-${nonce}`} makeRound={makeRound} timed={mode === "blitz"} onEarnXp={onEarnXp} onBestStreak={saveStreak} onBlitzEnd={saveBlitz} onReplay={() => setNonce((n) => n + 1)} />
    </ScrollView>
  );
}

function Quiz({ makeRound, timed, onEarnXp, onBestStreak, onBlitzEnd, onReplay, xpPerCorrect = 2 }) {
  const [round, setRound] = useState(makeRound);
  const [answered, setAnswered] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [gained, setGained] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timed ? 60 : 0);
  const [over, setOver] = useState(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!timed || over) return;
    if (timeLeft <= 0) { setOver(true); onBlitzEnd && onBlitzEnd(scoreRef.current); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Re-runs every tick, so the closure is already fresh. Adding onBlitzEnd would restart the countdown whenever the parent re-renders.
  }, [timed, timeLeft, over]);

  const select = (o) => {
    if (answered || over) return;
    tapHaptic(o.correct ? "medium" : "light");
    setAnswered(true); setSelectedKey(o.key); setTotal((t) => t + 1);
    if (o.correct) {
      scoreRef.current += 1; setScore((s) => s + 1); setGained((g) => g + xpPerCorrect); onEarnXp && onEarnXp(xpPerCorrect);
      setStreak((st) => { const n = st + 1; onBestStreak && onBestStreak(n); return n; });
    } else { setStreak(0); }
    if (timed) setTimeout(() => { setRound(makeRound()); setAnswered(false); setSelectedKey(null); }, 650);
  };
  const next = () => { tapHaptic(); setRound(makeRound()); setAnswered(false); setSelectedKey(null); };

  if (timed && over) {
    return (
      <View style={[styles.card, { alignItems: "center", paddingVertical: 24 }]}>
        <Text style={{ fontSize: type.hero }}>⏱️</Text>
        <Text style={{ color: "#fff", fontSize: type.titleLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 8 }}>Time's up!</Text>
        <Text style={{ color: theme.accent, fontSize: 34, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 6, fontVariant: ["tabular-nums"] }}>{score}</Text>
        <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_700Bold", fontWeight: "700" }}>correct in 60 seconds · +{gained} XP</Text>
        <GradientButton label="Play again" onPress={() => onReplay && onReplay()} style={{ marginTop: 18, alignSelf: "stretch" }} />
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: timed && timeLeft <= 10 ? theme.danger : theme.border, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}>
        <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>{timed ? `Correct ${score}` : `Score ${score}/${total}`}{!timed && streak > 1 ? `  🔥${streak}` : ""}</Text>
        {timed ? (
          <Text style={{ color: timeLeft <= 10 ? theme.danger : theme.accent, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>⏱️ {timeLeft}s</Text>
        ) : (
          <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>+{gained} XP earned</Text>
        )}
      </View>

      <View style={styles.card}>
        {round.prompt}
        <View style={{ gap: 10, marginTop: 16 }}>
          {round.options.map((o) => (
            <OptionBtn key={o.key} o={o} answered={answered} selectedKey={selectedKey} onPress={() => select(o)} />
          ))}
        </View>
        {answered && !timed ? (
          <>
            {round.explain ? <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18, marginTop: 12, textAlign: "center" }}>{round.explain}</Text> : null}
            <GradientButton label="Next round" icon="arrow-forward" onPress={next} style={{ marginTop: 14 }} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function OptionBtn({ o, answered, selectedKey, onPress }) {
  let bg = "rgba(255,255,255,0.05)", bc = theme.border, color = theme.text, mark = null;
  if (answered) {
    if (o.correct) { bg = "rgba(56,225,198,0.14)"; bc = theme.accent; color = "#fff"; mark = "check"; }
    else if (o.key === selectedKey) { bg = "rgba(255,123,123,0.16)"; bc = theme.danger; color = theme.danger; mark = "close"; }
    else { color = theme.secondaryText; }
  }
  return (
    <Pressable disabled={answered} onPress={onPress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: bg, borderWidth: 1, borderColor: bc, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 }, pressed && !answered && { opacity: 0.8 }]} accessibilityRole="button">
      {/* The compatibility answers carried their verdict in a coloured emoji
          circle. Replacing the emoji without this dot would have thrown the
          colour cue away entirely. */}
      {o.dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.dot }} /> : null}
      <Text style={{ flex: 1, color, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{o.label}</Text>
      {mark ? <Ionicons name={mark} size={17} color={o.correct ? theme.accent : theme.danger} /> : null}
    </Pressable>
  );
}

function SpeciesMini({ s }) {
  return (
    <View style={{ alignItems: "center", width: 110 }}>
      <SpeciesThumb species={s} size={64} radius={16} />
      <Text style={{ color: "#fff", fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", textAlign: "center", marginTop: 6 }} numberOfLines={2}>{s.name}</Text>
    </View>
  );
}
function TwoSpecies({ a, b, question }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 14 }}>
        <SpeciesMini s={a} />
        <Text style={{ color: theme.secondaryText, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 20 }}>+</Text>
        <SpeciesMini s={b} />
      </View>
      <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", textAlign: "center", marginTop: 14 }}>{question}</Text>
    </View>
  );
}

// ── Round generators ─────────────────────────────────────────────────────────
function makeGuessRound() {
  const answer = rand(IMG_SPECIES);
  const others = sample(IMG_SPECIES.filter((s) => s.name !== answer.name), 3);
  const options = shuffle([answer, ...others]).map((s) => ({ key: s.name, label: s.name, correct: s.name === answer.name }));
  return {
    prompt: (
      <View style={{ alignItems: "center" }}>
        <Image source={getSpeciesImage(answer.name)} style={{ width: 180, height: 180, borderRadius: 24, borderWidth: 1, borderColor: theme.border }} resizeMode="cover" />
        <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 12 }}>Which fish is this?</Text>
      </View>
    ),
    options,
  };
}

function makeMatchRound() {
  const a = rand(SPECIES);
  const samePool = SPECIES.filter((s) => s.name !== a.name && s.water === a.water);
  const b = rand(samePool.length ? samePool : SPECIES.filter((s) => s.name !== a.name));
  const c = getCompatibility(a.name, b.name);
  const options = [
    { key: "excellent", label: "Great tankmates", dot: theme.accent },
    { key: "caution", label: "Keep an eye on them", dot: theme.warn },
    { key: "avoid", label: "Avoid — don't mix", dot: theme.danger },
  ].map((o) => ({ ...o, correct: o.key === c.level }));
  return { prompt: <TwoSpecies a={a} b={b} question="Will these two get along?" />, options, explain: c.reason };
}

function makeBiggerRound() {
  let a = rand(SPECIES), b = rand(SPECIES), t = 0;
  while ((b.name === a.name || b.minGallons === a.minGallons) && t < 40) { b = rand(SPECIES); t++; }
  const bigger = a.minGallons >= b.minGallons ? a : b;
  const options = shuffle([a, b]).map((s) => ({ key: s.name, label: `${s.emoji} ${s.name}`, correct: s.name === bigger.name }));
  return { prompt: <TwoSpecies a={a} b={b} question="Which one needs the bigger tank?" />, options, explain: `${a.name}: ${formatVolume(a.minGallons)} min · ${b.name}: ${formatVolume(b.minGallons)} min` };
}

function makeTriviaRound() {
  const s = rand(SPECIES);
  const kinds = ["water", "temperament", "diet"];
  if (s.reefSafe != null && s.kind === "fish") kinds.push("reef");
  const type = rand(kinds);
  let q, opts, answer;
  if (type === "water") { q = `Is ${s.name} freshwater or saltwater?`; opts = ["Freshwater", "Saltwater"]; answer = s.water === "salt" ? "Saltwater" : "Freshwater"; }
  else if (type === "temperament") { q = `What's ${s.name}'s temperament?`; opts = ["Peaceful", "Semi-aggressive", "Aggressive"]; answer = { peaceful: "Peaceful", "semi-aggressive": "Semi-aggressive", aggressive: "Aggressive" }[s.temperament]; }
  else if (type === "diet") { q = `What does ${s.name} mainly eat?`; opts = ["Omnivore", "Carnivore", "Herbivore", "Photosynthetic"]; answer = cap(s.diet); }
  else { q = `Is ${s.name} reef-safe?`; opts = ["Yes", "No"]; answer = s.reefSafe ? "Yes" : "No"; }
  const options = shuffle(opts).map((o) => ({ key: o, label: o, correct: o === answer }));
  return {
    prompt: (
      <View style={{ alignItems: "center" }}>
        <SpeciesThumb species={s} size={72} radius={18} />
        <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", textAlign: "center", marginTop: 12 }}>{q}</Text>
      </View>
    ),
    options,
  };
}
