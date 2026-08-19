import { useMemo, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import * as ImagePicker from "expo-image-picker";
import { persistPhoto } from "../lib/photoStore";
import { KINDS, kindOf, newObservation, observationsFor, growth, photoTimeline } from "../lib/observations";
import { Pill } from "./Pill";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";

// What this animal has been doing, and whether it has actually grown.
//
// Lives on the species detail screen because that is where somebody is already
// looking at the animal. A tank-wide log would put a coral's growth next to a
// filter clean, which is how the journal already loses it.
export function ObservationsCard({ tank = {}, name, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("note");
  const [text, setText] = useState("");
  const [size, setSize] = useState("");
  const [photo, setPhoto] = useState(null);

  const list = observationsFor(tank, name);
  const g = useMemo(() => growth(list), [list]);
  const shots = useMemo(() => photoTimeline(list), [list]);

  // The picker returns a cache URI the OS is free to delete; copy it somewhere
  // permanent before it reaches a record meant to last years.
  const pickPhoto = async () => {
    tapHaptic("light");
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
      if (!res.canceled && res.assets && res.assets[0]) setPhoto(await persistPhoto(res.assets[0].uri));
    } catch (e) { /* a failed pick just means no photo on this entry */ }
  };

  const submit = () => {
    const o = newObservation({ kind, text, size, photo });
    if (!o) return;
    tapHaptic("medium");
    onAdd && onAdd(name, o);
    setText(""); setSize(""); setPhoto(null); setOpen(false);
  };

  const ready = text.trim().length > 0 || Number(size) > 0 || Boolean(photo);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Observations{list.length ? ` (${list.length})` : ""}
        </Text>
        <Pressable onPress={() => { tapHaptic("light"); setOpen((v) => !v); }} hitSlop={touchSlop(24)} accessibilityRole="button" accessibilityLabel={open ? "Cancel" : `Add an observation for ${name}`}>
          <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{open ? "Cancel" : "+ Add"}</Text>
        </Pressable>
      </View>

      {/* Growth is the payoff: a number rather than a feeling. */}
      {g.ok ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, backgroundColor: "rgba(56,225,198,0.10)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(56,225,198,0.32)", padding: 11 }}>
          <Ionicons name={g.direction === "shrank" ? "trending-down" : "trending-up"} size={15} color={g.direction === "shrank" ? theme.warn : theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{g.summary}</Text>
            <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>
              {g.first.size} → {g.last.size} {g.unit} across {g.points} measurements
            </Text>
          </View>
        </View>
      ) : null}

      {/* Then and now. For a coral this is far more legible than any number,
          and the app has stored photos for years without ever being able to
          line the same subject up over time. */}
      {shots.comparable ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[shots.first, shots.last].map((shot, i) => (
              <View key={shot.id} style={{ flex: 1 }}>
                <Image source={{ uri: shot.photo }} style={{ width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: theme.well }} resizeMode="cover" accessibilityLabel={`${name} on ${shot.date}`} />
                <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4 }}>
                  {i === 0 ? "Then" : "Now"} · {shot.date}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: theme.bodyText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 6 }}>
            {shots.days} days apart{shots.shots.length > 2 ? ` · ${shots.shots.length} photos` : ""}
          </Text>
        </View>
      ) : null}

      {open ? (
        <View style={{ marginTop: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, padding: 11 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {KINDS.map((k) => (
              <Pill key={k.id} label={k.label} active={kind === k.id} onPress={() => { tapHaptic("light"); setKind(k.id); }} />
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What did you see?"
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="What you observed"
            multiline
            style={[styles.authInput, { marginTop: 10, minHeight: 56, textAlignVertical: "top", fontFamily: "Inter_400Regular" }]}
          
            maxLength={TEXT_LIMITS.note}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <TextInput
              value={size}
              onChangeText={(t) => setSize(decimalText(t))}
              keyboardType="decimal-pad"
              placeholder="Size"
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Measured size in inches"
              style={[styles.authInput, { width: 88 }]}
            
            maxLength={TEXT_LIMITS.number}
          />
            <Text style={{ flex: 1, color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16 }}>
              inches — optional, but it's the only thing growth can be measured from.
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Pressable onPress={pickPhoto} style={[styles.ghostBtn, { flex: 1, paddingVertical: 10 }]} accessibilityRole="button" accessibilityLabel="Add a photo to this observation">
              <Text style={styles.ghostBtnText}>{photo ? "Change photo" : "+ Photo"}</Text>
            </Pressable>
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: 40, height: 40, borderRadius: radius.xs }} accessibilityLabel="Selected photo" />
            ) : null}
          </View>

          <Pressable onPress={submit} disabled={!ready} style={[ready ? styles.primaryBtn : styles.ghostBtn, { marginTop: 10 }]} accessibilityRole="button">
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={ready ? styles.primaryBtnText : styles.ghostBtnText}>Record it</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length ? (
        <View style={{ gap: 7, marginTop: 10 }}>
          {list.slice(0, 8).map((o) => (
            <View key={o.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name={kindOf(o.kind).icon} size={13} color={theme.secondaryText} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>
                  {o.text}{o.size ? `${o.text ? " · " : ""}${o.size} ${o.unit}` : ""}
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 1 }}>{o.date}</Text>
              </View>
              {onRemove ? (
                <Pressable onPress={() => onRemove(name, o.id)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Delete the observation from ${o.date}`}>
                  <Ionicons name="close" size={13} color={theme.secondaryText} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : !open ? (
        <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 17, marginTop: 8 }}>
          Nothing recorded yet. Spawning, colour, a size to measure growth from — the things that get lost in the journal.
        </Text>
      ) : null}
    </View>
  );
}
