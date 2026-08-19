import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { Pill } from "./Pill";
import { formatVolume } from "../lib/units";
import { TEXT_LIMITS } from "../lib/textLimits";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

// Create or edit a tank profile — name, water type, emoji, and size. Declaring
// the water type up front lets the app tailor gear, recommendations, and cycle
// targets even before the tank is stocked.
const EMOJIS = ["🐠", "🐟", "🌊", "🪸", "🦐", "🐡", "🌱", "🦈"];
// Spoken names, so the icon row is choosable without sight. The Unicode names
// are close but not usable — "🪸" reads as "coral" only on newer systems and as
// nothing at all on older ones.
const EMOJI_LABELS = { "🐠": "tropical fish", "🐟": "fish", "🌊": "wave", "🪸": "coral", "🦐": "shrimp", "🐡": "pufferfish", "🌱": "plant", "🦈": "shark" };
const WATERS = [{ id: "fresh", label: "💧 Freshwater" }, { id: "salt", label: "🌊 Saltwater" }];
const PRESETS = [5, 10, 20, 30, 55, 75, 125];

export function NewTankSheet({ mode = "new", initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [water, setWater] = useState(initial?.water || "fresh");
  const [emoji, setEmoji] = useState(initial?.emoji || "🐠");
  const [gallons, setGallons] = useState(initial?.gallons || 20);
  const [notes, setNotes] = useState(initial?.notes || "");

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={styles.backText}>‹ Close</Text>
      </Pressable>

      <View style={styles.detailHeroWrap}>
        <Text style={{ fontSize: 60, letterSpacing: -1 }}>{emoji}</Text>
        <Text style={styles.detailName}>{mode === "edit" ? "Edit Tank" : "New Tank"}</Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardEyebrow}>Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Living Room Reef" placeholderTextColor={theme.secondaryText}
          style={{ fontFamily: "Inter_400Regular", backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.bodyLg, marginTop: 8 }} 
            maxLength={TEXT_LIMITS.name}
          />

        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 18 }]}>Water type</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {WATERS.map((w) => <Pill key={w.id} fill label={w.label} active={water === w.id} onPress={() => setWater(w.id)} />)}
        </View>

        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 18 }]}>Icon</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {EMOJIS.map((e) => {
            const on = emoji === e;
            return (
              <Pressable key={e} onPress={() => { tapHaptic("light"); setEmoji(e); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Tank icon ${EMOJI_LABELS[e] || e}`} style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(56,225,198,0.18)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: on ? theme.accent : theme.border }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: type.titleLg, letterSpacing: -0.2 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 18 }]}>Tank size</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {PRESETS.map((g) => <Pill key={g} label={formatVolume(g)} active={gallons === g} onPress={() => setGallons(g)} />)}
        </View>

        <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginTop: 18 }]}>Notes <Text style={{ color: theme.secondaryText, fontFamily: "Inter_700Bold", fontWeight: "700" }}>(optional)</Text></Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Equipment, dosing, livestock plans…" placeholderTextColor={theme.secondaryText} multiline
          style={{ fontFamily: "Inter_400Regular", backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.bodyLg, marginTop: 8, minHeight: 70, textAlignVertical: "top" }} 
            maxLength={TEXT_LIMITS.note}
          />

        <Pressable onPress={() => { tapHaptic("medium"); onSave({ name, water, emoji, gallons, notes: notes.trim() }); }} style={[styles.primaryBtn, { marginTop: 20 }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{mode === "edit" ? "Save changes" : "Create tank"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
