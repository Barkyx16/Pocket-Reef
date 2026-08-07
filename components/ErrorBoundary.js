import { Component } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../styles";

// ─────────────────────────────────────────────────────────────────────────────
// The last line of defence.
//
// A single thrown error in any render — a species with an unexpected shape, a
// journal entry missing a field, a division by an empty array — takes the whole
// React tree down and leaves a white screen. To the user that's not "a bug",
// it's "the app that has my tank records is gone".
//
// This catches it and does the two things that actually matter:
//   1. Says the data is safe, because it is — everything lives in AsyncStorage
//      and nothing here touched it.
//   2. Offers a way out that isn't "delete and reinstall", which is exactly
//      what a panicking user does next and the one action that loses data.
//
// Deliberately dependency-free and styled inline: whatever broke may be in the
// design system, so this must render without it.
// ─────────────────────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Hand off to whatever reporting the app has, without assuming any exists.
    if (this.props.onError) {
      try { this.props.onError(error, info); } catch (e) {}
    }
  }

  // Remounts the subtree. Most render crashes are triggered by one screen's
  // state, so landing back on a fresh tree usually works — and costs nothing
  // to try before suggesting anything drastic.
  retry = () => {
    this.setState((s) => ({ error: null, info: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    const { error } = this.state;
    if (!error) return <View key={this.state.resetKey} style={{ flex: 1 }}>{this.props.children}</View>;

    const detail = String((error && error.message) || error || "Unknown error");

    return (
      <View style={{ flex: 1, backgroundColor: "#061826" }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 46 }}>🐠</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 16, textAlign: "center" }}>
              Something went wrong
            </Text>
            {/* The most important sentence on this screen. */}
            <Text style={{ color: "#8fb3c7", fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 10, textAlign: "center", lineHeight: 21 }}>
              Your tanks, logs, and journal are safe on this device — nothing was lost.
              Try again, and if it keeps happening, reopening the app usually clears it.
            </Text>
          </View>

          <Pressable
            onPress={this.retry}
            style={({ pressed }) => [
              {
                marginTop: 28, borderRadius: 16, paddingVertical: 16, alignItems: "center",
                backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.45)",
              },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={{ color: "#38e1c6", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900" }}>Try again</Text>
          </Pressable>

          {this.props.onExport ? (
            <Pressable
              onPress={() => { try { this.props.onExport(); } catch (e) {} }}
              style={({ pressed }) => [{ marginTop: 12, paddingVertical: 12, alignItems: "center" }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Export a backup of my data"
            >
              <Text style={{ color: "#8fb3c7", fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>Export a backup first</Text>
            </Pressable>
          ) : null}

          {/* Shown so a user can tell us what happened, not to explain it. */}
          <View style={{ marginTop: 24, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ color: "#6f93a8", fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Details
            </Text>
            <Text style={{ color: "#8fb3c7", fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, lineHeight: 16 }} selectable>
              {detail}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }
}
