import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, theme } from "../styles";
import { supabase, isCloudConfigured } from "../lib/supabase";
import { AUTH_REDIRECT, RESET_REDIRECT } from "../lib/supabaseConfig";
import {
  isBiometricAvailable, getBiometricLabel, isBiometricEnabled,
  enableBiometricLogin, disableBiometricLogin, authenticateAndGetCredentials,
} from "../lib/biometricAuth";
import { tapHaptic } from "../core";

// The gate in front of the app: create an account or sign in, with Face ID /
// Touch ID for returning users, password reset, and a hint for "which email did
// I use?". Sign-in success is picked up by App's onAuthStateChange listener, so
// this screen never has to unmount itself.
//
// When lib/supabaseConfig.js has no credentials yet, cloud accounts don't exist
// and the screen offers a local-only path instead of trapping the user.

const LAST_EMAIL_KEY = "pr_lastEmail";

// a***@example.com — enough to recognize, not enough to leak in a screenshot.
function maskEmail(value = "") {
  const [name, domain] = String(value).split("@");
  if (!name || !domain) return value;
  const head = name.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, name.length - 1))}@${domain}`;
}

export function AuthScreen({ onContinueOffline }) {
  const configured = isCloudConfigured();

  const [mode, setMode] = useState("signup"); // signup | login | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Face ID");
  const [lastEmail, setLastEmail] = useState("");
  const [showEmailHint, setShowEmailHint] = useState(false);

  // Biometric capability + whether the user already opted in on this device.
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
      const saved = await AsyncStorage.getItem(LAST_EMAIL_KEY).catch(() => null);
      if (alive && saved) {
        setLastEmail(saved);
        // A returning device starts on Log in, prefilled.
        setEmail(saved);
        setMode("login");
      }
    })();
    return () => { alive = false; };
  }, []);

  const clearMessages = () => { setError(""); setNotice(""); };

  const validate = () => {
    const clean = email.trim();
    if (!clean || !clean.includes("@")) return "Enter the email address for your account.";
    if (mode === "forgot") return "";
    if (password.length < 8) return "Passwords need at least 8 characters.";
    if (mode === "signup" && password !== confirm) return "Those passwords don't match.";
    return "";
  };

  // After a successful password login, offer to turn on Face ID for next time.
  const offerBiometric = (loginEmail, loginPassword) => {
    if (!bioAvailable || bioEnabled) return;
    Alert.alert(
      `Use ${bioLabel} next time?`,
      `Sign in to Pocket Reef with ${bioLabel} instead of typing your password. Your credentials stay in this device's secure keychain.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: `Enable ${bioLabel}`,
          onPress: async () => {
            const ok = await enableBiometricLogin(loginEmail, loginPassword);
            if (ok) setBioEnabled(true);
          },
        },
      ]
    );
  };

  const submit = async () => {
    clearMessages();
    const problem = validate();
    if (problem) { setError(problem); return; }
    if (!supabase) { setError("Cloud accounts aren't set up yet."); return; }

    const clean = email.trim().toLowerCase();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: RESET_REDIRECT });
        if (err) { setError(err.message); return; }
        setNotice(`Reset link sent to ${clean}. Open it on this device and you'll be able to set a new password.`);
        return;
      }

      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: clean,
          password,
          options: { emailRedirectTo: AUTH_REDIRECT },
        });
        if (err) { setError(err.message); return; }
        await AsyncStorage.setItem(LAST_EMAIL_KEY, clean).catch(() => {});
        setNotice(`Check ${clean} for a confirmation link, then come back and log in.`);
        setMode("login");
        return;
      }

      const { error: err } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (err) { setError(err.message); return; }
      await AsyncStorage.setItem(LAST_EMAIL_KEY, clean).catch(() => {});
      tapHaptic("medium");
      offerBiometric(clean, password);
      // App's auth listener swaps this screen out for the reef.
    } catch (e) {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Sign in with the credentials held in the keychain, unlocked by Face ID.
  const biometricLogin = async () => {
    clearMessages();
    if (!supabase) return;
    const creds = await authenticateAndGetCredentials(`Sign in to Pocket Reef with ${bioLabel}`);
    if (!creds) return;
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
      if (err) {
        // The stored password no longer works (changed elsewhere) — drop it so
        // the user falls back to typing rather than hitting the same wall.
        await disableBiometricLogin();
        setBioEnabled(false);
        setEmail(creds.email);
        setError(`${bioLabel} sign-in failed — your password may have changed. Enter it once to re-enable it.`);
        return;
      }
      tapHaptic("medium");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    clearMessages();
    const clean = email.trim().toLowerCase();
    if (!clean || !supabase) { setError("Enter your email address first."); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: clean,
        options: { emailRedirectTo: AUTH_REDIRECT },
      });
      if (err) { setError(err.message); return; }
      setNotice(`Confirmation email sent again to ${clean}.`);
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "signup" ? "Create your\nreef account"
    : mode === "forgot" ? "Reset your\npassword"
      : "Welcome back,\nreef keeper";
  const sub = mode === "signup" ? "Your tanks, logs, and progress save to your account and follow you to any device."
    : mode === "forgot" ? "We'll email you a link to set a new password."
      : "Log in to pick up right where you left off.";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={{ alignItems: "center", marginBottom: 26 }}>
          <View style={{ width: 74, height: 74, borderRadius: 24, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.35)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 38 }}>🐠</Text>
          </View>
          <Text style={[styles.heroEyebrow, { marginTop: 16 }]}>Pocket Reef</Text>
          <Text style={[styles.heroTitle, { textAlign: "center", fontSize: 29, marginTop: 8 }]}>{heading}</Text>
          <Text style={[styles.heroSub, { textAlign: "center", maxWidth: 330 }]}>{sub}</Text>
        </View>

        {/* Local-only mode — the backend hasn't been pointed at a project yet. */}
        {!configured ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Cloud accounts not set up</Text>
            <Text style={styles.cardText}>
              Paste your Supabase project URL and anon key into lib/supabaseConfig.js to turn on accounts and cross-device sync. Until then Pocket Reef runs on this device, and nothing is lost — your data is here waiting when you connect it.
            </Text>
            <Pressable onPress={() => { tapHaptic(); onContinueOffline && onContinueOffline(); }} style={[styles.primaryBtn, { marginTop: 16 }]} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>Continue on this device</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); clearMessages(); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={theme.secondaryText}
              style={styles.authInput}
              editable={!busy}
              accessibilityLabel="Email address"
            />

            {mode !== "forgot" ? (
              <View style={{ position: "relative", justifyContent: "center", marginTop: 12 }}>
                <TextInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearMessages(); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="Password"
                  placeholderTextColor={theme.secondaryText}
                  style={[styles.authInput, { paddingRight: 52 }]}
                  editable={!busy}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={theme.secondaryText} />
                </Pressable>
              </View>
            ) : null}

            {mode === "signup" ? (
              <TextInput
                value={confirm}
                onChangeText={(v) => { setConfirm(v); clearMessages(); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder="Confirm password"
                placeholderTextColor={theme.secondaryText}
                style={[styles.authInput, { marginTop: 12 }]}
                editable={!busy}
                accessibilityLabel="Confirm password"
              />
            ) : null}

            {mode === "signup" ? (
              <Text style={{ color: theme.secondaryText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 10 }}>
                At least 8 characters. You'll get a confirmation email before your first login.
              </Text>
            ) : null}

            {error ? <Text style={styles.authError}>{error}</Text> : null}
            {notice ? <Text style={styles.authNotice}>{notice}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.primaryBtn, { marginTop: 16 }, (pressed || busy) && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#04202a" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Log in"}
                </Text>
              )}
            </Pressable>

            {/* Face ID / Touch ID — only once credentials are stored on this device. */}
            {mode === "login" && bioAvailable && bioEnabled ? (
              <Pressable
                onPress={biometricLogin}
                disabled={busy}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, borderRadius: 16, paddingVertical: 15, backgroundColor: "rgba(56,225,198,0.10)", borderWidth: 1, borderColor: "rgba(56,225,198,0.42)" }, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={`Sign in with ${bioLabel}`}
              >
                <Ionicons name={bioLabel === "Touch ID" ? "finger-print" : "scan-outline"} size={20} color={theme.accent} />
                <Text style={{ color: theme.accent, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" }}>Sign in with {bioLabel}</Text>
              </Pressable>
            ) : null}

            {/* Mode switching + recovery links */}
            {mode === "forgot" ? (
              <Pressable style={styles.authLinkBtn} onPress={() => { setMode("login"); clearMessages(); }} accessibilityRole="button">
                <Text style={styles.authLinkText}>‹ Back to log in</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.authLinkBtn} onPress={() => { setMode(mode === "signup" ? "login" : "signup"); clearMessages(); }} accessibilityRole="button">
                  <Text style={styles.authLinkText}>
                    {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
                  </Text>
                </Pressable>

                {mode === "login" ? (
                  <>
                    <Pressable style={styles.authLinkBtn} onPress={() => { setMode("forgot"); clearMessages(); }} accessibilityRole="button">
                      <Text style={styles.authLinkText}>Forgot password?</Text>
                    </Pressable>
                    <Pressable style={styles.authLinkBtn} onPress={() => { setShowEmailHint((v) => !v); clearMessages(); }} accessibilityRole="button">
                      <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>Forgot which email you used?</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            )}

            {/* "Forgot email" help — we can't look an account up by anything but
                the address, so this points at what the device does remember. */}
            {showEmailHint ? (
              <View style={{ backgroundColor: theme.well, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, marginTop: 4 }}>
                <Text style={{ color: theme.text, fontSize: 13, fontFamily: "Inter_900Black", fontWeight: "900" }}>Finding your account</Text>
                {lastEmail ? (
                  <Pressable onPress={() => { setEmail(lastEmail); setShowEmailHint(false); tapHaptic(); }} style={{ marginTop: 8 }} accessibilityRole="button">
                    <Text style={{ color: theme.accent, fontSize: 13, fontFamily: "Inter_800ExtraBold", fontWeight: "800" }}>
                      Last used on this device: {maskEmail(lastEmail)} — tap to use it
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 6 }}>
                    No account has signed in on this device yet.
                  </Text>
                )}
                <Text style={{ color: theme.secondaryText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 8 }}>
                  Otherwise, search your inbox for “Pocket Reef” — the confirmation email went to the address you signed up with. If none of your addresses work, sign up again and your reef starts fresh.
                </Text>
                <Pressable onPress={resendConfirmation} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
                  <Text style={styles.ghostBtnText}>Resend confirmation email</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <Text style={{ color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", lineHeight: 17, marginTop: 4 }}>
          Your reef data is stored under your account and only readable by you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
