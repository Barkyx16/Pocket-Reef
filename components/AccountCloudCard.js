import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
import { supabase, isCloudConfigured } from "../lib/supabase";
import { RESET_REDIRECT } from "../lib/supabaseConfig";
import {
  isBiometricAvailable, getBiometricLabel, isBiometricEnabled, disableBiometricLogin, enableBiometricLogin,
} from "../lib/biometricAuth";
import { tapHaptic } from "../core";

// Cloud save / account card — the reef version of Pocket Planter's
// AccountCloudCard, wired to a real account: sync status from the last
// successful cloud save, the signed-in email, a stats grid, change email,
// password reset, Face ID management, sign out, and account deletion.
// Export/Restore stays alongside it as the offline escape hatch.
export function AccountCloudCard({
  user, lastSyncedAt, syncing, syncError, onSyncNow,
  profileName, onChangeName, premiumUnlocked, tanks = [], since, lastBackup,
  onExport, onImport, onOpenPremium, onSignOut,
}) {
  const configured = isCloudConfigured();
  const totalSpecies = tanks.reduce((s, t) => s + (t.stock ? t.stock.length : 0), 0);
  const totalTests = tanks.reduce((s, t) => s + (t.waterTests ? t.waterTests.length : 0), 0);
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : since;
  const memberSince = createdAt ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—";

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Face ID");

  useEffect(() => {
    let alive = true;
    (async () => {
      const available = await isBiometricAvailable();
      if (!alive) return;
      setBioAvailable(available);
      if (available) {
        setBioLabel(await getBiometricLabel());
        setBioEnabled(await isBiometricEnabled());
      }
    })();
    return () => { alive = false; };
  }, []);

  // Relative label from the real timestamp of the last successful cloud save —
  // computed at render, which is accurate enough for a settings card.
  const relative = (ms) => {
    if (!ms) return null;
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const syncLabel = relative(lastSyncedAt);
  const backupLabel = relative(lastBackup) || "never";

  const changeEmail = async () => {
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) { Alert.alert("Enter a new email address first."); return; }
    if (!supabase) return;
    setBusy("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: clean });
      if (error) { Alert.alert("Couldn't change your email", error.message); return; }
      Alert.alert("Confirm the change", `We sent a confirmation link to ${clean}. Your email updates once you open it.`);
      setNewEmail("");
    } catch (e) {
      Alert.alert("Something went wrong", "Check your connection and try again.");
    } finally {
      setBusy("");
    }
  };

  // Set a new password directly — the user is already signed in, so this needs no
  // email round-trip. If Face ID is on, the stored credential is re-saved with the
  // new password so biometric sign-in doesn't silently break.
  const changePassword = async () => {
    if (newPassword.length < 8) { Alert.alert("Password too short", "Use at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Passwords don't match", "Type the same password in both fields."); return; }
    if (!supabase) return;
    setBusy("changePassword");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { Alert.alert("Couldn't change your password", error.message); return; }
      if (bioEnabled && user?.email) await enableBiometricLogin(user.email, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      tapHaptic("medium");
      Alert.alert("Password updated", bioEnabled ? `Your new password is saved, and ${bioLabel} keeps working.` : "Use your new password next time you log in.");
    } catch (e) {
      Alert.alert("Something went wrong", "Check your connection and try again.");
    } finally {
      setBusy("");
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email || !supabase) { Alert.alert("No email on this account."); return; }
    setBusy("password");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: RESET_REDIRECT });
      if (error) { Alert.alert("Couldn't send the reset email", error.message); return; }
      Alert.alert("Check your inbox", `A password reset link is on its way to ${user.email}.`);
    } finally {
      setBusy("");
    }
  };

  const toggleBiometric = async () => {
    if (!bioEnabled) {
      // Turning it on stores the password, which we only have at sign-in time.
      Alert.alert(
        `Turn on ${bioLabel}`,
        `Sign out and log back in with your password — you'll be offered ${bioLabel} right after.`
      );
      return;
    }
    await disableBiometricLogin();
    setBioEnabled(false);
    tapHaptic();
  };

  const signOut = () => {
    Alert.alert(
      "Log out",
      "Your reef stays saved to your account. You'll need your password (or Face ID) to get back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            if (supabase) await supabase.auth.signOut();
            onSignOut && onSignOut();
          },
        },
      ]
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete your account",
      "This permanently deletes your account and every tank, log, and photo saved to it. This can't be undone — export a backup first if you want a copy.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: async () => {
            if (!supabase) return;
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (!token) { Alert.alert("Session expired", "Log out and back in, then try again."); return; }
              // Deleting an auth user needs the service_role key, so it lives in
              // a Supabase Edge Function (see supabase/README.md) rather than here.
              const { error } = await supabase.functions.invoke("delete-account", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (error) { Alert.alert("Deletion failed", "We couldn't delete the account right now. Try again, or contact support."); return; }
              await supabase.auth.signOut();
              onSignOut && onSignOut();
              Alert.alert("Account deleted", "Your Pocket Reef account and its data are gone.");
            } catch (e) {
              Alert.alert("Deletion failed", "We couldn't reach the server. Try again in a moment.");
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      {/* Cloud status — honest about what actually happened on the last save. */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1,
        backgroundColor: syncError ? "rgba(255,211,114,0.10)" : "rgba(56,225,198,0.10)",
        borderColor: syncError ? "rgba(255,211,114,0.35)" : "rgba(56,225,198,0.3)",
      }}>
        <Text style={{ fontSize: 24 }}>{syncError ? "⚠️" : lastSyncedAt ? "☁️" : "🔄"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {syncError ? "Not syncing right now" : lastSyncedAt ? "Your reef is backed up" : configured ? "Backing up your reef…" : "Saved on this device"}
          </Text>
          <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16, marginTop: 2 }}>
            {syncError
              ? "Changes are saved on this device and will retry automatically."
              : lastSyncedAt
                ? `Synced ${syncLabel} — restored automatically when you sign in on another device.`
                : configured
                  ? "Your progress saves to your account as you go."
                  : "Cloud accounts aren't configured yet — Export keeps a copy you can restore anywhere."}
          </Text>
        </View>
        {syncing ? <ActivityIndicator color={theme.accent} /> : lastSyncedAt && !syncError ? <Text style={{ color: theme.accent, fontSize: 18, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓</Text> : null}
      </View>

      {configured && onSyncNow ? (
        <Pressable onPress={() => { tapHaptic(); onSyncNow(); }} style={[styles.ghostBtn, { marginBottom: 14 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>☁️ Sync now</Text>
        </Pressable>
      ) : null}

      {/* Signed-in identity */}
      <View style={styles.accountInfoBox}>
        <Text style={styles.accountInfoLabel}>Account email</Text>
        <Text style={styles.accountInfoValue}>{user?.email || "Not signed in"}</Text>
      </View>

      {/* Reef keeper name */}
      <View style={styles.accountInfoBox}>
        <Text style={styles.accountInfoLabel}>Reef keeper</Text>
        <TextInput
          value={profileName}
          onChangeText={onChangeName}
          placeholder="Your name"
          placeholderTextColor={theme.secondaryText}
          style={{ color: theme.text, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", paddingVertical: 2, marginTop: 4 }}
          accessibilityLabel="Reef keeper name"
        />
      </View>

      {/* Premium status — reads straight off premiumUnlocked, so it flips to
          Active the moment a purchase (or restore) lands, and back on expiry.
          Tapping it opens the Premium tab either way. */}
      <Pressable
        onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }}
        style={({ pressed }) => [
          styles.accountInfoBox,
          { flexDirection: "row", alignItems: "center", gap: 12, borderColor: premiumUnlocked ? "rgba(56,225,198,0.35)" : "rgba(255,216,107,0.35)" },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={premiumUnlocked ? "Premium active — open the Premium tab" : "Premium inactive — open the Premium tab"}
      >
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: premiumUnlocked ? "rgba(56,225,198,0.14)" : "rgba(255,216,107,0.14)", borderWidth: 1, borderColor: premiumUnlocked ? "rgba(56,225,198,0.3)" : "rgba(255,216,107,0.3)" }}>
          <Text style={{ fontSize: 20 }}>👑</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountInfoLabel}>Premium</Text>
          <Text style={{ color: premiumUnlocked ? theme.accent : "#ffd36f", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 3 }}>
            {premiumUnlocked ? "Active 👑" : "Inactive"}
          </Text>
          <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>
            {premiumUnlocked ? "Every feature unlocked — thank you!" : "Unlock the full reef toolkit."}
          </Text>
        </View>
        <Text style={{ color: theme.accent, fontSize: 20, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
      </Pressable>

      {/* Stats grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        <Stat value={tanks.length} label="Tanks" />
        <Stat value={totalSpecies} label="Species" />
        <Stat value={totalTests} label="Water tests" />
        <Stat value={memberSince} label="Member since" small />
      </View>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      {configured && user ? (
        <>
          <Text style={[styles.accountInfoLabel, { marginTop: 18, marginBottom: 8 }]}>Sign-in & security</Text>

          {bioAvailable ? (
            <Pressable onPress={toggleBiometric} style={[styles.accountInfoBox, { flexDirection: "row", alignItems: "center", gap: 12 }]} accessibilityRole="button" accessibilityState={{ checked: bioEnabled }}>
              <Text style={{ fontSize: 20 }}>{bioLabel === "Touch ID" ? "👆" : "🙂"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>{bioLabel} sign-in</Text>
                <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 2 }}>
                  {bioEnabled ? "On — tap to turn off and forget the saved credentials." : "Off — offered next time you log in with your password."}
                </Text>
              </View>
              <Text style={{ color: bioEnabled ? theme.accent : theme.secondaryText, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>{bioEnabled ? "ON" : "OFF"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.accountInfoBox}>
            <Text style={styles.accountInfoLabel}>Change email</Text>
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="New email address"
              placeholderTextColor={theme.secondaryText}
              style={[styles.authInput, { marginTop: 8 }]}
              accessibilityLabel="New email address"
            />
            <Pressable onPress={changeEmail} disabled={busy === "email"} style={[styles.ghostBtn, { marginTop: 10 }]} accessibilityRole="button">
              {busy === "email" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Send confirmation link</Text>}
            </Pressable>
          </View>

          <View style={styles.accountInfoBox}>
            <Text style={styles.accountInfoLabel}>Change password</Text>
            <View style={{ position: "relative", justifyContent: "center", marginTop: 8 }}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                placeholder="New password"
                placeholderTextColor={theme.secondaryText}
                style={[styles.authInput, { paddingRight: 64 }]}
                accessibilityLabel="New password"
              />
              <Pressable
                onPress={() => setShowNewPassword((v) => !v)}
                hitSlop={10}
                style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
                accessibilityRole="button"
                accessibilityLabel={showNewPassword ? "Hide password" : "Show password"}
              >
                <Text style={{ color: theme.accent, fontSize: 12, fontFamily: "Inter_900Black", fontWeight: "900" }}>{showNewPassword ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              placeholder="Confirm new password"
              placeholderTextColor={theme.secondaryText}
              style={[styles.authInput, { marginTop: 8 }]}
              accessibilityLabel="Confirm new password"
            />
            <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 8 }}>
              At least 8 characters.{bioEnabled ? ` ${bioLabel} updates automatically.` : ""}
            </Text>
            <Pressable
              onPress={changePassword}
              disabled={busy === "changePassword" || !newPassword || !confirmPassword}
              style={[styles.ghostBtn, { marginTop: 10 }, (!newPassword || !confirmPassword) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              {busy === "changePassword" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Update password</Text>}
            </Pressable>
          </View>

          {/* Fallback for a password you can't remember — goes through email. */}
          <Pressable onPress={sendPasswordReset} disabled={busy === "password"} style={styles.ghostBtn} accessibilityRole="button">
            {busy === "password" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>🔒 Email me a reset link instead</Text>}
          </Pressable>
        </>
      ) : null}

      {/* Backup actions — the local copy, independent of the account. */}
      <Text style={[styles.accountInfoLabel, { marginTop: 18, marginBottom: 8 }]}>Backup & restore</Text>
      <Text style={{ color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: 10 }}>Last export {backupLabel}.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => onExport && onExport()} style={[styles.primaryBtn, { flex: 1 }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>📤 Export</Text>
        </Pressable>
        <Pressable onPress={() => onImport && onImport()} style={[styles.ghostBtn, { flex: 1 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>📥 Restore</Text>
        </Pressable>
      </View>

      {/* ── Danger zone ──────────────────────────────────────────────────────── */}
      {configured && user ? (
        <>
          <Text style={[styles.accountInfoLabel, { marginTop: 18 }]}>Account</Text>
          <Pressable onPress={signOut} style={styles.accountSignOutBtn} accessibilityRole="button">
            <Text style={styles.accountSignOutText}>👋 Log out</Text>
          </Pressable>
          <Pressable onPress={deleteAccount} style={styles.accountDangerBtn} accessibilityRole="button">
            <Text style={styles.accountDangerText}>🗑 Delete account</Text>
          </Pressable>
          <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 15, marginTop: 8, textAlign: "center" }}>
            Logging out keeps everything in the cloud. Deleting removes your account and its data for good.
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Stat({ value, label, small }) {
  return (
    <View style={{ flexGrow: 1, minWidth: "45%", backgroundColor: theme.well, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: small ? 15 : 24, fontFamily: "Inter_900Black", fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: 3 }}>{label}</Text>
    </View>
  );
}
