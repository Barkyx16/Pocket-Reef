import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type, space } from "../styles";
import { tapHaptic } from "../core";
import { listCrashes, clearCrashes, formatCrashes, MAX_CRASHES } from "../lib/crashLog";

// The last few crashes, and a way to send them.
//
// Without this the only report anybody can make is "it crashed", which is not
// a report. Hidden entirely when nothing has gone wrong — a permanently
// visible crash log invites worry about an app that is working fine.
export function CrashLogCard() {
  const [crashes, setCrashes] = useState(null);
  const refresh = useCallback(() => { listCrashes().then(setCrashes).catch(() => setCrashes([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (!crashes || !crashes.length) return null;

  const share = () => {
    tapHaptic();
    Share.share({ message: formatCrashes(crashes) }).catch(() => {});
  };

  return (
    <View style={[styles.card, { borderColor: `${theme.warn}44` }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name="bug-outline" size={16} color={theme.warn} />
        <Text style={{ flex: 1, color: theme.warn, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
          {crashes.length === 1 ? "1 problem recorded" : `${crashes.length} problems recorded`}
        </Text>
      </View>

      <Text style={styles.cardText}>
        Something went wrong recently. Your tank data was never touched — these are notes about what failed, kept on this device only. Sending them is the difference between "it crashed" and a fix.
      </Text>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {crashes.slice(0, MAX_CRASHES).map((c) => (
          <View key={c.id} style={{ backgroundColor: theme.well, borderRadius: radius.sm, borderWidth: 1, borderColor: theme.border, padding: space.sm }}>
            <Text style={{ color: theme.text, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }} numberOfLines={2}>
              {c.message}
            </Text>
            <Text style={{ color: theme.secondaryText, fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.hair }}>
              {c.at.slice(0, 16).replace("T", " ")}{c.screen ? ` · ${c.screen}` : ""}
            </Text>
          </View>
        ))}
      </View>

      <Pressable onPress={share} style={[styles.primaryBtn, { marginTop: space.md }]} accessibilityRole="button" accessibilityLabel="Share the problem report">
        <Text style={styles.primaryBtnText}>Send the report</Text>
      </Pressable>
      <Pressable
        onPress={() => { tapHaptic("light"); clearCrashes().then(setCrashes).catch(() => {}); }}
        style={styles.authLinkBtn}
        accessibilityRole="button"
        accessibilityLabel="Clear the recorded problems"
      >
        <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Clear</Text>
      </Pressable>
    </View>
  );
}
