import { memo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { careLevelColor, temperamentColor } from "../core";
import { formatTempRange, formatVolume } from "../lib/units";
import { getSpeciesImage } from "../data/speciesImageMap";
import { Chip } from "./Chip";

// A tappable species row styled exactly like Pocket Planter's plant card:
// a 54px image well, bold name, meta line, care/temperament chips, and an
// add/remove control.
// Memoized: the Species tab can hold hundreds of these mounted at once, and
// without this every card re-renders when any single filter, search keystroke,
// or wishlist toggle changes. The comparator lists exactly the props that
// change what this row draws.
function SpeciesCardBase({ species, onPress, inTank, onToggleTank, note, inWishlist, onToggleWishlist }) {
  const img = getSpeciesImage(species.name);
  return (
    <Pressable style={({ pressed }) => [styles.cleanRow, { borderLeftWidth: 3, borderLeftColor: species.water === "salt" ? theme.coral : theme.accent }, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9, borderColor: theme.accent, borderLeftColor: species.water === "salt" ? theme.coral : theme.accent }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${species.name}. ${species.water === "salt" ? "Saltwater" : "Freshwater"}, ${species.careLevel} care, ${species.temperament}, minimum ${species.minGallons} gallons.${inTank ? " In your tank." : ""}${inWishlist ? " On your wishlist." : ""}`} accessibilityHint="Opens care details">
      <View style={styles.cleanImageWrap}>
        {img ? (
          <Image source={img} style={styles.cleanImage} resizeMode="cover" />
        ) : (
          <Text style={styles.cleanEmoji}>{species.emoji}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cleanName} numberOfLines={1}>{species.name}</Text>
        <Text style={styles.cleanMeta} numberOfLines={1}>
          {species.water === "salt" ? "🌊 Saltwater" : "💧 Freshwater"} · {formatVolume(species.minGallons)}+ · {formatTempRange(species.tempMinF, species.tempMaxF)}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 7 }}>
          <Chip label={species.careLevel} color={careLevelColor(species.careLevel)} />
          <Chip label={species.temperament} color={temperamentColor(species.temperament)} />
        </View>
        {note ? <Text style={{ color: theme.accent, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 6 }} numberOfLines={1}>{note}</Text> : null}
      </View>
      {onToggleWishlist ? (
        <Pressable
          onPress={onToggleWishlist}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={inWishlist ? `Remove ${species.name} from wishlist` : `Save ${species.name} to wishlist`}
          style={{ width: 34, height: 38, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 18 }}>{inWishlist ? "❤️" : "🤍"}</Text>
        </Pressable>
      ) : null}
      {onToggleTank ? (
        <Pressable
          onPress={onToggleTank}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={inTank ? `Remove ${species.name} from tank` : `Add ${species.name} to tank`}
          style={{
            width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center",
            backgroundColor: inTank ? "rgba(255,138,101,0.18)" : "rgba(56,225,198,0.18)",
            borderWidth: 1, borderColor: inTank ? theme.coral : theme.accent,
          }}
        >
          <Text style={{ color: inTank ? theme.coral : theme.accent, fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900" }}>{inTank ? "−" : "+"}</Text>
        </Pressable>
      ) : (
        <Text style={styles.cleanArrow}>›</Text>
      )}
    </Pressable>
  );
}

export const SpeciesCard = memo(SpeciesCardBase, (a, b) => (
  a.species === b.species &&
  a.inTank === b.inTank &&
  a.inWishlist === b.inWishlist &&
  a.note === b.note &&
  a.onToggleTank === b.onToggleTank &&
  a.onToggleWishlist === b.onToggleWishlist
));
