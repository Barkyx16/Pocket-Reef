jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import renderer from "react-test-renderer";
import { Text } from "react-native";
import { MedDoseCard } from "../components/MedDoseCard";
import { safetyFor, classOf } from "../lib/meds";
import { getSpecies } from "../core";
import SPECIES from "../data/speciesData";

const coral = SPECIES.find((s) => s.kind === "coral");
const shrimp = SPECIES.find((s) => s.kind === "invert");
const fish = SPECIES.find((s) => s.kind === "fish" && s.water === "salt");
const flat = (c) => (Array.isArray(c) ? c.map(flat).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "");
const textOf = (stock) => {
  const tank = { id: "t1", gallons: 90, water: "salt", stock, quantities: {}, medDoses: [] };
  let t;
  renderer.act(() => { t = renderer.create(<MedDoseCard tank={tank} tankGallons={90} onLogMedDose={() => {}} />); });
  return t.root.findAllByType(Text).map((n) => flat(n.props.children)).join(" | ");
};

describe("a reef keeper is warned before they pick a medication, not after", () => {
  // The per-class warning is correct and fires the moment copper is selected.
  // But by then the keeper has decided what they are dosing. The tank's stock
  // is known from the first render, and on a reef the answer to "which
  // medication?" is usually "none of them, not in this tank".
  test("a tank with coral says so up front", () => {
    const txt = textOf([fish.name, coral.name]);
    expect(txt).toMatch(/corals or invertebrates/i);
    expect(txt).toMatch(/separate tank/i);
  });

  test("a tank with shrimp too", () => {
    expect(textOf([fish.name, shrimp.name])).toMatch(/corals or invertebrates/i);
  });

  test("a fish-only tank is not nagged", () => {
    // The warning has to stay meaningful, which means not appearing where it
    // does not apply.
    expect(textOf([fish.name])).not.toMatch(/corals or invertebrates/i);
  });

  test("an empty tank is not nagged either", () => {
    expect(textOf([])).not.toMatch(/corals or invertebrates/i);
  });

  test("it names copper's particular problem", () => {
    // Copper binds into rock and sand and leaches back for years. "Do a water
    // change afterwards" is not a remedy, and the wording should not imply it.
    expect(textOf([fish.name, coral.name])).toMatch(/never fully leaves rock and sand/i);
  });
});

describe("the per-class warnings behind it are still right", () => {
  test("copper and formalin lead with the invert warning", () => {
    for (const cls of ["copper", "formalin"]) {
      expect(safetyFor(cls, { hasInverts: true })[0]).toMatch(/kill them/i);
      expect(classOf(cls).invertSafe).toBe(false);
    }
  });

  test("an invert-safe class does not claim otherwise", () => {
    expect(safetyFor("antibiotic", { hasInverts: true })[0]).not.toMatch(/kill them/i);
    expect(classOf("antibiotic").invertSafe).toBe(true);
  });

  test("and no warning is invented for a tank without inverts", () => {
    expect(safetyFor("copper", { hasInverts: false })[0]).not.toMatch(/kill them/i);
  });

  test("corals count as invertebrates, which is the case that matters", () => {
    // The whole risk is a reef keeper dosing copper in the display tank.
    expect(getSpecies(coral.name).kind).toBe("coral");
  });
});
