// Maps each banner id (from BANNERS in core.js) to its bundled artwork in
// assets/banners/. Mirrors data/speciesImageMap.js — a banner without an image
// falls back to its gradient. require() paths are static so Metro bundles all.
const bannerImageMap = {
  reef: require("../assets/banners/reef.jpg"),
  tide: require("../assets/banners/tide.jpg"),
  coral: require("../assets/banners/coral.jpg"),
  kelp: require("../assets/banners/kelp.jpg"),
  lagoon: require("../assets/banners/lagoon.jpg"),
  sunset: require("../assets/banners/sunset.jpg"),
  anemone: require("../assets/banners/anemone.jpg"),
  abyss: require("../assets/banners/abyss.jpg"),
  aurora: require("../assets/banners/aurora.jpg"),
  amber: require("../assets/banners/amber.jpg"),
  jade: require("../assets/banners/jade.jpg"),
  royal: require("../assets/banners/royal.jpg"),
  magenta: require("../assets/banners/magenta.jpg"),
  teal: require("../assets/banners/teal.jpg"),
  ember: require("../assets/banners/ember.jpg"),
  frost: require("../assets/banners/frost.jpg"),
  violet: require("../assets/banners/violet.jpg"),
  gold: require("../assets/banners/gold.jpg"),
  prism: require("../assets/banners/prism.jpg"),
  obsidian: require("../assets/banners/obsidian.jpg"),
  legend: require("../assets/banners/legend.jpg"),
};

export function getBannerImage(id) {
  return bannerImageMap[id] || null;
}
