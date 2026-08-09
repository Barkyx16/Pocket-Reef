// The server-owned entitlement row is the tamper-proof half of the paywall:
// the client can read it but never write it. Its failure modes matter more
// than its happy path — getting them wrong either locks out a paying
// subscriber or hands premium to someone who didn't pay.
let mockRow = { data: null, error: null };
jest.mock("../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mockRow }),
      }),
    }),
  },
  isCloudConfigured: () => true,
}));

const { fetchServerEntitlement, SYNCED_FIELDS, buildSnapshot } = require("../lib/cloudSync");

const inAYear = new Date(Date.now() + 365 * 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

beforeEach(() => { mockRow = { data: null, error: null }; });

describe("server entitlement", () => {
  test("an active, unexpired row grants premium", async () => {
    mockRow = { data: { is_active: true, expires_at: inAYear }, error: null };
    expect(await fetchServerEntitlement("u1")).toBe(true);
  });

  test("an expired row does not", async () => {
    mockRow = { data: { is_active: true, expires_at: lastWeek }, error: null };
    expect(await fetchServerEntitlement("u1")).toBe(false);
  });

  test("an inactive row does not, even if the expiry is in the future", async () => {
    // This is the refund/cancellation case.
    mockRow = { data: { is_active: false, expires_at: inAYear }, error: null };
    expect(await fetchServerEntitlement("u1")).toBe(false);
  });

  test("a null expiry is treated as NOT expired", async () => {
    // Lifetime grants and unknown grace periods arrive with no timestamp.
    // Reading that as expired would lock out someone who actually paid.
    mockRow = { data: { is_active: true, expires_at: null }, error: null };
    expect(await fetchServerEntitlement("u1")).toBe(true);
  });

  test("a lookup failure returns null, NOT false", async () => {
    // null means "don't know" and callers leave entitlement untouched. Returning
    // false would downgrade a paying subscriber the moment the network blipped.
    mockRow = { data: null, error: { message: "network" } };
    expect(await fetchServerEntitlement("u1")).toBeNull();
  });

  test("no row yet also returns null rather than a downgrade", async () => {
    mockRow = { data: null, error: null };
    expect(await fetchServerEntitlement("u1")).toBeNull();
  });

  test("no user id is an immediate null", async () => {
    expect(await fetchServerEntitlement(null)).toBeNull();
  });
});

describe("what syncs", () => {
  test("premium is NEVER part of the synced payload", async () => {
    // Syncing entitlement would let a patched client write itself premium and
    // have it follow the account to every device.
    expect(SYNCED_FIELDS).not.toContain("premiumUnlocked");
  });

  test("the snapshot carries only declared fields", () => {
    const snap = buildSnapshot({ tanks: [{ id: "t" }], xp: 5, premiumUnlocked: true, secret: "nope" });
    expect(snap.tanks).toHaveLength(1);
    expect(snap.xp).toBe(5);
    expect(snap.premiumUnlocked).toBeUndefined();
    expect(snap.secret).toBeUndefined();
  });

  test("undefined fields are omitted rather than written as null", () => {
    const snap = buildSnapshot({ tanks: [] });
    expect("xp" in snap).toBe(false);
  });
});
