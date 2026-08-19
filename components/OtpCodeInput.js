import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { theme, radius, type } from "../styles";

// Six boxes for the code from the verification email.
//
// Under the boxes there is exactly one real TextInput, stretched across the row
// and made invisible. Six separate inputs would fight iOS: the OS autofills a
// one-time code into a single field, and pasting a code only targets one field
// too. So the boxes are pure presentation and everything types into the hidden
// field — autofill, paste, and the backspace key all behave the way the OS
// expects, and the caret is drawn by us as a blinking underline.

const CELLS = 6;

export function OtpCodeInput({ value, onChange, onComplete, editable = true, autoFocus = true }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const digits = String(value || "").slice(0, CELLS).split("");

  // Autofocus after the screen settles — focusing during the mount animation
  // gets swallowed on Android and pops the keyboard mid-transition on iOS.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const handleChange = (raw) => {
    // Strip anything that isn't a digit: autofill sometimes hands over the whole
    // "Your code is 123456" string, and pasted codes carry spaces or dashes.
    const clean = String(raw).replace(/[^0-9]/g, "").slice(0, CELLS);
    onChange(clean);
    if (clean.length === CELLS) onComplete && onComplete(clean);
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={{ marginTop: 4 }}
      accessibilityRole="none"
      // The boxes are decoration; the hidden field below carries the real label.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        {Array.from({ length: CELLS }).map((_, i) => {
          const char = digits[i];
          const isCaret = focused && i === digits.length;
          const filled = Boolean(char);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.82,
                maxHeight: 60,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isCaret ? theme.accent : filled ? "rgba(56,225,198,0.42)" : theme.border,
                backgroundColor: filled ? "rgba(56,225,198,0.10)" : "rgba(255,255,255,0.07)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {char ? (
                <Text style={{ color: theme.text, fontSize: type.headline, letterSpacing: -0.4, fontFamily: "Inter_900Black", fontWeight: "900" }}>{char}</Text>
              ) : isCaret ? (
                <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: theme.accent }} />
              ) : null}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={String(value || "")}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        // iOS reads the code straight out of the notification; Android uses the
        // SMS/eMail retriever hint behind autoComplete.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        autoCorrect={false}
        maxLength={CELLS}
        caretHidden
        accessibilityLabel="Six digit verification code"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          opacity: 0,
          // Kept on-screen and full-size rather than offset off-canvas: iOS will
          // not autofill a field it considers invisible or out of bounds.
          color: "transparent",
          fontSize: 1,
        }}
      />
    </Pressable>
  );
}
