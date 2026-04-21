#!/usr/bin/env python3
"""Bundle the local `sonar` package into a base64 JSON blob.

Quarto-live (0.1.x) does not yet auto-mount arbitrary resources into the
Pyodide VFS, so we inline the package contents at render time and write
them to the VFS from the first {pyodide} cell. This keeps the rendered
HTML genuinely self-contained.
"""

from __future__ import annotations

import base64
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
PKG = ROOT / "sonar"

bundle: dict[str, str] = {}
for path in sorted(PKG.rglob("*.py")):
    rel = path.relative_to(ROOT).as_posix()
    bundle[rel] = base64.b64encode(path.read_bytes()).decode("ascii")

snippet = (
    '<script type="application/json" id="sonar-files">\n'
    + json.dumps(bundle)
    + "\n</script>\n"
)
out = ROOT / "_sonar_files.html"
out.write_text(snippet)
print(f"Bundled {len(bundle)} files into {out}")
