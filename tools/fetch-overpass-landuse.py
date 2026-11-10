"""Tur 2: tek ek Overpass sorgusu (arazi kullanımı, yeşil alan, mezarlık, otopark, duvar, ibadethane)
-> data/raw/overpass-landuse.json. Dosya varsa ASLA yeniden indirmez.

Kullanım: python tools/fetch-overpass-landuse.py
"""
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "raw", "overpass-landuse.json")
BBOX = "41.0575,28.9810,41.0745,29.0030"  # fetch-overpass.py ile aynı

QUERY = f"""
[out:json][timeout:240][bbox:{BBOX}];
(
  way["landuse"];  relation["landuse"];
  way["leisure"];  relation["leisure"];
  way["natural"];  relation["natural"];
  way["amenity"~"grave_yard|parking|place_of_worship|school|hospital|university|kindergarten"];
  relation["amenity"~"grave_yard|parking|place_of_worship|school|hospital|university|kindergarten"];
  way["place"="square"];
  way["area:highway"];
  way["man_made"~"bridge|pier|courtyard"];
  way["barrier"~"wall|fence|retaining_wall|hedge"];
  way["historic"]; node["historic"];
  node["amenity"="place_of_worship"];
  way["building"~"church|chapel|cathedral|mosque|synagogue|religious|construction"];
  way["water"]; way["waterway"];
);
out geom;
"""

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def main():
    if os.path.exists(OUT) and os.path.getsize(OUT) > 1000:
        print("overpass-landuse.json mevcut, indirme atlandı")
        return
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for url in MIRRORS:
        try:
            print("sorgu ->", url)
            req = urllib.request.Request(url, data=body, headers={
                "User-Agent": "animate_villages/1.0 (mecidiyekoy scene data build)"})
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            doc = json.loads(raw)
            if not doc.get("elements"):
                raise RuntimeError("boş sonuç: " + str(doc.get("remark")))
            with open(OUT, "wb") as f:
                f.write(raw)
            print("kaydedildi", OUT, len(doc["elements"]), "öğe")
            return
        except Exception as e:
            last = e
            print("hata:", e)
            time.sleep(3)
    sys.exit("Overpass başarısız: %s" % last)


if __name__ == "__main__":
    main()
