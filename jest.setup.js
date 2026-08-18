// Test-environment stand-ins for the native modules the UI imports.
//
// These are the modules that only exist inside a real Expo runtime. Without
// them, importing any screen fails at require time — which is why the suite
// had no component tests at all. None of them are what's under test: icons are
// glyphs, haptics are a buzz, notifications are an OS scheduler. They're mocked
// at the boundary so the components above them can be.

// Icons render as a plain view with their name kept as a prop, so a test can
// still assert which icon a component chose.
jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function Ionicons(props) {
    return React.createElement(View, { ...props, testID: props.testID || `icon-${props.name}` });
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { LinearGradient: (props) => React.createElement(View, props, props.children) };
});

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve("id")),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", TIME_INTERVAL: "timeInterval" },
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  MediaTypeOptions: { Images: "Images" },
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(false)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(false)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn((p) => `pocketreef://${p}`),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn(() => ({ queryParams: {} })),
}));

// The store SDK has no JS fallback; in Expo Go it's absent too, which is the
// state these tests stand in for.
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    logIn: jest.fn(() => Promise.resolve()),
    logOut: jest.fn(() => Promise.resolve()),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    setLogLevel: jest.fn(),
  },
  LOG_LEVEL: { ERROR: "ERROR" },
}));

// react-native-web's Animated + jsdom don't need the noise, and a warning per
// render buries the failures that matter.
jest.spyOn(console, "warn").mockImplementation(() => {});

// react-native-safe-area-context measures real insets and renders NOTHING until
// it has them, so under jest its provider yields `children: null` and the whole
// app tree is empty. Every screen test mounts screens directly and never hit
// this; App itself is unrenderable without it, which is precisely why App had
// never been covered.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...rest }) => React.createElement(require("react-native").View, rest, children),
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});
