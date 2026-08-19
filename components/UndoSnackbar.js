import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../styles";
import { tapHaptic } from "../core";
import { useReduceMotion, MAX_FONT_SCALE, touchSlop } from "../lib/a11y";

// Undo, for the things that used to be gone the moment you tapped.
//
// Removing a fish, clearing a stock list, deleting a journal entry or a cost —
// all of these were silent and final. The defensive fix would be a confirmation
// dialog on each, but a dialog taxes the 99 correct taps to catch the one
// mistake. Undo does the opposite: the action stays instant, and the mistake
// stays recoverable for a few seconds.
//
// It also removes the reason to be careful, which is the actual usability win.
// "Clear stock and start over" is a fine thing to try when trying it is free.
const DURATION = 5000;

export function UndoSnackbar({ undo, onUndo, onDismiss, bottom = 92 }) {
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;
  // The timer is keyed to the undo's id, so a second action mid-countdown
  // restarts the clock instead of inheriting the leftovers of the first.
  const id = undo ? undo.id : null;

  useEffect(() => {
    if (!undo) return;
    if (reduceMotion) {
      slide.setValue(1);
    } else {
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9, tension: 70 }).start();
    }
    const timer = setTimeout(onDismiss, DURATION);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- One timer per snackbar id. Adding onDismiss restarts it on every parent render, so it would never dismiss.
  }, [id]);

  if (!undo) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute", left: 14, right: 14, bottom,
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 24, 0] }) }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0d3145", borderRadius: 16, borderWidth: 1, borderColor: theme.border, paddingLeft: 14, paddingRight: 8, paddingVertical: 11, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 14 }}>
        <Ionicons name={undo.icon || "checkmark-circle"} size={17} color={theme.accent} />
        <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ flex: 1, color: theme.text, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18 }}>{undo.message}</Text>
        {undo.onUndo ? (
          <Pressable
            onPress={() => { tapHaptic("medium"); onUndo(); }}
            hitSlop={touchSlop(34)}
            style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.42)" }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`Undo: ${undo.message}`}
          >
            <Text style={{ color: theme.accent, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Undo</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onDismiss} hitSlop={touchSlop(16)} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={16} color={theme.secondaryText} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
