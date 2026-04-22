// Figure 8 — Bandwidth IS resolution.
//
// Same two-target scene as Figure 7, but the slider is now bandwidth
// B (Hz) and the live readout shows the implied range resolution
// Δr = c / (2B). Pulse duration is held constant; instead, the figure
// imagines we have replaced the tone burst with something of bandwidth
// B (a chirp, which we'll meet next), and shows what resolution that
// gives.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";

const W = 720;
const H = 280;
const PAD = 30;
const C = 1500;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { sepM: 18, B_Hz: 200 };

  makeSlider(controls, {
    min: 4, max: 60, value: state.sepM, step: 1,
    label: "target separation", unit: " m",
    onInput: (v) => { state.sepM = v; redraw(); },
  });
  makeSlider(controls, {
    min: 30, max: 4000, value: state.B_Hz, step: 10,
    label: "bandwidth B", unit: " Hz",
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v.toFixed(0)} Hz`,
    onInput: (v) => { state.B_Hz = v; redraw(); },
  });

  const RANGE_CENTER_M = 600;
  const T_CENTER = (2 * RANGE_CENTER_M) / C;
  const T_WINDOW = 0.06;
  const T0 = T_CENTER - T_WINDOW / 2;
  const T1 = T_CENTER + T_WINDOW / 2;

  function tToX(t) { return PAD + ((t - T0) / (T1 - T0)) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 28, W - 2 * PAD, H - 70);

    // axis ticks (m)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 580; R <= 620; R += 5) {
      const t = (2 * R) / C;
      const x = tToX(t);
      ctx.fillRect(x, H - 42, 1, 5);
      ctx.fillText(`${R} m`, x - 12, H - 28);
    }

    // After matched filtering, a pulse of bandwidth B compresses to a
    // sinc-like main lobe of width ~ 1/B in time, which is c/(2B) in
    // range. Approximate the response as a normalised sinc.
    const dr = C / (2 * state.B_Hz);
    const R1 = RANGE_CENTER_M - state.sepM / 2;
    const R2 = RANGE_CENTER_M + state.sepM / 2;
    const samples = W - 2 * PAD;
    const env = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const t = T0 + (i / samples) * (T1 - T0);
      const R = (C * t) / 2;
      const a = sincResponse(R - R1, dr) + sincResponse(R - R2, dr);
      env[i] = Math.abs(a);
    }
    let mx = 0;
    for (let i = 0; i < samples; i++) if (env[i] > mx) mx = env[i];
    if (mx < 1e-6) mx = 1;

    const yMid = H / 2;
    const amp = (H - 90) / 2;
    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const y = yMid + amp - (env[i] / mx) * amp * 1.7;
      const x = PAD + i;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // true target markers
    for (const [R, label] of [[R1, "1"], [R2, "2"]]) {
      const x = tToX((2 * R) / C);
      ctx.strokeStyle = "rgba(205, 58, 42, 0.55)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, H - 44);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(205, 58, 42, 0.85)";
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(label, x - 3, 24);
    }

    // Δr bracket — visualises c/(2B) on the same range axis
    const xLow = tToX((2 * (RANGE_CENTER_M - dr / 2)) / C);
    const xHigh = tToX((2 * (RANGE_CENTER_M + dr / 2)) / C);
    const yBracket = 50;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.moveTo(xLow, yBracket); ctx.lineTo(xLow, yBracket + 6);
    ctx.moveTo(xHigh, yBracket); ctx.lineTo(xHigh, yBracket + 6);
    ctx.moveTo(xLow, yBracket + 3); ctx.lineTo(xHigh, yBracket + 3);
    ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`Δr = c/(2B) = ${dr.toFixed(2)} m`,
      (xLow + xHigh) / 2 - 50, yBracket - 4);

    // verdict
    const resolvable = state.sepM > dr;
    ctx.fillStyle = resolvable ? "#1f7f4a" : "#cd3a2a";
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillText(
      resolvable ? "two peaks resolved" : "below resolution — they merge",
      W - 230, 22
    );
  }

  function sincResponse(dR, dr) {
    // peak amplitude 1, first nulls at dR = ±dr
    const x = (dR / dr) * Math.PI;
    if (Math.abs(x) < 1e-9) return 1;
    return Math.sin(x) / x;
  }

  redraw();
}
