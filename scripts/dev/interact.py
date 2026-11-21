#!/usr/bin/env python3
"""Ad-hoc interaction checks with screenshots: interact.py BASE_URL OUTDIR"""
import json
import sys
from playwright.sync_api import sync_playwright

base, out = sys.argv[1], sys.argv[2]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "/anatomy", wait_until="networkidle")
    pg.wait_for_function("window.__ready === true", timeout=60000)
    pg.wait_for_timeout(800)
    # click in the frontal region of the default view
    pg.mouse.move(800, 330); pg.wait_for_timeout(200); pg.mouse.move(820, 330); pg.wait_for_timeout(200)
    pg.mouse.click(820, 330)
    pg.wait_for_timeout(600)
    sel = pg.evaluate("window.__neuro.useViewer.getState().selectedId")
    print("click selected:", sel)
    pg.screenshot(path=f"{out}/select.png")
    # dissect: select cerebellum, move it via the transform store API path used by the gizmo
    pg.evaluate("""() => { const v = window.__neuro.useViewer.getState(); v.select('cerebellum'); v.setMode('dissect') }""")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{out}/dissect-gizmo.png")
    # disassemble layered to 60%
    pg.evaluate("""() => { const a = window.__neuro.useAnimation.getState(); a.setMode('layered'); a.setProgress(0.6) }""")
    pg.wait_for_timeout(500)
    pg.screenshot(path=f"{out}/layered60.png")
    pg.evaluate("""() => { const a = window.__neuro.useAnimation.getState(); a.reset(); a.setMode('complete'); const v = window.__neuro.useViewer.getState(); v.select(null); v.setMode('explore'); v.updateSettings({labelMode:'major'}) }""")
    pg.get_by_test_id('disassemble').click()
    pg.wait_for_timeout(5000)
    pg.screenshot(path=f"{out}/complete100.png")
    pg.evaluate("""() => { const a = window.__neuro.useAnimation.getState(); a.reset(); const v = window.__neuro.useViewer.getState(); v.updateSettings({labelMode:'selected'}); v.setXray(true); v.select('left-hippocampus'); v.requestCamera({kind:'preset', preset:'left-lateral'}) }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/xray-hippo.png")
    b.close()
for e in errs[:10]:
    print("ERR:", e[:300])
