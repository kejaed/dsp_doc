# Active-sonar DSP, in one interactive HTML file

> **Re-rendering the published page.** The live site at
> <https://kejaed.github.io/dsp_doc/> is served by GitHub Pages from
> `master:/docs`. To update it:
>
> ```bash
> quarto render report.qmd        # writes docs/index.html
> git add docs/index.html
> git commit -m "Re-render report"
> git push origin master
> ```
>
> Pages picks up the new commit automatically (~1 min). No Actions
> workflow — the HTML in `docs/` is the artifact.

An interactive Quarto report that walks through a textbook 10-step active
sonar DSP chain — LFM chirp, spreading loss, echoes, reverb, noise,
receive conditioning, matched filter, envelope + TVG, range–Doppler,
CA-CFAR — with all code running live in the browser.

The DSP here is intentionally ordinary. The point of the artefact is the
delivery technology: narrative + foldable code + live Python + reactive
sliders, all in a single self-contained `report.html`, no server.

## What's in the repo

```
sonar-demo/
├── README.md          (this file)
├── _quarto.yml        project config; declares the live-html format
├── report.qmd         the report source (10 sections + closing)
├── pre-render.py      bundles the `sonar/` package as base64 JSON
├── pyproject.toml     installs the `sonar` package + dev deps
├── requirements.txt   runtime deps for CPython + Pyodide
├── sonar/             DSP package imported by BOTH report and tests
├── tests/             pytest suite — 5 analytical checks
└── _extensions/       quarto-live extension (installed via `quarto add`)
```

Every DSP function used in the report is imported from the `sonar`
package. This means the code that runs inside Pyodide in the browser
and the code that `pytest` checks with analytical asserts are literally
the same source. No drift.

## Install

System:

```bash
# Quarto 1.5+ from https://quarto.org/docs/get-started/
quarto --version
```

Python (authoring + tests — not what runs in the browser):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

Quarto-live extension (provides the `{pyodide}` cell type and the
`live-html` format):

```bash
quarto add r-wasm/quarto-live
```

## Test

```bash
pytest
```

The five checks are analytical, not golden files:

1. LFM instantaneous frequency recovered from the analytic-signal phase.
2. MF peak/noise SNR gain equals $10\log_{10}(B\tau)$ at critical sampling.
3. MF peak localises an inserted delay within 1 sample.
4. Doppler bin localises a slow-time tone within 1 bin.
5. CA-CFAR empirical $P_\text{fa}$ converges to design $P_\text{fa}$
   within 20 % over $10^6$ noise cells.

## Render

```bash
quarto render report.qmd
open docs/index.html            # or xdg-open, or just drag into a browser
```

The first load of the rendered HTML fetches the Pyodide runtime and its
NumPy/SciPy/Matplotlib wheels (~10 MB, cached thereafter). After that,
every slider change reruns the affected Python cells in-browser in well
under a second.

## Deploy

`docs/index.html` is a single self-contained file — drop it anywhere
that serves static HTML:

- **GitHub Pages** (what this repo uses): Settings → Pages → Source:
  "Deploy from a branch", Branch: `master`, Folder: `/docs`. The
  `docs/.nojekyll` file is already committed so Pages won't mangle
  Quarto's `_`-prefixed asset paths.
- **Quarto Pub**: `quarto publish quarto-pub report.qmd`.
- **Netlify / S3 / CloudFront / whatever**: upload the file.
- **Locally**: `python -m http.server --directory docs` or just open
  `docs/index.html` directly from the filesystem.

## How it actually runs in your browser

- **Quarto** authors the page and runs the `pre-render.py` hook.
- **`pre-render.py`** reads every `.py` under `sonar/`, base64-encodes
  it, and drops a `<script type="application/json" id="sonar-files">`
  block into the rendered HTML. That keeps the bundle genuinely
  self-contained with no post-load fetch needed.
- **quarto-live** turns each `{pyodide}` code block into an OJS
  reactive cell: the cell's `#| input: [B, tau, ...]` option subscribes
  it to OJS observables, so it re-evaluates whenever those change.
- **Pyodide** (CPython-on-WASM) decodes the bundled package into its
  virtual filesystem and `import sonar` succeeds. From then on it's
  just NumPy + SciPy + Matplotlib.
- **OJS** (Observable JS) owns the reactive graph: it pushes slider
  values into the JS global scope where the Pyodide cell reads them
  via `from js import ...`.
