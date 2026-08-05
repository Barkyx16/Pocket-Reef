import { memo, useEffect, useState } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Splits a leading emoji off a title ("🐠 Your Tank" -> "🐠" + "Your Tank"),
// the same header pattern as Pocket Planter's cards.
function splitEmoji(title = "") {
  const m = title.match(/^(\p{Emoji}️?)\s+(.*)$/u);
  return m ? { emoji: m[1], text: m[2] } : { emoji: null, text: title };
}

export const CollapsibleCard = memo(function CollapsibleCard({ storageKey, title, eyebrow, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const { emoji, text } = splitEmoji(title);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(`pr_collapse_${storageKey}`).then((val) => {
      if (alive && val !== null) setOpen(val === "1");
    }).catch(() => {});
    return () => { alive = false; };
  }, [storageKey]);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    const next = !open;
    setOpen(next);
    AsyncStorage.setItem(`pr_collapse_${storageKey}`, next ? "1" : "0").catch(() => {});
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={toggle} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pressed && { opacity: 0.6 }]}>
        {emoji ? (
          <View style={[styles.iconSquare, open && { backgroundColor: "rgba(56,225,198,0.22)", borderColor: "rgba(56,225,198,0.4)" }]}><Text style={{ fontSize: 16 }}>{emoji}</Text></View>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.cardEyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.cardTitle}>{text}</Text>
        </View>
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: open ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: open ? "rgba(56,225,198,0.3)" : theme.border, marginLeft: 12 }}>
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={theme.accent} />
        </View>
      </Pressable>
      {open ? <View style={{ marginTop: 14 }}>{children}</View> : null}
    </View>
  );
});
