import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { iconForEmoji } from "../lib/icons";
import { getSpecies, getBioload, getStockingRoom, getTankParamWindow } from "../core";
import { formatVolume, formatTempRange } from "../lib/units";
import { Pill } from "./Pill";
import { ProgressBar } from "./ProgressBar";
import { GearGuideCard } from "./GearGuideCard";
import { AcclimationCard } from "./AcclimationCard";
import { AcclimationTimer } from "./AcclimationTimer";
import { QuarantineCard } from "./QuarantineCard";

// Tank tools folded behind a button row (the Pocket Planter pattern, like the
// Log tab's Tank Tools): stocking level, room to stock, the ideal parameter
// window, gear guide, adding a new fish, and the quarantine tracker.
export function TankToolboxCard({
  tankGallons, tank = [], tankWater, quantities = {},
  quarantine, onAddQuarantine, onRemoveQuarantine, onGraduateQuarantine,
}) {
  const bio = getBioload(tankGallons, tank, quantities);
  const room = getStockingRoom(tankGallons, tank, quantities);
  const paramWindow = getTankParamWindow(tank);
  const species = tank.map(getSpecies).filter(Boolean);
  const qty = (name) => quantities[name] || 1;
  const countKind = (kind) => species.filter((s) => s.kind === kind).reduce((n, s) => n + qty(s.name), 0);
  const fishN = countKind("fish");
  const invertN = countKind("invert");
  const coralN = countKind("coral");
  const empty = tank.length === 0;

  const emptyHint = (msg) => <Text style={styles.cardText}>{msg}</Text>;

  const stocking = () => empty ? emptyHint("Stock your tank to see its bioload and stocking level.") : (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
        <Text style={styles.cardEyebrow}>Stocking level</Text>
        <Text style={{ color: bio.color, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>{bio.level} · {bio.pct}%</Text>
      </View>
      <ProgressBar pct={bio.pct} color={bio.color} height={12} />
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>
        ~{bio.inches}" of adult fish for {formatVolume(tankGallons)} (guideline: ~1" per gallon). {bio.pct > 100 ? "Consider a bigger tank or fewer fish — and test water often." : "Room to grow — add slowly and watch your parameters."}
      </Text>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        <Text style={{ color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>🐟 {fishN} fish</Text>
        {invertN ? <Text style={{ color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>🦐 {invertN} inverts</Text> : null}
        {coralN ? <Text style={{ color: theme.text, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>🪸 {coralN} corals</Text> : null}
      </View>
    </>
  );

  const roomTool = () => (empty || !room) ? emptyHint("Stock your tank to see how much room you have left.") : (
    room.full ? (
      <Text style={styles.cardText}>You're at capacity ({room.pct}%) — adding more will strain water quality. Consider a bigger tank before more fish.</Text>
    ) : (
      <>
        <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>~{room.roomInches}" of room left</Text>
        <Text style={{ color: theme.bodyText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 6, lineHeight: 18 }}>
          Roughly {room.small} more nano fish (~2") {room.medium ? `or ${room.medium} community fish (~4")` : ""} — add slowly and keep testing. Check ✨ Recommended on Home for compatible picks.
        </Text>
      </>
    )
  );

  const window = () => !paramWindow ? emptyHint("Stock at least one species to see the ideal temperature and pH window.") : (
    paramWindow.ok ? (
      <>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>TEMPERATURE</Text>
            <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 2 }}>{formatTempRange(paramWindow.tempLo, paramWindow.tempHi)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>pH</Text>
            <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 2 }}>{paramWindow.phLo}–{paramWindow.phHi}</Text>
          </View>
        </View>
        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 10 }}>
          The overlap that keeps every species in your tank comfortable — aim your heater and buffering here.
        </Text>
      </>
    ) : (
      <Text style={{ color: theme.danger, fontSize: 13, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 20 }}>
        Your species don't share a common {(!paramWindow.tempOk && !paramWindow.phOk) ? "temperature or pH" : !paramWindow.tempOk ? "temperature" : "pH"} range — some will always be stressed. Check the compatibility notes and consider rehoming a mismatch.
      </Text>
    )
  );

  const TOOLS = [
    { id: "stocking", emoji: "📊", label: "Stocking", render: stocking },
    { id: "room", emoji: "🧮", label: "Room", render: roomTool },
    { id: "window", emoji: "🌡️", label: "Window", render: window },
    { id: "gear", emoji: "🛠️", label: "Gear", render: () => <GearGuideCard tankGallons={tankGallons} tank={tank} tankWater={tankWater} /> },
    { id: "newfish", emoji: "🆕", label: "New Fish", render: () => (
      // The reference steps stay — the timer is for when you're actually doing
      // it, one hand on the bag.
      <View>
        <AcclimationTimer />
        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 18 }} />
        <AcclimationCard />
      </View>
    ) },
    { id: "quarantine", emoji: "⏳", label: "Quarantine", render: () => <QuarantineCard items={quarantine} onAdd={onAddQuarantine} onRemove={onRemoveQuarantine} onGraduate={onGraduateQuarantine} /> },
  ];

  const [sel, setSel] = useState("stocking");
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem("pr_tanktools_tab").then((v) => { if (alive && v && TOOLS.some((tt) => tt.id === v)) setSel(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const pick = (id) => { setSel(id); AsyncStorage.setItem("pr_tanktools_tab", id).catch(() => {}); };

  const active = TOOLS.find((tt) => tt.id === sel) || TOOLS[0];

  return (
    <View style={styles.card}>
      <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Tank Tools</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
