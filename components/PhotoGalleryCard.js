import { useState } from "react";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { styles, theme, CONTENT_MAX_WIDTH, radius, space } from "../styles";
import { EmptyState } from "./EmptyState";
import { tapHaptic } from "../core";

// How many thumbnails mount at once.
//
// The grid rendered every photo in the journal — one <Image> each, all decoded
// and held in memory simultaneously. That is fine for the twelve photos this
// was written against and progressively worse for the keeper it is actually
// for: a four-year journal is several hundred bitmaps mounted to show a screen
// that fits nine. Images are the heaviest thing React Native renders, and this
// is the one place the app mounts an unbounded number of them.
//
// A page rather than a FlatList: the grid lives inside a ScrollView, and
// nesting a virtualised list in a ScrollView breaks its windowing and warns
// loudly. Paging keeps the memory bounded with none of that.
const PAGE = 30;


// A grid of every photo from the tank journal — a quick visual history. Tapping
// a thumbnail opens that dated entry's note.
export function PhotoGalleryCard({ journal = [], onOpen }) {
  const [visible, setVisible] = useState(PAGE);
  // Three across, accounting for card padding (20) and gaps (8).
  // Live width — a grid sized at launch leaves a ragged gap after rotation.
  // Window width is NOT the container width: above 768pt the content column is
  // capped at CONTENT_MAX_WIDTH and centred, so sizing a grid from the raw
  // window made the photos overflow their card on a tablet or wide window.
  //
  // This MUST stay above the empty-state return. It used to sit below it, so
  // the component called one hook with photos and none without — and adding
  // your very first photo changed the hook count between two renders of the
  // same component, which is the "rendered more hooks than during the previous
  // render" crash. Nothing caught it because the empty and populated states
  // were only ever rendered separately.
  const { width } = useWindowDimensions();
  const photos = journal.filter((e) => e.photo);
  if (!photos.length) {
    return <EmptyState emoji="🖼️" title="No photos yet" subtitle="Add a photo to a journal entry and your tank's visual history builds here." />;
  }
  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const size = Math.floor((columnWidth - 32 - 40 - 16) / 3);
  const shown = photos.slice(0, visible);
  const remaining = photos.length - shown.length;
  return (
    <View>
      <Text style={[styles.cardText, { marginTop: 0, marginBottom: space.md }]}>
        {photos.length} photo{photos.length > 1 ? "s" : ""} from your journal{remaining > 0 ? `, showing the newest ${shown.length}` : ""}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {shown.map((e) => (
          <Pressable key={e.id} onPress={() => onOpen && onOpen(e)} accessibilityRole="button" accessibilityLabel={`Photo from ${e.date}`}>
            <Image source={{ uri: e.photo }} style={{ width: size, height: size, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border }} resizeMode="cover" />
            <Text style={{ color: theme.secondaryText, fontSize: 9, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.xs, textAlign: "center" }}>{e.date ? e.date.slice(5) : ""}</Text>
          </Pressable>
        ))}
      </View>

      {remaining > 0 ? (
        <Pressable
          onPress={() => { tapHaptic(); setVisible((v) => v + PAGE); }}
          style={[styles.ghostBtn, { marginTop: space.md }]}
          accessibilityRole="button"
          accessibilityLabel={`Show ${Math.min(PAGE, remaining)} more photos`}
        >
          <Text style={styles.ghostBtnText}>Show more ({remaining})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
