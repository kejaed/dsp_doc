// Figure 2 — How fast it travels.
//
// Top-down view of a single ping radiating outward from a transducer
// at the centre. The wavefront is an expanding ring; the speed of
// that expansion changes with water temperature (and, slightly, depth
// and salinity, but we keep it to temperature here for simplicity).
//
// Slider: temperature (0 -> 30 °C). c is computed with a simplified
// Mackenzie-like fit; see the fn below. The "ruler" shows c in m/s
// and the time-of-flight to the visible ring radius.

import { mountCanvas, clamp } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { playPing } from "../core/audio.js";

const W = 720;
const H = 320;
const CENTER_X = W / 2;
const CENTER_Y = H / 2;
const PX_PER_M = 0.05;          // 50 m / px so 5 km fits
const PING_PERIOD_S = 4;        // wall-clock duration of one displayed ping cycle

// Cheap c(T) — accurate to ~5 m/s over 0–30 °C in fresh water. Real
// world cares about salinity and depth too; we don't.
function speedOfSound(tempC) {
  return 1402.4 + 5.04 * tempC - 0.054 * tempC * tempC + 0.00022 * Math.pow(tempC, 3);
}

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { tempC: 15, animating: true, t0: performance.now() / 1000 };

  makeSlider(controls, {
    min: 0, max: 30, value: state.tempC, step: 1,
    label: "water temperature", unit: " °C",
    onInput: (v) => { state.tempC = v; },
  });

  makeToggle(controls, {
    labelOff: "play ping", labelOn: "play ping",
    onToggle: (on) => {
      if (on) {
        playPing(700, 80);
        state.t0 = performance.now() / 1000;
        // pop the toggle back off after the ping fires
        setTimeout(() => {
          const btn = controls.querySelector(".scene-button");
          if (btn) btn.classList.remove("is-on");
        }, 120);
      }
    },
  });

  function frame(now) {
    const t = now / 1000;
    const elapsed = (t - state.t0) % PING_PERIOD_S;
    const c = speedOfSound(state.tempC);
    const radiusM = c * elapsed;
    const radiusPx = radiusM * PX_PER_M;

    ctx.clearRect(0, 0, W, H);

    // gridded backdrop
    ctx.fillStyle = "rgba(31, 95, 168, 0.03)";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let r = 1000 * PX_PER_M; r < W; r += 1000 * PX_PER_M) {
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // the expanding ping itself, with a subtle decay so successive
    // rings get faint as they leave the visible area
    if (radiusPx > 0 && radiusPx < W) {
      const alpha = clamp(1 - radiusPx / (W * 0.45), 0, 1);
      ctx.strokeStyle = `rgba(205, 58, 42, ${0.85 * alpha})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // transducer at centre
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 5, 0, Math.PI * 2);
    ctx.fill();

    // readouts
    ctx.fillStyle = "#222";
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`c = ${c.toFixed(0)} m/s`, 14, 24);
    ctx.fillText(`elapsed: ${(elapsed * 1000).toFixed(0)} ms`, 14, 46);
    ctx.fillText(`reached: ${(radiusM / 1000).toFixed(2)} km`, 14, 68);

    // distance ring labels (1, 2, 3, 4 km)
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    for (let r = 1; r <= 4; r++) {
      const px = r * 1000 * PX_PER_M;
      if (px > W / 2) break;
      ctx.fillText(`${r} km`, CENTER_X + px + 4, CENTER_Y - 4);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
