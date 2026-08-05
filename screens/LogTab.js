import { ScrollView, Share } from "react-native";
import { styles } from "../styles";
import { getSpecies, getStreak, getTodayKey, PARAMS, tapHaptic } from "../core";
import { HeroBanner } from "../components/HeroBanner";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { WaterTestCard } from "../components/WaterTestCard";
import { WaterDeltaCard } from "../components/WaterDeltaCard";
import { TankToolkitCard } from "../components/TankToolkitCard";
import { t } from "../lib/i18n";

export function LogTab({ tank, tankGallons, waterTests, journal, activeDays, costs, feedings = [], maintenance, onLogTest, onAddJournal, onAddCost, onDeleteCost, onAddFeeding, onDeleteFeeding, onLogMaintenance, premiumUnlocked, onOpenPremium }) {
  const waterType = tank.length ? (getSpecies(tank[0])?.water === "salt" ? "salt" : "fresh") : "fresh";
  const streak = getStreak(activeDays);

  // One tap logs a water change: records the maintenance task and drops a dated
  // journal note, closing the loop from "how much?" to "done."
  const logWaterChange = (info) => {
    if (onLogMaintenance) onLogMaintenance("waterchange");
    if (onAddJournal) onAddJournal({ id: Date.now(), date: getTodayKey(), text: `Water change${info && info.pct ? ` (~${info.pct}%, ${info.gallons} gal)` : ""}`, mood: "🛠️", photo: null });
  };

  // Share the water-test history as CSV text — a portable record for a
  // spreadsheet or your fish store.
  const exportWaterLog = () => {
    if (!waterTests.length) return;
    tapHaptic();
    const params = PARAMS[waterType] || PARAMS.fresh;
    const header = ["Date", ...params.map((p) => `${p.label}${p.unit ? ` (${p.unit})` : ""}`)].join(",");
    const rows = waterTests.map((tst) => [tst.date, ...params.map((p) => (tst.values && tst.values[p.key] != null ? tst.values[p.key] : ""))].join(","));
    Share.share({ message: `Pocket Reef water log\n\n${header}\n${rows.join("\n")}` }).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <HeroBanner
        eyebrow={streak ? t("log.eyebrowStreak", { streak }) : t("log.eyebrowIdle")}
        title={t("log.title")}
        subtitle={t("log.sub")}
        emoji="🧪"
        colors={["#0e3a44", "#0b2c3a", "#082031"]}
      />

      <CollapsibleCard storageKey="watertest" title="🧪 Water Test" defaultOpen={true}>
        <WaterTestCard waterType={waterType} history={waterTests} onLog={onLogTest} />
      </CollapsibleCard>

      {waterTests.length >= 2 ? (
        <CollapsibleCard storageKey="waterdelta" title="📊 Since Last Test">
          <WaterDeltaCard waterTests={waterTests} waterType={waterType} />
        </CollapsibleCard>
      ) : null}

      {/* Tank tools folded into one compact card with a button row. */}
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
        onLogWaterChange={logWaterChange}
        premiumUnlocked={premiumUnlocked}
        onOpenPremium={onOpenPremium}
      />
    </ScrollView>
  );
}
