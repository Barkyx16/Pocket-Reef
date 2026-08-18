jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
const { mergeTank } = require("../lib/merge");
const { ensureTankShape } = require("../lib/migrations");
test("dupes", () => {
  const o = [];
  const a = { id: "t1", name: "T", stock: ["Ocellaris Clownfish", "Yellow Tang"], updatedAt: 2 };
  const b = { id: "t1", name: "T", stock: ["Yellow Tang", "Royal Gramma"], updatedAt: 1 };
  try { const m = mergeTank(a, b); o.push(`merge stock -> ${JSON.stringify(m.stock)}`); }
  catch (e) { o.push("merge threw: " + e.message.slice(0,60)); }
  o.push(`ensureTankShape dupes -> ${JSON.stringify(ensureTankShape({ id:"t1", stock:["Yellow Tang","Yellow Tang"] }).stock)}`);
  // ids too: could a merge produce two records sharing an id?
  const ra = { id:"t1", waterTests:[{id:"w1",date:"2026-01-01",values:{}}], updatedAt:2 };
  const rb = { id:"t1", waterTests:[{id:"w1",date:"2026-02-02",values:{}}], updatedAt:1 };
  try { const m = mergeTank(ra, rb); o.push(`merge waterTests ids -> ${JSON.stringify(m.waterTests.map(w=>w.id))}`); }
  catch (e) { o.push("merge2 threw: " + e.message.slice(0,60)); }
  console.log("DUP:\n  " + o.join("\n  "));
});
