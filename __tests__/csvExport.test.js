jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { buildWaterLogCsv, csvCell, csvRow } from "../lib/csvExport";
import { waterLogFilename } from "../lib/backupFile";
import { activeParams } from "../lib/targets";
import { setUnit } from "../lib/units";

const ROOT = path.join(__dirname, "..");
const params = () => activeParams("salt");
const tests = [
  { date: "2026-08-18", water: "salt", values: { temp: 78, alk: 8.4, calcium: 420, nitrate: 5 } },
  { date: "2026-08-11", water: "salt", values: { temp: 79, alk: 8.1 } },
];

afterEach(() => setUnit("imperial"));

describe("the exported file matches the app the keeper is reading", () => {
  test("temperature is exported in their unit, header and value together", () => {
    // The old builder used the stored value and the parameter's own label, so
    // a keeper reading °C everywhere exported a file that said °F.
    setUnit("metric");
    const csv = buildWaterLogCsv(params(), tests);
    expect(csv.split("\n")[0]).toContain("Temp (°C)");
    expect(csv).not.toContain("°F");
    const tempCol = csv.split("\n")[0].split(",").indexOf("Temp (°C)");
    expect(csv.split("\n")[1].split(",")[tempCol]).toBe("26");
  });

  test("imperial is unchanged", () => {
    const csv = buildWaterLogCsv(params(), tests);
    expect(csv.split("\n")[0]).toContain("Temp (°F)");
    const col = csv.split("\n")[0].split(",").indexOf("Temp (°F)");
    expect(csv.split("\n")[1].split(",")[col]).toBe("78");
  });

  test("other parameters are untouched by the conversion", () => {
    setUnit("metric");
    const csv = buildWaterLogCsv(params(), tests);
    expect(csv).toContain("Alk (dKH)");
    expect(csv.split("\n")[1]).toContain("8.4");
  });
});

describe("it is a CSV a spreadsheet will actually parse", () => {
  test("a value with a comma is quoted rather than splitting the row", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvRow(["x", "a,b", "y"]).split(",")).toHaveLength(4); // the quoted comma survives
  });

  test("quotes are doubled, per RFC 4180", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  test("newlines are quoted", () => {
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  test("ordinary values are not needlessly quoted", () => {
    expect(csvCell("8.4")).toBe("8.4");
    expect(csvCell(78)).toBe("78");
  });

  test("a missing reading is an empty cell, not a zero", () => {
    // A blank means "not tested"; a zero is a measurement nobody took.
    const csv = buildWaterLogCsv(params(), tests);
    const header = csv.split("\n")[0].split(",");
    const row = csv.split("\n")[2].split(",");
    expect(row[header.indexOf("Calcium (ppm)")]).toBe("");
  });

  test("every row has the same number of columns as the header", () => {
    const csv = buildWaterLogCsv(params(), tests);
    const width = csv.split("\n")[0].split(",").length;
    for (const line of csv.split("\n")) expect(line.split(",")).toHaveLength(width);
  });

  test("rubbish rows are skipped rather than exported as holes", () => {
    const csv = buildWaterLogCsv(params(), [null, undefined, "x", tests[0]]);
    expect(csv.split("\n")).toHaveLength(2);
  });

  test("no parameters, no tests: still a valid file", () => {
    expect(buildWaterLogCsv([], [])).toBe("Date");
    expect(() => buildWaterLogCsv(null, null)).not.toThrow();
  });
});

describe("it is shared as a file, not as a message body", () => {
  const src = fs.readFileSync(path.join(ROOT, "screens/LogTab.js"), "utf8");

  test("a real .csv is written first", () => {
    // Messages truncates a long body, Notes chokes on it, and the one thing
    // nobody can do with it is open it in a spreadsheet. Tolerable at sixty
    // water tests; the cap is now a thousand, which is about 60 KB of text.
    expect(src).toContain("writeTextFile(csv, waterLogFilename())");
    expect(src).toMatch(/Share\.share\(\{ url: written\.uri/);
  });

  test("it still degrades to text where there is no filesystem", () => {
    // A share that works badly beats a button that does nothing.
    expect(src).toMatch(/Share\.share\(\{ message: `Pocket Reef water log/);
  });

  test("the filename says what it is and when", () => {
    expect(waterLogFilename(new Date(2026, 0, 5))).toBe("pocket-reef-water-log-2026-01-05.csv");
  });

  test("the filename uses the local day, like every other date here", () => {
    expect(waterLogFilename(new Date(2026, 7, 18, 23, 30))).toContain("2026-08-18");
  });
});
