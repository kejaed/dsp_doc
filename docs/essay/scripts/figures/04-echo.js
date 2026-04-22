// Figure 4 — Echoes from a target.
//
// Side-view scene: the transducer is on the left, water stretches to
// the right, a draggable target sits at some range. Press "ping" and
// watch a pulse travel out, hit the target, and bounce back. The
// time-axis at the bottom records both the outgoing pulse and the
// return.
//
// Slider: target range R0 (200 → 4000 m).

import { mountCanvas, clamp } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { playPing } from "../core/audio.js";

const W = 720;
const SCENE_H = 150;
const TIME_H = 130;
const GAP = 12;
const H = SCENE_H + GAP + TIME_H;

const C = 1500;
const SCENE_LEFT = 50;
const SCENE_RIGHT = W - 30;
const SCENE_W = SCENE_RIGHT - SCENE_LEFT;
const RANGE_MAX_M = 4500;

const TIMELINE_LEFT = 50;
const TIMELINE_RIGHT = W - 30;
const TIMELINE_W = TIMELINE_RIGHT - TIMELINE_LEFT;
const TIMELINE_MAX_S = 6;     // 6 s window covers 4.5 km round-trip + margin

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = {
    R0: 1500,
    pingT0: -10, // seconds since the figure started
    startedAt: performance.now() / 1000,
  };

  makeSlider(controls, {
    min: 200, max: 4000, value: state.R0, step: 50,
    label: "target range R₀", unit: " m",
    onInput: (v) => { state.R0 = v; },
  });

  makeToggle(controls, {
    labelOff: "fire ping", labelOn: "fire ping",
    onToggle: (on) => {
      if (on) {
        state.pingT0 = (performance.now() / 1000) - state.startedAt;
        playPing(700, 80);
        setTimeout(() => {
          const btn = controls.querySelector(".scene-button");
          if (btn) btn.classList.remove("is-on");
        }, 120);
      }
    },
  });

  function rangeToX(R) {
    return SCENE_LEFT + (R / RANGE_MAX_M) * SCENE_W;
  }
  function timeToX(t) {
    return TIMELINE_LEFT + (t / TIMELINE_MAX_S) * TIMELINE_W;
  }

  function frame(now) {
    const t = (now / 1000) - state.startedAt;
    ctx.clearRect(0, 0, W, H);

    // scene background — water
    ctx.fillStyle = "rgba(31, 95, 168, 0.06)";
    ctx.fillRect(0, 0, W, SCENE_H);

    // surface line
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(W, 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText("water surface", 8, 18);

    // distance ticks
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    for (let r = 1000; r <= 4000; r += 1000) {
      const x = rangeToX(r);
      ctx.fillRect(x, SCENE_H - 14, 1, 6);
      ctx.fillText(`${r/1000} km`, x - 12, SCENE_H - 2);
    }

    // transducer
    const tx_x = SCENE_LEFT;
    const tx_y = SCENE_H / 2;
    ctx.fillStyle = "#222";
    ctx.fillRect(tx_x - 12, tx_y - 8, 12, 16);
    ctx.fillStyle = "#222";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText("transducer", tx_x - 6, tx_y - 14);

    // target
    const tg_x = rangeToX(state.R0);
    const tg_y = tx_y;
    ctx.fillStyle = "#cd3a2a";
    ctx.beginPath();
    ctx.arc(tg_x, tg_y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(`target @ ${state.R0} m`, tg_x - 30, tg_y + 26);

    // ping pulse
    const dt = t - state.pingT0;
    if (dt >= 0 && dt < TIMELINE_MAX_S) {
      const tauD = (2 * state.R0) / C;
      // outbound (0 -> tauD/2)
      const halfTau = tauD / 2;
      if (dt < halfTau) {
        const px = tx_x + (dt / halfTau) * (tg_x - tx_x);
        drawPulse(ctx, px, tx_y, "#1f5fa8");
      } else if (dt < tauD) {
        // return
        const frac = (dt - halfTau) / halfTau;
        const px = tg_x - frac * (tg_x - tx_x);
        drawPulse(ctx, px, tx_y, "#cd3a2a");
      }
    }

    // ---- time axis below ----
    drawTimeline(ctx, t);

    requestAnimationFrame(frame);
  }

  function drawTimeline(ctx, t) {
    const y0 = SCENE_H + GAP;
    ctx.save();
    ctx.translate(0, y0);
    // backdrop
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(TIMELINE_LEFT, 14, TIMELINE_W, TIME_H - 28);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("transducer signal vs time", TIMELINE_LEFT, 10);

    // ticks
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let s = 0; s <= TIMELINE_MAX_S; s++) {
      const x = timeToX(s);
      ctx.fillRect(x, TIME_H - 18, 1, 5);
      ctx.fillText(`${s}s`, x - 5, TIME_H - 4);
    }

    // outgoing burst at t=pingT0
    const dt = t - state.pingT0;
    if (state.pingT0 >= 0) {
      const xOut = timeToX(0);
      drawBurst(ctx, xOut, "#1f5fa8");
      // echo at t = tauD
      const tauD = (2 * state.R0) / C;
      if (tauD <= TIMELINE_MAX_S && dt > tauD) {
        const xEcho = timeToX(tauD);
        drawBurst(ctx, xEcho, "#cd3a2a");
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillText(`τ_d = 2R₀/c = ${(tauD * 1000).toFixed(0)} ms`,
          xEcho - 60, 30);
      }
      // playhead
      if (dt < TIMELINE_MAX_S) {
        const xNow = timeToX(dt);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.moveTo(xNow, 14);
        ctx.lineTo(xNow, TIME_H - 14);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillText("press 'fire ping' to send a pulse", W / 2 - 110, TIME_H / 2 + 4);
    }
    ctx.restore();
  }

  function drawBurst(ctx, x, color) {
    const yMid = TIME_H / 2;
    const amp = 28;
    const cycles = 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const w = 32;
    for (let i = 0; i <= w; i++) {
      const u = i / w;
      const env = Math.sin(Math.PI * u);
      const ph = u * cycles * 2 * Math.PI;
      const y = yMid - env * amp * Math.sin(ph);
      if (i === 0) ctx.moveTo(x + i, y); else ctx.lineTo(x + i, y);
    }
    ctx.stroke();
  }

  function drawPulse(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  requestAnimationFrame(frame);
}
