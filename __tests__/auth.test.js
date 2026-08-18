jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The login gate, driven end to end.
//
// Auth is the one screen where a bug locks every user out of everything, and
// it's also the screen nobody re-tests by hand once it works — you only sign up
// once. So the whole flow is mocked at the Supabase client and exercised here:
// sign up, land on the code screen, type a wrong code, type the right one, and
// the two paths that quietly matter most — an unverified account trying to log
// in, and a recovery code that must not drop the user into the app still
// holding the password they forgot.

// `mock`-prefixed so jest's hoisted factory is allowed to close over it.
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    verifyOtp: jest.fn(),
    resend: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  },
};
const supabase = mockSupabase;

jest.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  isCloudConfigured: () => true,
}));

// Biometrics are hardware; off in tests so no prompt path interferes.
jest.mock("../lib/biometricAuth", () => ({
  isBiometricAvailable: async () => false,
  getBiometricLabel: async () => "Face ID",
  isBiometricEnabled: async () => false,
  enableBiometricLogin: async () => true,
  disableBiometricLogin: async () => {},
  authenticateAndGetCredentials: async () => null,
}));

const renderer = require("react-test-renderer");
// The jest mock exports the store as the module itself; the real package puts
// it on .default. Accept whichever shape is in front of us.
const asyncStorageModule = require("@react-native-async-storage/async-storage");
const AsyncStorage = asyncStorageModule.default || asyncStorageModule;
const { Text, TextInput } = require("react-native");
const { AuthScreen } = require("../screens/AuthScreen");

function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (tree) => tree.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");

// findAll returns the composite and its host node for one labelled control, so
// take the first — callers want the control, not every node used to draw it.
const byLabel = (tree, label) => tree.root.findAll((n) => n.props.accessibilityLabel === label)[0];
const hasLabel = (tree, label) => Boolean(byLabel(tree, label));
const inputByLabel = (tree, label) => tree.root.findAllByType(TextInput).find((n) => n.props.accessibilityLabel === label);

// A Pressable's name is a <Text> element underneath it, not a string child, so
// reading props.children gives back an element and matches nothing — the label
// has to be gathered from the descendant Text nodes.
const pressables = (tree) => tree.root.findAll((n) => typeof n.props?.onPress === "function");
const labelOf = (node) => node.findAllByType(Text).map((t) => flatten(t.props.children)).join(" ").trim();

// Exact, because "Log in" is both the submit button and the tail of "Already
// have an account? Log in" — a substring match grabs the wrong one silently.
const btn = (tree, text) => {
  const hit = pressables(tree).find((n) => labelOf(n) === text);
  if (!hit) throw new Error(`No button reading "${text}". Present: ${pressables(tree).map(labelOf).filter(Boolean).map((s) => JSON.stringify(s)).join(", ")}`);
  return hit;
};
const link = (tree, text) => {
  const hit = pressables(tree).find((n) => labelOf(n).includes(text));
  if (!hit) throw new Error(`No control containing "${text}". Present: ${pressables(tree).map(labelOf).filter(Boolean).map((s) => JSON.stringify(s)).join(", ")}`);
  return hit;
};

const type = (node, value) => renderer.act(() => { node.props.onChangeText(value); });
const press = (node) => renderer.act(() => { node.props.onPress(); });
const pressAsync = async (node) => { await renderer.act(async () => { await node.props.onPress(); }); };

// Effects fire AsyncStorage reads on mount; let them settle before asserting.
const settle = async () => { await renderer.act(async () => { await Promise.resolve(); }); };

// The screen opens on signup when the device has no remembered email, which is
// the state the AsyncStorage mock leaves it in.
async function signUp(tree, email = "reef@example.com", password = "coralcoral") {
  type(inputByLabel(tree, "Email address"), email);
  type(inputByLabel(tree, "Password"), password);
  type(inputByLabel(tree, "Confirm password"), password);
  await pressAsync(btn(tree, "Create account"));
}

async function goToLogin(tree) {
  press(link(tree, "Already have an account? Log in"));
  await settle();
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
  // The AsyncStorage mock keeps one store for the whole file. A signup in an
  // earlier test writes pr_lastEmail, which makes every later mount open in
  // login mode — start each test from a device that has never signed in.
  await AsyncStorage.clear();
  supabase.auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  supabase.auth.resend.mockResolvedValue({ error: null });
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
});

test("signup sends a code and lands on the verification screen", async () => {
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  expect(supabase.auth.signUp).toHaveBeenCalledWith(
    expect.objectContaining({ email: "reef@example.com", password: "coralcoral" })
  );
  const shown = textOf(tree);
  expect(shown).toContain("Check your");
  expect(shown).toContain("reef@example.com");
  expect(hasLabel(tree, "Six digit verification code")).toBe(true);
  tree.unmount();
});

test("a complete code verifies on its own, without pressing Verify", async () => {
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  const codeField = byLabel(tree, "Six digit verification code");
  await renderer.act(async () => { await codeField.props.onChangeText("123456"); });

  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith(
    expect.objectContaining({ email: "reef@example.com", token: "123456", type: "signup" })
  );
  tree.unmount();
});

test("codes arriving with spaces or a prefix are cleaned before sending", async () => {
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  const codeField = byLabel(tree, "Six digit verification code");
  // What iOS autofill hands over when it lifts the code out of the email text.
  await renderer.act(async () => { await codeField.props.onChangeText("Your code is 12 34-56"); });

  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: "123456" }));
  tree.unmount();
});

test("a rejected code explains itself and clears the boxes to retype", async () => {
  supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: "Token has expired or is invalid" } });
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  const codeField = byLabel(tree, "Six digit verification code");
  await renderer.act(async () => { await codeField.props.onChangeText("000000"); });

  expect(textOf(tree)).toMatch(/expired/i);
  // Cleared, so the next attempt starts from an empty row rather than needing
  // six backspaces first.
  expect(byLabel(tree, "Six digit verification code").props.value).toBe("");
  tree.unmount();
});

const RESEND_COOLDOWN = 45; // mirrors the constant in AuthScreen

test("resend is blocked behind a visible countdown, then works", async () => {
  jest.useFakeTimers();
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  expect(textOf(tree)).toMatch(/Send a new code in \d+s/);
  // Pressing during the cooldown must not fire another email.
  await pressAsync(link(tree, "Send a new code in"));
  expect(supabase.auth.resend).not.toHaveBeenCalled();

  // The countdown is a chain of one-second timeouts — each next one is only
  // scheduled by the effect that runs after the previous tick renders, so the
  // clock has to be advanced a second at a time, flushing React in between.
  for (let i = 0; i < RESEND_COOLDOWN + 1; i++) {
    renderer.act(() => { jest.advanceTimersByTime(1000); });
  }
  expect(textOf(tree)).toContain("Didn't get it?");

  await pressAsync(link(tree, "Didn't get it?"));
  expect(supabase.auth.resend).toHaveBeenCalledWith(
    expect.objectContaining({ type: "signup", email: "reef@example.com" })
  );
  jest.useRealTimers();
  tree.unmount();
});

test("logging in to an unverified account routes to the code screen with a fresh code", async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Email not confirmed" } });
  const tree = mount(<AuthScreen />);
  await settle();

  await goToLogin(tree);
  type(inputByLabel(tree, "Email address"), "reef@example.com");
  type(inputByLabel(tree, "Password"), "coralcoral");
  await pressAsync(btn(tree, "Log in"));

  expect(supabase.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup" }));
  expect(hasLabel(tree, "Six digit verification code")).toBe(true);
  expect(textOf(tree)).toMatch(/still needs verifying/i);
  tree.unmount();
});

test("a recovery code verifies as recovery and hands off to the new-password sheet", async () => {
  const onPasswordRecovered = jest.fn();
  const tree = mount(<AuthScreen onPasswordRecovered={onPasswordRecovered} />);
  await settle();

  await goToLogin(tree);
  press(link(tree, "Forgot password?"));
  type(inputByLabel(tree, "Email address"), "reef@example.com");
  await pressAsync(btn(tree, "Send code"));

  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("reef@example.com", expect.anything());

  const codeField = byLabel(tree, "Six digit verification code");
  await renderer.act(async () => { await codeField.props.onChangeText("654321"); });

  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", token: "654321" }));
  // Without this the user is signed in and dropped into the reef still holding
  // the password they came here to replace.
  expect(onPasswordRecovered).toHaveBeenCalled();
  tree.unmount();
});

test("bad credentials get a plain-language error, not the raw API string", async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
  const tree = mount(<AuthScreen />);
  await settle();

  await goToLogin(tree);
  type(inputByLabel(tree, "Email address"), "reef@example.com");
  type(inputByLabel(tree, "Password"), "wrongwrong");
  await pressAsync(btn(tree, "Log in"));

  const shown = textOf(tree);
  expect(shown).not.toContain("Invalid login credentials");
  expect(shown).toMatch(/don't match an account/i);
  tree.unmount();
});

test("a malformed email never reaches the network", async () => {
  const tree = mount(<AuthScreen />);
  await settle();

  await goToLogin(tree);
  type(inputByLabel(tree, "Email address"), "reef@example");
  type(inputByLabel(tree, "Password"), "coralcoral");
  await pressAsync(btn(tree, "Log in"));

  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  expect(textOf(tree)).toMatch(/Enter the email address/i);
  tree.unmount();
});

test("with email confirmation off, signup skips the code screen entirely", async () => {
  supabase.auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  const tree = mount(<AuthScreen />);
  await settle();
  await signUp(tree);

  // No code will ever arrive in this configuration, so parking on a code screen
  // would strand the user.
  expect(hasLabel(tree, "Six digit verification code")).toBe(false);
  tree.unmount();
});
