import { Text, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import {  } from "../core";
import { displayParams } from "../lib/targets";

// A quick target-range cheat sheet for the tank's water type — every parameter's
// ideal band and a one-line why, so you don't have to remember the numbers.
export function ParamReferenceCard({ waterType = "fresh" }) {
  const params = displayParams(waterType);
  return (
    <View style={{ gap: space.md }}>
      <Text style={styles.cardText}>Ideal ranges for a {waterType === "salt" ? "reef / saltwater" : "freshwater"} tank:</Text>
      {params.map((p) => (
        <View key={p.key} style={{ backgroundColor: theme.well, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.label}</Text>
            <Text style={{ color: theme.accent, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{p.ideal}</Text>
          </View>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 17, marginTop: space.xs }}>{p.tip}</Text>
        </View>
      ))}
    </View>
  );
}
