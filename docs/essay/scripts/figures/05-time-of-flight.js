// Figure 5 — Range from time of flight.
//
// A 1D time-trace with a single echo blip at some unknown time. The
// reader drags a vertical "ruler" along the time axis to align with
// the echo; the displayed value reads the implied range R = c·t/2.
// No animation; pure interaction. Used to land "you measure time, you
// get range".

import { mountCanvas, clamp } from "../core/canvas.js";

const W = 720;
const H = 220;
const PAD = 30;
const C = 1500;
const T_MAX = 6;       // seconds shown on the axis
const TARGET_T = 3.4;  // hidden "true" time-of-flight; picked once per page load

export function mount(root) {
  const { ctx, canvas } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  controls.style.fontStyle = "italic";
  controls.style.fontFamily = 'Charter, "Iowan Old Style", Georgia, serif';
  controls.style.color = "#666";
  controls.textContent = "drag the dashed ruler in the figure to line it up with the echo";
  root.appendChild(controls);

  const state = { rulerT: 1.5, dragging: false };

  function tToX(t) { return PAD + (t / T_MAX) * (W - 2 * PAD); }
  function xToT(x) { return ((x - PAD) / (W - 2 * PAD)) * T_MAX; }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    state.dragging = true;
    updateFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    updateFromEvent(e);
  });
  canvas.addEventListener("pointerup", (e) => { state.dragging = false; });
  canvas.addEventListener("pointercancel", () => { state.dragging = false; });

  function updateFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    state.rulerT = clamp(xToT(x), 0, T_MAX);
    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, W, H);

    // axis box
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 26, W - 2 * PAD, H - 60);

    // axis ticks (seconds)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let s = 0; s <= T_MAX; s++) {
      const x = tToX(s);
      ctx.fillRect(x, H - 32, 1, 5);
      ctx.fillText(`${s}s`, x - 5, H - 16);
    }

    // outgoing pulse at t=0
    drawBurst(ctx, tToX(0), H / 2, "#1f5fa8");
    // echo at hidden TARGET_T
    drawBurst(ctx, tToX(TARGET_T), H / 2, "#cd3a2a");
    // background noise: a few low-amplitude blips for realism
    const seed = 42;
    for (let i = 0; i < 12; i++) {
      const n = (seed * (i + 1) * 9301 + 49297) % 233280;
      const tt = (n / 233280) * T_MAX;
      const a = ((n / 5) % 233280) / 233280 * 6 + 2;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(tToX(tt), H / 2 - a, 1, a * 2);
    }

    // ruler
    const rx = tToX(state.rulerT);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(rx, 18);
    ctx.lineTo(rx, H - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // ruler handle
    ctx.fillStyle = "#222";
    ctx.fillRect(rx - 6, 14, 12, 6);

    // readouts on the ruler
    const R = (C * state.rulerT) / 2;
    ctx.fillStyle = "#222";
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillText(`t = ${state.rulerT.toFixed(2)} s`, rx + 10, 32);
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText(`R = c·t/2 = ${R.toFixed(0)} m`, rx + 10, 50);

    // legend at top
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText("transmit", tToX(0) - 12, 18);
    ctx.fillText("echo", tToX(TARGET_T) - 8, 18);
  }

  function drawBurst(ctx, x, yMid, color) {
    const amp = 24;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const w = 32;
    for (let i = 0; i <= w; i++) {
      const u = i / w;
      const env = Math.sin(Math.PI * u);
      const y = yMid - env * amp * Math.sin(u * 4 * Math.PI * 2);
      if (i === 0) ctx.moveTo(x + i - w / 2, y);
      else ctx.lineTo(x + i - w / 2, y);
    }
    ctx.stroke();
  }

  redraw();
}
