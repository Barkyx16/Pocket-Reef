import { useEffect, useRef, useState } from "react";
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
import { OtpCodeInput } from "../components/OtpCodeInput";
import { tapHaptic } from "../core";
import { TEXT_LIMITS } from "../lib/textLimits";

// The gate in front of the app: create an account or sign in, with Face ID /
// Touch ID for returning users, password reset, and a hint for "which email did
// I use?". Sign-in success is picked up by App's onAuthStateChange listener, so
// this screen never has to unmount itself.
//
// Both email checkpoints — confirming a new account and recovering a password —
// are done by typing the 6-digit code from the email into the app. The emails
// still carry a tappable link (App.js handles that deep link), but the code path
// is the one the UI teaches, because it survives the cases the link doesn't:
// opening the email on a desktop, a mail client that rewrites links, or a link
// that lands in a browser with no way back into the app.
//
// When lib/supabaseConfig.js has no credentials yet, cloud accounts don't exist
// and the screen offers a local-only path instead of trapping the user.

const LAST_EMAIL_KEY = "pr_lastEmail";
const RESEND_COOLDOWN = 45; // seconds — matches Supabase's default email rate limit

// a***@example.com — enough to recognize, not enough to leak in a screenshot.
function maskEmail(value = "") {
  const [name, domain] = String(value).split("@");
  if (!name || !domain) return value;
  const head = name.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, name.length - 1))}@${domain}`;
}

// Supabase surfaces these as raw API strings. Rewrite the handful users actually
// hit into something that tells them what to do next; pass anything else through
// rather than swallowing a real error behind a generic apology.
function friendlyAuthError(message = "") {
  const m = String(message).toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match an account. Check for typos, or reset your password.";
  if (m.includes("email not confirmed")) return "This account still needs to be verified.";
  if (m.includes("token has expired") || m.includes("expired")) return "That code has expired. Send a new one and try again.";
  if (m.includes("invalid") && m.includes("token")) return "That code isn't right. Check the email and re-enter it.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There's already an account with that email. Log in instead, or reset the password.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("weak password") || m.includes("password should be")) return "Pick a stronger password — at least 8 characters.";
  if (m.includes("network") || m.includes("fetch")) return "Couldn't reach the server. Check your connection and try again.";
  return message || "Something went wrong. Try again.";
}

// Does this account exist but sit unverified? Supabase says so in a few
// different phrasings depending on the endpoint.
function isUnconfirmedError(message = "") {
  const m = String(message).toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed");
}

export function AuthScreen({ onContinueOffline, onPasswordRecovered }) {
  const configured = isCloudConfigured();

  const [mode, setMode] = useState("signup"); // signup | login | forgot | verify
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Code-verification state. `verifyKind` decides which verifyOtp type is used
  // and what happens after: a signup code drops you into the app, a recovery
  // code hands off to the set-a-new-password sheet.
  const [code, setCode] = useState("");
  const [verifyKind, setVerifyKind] = useState("signup"); // signup | recovery
  const [pendingEmail, setPendingEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const returnMode = useRef("login"); // where "‹ Back" goes from the code screen

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

  // Tick the resend cooldown down. A chain of one-second timeouts rather than an
  // interval, so the timer stops on its own at zero with nothing left running.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const clearMessages = () => { setError(""); setNotice(""); };

  const validate = () => {
    const clean = email.trim();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "Enter the email address for your account.";
    if (mode === "forgot") return "";
    if (password.length < 8) return "Passwords need at least 8 characters.";
    if (mode === "signup" && password !== confirm) return "Those passwords don't match.";
    return "";
  };

  // Move to the code screen for `address`, remembering where to go back to.
  const startVerify = (address, kind, message) => {
    setPendingEmail(address);
    setVerifyKind(kind);
    setCode("");
    returnMode.current = kind === "recovery" ? "forgot" : mode === "verify" ? returnMode.current : mode;
    setMode("verify");
    setError("");
    setNotice(message || "");
    setCooldown(RESEND_COOLDOWN);
  };

  // After a successful password login, offer to turn on Face ID for next time.
  const offerBiometric = (loginEmail, loginPassword) => {
    if (!bioAvailable || bioEnabled || !loginPassword) return;
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
        if (err) { setError(friendlyAuthError(err.message)); return; }
        startVerify(clean, "recovery", `We sent a 6-digit code to ${clean}.`);
        return;
      }

      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: clean,
          password,
          options: { emailRedirectTo: AUTH_REDIRECT },
        });
        if (err) { setError(friendlyAuthError(err.message)); return; }
        await AsyncStorage.setItem(LAST_EMAIL_KEY, clean).catch(() => {});
        // With email confirmation switched off in the project, signUp returns a
        // live session and there is nothing to verify — don't send the user to a
        // code screen for a code that will never arrive.
        if (data?.session) {
          tapHaptic("medium");
          offerBiometric(clean, password);
          return;
        }
        startVerify(clean, "signup", `We sent a 6-digit code to ${clean}.`);
        return;
      }

      const { error: err } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (err) {
        // Signing in to an account that was never confirmed isn't a failure so
        // much as an unfinished signup — carry them straight to the code screen
        // with a fresh code already on its way.
        if (isUnconfirmedError(err.message)) {
          await supabase.auth.resend({ type: "signup", email: clean, options: { emailRedirectTo: AUTH_REDIRECT } }).catch(() => {});
          startVerify(clean, "signup", `This account still needs verifying. We sent a new code to ${clean}.`);
          return;
        }
        setError(friendlyAuthError(err.message));
        return;
      }
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

  // Trade the typed code for a session.
  const submitCode = async (typed) => {
    const token = String(typed ?? code).replace(/[^0-9]/g, "");
    clearMessages();
    if (token.length !== 6) { setError("Enter all six digits from the email."); return; }
    if (!supabase) { setError("Cloud accounts aren't set up yet."); return; }

    setBusy(true);
    try {
      let { error: err } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: verifyKind === "recovery" ? "recovery" : "signup",
      });
      // Projects created after the "signup"/"email" type split reject the older
      // name; retry once under the generic type before calling the code bad.
      if (err && verifyKind === "signup" && /type/i.test(err.message || "")) {
        ({ error: err } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: "email" }));
      }
      if (err) {
        setError(friendlyAuthError(err.message));
        setCode("");
        return;
      }

      await AsyncStorage.setItem(LAST_EMAIL_KEY, pendingEmail).catch(() => {});
      tapHaptic("medium");
      if (verifyKind === "recovery") {
        // The recovery code produces a normal session, so App would otherwise
        // drop them into the reef still holding the password they forgot. Ask
        // for the new one immediately.
        onPasswordRecovered && onPasswordRecovered();
        return;
      }
      offerBiometric(pendingEmail, password);
      // Session is live — App's auth listener takes it from here.
    } catch (e) {
      setError("Couldn't check that code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Send another code for whichever checkpoint we're sitting on.
  const resendCode = async () => {
    if (cooldown > 0 || busy || !supabase) return;
    clearMessages();
    setBusy(true);
    try {
      const { error: err } = verifyKind === "recovery"
        ? await supabase.auth.resetPasswordForEmail(pendingEmail, { redirectTo: RESET_REDIRECT })
        : await supabase.auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: AUTH_REDIRECT } });
      if (err) { setError(friendlyAuthError(err.message)); return; }
      setCode("");
      setNotice(`New code sent to ${pendingEmail}.`);
      setCooldown(RESEND_COOLDOWN);
      tapHaptic();
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
        // An unverified account isn't a bad keychain entry — keep the stored
        // credentials and send them through the code screen instead.
        if (isUnconfirmedError(err.message)) {
          await supabase.auth.resend({ type: "signup", email: creds.email, options: { emailRedirectTo: AUTH_REDIRECT } }).catch(() => {});
          setEmail(creds.email);
          setPassword(creds.password);
          startVerify(creds.email, "signup", `This account still needs verifying. We sent a code to ${creds.email}.`);
          return;
        }
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

  // From the "which email did I use?" panel — this one has no code screen to go
  // to, because the whole point is that the address might be wrong.
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
      if (err) { setError(friendlyAuthError(err.message)); return; }
      setShowEmailHint(false);
      startVerify(clean, "signup", `If that address has an unverified account, a code is on its way to ${clean}.`);
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "signup" ? "Create your\nreef account"
    : mode === "forgot" ? "Reset your\npassword"
      : mode === "verify" ? "Check your\nemail"
        : "Welcome back,\nreef keeper";
  const sub = mode === "signup" ? "Your tanks, logs, and progress save to your account and follow you to any device."
    : mode === "forgot" ? "We'll email you a 6-digit code, then you can set a new password."
      : mode === "verify" ? `Enter the 6-digit code we sent to ${pendingEmail}.`
        : "Log in to pick up right where you left off.";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        // Clamped: the shell is wide enough for two columns now, and a sign-in
        // form spanning a tablet is a form nobody can read across.
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 48, width: "100%", maxWidth: 520, alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 74, height: 74, borderRadius: 24, backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", alignItems: "center", justifyContent: "center" }}>
            {mode === "verify" ? (
              <Ionicons name="mail-unread-outline" size={34} color={theme.accent} />
            ) : (
              <Text style={{ fontSize: 38 }}>🐠</Text>
            )}
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
        ) : mode === "verify" ? (
          /* CODE SCREEN — the only thing on it is the code, so there's nothing
             to get wrong while the email is still open on another device. */
          <View style={styles.card}>
            <OtpCodeInput
              value={code}
              onChange={(v) => { setCode(v); clearMessages(); }}
              onComplete={(v) => submitCode(v)}
              editable={!busy}
            />

            {error ? <Text style={styles.authError}>{error}</Text> : null}
            {notice ? <Text style={styles.authNotice}>{notice}</Text> : null}

            <Pressable
              onPress={() => submitCode()}
              disabled={busy || code.length !== 6}
              style={({ pressed }) => [styles.primaryBtn, { marginTop: 16 }, (pressed || busy) && { opacity: 0.8 }, code.length !== 6 && { opacity: 0.45 }]}
              accessibilityRole="button"
              accessibilityLabel={busy ? "Verifying your code" : "Verify"}
              accessibilityState={{ busy, disabled: busy || code.length !== 6 }}
            >
              {busy ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.primaryBtnText}>Verify</Text>}
            </Pressable>

            <Pressable
              onPress={resendCode}
              disabled={busy || cooldown > 0}
              style={styles.authLinkBtn}
              accessibilityRole="button"
              accessibilityLabel={cooldown > 0 ? `Resend available in ${cooldown} seconds` : "Send a new code"}
            >
              <Text style={[styles.authLinkText, cooldown > 0 && { color: theme.secondaryText }]}>
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Didn't get it? Send a new code"}
              </Text>
            </Pressable>

            <Text style={{ color: theme.bodyText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, textAlign: "center" }}>
              Check your spam folder too. The code expires after about an hour — the link in the same email works as well.
            </Text>

            <Pressable
              style={styles.authLinkBtn}
              onPress={() => { setMode(returnMode.current); setCode(""); clearMessages(); }}
              accessibilityRole="button"
            >
              <Text style={[styles.authLinkText, { color: theme.secondaryText }]}>‹ Use a different email</Text>
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
            
            maxLength={TEXT_LIMITS.email}
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
                
            maxLength={TEXT_LIMITS.password}
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
              
            maxLength={TEXT_LIMITS.password}
          />
            ) : null}

            {mode === "signup" ? (
              <Text style={{ color: theme.bodyText, fontSize: 11.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 17, marginTop: 10 }}>
                At least 8 characters. We'll email you a 6-digit code to verify the address.
              </Text>
            ) : null}

            {error ? <Text style={styles.authError}>{error}</Text> : null}
            {notice ? <Text style={styles.authNotice}>{notice}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.primaryBtn, { marginTop: 16 }, (pressed || busy) && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={busy ? "Working" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send code" : "Log in"}
              accessibilityState={{ busy, disabled: busy }}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === "signup" ? "Create account" : mode === "forgot" ? "Send code" : "Log in"}
                </Text>
              )}
            </Pressable>

            {/* Face ID / Touch ID — only once credentials are stored on this device. */}
            {mode === "login" && bioAvailable && bioEnabled ? (
              <Pressable
                onPress={biometricLogin}
                disabled={busy}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, borderRadius: 16, paddingVertical: 16, backgroundColor: "rgba(56,225,198,0.10)", borderWidth: 1, borderColor: "rgba(56,225,198,0.42)" }, pressed && { opacity: 0.8 }]}
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
                  <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 6 }}>
                    No account has signed in on this device yet.
                  </Text>
                )}
                <Text style={{ color: theme.bodyText, fontSize: 12.5, fontFamily: "Inter_700Bold", fontWeight: "700", lineHeight: 18, marginTop: 8 }}>
                  Otherwise, search your inbox for “Pocket Reef” — the verification email went to the address you signed up with. If none of your addresses work, sign up again and your reef starts fresh.
                </Text>
                <Pressable onPress={resendConfirmation} style={[styles.ghostBtn, { marginTop: 12 }]} accessibilityRole="button">
                  <Text style={styles.ghostBtnText}>Send a verification code</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <Text style={{ color: theme.bodyText, fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700", textAlign: "center", lineHeight: 17, marginTop: 4 }}>
          Your reef data is stored under your account and only readable by you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
