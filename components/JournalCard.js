import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { styles, theme } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getTodayKey, tapHaptic } from "../core";
import { EmptyState } from "./EmptyState";

const MOODS = ["🐠", "🌱", "😍", "🛠️", "⚠️"];

// A dated tank journal with photos — the reef version of Pocket Planter's garden
// journal. Attach a photo, a mood glyph, and a note to build a visual timeline.
export function JournalCard({ entries = [], onAdd, onDelete, onEdit }) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState("🐠");
  const [photo, setPhoto] = useState(null);
  const [visible, setVisible] = useState(5);
  const [editingId, setEditingId] = useState(null);
  const [findText, setFindText] = useState("");
  const [findMood, setFindMood] = useState(null);

  const fq = findText.trim().toLowerCase();
  const shown = entries.filter((e) =>
    (!findMood || e.mood === findMood) &&
    (!fq || (e.text || "").toLowerCase().includes(fq) || (e.date || "").includes(fq))
  );

  const pickPhoto = async () => {
    tapHaptic("light");
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
      if (!res.canceled && res.assets && res.assets[0]) setPhoto(res.assets[0].uri);
    } catch (e) {}
  };

  const startEdit = (e) => {
    tapHaptic("light");
    setEditingId(e.id);
    setText(e.text || "");
    setMood(e.mood || "🐠");
    setPhoto(e.photo || null);
  };
  const cancelEdit = () => { setEditingId(null); setText(""); setMood("🐠"); setPhoto(null); };

  const add = () => {
    const t = text.trim();
    if (!t && !photo) return;
    tapHaptic();
    if (editingId) {
      onEdit && onEdit(editingId, { text: t, mood, photo });
      cancelEdit();
    } else {
      onAdd({ id: Date.now(), date: getTodayKey(), text: t, mood, photo });
      setText("");
      setPhoto(null);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
        {MOODS.map((m) => (
          <Pressable key={m} onPress={() => { tapHaptic("light"); setMood(m); }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: mood === m ? "rgba(56,225,198,0.18)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: mood === m ? theme.accent : theme.border }}>
            <Text style={{ fontSize: 18 }}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What happened in the tank today?"
        placeholderTextColor={theme.secondaryText}
        multiline
        style={{ fontFamily: "Inter_400Regular", backgroundColor: theme.well, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14, minHeight: 60, textAlignVertical: "top" }}
      />
      {photo ? (
        <View style={{ marginTop: 10 }}>
          <Image source={{ uri: photo }} style={{ width: "100%", height: 160, borderRadius: 14 }} resizeMode="cover" />
          <Pressable onPress={() => setPhoto(null)} hitSlop={8} style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, width: 28, height: 28, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="Remove photo">
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Pressable onPress={pickPhoto} style={[styles.ghostBtn, { flex: 0, paddingHorizontal: 16 }]} accessibilityRole="button" accessibilityLabel="Add photo">
          <Ionicons name="camera-outline" size={17} color={theme.accent} />
        </Pressable>
        <Pressable onPress={add} disabled={!text.trim() && !photo} style={[(text.trim() || photo) ? styles.primaryBtn : styles.ghostBtn, { flex: 1 }]} accessibilityRole="button">
          <Text style={(text.trim() || photo) ? styles.primaryBtnText : styles.ghostBtnText}>{editingId ? "Save changes" : "Add to journal"}</Text>
        </Pressable>
        {editingId ? (
          <Pressable onPress={cancelEdit} style={[styles.ghostBtn, { flex: 0, paddingHorizontal: 16 }]} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {entries.length > 3 ? (
        <View style={{ marginTop: 16 }}>
          <TextInput
            value={findText}
            onChangeText={setFindText}
            placeholder="Search entries…"
            placeholderTextColor={theme.secondaryText}
            style={{ fontFamily: "Inter_400Regular", backgroundColor: theme.well, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 14 }}
          />
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {MOODS.map((m) => {
              const on = findMood === m;
              return (
                <Pressable key={m} onPress={() => { tapHaptic("light"); setFindMood(on ? null : m); }} style={{ width: 38, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(56,225,198,0.18)" : "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: on ? theme.accent : theme.border }} accessibilityRole="button">
                  <Text style={{ fontSize: 16, opacity: on ? 1 : 0.6 }}>{m}</Text>
                </Pressable>
              );
            })}
            {(fq || findMood) ? (
              <Pressable onPress={() => { setFindText(""); setFindMood(null); }} style={{ justifyContent: "center", paddingHorizontal: 8 }} accessibilityRole="button">
                <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {entries.length ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          {shown.length === 0 ? (
            <Text style={styles.cardText}>No entries match your search.</Text>
          ) : null}
          {shown.slice(0, visible).map((e) => (
            <View key={e.id} style={{ backgroundColor: theme.well, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{e.mood}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 4 }}>{e.date}</Text>
                  {e.text ? <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 20 }}>{e.text}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {onEdit ? (
                    <Pressable onPress={() => startEdit(e)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit entry">
                      <Text style={{ color: theme.accent, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>✎</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => onDelete(e.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete entry">
                    <Text style={{ color: theme.secondaryText, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" }}>✕</Text>
                  </Pressable>
                </View>
              </View>
              {e.photo ? <Image source={{ uri: e.photo }} style={{ width: "100%", height: 160, borderRadius: 12, marginTop: 10 }} resizeMode="cover" /> : null}
            </View>
          ))}
          {shown.length > visible ? (
            <Pressable onPress={() => { tapHaptic(); setVisible((v) => Math.min(v + 10, shown.length)); }} style={styles.ghostBtn} accessibilityRole="button">
              <Text style={styles.ghostBtnText}>Show more ({shown.length - visible})</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <EmptyState emoji="📓" title="No entries yet" subtitle="Log a milestone, a new arrival, or a problem you spotted — with a photo and a mood." />
      )}
    </View>
  );
}
