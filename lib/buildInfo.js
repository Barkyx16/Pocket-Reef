import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";

// ─────────────────────────────────────────────────────────────────────────────
// Which build is this, and what is it running on.
//
// The app had no way to answer either question. That matters in two places:
//
//   * Support. "It's broken" is unactionable without a version. The tank report
//     is already the thing people paste into a forum or hand to a shop, so the
//     build that produced it belongs in the footer.
//   * Bug reports. A keeper on an old build hitting a bug fixed three releases
//     ago is indistinguishable from a new one, to them and to you.
//
// Everything here is a property of the software and the hardware class, not of
// the person: a version string, an OS version, a model name like "iPhone 15".
// No identifiers, nothing that persists across installs, nothing that could
// join this app's data to another's.
// ─────────────────────────────────────────────────────────────────────────────

const unknown = "unknown";

export function appVersion() {
  return Application.nativeApplicationVersion || unknown;
}

export function appBuild() {
  return Application.nativeBuildVersion || unknown;
}

// "1.0.0 (12)" — the form a support conversation actually needs.
export function versionLabel() {
  const v = appVersion();
  const b = appBuild();
  if (v === unknown) return unknown;
  return b === unknown ? v : `${v} (${b})`;
}

export function deviceLabel() {
  const model = Device.modelName || unknown;
  const os = Device.osVersion ? `${Platform.OS === "ios" ? "iOS" : "Android"} ${Device.osVersion}` : Platform.OS;
  return `${model} · ${os}`;
}

// One line for the report footer and the support row.
export function supportLine() {
  return `Pocket Reef ${versionLabel()} · ${deviceLabel()}`;
}

// Expo Go and simulators behave differently enough from a real build that it's
// worth being able to say so out loud rather than debugging a phantom.
export const isRealDevice = () => Device.isDevice !== false;
