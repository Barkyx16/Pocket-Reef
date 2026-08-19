import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme, radius, type } from "../styles";
import { tapHaptic, successHaptic } from "../core";
import { importWaterTests } from "../lib/csvImport";
import { TEXT_LIMITS } from "../lib/textLimits";

// Bringing years of readings in from a spreadsheet.
//
// Nothing is written until the report has been read and the button pressed —
// importing somebody's entire history on a tap, with no preview of what was
// understood and what was skipped, is not a thing to do quietly.
export function CsvImportCard({ waterType = "fresh", existing = [], onImport }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(null);

  const report = useMemo(
    () => (text.trim() ? importWaterTests(text, { waterType, existing }) : null),
    [text, waterType, existing]
  );

  const apply = () => {
    if (!report || !report.ok) return;
    tapHaptic("medium");
    onImport && onImport(report.entries);
    successHaptic();
    setDone(report.entries.length);
    setText("");
  };

  if (done != null) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 12 }}>
        <Ionicons name="checkmark-circle" size={30} color={theme.accent} />
        <Text style={{ color: "#fff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 8 }}>
          {done} reading{done === 1 ? "" : "s"} imported
        </Text>
        <Text style={[styles.cardText, { textAlign: "center" }]}>
          Your trends, forecasts and stability grades now run on the whole history.
        </Text>
        <Pressable onPress={() => setDone(null)} style={[styles.ghostBtn, { marginTop: 12, alignSelf: "stretch" }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Import more</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.cardText}>
        Paste a CSV from a spreadsheet or another app. It needs a header row with a <Text style={{ color: theme.text, fontFamily: "Inter_900Black", fontWeight: "900" }}>Date</Text> column and a column per parameter — names like "NO3", "Nitrate (ppm)" and "Ammonia" are all understood.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={"Date,Nitrate,pH,Ammonia\n2024-03-01,10,7.4,0"}
        placeholderTextColor={theme.secondaryText}
        accessibilityLabel="Paste your CSV here"
        style={[styles.authInput, { minHeight: 110, marginTop: 12, textAlignVertical: "top", fontFamily: "Inter_400Regular" }]}
      
            maxLength={TEXT_LIMITS.note}
          />

      {report ? (
        <View style={{ marginTop: 12, backgroundColor: theme.well, borderRadius: radius.lg, borderWidth: 1, borderColor: report.ok ? "rgba(56,225,198,0.35)" : `${theme.warn}44`, padding: 12 }}>
          <Text style={{ color: report.ok ? theme.accent : theme.warn, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {report.ok ? report.summary : "Can't read that yet"}
          </Text>
          {!report.ok ? (
            <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 5 }}>{report.reason}</Text>
          ) : null}

          {report.ok ? (
            <>
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 6 }}>
                Columns understood: {report.matched.join(", ")}
              </Text>
              {report.unmatched.length ? (
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 3 }}>
                  Ignored: {report.unmatched.join(", ")}
                </Text>
              ) : null}
              <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 3 }}>
                {report.entries[report.entries.length - 1].date} to {report.entries[0].date}
              </Text>
            </>
          ) : null}

          {/* Skipped rows are listed, not summarised away — a silent drop is how
              somebody discovers a hole in their history two years later. */}
          {report.skipped && report.skipped.length ? (
            <View style={{ marginTop: 8 }}>
              {report.skipped.slice(0, 4).map((s, i) => (
                <Text key={i} style={{ color: theme.warn, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600", lineHeight: 16 }}>
                  Line {s.line}: {s.reason}
                </Text>
              ))}
              {report.skipped.length > 4 ? (
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_600SemiBold", fontWeight: "600" }}>
                  …and {report.skipped.length - 4} more
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={apply}
        disabled={!report || !report.ok}
        style={[report && report.ok ? styles.primaryBtn : styles.ghostBtn, { marginTop: 12 }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !report || !report.ok }}
      >
        <Text style={report && report.ok ? styles.primaryBtnText : styles.ghostBtnText}>
          {report && report.ok ? `Import ${report.entries.length} reading${report.entries.length === 1 ? "" : "s"}` : "Paste a CSV to preview it"}
        </Text>
      </Pressable>
    </View>
  );
}
