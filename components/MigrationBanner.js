import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme, radius, type, space } from "../styles";

// Shown when a schema migration failed on launch.
//
// The app already backed everything up before migrating and already recorded
// the failure — and then said nothing. The user saw missing or wrong data with
// no way to know an intact copy was sitting on their device, which is the exact
// moment someone deletes and reinstalls, destroying the backup too.
//
// Deliberately not dismissible: a banner you can swipe away is a banner people
// dismiss before reading, and this one is the only route to their data.
export function MigrationBanner({ onRestore, restoring }) {
  return (
    <View style={{ backgroundColor: "rgba(255,123,123,0.10)", borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(255,123,123,0.42)", padding: space.lg, marginBottom: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm }}>
        <Ionicons name="warning-outline" size={16} color={theme.danger} />
        <Text style={{ color: theme.danger, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>This update couldn't convert your data</Text>
      </View>
      <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 18 }}>
        Some of your saved data couldn't be upgraded, so parts of the app may look empty or wrong. Nothing has been deleted — a full copy from before the update is still on this device, and you can put it back.
      </Text>
      <Pressable
        onPress={onRestore}
        disabled={restoring}
        style={({ pressed }) => [{ marginTop: space.md, paddingVertical: space.md, borderRadius: radius.md, alignItems: "center", backgroundColor: "rgba(255,123,123,0.16)", borderWidth: 1, borderColor: "rgba(255,123,123,0.5)" }, pressed && { opacity: 0.75 }, restoring && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Restore the copy from before the update"
      >
        <Text style={{ color: theme.danger, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
          {restoring ? "Restoring…" : "Restore my data"}
        </Text>
      </Pressable>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.sm, lineHeight: 16 }}>
        Please don't reinstall the app before restoring — that would remove the backup too.
      </Text>
    </View>
  );
}
