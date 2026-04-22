// Figure 7 — The resolution problem.
//
// Two targets at adjustable separation, both fired at by a tone-burst
// pulse of adjustable duration. The receiver sees a sum of two echoes;
// when they overlap (because the pulse is too long) the reader
// literally sees the targets merge into one blob.

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

  const state = { sepM: 30, tauMs: 12 };

  makeSlider(controls, {
    min: 5, max: 80, value: state.sepM, step: 1,
    label: "target separation", unit: " m",
    onInput: (v) => { state.sepM = v; redraw(); },
  });
  makeSlider(controls, {
    min: 1, max: 50, value: state.tauMs, step: 0.5,
    label: "pulse duration τ", unit: " ms",
    onInput: (v) => { state.tauMs = v; redraw(); },
  });

  const RANGE_CENTER_M = 600;
  const T_CENTER = (2 * RANGE_CENTER_M) / C;       // s
  const T_WINDOW = 0.18;                            // s shown
  const T0 = T_CENTER - T_WINDOW / 2;
  const T1 = T_CENTER + T_WINDOW / 2;

  function tToX(t) { return PAD + ((t - T0) / (T1 - T0)) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);

    // backdrop
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 28, W - 2 * PAD, H - 70);

    // axis ticks (in metres of range)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 540; R <= 660; R += 20) {
      const t = (2 * R) / C;
      const x = tToX(t);
      ctx.fillRect(x, H - 42, 1, 5);
      ctx.fillText(`${R} m`, x - 12, H - 28);
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText("range (round-trip time, mapped to metres)",
      PAD + 30, H - 10);

    // two targets at R0 - sep/2 and R0 + sep/2
    const R1 = RANGE_CENTER_M - state.sepM / 2;
    const R2 = RANGE_CENTER_M + state.sepM / 2;
    const t1 = (2 * R1) / C;
    const t2 = (2 * R2) / C;
    const tauS = state.tauMs / 1000;

    // Build the received signal y(t) = e1(t) + e2(t) where each ei is
    // a Hann-windowed 800 Hz burst of duration tau, peaked at ti.
    const samples = W - 2 * PAD;
    const sig = new Float32Array(samples);
    const fc = 800;
    for (let i = 0; i < samples; i++) {
      const t = T0 + (i / samples) * (T1 - T0);
      const e1 = burst(t, t1, tauS, fc);
      const e2 = burst(t, t2, tauS, fc);
      sig[i] = e1 + e2;
    }
    // envelope (smooth) — what the matched-filter / square-law detector
    // would actually see. We're showing |y|, sliding average ~ tau/4.
    const env = new Float32Array(samples);
    const win = Math.max(1, Math.round((tauS * 0.25 / (T1 - T0)) * samples));
    for (let i = 0; i < samples; i++) {
      let sum = 0, n = 0;
      for (let k = -win; k <= win; k++) {
        const j = i + k;
        if (j < 0 || j >= samples) continue;
        sum += Math.abs(sig[j]);
        n++;
      }
      env[i] = sum / n;
    }

    // plot envelope
    const yMid = H / 2;
    const amp = (H - 90) / 2;
    let mx = 0;
    for (let i = 0; i < samples; i++) if (env[i] > mx) mx = env[i];
    if (mx < 1e-6) mx = 1;

    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const y = yMid + amp - (env[i] / mx) * amp * 1.6;
      const x = PAD + i;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // markers for true target locations
    for (const [R, label] of [[R1, "target 1"], [R2, "target 2"]]) {
      const x = tToX((2 * R) / C);
      ctx.strokeStyle = "rgba(205, 58, 42, 0.65)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, H - 44);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(205, 58, 42, 0.85)";
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(label, x - 22, 24);
    }

    // verdict label: are they resolvable?
    const minResolveS = tauS;
    const dt = Math.abs(t2 - t1);
    const resolvable = dt > minResolveS;
    ctx.fillStyle = resolvable ? "#1f7f4a" : "#cd3a2a";
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillText(
      resolvable ? "two peaks visible" : "merged into one blob",
      W - 180, 22
    );
    ctx.fillStyle = "#222";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(`Δt = ${(dt * 1000).toFixed(1)} ms,  τ = ${state.tauMs} ms`,
      W - 230, 46);
  }

  function burst(t, t0, tau, fc) {
    const u = (t - t0) / tau;
    if (u < 0 || u > 1) return 0;
    const env = Math.sin(Math.PI * u);
    return env * Math.sin(2 * Math.PI * fc * (t - t0));
  }

  redraw();
}
