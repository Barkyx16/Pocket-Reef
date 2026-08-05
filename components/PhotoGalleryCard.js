import { Image, Pressable, Text, View } from "react-native";
import { styles, theme } from "../styles";
import { SCREEN_WIDTH } from "../core";

// A grid of every photo from the tank journal — a quick visual history. Tapping
// a thumbnail opens that dated entry's note.
export function PhotoGalleryCard({ journal = [], onOpen }) {
  const photos = journal.filter((e) => e.photo);
  if (!photos.length) {
    return <Text style={styles.cardText}>Add a photo to a journal entry and your tank's photo history will build here.</Text>;
  }
  // Three across, accounting for card padding (20) and gaps (8).
  const size = Math.floor((SCREEN_WIDTH - 32 - 40 - 16) / 3);
  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>{photos.length} photo{photos.length > 1 ? "s" : ""} from your journal.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((e) => (
          <Pressable key={e.id} onPress={() => onOpen && onOpen(e)} accessibilityRole="button" accessibilityLabel={`Photo from ${e.date}`}>
            <Image source={{ uri: e.photo }} style={{ width: size, height: size, borderRadius: 12, borderWidth: 1, borderColor: theme.border }} resizeMode="cover" />
            <Text style={{ color: theme.secondaryText, fontSize: 9, fontWeight: "800", marginTop: 3, textAlign: "center" }}>{e.date ? e.date.slice(5) : ""}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
