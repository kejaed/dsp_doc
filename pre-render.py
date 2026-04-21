#!/usr/bin/env python3
"""Pre-render hook: stage the `sonar/` package into docs/ so quarto-live
can fetch it at runtime.

Background: Pyodide cells run inside a Web Worker. The worker has no
access to the DOM, so we can't inline the sonar files as a JSON blob and
read them back with `document.getElementById`. Instead, we let quarto-
live's `pyodide.resources:` mechanism fetch the files over HTTP (on the
main thread) and write them into the worker's VFS. That means the files
have to actually exist on the deployed site — which this script ensures
by copying sonar/*.py into docs/sonar/ before render.
"""

from __future__ import annotations

import pathlib
import shutil

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "sonar"
DST = ROOT / "docs" / "sonar"

if DST.exists():
    shutil.rmtree(DST)
DST.mkdir(parents=True, exist_ok=True)

count = 0
for path in sorted(SRC.rglob("*.py")):
    rel = path.relative_to(SRC)
    target = DST / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    count += 1

# quarto-live's Lua `tree()` helper walks `sonar/` to build the vfs-file
# resource list at render time. It pulls in `__pycache__/*.pyc` too,
# which then 404 at runtime because we only copy *.py into docs/sonar/.
# Easiest fix: remove pycache before render so the scan sees only *.py.
for cache in SRC.rglob("__pycache__"):
    if cache.is_dir():
        shutil.rmtree(cache)

print(f"Staged {count} sonar/*.py files into {DST}")
