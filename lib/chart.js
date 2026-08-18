// ─────────────────────────────────────────────────────────────────────────────
// Chart geometry.
//
// There is no charting library here and no react-native-svg — the app draws
// with Views so it stays Expo-Go-friendly, which has been a deliberate
// constraint since the first sparkline. A real line chart is still possible:
// dots are absolutely positioned, and the line between two dots is a 1px View
// rotated to the angle between them.
//
// All of that is arithmetic, and arithmetic in JSX is arithmetic nobody can
// test. It lives here instead, so the chart's correctness — points landing on
// the right dates, the target band sitting at the right height, a flat series
// not collapsing to a divide-by-zero — is checkable without rendering anything.
// ─────────────────────────────────────────────────────────────────────────────

import { instantOf, dayKey } from "./day";
import { records } from "./records";
import { round } from "./num";
const timeOf = (d) => instantOf(d);

// Pads a value range so the highest reading isn't glued to the ceiling, and so
// a dead-flat series still gets a sensible axis instead of zero height.
export function niceScale(values, band = null) {
  const all = [...values];
  if (band) all.push(band[0], band[1]);
  let min = Math.min(...all);
  let max = Math.max(...all);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };

  if (min === max) {
    // A flat series: invent a symmetric window around it so the line sits in
    // the middle rather than dividing by a zero span.
    const pad = Math.abs(min) * 0.1 || 1;
    return { min: round(min - pad, 4), max: round(max + pad, 4) };
  }

  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  // Values that can't go negative shouldn't be given negative axis space.
  if (Math.min(...values) >= 0 && min < 0) min = 0;
  return { min: round(min, 4), max: round(max, 4) };
}

// Lays out a dated series inside a box.
//
// `points` is [{ value, date }] in any order. Returns pixel positions with the
// origin at the TOP-LEFT, which is how React Native positions things — a higher
// reading has a SMALLER y.
export function layoutSeries(points = [], { width = 300, height = 140, band = null, from = null, to = null } = {}) {
  points = records(points);

  const clean = points
    .map((p) => ({ value: Number(p.value), time: timeOf(p.date), date: p.date }))
    .filter((p) => Number.isFinite(p.value) && !Number.isNaN(p.time))
    .sort((a, b) => a.time - b.time);

  if (!clean.length) return { dots: [], segments: [], scale: null, band: null, span: null };

  const tMin = from != null ? timeOf(from) : clean[0].time;
  const tMax = to != null ? timeOf(to) : clean[clean.length - 1].time;
  const tSpan = tMax - tMin;

  const scale = niceScale(clean.map((p) => p.value), band);
  const vSpan = scale.max - scale.min || 1;

  const xOf = (time) => (tSpan <= 0 ? width / 2 : ((time - tMin) / tSpan) * width);
  const yOf = (value) => height - ((value - scale.min) / vSpan) * height;

  const dots = clean.map((p) => ({
    x: round(xOf(p.time), 2),
    y: round(yOf(p.value), 2),
    value: p.value,
    date: p.date,
    time: p.time,
  }));

  // Each segment is a rotated 1px bar: anchored at the left dot, as long as the
  // distance to the next, turned by the angle between them.
  const segments = [];
  for (let i = 1; i < dots.length; i++) {
    const a = dots[i - 1];
    const b = dots[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (!length) continue;
    segments.push({
      x: a.x,
      y: a.y,
      length: round(length, 2),
      // Degrees, because that's what RN's rotate transform takes as a string.
      angle: round((Math.atan2(dy, dx) * 180) / Math.PI, 2),
    });
  }

  // The safe range as a rectangle, clipped to the plot. A band entirely outside
  // the visible values is dropped rather than drawn as a sliver at the edge.
  let bandBox = null;
  if (band) {
    const top = yOf(Math.min(band[1], scale.max));
    const bottom = yOf(Math.max(band[0], scale.min));
    if (bottom > 0 && top < height) {
      bandBox = { top: round(Math.max(0, top), 2), height: round(Math.max(1, Math.min(height, bottom) - Math.max(0, top)), 2) };
    }
  }

  return {
    dots,
    segments,
    scale,
    band: bandBox,
    span: { from: clean[0].date, to: clean[clean.length - 1].date, tMin, tMax },
    xOf,
  };
}

// Where dated events sit along the same time axis, so a water change lines up
// under the reading it moved. Events outside the plotted window are dropped —
// a marker pinned to the edge would claim a date it doesn't have.
export function layoutEvents(events = [], { width = 300, tMin, tMax } = {}) {
  events = records(events);

  const span = tMax - tMin;
  if (!(span > 0)) return [];
  return events
    .map((e) => ({ ...e, time: timeOf(e.date) }))
    .filter((e) => !Number.isNaN(e.time) && e.time >= tMin && e.time <= tMax)
    .map((e) => ({ ...e, x: round(((e.time - tMin) / span) * width, 2) }))
    .sort((a, b) => a.x - b.x);
}

// Evenly spaced date labels for the x-axis, always including both ends.
export function axisDates(tMin, tMax, count = 3) {
  if (!(tMax > tMin)) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    // Local, like every other date the app shows. toISOString() here labelled
    // the axis in UTC, so in a western timezone the first tick read as the day
    // before the first reading.
    out.push(dayKey(new Date(tMin + ((tMax - tMin) * i) / (count - 1))));
  }
  return out;
}
