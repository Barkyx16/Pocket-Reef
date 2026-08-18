import { Children, isValidElement } from "react";
import { View } from "react-native";
import { useResponsiveLayout } from "../styles";
import { CardBoundary } from "./CardBoundary";

// Two columns where there's room for them.
//
// On a large screen the app clamped itself to a 700pt column and left the rest
// of an iPad empty — a phone layout stretched to the middle of a tablet, which
// is the thing that makes an app feel ported rather than built. Every screen is
// a vertical stack of self-contained cards, and a stack of cards is exactly the
// shape that reflows well.
//
// Deliberately generic: it takes whatever children a screen already renders and
// redistributes them, so no screen has to be restructured to benefit and phones
// are byte-for-byte unchanged.
//
// `lead` keeps the first N children full width. A hero banner in a half-width
// column reads as a mistake, and the first card on most screens is the one the
// screen is about.
// A card's own name, for the message shown if it breaks. React keeps it on the
// component type; memo() wrappers keep it one level in.
function nameOf(child) {
  const t = child && child.type;
  if (!t) return "This card";
  return t.displayName || t.name || (t.type && (t.type.displayName || t.type.name)) || "This card";
}

export function AdaptiveColumns({ children, lead = 1, gap = 14, enabled = true, guard = true }) {
  const layout = useResponsiveLayout();
  const raw = Children.toArray(children).filter((c) => isValidElement(c) || (c != null && c !== false));

  // Each card gets its own error boundary here rather than in twenty screens,
  // because this is the one place a screen's cards are already enumerated. One
  // card throwing now costs that card instead of the whole tree — see
  // CardBoundary for why that distinction matters so much more than it used to.
  const items = guard
    ? raw.map((c, i) => (isValidElement(c) ? <CardBoundary key={c.key || i} name={nameOf(c)}>{c}</CardBoundary> : c))
    : raw;

  // Phones, and anything the caller has opted out of, keep the original order
  // and layout — only the boundaries are added.
  if (!enabled || !layout.isLarge || items.length < lead + 2) return <>{items}</>;

  const leading = items.slice(0, lead);
  const rest = items.slice(lead);

  // Alternating rather than splitting down the middle. Card heights vary
  // enormously — a collapsed card is 60pt and an open species list is 2000 —
  // so halving the list by count reliably produces one very long column beside
  // a short one. Alternating keeps them roughly even without measuring.
  const left = rest.filter((_, i) => i % 2 === 0);
  const right = rest.filter((_, i) => i % 2 === 1);

  return (
    <>
      {leading}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap }}>
        <View style={{ flex: 1 }}>{left}</View>
        <View style={{ flex: 1 }}>{right}</View>
      </View>
    </>
  );
}
