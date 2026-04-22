# Sonar — A Ciechanowski-Style Essay

## What this is

A long-form, single-page interactive essay that builds an intuitive
explanation of how active sonar works, starting from "what is a sound
wave in water" and ending at "the box on the destroyer says there's a
submarine at 4 km moving 5 m/s away from us." Written for a curious
technical reader (engineer / scientist / hobbyist) with high-school
physics — **not** for someone who already knows DSP.

Visual model: <https://ciechanow.ski/gps/>, <https://ciechanow.ski/sound/>,
<https://ciechanow.ski/moon/>, <https://ciechanow.ski/airfoil/>.
Long body of serif prose, ~25 hand-built canvas figures threaded
through it, each with one or two sliders that let the reader poke at
the physics. No code shown, no dropdowns, no library brand.

This document lives in `docs/essay/PLAN.md`. We commit the essay on
`master` so GitHub Pages serves it at
<https://kejaed.github.io/dsp_doc/essay/> from `master:/docs/essay/`,
alongside the existing Quarto demo at `master:/docs/`.

## Tech stack (final)

- **Vanilla HTML + ES modules**, no build tool. `index.html` `<script
  type="module" src="scripts/boot.js">`-loads the figure registry and
  every figure module in turn.
- **HTML5 Canvas 2D** for every figure. No WebGL, no Three.js, no
  Plot/Plotly/D3. Each figure's render function takes the current
  slider values and re-paints the canvas in <16 ms.
- **Pure JS DSP** in `scripts/core/dsp.js`: tiny radix-2 FFT, LFM
  generator, complex multiply, cross-correlation, Box–Muller noise,
  range–Doppler, CA-CFAR. ~500 lines total — small enough to read,
  fast enough to run interactively.
- **KaTeX** (self-hosted, ~75 KB JS + ~200 KB woff2 fonts) for math
  rendering. Render once at page load via `renderMathInElement`.
- **Optional WebAudio** for one or two cells (audible chirp, audible
  Doppler) — graceful no-op if `AudioContext` unavailable.
- No CDN at runtime. Everything served same-origin from
  `essay/`. Pages-deployable with no Actions workflow.

Page weight target: ~600 KB total (HTML+CSS+JS+KaTeX), well under the
~45 MB of the Pyodide artifact.

## Directory layout

```
essay/
├── PLAN.md                  this file
├── index.html               the essay
├── styles/
│   ├── essay.css            typography, page layout, figure chrome
│   └── katex.min.css        vendored
├── katex/                   vendored KaTeX (auto-render bundle + fonts)
├── scripts/
│   ├── boot.js              page-load: KaTeX render + register figures
│   ├── core/
│   │   ├── canvas.js        DPR-aware canvas, axes, ticks, color helpers
│   │   ├── slider.js        styled <input type=range> + label/readout
│   │   ├── figure.js        figure factory (canvas + sliders + render)
│   │   ├── animate.js       requestAnimationFrame helpers
│   │   ├── colors.js        one curated palette
│   │   ├── dsp.js           FFT, chirp, MF, range-Doppler, CFAR, noise
│   │   └── audio.js         WebAudio chirp/sine playback (optional)
│   └── figures/
│       ├── 01-pressure.js
│       ├── 02-speed-of-sound.js
│       ├── 03-ping.js
│       ├── 04-echo.js
│       ├── 05-time-of-flight.js
│       ├── 06-spreading.js
│       ├── 07-resolution-problem.js
│       ├── 08-bandwidth.js
│       ├── 09-chirp.js
│       ├── 10-spectrogram.js
│       ├── 11-matched-filter.js
│       ├── 12-mf-with-noise.js
│       ├── 13-doppler.js
│       ├── 14-doppler-spectrum.js
│       ├── 15-pulse-train.js
│       ├── 16-coherent-integration.js
│       ├── 17-rd-map.js
│       ├── 18-detection-threshold.js
│       ├── 19-cfar.js
│       └── 20-finale.js
└── README.md                build & deploy notes
```

## Story arc — sections and figures

Each section is one or two paragraphs of prose ending in a figure that
makes the point physical. Every figure listed below is a single
`<canvas>` with the indicated reader-controlled inputs.

| §  | Heading                            | Idea built                                      | Figure(s)                                                                                          |
|----|------------------------------------|-------------------------------------------------|----------------------------------------------------------------------------------------------------|
| 1  | A pressure wave in water           | Sound is a longitudinal pressure oscillation    | Animated cartoon medium with particles oscillating; slider: frequency. Optional play-button audio. |
| 2  | How fast it travels                | c ≈ 1500 m/s; varies with temperature           | Top-down view of a pulse expanding as a ring; slider: water temperature → c.                       |
| 3  | A single ping                      | Transducer fires a short tone burst             | Time-domain pressure plus its narrow spectrum; slider: pulse duration τ.                           |
| 4  | Echoes from a target               | Hard objects reflect; round-trip time           | 1D scene: ping radiates, hits target, returns; slider: target range R₀.                            |
| 5  | Range from time-of-flight          | R = c·t/2                                       | Same scene with a measuring ruler that reader can drag to mark the echo arrival.                   |
| 6  | Spreading and absorption           | Energy spreads as 1/R² + Thorp absorption       | Range-vs-amplitude curve; slider: frequency (changes Thorp slope).                                 |
| 7  | The resolution problem             | Two close echoes merge if pulse is too long     | Two targets at adjustable separation; slider: pulse duration τ.                                    |
| 8  | Bandwidth IS resolution            | Δr = c/(2B)                                     | Same scene but slider is now bandwidth B; live readout of Δr in metres.                            |
| 9  | The chirp trick                    | Sweep frequency over a long pulse               | Time-domain chirp + its spectrum; slider: B and τ both.                                            |
| 10 | A spectrogram of the chirp         | Frequency vs time visualisation                 | Animated spectrogram, scrubbing playhead; slider: B.                                               |
| 11 | The matched filter (the moment)    | Correlate echo with reference → sharp peak      | Three stacked traces: chirp, echo, MF output; slider: target range.                                |
| 12 | What noise does                    | Even with noise, MF concentrates energy         | Noisy echo + MF output side by side; slider: input SNR.                                            |
| 13 | A target on the move               | Doppler shift from radial velocity              | Animated target + frequency-shifted echo; slider: target velocity v.                               |
| 14 | The Doppler spectrum               | f_d = -2·v·f_c/c shows up as a tone shift       | Echo spectrum with marker at f_d; slider: v.                                                       |
| 15 | A train of pings                   | Repeat the ping every PRI                       | Time-axis ribbon of stacked pings; slider: PRI, N_pulse.                                           |
| 16 | Coherent integration               | Stacking N pulses raises target by 10 log10 N   | Bar chart: target peak height grows with N; slider: N_pulse.                                       |
| 17 | The range–Doppler map              | 2D image: range × velocity                      | Heatmap with one or two target dots; sliders: target range + velocity, watch dot move.             |
| 18 | When to declare a target           | A simple threshold + missed-detection trade-off | 1D MF magnitude with a draggable threshold line; live count of detections / false alarms.          |
| 19 | CFAR — an adaptive threshold       | Estimate noise locally, threshold = α · noise   | Same scene with training cells highlighted; slider: training-cell width, design Pfa.               |
| 20 | Putting it together                | Closing animated cycle                          | All-in-one: ping fires → echo returns → MF → RD update → CFAR mark → display.                      |

That's 20 figures (some sections share or chain). Roughly Ciechanowski
density (his GPS essay has ~30, sound has ~20).

## Critical pieces that drive everything

- `core/figure.js` — every figure is `figure(rootSelector, {sliders,
  render, animate?, height?})`. Handles DPR, slider creation, hooking
  input events to a redraw, optional `requestAnimationFrame` loop.
  Get this right and the per-figure code shrinks dramatically.
- `core/dsp.js` — the toolkit each figure draws on:
  - `fft(re, im)` — in-place radix-2, length must be a power of two.
  - `lfmChirp(B, tau, Fs)` → `{re, im}`.
  - `xcorr(x, h)` — FFT-based cross-correlation.
  - `gaussianNoise(n, sigma)` — Box–Muller.
  - `rangeDoppler(pulses, PRI)` → `{rdMag, fdAxis, vAxis}`.
  - `caCfarThreshold(power, train, guard, pfa)`.
  Verified against the existing pytest suite (the Python sonar package
  computes the same outputs to within rounding for the same inputs).
- `core/canvas.js` — `mount(canvas, drawFn)` plus `drawAxes(ctx,
  {xLabel, yLabel, xDomain, yDomain, xTicks, yTicks})`.

## Visual identity

- Body: serif (Charter / Iowan Old Style with Georgia fallback),
  18 px on desktop, line-height 1.65.
- One column, max 720 px, centred. Figures occasionally break to
  ~840 px when needed (RD heatmap, spectrogram).
- Background `#fdfdfb`, ink `#222`, accent `#cd3a2a`, cool
  `#1f5fa8`, gridlines `#e8e8e8`.
- Headings: same serif, weight 600, slightly tracked.
- KaTeX for math; equations are display-style in their own block, not
  inline-bombs.
- Figure captions: italic, 14 px, `#666`.
- All sliders share one minimal style: a horizontal track and a thumb
  the user can grab. No labels above; numeric value lives next to the
  slider.

## Milestones

1. **Skeleton & first figure (1–2 days)** —
   `essay/index.html` with full typography, KaTeX vendored,
   `core/{canvas,slider,figure}.js`, and Figure 1 (pressure wave)
   built end-to-end. **Goal: this is the look-and-feel sign-off.**
2. **Core DSP toolkit + Figures 2–6 (2–3 days)** — speed of sound,
   ping, echo, time-of-flight, spreading. Validates the figure
   factory pattern across a few different visual idioms.
3. **The resolution / bandwidth payoff (Figures 7–10) (2 days)** —
   the centrepiece narrative. Two targets merging, Δr readout,
   chirp + spectrogram.
4. **Matched filter and noise (Figures 11–12) (1–2 days)** — the
   "wow" moment of sonar processing. The first time the reader sees
   a buried target snap into focus.
5. **Doppler block (Figures 13–14) (1 day)**.
6. **Range–Doppler block (Figures 15–17) (2 days)**.
7. **Detection block (Figures 18–19) (1–2 days)**.
8. **Finale + polish + cross-references (2–3 days)** — finale
   animation, prose passes, alt text, keyboard nav, mobile pass.

Real-world calendar: ~3 weeks of focused work; in this conversation
we'll go milestone by milestone, with the user reviewing the live
deploy after each.

## Reuse from the existing repo

- `sonar/` Python package — **not used at runtime** (this artifact is
  pure JS), but the existing pytest analytical checks become the
  ground-truth oracle for the JS DSP. We'll add an optional
  `essay/scripts/dev/check-against-python.html` page that runs each
  JS DSP function on a fixed input and compares the bytes against a
  saved JSON fixture generated from the Python package. That keeps
  the JS port honest.
- The current Quarto report at `docs/` stays exactly as-is on master.
  GitHub Pages will continue serving it from `master:/docs`. The
  essay deploys later from `master:/essay/` (we'll merge in once it's
  done) so the URLs are `kejaed.github.io/dsp_doc/` (current report)
  and `kejaed.github.io/dsp_doc/essay/` (the essay).

## Verification per milestone

Each milestone delivery includes:
1. `python -m http.server --directory essay` — open
   <http://localhost:8000>; eyeball the look.
2. Specific reader test: drag every slider, every figure should
   redraw at >30 fps with no console errors.
3. For the DSP-bearing figures (≥ §11), run the Python-vs-JS
   fixture diff page; show that JS matches Python within 1e-6.
4. Lighthouse pass: target ≥ 95 on Performance + Accessibility,
   page weight under 1 MB.

## Open questions for the user

1. **Audio.** Some Ciechanowski pieces include playable audio
   (the sound essay especially). Want a "play a 1 kHz tone" button on
   §1 and a "play the chirp" button on §9? Adds ~50 lines of
   WebAudio code, no extra dependency.
2. **Mobile.** Ciechanowski's essays are read on phones too. Do we
   target mobile parity (figures stack, sliders are touch-friendly,
   prose reflows narrow) or desktop-only?
3. **Dark mode?** Worth the extra CSS pass, or skip?
4. **Total length.** I've outlined 20 figures across ~20 sections. If
   you'd prefer a tighter pass (~10 figures, ~12 sections), we drop
   §2 (speed of sound), §6 (absorption), §10 (spectrogram), §15
   (pulse train), §20 (finale animation) — still tells the story but
   shorter.

## Proposed next step

Build **Milestone 1** only (skeleton + Figure 1) and let you load it.
That's the cheapest decision point — once you've seen the typography,
slider feel, canvas crispness, and the prose tone, we can either
continue down this path or course-correct before any more figures
exist.
