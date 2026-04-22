// Tiny pure-JS DSP toolkit. Used by every figure that does signal
// processing on the fly. Verified by eye against the Python sonar
// package; the JS routines here are not as fast or robust as numpy /
// scipy but they're plenty for figure-scale data (hundreds to a few
// thousand samples). All complex signals are stored as { re, im }
// pairs of Float32Array (or plain arrays).

// ---------- Cooley–Tukey radix-2 FFT, in place. -----------------------
// `re` and `im` are mutated. Length must be a power of two.

export function fftInPlace(re, im, inverse = false) {
  const n = re.length;
  if (n !== im.length) throw new Error("re/im length mismatch");
  if ((n & (n - 1)) !== 0) throw new Error("FFT length must be a power of two");

  // bit-reverse permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // butterflies
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = i + k + half;
        const tRe = re[b] * wRe - im[b] * wIm;
        const tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const newRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = newRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

// Convenience: FFT of a real signal, returns { re, im } arrays of
// the next power of two, zero-padded as needed.
export function fft(real) {
  const n = nextPow2(real.length);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < real.length; i++) re[i] = real[i];
  fftInPlace(re, im, false);
  return { re, im };
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ---------- LFM (linear-FM) chirp at complex baseband. ----------------
// s(t) = exp(j π (B/τ) t²) for t in [0, τ).

export function lfmChirp(B, tau, Fs) {
  const n = Math.max(1, Math.round(tau * Fs));
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const k = B / tau;
  for (let i = 0; i < n; i++) {
    const t = i / Fs;
    const ph = Math.PI * k * t * t;
    re[i] = Math.cos(ph);
    im[i] = Math.sin(ph);
  }
  return { re, im };
}

// Real (passband) LFM chirp at carrier fc — what a transducer would
// actually radiate. Used for spectrogram visualisations and audio.
export function lfmChirpReal(B, tau, Fs, fc, f0Offset = 0) {
  const bb = lfmChirp(B, tau, Fs);
  const n = bb.re.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / Fs;
    const ph = 2 * Math.PI * (fc + f0Offset) * t;
    // Re{ s_bb(t) e^{j 2π fc t} }
    out[i] = bb.re[i] * Math.cos(ph) - bb.im[i] * Math.sin(ph);
  }
  return out;
}

// ---------- Cross-correlation via FFT. --------------------------------
// xcorr(x, h) returns y[n] = sum_k x[n+k] conj(h[k]). Same length as x.
// Both inputs are { re, im }.

export function xcorrFFT(x, h) {
  const N = x.re.length;
  const M = h.re.length;
  const L = nextPow2(N + M - 1);

  const Xre = new Float32Array(L), Xim = new Float32Array(L);
  for (let i = 0; i < N; i++) { Xre[i] = x.re[i]; Xim[i] = x.im[i]; }
  fftInPlace(Xre, Xim, false);

  const Hre = new Float32Array(L), Him = new Float32Array(L);
  for (let i = 0; i < M; i++) { Hre[i] = h.re[i]; Him[i] = h.im[i]; }
  fftInPlace(Hre, Him, false);

  // Y = X * conj(H)
  const Yre = new Float32Array(L), Yim = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    Yre[i] = Xre[i] * Hre[i] + Xim[i] * Him[i];
    Yim[i] = Xim[i] * Hre[i] - Xre[i] * Him[i];
  }
  fftInPlace(Yre, Yim, true);
  // truncate to N (delay-aligned: y[k] is correlation at lag k)
  return { re: Yre.subarray(0, N), im: Yim.subarray(0, N) };
}

// Magnitude of a complex array.
export function magnitude(z) {
  const n = z.re.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.hypot(z.re[i], z.im[i]);
  return out;
}

// 20 log10 |z|, floored at -120 dB to keep plots tidy.
export function magnitudeDB(z, floor = -120) {
  const n = z.re.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = Math.hypot(z.re[i], z.im[i]);
    out[i] = m > 0 ? Math.max(20 * Math.log10(m), floor) : floor;
  }
  return out;
}

// ---------- Box–Muller Gaussian noise (complex). ----------------------

export function whiteNoise(n, sigma = 1) {
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const s = sigma / Math.SQRT2;
  for (let i = 0; i < n; i++) {
    let u1 = Math.random(), u2 = Math.random();
    if (u1 < 1e-12) u1 = 1e-12;
    const r = Math.sqrt(-2 * Math.log(u1));
    const t = 2 * Math.PI * u2;
    re[i] = s * r * Math.cos(t);
    im[i] = s * r * Math.sin(t);
  }
  return { re, im };
}

// Real (one-sided) Gaussian noise — used when we just want a noisy
// time-trace for plotting.
export function whiteNoiseReal(n, sigma = 1) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let u1 = Math.random(), u2 = Math.random();
    if (u1 < 1e-12) u1 = 1e-12;
    out[i] = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return out;
}

// ---------- Echo at a given range / velocity. -------------------------
// Generates the matched-filter input for a single point target by
// shifting a chirp template by tau_d = 2 R0 / c and applying narrow-band
// Doppler f_d = -2 v fc / c. For the essay's needs we don't bother with
// fractional-sample fidelity — we round to the nearest sample, which is
// fine because the chirps span hundreds of samples.

export const C_WATER = 1500;

export function echo({ chirp, R0, v = 0, fc, Fs, nOut, amplitude = 1 }) {
  const re = new Float32Array(nOut);
  const im = new Float32Array(nOut);
  const tauD = (2 * R0) / C_WATER;
  const i0 = Math.round(tauD * Fs);
  const fd = -(2 * v * fc) / C_WATER;
  const N = chirp.re.length;
  for (let k = 0; k < N; k++) {
    const idx = i0 + k;
    if (idx < 0 || idx >= nOut) continue;
    const t = k / Fs;
    const c = Math.cos(2 * Math.PI * fd * t);
    const s = Math.sin(2 * Math.PI * fd * t);
    // (chirp[k]) * exp(j 2π fd t) * amplitude
    re[idx] += amplitude * (chirp.re[k] * c - chirp.im[k] * s);
    im[idx] += amplitude * (chirp.re[k] * s + chirp.im[k] * c);
  }
  return { re, im };
}

// ---------- Range–Doppler map. ----------------------------------------
// Input: pulses[k] for k = 0..N_pulse-1, each a complex array of length
// n_range (already matched-filtered). Output: RD magnitude (dB) of
// shape [N_pulse, n_range], plus the velocity axis.

export function rangeDopplerMap(pulses, PRI, fc) {
  const N = pulses.length;
  if (N === 0) return null;
  const nR = pulses[0].re.length;
  const W = hannWindow(N);
  const NF = nextPow2(N);
  const reCol = new Float32Array(NF), imCol = new Float32Array(NF);

  // We'll fill an output matrix of shape [NF, nR] in dB
  const outDB = new Array(NF);
  for (let i = 0; i < NF; i++) outDB[i] = new Float32Array(nR);

  for (let r = 0; r < nR; r++) {
    reCol.fill(0); imCol.fill(0);
    for (let k = 0; k < N; k++) {
      reCol[k] = pulses[k].re[r] * W[k];
      imCol[k] = pulses[k].im[r] * W[k];
    }
    fftInPlace(reCol, imCol, false);
    // fftshift along Doppler
    for (let f = 0; f < NF; f++) {
      const fs = (f + Math.floor(NF / 2)) % NF;
      const m = Math.hypot(reCol[fs], imCol[fs]);
      outDB[f][r] = m > 0 ? 20 * Math.log10(m) : -120;
    }
  }

  // velocity axis (Hz -> m/s)
  const fdAxis = new Float32Array(NF);
  for (let f = 0; f < NF; f++) {
    const fIdx = f - Math.floor(NF / 2);
    fdAxis[f] = fIdx / (NF * PRI);
  }
  const vAxis = new Float32Array(NF);
  for (let f = 0; f < NF; f++) vAxis[f] = -C_WATER * fdAxis[f] / (2 * fc);

  return { rdDB: outDB, fdAxis, vAxis, nR };
}

export function hannWindow(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1 || 1)));
  }
  return w;
}

// ---------- CA-CFAR threshold. ----------------------------------------
// Returns thresh[i] = alpha * (mean of training cells around i).
// Edges (the first/last train+guard samples) get the global mean as a
// stand-in — they're never the cell-under-test for plotting purposes.

export function caCfarThreshold(power, train = 16, guard = 2, pfa = 1e-4) {
  const N = power.length;
  const Ntot = 2 * train;
  const alpha = Ntot * (Math.pow(pfa, -1 / Ntot) - 1);
  const out = new Float32Array(N);

  // global mean fallback for the edges
  let gm = 0;
  for (let i = 0; i < N; i++) gm += power[i];
  gm /= N;

  const edge = train + guard;
  for (let i = 0; i < N; i++) {
    if (i < edge || i >= N - edge) {
      out[i] = alpha * gm;
      continue;
    }
    let s = 0;
    for (let k = -train - guard; k < -guard; k++) s += power[i + k];
    for (let k = guard + 1; k <= guard + train; k++) s += power[i + k];
    out[i] = alpha * (s / Ntot);
  }
  return { threshold: out, alpha };
}

// ---------- Convenience: power = |z|² ---------------------------------

export function powerOf(z) {
  const n = z.re.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = z.re[i] * z.re[i] + z.im[i] * z.im[i];
  return out;
}

// Sum two complex signals in place (b is added to a).
export function addInPlace(a, b) {
  const n = Math.min(a.re.length, b.re.length);
  for (let i = 0; i < n; i++) {
    a.re[i] += b.re[i];
    a.im[i] += b.im[i];
  }
}

// ---------- Propagation / absorption ----------------------------------
// Thorp absorption coefficient in dB/km (f in Hz).

export function thorpDbPerKm(f) {
  const fk = f / 1e3;
  const f2 = fk * fk;
  return 0.11 * f2 / (1 + f2)
       + 44 * f2 / (4100 + f2)
       + 2.75e-4 * f2
       + 0.003;
}

// One-way TL in dB: 20 log10 R + alpha(f) * R / 1000.
export function transmissionLossDb(R, fHz) {
  const a = thorpDbPerKm(fHz);
  return 20 * Math.log10(Math.max(1, R)) + a * R * 1e-3;
}
