import { memo, useEffect, useRef, useState } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { styles, theme } from "../styles";
import { iconForEmoji } from "../lib/icons";
import { useReduceMotion, touchSlop } from "../lib/a11y";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Splits a leading emoji off a title ("🐠 Your Tank" -> "🐠" + "Your Tank"),
// the same header pattern as Pocket Planter's cards.
function splitEmoji(title = "") {
  const m = title.match(/^(\p{Emoji}️?)\s+(.*)$/u);
  return m ? { emoji: m[1], text: m[2] } : { emoji: null, text: title };
}

export const CollapsibleCard = memo(function CollapsibleCard({ storageKey, title, eyebrow, defaultOpen = false, forceOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReduceMotion();
  // True once a shortcut has forced this card open. The stored-state read below
  // is async, so without this the two race: forceOpen sets open and writes "1",
  // then the read — which started before that write — resolves with the old
  // "0" and closes the card again. The shortcut appeared to do nothing, and the
  // stored flag said open while the card was visibly shut.
  const forced = useRef(false);
  const { emoji, text } = splitEmoji(title);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(`pr_collapse_${storageKey}`).then((val) => {
      // A shortcut that arrived while this was in flight wins — its intent is
      // newer than whatever was on disk when the read started.
      if (alive && val !== null && !forced.current) setOpen(val === "1");
    }).catch(() => {});
    return () => { alive = false; };
  }, [storageKey]);

  // A shortcut that opens this card wins over the stored collapsed state —
  // arriving from "Log a water test" and finding the water-test card folded
  // shut is the shortcut failing at the last step. forceOpen carries a nonce,
  // not a boolean, so tapping the same shortcut twice re-opens the card even
  // if the user collapsed it in between.
  useEffect(() => {
    if (forceOpen) {
      forced.current = true;
      if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
      setOpen(true);
      AsyncStorage.setItem(`pr_collapse_${storageKey}`, "1").catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Fires only when the parent forces the card open. storageKey is fixed per card.
  }, [forceOpen]);

  function toggle() {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    const next = !open;
    setOpen(next);
    AsyncStorage.setItem(`pr_collapse_${storageKey}`, next ? "1" : "0").catch(() => {});
  }

  return (
    <View style={styles.card}>
      <Pressable
        onPress={toggle}
        hitSlop={touchSlop(38)}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? "Collapses this section" : "Expands this section"}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pressed && { opacity: 0.6 }]}
      >
        {emoji ? (
          <View style={[styles.iconSquare, open && { backgroundColor: "rgba(56,225,198,0.18)", borderColor: "rgba(56,225,198,0.42)" }]}>
            {iconForEmoji(emoji) ? (
              <Ionicons name={iconForEmoji(emoji)} size={17} color={theme.accent} />
            ) : (
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
            )}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {/* Deliberately NOT accessibilityRole="header". The Pressable above
              carries a role and a label, which makes the whole row a single
              accessible element — VoiceOver never reaches these Texts, so a
              role here does nothing except imply it does. A disclosure row is
              a button, and the Buttons rotor is how it gets found. */}
          {eyebrow ? <Text style={styles.cardEyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.cardTitle}>{text}</Text>
        </View>
        <View style={{ width: 30, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: open ? "rgba(56,225,198,0.14)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: open ? "rgba(56,225,198,0.30)" : theme.border, marginLeft: 12 }}>
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={16} color={theme.accent} />
        </View>
      </Pressable>
      {open ? <View style={{ marginTop: 14 }}>{children}</View> : null}
    </View>
  );
});
