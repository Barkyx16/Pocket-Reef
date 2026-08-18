jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Proof that the memo work actually does something.
//
// Wrapping the screens in React.memo is worthless on its own: App passes each
// one around forty props, and every handler among them used to be a fresh
// arrow function per render, so the shallow prop compare failed every single
// time. useStableCallback is the half that makes memo bite.
//
// These tests pin both halves down. Without them, someone adds one inline
// `onPress={() => …}` prop in App.js, memo silently stops working everywhere on
// that screen, and nothing goes red.
const React = require("react");
const renderer = require("react-test-renderer");
const { Text, View } = require("react-native");
const { useStableCallback } = require("../lib/useStableCallback");

function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}

describe("useStableCallback", () => {
  test("keeps one identity across renders", () => {
    const seen = [];
    function Probe({ dep }) {
      const cb = useStableCallback(() => dep);
      seen.push(cb);
      return null;
    }
    const tree = mount(<Probe dep={1} />);
    renderer.act(() => { tree.update(<Probe dep={2} />); });
    renderer.act(() => { tree.update(<Probe dep={3} />); });

    expect(seen).toHaveLength(3);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
    tree.unmount();
  });

  test("calls the latest closure, not the one it was created with", () => {
    // This is the property that makes the frozen identity safe. If it read a
    // stale closure, a handler would act on an old tank and write it back —
    // exactly the bug a wrong useCallback dependency array causes.
    let captured;
    function Probe({ value }) {
      captured = useStableCallback(() => value);
      return null;
    }
    const tree = mount(<Probe value="old" />);
    expect(captured()).toBe("old");
    renderer.act(() => { tree.update(<Probe value="new" />); });
    expect(captured()).toBe("new");
    tree.unmount();
  });
});

describe("memo + stable callbacks together", () => {
  // A stand-in for the App/screen relationship: a parent with its own transient
  // state (the undo bar, a sheet opening) and an expensive memoised child.
  let childRenders = 0;
  const Child = React.memo(function Child({ label, onPress }) {
    childRenders += 1;
    return <Text onPress={onPress}>{label}</Text>;
  });

  beforeEach(() => { childRenders = 0; });

  test("chrome-only state changes do not re-render the screen", () => {
    let setChrome;
    function App() {
      const [chrome, set] = React.useState(0);
      setChrome = set;
      const onPress = useStableCallback(() => chrome);
      return (
        <View>
          <Text>{`chrome:${chrome}`}</Text>
          <Child label="screen" onPress={onPress} />
        </View>
      );
    }
    const tree = mount(<App />);
    expect(childRenders).toBe(1);

    // Three transient updates — an undo bar appearing, ticking, dismissing.
    renderer.act(() => { setChrome(1); });
    renderer.act(() => { setChrome(2); });
    renderer.act(() => { setChrome(3); });

    // The child never re-rendered, because none of its props changed.
    expect(childRenders).toBe(1);
    tree.unmount();
  });

  test("an inline handler defeats memo — the regression this guards against", () => {
    let setChrome;
    function App() {
      const [chrome, set] = React.useState(0);
      setChrome = set;
      // Deliberately NOT stabilised.
      return (
        <View>
          <Text>{`chrome:${chrome}`}</Text>
          <Child label="screen" onPress={() => chrome} />
        </View>
      );
    }
    const tree = mount(<App />);
    renderer.act(() => { setChrome(1); });
    renderer.act(() => { setChrome(2); });
    // Four renders where the stabilised version had one.
    expect(childRenders).toBe(3);
    tree.unmount();
  });

  test("the child still re-renders when its own data changes", () => {
    // Memo must not be so sticky that real updates get dropped.
    let setLabel;
    function App() {
      const [label, set] = React.useState("a");
      setLabel = set;
      const onPress = useStableCallback(() => label);
      return <Child label={label} onPress={onPress} />;
    }
    const tree = mount(<App />);
    expect(childRenders).toBe(1);
    renderer.act(() => { setLabel("b"); });
    expect(childRenders).toBe(2);
    tree.unmount();
  });
});

describe("the screens are actually memoised", () => {
  // Reads the component objects rather than rendering them, so this stays fast
  // and fails loudly if someone unwraps one.
  const screens = {
    HomeTab: require("../screens/HomeTab").HomeTab,
    SpeciesTab: require("../screens/SpeciesTab").SpeciesTab,
    TankTab: require("../screens/TankTab").TankTab,
    LogTab: require("../screens/LogTab").LogTab,
    JournalTab: require("../screens/JournalTab").JournalTab,
    HealthTab: require("../screens/HealthTab").HealthTab,
    GamesTab: require("../screens/GamesTab").GamesTab,
    MoreTab: require("../screens/MoreTab").MoreTab,
    ProfileTab: require("../screens/ProfileTab").ProfileTab,
  };

  const MEMO = Symbol.for("react.memo");

  test.each(Object.keys(screens))("%s is wrapped in React.memo", (name) => {
    expect(screens[name].$$typeof).toBe(MEMO);
  });
});
