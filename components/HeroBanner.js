import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { FadeInView } from "./FadeInView";

// The big header at the top of each tab. A layered gradient with an accent glow,
// a large emoji watermark, and a bottom scrim so the title always reads clearly.
// `image` (optional) paints banner artwork over the gradient — the gradient stays
// underneath as the fallback, and every decorative layer is pointer-transparent
// so taps fall through to whatever the caller wraps around the banner.
export function HeroBanner({ eyebrow, title, subtitle, emoji, colors, image, children }) {
  return (
    <FadeInView style={styles.heroBanner}>
      <LinearGradient
        colors={colors || ["#0e3a52", "#0a2c42", "#082031"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      {image ? (
        <Image
          source={image}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
          resizeMode="cover"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      {/* Soft accent glow in the upper-right — dialed back over artwork. */}
      <View pointerEvents="none" style={{ position: "absolute", right: -60, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: image ? "rgba(56,225,198,0.10)" : "rgba(56,225,198,0.20)" }} />
      {emoji ? (
        <Text pointerEvents="none" style={{ position: "absolute", right: -4, top: -14, fontSize: 124, opacity: image ? 0.1 : 0.16 }}>{emoji}</Text>
      ) : null}
      {/* Bottom scrim keeps the title legible over artwork/watermark. */}
      <LinearGradient
        colors={image ? ["rgba(6,20,32,0)", "rgba(6,20,32,0.82)"] : ["rgba(6,20,32,0)", "rgba(6,20,32,0.55)"]}
        locations={image ? [0.25, 1] : [0.4, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: image ? "85%" : "70%" }}
        pointerEvents="none"
      />
      {eyebrow ? (
        <View style={styles.heroEyebrowPill}><Text style={styles.heroEyebrow}>{eyebrow}</Text></View>
      ) : null}
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
      {/* Optional extra content inside the banner (e.g. the profile level + XP bar). */}
      {children}
    </FadeInView>
  );
}
