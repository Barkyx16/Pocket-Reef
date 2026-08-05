import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { PARAMS } from "../core";

// A quick target-range cheat sheet for the tank's water type — every parameter's
// ideal band and a one-line why, so you don't have to remember the numbers.
export function ParamReferenceCard({ waterType = "fresh" }) {
  const params = PARAMS[waterType] || PARAMS.fresh;
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.cardText}>Ideal ranges for a {waterType === "salt" ? "reef / saltwater" : "freshwater"} tank:</Text>
      {params.map((p) => (
        <View key={p.key} style={{ backgroundColor: theme.well, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: "900" }}>{p.label}</Text>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "900" }}>{p.ideal}</Text>
          </View>
          <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 4 }}>{p.tip}</Text>
        </View>
      ))}
    </View>
  );
}
