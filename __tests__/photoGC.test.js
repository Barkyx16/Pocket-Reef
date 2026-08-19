jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Deleting photos nothing points at, and — much more importantly — never
// deleting one something does.
//
// An orphaned image costs a few hundred kilobytes. Deleting a photo somebody
// still has a journal entry for is unrecoverable, so every uncertainty here
// resolves toward keeping the file.

const { referencedPhotos, fileNameOf } = require("../lib/photoGC");
const { newObservation } = require("../lib/observations");

const photo = (n) => `file:///var/mobile/Documents/journal-photos/${n}.jpg`;

describe("what counts as referenced", () => {
  test("journal photos", () => {
    const refs = referencedPhotos([{ journal: [{ id: 1, photo: photo("a") }, { id: 2, photo: null }] }]);
    expect([...refs]).toEqual([photo("a")]);
  });

  test("observation photos — the case that was leaking", () => {
    const tank = { observations: { Coral: [newObservation({ photo: photo("b"), date: "2026-01-01" })] } };
    expect(referencedPhotos([tank]).has(photo("b"))).toBe(true);
  });

  test("across every tank, not just the active one", () => {
    const refs = referencedPhotos([
      { journal: [{ id: 1, photo: photo("a") }] },
      { observations: { Fish: [newObservation({ photo: photo("b") })] } },
    ]);
    expect(refs.size).toBe(2);
  });

  test("species records and losses, so adding a photo there can't orphan it", () => {
    const refs = referencedPhotos([{ stockMeta: { Clown: { photo: photo("c") } }, losses: [{ id: 1, photo: photo("d") }] }]);
    expect(refs.has(photo("c"))).toBe(true);
    expect(refs.has(photo("d"))).toBe(true);
  });

  test("junk in the store doesn't throw", () => {
    expect(() => referencedPhotos(null)).not.toThrow();
    expect(referencedPhotos([null, {}, { journal: null, observations: null }]).size).toBe(0);
  });

  test("comparison is by filename, which survives the sandbox being remapped", () => {
    // iOS moves the documents directory between launches; a stored absolute
    // URI from last week has a different prefix and the same filename.
    expect(fileNameOf("file:///OLD/journal-photos/x.jpg")).toBe("x.jpg");
    expect(fileNameOf("file:///NEW/journal-photos/x.jpg")).toBe("x.jpg");
  });
});

describe("the sweep itself", () => {
  // A tiny stand-in for the expo-file-system directory API.
  const mockFs = (names, { deleteThrowsOn = [] } = {}) => {
    const deleted = [];
    const entries = names.map((name) => ({
      name,
      size: 100,
      delete() {
        if (deleteThrowsOn.includes(name)) throw new Error("locked");
        deleted.push(name);
      },
    }));
    jest.doMock("expo-file-system", () => ({
      Paths: { document: "/doc" },
      Directory: class { constructor() { this.exists = true; } list() { return entries; } },
      File: class {},
    }), { virtual: true });
    return { deleted };
  };

  beforeEach(() => { jest.resetModules(); });

  test("removes the unreferenced and keeps the referenced", async () => {
    const { deleted } = mockFs(["a.jpg", "b.jpg", "orphan.jpg"]);
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    const res = await gc([{ journal: [{ id: 1, photo: photo("a") }, { id: 2, photo: photo("b") }] }]);

    expect(res.ok).toBe(true);
    expect(deleted).toEqual(["orphan.jpg"]);
    expect(res.removed).toBe(1);
    expect(res.kept).toBe(2);
  });

  test("an observation photo is no longer treated as an orphan", async () => {
    const { deleted } = mockFs(["obs.jpg"]);
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    await gc([{ observations: { Coral: [newObservation({ photo: photo("obs") })] } }]);
    expect(deleted).toEqual([]);
  });

  test("a store that references nothing is refused, not obeyed", async () => {
    // Far likelier to be a failed read than a keeper who deleted every photo.
    const { deleted } = mockFs(["a.jpg", "b.jpg"]);
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    const res = await gc([]);

    expect(res.ok).toBe(false);
    expect(res.reason).toBe("nothing-referenced");
    expect(deleted).toEqual([]);
  });

  test("a file that won't delete is kept rather than retried forever", async () => {
    mockFs(["stuck.jpg", "gone.jpg"], { deleteThrowsOn: ["stuck.jpg"] });
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    const res = await gc([{ journal: [{ id: 1, photo: photo("keeper") }] }]);
    expect(res.ok).toBe(true);
    expect(res.removed).toBe(1);
    expect(res.kept).toBeGreaterThan(0);
  });

  test("a dry run reports without deleting", async () => {
    const { deleted } = mockFs(["orphan.jpg"]);
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    const res = await gc([{ journal: [{ id: 1, photo: photo("kept") }] }], { dryRun: true });
    expect(res.removed).toBe(1);
    expect(deleted).toEqual([]);
  });

  test("no filesystem is reported, not thrown", async () => {
    jest.doMock("expo-file-system", () => { throw new Error("no native module"); }, { virtual: true });
    const { collectOrphanPhotos: gc } = require("../lib/photoGC");
    await expect(gc([{ journal: [] }])).resolves.toMatchObject({ ok: false });
  });
});
