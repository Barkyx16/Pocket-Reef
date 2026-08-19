import { Pressable, Text, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { getTreatment, getTreatmentProgress, tapHaptic, successHaptic } from "../core";
import { ProgressBar } from "./ProgressBar";
import { GradientButton } from "./GradientButton";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// ─────────────────────────────────────────────────────────────────────────────
// A running treatment course.
//
// The disease guide told you what it was and stopped. This is the part that
// changes outcomes: a schedule you tick off, and — more importantly — a
// structure that keeps going after the symptoms disappear.
//
// The keyPoint banner is the most valuable element on the card. For ich,
// "spots vanishing means the parasite has dropped off to breed" is the single
// fact that separates a cure from a relapse, and it stays visible the whole
// course rather than being buried in step 5.
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY = {
  critical: { color: theme.danger, label: "Act now" },
  high: { color: theme.warn, label: "Treat promptly" },
  moderate: { color: theme.accent, label: "Treat steadily" },
};

export function TreatmentPlanCard({ diseaseName, treatment, onStart, onToggleStep, onStop }) {
  const plan = getTreatment(diseaseName);
  if (!plan) return null;

  const progress = treatment ? getTreatmentProgress(diseaseName, treatment.startedAt, treatment.doneSteps || []) : null;
  const urgency = URGENCY[plan.urgency] || URGENCY.moderate;

  if (!progress) {
    return (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <View style={{ backgroundColor: `${urgency.color}22`, borderColor: `${urgency.color}66`, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: urgency.color, fontSize: type.micro, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{urgency.label}</Text>
          </View>
          <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{plan.durationDays}-day course</Text>
        </View>

        <Text style={styles.cardText}>
          Start a guided course and Pocket Reef will track each step — including the ones after
          the symptoms disappear.
        </Text>

        <View style={{ marginTop: 12, backgroundColor: "rgba(255,211,114,0.10)", borderWidth: 1, borderColor: "rgba(255,211,114,0.30)", borderRadius: radius.lg, padding: 12 }}>
          <Text style={{ color: theme.warn, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 }}>
            Read this first
          </Text>
          <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>{plan.keyPoint}</Text>
        </View>

        <GradientButton label="Start treatment" onPress={() => { tapHaptic("medium"); onStart && onStart(diseaseName); }} style={{ marginTop: 14 }} />
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>
          Day {progress.day} of {progress.durationDays}
        </Text>
        <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
          {progress.completed}/{progress.total} steps
        </Text>
      </View>

      <ProgressBar pct={progress.pct} height={10} glow label={`Treatment progress, ${progress.pct}%`} />

      {/* The fact that prevents the relapse — kept in front of them all course. */}
      <View style={{ marginTop: 14, backgroundColor: "rgba(255,211,114,0.10)", borderWidth: 1, borderColor: "rgba(255,211,114,0.30)", borderRadius: radius.lg, padding: 12 }}>
        <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>{progress.keyPoint}</Text>
      </View>

      {progress.abandonedEarly ? (
        <View style={{ marginTop: 12, backgroundColor: "rgba(255,123,123,0.10)", borderWidth: 1, borderColor: "rgba(255,123,123,0.34)", borderRadius: radius.lg, padding: 12 }}>
          <Text style={{ color: theme.danger, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Course ended with steps unfinished</Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 4, lineHeight: 17 }}>
            This is the most common reason an infection returns. If symptoms come back, start again
            and complete the full course.
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 16, gap: 10 }}>
        {progress.steps.map((step) => {
          const state = step.done ? "done" : step.overdue ? "overdue" : step.due ? "due" : "future";
          const color = state === "done" ? theme.accent : state === "overdue" ? theme.danger : state === "due" ? theme.warn : theme.secondaryText;
          return (
            <Pressable
              key={step.id}
              onPress={() => { step.done ? tapHaptic() : successHaptic(); onToggleStep && onToggleStep(diseaseName, step.id); }}
              style={({ pressed }) => [{ flexDirection: "row", gap: 12, alignItems: "flex-start", opacity: state === "future" ? 0.5 : 1 }, pressed && { opacity: 0.7 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: step.done }}
              accessibilityLabel={`Day ${step.day}: ${step.title}`}
            >
              <View style={{
                width: 24, height: 24, borderRadius: radius.xs, marginTop: 1,
                backgroundColor: step.done ? "rgba(56,225,198,0.18)" : "rgba(255,255,255,0.05)",
                borderWidth: 1, borderColor: step.done ? theme.accent : `${color}66`,
                alignItems: "center", justifyContent: "center",
              }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ color, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900" }}>{step.done ? "✓" : step.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: step.done ? theme.secondaryText : "#fff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900", textDecorationLine: step.done ? "line-through" : "none" }}>
                  {step.title}
                </Text>
                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2, lineHeight: 17 }}>
                  {step.detail}
                </Text>
                {state === "overdue" ? (
                  <Text style={{ color: theme.danger, fontSize: type.caption, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4 }}>Overdue</Text>
                ) : state === "future" ? (
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4 }}>
                    In {step.daysAway} day{step.daysAway === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => { tapHaptic(); onStop && onStop(diseaseName); }}
        style={({ pressed }) => [{ marginTop: 16, paddingVertical: 10, alignItems: "center" }, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>End treatment</Text>
      </Pressable>
    </View>
  );
}
