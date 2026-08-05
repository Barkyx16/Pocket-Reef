// Maps each disease name (from data/fishHealth.js) to its bundled illustration in
// assets/diseases/. Mirrors data/speciesImageMap.js — diseases without an image
// fall back to the emoji in the UI. require() paths are static so Metro bundles
// every image.
const diseaseImageMap = {
  "Ich (White Spot)": require("../assets/diseases/ich-white-spot.png"),
  "Fin Rot": require("../assets/diseases/fin-rot.png"),
  "Marine Velvet": require("../assets/diseases/marine-velvet.png"),
  "Swim Bladder Disorder": require("../assets/diseases/swim-bladder-disorder.png"),
  "Dropsy": require("../assets/diseases/dropsy.png"),
  "Popeye": require("../assets/diseases/popeye.png"),
  "Hole-in-the-Head": require("../assets/diseases/hole-in-the-head.png"),
  "Columnaris": require("../assets/diseases/columnaris.png"),
  "Gill Flukes": require("../assets/diseases/gill-flukes.png"),
  "Brooklynella": require("../assets/diseases/brooklynella.png"),
};

export function getDiseaseImage(name) {
  return diseaseImageMap[name] || null;
}
