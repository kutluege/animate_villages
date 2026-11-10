"""Overture Maps buildings (bbox) -> data/raw/overture_buildings.geojson (varsa atlar).

Gerekli: pip install overturemaps
Kullanım: python tools/fetch-overture.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
BBOX = "28.9810,41.0575,29.0030,41.0745"  # batı,güney,doğu,kuzey

for typ, name in [("building", "overture_buildings.geojson"),
                  ("building_part", "overture_building_parts.geojson")]:
    out = os.path.join(RAW, name)
    if os.path.exists(out) and os.path.getsize(out) > 100:
        print(name, "mevcut, atlandı")
        continue
    print("Overture", typ, "indiriliyor…")
    subprocess.run([sys.executable, "-m", "overturemaps", "download", "--bbox", BBOX,
                    "-f", "geojson", "-t", typ, "-o", out], check=True)
    print("kaydedildi", out, os.path.getsize(out), "bayt")
