import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { styles, theme, radius, type, space } from "../styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase, isCloudConfigured } from "../lib/supabase";
import { RESET_REDIRECT } from "../lib/supabaseConfig";
import {
  isBiometricAvailable, getBiometricLabel, isBiometricEnabled, disableBiometricLogin, enableBiometricLogin, updateStoredEmail } from "../lib/biometricAuth";
import { tapHaptic } from "../core";
import { TEXT_LIMITS } from "../lib/textLimits";
import { friendlyAuthError } from "../lib/authErrors";
import { MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

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
      if (error) { Alert.alert("Couldn't change your email", friendlyAuthError(error.message)); return; }
      // Repointed now rather than on confirmation: the link is opened in a
      // browser and the app may never see the moment it lands. Keeping the
      // password against the new address is the recoverable side of the
      // choice — the alternative is Face ID silently submitting an address
      // that no longer exists.
      if (bioEnabled) await updateStoredEmail(clean);
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
      if (error) { Alert.alert("Couldn't change your password", friendlyAuthError(error.message)); return; }
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
      if (error) { Alert.alert("Couldn't send the reset email", friendlyAuthError(error.message)); return; }
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
    const cleared = await disableBiometricLogin();
    setBioEnabled(false);
    if (!cleared) {
      Alert.alert(
        "Turned off, but not fully cleared",
        "Biometric sign-in is off. The saved password couldn't be removed from this device's keychain — restart the app and turn it off again to clear it."
      );
      return;
    }
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
              // The credentials live in the device keychain, not in the
              // account, so deleting the account leaves them behind. Saying
              // "your account and its data are gone" while the password is
              // still on the phone is not true.
              await disableBiometricLogin();
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
        flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.xl, padding: space.lg, marginBottom: space.lg, borderWidth: 1,
        backgroundColor: syncError ? "rgba(255,211,114,0.10)" : "rgba(56,225,198,0.10)",
        borderColor: syncError ? "rgba(255,211,114,0.35)" : "rgba(56,225,198,0.30)",
      }}>
        <Ionicons name={syncError ? "warning" : lastSyncedAt ? "cloud-done" : "phone-portrait-outline"} size={20} color={syncError ? theme.warn : theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>
            {syncError ? "Not syncing right now" : lastSyncedAt ? "Your reef is backed up" : configured ? "Backing up your reef…" : "Saved on this device"}
          </Text>
          <Text style={{ color: theme.bodyText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 16, marginTop: space.hair }}>
            {syncError
              ? "Changes are saved on this device and will retry automatically."
              : lastSyncedAt
                ? `Synced ${syncLabel} — restored automatically when you sign in on another device.`
                : configured
                  ? "Your progress saves to your account as you go."
                  : "Cloud accounts aren't configured yet — Export keeps a copy you can restore anywhere."}
          </Text>
        </View>
        {syncing ? <ActivityIndicator color={theme.accent} /> : lastSyncedAt && !syncError ? <Text style={{ color: theme.accent, fontSize: type.title, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900" }}>✓</Text> : null}
      </View>

      {configured && onSyncNow ? (
        <Pressable onPress={() => { tapHaptic(); onSyncNow(); }} style={[styles.ghostBtn, { marginBottom: space.lg }]} accessibilityRole="button" accessibilityLabel="Sync now">
          <Text style={styles.ghostBtnText}>Sync now</Text>
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
          style={{ color: theme.text, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", paddingVertical: space.hair, marginTop: space.xs }}
          accessibilityLabel="Reef keeper name"
        
            maxLength={TEXT_LIMITS.name}
          />
      </View>

      {/* Premium status — reads straight off premiumUnlocked, so it flips to
          Active the moment a purchase (or restore) lands, and back on expiry.
          Tapping it opens the Premium tab either way. */}
      <Pressable
        onPress={() => { tapHaptic(); onOpenPremium && onOpenPremium(); }}
        style={({ pressed }) => [
          styles.accountInfoBox,
          { flexDirection: "row", alignItems: "center", gap: space.md, borderColor: premiumUnlocked ? "rgba(56,225,198,0.30)" : "rgba(255,216,107,0.35)" },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={premiumUnlocked ? "Premium active — open the Premium tab" : "Premium inactive — open the Premium tab"}
      >
        <View style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: premiumUnlocked ? "rgba(56,225,198,0.14)" : "rgba(255,216,107,0.14)", borderWidth: 1, borderColor: premiumUnlocked ? "rgba(56,225,198,0.30)" : "rgba(255,216,107,0.3)" }}>
          <Ionicons name="star" size={18} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_COMPACT} style={styles.accountInfoLabel}>Premium</Text>
          <Text style={{ color: premiumUnlocked ? theme.accent : "#ffd36f", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.xs }}>
            {premiumUnlocked ? "Active" : "Inactive"}
          </Text>
          <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.hair }}>
            {premiumUnlocked ? "Every feature unlocked — thank you!" : "Unlock the full reef toolkit."}
          </Text>
        </View>
        <Text style={{ color: theme.accent, fontSize: type.titleLg, letterSpacing: -0.2, fontFamily: "Inter_900Black", fontWeight: "900" }}>›</Text>
      </Pressable>

      {/* Stats grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs }}>
        <Stat value={tanks.length} label="Tanks" />
        <Stat value={totalSpecies} label="Species" />
        <Stat value={totalTests} label="Water tests" />
        <Stat value={memberSince} label="Member since" small />
      </View>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      {configured && user ? (
        <>
          <Text style={[styles.accountInfoLabel, { marginTop: space.xl, marginBottom: space.sm }]}>Sign-in & security</Text>

          {bioAvailable ? (
            <Pressable onPress={toggleBiometric} style={[styles.accountInfoBox, { flexDirection: "row", alignItems: "center", gap: space.md }]} accessibilityRole="button" accessibilityState={{ checked: bioEnabled }}>
              <Text style={{ fontSize: type.titleLg, letterSpacing: -0.2 }}>{bioLabel === "Touch ID" ? "👆" : "🙂"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{bioLabel} sign-in</Text>
                <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.hair }}>
                  {bioEnabled ? "On — tap to turn off and forget the saved credentials." : "Off — offered next time you log in with your password."}
                </Text>
              </View>
              <Text style={{ color: bioEnabled ? theme.accent : theme.secondaryText, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" }}>{bioEnabled ? "ON" : "OFF"}</Text>
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
              style={[styles.authInput, { marginTop: space.sm }]}
              accessibilityLabel="New email address"
            
            maxLength={TEXT_LIMITS.email}
          />
            <Pressable onPress={changeEmail} disabled={busy === "email"} style={[styles.ghostBtn, { marginTop: space.md }]} accessibilityRole="button" accessibilityLabel="Change the email address on this account">
              {busy === "email" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Send confirmation link</Text>}
            </Pressable>
          </View>

          <View style={styles.accountInfoBox}>
            <Text style={styles.accountInfoLabel}>Change password</Text>
            <View style={{ position: "relative", justifyContent: "center", marginTop: space.sm }}>
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
              
            maxLength={TEXT_LIMITS.password}
          />
              <Pressable
                onPress={() => setShowNewPassword((v) => !v)}
                hitSlop={10}
                style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
                accessibilityRole="button"
                accessibilityLabel={showNewPassword ? "Hide password" : "Show password"}
              >
                <Text style={{ color: theme.accent, fontSize: type.small, fontFamily: "Inter_900Black", fontWeight: "900" }}>{showNewPassword ? "HIDE" : "SHOW"}</Text>
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
              style={[styles.authInput, { marginTop: space.sm }]}
              accessibilityLabel="Confirm new password"
            
            maxLength={TEXT_LIMITS.password}
          />
            <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.sm }}>
              At least 8 characters.{bioEnabled ? ` ${bioLabel} updates automatically.` : ""}
            </Text>
            <Pressable
              onPress={changePassword}
              disabled={busy === "changePassword" || !newPassword || !confirmPassword}
              style={[styles.ghostBtn, { marginTop: space.md }, (!newPassword || !confirmPassword) && { opacity: 0.5 }]}
              accessibilityRole="button"
              // Named explicitly: while busy the Text is replaced by a spinner,
              // and a button whose only child is an ActivityIndicator announces
              // as an anonymous "button" — worst at exactly the moment the user
              // wants confirmation that their tap registered.
              accessibilityLabel={busy === "changePassword" ? "Updating password" : "Update password"}
              accessibilityState={{ busy: busy === "changePassword" }}
            >
              {busy === "changePassword" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Update password</Text>}
            </Pressable>
          </View>

          {/* Fallback for a password you can't remember — goes through email. */}
          <Pressable onPress={sendPasswordReset} disabled={busy === "password"} style={styles.ghostBtn} accessibilityRole="button" accessibilityLabel="Send a password reset email">
            {busy === "password" ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.ghostBtnText}>Email me a reset link instead</Text>}
          </Pressable>
        </>
      ) : null}

      {/* Backup actions — the local copy, independent of the account. */}
      <Text style={[styles.accountInfoLabel, { marginTop: space.xl, marginBottom: space.sm }]}>Backup & restore</Text>
      <Text style={{ color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: space.md }}>Last export {backupLabel}.</Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Pressable onPress={() => onExport && onExport()} style={[styles.primaryBtn, { flex: 1 }]} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Export</Text>
        </Pressable>
        <Pressable onPress={() => onImport && onImport()} style={[styles.ghostBtn, { flex: 1 }]} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Restore</Text>
        </Pressable>
      </View>

      {/* ── Danger zone ──────────────────────────────────────────────────────── */}
      {configured && user ? (
        <>
          <Text style={[styles.accountInfoLabel, { marginTop: space.xl }]}>Account</Text>
          <Pressable onPress={signOut} style={styles.accountSignOutBtn} accessibilityRole="button">
            <Text style={styles.accountSignOutText}>👋 Log out</Text>
          </Pressable>
          <Pressable onPress={deleteAccount} style={styles.accountDangerBtn} accessibilityRole="button">
            <Text style={styles.accountDangerText}>🗑 Delete account</Text>
          </Pressable>
          <Text style={{ color: theme.bodyText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 15, marginTop: space.sm, textAlign: "center" }}>
            Logging out keeps everything in the cloud. Deleting removes your account and its data for good.
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Stat({ value, label, small }) {
  return (
    <View style={{ flexGrow: 1, minWidth: "45%", backgroundColor: theme.well, borderRadius: radius.xl, padding: space.lg, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: small ? 15 : 24, fontFamily: "Inter_900Black", fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: theme.secondaryText, fontSize: type.caption, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", marginTop: space.xs }}>{label}</Text>
    </View>
  );
}
