const js = require("@eslint/js");
const reactHooks = require("eslint-plugin-react-hooks");
const react = require("eslint-plugin-react");
const globals = require("globals");

// ─────────────────────────────────────────────────────────────────────────────
// Nothing statically checked this codebase before this file existed. The test
// suite covers logic well, but a whole class of bug never reaches a test:
// a hook called inside a condition, a dependency array missing the value it
// closes over, a variable referenced after a rename, an unused import left
// behind by a refactor. All of those ship green.
//
// The rules below are deliberately narrow. A linter that reports six hundred
// style opinions on an existing codebase gets switched off in a week, so
// formatting is left alone entirely and only correctness rules are errors.
// ─────────────────────────────────────────────────────────────────────────────
module.exports = [
  {
    ignores: ["node_modules/**", ".expo/**", "supabase/functions/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        __DEV__: "readonly",
      },
    },
    settings: { react: { version: "detect" } },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      // The two that matter most here. App.js is one 1,300-line component with
      // around fifty hooks; the rules-of-hooks check is the only thing that can
      // tell you a conditional early return has broken the hook order.
      "react-hooks/rules-of-hooks": "error",
      // A missing dependency is a stale closure, which in this app means
      // reading an old tank and writing it back. Warn rather than error: the
      // mirror effects intentionally omit some deps, and a rule that blocks the
      // build on a judgement call is a rule people disable.
      "react-hooks/exhaustive-deps": "warn",

      // Catches JSX that references something that no longer exists.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "react/jsx-no-undef": "error",
      "react/jsx-key": "error",

      // Real mistakes, not style.
      // caughtErrors: "none" because `catch (e) {}` is this codebase's
      // deliberate, documented idiom for best-effort writes — flagging 57 of
      // them buried the ~35 genuinely unused imports underneath.
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-undef": "error",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-fallthrough": "error",
      "no-self-compare": "error",
      "no-unsafe-negation": "error",
      "require-atomic-updates": "off",

      // An empty catch is the codebase's deliberate idiom for "this write is
      // best-effort", so allow it rather than paper it with a comment.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Regexes in the search layer legitimately use control-ish ranges for
      // accent stripping.
      "no-control-regex": "off",
    },
  },
];
