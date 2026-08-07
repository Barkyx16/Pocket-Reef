import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { styles, theme, CONTENT_MAX_WIDTH } from "../styles";


// A grid of every photo from the tank journal — a quick visual history. Tapping
// a thumbnail opens that dated entry's note.
export function PhotoGalleryCard({ journal = [], onOpen }) {
  const photos = journal.filter((e) => e.photo);
  if (!photos.length) {
    return <Text style={styles.cardText}>Add a photo to a journal entry and your tank's photo history will build here.</Text>;
  }
  // Three across, accounting for card padding (20) and gaps (8).
  // Live width — a grid sized at launch leaves a ragged gap after rotation.
  // Window width is NOT the container width: above 768pt the content column is
  // capped at CONTENT_MAX_WIDTH and centred, so sizing a grid from the raw
  // window made the photos overflow their card on a tablet or wide window.
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const size = Math.floor((columnWidth - 32 - 40 - 16) / 3);
  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: 12 }]}>{photos.length} photo{photos.length > 1 ? "s" : ""} from your journal.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((e) => (
          <Pressable key={e.id} onPress={() => onOpen && onOpen(e)} accessibilityRole="button" accessibilityLabel={`Photo from ${e.date}`}>
            <Image source={{ uri: e.photo }} style={{ width: size, height: size, borderRadius: 12, borderWidth: 1, borderColor: theme.border }} resizeMode="cover" />
            <Text style={{ color: theme.secondaryText, fontSize: 9, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 3, textAlign: "center" }}>{e.date ? e.date.slice(5) : ""}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
