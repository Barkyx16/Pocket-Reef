import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { useTabBarScroll } from "../lib/tabBarScroll";
import { getSpecies, getTankStatus, getTankWarnings, getTankMaturity, getTankHealthScore, getBioload, PARAMS, tapHaptic } from "../core";
import { HeroBanner } from "../components/HeroBanner";
import { EmptyState } from "../components/EmptyState";
import { SpeciesCard } from "../components/SpeciesCard";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { TankIdeasCard } from "../components/TankIdeasCard";
import { TankToolboxCard } from "../components/TankToolboxCard";
import { TankExtrasCard } from "../components/TankExtrasCard";
import { TankHubCard } from "../components/TankHubCard";
import { TankHealthCard } from "../components/TankHealthCard";
import { StockingPlannerCard } from "../components/StockingPlannerCard";
import { ProgressBar } from "../components/ProgressBar";
import { Pill } from "../components/Pill";
import { t } from "../lib/i18n";
import { formatVolume } from "../lib/units";

const TANK_PRESETS = [5, 10, 20, 30, 55, 75, 125];

export function TankTab({ tankGallons, setTankGallons, tank, tankWater, tankCreatedAt, tankNotes, waterTests = [], maintenance = {}, quantities = {}, onSetQuantity, toggleTank, openSpecies, onLoadIdea, onClearStock, quarantine, onAddQuarantine, onRemoveQuarantine, onGraduateQuarantine, tanks = [], activeTankId, onSwitchTank, onAddTank, onGoToTab, onLoadPlan }) {
  const tabBarScroll = useTabBarScroll();
  const status = getTankStatus(tankGallons, tank, quantities);
  const warnings = getTankWarnings(tankGallons, tank, quantities);
  const maturity = getTankMaturity(tankCreatedAt);
  const bio = getBioload(tankGallons, tank, quantities);
  const health = getTankHealthScore({ tank, tankGallons, waterTests, maintenance, quantities });
  const species = tank.map(getSpecies).filter(Boolean);
  const qty = (name) => quantities[name] || 1;
  const waterType = tank.length ? (getSpecies(tank[0])?.water === "salt" ? "🌊 Salt" : "💧 Fresh") : (tankWater === "salt" ? "🌊 Salt" : "💧 Fresh");

  const shareTank = () => {
    tapHaptic();
    const lines = species.map((s) => `${s.emoji} ${qty(s.name) > 1 ? `${qty(s.name)}× ` : ""}${s.name}`).join("\n");
    const maturityLine = maturity ? `\nRunning ${maturity.days} days · ${maturity.stage}` : "";
    // Latest water snapshot, if any.
    const latest = waterTests[0];
    let waterLine = "";
    if (latest && latest.values) {
      const parts = (PARAMS[latest.water] || PARAMS.fresh)
        .filter((p) => latest.values[p.key] != null)
        .map((p) => `${p.label} ${latest.values[p.key]}${p.unit ? p.unit : ""}`);
      if (parts.length) waterLine = `\nLatest water: ${parts.join(" · ")}`;
    }
    Share.share({
      message: `My Pocket Reef tank 🐠\n${formatVolume(tankGallons)} · ${tank.length} species · ${status.label}\nHealth ${health.score}/100 (${health.label})${maturityLine}${waterLine}\n\n${lines}\n\nBuilt with Pocket Reef`,
    }).catch(() => {});
  };

  // The active tank's full detail — stats, health, conflicts/positives, its fish,
  // and controls — rendered inside the tappable hub row.
  const renderDetail = () => (
    <View style={{ paddingTop: 12 }}>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Stocked" value={`${tank.length}`} />
        <Stat label="Water" value={waterType} divider />
        <Stat label="Bioload" value={tank.length ? `${bio.pct}%` : "—"} color={tank.length ? bio.color : undefined} divider />
        <Stat label="Age" value={maturity ? `${maturity.days}d` : "New"} color={maturity ? maturity.color : undefined} divider />
      </View>
      {tank.length ? <View style={{ marginTop: 12 }}><ProgressBar pct={bio.pct} color={bio.color} height={8} /></View> : null}
      {maturity && maturity.days < 42 ? (
        <Text style={{ color: theme.warn, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>🌱 {maturity.stage} — still maturing, add livestock slowly.</Text>
      ) : null}

      {/* Conflicts / positives */}
      {tank.length ? (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={[styles.cardEyebrow, { color: warnings.length ? theme.warn : theme.accent }]}>{warnings.length ? "⚠️ Things to Check" : "✅ All Compatible"}</Text>
          {warnings.length ? warnings.map((w, i) => (
            <Text key={i} style={{ color: w.level === "avoid" ? theme.danger : theme.warn, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 20, marginTop: 6 }}>• {w.text}</Text>
          )) : (
            <Text style={[styles.cardText, { marginTop: 6 }]}>Everything in your tank gets along and fits the space. Nice work! 🐠</Text>
          )}
        </View>
      ) : null}

      {/* Health */}
      {tank.length ? (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={[styles.cardEyebrow, { marginBottom: 10 }]}>Tank Health</Text>
          <TankHealthCard health={health} onGoToTab={onGoToTab} />
        </View>
      ) : null}

      {/* Fish in this tank */}
      <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
        <Text style={[styles.cardEyebrow, { marginBottom: 10 }]}>In This Tank</Text>
        {species.length === 0 ? (
          <EmptyState emoji="🐠" title="Your tank is empty" subtitle="Head to the Species tab and tap ＋ to stock it — Pocket Reef flags any conflicts instantly." />
        ) : (
          species.map((s) => (
            <View key={s.name}>
              <SpeciesCard species={s} onPress={() => openSpecies(s.name)} inTank={true} onToggleTank={() => toggleTank(s.name)} />
              {onSetQuantity ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: -6, marginBottom: 12, paddingRight: 4 }}>
                  <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>How many?{s.minGroup > 1 ? ` · group of ${s.minGroup}+` : ""}</Text>
                  <Stepper value={qty(s.name)} onDec={() => onSetQuantity(s.name, qty(s.name) - 1)} onInc={() => onSetQuantity(s.name, qty(s.name) + 1)} low={s.minGroup > 1 && qty(s.name) < s.minGroup} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Size */}
      <Text style={[styles.cardEyebrow, { marginTop: 16, marginBottom: 8 }]}>Tank size</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TANK_PRESETS.map((g) => (
          <Pill key={g} label={`${g} gal`} active={tankGallons === g} onPress={() => setTankGallons && setTankGallons(g)} />
        ))}
      </View>

      {/* Notes */}
      {tankNotes && tankNotes.trim() ? (
        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text style={styles.cardEyebrow}>Notes</Text>
          <Text style={[styles.cardText, { marginTop: 8 }]}>{tankNotes}</Text>
        </View>
      ) : null}

      {/* Clear */}
      {species.length && onClearStock ? (
        <Pressable onPress={() => Alert.alert("Clear this tank?", "This removes every species and its count from the tank. Your logs, journal, and costs are kept.", [{ text: "Cancel", style: "cancel" }, { text: "Clear tank", style: "destructive", onPress: () => onClearStock() }])} style={[styles.ghostBtn, { marginTop: 14, borderColor: "rgba(255,123,123,0.4)" }]} accessibilityRole="button">
          <Text style={[styles.ghostBtnText, { color: theme.danger }]}>🗑️ Clear tank stock</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} {...tabBarScroll} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={t("tank.eyebrow", { gallons: tankGallons, count: tank.length })}
        title={t("tank.title")}
        subtitle={t("tank.sub")}
        emoji="🌊"
        colors={["#0b3a4d", "#0a2c42", "#082031"]}
      />

      {/* TANK HUB — add/switch tanks; tap a tank to open its full detail inline */}
      <TankHubCard
        tanks={tanks}
        activeTankId={activeTankId}
        onSwitch={onSwitchTank}
        onAdd={onAddTank}
        onQuickAdd={() => onGoToTab && onGoToTab("species")}
        renderDetail={renderDetail}
      />

      {/* TANK TOOLS — stocking, room, window, gear, new fish, quarantine */}
      <TankToolboxCard
        tankGallons={tankGallons}
        tank={tank}
        tankWater={tankWater}
        quantities={quantities}
        quarantine={quarantine}
        onAddQuarantine={onAddQuarantine}
        onRemoveQuarantine={onRemoveQuarantine}
        onGraduateQuarantine={onGraduateQuarantine}
      />

      {/* EXPLORE & MORE — recommended, matrix, feeding, share */}
      <TankExtrasCard
        tank={tank}
        tankGallons={tankGallons}
        tankWater={tankWater}
        quantities={quantities}
        openSpecies={openSpecies}
        toggleTank={toggleTank}
        onShare={shareTank}
      />

      {/* TANK SETUPS */}
      <CollapsibleCard storageKey="planner" title="🧭 Plan My Tank" eyebrow="A conflict-free plan for this exact tank">
        <StockingPlannerCard
          tankGallons={tankGallons}
          tankWater={tankWater}
          hasStock={tank.length > 0}
          onLoadPlan={onLoadPlan}
        />
      </CollapsibleCard>

      <CollapsibleCard storageKey="tankideas" title="💡 Tank Setups" defaultOpen={species.length === 0} eyebrow="Proven, conflict-free builds">
        <TankIdeasCard onLoad={onLoadIdea} />
      </CollapsibleCard>
    </ScrollView>
  );
}

// A divided stat cell for the compact "Your Tank" overview strip.
function Stat({ label, value, color, divider }) {
  return (
    <View style={{ alignItems: "center", flex: 1, borderLeftWidth: divider ? 1 : 0, borderLeftColor: theme.hairline }}>
      <Text style={{ color: color || "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

// Compact −/＋ quantity control. Highlights amber when the count is below the
// species' schooling minimum.
function Stepper({ value, onDec, onInc, low }) {
  const btn = { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: theme.accent };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable onPress={() => { tapHaptic("light"); onDec(); }} hitSlop={6} style={btn} accessibilityRole="button" accessibilityLabel="Decrease count">
        <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>−</Text>
      </Pressable>
      <Text style={{ color: low ? theme.warn : "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", minWidth: 22, textAlign: "center" }}>{value}</Text>
      <Pressable onPress={() => { tapHaptic("light"); onInc(); }} hitSlop={6} style={btn} accessibilityRole="button" accessibilityLabel="Increase count">
        <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>+</Text>
      </Pressable>
    </View>
  );
}
