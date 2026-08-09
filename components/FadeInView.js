import { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";

// A lightweight mount animation — fades and lifts its children into place. Used
// to give each tab's hero (and other entrances) a bit of polish. Native driver,
// so it stays smooth.
export function FadeInView({ children, delay = 0, distance = 10, duration = 380, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // The native driver keeps this off the JS thread on device, but there is no
    // native animated module on web — asking for it there logs a warning on
    // every single mount.
    Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: Platform.OS !== "web" }).start();
  }, [anim, duration, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
