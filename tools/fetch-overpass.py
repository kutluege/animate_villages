"""Tek birleşik Overpass sorgusu -> data/raw/overpass.json (varsa yeniden indirmez).

Kullanım: python tools/fetch-overpass.py
"""
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "raw", "overpass.json")

# Sahne bbox'ı (41.060–41.072 K, 28.984–29.000 D) + küçük pay. (güney, batı, kuzey, doğu)
BBOX = "41.0575,28.9810,41.0745,29.0030"

QUERY = f"""
[out:json][timeout:240][bbox:{BBOX}];
(
  way["building"];
  relation["building"];
  way["building:part"];
  relation["building:part"];
  way["highway"];
  way["railway"];
  way["public_transport"];
  way["man_made"="bridge"];
  way["place"="square"];
  relation["place"="square"];
  way["leisure"~"park|garden|playground|pitch"];
  way["landuse"~"grass|park|recreation_ground"];
  way["natural"~"tree_row|wood|scrub"];
  node["railway"~"subway_entrance|station|stop|halt"];
  node["public_transport"];
  node["highway"~"bus_stop|traffic_signals|street_lamp"];
  node["natural"="tree"];
  node["entrance"]["railway"];
);
out geom;
(
  relation["route"~"bus|subway|light_rail|tram|train"];
);
out body;
"""

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def main():
    if os.path.exists(OUT) and os.path.getsize(OUT) > 1000:
        print("overpass.json mevcut, indirme atlandı")
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
            if doc.get("remark"):
                print("uyarı:", doc["remark"])
            with open(OUT, "wb") as f:
                f.write(raw)
            print("kaydedildi", OUT, len(doc["elements"]), "öğe")
            return
        except Exception as e:  # sunucu meşgul -> sıradaki ayna
            last = e
            print("hata:", e)
            time.sleep(3)
    sys.exit("Overpass başarısız: %s" % last)


if __name__ == "__main__":
    main()
