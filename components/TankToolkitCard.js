import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme, space } from "../styles";
import { iconForEmoji } from "../lib/icons";
import { Pill } from "./Pill";
import { CycleTrackerCard } from "./CycleTrackerCard";
import { UpkeepCard } from "./UpkeepCard";
import { FeedingLogCard } from "./FeedingLogCard";
import { WaterInsightsCard } from "./WaterInsightsCard";
import { TrendsCard } from "./TrendsCard";
import { ParamReferenceCard } from "./ParamReferenceCard";
import { TimelineCard } from "./TimelineCard";
import { CostTrackerCard } from "./CostTrackerCard";
import { StabilityCard } from "./StabilityCard";
import { TestScheduleCard } from "./TestScheduleCard";
import { SourceWaterCard } from "./SourceWaterCard";
import { MedDoseCard } from "./MedDoseCard";
import { CsvImportCard } from "./CsvImportCard";
import { LightScheduleCard } from "./LightScheduleCard";
import { RunningCostCard } from "./RunningCostCard";
import { WaterChangeCalc } from "./WaterChangeCalc";
import { ForecastCard } from "./ForecastCard";
import { WaterDeltaCard } from "./WaterDeltaCard";
import { DosingCard } from "./DosingCard";
import { getTodayKey } from "../core";

// One compact card that folds the tank tools behind a button row (the Pocket
// Planter pattern) — cycle, care, feeding, parameter averages, trends, target
// ranges, water-change calculator, timeline, and costs — so the Log tab stays
// short. The chosen tool persists, and its content renders below the buttons.
export function TankToolkitCard({
  waterType, waterTests = [], tankGallons, maintenance, onLogMaintenance,
  feedings, onAddFeeding, onDeleteFeeding, journal, costs, onAddCost, onDeleteCost,
  onExportWaterLog, onLogWaterChange, premiumUnlocked, onOpenPremium, focusTool,
  tank = {}, onAddUpkeepTask, onRemoveUpkeepTask, onSetUpkeepInterval, forecasts = [], onSetSourceWater, onImportTests, onSetLightSchedule, onGoToTab, onLogMedDose, onDeleteMedDose,
}) {
  const TOOLS = [
    { id: "cycle", emoji: "🔄", label: "Cycle", render: () => <CycleTrackerCard waterTests={waterTests} /> },
    { id: "care", emoji: "🧰", label: "Upkeep", render: () => <UpkeepCard tank={tank} onLog={onLogMaintenance} onAddTask={onAddUpkeepTask} onRemoveTask={onRemoveUpkeepTask} onSetInterval={onSetUpkeepInterval} /> },
    { id: "feeding", emoji: "🍤", label: "Feeding", render: () => <FeedingLogCard feedings={feedings} onAdd={onAddFeeding} onDelete={onDeleteFeeding} /> },
    { id: "change", emoji: "💧", label: "Change", render: () => <WaterChangeCalc tankGallons={tankGallons} waterTests={waterTests} onLogChange={onLogWaterChange} waterChanges={tank.waterChanges || []} tank={tank} waterType={waterType} /> },
    { id: "averages", emoji: "📊", label: "Averages", render: () => <WaterInsightsCard waterTests={waterTests} waterType={waterType} onExport={onExportWaterLog} /> },
    // Read-only analysis. These were top-level cards on the Log tab, which meant
    // scrolling past six collapsed headers to reach the one form you came to
    // use. As tools they're one tap and you see one at a time.
    { id: "forecast", emoji: "🔮", label: "Forecast", render: () => <ForecastCard forecasts={forecasts} /> },
    { id: "delta", emoji: "📊", label: "Since last", render: () => <WaterDeltaCard waterTests={waterTests} waterType={waterType} /> },
    { id: "correct", emoji: "⚗️", label: "Correct", render: () => <DosingCard latestValues={(waterTests[0] || {}).values || {}} tankGallons={tankGallons} /> },
    { id: "stability", emoji: "⚖️", label: "Stability", render: () => <StabilityCard tank={tank} waterType={waterType} /> },
    { id: "cadence", emoji: "🗓️", label: "How often", render: () => <TestScheduleCard waterTests={waterTests} waterType={waterType} /> },
    { id: "light", emoji: "💡", label: "Lights", render: () => <LightScheduleCard tank={tank} onSave={onSetLightSchedule} /> },
    { id: "power", emoji: "⚡", label: "Running cost", render: () => <RunningCostCard tank={tank} costs={costs} onGoToTab={onGoToTab} /> },
    { id: "source", emoji: "🚰", label: "Source water", render: () => <SourceWaterCard tank={tank} waterType={waterType} onSave={onSetSourceWater} /> },
    { id: "meds", emoji: "💊", label: "Medicate", render: () => <MedDoseCard tank={tank} tankGallons={tankGallons} onLogMedDose={onLogMedDose} onDeleteMedDose={onDeleteMedDose} /> },
    { id: "import", emoji: "📥", label: "Import", render: () => <CsvImportCard waterType={waterType} existing={waterTests} onImport={onImportTests} /> },
    { id: "trends", emoji: "📈", label: "Trends", render: () => <TrendsCard waterTests={waterTests} waterType={waterType} premiumUnlocked={premiumUnlocked} onOpenPremium={onOpenPremium} /> },
    { id: "ranges", emoji: "📋", label: "Ranges", render: () => <ParamReferenceCard waterType={waterType} /> },
    { id: "timeline", emoji: "🕒", label: "Timeline", render: () => <TimelineCard journal={journal} waterTests={waterTests} /> },
    { id: "costs", emoji: "💰", label: "Costs", render: () => <CostTrackerCard costs={costs} tank={tank} onAdd={onAddCost} onDelete={onDeleteCost} /> },
  ];

  const [sel, setSel] = useState("cycle");
  // How often each tool has been opened. Nine identical pills in a fixed order
  // means the two you actually use are wherever the list happens to put them —
  // Feeding sits third and Costs sits ninth for everyone, regardless of whether
  // you log feedings daily and costs twice a year.
  const [uses, setUses] = useState({});

  useEffect(() => {
    let alive = true;
    AsyncStorage.multiGet(["pr_toolkit_tab", "pr_toolkit_uses"]).then((pairs) => {
      if (!alive) return;
      const map = Object.fromEntries(pairs);
      const last = map.pr_toolkit_tab;
      if (last && TOOLS.some((t) => t.id === last)) setSel(last);
      try {
        const parsed = JSON.parse(map.pr_toolkit_uses || "{}");
        if (parsed && typeof parsed === "object") setUses(parsed);
      } catch (e) { /* a corrupt counter just means no personalisation */ }
    }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TOOLS is a module constant.
  }, []);

  const pick = (id) => {
    setSel(id);
    AsyncStorage.setItem("pr_toolkit_tab", id).catch(() => {});
    setUses((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) + 1 };
      AsyncStorage.setItem("pr_toolkit_uses", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // Order is computed ONCE per mount and then frozen. Re-sorting live would
  // move a pill out from under the finger that just tapped it, and make the
  // row rearrange itself while you read it — the classic way an adaptive menu
  // becomes worse than a fixed one.
  const frozenUses = useRef(null);
  const ordered = useMemo(() => {
    if (frozenUses.current === null && Object.keys(uses).length) frozenUses.current = uses;
    const counts = frozenUses.current || uses;
    const rank = (t) => counts[t.id] || 0;
    // Stable: ties keep the hand-authored order, which is grouped by workflow.
    return TOOLS.map((t, i) => ({ t, i })).sort((a, b) => rank(b.t) - rank(a.t) || a.i - b.i).map((x) => x.t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TOOLS is a module constant.
  }, [uses]);

  // A shortcut ("Log a feeding", "See water trends") names the tool it wants.
  // Selecting it here is the difference between landing on the Log tab and
  // landing on the thing you asked for. focusTool carries a `{ tool, nonce }`
  // so re-running the same shortcut re-selects the tool after you've browsed
  // away from it.
  useEffect(() => {
    if (focusTool && focusTool.tool && TOOLS.some((t) => t.id === focusTool.tool)) pick(focusTool.tool);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TOOLS is a module constant.
  }, [focusTool]);

  const active = TOOLS.find((t) => t.id === sel) || TOOLS[0];

  // Small counts that make a pill worth reading before tapping it. Only shown
  // where the number means something right now — a "0" badge is noise.
  const today = getTodayKey();
  const fedToday = (feedings || []).filter((f) => f.date === today).length;
  const badges = {
    feeding: fedToday || null,
    costs: (costs || []).length || null,
    trends: (waterTests || []).length || null,
  };

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: space.md }]}>Tank Tools</Text>
      {/* Pills carry a number where one exists, so the row says something about
          your tank instead of being nine identical words. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.xs }}>
        {ordered.map((tool) => (
          <Pill
            key={tool.id}
            icon={iconForEmoji(tool.emoji)}
            label={badges[tool.id] ? `${tool.label} · ${badges[tool.id]}` : tool.label}
            active={sel === tool.id}
            onPress={() => pick(tool.id)}
          />
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.hairline, marginTop: space.md, paddingTop: space.lg }}>
        {active.render()}
      </View>
    </View>
  );
}
