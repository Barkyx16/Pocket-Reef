import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { iconForEmoji } from "../lib/icons";
import { Pill } from "./Pill";
import { CycleTrackerCard } from "./CycleTrackerCard";
import { MaintenanceCard } from "./MaintenanceCard";
import { FeedingLogCard } from "./FeedingLogCard";
import { WaterInsightsCard } from "./WaterInsightsCard";
import { TrendsCard } from "./TrendsCard";
import { ParamReferenceCard } from "./ParamReferenceCard";
import { TimelineCard } from "./TimelineCard";
import { CostTrackerCard } from "./CostTrackerCard";
import { WaterChangeCalc } from "./WaterChangeCalc";

// One compact card that folds the tank tools behind a button row (the Pocket
// Planter pattern) — cycle, care, feeding, parameter averages, trends, target
// ranges, water-change calculator, timeline, and costs — so the Log tab stays
// short. The chosen tool persists, and its content renders below the buttons.
export function TankToolkitCard({
  waterType, waterTests = [], tankGallons, maintenance, onLogMaintenance,
  feedings, onAddFeeding, onDeleteFeeding, journal, costs, onAddCost, onDeleteCost,
  onExportWaterLog, onLogWaterChange, premiumUnlocked, onOpenPremium,
}) {
  const TOOLS = [
    { id: "cycle", emoji: "🔄", label: "Cycle", render: () => <CycleTrackerCard waterTests={waterTests} /> },
    { id: "care", emoji: "🧰", label: "Care", render: () => <MaintenanceCard maintenance={maintenance} onLog={onLogMaintenance} /> },
    { id: "feeding", emoji: "🍤", label: "Feeding", render: () => <FeedingLogCard feedings={feedings} onAdd={onAddFeeding} onDelete={onDeleteFeeding} /> },
    { id: "change", emoji: "💧", label: "Change", render: () => <WaterChangeCalc tankGallons={tankGallons} waterTests={waterTests} onLogChange={onLogWaterChange} /> },
    { id: "averages", emoji: "📊", label: "Averages", render: () => <WaterInsightsCard waterTests={waterTests} waterType={waterType} onExport={onExportWaterLog} /> },
    { id: "trends", emoji: "📈", label: "Trends", render: () => <TrendsCard waterTests={waterTests} waterType={waterType} premiumUnlocked={premiumUnlocked} onOpenPremium={onOpenPremium} /> },
    { id: "ranges", emoji: "📋", label: "Ranges", render: () => <ParamReferenceCard waterType={waterType} /> },
    { id: "timeline", emoji: "🕒", label: "Timeline", render: () => <TimelineCard journal={journal} waterTests={waterTests} /> },
    { id: "costs", emoji: "💰", label: "Costs", render: () => <CostTrackerCard costs={costs} onAdd={onAddCost} onDelete={onDeleteCost} /> },
  ];

  const [sel, setSel] = useState("cycle");
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem("pr_toolkit_tab").then((v) => { if (alive && v && TOOLS.some((t) => t.id === v)) setSel(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const pick = (id) => { setSel(id); AsyncStorage.setItem("pr_toolkit_tab", id).catch(() => {}); };

  const active = TOOLS.find((t) => t.id === sel) || TOOLS[0];

  return (
    <View style={styles.card}>
      <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Tank Tools</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
        {TOOLS.map((tool) => (
          <Pill key={tool.id} icon={iconForEmoji(tool.emoji)} label={tool.label} active={sel === tool.id} onPress={() => pick(tool.id)} />
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.hairline, marginTop: 12, paddingTop: 16 }}>
        {active.render()}
      </View>
    </View>
  );
}
