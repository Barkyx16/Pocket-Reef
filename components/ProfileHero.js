import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, theme } from "../styles";
import { FadeInView } from "./FadeInView";
import { ProgressBar } from "./ProgressBar";

// The Profile header. Unlike HeroBanner (art as a background with text on top),
// this shows the worn banner *uncropped* in its own frame — the banner art is a
// finished title card, so nothing is printed over it — and puts the name, level
// and XP in a solid panel directly underneath.
//
// The frame takes its aspect ratio from the asset itself (banners run anywhere
// from 21:9 to 16:9), so "contain" never letterboxes in practice; the gradient
// behind it only shows through if a future banner has an odd ratio.
export function ProfileHero({ image, bannerName, bannerColors, profileName, lvl, xp, streak, longestStreak }) {
  const src = image ? Image.resolveAssetSource(image) : null;
  const ratio = src && src.width && src.height ? src.width / src.height : 16 / 9;

  return (
    <FadeInView style={styles.profileHero}>
      {/* ART — full bleed across the card, uncropped, no text over it. */}
      <View style={{ width: "100%", aspectRatio: ratio, backgroundColor: (bannerColors && bannerColors[0]) || "#0a2c42" }}>
        {image ? (
          <Image
            source={image}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <LinearGradient
            colors={bannerColors || ["#0e3a52", "#0a2c42", "#082031"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "100%", height: "100%" }}
            pointerEvents="none"
          />
        )}
      </View>

      {/* PANEL — solid, so every line reads at full contrast regardless of art. */}
      <View style={styles.profileHeroPanel}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={styles.profileHeroName} numberOfLines={1}>
            {profileName ? `Hi, ${profileName}` : "Your profile"}
          </Text>
          <View style={styles.profileHeroBannerPill}>
            <Text style={styles.profileHeroBannerPillText} numberOfLines={1}>{bannerName}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
          <View style={styles.profileHeroLevelBadge}>
            <Text style={{ color: theme.accentLight, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.5 }}>LEVEL</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{lvl.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>{lvl.title}</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontWeight: "800", marginTop: 2 }}>
              {xp.toLocaleString()} XP total · 🔥 {streak}-day streak{longestStreak > streak ? ` · best ${longestStreak}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}><ProgressBar pct={lvl.pct} height={9} glow /></View>
        <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontWeight: "800", marginTop: 6 }}>
          {lvl.maxed ? "Max level — you're a Reef Legend! 🐠" : `${lvl.toNext.toLocaleString()} XP to Level ${lvl.nextLevel}`}
        </Text>
      </View>
    </FadeInView>
  );
}
