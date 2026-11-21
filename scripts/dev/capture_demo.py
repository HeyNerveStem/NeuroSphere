#!/usr/bin/env python3
"""
Regenerate the README screenshots and demo GIF from the real running app.

    cd frontend && npm run build && npx vite preview --port 4173 &
    python3 scripts/dev/capture_demo.py http://localhost:4173

Writes docs/images/*.png and docs/images/demo-disassembly.gif (needs ffmpeg).
Uses headless system Chrome with a software GL fallback, so it also works on
machines without a GPU. Reduced motion is enabled so camera moves are instant
and every frame is deterministic.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "images"
ARGV = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = ARGV[0].rstrip("/") if ARGV else "http://localhost:4173"
ONLY = next(
    (a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), "all"
)  # all | shots | gif | dissection
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def ready(pg: Page, path: str, settle: int = 1200, viewer: bool = True) -> None:
    pg.goto(BASE + path, wait_until="networkidle")
    if viewer:  # pages with a 3D viewer signal readiness once the model is loaded
        pg.wait_for_function("window.__ready === true", timeout=120_000)
        pg.evaluate("window.__neuro.useViewer.getState().updateSettings({ reducedMotion: true })")
    pg.wait_for_timeout(settle)


def js(pg: Page, code: str, settle: int = 1500) -> None:
    pg.evaluate(
        f"(() => {{ const n = window.__neuro, v = n.useViewer.getState(), a = n.useAnimation.getState(); {code} }})()"
    )
    pg.wait_for_timeout(settle)


def shot(pg: Page, name: str) -> None:
    pg.screenshot(path=str(OUT / f"{name}.png"))
    print("  wrote", name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=ARGS)
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        if ONLY in ("all", "dissection"):
            dissection(pg)
        if ONLY in ("all", "shots"):
            screenshots(b, pg)
        if ONLY in ("all", "gif"):
            demo_gif(b)
        b.close()


def dissection(pg: Page) -> None:
    ready(pg, "/anatomy")
    js(
        pg,
        "v.updateSettings({ colorMode: 'realistic', labelMode: 'selected' });"
        "n.transforms.pushHistory(); n.transforms.translate(['cerebellum'], n.meshRegistry.get('cerebellum').position.clone().set(0.1, -0.22, -0.42));"
        "n.transforms.endManipulation(); v.select('cerebellum'); v.setMode('dissect'); v.requestCamera({ kind: 'preset', preset: 'left-lateral' })",
        1200,
    )
    js(pg, "v.requestCamera({ kind: 'focus', id: 'brain' })", 2500)
    shot(pg, "manual-dissection")


def screenshots(b, pg: Page) -> None:
    ready(pg, "/", 2500)
    shot(pg, "home")

    ready(pg, "/anatomy")
    js(
        pg,
        "v.updateSettings({ labelMode: 'major' }); v.select('left-frontal-lobe'); v.requestCamera({ kind: 'preset', preset: 'left-lateral' })",
    )
    shot(pg, "anatomy-lab")

    ready(pg, "/anatomy/left-hippocampus", 2500)
    shot(pg, "xray-hippocampus")

    ready(pg, "/anatomy")
    js(
        pg,
        "v.updateSettings({ colorMode: 'regions', labelMode: 'selected' }); v.requestCamera({ kind: 'preset', preset: 'sagittal' })",
    )
    shot(pg, "section-sagittal")

    ready(pg, "/anatomy")
    js(
        pg,
        "v.updateSettings({ colorMode: 'regions', labelMode: 'major' }); a.setMode('layered'); a.setProgress(0.72);"
        "v.requestCamera({ kind: 'overview', scale: 1.7 })",
        2500,
    )
    shot(pg, "exploded-layered")

    ready(pg, "/anatomy")
    pg.get_by_test_id("global-search").fill("memory")
    pg.wait_for_timeout(800)
    shot(pg, "search")

    ready(pg, "/diseases", 600, viewer=False)
    shot(pg, "disease-catalog")

    ready(pg, "/diseases/alzheimers-disease")
    pg.get_by_test_id("highlight-affected").click()
    pg.wait_for_timeout(2500)
    shot(pg, "disease-alzheimers")

    ready(pg, "/diseases/ischemic-stroke")
    pg.get_by_test_id("disease-animation").get_by_role("button", name="Play").click()
    pg.wait_for_timeout(500)
    pg.get_by_test_id("disease-animation").get_by_role("button", name="Pause").click()
    for _ in range(2):
        pg.get_by_role("button", name="Next step").click()
        pg.wait_for_timeout(400)
    pg.wait_for_timeout(2500)
    shot(pg, "disease-animation-stroke")

    ready(pg, "/learn/limbic-system", 2500)
    shot(pg, "learning-module")

    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ready(m, "/anatomy/cerebellum", 2500)
    shot(m, "mobile")
    m.close()


def demo_gif(b) -> None:
    # ---- animated GIF: deterministic layer-by-layer disassembly and reassembly
    g = b.new_page(viewport={"width": 1200, "height": 720})
    ready(g, "/anatomy")
    js(
        g,
        "v.updateSettings({ colorMode: 'regions', labelMode: 'none', quality: 'low' }); v.setPanel('left', false); v.setPanel('right', false);"
        "a.setMode('layered'); v.requestCamera({ kind: 'overview', scale: 1.5 })",
        4000,
    )
    # show only the 3D scene: hide every DOM overlay (panels, toolbar, labels) for a clean GIF
    g.add_style_tag(content="body *{visibility:hidden!important} canvas{visibility:visible!important}")
    g.wait_for_timeout(1500)
    frames = Path(tempfile.mkdtemp())
    steps = [i / 22 for i in range(23)]
    seq = [0.0] * 2 + steps + [1.0] * 4 + steps[::-1] + [0.0] * 2
    canvas = g.locator("canvas").first
    for i, prog in enumerate(seq):
        g.evaluate(f"window.__neuro.useAnimation.getState().setProgress({prog})")
        g.wait_for_timeout(250)
        canvas.screenshot(path=str(frames / f"f{i:03d}.png"))
    gif = OUT / "demo-disassembly.gif"
    pal = frames / "palette.png"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-framerate",
            "12",
            "-i",
            str(frames / "f%03d.png"),
            "-vf",
            "crop=667:533:270:37,scale=600:-1:flags=lanczos,palettegen=stats_mode=diff",
            str(pal),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-framerate",
            "12",
            "-i",
            str(frames / "f%03d.png"),
            "-i",
            str(pal),
            "-lavfi",
            "crop=667:533:270:37,scale=600:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4",
            str(gif),
        ],
        check=True,
    )
    shutil.rmtree(frames)
    print("  wrote demo-disassembly.gif", f"({gif.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
