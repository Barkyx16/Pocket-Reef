import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { touchSlop, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";
import { iconForEmoji } from "../lib/icons";
import {
  CATEGORIES, SUGGESTIONS, newEquipment, ageLabel, warrantyLabel,
  warrantyStatus, byCategory, equipmentSummary,
} from "../lib/equipment";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText, integerText } from "../lib/numericInput";
import { fmtMoney } from "../lib/format";

// What's actually on the tank.
//
// The gear guide sizes equipment for shopping and then forgets it. This is the
// record that answers the questions asked for the next five years: which heater
// is this, is the dead pump still under warranty, what did the build cost.
export function EquipmentCard({ equipment = [], onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "filtration", price: "", warrantyMonths: "", installedAt: "", watts: "" });

  const summary = equipmentSummary(equipment);
  const groups = byCategory(equipment);

  const submit = () => {
    const item = newEquipment({
      name: draft.name,
      category: draft.category,
      price: draft.price,
      warrantyMonths: draft.warrantyMonths,
      watts: draft.watts,
      installedAt: draft.installedAt || undefined,
    });
    if (!item) return;
    successHaptic();
    onAdd(item);
    setDraft({ name: "", category: draft.category, price: "", warrantyMonths: "", installedAt: "", watts: "" });
    setAdding(false);
  };

  return (
    <View>
      {equipment.length ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat label="Items" value={String(summary.count)} />
          <Stat
            label="Build cost"
            value={summary.spend ? fmtMoney(Math.round(summary.spend)) : "—"}
            sub={summary.priced < summary.count ? `${summary.priced} of ${summary.count} priced` : "All priced"}
          />
          <Stat
            label="Under warranty"
            value={String(summary.underWarranty)}
            tone={summary.endingSoon.length ? theme.warn : undefined}
            sub={summary.endingSoon.length ? `${summary.endingSoon.length} ending soon` : null}
          />
        </View>
      ) : (
        <Text style={[styles.cardText, { marginTop: 0 }]}>
          Record the heater, pump, skimmer and light on this tank. Later, when something fails, you'll know how old it is and whether it's still covered.
        </Text>
      )}

      {/* The one thing worth interrupting for: a claim you can still make. */}
      {summary.endingSoon.length ? (
        <View style={{ marginTop: 12, backgroundColor: "rgba(255,216,107,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,216,107,0.24)", padding: 12 }}>
          <Text style={{ color: theme.warn, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900", marginBottom: 4 }}>Warranty ending</Text>
          {summary.endingSoon.slice(0, 3).map((i) => (
            <Text key={i.id} style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>
              {i.name} — {warrantyLabel(i)}. Worth checking it now while a claim is still possible.
            </Text>
          ))}
        </View>
      ) : null}

      {groups.map(({ category, items }) => (
        <View key={category.id} style={{ marginTop: 14 }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 6 }]}>{category.label}</Text>
          <View style={{ gap: 6 }}>
            {items.map((item) => {
              const w = warrantyStatus(item);
              const bits = [ageLabel(item), item.brand || null, item.price != null ? fmtMoney(item.price) : null, item.watts != null ? `${item.watts}W` : null].filter(Boolean);
              return (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 9 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)" }}>
                    {iconForEmoji(category.emoji) ? (
                      <Ionicons name={iconForEmoji(category.emoji)} size={14} color={theme.accent} />
                    ) : (
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={{ fontSize: 14 }}>{category.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: "#fff", fontSize: 13.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{item.name}</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                      {bits.length ? bits.join(" · ") : "No details recorded"}
                    </Text>
                    {w.state !== "none" ? (
                      <Text style={{ color: w.state === "expired" ? theme.secondaryText : w.state === "ending" ? theme.warn : theme.accent, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 2 }}>
                        {warrantyLabel(item)}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => onRemove(item)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
                    <Ionicons name="close" size={14} color={theme.secondaryText} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {adding ? (
        <View style={{ marginTop: 14, backgroundColor: theme.well, borderRadius: 12, borderWidth: 1, borderColor: theme.accent, padding: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => { tapHaptic("light"); setDraft((d) => ({ ...d, category: c.id })); }}
                style={[styles.pill, { backgroundColor: draft.category === c.id ? theme.accent : "rgba(255,255,255,0.05)", borderColor: draft.category === c.id ? theme.accent : theme.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.category === c.id }}
                accessibilityLabel={`Category: ${c.label}`}
              >
                <Text style={{ color: draft.category === c.id ? theme.onAccent : theme.text, fontSize: 11.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>{c.emoji} {c.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="What is it?"
            placeholderTextColor={theme.secondaryText}
            autoFocus
            style={input}
            accessibilityLabel="Name of the equipment"
          
            maxLength={TEXT_LIMITS.name}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {(SUGGESTIONS[draft.category] || []).map((s) => (
              <Pressable
                key={s}
                onPress={() => { tapHaptic("light"); setDraft((d) => ({ ...d, name: s })); }}
                style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s}`}
              >
                <Text style={{ color: theme.text, fontSize: 11.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              value={draft.price}
              onChangeText={(v) => setDraft((d) => ({ ...d, price: decimalText(v) }))}
              keyboardType="decimal-pad"
              placeholder="Price"
              placeholderTextColor={theme.secondaryText}
              style={[input, { flex: 1 }]}
              accessibilityLabel="Price paid"
            
            maxLength={TEXT_LIMITS.number}
          />
            <TextInput
              value={draft.warrantyMonths}
              onChangeText={(v) => setDraft((d) => ({ ...d, warrantyMonths: integerText(v) }))}
              keyboardType="number-pad"
              placeholder="Warranty (months)"
              placeholderTextColor={theme.secondaryText}
              style={[input, { flex: 1 }]}
              accessibilityLabel="Warranty length in months"
            
            maxLength={TEXT_LIMITS.number}
          />
          </View>

          {/* Power draw. Optional — the running-cost card falls back to a
              typical figure for the category and says when it has. */}
          <TextInput
            value={draft.watts}
            onChangeText={(v) => setDraft((d) => ({ ...d, watts: decimalText(v) }))}
            keyboardType="decimal-pad"
            placeholder="Watts (optional — powers the running-cost estimate)"
            placeholderTextColor={theme.secondaryText}
            style={[input, { marginTop: 8 }]}
            accessibilityLabel="Power draw in watts"
          
            maxLength={TEXT_LIMITS.number}
          />

          <TextInput
            value={draft.installedAt}
            onChangeText={(v) => setDraft((d) => ({ ...d, installedAt: v }))}
            placeholder="Installed (YYYY-MM-DD, blank = today)"
            placeholderTextColor={theme.secondaryText}
            style={[input, { marginTop: 8 }]}
            accessibilityLabel="Date installed"
          
            maxLength={TEXT_LIMITS.date}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
            <Pressable onPress={() => { tapHaptic(); setAdding(false); }} hitSlop={touchSlop(28)} accessibilityRole="button" accessibilityLabel="Cancel adding equipment">
              <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={submit}
              disabled={!draft.name.trim()}
              style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: draft.name.trim() ? theme.accent : "rgba(255,255,255,0.06)" }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Save this equipment"
              accessibilityState={{ disabled: !draft.name.trim() }}
            >
              <Text style={{ color: draft.name.trim() ? theme.onAccent : theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_900Black", fontWeight: "900" }}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => { tapHaptic(); setAdding(true); }}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: theme.border }, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Add equipment"
        >
          <Ionicons name="add" size={15} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>Add equipment</Text>
        </Pressable>
      )}
    </View>
  );
}

const input = {
  backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 12,
  paddingVertical: 9, color: theme.text, borderWidth: 1, borderColor: theme.border,
  fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600",
};

function Stat({ label, value, sub, tone }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 10 }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: tone || "#fff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>{value}</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={2} style={{ color: theme.secondaryText, fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
      {sub ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 10.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}
