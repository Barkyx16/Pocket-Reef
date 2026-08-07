import { Text, View } from "react-native";
import { styles, theme } from "../styles";
import { Pill } from "./Pill";

// Care reminder preferences. Stores the schedule now; actual notification
// scheduling wires up with expo-notifications in an EAS dev build (Expo Go's
// notification support is limited). Keeping prefs here means the native layer
// just reads them and schedules.
const FREQ = [
  { id: "off", label: "Off" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 wks" },
];

function Row({ label, value, onChange }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {FREQ.map((f) => (
          <Pill key={f.id} fill label={f.label} active={value === f.id} onPress={() => onChange(f.id)} />
        ))}
      </View>
    </View>
  );
}

export function RemindersCard({ prefs, onChange }) {
  const p = prefs || {};
  const set = (key, val) => onChange({ ...p, [key]: val });
  return (
    <View>
      <Text style={styles.cardText}>Set your care schedule. Reminders arrive as notifications once you build the app to your device.</Text>
      <View style={{ marginTop: 14 }}>
        <Row label="Test water" value={p.waterTest || "weekly"} onChange={(v) => set("waterTest", v)} />
        <Row label="Water change" value={p.waterChange || "weekly"} onChange={(v) => set("waterChange", v)} />
        <Row label="Feeding check-in" value={p.feeding || "off"} onChange={(v) => set("feeding", v)} />
      </View>
    </View>
  );
}
