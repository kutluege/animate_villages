"""data/raw/* -> data/{buildings,roads,terrain,landmarks,points}.json + istatistik.

Ağ erişimi YOK; yalnızca data/raw/ altındaki indirmeleri işler.
Gerekli: pip install numpy scipy shapely tifffile imagecodecs
Kullanım: python tools/build-data.py
"""
import hashlib, json, math, os, statistics, sys
from collections import Counter, defaultdict

import numpy as np
import tifffile
from scipy import ndimage
from shapely.geometry import Polygon, Point, LineString, box
from shapely.strtree import STRtree
from shapely.validation import make_valid

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data")

LAT0, LON0 = 41.0665, 28.9920
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574
# Veri kapsamı (indirme bbox'ı); sahne kapsamı CONTRACT §2'de daha dar.
CLIP = (-925.0, -885.0, 925.0, 995.0)  # xmin, zmin, xmax, zmax
CLIP_BOX = box(*CLIP)


def to_xz(lat, lon):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def r1(v):
    return round(v * 10) / 10


def rpts(pts):
    return [[r1(x), r1(z)] for x, z in pts]


def hrand(s):
    """Deterministik [0,1) — id'den türetilir."""
    return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 2**32


def num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").split()[0].replace("m", ""))
    except ValueError:
        return None


# ---------------------------------------------------------------- arazi
def build_terrain():
    with tifffile.TiffFile(os.path.join(RAW, "cop30.tif")) as t:
        p = t.pages[0]
        dem = p.asarray().astype(np.float64)
        sx, sy = p.tags["ModelPixelScaleTag"].value[:2]
        tp = p.tags["ModelTiepointTag"].value
        lon_ul, lat_ul = tp[3], tp[4]
    raw_min, raw_max = float(dem.min()), float(dem.max())
    # Çatıları sil: morfolojik açma (min sonra max), 7 px ≈ 160–210 m pencere,
    # ardından geniş Gauss (σ = 3 px ≈ 70–90 m). Sonuç yalnızca genel eğim.
    k = 7
    opened = ndimage.grey_dilation(ndimage.grey_erosion(dem, size=(k, k)), size=(k, k))
    eroded = ndimage.grey_erosion(dem, size=(k, k))
    ground = np.minimum(opened, ndimage.gaussian_filter(eroded, 2.0) + 3.0)
    smooth = ndimage.gaussian_filter(ground, 3.0, mode="nearest")

    def dem_at(lat, lon):
        fx = (lon - lon_ul) / sx - 0.5
        fy = (lat_ul - lat) / sy - 0.5
        return float(ndimage.map_coordinates(smooth, [[fy], [fx]], order=1, mode="nearest")[0])

    dx = dz = 50.0
    x0, z0 = -1000.0, -950.0
    nx, nz = 41, 43  # x: −1000…1000, z: −950…1150
    h0 = dem_at(LAT0, LON0)
    heights = []
    for j in range(nz):
        z = z0 + j * dz
        lat = LAT0 - z / KZ
        for i in range(nx):
            x = x0 + i * dx
            lon = LON0 + x / KX
            heights.append(r1(dem_at(lat, lon) - h0))
    terr = {"nx": nx, "nz": nz, "x0": x0, "z0": z0, "dx": dx, "dz": dz, "heights": heights,
            "originElevation": r1(h0),
            "source": "Copernicus GLO-30 (COP30) via OpenTopography; morphological opening 7px + Gaussian σ=3px; y = elevation − originElevation"}
    stats = {"raw_min": raw_min, "raw_max": raw_max, "h0": h0}
    return terr, stats


def make_height_at(t):
    H = np.array(t["heights"]).reshape(t["nz"], t["nx"])

    def f(x, z):
        fx = min(max((x - t["x0"]) / t["dx"], 0), t["nx"] - 1.0001)
        fz = min(max((z - t["z0"]) / t["dz"], 0), t["nz"] - 1.0001)
        i, j = int(fx), int(fz)
        u, v = fx - i, fz - j
        return (H[j, i] * (1 - u) * (1 - v) + H[j, i + 1] * u * (1 - v)
                + H[j + 1, i] * (1 - u) * v + H[j + 1, i + 1] * u * v)
    return f


# ---------------------------------------------------------------- OSM yardımcıları
def way_xz(e):
    return [to_xz(p["lat"], p["lon"]) for p in e.get("geometry") or [] if p]


def merge_rings(segs):
    """Üye yollarını kapalı halkalara birleştir."""
    segs = [list(s) for s in segs if len(s) >= 2]
    rings = []
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    while segs:
        cur = segs.pop(0)
        changed = True
        while key(cur[0]) != key(cur[-1]) and changed:
            changed = False
            for i, s in enumerate(segs):
                if key(s[0]) == key(cur[-1]):
                    cur += s[1:]
                elif key(s[-1]) == key(cur[-1]):
                    cur += s[::-1][1:]
                elif key(s[-1]) == key(cur[0]):
                    cur = s[:-1] + cur
                elif key(s[0]) == key(cur[0]):
                    cur = s[::-1][:-1] + cur
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(cur) >= 4:
            rings.append(cur)
    return rings


def clean_ring(pts):
    pts = [p for i, p in enumerate(pts) if i == 0 or (abs(p[0] - pts[i - 1][0]) > 0.05 or abs(p[1] - pts[i - 1][1]) > 0.05)]
    if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 0.05 and abs(pts[0][1] - pts[-1][1]) < 0.05:
        pts = pts[:-1]
    return pts


def poly_of(e):
    """OSM öğesi -> [(outer, [holes])]"""
    if e["type"] == "way":
        r = clean_ring(way_xz(e))
        return [(r, [])] if len(r) >= 3 else []
    outers = merge_rings([[to_xz(p["lat"], p["lon"]) for p in m.get("geometry", [])]
                          for m in e.get("members", []) if m["type"] == "way" and m.get("role") == "outer"])
    inners = merge_rings([[to_xz(p["lat"], p["lon"]) for p in m.get("geometry", [])]
                          for m in e.get("members", []) if m["type"] == "way" and m.get("role") == "inner"])
    res = []
    for o in outers:
        o = clean_ring(o)
        if len(o) < 3:
            continue
        po = Polygon(o)
        hs = [clean_ring(i) for i in inners if po.contains(Point(i[0]))]
        res.append((o, [h for h in hs if len(h) >= 3]))
    return res


def orient(ring, ccw=True):
    a = sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))
    return ring if (a > 0) == ccw else ring[::-1]


# ---------------------------------------------------------------- binalar
LOW_KINDS = {"garage", "garages", "shed", "kiosk", "hut", "toilets", "transformer_tower", "service",
             "carport", "container", "cabin", "booth", "guardhouse"}
LEVEL_H = 3.1


def level_h(kind, levels):
    if kind in ("office", "commercial", "hotel", "retail") and levels >= 12:
        return 3.8
    if levels >= 20:
        return 3.6
    return LEVEL_H


# Simge yapı yükseklik düzeltmeleri (kaynaklı). key -> {osmId: (height, minHeight, source, note)}
LANDMARK_HEIGHTS = {
    # OSM yalnızca building:levels verir; metre değeri yayımlanmış kaynaktan (kat sayısıyla tutarlı).
    1222286465: (155.0, 0.0, "osm_levels",
                 "Trump Towers residence tower: 39 floors, roof 155 m (Wikipedia 'Trump Towers Istanbul'; ScraperBase 156 m)."),
    1455454989: (145.0, 0.0, "osm_levels",
                 "Trump Towers office tower: 37 floors, roof 145 m (Wikipedia 'Trump Towers Istanbul')."),
    1457770436: (140.0, 0.0, "osm_levels",
                 "Şişli Elit Residence tower part (OSM levels=36): 140 m / 35 floors per Wikipedia 'List of tallest buildings in Istanbul'."),
    164288215: (20.0, 0.0, "estimate",
                "Şişli Plaza: OSM outline covers the whole complex incl. 4-floor retail podium; tower (170.1 m) not mapped separately. Podium ~20 m ESTIMATE; see landmarks.sisli_plaza."),
    163629174: (20.0, 0.0, "estimate",
                "Trump AVM podium; OSM levels=3 (+ towers start at min_level 3). Height ~20 m estimated."),
    46962419: (34.0, 0.0, "estimate",
               "Cevahir AVM: 6 retail floors (OSM levels=6, Wikipedia), ~2,500 m² glass roof. Above-ground height ~34 m estimated."),
}


def build_buildings(E, height_at, roads=None):
    from shapely.ops import unary_union
    major_roads = bridges = None
    if roads:
        major_roads = unary_union([LineString(r["pts"]).buffer(r["width"] / 2) for r in roads
                                   if r["kind"] in ("trunk", "trunk_link", "primary", "primary_link", "secondary", "busway")
                                   and not r["tunnel"]])
        bridges = unary_union([LineString(r["pts"]).buffer(r["width"] / 2) for r in roads
                               if r["bridge"] and r["kind"] not in ("footway", "steps", "path")])
    ovt = json.load(open(os.path.join(RAW, "overture_buildings.geojson"), encoding="utf-8"))["features"]
    ovt_parts = json.load(open(os.path.join(RAW, "overture_building_parts.geojson"), encoding="utf-8"))["features"]
    ovt_by_osm = {}
    ms_feats = []
    for f in ovt + ovt_parts:
        p = f["properties"]
        src = p.get("sources") or []
        if isinstance(src, str):
            src = json.loads(src)
        rid = next((s.get("record_id") for s in src if s.get("dataset") == "OpenStreetMap" and s.get("record_id")), None)
        if rid:
            t, rest = rid[0], rid[1:].split("@")[0]
            ovt_by_osm[("way" if t == "w" else "relation", int(rest))] = p
        elif f in ovt:
            ms_feats.append(f)

    recs = []  # ara kayıtlar
    for e in E:
        t = e.get("tags", {})
        is_part = "building:part" in t and "building" not in t
        if not ("building" in t or is_part) or e["type"] == "node":
            continue
        if t.get("building") in ("no",) or t.get("building:part") in ("no",):
            continue
        if num(t.get("layer")) is not None and num(t["layer"]) < 0:
            continue  # yeraltı yapıları (metro istasyon kutusu vb.)
        if t.get("location") == "underground" or t.get("building") == "construction" and False:
            continue
        for k, (outer, holes) in enumerate(poly_of(e)):
            poly = make_valid(Polygon(outer, holes))
            if poly.area < 8:
                continue
            c = poly.representative_point()
            if not CLIP_BOX.contains(c):
                continue
            recs.append({"e": e, "t": t, "part": is_part, "outer": outer, "holes": holes, "poly": poly,
                         "id": f"{e['type'][0]}{e['id']}" + (f"_{k}" if k else ""), "osm": (e["type"], e["id"])})

    # Parçalı binalar: parçalar dış hattın ≥%50'sini kaplıyorsa dış hat çizilmez.
    parts = [r for r in recs if r["part"]]
    outlines = [r for r in recs if not r["part"]]
    tree = STRtree([r["poly"] for r in parts]) if parts else None
    dropped_outlines = set()
    for o in outlines:
        if not tree:
            break
        idx = tree.query(o["poly"])
        cov = sum(parts[i]["poly"].intersection(o["poly"]).area for i in idx
                  if o["poly"].contains(parts[i]["poly"].representative_point()))
        if cov >= 0.5 * o["poly"].area:
            dropped_outlines.add(o["id"])
            for i in idx:
                if o["poly"].contains(parts[i]["poly"].representative_point()):
                    parts[i]["parent"] = o["id"]
                    parts[i]["parent_t"] = o["t"]
    recs = [r for r in recs if r["id"] not in dropped_outlines]

    # Microsoft ML (Overture) izleri: OSM ile çakışmayanları ekle.
    osm_tree = STRtree([r["poly"] for r in recs])
    ms_added = 0
    for f in ms_feats:
        g = f["geometry"]
        rings = g["coordinates"] if g["type"] == "Polygon" else g["coordinates"][0]
        outer = clean_ring([to_xz(lat, lon) for lon, lat in rings[0]])
        if len(outer) < 3:
            continue
        poly = make_valid(Polygon(outer))
        if poly.area < 15 or not CLIP_BOX.contains(poly.representative_point()):
            continue
        ov = sum(recs[i]["poly"].intersection(poly).area for i in osm_tree.query(poly))
        if ov > 0.2 * poly.area:
            continue
        if major_roads is not None and poly.intersection(major_roads).area > 0.3 * poly.area:
            continue  # ML yanlış pozitifi (durak sundurması, araç vb.)
        recs.append({"e": None, "t": {"building": "yes"}, "part": False, "outer": outer, "holes": [],
                     "poly": poly, "id": "ovt:" + str(f.get("id") or f["properties"].get("id") or ms_added),
                     "osm": None, "ms": True})
        ms_added += 1

    # Yükseklikler
    src_count = Counter()
    for r in recs:
        t = r["t"]
        kind = t.get("building") if not r["part"] else (r.get("parent_t", {}).get("building") or t.get("building:part"))
        if kind in ("yes", None):
            kind = t.get("building:part") if r["part"] and t.get("building:part") not in ("yes", None) else kind
        r["kind"] = kind
        h = num(t.get("height"))
        lv = num(t.get("building:levels"))
        roof_lv = num(t.get("roof:levels")) or 0
        minh = num(t.get("min_height"))
        minlv = num(t.get("building:min_level"))
        src = None
        if h and h > 0:
            src = "osm"
        elif lv and lv > 0:
            src = "osm_levels"
            h = lv * level_h(kind, lv) + roof_lv * 2.5 + (0.6 if lv > 1 else 0.3)
        elif r["osm"] and r["osm"] in ovt_by_osm:
            p = ovt_by_osm[r["osm"]]
            if p.get("height"):
                h, src = float(p["height"]), "overture"
            elif p.get("num_floors"):
                lv = float(p["num_floors"])
                h, src = lv * level_h(kind, lv) + 0.6, "overture"
        if minh is None and minlv:
            minh = minlv * level_h(kind, (lv or minlv))
        r["height"], r["src"], r["levels"], r["minh"] = h, src, lv, minh or 0.0

    # Tahmin: komşu bilinen bina katlarının medyanı (r=120 m), kararlı ±1 kat oynama.
    known = [r for r in recs if r["src"] in ("osm", "osm_levels", "overture") and not r["part"]
             and r["levels"] and r["levels"] <= 14 and 60 < r["poly"].area < 3000]
    kpts = np.array([[r["poly"].centroid.x, r["poly"].centroid.y] for r in known]) if known else np.zeros((0, 2))
    klev = np.array([r["levels"] for r in known])
    for r in recs:
        if r["src"]:
            continue
        kind, a = r["kind"], r["poly"].area
        c = r["poly"].centroid
        j = hrand(r["id"])
        if kind in LOW_KINDS or a < 40:
            lv = 1
        elif kind == "roof":
            lv = 1
        elif kind in ("house", "detached", "semidetached_house"):
            lv = 2 + (j > 0.6)
        elif kind == "mosque":
            lv = 4
        elif kind in ("school", "university", "college"):
            lv = 4
        elif kind in ("hospital",):
            lv = 6
        elif kind in ("industrial", "warehouse", "parking"):
            lv = 3
        else:
            d = np.hypot(kpts[:, 0] - c.x, kpts[:, 1] - c.y) if len(kpts) else np.array([])
            near = klev[d < 120] if len(d) else []
            base = float(np.median(near)) if len(near) >= 3 else 6.0
            base = min(max(base, 4), 9)
            lv = int(round(base + (j * 3 - 1.5)))
            if a < 70:
                lv = min(lv, 3)
            elif a < 110:
                lv = min(lv, 5)
            lv = max(lv, 2)
        under_bridge = bridges is not None and r["poly"].intersection(bridges).area > 0.2 * a
        if under_bridge or kind in ("civic", "kiosk", "toilets"):
            lv = 1 if under_bridge else min(lv, 2)  # viyadük altı köşk/pavyon: tabliyeyi delmesin
        r["levels"] = lv
        if kind == "roof":
            r["height"], r["minh"] = 4.5, 3.5
        elif kind == "mosque":
            r["height"] = 14.0
        else:
            r["height"] = lv * LEVEL_H + 0.6
        r["src"] = "estimate"

    # Simge yapı düzeltmeleri
    lm_ids = {}
    for r in recs:
        if r["osm"] and r["osm"][1] in LANDMARK_HEIGHTS:
            h, mh, s, note = LANDMARK_HEIGHTS[r["osm"][1]]
            r["height"], r["minh"], r["src"] = h, mh, s
            r["lm_note"] = note

    out = []
    for r in recs:
        src_count[r["src"]] += 1
        pts = list(r["outer"]) + [p for h in r["holes"] for p in h]
        c = r["poly"].centroid
        base = min([height_at(x, z) for x, z in pts] + [height_at(c.x, c.y)])
        b = {"id": r["id"], "footprint": rpts(orient(r["outer"], True)),
             "height": r1(r["height"]), "heightSource": r["src"], "baseY": r1(base)}
        if r["holes"]:
            b["holes"] = [rpts(orient(h, False)) for h in r["holes"]]
        if r["minh"]:
            b["minHeight"] = r1(r["minh"])
        if r["levels"]:
            b["levels"] = int(round(r["levels"]))
        if r["t"].get("name"):
            b["name"] = r["t"]["name"]
        if r["kind"] and r["kind"] != "yes":
            b["kind"] = r["kind"]
        if r["part"]:
            b["part"] = True
        if r.get("ms"):
            b["footprintSource"] = "overture_msml"
        out.append(b)
    return out, src_count, ms_added, len(dropped_outlines), recs


# ---------------------------------------------------------------- yollar
WIDTH = {"motorway": 14, "trunk": 13, "primary": 10, "secondary": 8, "tertiary": 7,
         "motorway_link": 6.5, "trunk_link": 6.5, "primary_link": 6, "secondary_link": 6, "tertiary_link": 5.5,
         "residential": 6, "living_street": 5, "unclassified": 6, "service": 4, "pedestrian": 5,
         "footway": 2.5, "path": 2, "steps": 2.5, "cycleway": 2, "corridor": 2.5, "platform": 4,
         "busway": 7.5, "track": 3}


def clip_line(pts):
    ls = LineString(pts)
    if CLIP_BOX.contains(ls):
        return [pts]
    g = ls.intersection(CLIP_BOX)
    geoms = [g] if g.geom_type == "LineString" else list(getattr(g, "geoms", []))
    return [list(x.coords) for x in geoms if x.geom_type == "LineString" and len(x.coords) >= 2]


def build_roads(E):
    roads = []
    areas = []
    for e in E:
        if e["type"] != "way":
            continue
        t = e.get("tags", {})
        hw, rw = t.get("highway"), t.get("railway")
        if not hw and rw not in ("subway", "rail", "light_rail", "tram", "platform"):
            continue
        if hw in ("proposed", "construction", "elevator"):
            continue
        pts = way_xz(e)
        if len(pts) < 2:
            continue
        if hw in ("pedestrian", "footway", "platform") and t.get("area") == "yes" or (
                hw == "pedestrian" and pts[0] == pts[-1] and len(pts) > 3):
            if CLIP_BOX.intersects(Polygon(pts)):
                areas.append({"id": f"w{e['id']}", "kind": "pedestrian_area", "name": t.get("name"),
                              "pts": rpts(clean_ring(pts))})
            continue
        kind = hw if hw else ("rail" if rw != "subway" else "subway")
        if rw == "platform":
            kind = "platform"
        bridge = t.get("bridge", "no") not in ("no",)
        tunnel = t.get("tunnel", "no") not in ("no",) or t.get("location") == "underground"
        layer = num(t.get("layer"))
        layer = int(layer) if layer is not None else (1 if bridge else (-1 if tunnel else 0))
        lanes = num(t.get("lanes"))
        oneway = t.get("oneway") in ("yes", "1", "true") or (hw == "motorway" and t.get("oneway") != "no")
        width = WIDTH.get(kind.replace("_link", "_link"), 5)
        if lanes and kind not in ("footway", "steps", "pedestrian"):
            width = max(lanes * 3.3 + (0 if oneway else 0.5), 3)
        if kind in ("subway", "rail"):
            width = 3.2
        for k, seg in enumerate(clip_line(pts)):
            r = {"id": f"w{e['id']}" + (f"_{k}" if k else ""), "kind": kind, "pts": rpts(seg),
                 "width": r1(width), "bridge": bridge, "tunnel": tunnel, "layer": layer}
            if t.get("name"):
                r["name"] = t["name"]
            if lanes:
                r["lanes"] = int(lanes)
            if oneway:
                r["oneway"] = True
            if t.get("bridge") and t["bridge"] not in ("yes", "no"):
                r["bridgeType"] = t["bridge"]
            if t.get("ref"):
                r["ref"] = t["ref"]
            roads.append(r)
    return roads, areas


def route(ways, eastbound):
    """Yönlü busway grafiğinde batı kenarından doğu kenarına (ya da tersi) en kısa yol.
    ways: roads.json kayıtları. Döner: (pts, layers) — her köşe için katman."""
    import heapq
    key = lambda p: (round(p[0], 1), round(p[1], 1))
    edges = defaultdict(list)
    for w in ways:
        p = w["pts"]
        L = LineString(p).length
        edges[key(p[0])].append((key(p[-1]), L, p, w["layer"]))
        if not w.get("oneway"):
            edges[key(p[-1])].append((key(p[0]), L, p[::-1], w["layer"]))
    W, E_ = CLIP[0] + 1, CLIP[2] - 1
    nodes = set(edges) | {e[0] for v in edges.values() for e in v}
    src = [n for n in nodes if (n[0] <= W if eastbound else n[0] >= E_)]
    dst = {n for n in nodes if (n[0] >= E_ if eastbound else n[0] <= W)}
    dist = {n: 0.0 for n in src}
    prev = {}
    pq = [(0.0, n) for n in src]
    heapq.heapify(pq)
    end = None
    while pq:
        d, n = heapq.heappop(pq)
        if d > dist.get(n, 1e18):
            continue
        if n in dst:
            end = n
            break
        for m, L, p, lay in edges.get(n, []):
            if d + L < dist.get(m, 1e18):
                dist[m] = d + L
                prev[m] = (n, p, lay)
                heapq.heappush(pq, (d + L, m))
    if end is None:
        return None, None
    segs = []
    n = end
    while n in prev:
        a, p, lay = prev[n]
        segs.append((p, lay))
        n = a
    segs.reverse()
    pts, lays = [], []
    for p, lay in segs:
        if pts:
            p = p[1:]
        pts += p
        lays += [lay] * len(p)
    return pts, lays


# ---------------------------------------------------------------- noktalar
def build_points(E):
    pts = []
    greens = []
    for e in E:
        t = e.get("tags", {})
        if e["type"] == "node":
            x, z = to_xz(e["lat"], e["lon"])
            if not (CLIP[0] <= x <= CLIP[2] and CLIP[1] <= z <= CLIP[3]):
                continue
            kind = None
            if t.get("railway") == "subway_entrance" or (t.get("entrance") and t.get("railway")):
                kind = "subway_entrance"
            elif t.get("railway") == "station" or t.get("public_transport") == "station":
                kind = "station"
            elif t.get("highway") == "bus_stop" or (t.get("public_transport") == "platform" and t.get("bus") == "yes"):
                kind = "metrobus_stop" if "metrob" in (t.get("name", "").lower()) else "bus_stop"
            elif t.get("highway") == "traffic_signals":
                kind = "traffic_signals"
            elif t.get("highway") == "street_lamp":
                kind = "street_lamp"
            elif t.get("natural") == "tree":
                kind = "tree"
            if not kind:
                continue
            p = {"kind": kind, "x": r1(x), "z": r1(z)}
            if t.get("name"):
                p["name"] = t["name"]
            if kind == "tree":
                p["source"] = "osm"
            if kind in ("station", "subway_entrance") and t.get("layer"):
                p["layer"] = int(num(t["layer"]))
            pts.append(p)
        elif e["type"] == "way":
            g = way_xz(e)
            if t.get("natural") == "tree_row" and len(g) >= 2:
                ls = LineString(g)
                n = max(int(ls.length // 8), 1)
                for i in range(n + 1):
                    q = ls.interpolate(i / n, normalized=True)
                    if CLIP_BOX.contains(q):
                        pts.append({"kind": "tree", "x": r1(q.x), "z": r1(q.y), "source": "osm_tree_row"})
            elif (t.get("leisure") in ("park", "garden", "playground", "pitch") or t.get("landuse") in ("grass", "park", "recreation_ground")
                  or t.get("natural") in ("wood", "scrub")) and len(g) >= 4:
                ring = clean_ring(g)
                poly = make_valid(Polygon(ring))
                if not CLIP_BOX.intersects(poly) or poly.area < 30:
                    continue
                kind = t.get("leisure") or t.get("landuse") or t.get("natural")
                greens.append({"id": f"w{e['id']}", "kind": kind, "name": t.get("name"), "pts": rpts(ring)})
                if kind in ("park", "garden", "wood", "recreation_ground"):
                    # Sentetik ağaç: yeşil alan içinde ~12 m aralıklı, kararlı oynatılmış ızgara.
                    minx, minz, maxx, maxz = poly.bounds
                    step = 12.0
                    zz = minz
                    while zz <= maxz:
                        xx = minx
                        while xx <= maxx:
                            jx = (hrand(f"{e['id']}{xx:.0f}{zz:.0f}x") - .5) * 8
                            jz = (hrand(f"{e['id']}{xx:.0f}{zz:.0f}z") - .5) * 8
                            q = Point(xx + jx, zz + jz)
                            if poly.contains(q) and CLIP_BOX.contains(q):
                                pts.append({"kind": "tree", "x": r1(q.x), "z": r1(q.y), "source": "synthetic"})
                            xx += step
                        zz += step
    return pts, greens


# ---------------------------------------------------------------- main
def main():
    E = json.load(open(os.path.join(RAW, "overpass.json"), encoding="utf-8"))["elements"]
    byid = {(e["type"], e["id"]): e for e in E}
    terr, tstats = build_terrain()
    height_at = make_height_at(terr)

    roads, ped_areas = build_roads(E)
    buildings, src_count, ms_added, dropped, recs = build_buildings(E, height_at, roads)
    points, greens = build_points(E)

    # --- landmarks
    bmap = {b["id"]: b for b in buildings}

    def fp(osm_type, oid, role):
        b = bmap.get(f"{osm_type[0]}{oid}")
        if not b:
            return None
        d = {"osmId": f"{osm_type}/{oid}", "role": role, "footprint": b["footprint"], "height": b["height"],
             "heightSource": b["heightSource"], "baseY": b["baseY"]}
        if b.get("minHeight"):
            d["minHeight"] = b["minHeight"]
        if b.get("holes"):
            d["holes"] = b["holes"]
        return d

    def center_of(fps):
        xs = [p[0] for f in fps for p in f["footprint"]]
        zs = [p[1] for f in fps for p in f["footprint"]]
        return [r1(sum(xs) / len(xs)), r1(sum(zs) / len(zs))]

    def way_poly(wid):
        e = byid.get(("way", wid))
        return rpts(clean_ring(way_xz(e))) if e else None

    lms = []
    # Trump Towers
    f = [fp("way", 1222286465, "residence_tower"), fp("way", 1455454989, "office_tower"), fp("way", 163629174, "podium_mall")]
    f = [x for x in f if x]
    lms.append({"key": "trump_towers", "name": "Trump Towers İstanbul", "center": center_of(f),
                "osmIds": [x["osmId"] for x in f], "footprints": f, "height": 155.0, "heightSource": "reference",
                "notes": "Residence tower 39 floors / 155 m roof; office tower 37 floors / 145 m roof (Wikipedia 'Trump Towers Istanbul'; ScraperBase lists 156 m). OSM has only building:levels (consistent); metres from these published sources. Towers sit on the podium (OSM building:min_level=3) — minHeight left 0 so tower volumes reach the ground; podium height 20 m is an ESTIMATE. Opened 2012."})
    # Şişli Plaza
    sp = [fp("way", 164288215, "complex_outline_incl_podium")]
    sp = [x for x in sp if x]
    lms.append({"key": "sisli_plaza", "name": "Şişli Plaza", "center": center_of(sp), "osmIds": [x["osmId"] for x in sp],
                "footprints": sp, "height": 170.1, "heightSource": "reference",
                "notes": "Wikipedia 'Şişli Plaza': roof 170.1 m, 46 floors (40 residential on a 4-floor retail podium); the Istanbul tallest-list gives 152 m — sources differ. OSM maps only the whole-complex outline (~67×165 m), so the TOWER FOOTPRINT AND POSITION WITHIN THE OUTLINE ARE UNKNOWN; outline height in buildings.json is a 20 m podium estimate. Place the tower from photos (refs/)."})
    # Torun Center
    tc = [fp("way", w, "tower") for w in (728793801, 728793798, 728793799, 728793800)] + \
         [fp("way", w, "low_block") for w in (728793802, 728793803, 728793805)]
    tc = [x for x in tc if x]
    lms.append({"key": "torun_center", "name": "Torun Center", "center": center_of([x for x in tc if x["role"] == "tower"]),
                "osmIds": [x["osmId"] for x in tc], "footprints": tc, "height": 160.0, "heightSource": "osm",
                "notes": "OSM tags four tower ways each height=160/levels=42. CTBUH/ScraperBase list East and South residential towers at 160 m (42 floors) plus an Office Tower (~36 floors per sales listings, height unpublished). OSM has FOUR 160 m ways for three Torun towers; a 'QUASAR Heliport' (way 1295515350) is mapped on w728793799, so that way may actually be Quasar İstanbul Residence (160 m / 48 floors per Wikipedia list) on the adjacent former liquor-factory site. Which way is the Torun office tower (height unpublished) is UNVERIFIED; all four kept at OSM 160 m. Low blocks w728793803/805 height=40 from OSM; w728793802 (1 level, 5 m) is likely the restored Art Deco liquor factory. The complex sits at the scene's east edge (x≈520–760)."})
    # Cevahir
    cv = [fp("way", 46962419, "mall")]
    cv = [x for x in cv if x]
    lms.append({"key": "cevahir", "name": "İstanbul Cevahir AVM", "center": center_of(cv), "osmIds": [x["osmId"] for x in cv],
                "footprints": cv, "height": 34.0, "heightSource": "estimate",
                "notes": "6 retail floors (OSM building:levels=6; Wikipedia), ~2,500 m² glass roof with a large clock. Above-ground height not published; 34 m is an ESTIMATE."})
    # Viaduct
    via_ids = [r for r in roads if r.get("bridgeType") == "viaduct"]
    lms.append({"key": "viaduct", "name": "Mecidiyeköy Viyadüğü (D100 / E-5 + Metrobüs)",
                "center": center_of([{"footprint": r["pts"]} for r in via_ids]),
                "osmIds": sorted({"way/" + r["id"][1:].split("_")[0] for r in via_ids}),
                "footprints": [{"osmId": "way/" + r["id"][1:].split("_")[0], "role": r["kind"], "centerline": r["pts"],
                                "width": r["width"], "layer": r["layer"]} for r in via_ids],
                "height": 9.0, "heightSource": "estimate",
                "deckHeight": 9.0,
                "notes": "OSM bridge=viaduct, layer=1: two D100 carriageways ('1. Çevre Yolu') + Metrobüs busway, running east from about x≈190 over the Büyükdere Cd. / square junction. Deck height above ground (~9 m) is an ESTIMATE. Footprints here are centerlines (polylines) with width, not polygons; the same ways are also in roads.json (bridge:true)."})
    # Metrobüs durağı
    st_poly = way_poly(745420396)
    plats = [way_poly(w) for w in (957443633,) if way_poly(w)]
    lms.append({"key": "metrobus_station", "name": "İETT Mecidiyeköy Metrobüs Peronları",
                "center": center_of([{"footprint": st_poly}]), "osmIds": ["way/745420396", "way/957443633"],
                "footprints": [{"osmId": "way/745420396", "role": "station_area", "footprint": st_poly}] +
                              [{"osmId": "way/957443633", "role": "platform", "footprint": p} for p in plats],
                "height": 5.0, "heightSource": "estimate",
                "notes": "Station area in the D100 median (public_transport=station). Canopy height ~5 m ESTIMATE. The scene origin lies inside this area."})
    # Metro
    ents = [p for p in points if p["kind"] == "subway_entrance"]
    stations = [p for p in points if p["kind"] == "station"]
    lms.append({"key": "metro_station", "name": "Şişli-Mecidiyeköy (M2) / Mecidiyeköy (M7, M11) metro",
                "center": [r1(sum(p["x"] for p in ents) / max(len(ents), 1)), r1(sum(p["z"] for p in ents) / max(len(ents), 1))],
                "osmIds": ["node/7721147954", "node/8050455173", "way/835045671"],
                "footprints": [{"osmId": "way/835045671", "role": "underground_box_layer-2", "footprint": way_poly(835045671)}],
                "entrances": [[p["x"], p["z"]] for p in ents],
                "stations": [{"name": p.get("name"), "x": p["x"], "z": p["z"]} for p in stations],
                "height": 3.0, "heightSource": "estimate",
                "notes": "Underground (layer -2…-5); only entrances are visible. Entrance kiosk height ~3 m ESTIMATE. Entrances also in points.json (kind subway_entrance)."})
    # Meydan
    sq = way_poly(1007293783)
    lms.append({"key": "square", "name": "Mecidiyeköy Meydanı", "center": center_of([{"footprint": sq}]),
                "osmIds": ["way/1007293783"], "footprints": [{"osmId": "way/1007293783", "role": "square", "footprint": sq}],
                "height": 0.0, "heightSource": "osm",
                "notes": "place=square polygon (flat). Partly under the west end of the D100 viaduct. Pedestrian areas around it are in roads.json 'areas'."})
    # Metrobüs hattı (ışık şeridi için birleşik)
    bw = [r for r in roads if r["kind"] == "busway"]
    paths = []
    for eb in (True, False):
        p, lays = route(bw, eb)
        if p:
            paths.append({"dir": "eastbound" if eb else "westbound", "pts": rpts(p), "layer": lays})
    ch = [p["pts"] for p in paths]
    lms.append({"key": "metrobus_line", "name": "Metrobüs hattı (34)", "center": [0.0, 0.0],
                "osmIds": [], "footprints": [], "paths": paths,
                "height": 0.0, "heightSource": "osm",
                "notes": "Continuous directional routes through the busway graph (roads.json kind=busway, oneway respected), edge to edge of the data extent. 'layer' is per vertex (1 = on bridge/viaduct, 0 = at grade). The two directions share the bidirectional viaduct (x>185) and the west bridges (x −585…−312). Not a building; osmIds empty."})

    for b in buildings:
        for lm in lms:
            if any(fpx.get("osmId") == ("way/" + b["id"][1:] if b["id"].startswith("w") else "relation/" + b["id"][1:]) for fpx in lm["footprints"]):
                b["landmark"] = lm["key"]

    origin = {"lat": LAT0, "lon": LON0, "units": "m", "axes": "+X east, +Y up, -Z north"}
    def dump(name, obj):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        return os.path.getsize(os.path.join(OUT, name))

    sizes = {
        "buildings.json": dump("buildings.json", {"origin": origin, "buildings": buildings}),
        "roads.json": dump("roads.json", {"origin": origin, "roads": roads, "areas": ped_areas}),
        "terrain.json": dump("terrain.json", terr),
        "landmarks.json": dump("landmarks.json", {"origin": origin, "landmarks": lms}),
        "points.json": dump("points.json", {"origin": origin, "points": points, "greens": greens}),
    }

    # --- doğrulama/istatistik
    st = {"sizes": sizes, "buildings": len(buildings), "heightSource": dict(src_count), "ms_added": ms_added,
          "outlines_replaced_by_parts": dropped, "terrain": tstats}
    hs = sorted(buildings, key=lambda b: -b["height"])[:12]
    st["top"] = [(b["id"], b["height"], b["heightSource"], b.get("name"), b["footprint"][0]) for b in hs]
    hv = [b["height"] for b in buildings if not b.get("part")]
    st["height_median"] = statistics.median(hv)
    lv_all = [b["levels"] for b in buildings if b.get("levels") and not b.get("part")]
    st["levels_hist"] = dict(sorted(Counter(lv_all).items()))
    st["roads"] = len(roads); st["road_kinds"] = dict(Counter(r["kind"] for r in roads))
    st["bridges"] = [(r["id"], r["kind"], r.get("name"), r.get("bridgeType")) for r in roads if r["bridge"] and r["kind"] not in ("footway", "steps")]
    st["busway_routes"] = []
    for p in paths:
        c = p["pts"]
        gaps = max(math.dist(c[i], c[i + 1]) for i in range(len(c) - 1))
        st["busway_routes"].append({"dir": p["dir"], "n": len(c), "start": c[0], "end": c[-1],
                                    "length": r1(LineString(c).length), "maxSegment": r1(gaps),
                                    "onBridge": r1(sum(LineString(c[i:i + 2]).length for i in range(len(c) - 1) if p["layer"][i] >= 1 and p["layer"][i + 1] >= 1))})
    st["landmark_centers"] = {l["key"]: l["center"] for l in lms}
    H = terr["heights"]
    st["terrain_range"] = (min(H), max(H), terr["originElevation"])
    st["points"] = dict(Counter(p["kind"] + ("/" + p["source"] if "source" in p else "") for p in points))
    with open(os.path.join(RAW, "build-stats.json"), "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in st.items() if k not in ("levels_hist",)}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
