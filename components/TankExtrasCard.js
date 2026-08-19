import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { iconForEmoji } from "../lib/icons";
import { getRecommended } from "../core";
import { formatVolume } from "../lib/units";
import { Pill } from "./Pill";
import { SpeciesCard } from "./SpeciesCard";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { FeedingGuideCard } from "./FeedingGuideCard";

// The bottom-of-the-Tank-tab companion to Tank Tools — folds the "planning &
// sharing" cards behind a button row: recommended species, the compatibility
// matrix, the feeding guide, and share. (Tank setups live in the hub button.)
export function TankExtrasCard({ tank = [], tankGallons, tankWater, quantities = {}, openSpecies, toggleTank, onShare }) {
  const recommended = getRecommended(tankGallons, tank, 5, tankWater);

  const recommendedTool = () => recommended.length ? (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 6 }]}>{tank.length ? "Fits your tank and gets along with your stock:" : "Great beginner picks that fit your tank:"}</Text>
      {recommended.map((s) => {
        const bits = [];
        if (s.temperament === "peaceful") bits.push("Peaceful");
        if (s.careLevel === "Easy") bits.push("easy care");
        if (s.reefSafe === true) bits.push("reef-safe");
        bits.push(tank.length ? "gets along with your tank" : `great for ${formatVolume(tankGallons)}`);
        return (
          <SpeciesCard key={s.name} species={s} onPress={() => openSpecies(s.name)} inTank={false} onToggleTank={toggleTank ? () => toggleTank(s.name) : undefined} note={`✨ ${bits.slice(0, 2).join(" · ")}`} />
        );
      })}
    </View>
  ) : <Text style={styles.cardText}>No compatible picks right now — try a smaller or more peaceful species.</Text>;

  const shareTool = () => (
    <View>
      <Text style={styles.cardText}>Share a snapshot of your tank — size, species, health score, and latest water reading — with anyone.</Text>
      {tank.length ? (
        <Pressable onPress={onShare} style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>📤 Share my tank</Text>
        </Pressable>
      ) : <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>Stock your tank first, then you can share it.</Text>}
    </View>
  );

  const TOOLS = [
    { id: "recommended", emoji: "✨", label: "Recommended", render: recommendedTool },
    { id: "matrix", emoji: "🤝", label: "Matrix", render: () => <CompatibilityMatrix tank={tank} /> },
    { id: "feeding", emoji: "🍤", label: "Feeding", render: () => <FeedingGuideCard tank={tank} /> },
    { id: "share", emoji: "📤", label: "Share", render: shareTool },
  ];

  const [sel, setSel] = useState("recommended");
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem("pr_tankextras_tab").then((v) => { if (alive && v && TOOLS.some((tt) => tt.id === v)) setSel(v); }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TOOLS is a module constant.
  }, []);
  const pick = (id) => { setSel(id); AsyncStorage.setItem("pr_tankextras_tab", id).catch(() => {}); };

  const active = TOOLS.find((tt) => tt.id === sel) || TOOLS[0];

  return (
    <View style={styles.card}>
      <Text style={[styles.cardEyebrow, { marginBottom: 12 }]}>Explore & More</Text>
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
