# Sonar — A Ciechanowski-Style Essay (essay/)

A long-form, single-page interactive essay that builds active sonar from
first principles, in the visual idiom of <https://ciechanow.ski>.
Vanilla HTML + ES modules + canvas, no build step, no framework, no
runtime CDN. **Currently at Milestone 1**: skeleton + Figure 1 (the
pressure wave) only. The full plan and remaining figures live in
[PLAN.md](PLAN.md).

## Run locally

```bash
python -m http.server --directory docs/essay
# → http://localhost:8000
```

Or just open `docs/essay/index.html` in a browser; everything is
relative-path and works from `file://` too.

## Live deploy

GitHub Pages serves the repo from `master:/docs`. The essay therefore
lands at <https://kejaed.github.io/dsp_doc/essay/>. No Actions
workflow; pushing to `master` is the deploy.

## Layout

```
docs/essay/
├── index.html              the essay (one page)
├── PLAN.md                 full content arc, figure list, milestones
├── styles/
│   └── essay.css           typography + figure chrome
└── scripts/
    ├── boot.js             figure registry, mounts everything on load
    ├── core/
    │   ├── canvas.js       DPR-aware canvas helper
    │   ├── slider.js       styled <input type=range> + readout + toggle
    │   └── audio.js        WebAudio: tones, pings, chirps
    └── figures/
        └── 01-pressure.js  the pressure-wave figure
```

Each `<figure data-figure="<key>">` in the HTML is a mount point;
`boot.js` looks the key up in its registry and calls the figure
module's `mount(rootEl)` function. Adding a new figure means dropping
a `figures/NN-name.js` file, adding the import to `boot.js`, and
placing one `<figure data-figure="name">` element in `index.html`.

## Conventions

- **Vanilla everything.** No bundler, no transpiler, no React, no
  npm. ES modules are loaded directly by the browser.
- **Canvas drawing in CSS pixels.** `mountCanvas()` already applied
  `ctx.scale(dpr, dpr)` so figure code never has to think about DPR.
- **Audio is opt-in.** Browsers won't play anything without a user
  gesture, so every audible figure has an explicit play button.
- **No runtime CDN.** Self-host any future dependencies under `essay/`
  the way the parent repo self-hosts Pyodide and Plotly.
