// Figure 13 — A target on the move.
//
// Side-view scene: a transducer on the left, a target moving along
// the range axis at radial velocity v. Slider sets v. We display a
// looped ping cycle: pulse goes out, hits the target (at its position
// at the time of arrival, if we wanted to be precise — for a textbook
// we just use R0 and pretend), comes back at a frequency shifted by
// the Doppler shift fd = -2 v fc / c (negative for receding targets,
// positive for approaching).
//
// Audio button: plays the original tone followed by the Doppler-
// shifted echo so the reader can hear the pitch difference.

import { mountCanvas, clamp } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { playPing } from "../core/audio.js";
import { C_WATER } from "../core/dsp.js";

const W = 720;
const SCENE_H = 180;
const TIME_H = 130;
const GAP = 12;
const H = SCENE_H + GAP + TIME_H;

const FC_HZ = 700;             // sonar carrier (used for f_d math AND audio pitch)
const R0 = 1500;
const SCENE_LEFT = 50;
const SCENE_RIGHT = W - 30;
const SCENE_W = SCENE_RIGHT - SCENE_LEFT;
const RANGE_MAX = 3500;

const PING_INTERVAL_S = 4.0;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = {
    v: 8,         // m/s (positive = receding)
    t0: performance.now() / 1000,
  };

  makeSlider(controls, {
    min: -25, max: 25, value: state.v, step: 0.5,
    label: "target velocity v", unit: " m/s",
    onInput: (v) => { state.v = v; },
  });

  makeToggle(controls, {
    labelOff: "play tx + echo", labelOn: "play tx + echo",
    onToggle: (on) => {
      if (on) {
        const fd = -(2 * state.v * FC_HZ) / C_WATER;
        playPing(FC_HZ, 200);
        setTimeout(() => playPing(FC_HZ + fd, 200), 280);
        setTimeout(() => {
          const btn = controls.querySelector(".scene-button");
          if (btn) btn.classList.remove("is-on");
        }, 540);
      }
    },
  });

  function rangeToX(R) {
    return SCENE_LEFT + (R / RANGE_MAX) * SCENE_W;
  }

  function frame(now) {
    const t = (now / 1000) - state.t0;
    ctx.clearRect(0, 0, W, H);

    // scene background
    ctx.fillStyle = "rgba(31, 95, 168, 0.06)";
    ctx.fillRect(0, 0, W, SCENE_H);

    // surface line
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(W, 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText("water surface", 8, 18);

    // distance ticks
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    for (let r = 1000; r <= 3000; r += 1000) {
      const x = rangeToX(r);
      ctx.fillRect(x, SCENE_H - 14, 1, 6);
      ctx.fillText(`${r/1000} km`, x - 12, SCENE_H - 2);
    }

    // transducer
    const tx_x = SCENE_LEFT;
    const tx_y = SCENE_H / 2;
    ctx.fillStyle = "#222";
    ctx.fillRect(tx_x - 12, tx_y - 8, 12, 16);

    // target moves; for visualisation, oscillate around R0 so the
    // motion is visible but bounded
    const targetR = R0 + state.v * (Math.sin(t * 0.5) * 50 / 25);
    const tg_x = rangeToX(targetR);
    const tg_y = tx_y;
    ctx.fillStyle = "#cd3a2a";
    ctx.beginPath();
    ctx.arc(tg_x, tg_y, 9, 0, Math.PI * 2);
    ctx.fill();
    // velocity arrow
    if (Math.abs(state.v) > 0.1) {
      const dir = Math.sign(state.v);
      const len = clamp(Math.abs(state.v) * 1.5, 6, 40);
      ctx.strokeStyle = "#cd3a2a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tg_x, tg_y - 22);
      ctx.lineTo(tg_x + dir * len, tg_y - 22);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(tg_x + dir * len, tg_y - 22);
      ctx.lineTo(tg_x + dir * (len - 5), tg_y - 22 - 4);
      ctx.lineTo(tg_x + dir * (len - 5), tg_y - 22 + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`v = ${state.v.toFixed(1)} m/s`, tg_x - 24, tg_y + 26);

    // animate the ping cycle
    const cyclePhase = (t % PING_INTERVAL_S) / PING_INTERVAL_S;  // 0..1
    const halfTau = R0 / C_WATER;       // outbound ~1 s
    const totalTau = 2 * halfTau;
    const cycleSecs = cyclePhase * PING_INTERVAL_S;

    if (cycleSecs < halfTau) {
      const u = cycleSecs / halfTau;
      drawWavefront(ctx, tx_x + u * (tg_x - tx_x), tx_y, "#1f5fa8");
    } else if (cycleSecs < totalTau) {
      const u = (cycleSecs - halfTau) / halfTau;
      drawWavefront(ctx, tg_x - u * (tg_x - tx_x), tx_y, "#cd3a2a");
    }

    // Doppler readout panel below
    drawDoppler(ctx);

    requestAnimationFrame(frame);
  }

  function drawWavefront(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawDoppler(ctx) {
    ctx.save();
    ctx.translate(0, SCENE_H + GAP);
    const w = W, h = TIME_H;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(40, 14, w - 80, h - 28);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("transmit and echo waveforms (centred at fc, time-stretched)", 46, 10);

    const fd = -(2 * state.v * FC_HZ) / C_WATER;
    const fEcho = FC_HZ + fd;

    const yMid = h / 2;
    const amp = 28;

    // Tx waveform on the left half
    const half = (w - 80) / 2;
    drawSineRow(ctx, 40, yMid, half - 8, FC_HZ, "#1f5fa8", "transmit (fc)");
    drawSineRow(ctx, 40 + half + 8, yMid, half - 8, fEcho, "#cd3a2a",
      `echo  fc + fd  =  ${(fEcho).toFixed(0)} Hz`);

    // formula at the bottom
    ctx.fillStyle = "#222";
    ctx.font = 'italic 12px Charter, "Iowan Old Style", Georgia, serif';
    const dir = state.v >= 0 ? "receding" : "approaching";
    ctx.fillText(
      `fd = −2·v·fc/c = ${fd.toFixed(1)} Hz   (${dir} target)`,
      W / 2 - 130, h - 6
    );
    ctx.restore();
  }

  function drawSineRow(ctx, x0, yMid, w, freq, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    const cyclesShown = Math.max(1, freq / 100);  // squeeze higher frequencies a bit
    const visualFreq = cyclesShown / w;           // cycles per pixel
    ctx.beginPath();
    for (let xi = 0; xi <= w; xi++) {
      const v = Math.sin(2 * Math.PI * visualFreq * xi);
      const y = yMid - v * 22;
      if (xi === 0) ctx.moveTo(x0 + xi, y); else ctx.lineTo(x0 + xi, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(label, x0 + 2, yMid - 30);
  }

  requestAnimationFrame(frame);
}
