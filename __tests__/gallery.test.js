jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The photo grid, on a journal the size this app is built for.
//
// It mounted one <Image> per photo with no cap. Images are the heaviest thing
// React Native renders, and this was the only place in the app that mounted an
// unbounded number of them — worst for the four-year keeper it exists to serve.

const renderer = require("react-test-renderer");
const { Image, Text } = require("react-native");
const { PhotoGalleryCard } = require("../components/PhotoGalleryCard");

// Day keys built the way the app builds them: local calendar fields, not UTC.
// These fixtures previously used toISOString(), which is the exact assumption
// the app was fixed for — so in any non-UTC zone the fixture's "today" and the
// app's "today" were different days.
function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const images = (t) => t.root.findAllByType(Image);
const btn = (t, s) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim().startsWith(s))[0];

// Strictly increasing dates. An earlier version cycled within one month, so
// index order and date order disagreed — and the strip sorts by date, which
// made "the newest photo" a different entry from "the last one generated".
const journalOf = (n) =>


  Array.from({ length: n }, (_, i) => ({
    id: i,
    date: localDay(Date.UTC(2020, 0, 1) + i * 86400000),
    photo: `file:///p/${i}.jpg`,
    text: "",
  }));

describe("the photo gallery", () => {
  test("an empty journal explains itself rather than rendering a blank grid", () => {
    const tree = mount(<PhotoGalleryCard journal={[]} />);
    expect(textOf(tree)).toMatch(/no photos yet/i);
  });

  test("a small journal shows everything, with no paging control", () => {
    const tree = mount(<PhotoGalleryCard journal={journalOf(9)} />);
    expect(images(tree)).toHaveLength(9);
    expect(btn(tree, "Show more")).toBeUndefined();
  });

  test("a four-year journal does not mount hundreds of images", () => {
    const tree = mount(<PhotoGalleryCard journal={journalOf(400)} />);
    expect(images(tree).length).toBeLessThanOrEqual(30);
    expect(textOf(tree)).toMatch(/400 photos/);
    // And it's honest that it's showing a slice.
    expect(textOf(tree)).toMatch(/showing the newest/i);
  });

  test("showing more reveals another page, not the whole archive", () => {
    const tree = mount(<PhotoGalleryCard journal={journalOf(400)} />);
    const before = images(tree).length;
    renderer.act(() => { btn(tree, "Show more").props.onPress(); });
    const after = images(tree).length;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(60);
  });

  test("entries without a photo aren't counted as photos", () => {
    const mixed = [...journalOf(3), { id: 99, date: "2026-02-01", photo: null, text: "no photo" }];
    const tree = mount(<PhotoGalleryCard journal={mixed} />);
    expect(images(tree)).toHaveLength(3);
    expect(textOf(tree)).toMatch(/3 photos/);
  });

  test("each thumbnail is named by its date for VoiceOver", () => {
    const tree = mount(<PhotoGalleryCard journal={journalOf(2)} />);
    const labelled = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Photo from"));
    expect(labelled.length).toBeGreaterThanOrEqual(2);
  });

  test("tapping a thumbnail opens its entry", () => {
    const onOpen = jest.fn();
    const tree = mount(<PhotoGalleryCard journal={journalOf(3)} onOpen={onOpen} />);
    const shot = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Photo from"))[0];
    renderer.act(() => { shot.props.onPress(); });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 0 }));
  });
});

// The compare strip has the same shape as the gallery and had the same problem.
describe("the before/after picker strip", () => {
  const { JournalMemoriesCard } = require("../components/JournalMemoriesCard");

  const openCompare = (journal) => {
    const tree = mount(<JournalMemoriesCard journal={journal} />);
    const tab = tree.root.findAll((n) => typeof n.props?.onPress === "function"
      && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === "Compare")[0];
    if (tab) renderer.act(() => { tab.props.onPress(); });
    return tree;
  };

  test("a long journal doesn't mount every photo just to pick two", () => {
    const tree = openCompare(journalOf(400));
    expect(images(tree).length).toBeLessThanOrEqual(45);
  });

  test("the oldest and newest survive the sampling — they're the default pair", () => {
    const tree = openCompare(journalOf(400));
    const uris = images(tree).map((i) => i.props.source && i.props.source.uri).filter(Boolean);
    expect(uris).toContain("file:///p/0.jpg");
    expect(uris).toContain("file:///p/399.jpg");
  });

  test("a short journal is shown whole", () => {
    const tree = openCompare(journalOf(6));
    const uris = new Set(images(tree).map((i) => i.props.source && i.props.source.uri));
    expect(uris.size).toBeGreaterThanOrEqual(6);
  });
});
