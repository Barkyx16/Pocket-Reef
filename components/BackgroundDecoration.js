import { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Full-screen app backdrop — the bundled reef photo (assets/background.png) with
// a darkening overlay and top/bottom scrims so the glass cards and text stay
// legible over it. Rendered once at the app root, behind every tab.
export const BackgroundDecoration = memo(function BackgroundDecoration() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {/* absoluteFill alone leaves the image at its intrinsic size in some
          renderers — it was drawing 853x1844 inside a 1280-wide root, so the
          photo under-covered horizontally and overflowed vertically. Explicit
          100% dimensions make resizeMode="cover" actually apply. */}
      <Image
        source={require("../assets/background.png")}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
      />

      {/* Darkening overlay keeps content readable over the photo. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6, 20, 32, 0.66)" }]} />

      {/* Top scrim — status bar + hero legibility. */}
      <LinearGradient
        colors={["rgba(4,16,27,0.7)", "rgba(4,16,27,0)"]}
        locations={[0, 0.18]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bottom scrim — settles content behind the floating tab bar. */}
      <LinearGradient
        colors={["rgba(4,16,27,0)", "rgba(4,16,27,0.6)"]}
        locations={[0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});
