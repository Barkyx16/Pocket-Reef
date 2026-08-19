import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { MAX_FONT_SCALE_COMPACT, touchSlop } from "../lib/a11y";
import { mortalitySummary, longestResident, documentedShare, livestockSpend, isMortality, tenureLabel } from "../lib/livestock";
import { SpeciesThumb } from "./SpeciesThumb";
import { fmtMoney } from "../lib/format";

// The tank's own record: how long things have lived, what's been lost, and
// what that adds up to.
//
// This is the part of fishkeeping the app had no representation of at all. A
// keeper's real question after a bad month isn't "what's my nitrate" — it's
// "is it me?". You can only answer that from a history, and the app was
// deleting the history.
export function TankRecordCard({ stock = [], stockMeta = {}, quantities = {}, losses = [], onOpenRecord, onDeleteLoss, onShareReport }) {
  const mortality = mortalitySummary(losses, { days: 365 });
  const oldest = longestResident(stock, stockMeta);
  const documented = documentedShare(stock, stockMeta);
  const spend = livestockSpend(stock, stockMeta, quantities, losses);
  const recent = losses.slice(0, 6);

  if (!stock.length && !losses.length) {
    return (
      <Text style={styles.cardText}>
        Add your stock and this becomes your tank's record — how long each animal has lived with you, what you've lost, and what it's cost.
      </Text>
    );
  }

  return (
    <View>
      {/* The three numbers worth leading with. Survival isn't shown as a
          percentage: with six fish it would swing 17 points per loss and read
          as precision the sample size can't support. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat
          label="Longest resident"
          value={oldest ? oldest.label : "—"}
          sub={oldest ? oldest.name : "Undated"}
        />
        <Stat
          label="Lost this year"
          value={String(mortality.total)}
          sub={mortality.topCause ? `Mostly ${mortality.topCause.cause.toLowerCase()}` : "Nothing lost"}
          tone={mortality.total ? theme.warn : theme.accent}
        />
        <Stat
          label="Livestock spend"
          value={spend.total ? fmtMoney(Math.round(spend.total)) : "—"}
          sub={spend.lost ? `${fmtMoney(Math.round(spend.lost))} lost` : "Documented"}
        />
      </View>

      {/* The honest caveat. A record that's 40% filled shouldn't imply the
          other 60% is a clean bill of health. */}
      {documented.total && documented.pct < 100 ? (
        <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 10, lineHeight: 17 }}>
          {documented.documented} of {documented.total} animals dated. Tap one below to fill in where it came from and when.
        </Text>
      ) : null}

      {/* The finding worth acting on. One death is bad luck; the same species
          twice is a husbandry mismatch, and that's a diagnosis. */}
      {mortality.repeatOffenders.length ? (
        <View style={{ marginTop: 12, backgroundColor: "rgba(255,216,107,0.08)", borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: "rgba(255,216,107,0.24)" }}>
          <Text style={{ color: theme.warn, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", marginBottom: 4 }}>Worth a second look</Text>
          {mortality.repeatOffenders.slice(0, 3).map((r) => (
            <Text key={r.name} style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>
              You've lost {r.count}× <Text style={{ fontFamily: "Inter_900Black", fontWeight: "900", color: theme.text }}>{r.name}</Text> — worth checking its needs against your water before trying again.
            </Text>
          ))}
        </View>
      ) : null}

      {/* CURRENT STOCK, as records rather than a list of names. */}
      {stock.length ? (
        <View style={{ marginTop: 16 }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 8 }]}>In the tank</Text>
          <View style={{ gap: 6 }}>
            {stock.map((name) => {
              const rec = stockMeta[name];
              const qty = quantities[name] || 1;
              const bits = [];
              if (rec && rec.addedAt) bits.push(tenureLabel(rec));
              if (rec && rec.source) bits.push(rec.source);
              if (rec && typeof rec.price === "number") bits.push(fmtMoney(rec.price));
              return (
                <Pressable
                  key={name}
                  onPress={() => onOpenRecord && onOpenRecord(name)}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 9 }, pressed && { opacity: 0.75, borderColor: theme.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Record for ${name}`}
                  accessibilityHint={bits.length ? bits.join(", ") : "No details recorded yet"}
                >
                  <SpeciesThumb name={name} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: "#fff", fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                      {qty > 1 ? `${qty}× ` : ""}{name}
                    </Text>
                    <Text numberOfLines={1} style={{ color: bits.length ? theme.secondaryText : theme.accent, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                      {bits.length ? bits.join(" · ") : "Add details"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={theme.secondaryText} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* The whole point of keeping the record: being able to hand it over.
          "What are your parameters, how long have you had it, what have you
          already tried" is the first reply to every sick-fish post. */}
      {onShareReport ? (
        <Pressable
          onPress={onShareReport}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", backgroundColor: "rgba(56,225,198,0.10)" }, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel="Share a tank report"
          accessibilityHint="Copies everything a fish store or forum will ask for"
        >
          <Ionicons name="document-text-outline" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>Share tank report</Text>
        </Pressable>
      ) : null}

      {/* THE HISTORY. */}
      {recent.length ? (
        <View style={{ marginTop: 16 }}>
          <Text accessibilityRole="header" style={[styles.cardEyebrow, { marginBottom: 8 }]}>No longer with us</Text>
          <View style={{ gap: 6 }}>
            {recent.map((l) => (
              <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md, borderWidth: 1, borderColor: theme.hairline, paddingHorizontal: 10, paddingVertical: 9 }}>
                <Ionicons
                  name={isMortality(l.reason) ? "heart-dislike-outline" : "swap-horizontal-outline"}
                  size={15}
                  color={isMortality(l.reason) ? theme.danger : theme.secondaryText}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: theme.bodyText, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                    {l.count > 1 ? `${l.count}× ` : ""}{l.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 2 }}>
                    {l.date}{l.cause ? ` · ${l.cause}` : ""}{l.tenure ? ` · kept ${l.tenure}` : ""}
                  </Text>
                </View>
                {onDeleteLoss ? (
                  <Pressable onPress={() => onDeleteLoss(l.id)} hitSlop={touchSlop(20)} accessibilityRole="button" accessibilityLabel={`Delete the record for ${l.name}`}>
                    <Ionicons name="close" size={14} color={theme.secondaryText} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          {losses.length > recent.length ? (
            <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 8 }}>
              +{losses.length - recent.length} more in your history
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 10 }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: tone || "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" }}>{value}</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={2} style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
      {sub ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} numberOfLines={1} style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}
