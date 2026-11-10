"""OpenTopography COP30 -> data/raw/cop30.tif. TEK çağrı; dosya varsa asla yeniden indirmez.

Anahtar: ortam değişkeni OPENTOPO_API_KEY ya da repo kökündeki .env. Anahtar hiçbir yere yazdırılmaz.
Kullanım: python tools/fetch-cop30.py
"""
import os, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "raw", "cop30.tif")

# Sahne bbox'ı + ~800 m pay (yumuşatma kenar etkisi için)
SOUTH, NORTH, WEST, EAST = 41.050, 41.080, 28.975, 29.010


def api_key():
    k = os.environ.get("OPENTOPO_API_KEY")
    if k:
        return k.strip()
    env = os.path.join(ROOT, ".env")
    if os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            line = line.strip()
            if line.startswith("OPENTOPO_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("OPENTOPO_API_KEY bulunamadı")


def main():
    if os.path.exists(OUT):
        print("cop30.tif mevcut, indirme atlandı")
        return
    params = {
        "demtype": "COP30",
        "south": SOUTH, "north": NORTH, "west": WEST, "east": EAST,
        "outputFormat": "GTiff",
        "API_Key": api_key(),
    }
    url = "https://portal.opentopography.org/API/globaldem?" + urllib.parse.urlencode(params)
    print("COP30 isteniyor: bbox S%.3f N%.3f W%.3f E%.3f" % (SOUTH, NORTH, WEST, EAST))
    req = urllib.request.Request(url, headers={"User-Agent": "animate_villages/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        sys.exit("HTTP %d: %s" % (e.code, e.read()[:300].decode("utf-8", "replace")))
    if not (data[:4] in (b"II*\x00", b"MM\x00*")):
        sys.exit("Beklenmeyen yanıt (GeoTIFF değil): %r" % data[:300])
    with open(OUT, "wb") as f:
        f.write(data)
    print("kaydedildi", OUT, len(data), "bayt")


if __name__ == "__main__":
    main()
