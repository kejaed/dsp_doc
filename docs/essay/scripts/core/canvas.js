// DPR-aware canvas mounting. Each scene calls mountCanvas(parent,
// width, height) and gets back { canvas, ctx, width, height } where
// width/height are CSS pixels — drawing in those units works under
// any device pixel ratio.

export function mountCanvas(parent, width, height, opts = {}) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const c = document.createElement("canvas");
  c.width = Math.round(width * dpr);
  c.height = Math.round(height * dpr);
  c.style.width = width + "px";
  c.style.height = height + "px";
  if (opts.className) c.className = opts.className;
  parent.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas: c, ctx, width, height, dpr };
}

// Linear interpolation helper used everywhere.
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
