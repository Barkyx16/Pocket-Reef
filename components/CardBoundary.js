import { Component } from "react";
import { Pressable, Text, View } from "react-native";
import { radius, type } from "../styles";

// A boundary around one card.
//
// ErrorBoundary sits at the root and catches everything, which is the right
// last resort and the wrong first one: a single card throwing takes down the
// entire tree, so a keeper whose four-year-old tank happens to break one
// analysis loses Home, the tabs and every other card with it. The app they
// trust with their records goes white.
//
// That risk grew with every engine added. Twenty-odd cards now do arithmetic
// over user data — a series with one point, a date the OS won't parse, a
// species removed from the catalog — and each of them is a place where one
// keeper's edge case becomes everybody-on-that-screen's blank page.
//
// So each card gets its own boundary. One card fails, that card says so, and
// the rest of the screen carries on. The failure is still visible (a silently
// missing card is worse than a broken one — nobody reports what they never
// saw), and it offers a retry, because most render crashes come from transient
// state and remounting fixes them.
//
// Dependency-free and styled inline for the same reason as ErrorBoundary:
// whatever broke might be in the design system.
// Colours here are inlined on purpose. This renders when something has already
// thrown, and what threw may be the design system itself — importing `theme` to
// draw the apology would risk the apology throwing too. Every other component
// uses the tokens; these two are the deliberate exception. (design-system colours are inlined)
export class CardBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      try { this.props.onError(error, info, this.props.name); } catch (e) {}
    }
  }

  retry = () => this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));

  render() {
    const { error } = this.state;
    const { name = "This card", children } = this.props;
    if (!error) return <View key={this.state.resetKey}>{children}</View>;

    return (
      <View
        style={{
          backgroundColor: "rgba(255,107,107,0.08)",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "rgba(255,107,107,0.28)",
          padding: 16,
          marginBottom: 14,
        }}
        accessibilityRole="alert"
        accessibilityLabel={`${name} couldn't be shown. The rest of the app is fine and your records are safe.`}
      >
        <Text style={{ color: "#ff6b6b", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
          {name} couldn't be shown
        </Text>
        {/* Said plainly and first: the thing people actually fear when a screen
            breaks is that the data behind it is gone. It isn't — nothing here
            writes, and the records are on disk untouched. */}
        <Text style={{ color: "#c9dced", fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 6 }}>
          Everything else on this screen still works, and your tank records are safe — this is a display problem, not a data one.
        </Text>
        <Pressable
          onPress={this.retry}
          style={{ alignSelf: "flex-start", marginTop: 12, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}
          accessibilityRole="button"
          accessibilityLabel={`Try showing ${name} again`}
        >
          <Text style={{ color: "#38e1c6", fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
