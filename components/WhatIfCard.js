import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { formatVolume } from "../lib/units";
import { simulateAdditions, tankSizeFor, alternativesFor } from "../lib/whatif";
import { EmptyState } from "./EmptyState";

// The wishlist, run against this tank as a single purchase.
//
// Selecting a subset matters: the useful answer is rarely "your whole list
// works" or "none of it does", it's "these three, in this order, and not that
// one". So every candidate is togglable and the simulation reruns live.

export function WhatIfCard({ tank = {}, wishlist = [], onOpenSpecies }) {
  const [excluded, setExcluded] = useState([]);
  const chosen = wishlist.filter((n) => !excluded.includes(n));
  const result = useMemo(() => simulateAdditions(tank, chosen), [tank, chosen]);
  const needed = useMemo(() => tankSizeFor(chosen), [chosen]);
  const alts = useMemo(() => (result.ok && !result.viable.length ? alternativesFor(tank, 4) : []), [result, tank]);

  if (!wishlist.length) {
    return <EmptyState emoji="⭐" title="Nothing on your wishlist" subtitle="Star a few species in the catalog and Pocket Reef will work out what would actually happen if you bought them — together, in this tank." />;
  }

  const toggle = (name) => {
    tapHaptic("light");
    setExcluded((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const roomAfter = result.ok && result.room.after ? result.room.after : null;

  return (
    <View>
      {/* Which of the list we're pricing up. */}
      <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Buying</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
        {wishlist.map((n) => {
          const on = !excluded.includes(n);
          return (
            <Pressable
              key={n}
              onPress={() => toggle(n)}
              style={[styles.pill, { backgroundColor: on ? "rgba(56,225,198,0.16)" : "rgba(255,255,255,0.04)", borderColor: on ? theme.accent : theme.border }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${n}, ${on ? "included in" : "excluded from"} the simulation`}
            >
              <Text style={{ color: on ? theme.accent : theme.secondaryText, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{on ? "✓ " : ""}{n}</Text>
            </Pressable>
          );
        })}
      </View>

      {!result.ok ? (
        <Text style={[styles.cardText, { marginTop: space.md }]}>{result.reason}</Text>
      ) : (
        <>
          <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.lg }}>{result.headline}</Text>

          {/* Bioload before and after — the number no single-fish check can produce. */}
          {roomAfter ? (
            <View style={{ backgroundColor: theme.well, borderRadius: radius.md, borderWidth: 1, borderColor: result.overstocked ? `${theme.danger}55` : theme.border, padding: space.md, marginTop: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Stocking</Text>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
                  {result.load.before.pct}% → <Text style={{ color: result.overstocked ? theme.danger : theme.accent }}>{result.load.after.pct}%</Text>
                </Text>
                <Text style={{ flex: 1, textAlign: "right", color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>
                  +{result.totalFish} fish
                </Text>
              </View>
              {result.overstocked ? (
                <Text style={{ color: theme.danger, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.sm }}>
                  Past what this tank can carry. Drop one, or step up to about {formatVolume(needed)}.
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* The order to buy them in — the oldest advice in the hobby, and the
              app has never given it. */}
          {result.order.length > 1 ? (
            <View style={{ marginTop: space.md }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Add them in this order</Text>
              <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: space.xs }}>
                Peaceful and hardy first. Put the boldest fish in last, or it owns the tank before the others arrive.
              </Text>
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {result.order.map((i, n) => (
                  <View key={i.name} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900", width: 16 }}>{n + 1}</Text>
                    <Text style={{ fontSize: type.body }}>{i.emoji}</Text>
                    <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                      {i.count > 1 ? `${i.count}× ` : ""}{i.name}
                    </Text>
                    <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" }}>{i.temperament}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Why the rest can't come. */}
          {result.blocked.length ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Won't work here</Text>
              {result.blocked.map((i) => (
                <Pressable
                  key={i.name}
                  onPress={() => onOpenSpecies && onOpenSpecies(i.name)}
                  style={({ pressed }) => [{ backgroundColor: "rgba(255,107,107,0.08)", borderRadius: radius.md, borderWidth: 1, borderColor: `${theme.danger}44`, padding: space.md }, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.name}: ${i.blockers.map((b) => b.text).join(" ")}`}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text style={{ fontSize: type.body }}>{i.emoji}</Text>
                    <Text style={{ flex: 1, color: theme.text, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{i.name}</Text>
                    <Ionicons name="chevron-forward" size={13} color={theme.secondaryText} />
                  </View>
                  {i.blockers.map((b, n) => (
                    <Text key={n} style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16, marginTop: space.xs }}>• {b.text}</Text>
                  ))}
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Cautions on the ones that do work. */}
          {result.viable.some((i) => i.cautions.length) ? (
            <View style={{ marginTop: space.md, gap: space.xs }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>Worth knowing</Text>
              {result.viable.flatMap((i) => i.cautions.map((c, n) => (
                <Text key={`${i.name}-${n}`} style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17 }}>
                  <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>{i.name}: </Text>{c.text}
                </Text>
              )))}
            </View>
          ) : null}

          {/* When nothing on the list works, offer what would. */}
          {alts.length ? (
            <View style={{ marginTop: space.lg }}>
              <Text style={{ color: theme.secondaryText, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>What would fit instead</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
                {alts.map((s) => (
                  <Pressable key={s.name} onPress={() => onOpenSpecies && onOpenSpecies(s.name)} style={styles.pill} accessibilityRole="button" accessibilityLabel={`${s.name}, an alternative that fits`}>
                    <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{s.emoji} {s.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
