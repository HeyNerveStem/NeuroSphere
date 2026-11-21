#!/usr/bin/env python3
"""Headless-Chrome screenshot helper: shot.py URL OUT.png [WxH] [wait_ms] [js-to-eval-before-shot]"""
import sys
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
w, h = (int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else "1000x750").split("x"))
wait = int(sys.argv[4]) if len(sys.argv) > 4 else 1500
js = sys.argv[5] if len(sys.argv) > 5 else None
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": w, "height": h})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type in ("error",) else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url, wait_until="networkidle")
    try:
        pg.wait_for_function("window.__ready === true", timeout=60000)
    except Exception as e:
        errs.append("ready-timeout")
    if js:
        pg.evaluate(js)
    pg.wait_for_timeout(wait)
    pg.screenshot(path=out)
    b.close()
    for e in errs[:8]:
        print("ERR:", e[:300])
