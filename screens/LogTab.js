import { memo } from "react";
import { ScrollView, Share } from "react-native";
import { styles } from "../styles";
import { getStreak, tapHaptic, getParamForecasts, resolveWaterType } from "../core";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { WaterTestCard } from "../components/WaterTestCard";
import { TankToolkitCard } from "../components/TankToolkitCard";
import { DoseLogCard } from "../components/DoseLogCard";
import { t } from "../lib/i18n";
import { activeParams } from "../lib/targets";
import { AdaptiveColumns } from "../components/AdaptiveColumns";
import { useScrollToTop } from "../lib/scrollToTop";

export const LogTab = memo(function LogTab({ tankWater = "fresh", tank, tankGallons, waterTests, journal, activeDays, costs, feedings = [], maintenance, onLogTest, onUpdateTest, onDeleteTest, onAddJournal, onAddCost, onDeleteCost, onAddFeeding, onDeleteFeeding, onLogMaintenance, onLogWaterChange, premiumUnlocked, onOpenPremium, intent, activeTank = {}, onAddUpkeepTask, onRemoveUpkeepTask, onSetUpkeepInterval, strengths = {}, onLogDose, onDeleteDose, onSetStrength, onSetSourceWater, onImportTests, onSetLightSchedule, onGoToTab, onLogMedDose, onDeleteMedDose }) {
  const scrollRef = useScrollToTop();
  const waterType = resolveWaterType(tank, tankWater);
  // A shortcut names the card it wants open. This used to be hard-coded to the
  // water-test card, so "Log a dose" landed on the Log tab with the dose card
  // still folded shut — the shortcut failing at the last step.
  const openIf = (key) => (intent && intent.card === key ? intent.nonce : null);
  const streak = getStreak(activeDays);

  // Share the water-test history as CSV text — a portable record for a
  // spreadsheet or your fish store.
  const exportWaterLog = () => {
    if (!waterTests.length) return;
    tapHaptic();
    const params = activeParams(waterType);
    const header = ["Date", ...params.map((p) => `${p.label}${p.unit ? ` (${p.unit})` : ""}`)].join(",");
    const rows = waterTests.map((tst) => [tst.date, ...params.map((p) => (tst.values && tst.values[p.key] != null ? tst.values[p.key] : ""))].join(","));
    Share.share({ message: `Pocket Reef water log\n\n${header}\n${rows.join("\n")}` }).catch(() => {});
  };

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AdaptiveColumns lead={1}>
      <HeroBanner
        eyebrow={streak ? t("log.eyebrowStreak", { streak }) : t("log.eyebrowIdle")}
        title={t("log.title")}
        subtitle={t("log.sub")}
        emoji="🧪"
        colors={["#0e3a44", "#0b2c3a", "#082031"]}
      />

      <CollapsibleCard storageKey="watertest" title="🧪 Water Test" defaultOpen={true} forceOpen={openIf("watertest")}>
        <WaterTestCard waterType={waterType} history={waterTests} onLog={onLogTest} onUpdate={onUpdateTest} onDelete={onDeleteTest} />
      </CollapsibleCard>

      {/* Correcting a low reading and holding it steady are the same
          conversation, so the log sits directly under the calculator. */}
      {waterType === "salt" ? (
        <CollapsibleCard
          storageKey="doselog"
          forceOpen={openIf("doselog")}
          title="💉 Dose Log"
          eyebrow="What you dose, and what your tank uses"
        >
          <DoseLogCard
            tank={activeTank}
            tankGallons={tankGallons}
            waterTests={waterTests}
            strengths={strengths}
            onLogDose={onLogDose}
            onDeleteDose={onDeleteDose}
            onSetStrength={onSetStrength}
          />
        </CollapsibleCard>
      ) : null}

      {/* Everything else lives here. The Log tab is what you DO — enter a
          reading, log a dose — so the analysis and the one-off settings moved
          out: read-only views became tools in this row, and My Targets moved
          to the Tank tab, which is where the tank is described rather than
          logged. Six collapsed headers between you and the form you opened the
          tab for is a tax on the most frequent action in the app. */}
      <TankToolkitCard
        waterType={waterType}
        waterTests={waterTests}
        tankGallons={tankGallons}
        maintenance={maintenance}
        onLogMaintenance={onLogMaintenance}
        feedings={feedings}
        onAddFeeding={onAddFeeding}
        onDeleteFeeding={onDeleteFeeding}
        journal={journal}
        costs={costs}
        onAddCost={onAddCost}
        onDeleteCost={onDeleteCost}
        onExportWaterLog={exportWaterLog}
        onLogWaterChange={onLogWaterChange}
        premiumUnlocked={premiumUnlocked}
        onOpenPremium={onOpenPremium}
        focusTool={intent && intent.tool ? intent : null}
        forecasts={waterTests.length >= 3 ? getParamForecasts(waterTests, waterType, tank) : []}
        tank={activeTank}
        onAddUpkeepTask={onAddUpkeepTask}
        onRemoveUpkeepTask={onRemoveUpkeepTask}
        onSetUpkeepInterval={onSetUpkeepInterval}
        onSetSourceWater={onSetSourceWater}
        onImportTests={onImportTests}
        onSetLightSchedule={onSetLightSchedule}
        onGoToTab={onGoToTab}
        onLogMedDose={onLogMedDose}
        onDeleteMedDose={onDeleteMedDose}
      />
    </AdaptiveColumns>
    </ScrollView>
  );
})
