import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";
import { ProgressBar } from "./ProgressBar";
import { GradientButton } from "./GradientButton";

// ─────────────────────────────────────────────────────────────────────────────
// A live drip-acclimation timer.
//
// The acclimation card was a static checklist, which is the one format that
// doesn't help here: the whole task is time — float 15 minutes, add water every
// 5, wait, repeat — and it's happening while you're holding a bag of stressed
// fish over a bucket. Nobody is reading a checklist and watching a clock.
//
// Deliberately simple: no background scheduling, no notifications. The timer
// runs while the screen is open, which is exactly when someone is doing this.
// It reads elapsed time from a start timestamp rather than counting ticks, so
// it stays accurate even if the interval drifts or the screen sleeps briefly.
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = [
  { id: "float", label: "Float the sealed bag", minutes: 15, detail: "Lights off. This equalizes temperature without exposing the fish to anything yet.", emoji: "🎈" },
  { id: "open", label: "Open and add tank water", minutes: 5, detail: "Add about a quarter cup of tank water to the bag.", emoji: "💧" },
  { id: "wait1", label: "Wait", minutes: 5, detail: "Let the fish adjust to the new mix.", emoji: "⏳" },
  { id: "add2", label: "Add water again", minutes: 5, detail: "Another quarter cup. The volume should be roughly doubling by now.", emoji: "💧" },
  { id: "wait2", label: "Wait", minutes: 5, detail: "Watch for laboured breathing — if it appears, slow down and add less.", emoji: "⏳" },
  { id: "add3", label: "Final addition", minutes: 5, detail: "Last quarter cup. Saltwater arrivals benefit from a longer, slower drip than this.", emoji: "💧" },
  { id: "net", label: "Net the fish across", minutes: 0, detail: "Net the fish into the tank and DISCARD the bag water — it holds ammonia the fish has been sitting in.", emoji: "🥅" },
];

const TOTAL_MINUTES = PHASES.reduce((n, p) => n + p.minutes, 0);

function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AcclimationTimer({ onComplete }) {
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timer = useRef(null);

  useEffect(() => {
    if (!startedAt) return;
    timer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [startedAt]);

  // Elapsed is derived from the start timestamp, never accumulated — a dropped
  // interval tick can't make the timer wrong.
  const elapsedSec = startedAt ? (now - startedAt) / 1000 : 0;
  const elapsedMin = elapsedSec / 60;

  // Which phase are we in, and how far through it?
  let acc = 0;
  let currentIndex = PHASES.length - 1;
  for (let i = 0; i < PHASES.length; i++) {
    if (elapsedMin < acc + PHASES[i].minutes || PHASES[i].minutes === 0) { currentIndex = i; break; }
    acc += PHASES[i].minutes;
  }
  const current = PHASES[currentIndex];
  const phaseElapsedSec = Math.max(0, elapsedSec - acc * 60);
  const phaseRemainingSec = current.minutes ? current.minutes * 60 - phaseElapsedSec : 0;
  const done = elapsedMin >= TOTAL_MINUTES;

  // Haptic on each phase change, so it works without watching the screen.
  const lastPhase = useRef(currentIndex);
  useEffect(() => {
    if (!startedAt) return;
    if (lastPhase.current !== currentIndex) {
      lastPhase.current = currentIndex;
      tapHaptic("medium");
    }
  }, [currentIndex, startedAt]);

  const start = () => { tapHaptic("medium"); setStartedAt(Date.now()); setNow(Date.now()); };
  const reset = () => { tapHaptic(); setStartedAt(null); };

  if (!startedAt) {
    return (
      <View>
        <Text style={styles.cardText}>
          A guided {TOTAL_MINUTES}-minute acclimation. Float, mix, and move — the timer tells you
          when each step is up so you can keep both hands on the bag.
        </Text>
        <GradientButton label="Start acclimation" icon="stopwatch-outline" onPress={start} style={{ marginTop: 14 }} />
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <View style={styles.iconSquare}><Text style={{ fontSize: 18 }}>{current.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {done ? "Acclimation complete" : current.label}
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 17 }}>
            {done ? "Net the fish across and discard the bag water." : current.detail}
          </Text>
        </View>
        {!done && current.minutes ? (
          <Text style={{ color: theme.accent, fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {mmss(phaseRemainingSec)}
          </Text>
        ) : null}
      </View>

      <ProgressBar
        pct={Math.min(100, (elapsedMin / TOTAL_MINUTES) * 100)}
        height={10}
        glow
        label={`Acclimation progress, step ${currentIndex + 1} of ${PHASES.length}`}
      />
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>
        Step {currentIndex + 1} of {PHASES.length} · {mmss(elapsedSec)} elapsed of ~{TOTAL_MINUTES} min
      </Text>

      <View style={{ marginTop: 16, gap: 8 }}>
        {PHASES.map((p, i) => {
          const passed = i < currentIndex || done;
          const isNow = i === currentIndex && !done;
          return (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: passed ? 0.55 : 1 }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: passed ? "rgba(56,225,198,0.18)" : isNow ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.05)",
                borderWidth: 1, borderColor: isNow ? theme.accent : passed ? "rgba(56,225,198,0.45)" : theme.border,
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: passed ? theme.accent : theme.secondaryText, fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  {passed ? "✓" : i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, color: isNow ? "#fff" : theme.text, fontSize: 13, fontWeight: isNow ? "900" : "700" }}>
                {p.label}
              </Text>
              {p.minutes ? (
                <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{p.minutes}m</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {done ? (
        <GradientButton
          label="Done — log it 🐠"
          onPress={() => { tapHaptic("medium"); if (onComplete) onComplete(); setStartedAt(null); }}
          style={{ marginTop: 16 }}
        />
      ) : (
        <Pressable onPress={reset} style={({ pressed }) => [{ marginTop: 14, paddingVertical: 10, alignItems: "center" }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={{ color: theme.secondaryText, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}
