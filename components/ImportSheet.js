import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import { tapHaptic } from "../core";

// Restore from a Pocket Reef export — paste the JSON you shared from another
// device (or a saved backup) to bring all your tanks and progress back.
export function ImportSheet({ onImport, onClose }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState(false);

  const restore = () => {
    tapHaptic();
    const ok = onImport(raw.trim());
    if (!ok) setError(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={styles.backText}>‹ Close</Text>
      </Pressable>

      <View style={styles.detailHeroWrap}>
        <Text style={{ fontSize: 60 }}>📥</Text>
        <Text style={styles.detailName}>Restore Backup</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardText}>Paste the data you exported from Pocket Reef. This replaces your current tanks and progress.</Text>
        <TextInput
          value={raw}
          onChangeText={(t) => { setRaw(t); setError(false); }}
          placeholder="Paste exported JSON here…"
          placeholderTextColor={theme.secondaryText}
          multiline
          style={{ backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: error ? theme.danger : theme.border, fontSize: 12, minHeight: 140, textAlignVertical: "top", marginTop: 12 }}
        />
        {error ? <Text style={{ color: theme.danger, fontSize: 12, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 8 }}>That doesn't look like a valid Pocket Reef backup. Check you copied the whole thing.</Text> : null}
        <Pressable onPress={restore} disabled={!raw.trim()} style={[raw.trim() ? styles.primaryBtn : styles.ghostBtn, { marginTop: 14 }]} accessibilityRole="button">
          <Text style={raw.trim() ? styles.primaryBtnText : styles.ghostBtnText}>Restore</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
