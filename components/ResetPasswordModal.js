import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import { supabase } from "../lib/supabase";

// Shown when the app is opened from a password-reset email. By the time this
// appears Supabase has already exchanged the link for a recovery session, so
// updateUser() is all that's left — the user just picks the new password.
export function ResetPasswordModal({ visible, onDone, onCancel }) {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = (fn) => { setValue(""); setConfirm(""); setError(""); fn && fn(); };

  const submit = async () => {
    setError("");
    if (value.length < 8) { setError("Passwords need at least 8 characters."); return; }
    if (value !== confirm) { setError("Those passwords don't match."); return; }
    if (!supabase) { setError("Cloud accounts aren't set up yet."); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: value });
      if (err) { setError(err.message); return; }
      close(onDone);
    } catch (e) {
      setError("Something went wrong. Try the link again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(onCancel)}>
      <View style={{ flex: 1, backgroundColor: "rgba(3,12,20,0.88)", alignItems: "center", justifyContent: "center", padding: 22 }}>
        <View style={{ width: "100%", maxWidth: 420, backgroundColor: theme.cardSolid, borderRadius: 24, borderWidth: 1, borderColor: theme.border, padding: 22 }}>
          <Text style={styles.cardEyebrow}>🔒 Reset password</Text>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 }}>Set a new password</Text>
          <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontWeight: "700", lineHeight: 18, marginTop: 8 }}>
            Pick something at least 8 characters long. You'll stay signed in on this device afterwards.
          </Text>

          <TextInput
            value={value}
            onChangeText={(v) => { setValue(v); setError(""); }}
            secureTextEntry
            autoCapitalize="none"
            placeholder="New password"
            placeholderTextColor={theme.secondaryText}
            style={[styles.authInput, { marginTop: 16 }]}
            accessibilityLabel="New password"
          />
          <TextInput
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setError(""); }}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Confirm new password"
            placeholderTextColor={theme.secondaryText}
            style={[styles.authInput, { marginTop: 12 }]}
            accessibilityLabel="Confirm new password"
          />

          {error ? <Text style={styles.authError}>{error}</Text> : null}

          <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primaryBtn, { marginTop: 16 }, (pressed || busy) && { opacity: 0.8 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#04202a" /> : <Text style={styles.primaryBtnText}>Update password</Text>}
          </Pressable>
          <Pressable onPress={() => close(onCancel)} style={styles.authLinkBtn} accessibilityRole="button">
            <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
