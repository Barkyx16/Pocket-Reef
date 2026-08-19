import { useMemo, useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic } from "../core";
import { touchSlop } from "../lib/a11y";
import { KINDS, kindOf, newInventoryItem, forecastInventory, suggestedItems, LOW_STOCK_DAYS } from "../lib/inventory";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";
import { fmt } from "../lib/format";
import { TEXT_LIMITS } from "../lib/textLimits";
import { decimalText } from "../lib/numericInput";

// The shelf, and when it runs out.
//
// Usage is measured from the logs the keeper already keeps — water changes for
// salt and RODI, the dose log for supplements — so the prediction costs no
// extra bookkeeping. Where nothing can be measured the card says so instead of
// producing a date it can't stand behind.

const STATE = {
  out: { color: theme.danger, label: "Out" },
  expired: { color: theme.danger, label: "Expired" },
  low: { color: theme.warn, label: "Low" },
  expiring: { color: theme.warn, label: "Expiring" },
  unknown: { color: theme.muted, label: "No estimate" },
  ok: { color: theme.accent, label: "Stocked" },
};

export function InventoryCard({ tank = {}, waterType = "fresh", onAdd, onRemove, onSetStock, now }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "media", stock: "", perGallon: "", doseKey: null, perDay: "" });

  // `tank.inventory || []` built a fresh array on every render, so the memo
  // below recomputed the whole forecast every time regardless — the memo was
  // there and doing nothing.
  const items = useMemo(() => tank.inventory || [], [tank.inventory]);
  const { rows, needs, shoppingList } = useMemo(() => forecastInventory(items, tank, now ? { now } : {}), [items, tank, now]);

  const reset = () => { setDraft({ name: "", kind: "media", stock: "", perGallon: "", doseKey: null, perDay: "" }); setAdding(false); };

  const submit = () => {
    const item = newInventoryItem({
      name: draft.name,
      kind: draft.kind,
      stock: draft.stock,
      perGallon: draft.perGallon || null,
      doseKey: draft.doseKey,
      perDay: draft.perDay || null,
    });
    if (!item) return;
    tapHaptic("medium");
    onAdd && onAdd(item);
    reset();
  };

  const addSuggested = (s) => {
    const item = newInventoryItem(s);
    if (!item) return;
    tapHaptic();
    onAdd && onAdd(item);
  };

  const share = () => {
    if (!shoppingList.length) return;
    tapHaptic();
    Share.share({ message: `Pocket Reef shopping list\n\n${shoppingList.map((n) => `• ${n}`).join("\n")}` }).catch(() => {});
  };

  const kinds = KINDS.filter((k) => !k.saltwaterOnly || waterType === "salt");
  const suggestions = suggestedItems(waterType).filter((s) => !items.some((i) => i.name.toLowerCase() === s.name.toLowerCase()));

  return (
    <View>
      {needs.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,216,107,0.10)", borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,216,107,0.30)", padding: 12, marginBottom: 12 }}>
          <Ionicons name="cart" size={16} color={theme.warn} />
          <Text style={{ flex: 1, color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18 }}>
            {needs.length} item{needs.length === 1 ? "" : "s"} to restock before you're stuck mid-water-change.
          </Text>
          <Pressable onPress={share} hitSlop={touchSlop(24)} accessibilityRole="button" accessibilityLabel="Share the shopping list">
            <Text style={{ color: theme.warn, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Share</Text>
          </Pressable>
        </View>
      ) : null}

      {!items.length ? (
        <>
          <EmptyState emoji="🧂" title="Nothing on the shelf yet" subtitle={`Add what you keep in stock and Pocket Reef works out how fast you get through it — from the water changes and doses you already log — and warns you ${LOW_STOCK_DAYS} days before you run out.`} />
          {suggestions.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {suggestions.map((s) => (
                <Pill key={s.name} label={`+ ${s.name}`} onPress={() => addSuggested(s)} />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map(({ item, state, headline, rate, daysLeft }) => {
            const st = STATE[state] || STATE.ok;
            const k = kindOf(item.kind);
            return (
              <View key={item.id} style={{ backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: state === "ok" || state === "unknown" ? theme.border : `${st.color}55`, padding: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <Ionicons name={k.icon} size={16} color={st.color} />
                  <Text style={{ flex: 1, color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }} numberOfLines={1}>{item.name}</Text>
                  <View style={{ backgroundColor: `${st.color}1f`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: st.color, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{st.label}</Text>
                  </View>
                  <Pressable onPress={() => onRemove && onRemove(item.id)} hitSlop={touchSlop(22)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
                    <Ionicons name="close" size={14} color={theme.secondaryText} />
                  </Pressable>
                </View>

                <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 6 }}>{headline}</Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                    {item.stock} {item.unit} left
                    {/* Whether the rate was measured or merely stated changes how
                        much the date is worth, so it's never hidden. */}
                    {rate ? ` · ${fmt(rate.perDay)}/day from ${rate.basis}` : ""}
                  </Text>
                </View>

                {onSetStock ? (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    <Pressable
                      onPress={() => { tapHaptic("light"); onSetStock(item.id, Math.max(0, item.stock - 1)); }}
                      style={[styles.pill, { paddingHorizontal: 14 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Use one ${item.unit} of ${item.name}`}
                    >
                      <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>−1</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { tapHaptic("light"); onSetStock(item.id, item.stock + 1); }}
                      style={[styles.pill, { paddingHorizontal: 14 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Add one ${item.unit} of ${item.name}`}
                    >
                      <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>+1</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {adding ? (
        <View style={{ marginTop: 12, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="What is it?"
            placeholderTextColor={theme.secondaryText}
            accessibilityLabel="Item name"
            style={styles.authInput}
          
            maxLength={TEXT_LIMITS.name}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {kinds.map((k) => (
              <Pill key={k.id} label={k.label} active={draft.kind === k.id} onPress={() => setDraft((d) => ({ ...d, kind: k.id, doseKey: k.id === "supplement" ? "alk" : null }))} />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              value={draft.stock}
              onChangeText={(v) => setDraft((d) => ({ ...d, stock: decimalText(v) }))}
              keyboardType="decimal-pad"
              placeholder={`How much (${kindOf(draft.kind).unit})`}
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="How much you have"
              style={[styles.authInput, { flex: 1 }]}
            
            maxLength={TEXT_LIMITS.number}
          />
          </View>

          {/* Only the fields that can't be inferred for this kind. */}
          {kindOf(draft.kind).source === "waterchange" ? (
            <TextInput
              value={draft.perGallon}
              onChangeText={(v) => setDraft((d) => ({ ...d, perGallon: decimalText(v) }))}
              keyboardType="decimal-pad"
              placeholder={`${kindOf(draft.kind).unit} per gallon of new water`}
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Amount used per gallon of new water"
              style={[styles.authInput, { marginTop: 8 }]}
            
            maxLength={TEXT_LIMITS.number}
          />
          ) : kindOf(draft.kind).source === "dose" ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {["alk", "calcium", "magnesium"].map((k) => (
                <Pill key={k} label={k === "alk" ? "Alk" : k === "calcium" ? "Calcium" : "Mag"} active={draft.doseKey === k} onPress={() => setDraft((d) => ({ ...d, doseKey: k }))} />
              ))}
            </View>
          ) : (
            <TextInput
              value={draft.perDay}
              onChangeText={(v) => setDraft((d) => ({ ...d, perDay: decimalText(v) }))}
              keyboardType="decimal-pad"
              placeholder={`Used per day (${kindOf(draft.kind).unit}) — optional`}
              placeholderTextColor={theme.secondaryText}
              accessibilityLabel="Amount used per day"
              style={[styles.authInput, { marginTop: 8 }]}
            
            maxLength={TEXT_LIMITS.number}
          />
          )}

          <Pressable onPress={submit} disabled={!draft.name.trim()} style={[draft.name.trim() ? styles.primaryBtn : styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
            <Text style={draft.name.trim() ? styles.primaryBtnText : styles.ghostBtnText}>Add to the shelf</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.authLinkBtn} accessibilityRole="button">
            <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { tapHaptic(); setAdding(true); }} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>+ Add an item</Text>
        </Pressable>
      )}
    </View>
  );
}
