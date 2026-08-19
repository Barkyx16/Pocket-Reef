import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { LOSS_REASONS, LOSS_CAUSES, isMortality, tenureLabel, newStockRecord } from "../lib/livestock";
import { SpeciesThumb } from "./SpeciesThumb";
import { touchSlop } from "../lib/a11y";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The record for one animal: what a keeper would otherwise write on a tag and
// then lose. Two jobs in one sheet, because they're the same conversation —
// documenting an animal, and documenting what happened to it.
//
// Everything is optional. A keeper who just wants the fish in the list must
// never be made to fill in a form, so the sheet opens on what's already known
// and every field can stay blank.
export function StockRecordSheet({ visible, name, record, quantity = 1, onClose, onSave, onRecordLoss }) {
  // A sheet sits on the bottom edge, where the home indicator lives. The
  // designed gap is kept on devices without one.
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("edit"); // "edit" | "loss"
  const [draft, setDraft] = useState(null);
  const [loss, setLoss] = useState({ reason: "died", cause: "Unknown", count: 1, notes: "" });

  // Seeded on open rather than in state init, so reopening on a different
  // animal doesn't show the previous one's record.
  const current = draft || { ...newStockRecord(), ...(record || {}) };
  const set = (patch) => setDraft({ ...current, ...patch });

  const close = () => { setDraft(null); setMode("edit"); setLoss({ reason: "died", cause: "Unknown", count: 1, notes: "" }); onClose(); };
  const save = () => { successHaptic(); onSave(name, current); close(); };
  const submitLoss = () => { onRecordLoss({ name, ...loss }); close(); };

  const tenure = tenureLabel(record);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* The sheet is anchored to the bottom of the screen, which is where the
          keyboard appears — without this, tapping "Where from?" put the field
          behind the keyboard and the keeper typed blind. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,14,24,0.72)", justifyContent: "flex-end" }} onPress={close} accessibilityLabel="Close record">
        {/* Swallows taps so they don't close the sheet. Not a control, so it's
            hidden from VoiceOver rather than announced as an unnamed button. */}
        <Pressable accessible={false} importantForAccessibility="no" onPress={(e) => e.stopPropagation()} style={{ backgroundColor: theme.cardSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(28, insets.bottom + 12) }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <SpeciesThumb name={name} size={42} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: type.title, fontFamily: "Inter_900Black", fontWeight: "900" }}>{name}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                {quantity > 1 ? `${quantity} in the tank` : "In the tank"}{tenure ? ` · ${tenure}` : ""}
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={touchSlop(34)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border }} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={17} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {mode === "edit" ? (
              <View>
                <Field label="Date added" hint="When it actually went in — not when you logged it">
                  <TextInput
                    value={current.addedAt || ""}
                    onChangeText={(v) => set({ addedAt: v })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.secondaryText}
                    style={inputStyle}
                    accessibilityLabel="Date added"
                  
            maxLength={TEXT_LIMITS.date}
          />
                </Field>

                <Field label="Where from" hint="The shop, the breeder, a fellow keeper">
                  <TextInput
                    value={current.source || ""}
                    onChangeText={(v) => set({ source: v })}
                    placeholder="e.g. Blue Reef Aquatics"
                    placeholderTextColor={theme.secondaryText}
                    style={inputStyle}
                    accessibilityLabel="Where the animal came from"
                  
            maxLength={TEXT_LIMITS.name}
          />
                </Field>

                <Field label="Price paid" hint="Each, not the total">
                  <TextInput
                    value={current.price == null ? "" : String(current.price)}
                    onChangeText={(v) => set({ price: decimalText(v) })}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={theme.secondaryText}
                    style={inputStyle}
                    accessibilityLabel="Price paid per animal"
                  
            maxLength={TEXT_LIMITS.number}
          />
                </Field>

                <Field label="Notes" hint="Markings, temperament, who it fights with">
                  <TextInput
                    value={current.notes || ""}
                    onChangeText={(v) => set({ notes: v })}
                    placeholder="Anything you'd want to remember"
                    placeholderTextColor={theme.secondaryText}
                    multiline
                    style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
                    accessibilityLabel="Notes about this animal"
                  
            maxLength={TEXT_LIMITS.note}
          />
                </Field>

                <Pressable onPress={save} style={[styles.primaryBtn, { marginTop: 6 }]} accessibilityRole="button" accessibilityLabel={`Save record for ${name}`}>
                  <Text style={styles.primaryBtnText}>Save record</Text>
                </Pressable>

                {/* The way out that keeps the history. Deliberately quiet — it
                    is not a destructive button, it's the record of an event. */}
                <Pressable
                  onPress={() => { tapHaptic(); setMode("loss"); }}
                  style={({ pressed }) => [{ alignItems: "center", paddingVertical: 14 }, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Record that ${name} left the tank`}
                >
                  <Text style={{ color: theme.secondaryText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>No longer in the tank…</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>
                  What happened? This stays in your tank's history — losing the record is worse than losing the fish.
                </Text>

                <Field label="What happened">
                  <View style={{ gap: 6 }}>
                    {LOSS_REASONS.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => { tapHaptic("light"); setLoss((l) => ({ ...l, reason: r.id })); }}
                        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.md, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, backgroundColor: loss.reason === r.id ? "rgba(56,225,198,0.14)" : theme.well, borderColor: loss.reason === r.id ? theme.accent : theme.border }, pressed && { opacity: 0.75 }]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: loss.reason === r.id }}
                        accessibilityLabel={r.label}
                      >
                        <Ionicons name={r.icon} size={15} color={loss.reason === r.id ? theme.accent : theme.secondaryText} />
                        <Text style={{ color: loss.reason === r.id ? "#fff" : theme.bodyText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{r.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>

                {/* A cause only makes sense for a death — asking why you sold a
                    healthy fish reads as an accusation. */}
                {isMortality(loss.reason) ? (
                  <Field label="Likely cause" hint="Your best guess is worth more than a blank">
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {LOSS_CAUSES.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => { tapHaptic("light"); setLoss((l) => ({ ...l, cause: c })); }}
                          style={[styles.pill, { backgroundColor: loss.cause === c ? theme.accent : "rgba(255,255,255,0.05)", borderColor: loss.cause === c ? theme.accent : theme.border }]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: loss.cause === c }}
                          accessibilityLabel={`Cause: ${c}`}
                        >
                          <Text style={{ color: loss.cause === c ? theme.onAccent : theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </Field>
                ) : null}

                {/* Losing three of a school of six leaves three fish. */}
                {quantity > 1 ? (
                  <Field label="How many" hint={`You have ${quantity}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <Pressable onPress={() => setLoss((l) => ({ ...l, count: Math.max(1, l.count - 1) }))} hitSlop={touchSlop(34)} style={stepBtn} accessibilityRole="button" accessibilityLabel="Fewer">
                        <Ionicons name="remove" size={16} color={theme.accent} />
                      </Pressable>
                      <Text style={{ color: "#fff", fontSize: type.title, fontFamily: "Inter_900Black", fontWeight: "900", minWidth: 28, textAlign: "center" }}>{loss.count}</Text>
                      <Pressable onPress={() => setLoss((l) => ({ ...l, count: Math.min(quantity, l.count + 1) }))} hitSlop={touchSlop(34)} style={stepBtn} accessibilityRole="button" accessibilityLabel="More">
                        <Ionicons name="add" size={16} color={theme.accent} />
                      </Pressable>
                      <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                        {loss.count >= quantity ? "all of them" : `${quantity - loss.count} left`}
                      </Text>
                    </View>
                  </Field>
                ) : null}

                <Field label="Notes">
                  <TextInput
                    value={loss.notes}
                    onChangeText={(v) => setLoss((l) => ({ ...l, notes: v }))}
                    placeholder="What you saw, what you tried"
                    placeholderTextColor={theme.secondaryText}
                    multiline
                    style={[inputStyle, { minHeight: 60, textAlignVertical: "top" }]}
                    accessibilityLabel="Notes about what happened"
                  
            maxLength={TEXT_LIMITS.note}
          />
                </Field>

                <Pressable onPress={submitLoss} style={[styles.primaryBtn, { marginTop: 6 }]} accessibilityRole="button" accessibilityLabel={`Save ${name} to tank history`}>
                  <Text style={styles.primaryBtnText}>Save to tank history</Text>
                </Pressable>
                <Pressable onPress={() => setMode("edit")} style={({ pressed }) => [{ alignItems: "center", paddingVertical: 13 }, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Back to the record">
                  <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Back</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: theme.well, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
  color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.bodyLg,
  fontFamily: "Inter_600SemiBold", fontWeight: "600",
};

const stepBtn = {
  width: 34, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)",
};

function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</Text>
      {children}
      {hint ? <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 5 }}>{hint}</Text> : null}
    </View>
  );
}
