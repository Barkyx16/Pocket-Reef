// Supabase storage is mocked so upload/sign failures can be driven on purpose —
// the guarantee that matters is that a failure never costs the user their entry.
const mockUpload = jest.fn();
const mockSign = jest.fn();
const mockRemove = jest.fn();
jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...a) => mockUpload(...a),
        createSignedUrl: (...a) => mockSign(...a),
        remove: (...a) => mockRemove(...a),
      }),
    },
  },
}));

const { uploadPhoto, deletePhoto, backupTankPhotos, hydrateTankPhotos } = require("../lib/photoSync");

const tank = (journal) => ({ id: "t1", name: "T", journal });

beforeEach(() => {
  mockUpload.mockReset(); mockSign.mockReset(); mockRemove.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
});

describe("uploading", () => {
  test("a remote URL is not re-uploaded", async () => {
    expect(await uploadPhoto("u1", "https://cdn/x.jpg", "e1")).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("missing user or uri is a no-op", async () => {
    expect(await uploadPhoto(null, "file:///a.jpg", "e1")).toBeNull();
    expect(await uploadPhoto("u1", null, "e1")).toBeNull();
  });

  test("a stored photo is namespaced under the user", async () => {
    mockUpload.mockResolvedValue({ error: null });
    const path = await uploadPhoto("u1", "file:///photo.png", "entry-9");
    // The path prefix is what makes per-user storage policies enforceable.
    expect(path).toBe("u1/entry-9.png");
  });

  test("an empty file is not uploaded", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    expect(await uploadPhoto("u1", "file:///empty.jpg", "e1")).toBeNull();
  });

  test("a storage error yields null rather than throwing", async () => {
    mockUpload.mockResolvedValue({ error: { message: "denied" } });
    expect(await uploadPhoto("u1", "file:///a.jpg", "e1")).toBeNull();
  });
});

describe("backing up a tank's journal", () => {
  test("entries already backed up are skipped", async () => {
    const t = tank([{ id: "e1", photo: "file:///a.jpg", photoPath: "u1/e1.jpg" }]);
    const res = await backupTankPhotos("u1", [t]);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(res.uploaded).toBe(0);
    expect(res.tanks[0]).toBe(t); // identity preserved — no pointless re-render
  });

  test("a new photo gains a photoPath and keeps its local uri", async () => {
    mockUpload.mockResolvedValue({ error: null });
    const res = await backupTankPhotos("u1", [tank([{ id: "e1", photo: "file:///a.jpg" }])]);
    const entry = res.tanks[0].journal[0];
    expect(entry.photoPath).toBe("u1/e1.jpg");
    // The device that took the photo must keep rendering it with no round trip.
    expect(entry.photo).toBe("file:///a.jpg");
    expect(res.uploaded).toBe(1);
  });

  test("a failed upload leaves the entry completely intact", async () => {
    mockUpload.mockResolvedValue({ error: { message: "offline" } });
    const res = await backupTankPhotos("u1", [tank([{ id: "e1", photo: "file:///a.jpg", text: "keep me" }])]);
    const entry = res.tanks[0].journal[0];
    expect(entry.photoPath).toBeUndefined();
    expect(entry.photo).toBe("file:///a.jpg");
    expect(entry.text).toBe("keep me");
    expect(res.uploaded).toBe(0);
  });

  test("a tank that uploaded nothing isn't cloned because ANOTHER tank did", async () => {
    // These run concurrently; accounting used to be a shared counter, so an
    // untouched tank's result depended on whether a different tank finished
    // an upload first.
    mockUpload.mockResolvedValue({ error: null });
    const untouched = tank([{ id: "e0", text: "no photo" }]);
    const uploads = { ...tank([{ id: "e1", photo: "file:///a.jpg" }]), id: "t2" };
    const res = await backupTankPhotos("u1", [untouched, uploads]);
    expect(res.tanks[0]).toBe(untouched);
    expect(res.tanks[1]).not.toBe(uploads);
  });

  test("malformed tanks don't throw", async () => {
    await expect(backupTankPhotos("u1", [null, {}, { journal: "nope" }])).resolves.toBeDefined();
    await expect(backupTankPhotos("u1", null)).resolves.toBeDefined();
  });
});

describe("hydrating on a new device", () => {
  test("a stored photo gets a signed url", async () => {
    mockSign.mockResolvedValue({ data: { signedUrl: "https://signed/x.jpg" }, error: null });
    const res = await hydrateTankPhotos([tank([{ id: "e1", photoPath: "u1/e1.jpg", photo: "file:///gone.jpg" }])]);
    expect(res[0].journal[0].photo).toBe("https://signed/x.jpg");
  });

  test("an already-signed photo is left alone", async () => {
    const t = tank([{ id: "e1", photoPath: "u1/e1.jpg", photo: "https://already/x.jpg" }]);
    const res = await hydrateTankPhotos([t]);
    expect(mockSign).not.toHaveBeenCalled();
    expect(res[0].journal[0].photo).toBe("https://already/x.jpg");
  });

  test("entries with no stored copy are untouched", async () => {
    const t = tank([{ id: "e1", photo: "file:///local-only.jpg" }]);
    const res = await hydrateTankPhotos([t]);
    expect(mockSign).not.toHaveBeenCalled();
    expect(res[0].journal[0].photo).toBe("file:///local-only.jpg");
  });

  test("a signing failure leaves the entry as it was", async () => {
    mockSign.mockResolvedValue({ data: null, error: { message: "nope" } });
    const res = await hydrateTankPhotos([tank([{ id: "e1", photoPath: "u1/e1.jpg", photo: "file:///gone.jpg" }])]);
    expect(res[0].journal[0].photo).toBe("file:///gone.jpg");
  });
});

describe("deleting", () => {
  test("removes the stored object", async () => {
    mockRemove.mockResolvedValue({ error: null });
    expect(await deletePhoto("u1/e1.jpg")).toBe(true);
  });
  test("reports failure rather than throwing", async () => {
    mockRemove.mockResolvedValue({ error: { message: "no" } });
    expect(await deletePhoto("u1/e1.jpg")).toBe(false);
    expect(await deletePhoto(null)).toBe(false);
  });
});
