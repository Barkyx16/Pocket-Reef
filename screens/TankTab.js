import { memo } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { getSpecies, getTankStatus, getTankWarnings, getTankMaturity, getTankHealthScore, getBioload, getConflictFixes, tapHaptic } from "../core";
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
import { TankRecordCard } from "../components/TankRecordCard";
import { EquipmentCard } from "../components/EquipmentCard";
import { InventoryCard } from "../components/InventoryCard";
import { WhatIfCard } from "../components/WhatIfCard";
import { VacationCard } from "../components/VacationCard";
import { ExistingTankCard } from "../components/ExistingTankCard";
import { forecastInventory } from "../lib/inventory";
import { TargetsCard } from "../components/TargetsCard";
import { ProgressBar } from "../components/ProgressBar";
import { Pill } from "../components/Pill";
import { t } from "../lib/i18n";
import { formatVolume } from "../lib/units";
import { activeParams } from "../lib/targets";
import { AdaptiveColumns } from "../components/AdaptiveColumns";
import { CardBoundary } from "../components/CardBoundary";
import { useScrollToTop } from "../lib/scrollToTop";

const TANK_PRESETS = [5, 10, 20, 30, 55, 75, 125];

export const TankTab = memo(function TankTab({ tankGallons, setTankGallons, tank, tankWater, tankCreatedAt, tankNotes, waterTests = [], maintenance = {}, quantities = {}, onSetQuantity, toggleTank, openSpecies, onLoadIdea, onClearStock, quarantine, onAddQuarantine, onRemoveQuarantine, onGraduateQuarantine, onSetQuarantineCheck, tanks = [], activeTankId, onSwitchTank, onAddTank, onGoToTab, onLoadPlan, stockMeta = {}, losses = [], onOpenRecord, onDeleteLoss, onShareReport, equipment = [], onAddEquipment, onRemoveEquipment, intent, targets = {}, onSetTarget, onSetAllTargets, activeTank = {}, onAddInventory, onRemoveInventory, onSetInventoryStock, wishlist = [], onSetupExisting }) {
  const scrollRef = useScrollToTop();
  // Same contract as the Log tab: a shortcut names the card it wants open.
  const openIf = (key) => (intent && intent.card === key ? intent.nonce : null);
  // Just the count, for the collapsed header — the card itself does the work.
  const inventoryNeeds = forecastInventory(activeTank.inventory || [], activeTank, {}).needs.length;
  const status = getTankStatus(tankGallons, tank, quantities);
  const warnings = getTankWarnings(tankGallons, tank, quantities);
  const conflictFixes = getConflictFixes(tankGallons, tank, 3);
  const maturity = getTankMaturity(tankCreatedAt);
  const bio = getBioload(tankGallons, tank, quantities);
  const health = getTankHealthScore({ tank, tankGallons, waterTests, maintenance, quantities, waterType: tankWater });
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
      const parts = (activeParams(latest.water))
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
        <Text style={{ color: theme.warn, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>🌱 {maturity.stage} — still maturing, add livestock slowly.</Text>
      ) : null}

      {/* Conflicts / positives */}
      {tank.length ? (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { color: warnings.length ? theme.warn : theme.accent }]}>{warnings.length ? "⚠️ Things to Check" : "✅ All Compatible"}</Text>
          {warnings.length ? warnings.map((w, i) => (
            <Text key={i} style={{ color: w.level === "avoid" ? theme.danger : theme.warn, fontSize: type.body, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 20, marginTop: 6 }}>• {w.text}</Text>
          )) : (
            <Text style={[styles.cardText, { marginTop: 6 }]}>Everything in your tank gets along and fits the space. Nice work! 🐠</Text>
          )}

          {/* What to actually DO about a conflict. getConflictFixes has worked
              out swaps — which fish to rehome and what fills the same role —
              since it was written, and no screen has ever rendered it. Naming
              a problem and withholding the answer is the least useful thing an
              app can do. */}
          {conflictFixes.length ? (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.hairline }}>
              <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 6 }]}>Ways to fix it</Text>
              {conflictFixes.map((f, i) => (
                <View key={i} style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 11, marginTop: 8 }}>
                  <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                    Rehome {f.replace}, keep {f.keeping}
                  </Text>
                  {f.alternatives.length ? (
                    <>
                      <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4 }}>
                        Similar and compatible:
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {f.alternatives.map((alt) => (
                          <Pressable key={alt.name} onPress={() => openSpecies(alt.name)} style={styles.pill} accessibilityRole="button" accessibilityLabel={`${alt.name}, a compatible alternative to ${f.replace}`}>
                            <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{alt.emoji} {alt.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Health */}
      {tank.length ? (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 10 }]}>Tank Health</Text>
          <CardBoundary name="Tank Health"><TankHealthCard health={health} onGoToTab={onGoToTab} /></CardBoundary>
        </View>
      ) : null}

      {/* Fish in this tank */}
      <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 10 }]}>In This Tank</Text>
        {species.length === 0 ? (
          <EmptyState emoji="🐠" title="Your tank is empty" subtitle="Head to the Species tab and tap ＋ to stock it — Pocket Reef flags any conflicts instantly." />
        ) : (
          species.map((s) => (
            <View key={s.name}>
              <SpeciesCard species={s} onPress={() => openSpecies(s.name)} inTank={true} onToggleTank={() => toggleTank(s.name)} />
              {onSetQuantity ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: -6, marginBottom: 12, paddingRight: 4 }}>
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>How many?{s.minGroup > 1 ? ` · group of ${s.minGroup}+` : ""}</Text>
                  <Stepper value={qty(s.name)} onDec={() => onSetQuantity(s.name, qty(s.name) - 1)} onInc={() => onSetQuantity(s.name, qty(s.name) + 1)} low={s.minGroup > 1 && qty(s.name) < s.minGroup} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Size */}
      <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 16, marginBottom: 8 }]}>Tank size</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TANK_PRESETS.map((g) => (
          <Pill key={g} label={formatVolume(g)} active={tankGallons === g} onPress={() => setTankGallons && setTankGallons(g)} />
        ))}
      </View>

      {/* Notes */}
      {tankNotes && tankNotes.trim() ? (
        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline }}>
          <Text accessibilityRole="header" style={styles.cardEyebrow}>Notes</Text>
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
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AdaptiveColumns lead={1}>
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
        onGraduateQuarantine={onGraduateQuarantine} onSetQuarantineCheck={onSetQuarantineCheck}
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
      {/* The tank's own record. Open by default once there's a history worth
          reading — a keeper who has lost something wants to see it, not go
          looking for it. */}
      <CollapsibleCard
        storageKey="record"
        forceOpen={openIf("record")}
        title="📋 Tank Record"
        defaultOpen={losses.length > 0}
        eyebrow={losses.length ? `${tank.length} living · ${losses.length} recorded` : "How long everything has lived here"}
      >
        <TankRecordCard
          stock={tank}
          stockMeta={stockMeta}
          quantities={quantities}
          losses={losses}
          onOpenRecord={onOpenRecord}
          onDeleteLoss={onDeleteLoss}
          onShareReport={onShareReport}
        />
      </CollapsibleCard>

      {/* What "good" means for THIS tank. It describes the tank rather than
          logging it, which is why it belongs here and not on the Log tab —
          it's set once and revisited rarely, but every reading is graded by it. */}
      <CollapsibleCard
        storageKey="targets"
        forceOpen={openIf("targets")}
        title="🎯 My Targets"
        eyebrow={Object.keys(targets).length ? `${Object.keys(targets).length} set for this tank` : "Grade readings against your ranges"}
      >
        <TargetsCard waterType={tankWater} targets={targets} onSetTarget={onSetTarget} onSetAll={onSetAllTargets} />
      </CollapsibleCard>

      {/* What's physically on the tank. Sits with the tank's own record — both
          describe the system rather than the day-to-day logging. */}
      <CollapsibleCard
        storageKey="equipment"
        forceOpen={openIf("equipment")}
        title="🧰 Equipment"
        eyebrow={equipment.length ? `${equipment.length} recorded` : "Heater, pump, skimmer, light"}
      >
        <EquipmentCard equipment={equipment} onAdd={onAddEquipment} onRemove={onRemoveEquipment} />
      </CollapsibleCard>

      {/* The shelf that keeps the tank running, next to the gear that runs it.
          Both answer "what do I own", on different timescales. */}
      <CollapsibleCard
        storageKey="inventory"
        forceOpen={openIf("inventory")}
        title="🧂 Supplies"
        eyebrow={inventoryNeeds ? `${inventoryNeeds} to restock` : "Salt, RODI, media, test kits"}
      >
        <InventoryCard
          tank={activeTank}
          waterType={tankWater}
          onAdd={onAddInventory}
          onRemove={onRemoveInventory}
          onSetStock={onSetInventoryStock}
        />
      </CollapsibleCard>

      {/* The wishlist, priced up against this exact tank. Sits with the
          stocking tools, not the catalog — it's a decision about this tank
          rather than a way to browse. */}
      <CollapsibleCard
        storageKey="whatif"
        title="🔮 What If I Bought These?"
        eyebrow={wishlist.length ? `${wishlist.length} on your wishlist` : "Star species to simulate them"}
      >
        <WhatIfCard tank={activeTank} wishlist={wishlist} onOpenSpecies={openSpecies} />
      </CollapsibleCard>

      {/* Only for a tank that hasn't been described yet — once it's dated and
          has readings, this is noise and disappears. */}
      {(!waterTests.length || !tankCreatedAt) ? (
        <CollapsibleCard storageKey="existing" title="🕰️ Already Running?" eyebrow="Set up a tank you already have" defaultOpen={true}>
          <ExistingTankCard tank={activeTank} waterType={tankWater} onApply={onSetupExisting} onGoToTab={onGoToTab} />
        </CollapsibleCard>
      ) : null}

      {/* Handing the tank over. Sits with the tank's own description — it's
          about this system, not about today's logging. */}
      <CollapsibleCard storageKey="vacation" title="✈️ Going Away" eyebrow="Care notes for whoever's watching it">
        <VacationCard tank={activeTank} waterType={tankWater} />
      </CollapsibleCard>

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
    </AdaptiveColumns>
    </ScrollView>
  );
})

// A divided stat cell for the compact "Your Tank" overview strip.
function Stat({ label, value, color, divider }) {
  return (
    <View style={{ alignItems: "center", flex: 1, borderLeftWidth: divider ? 1 : 0, borderLeftColor: theme.hairline }}>
      <Text style={{ color: color || "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

// Compact −/＋ quantity control. Highlights amber when the count is below the
// species' schooling minimum.
function Stepper({ value, onDec, onInc, low }) {
  const btn = { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: theme.accent };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable onPress={() => { tapHaptic("light"); onDec(); }} hitSlop={6} style={btn} accessibilityRole="button" accessibilityLabel="Decrease count">
        <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>−</Text>
      </Pressable>
      <Text style={{ color: low ? theme.warn : "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", minWidth: 22, textAlign: "center" }}>{value}</Text>
      <Pressable onPress={() => { tapHaptic("light"); onInc(); }} hitSlop={6} style={btn} accessibilityRole="button" accessibilityLabel="Increase count">
        <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>+</Text>
      </Pressable>
    </View>
  );
}
