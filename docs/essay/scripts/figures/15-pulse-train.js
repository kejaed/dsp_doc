// Figure 15 — A train of pings.
//
// Time-axis ribbon showing N evenly-spaced pings, each followed by
// its echo. PRI (pulse repetition interval) and N are sliders. The
// figure's job is to make "we fire many pings" tactile.
//
// Below the time ribbon, the same N pings are stacked vertically
// into a slow-time / fast-time matrix — each row is one ping's
// receive trace. This is the data structure the next two figures
// will operate on.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";

const W = 720;
const RIBBON_H = 100;
const MATRIX_H = 180;
const GAP = 14;
const H = RIBBON_H + GAP + MATRIX_H + 30;
const PAD = 30;

const C = 1500;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { N: 8, PRI_ms: 200, R0: 1500 };

  makeSlider(controls, {
    min: 1, max: 32, value: state.N, step: 1,
    label: "N pings", unit: "",
    onInput: (v) => { state.N = v; redraw(); },
  });
  makeSlider(controls, {
    min: 50, max: 600, value: state.PRI_ms, step: 10,
    label: "PRI", unit: " ms",
    onInput: (v) => { state.PRI_ms = v; redraw(); },
  });

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    drawRibbon();
    drawMatrix();
  }

  function drawRibbon() {
    const yMid = RIBBON_H / 2;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 14, W - 2 * PAD, RIBBON_H - 28);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("transmit timeline (zoomed in)", PAD + 4, 10);

    const totalMs = Math.max(state.PRI_ms * state.N, state.PRI_ms * 1.2);
    const w = W - 2 * PAD;
    const tToX = (tms) => PAD + (tms / totalMs) * w;
    const tau_d_ms = (2 * state.R0 / C) * 1000;
    for (let n = 0; n < state.N; n++) {
      const tTx = n * state.PRI_ms;
      const tEcho = tTx + tau_d_ms;
      drawBurst(ctx, tToX(tTx), yMid, "#1f5fa8");
      if (tEcho < totalMs) {
        drawBurst(ctx, tToX(tEcho), yMid, "#cd3a2a");
      }
    }

    // ticks
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = '10px -apple-system, sans-serif';
    const tick = state.PRI_ms;
    for (let t = 0; t <= totalMs; t += tick) {
      const x = tToX(t);
      ctx.fillRect(x, RIBBON_H - 16, 1, 4);
    }
    ctx.fillText(`PRI = ${state.PRI_ms} ms · N = ${state.N}`, PAD + 4, RIBBON_H - 4);
  }

  function drawMatrix() {
    ctx.save();
    ctx.translate(0, RIBBON_H + GAP);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("the same data, stacked: each row = one ping's receive trace", PAD + 4, 10);

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 14, W - 2 * PAD, MATRIX_H - 28);

    const rowH = (MATRIX_H - 28) / state.N;
    const fastWindowMs = state.PRI_ms;
    const tau_d_ms = (2 * state.R0 / C) * 1000;
    const w = W - 2 * PAD;
    for (let n = 0; n < state.N; n++) {
      const yTop = 14 + n * rowH;
      const yMid = yTop + rowH / 2;
      // soft row dividers
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.moveTo(PAD, yTop);
      ctx.lineTo(W - PAD, yTop);
      ctx.stroke();
      // tx burst at t=0 of each row
      drawBurst(ctx, PAD + 8, yMid, "#1f5fa8", 0.5);
      // echo at tau_d of each row, scaled to fastWindowMs
      const xEcho = PAD + (tau_d_ms / fastWindowMs) * w;
      if (xEcho < W - PAD - 4) {
        drawBurst(ctx, xEcho, yMid, "#cd3a2a", 0.5);
      }
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(`#${n}`, 6, yMid + 3);
    }
    // axis label
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText("fast time (within one PRI) →", PAD + 4, MATRIX_H - 4);
    ctx.save();
    ctx.translate(W - 14, 14 + (MATRIX_H - 28) / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("slow time ↓ (ping #)", 0, 0);
    ctx.restore();
    ctx.restore();
  }

  function drawBurst(ctx, x, yMid, color, scale = 1) {
    const amp = 18 * scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const wPx = 18;
    for (let i = 0; i <= wPx; i++) {
      const u = i / wPx;
      const env = Math.sin(Math.PI * u);
      const y = yMid - env * amp * Math.sin(u * 4 * Math.PI * 2);
      if (i === 0) ctx.moveTo(x + i - wPx / 2, y);
      else ctx.lineTo(x + i - wPx / 2, y);
    }
    ctx.stroke();
  }

  redraw();
}
