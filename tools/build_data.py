#!/usr/bin/env python3
"""Mecidiyeköy veri hattı: data/raw/*  ->  web/public/data/{meta,buildings,roads,terrain,pois}.json

Çalıştırma (depo kökünden ya da herhangi bir yerden):
    python tools/build_data.py            # 5 JSON + docs/estimated_heights.md
    python tools/build_data.py --overview # ayrıca out/shots/data_overview.png

Bağımlılıklar: numpy, scipy, shapely (>=2), tifffile.  Ağ erişimi YOK; yalnız data/raw okunur.
Deterministik: rastgelelik bina kimliğinin md5 özetinden gelir, saat/tarih kullanılmaz
(generatedAt = Overpass verisinin zaman damgası).

Koordinatlar (CONTRACT §2): x = doğu, z = güney, y = yukarı; metre; orijin meta.json'da.
"""
from __future__ import annotations

import hashlib
import heapq
import json
import math
import struct
import sys
import zlib
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import tifffile
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from shapely import STRtree
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data"
DOCS = ROOT / "docs"

# ----------------------------------------------------------------------------- sabitler
# Orijin: Mecidiyeköy metrobüs durağı peronunun (OSM way 1305577747) ağırlık merkezi;
# D-100 ekseninde, viyadüğün batı ucunun hemen batısında, Trump Towers ile Cevahir arasında.
LAT0, LON0 = 41.066886, 28.991723
# Veri bbox'ı = ham indirmelerin bbox'ı (Overture .state dosyaları); çekirdek alan CONTRACT §1.
BBOX = dict(south=41.0575, west=28.981, north=41.0745, east=29.003)
CORE = dict(south=41.060, west=28.984, north=41.072, east=29.000)
KX = 111320.0 * math.cos(math.radians(LAT0))
KZ = 110574.0
LEVEL_H = 3.2            # kat yüksekliği (m)
TERRAIN_MARGIN = 400.0   # arazi ızgarası bbox'tan bu kadar taşar (m)
TERRAIN_STEP = 20.0

LANDMARK_IDS = {
    "trump": {"w163629174", "w1222286465", "w1455454989"},
    "torun": {"w728793798", "w728793799", "w728793800", "w728793801", "w728793802", "w1321569694"},
    "cevahir": {"w46962419"},
}

VEHICLE = {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
           "tertiary", "tertiary_link", "residential", "unclassified", "living_street",
           "service", "busway"}
MAJOR = {"trunk", "trunk_link", "primary", "primary_link", "busway"}
FOOT = {"footway", "steps", "pedestrian", "path", "platform", "corridor", "cycleway"}


def to_xz(lon: float, lat: float) -> tuple[float, float]:
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def r1(v: float) -> float:
    v = round(float(v), 1)
    return 0.0 if v == 0 else v


def hfloat(key: str, salt: str) -> float:
    """Kimlikten türeyen deterministik [0,1) sayı."""
    h = hashlib.md5(f"{salt}:{key}".encode()).digest()
    return int.from_bytes(h[:6], "big") / float(1 << 48)


def smoothstep(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def num(s) -> float | None:
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s = str(s).strip().lower().replace(",", ".")
    for suf in ("meters", "metres", "meter", "metre", "m"):
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
            break
    try:
        return float(s.split(";")[0])
    except ValueError:
        return None


# ============================================================================= arazi
class Terrain:
    def __init__(self):
        with tifffile.TiffFile(RAW / "cop30.tif") as tf:
            page = tf.pages[0]
            dem = page.asarray().astype(np.float64)
            sx, sy, _ = page.tags["ModelPixelScaleTag"].value
            tp = page.tags["ModelTiepointTag"].value
        self.lon_w, self.lat_n, self.ps_x, self.ps_y = tp[3], tp[4], sx, sy
        self.raw = dem
        self.raw_min, self.raw_max = float(dem.min()), float(dem.max())
        # COP30 bir yüzey modeli (çatılar dahil). 1) yerel düşük yüzdelik (çatıları at),
        # 2) geniş Gauss (yalnız genel eğim kalsın). Piksel ~23 m (D-B) x ~31 m (K-G).
        low = ndi.percentile_filter(dem, 15, size=(5, 7), mode="nearest")
        self.smooth = ndi.gaussian_filter(low, sigma=(1.6, 2.1), mode="nearest")

        bx0, bz0 = to_xz(BBOX["west"], BBOX["north"])
        bx1, bz1 = to_xz(BBOX["east"], BBOX["south"])
        self.bbox_local = (bx0, bx1, bz0, bz1)
        st = TERRAIN_STEP
        self.x0 = math.floor((bx0 - TERRAIN_MARGIN) / st) * st
        self.z0 = math.floor((bz0 - TERRAIN_MARGIN) / st) * st
        self.nx = int(math.ceil((bx1 + TERRAIN_MARGIN - self.x0) / st)) + 1
        self.nz = int(math.ceil((bz1 + TERRAIN_MARGIN - self.z0) / st)) + 1
        self.dx = self.dz = st
        xs = self.x0 + np.arange(self.nx) * st
        zs = self.z0 + np.arange(self.nz) * st
        gx, gz = np.meshgrid(xs, zs)
        abs_grid = self._sample_tif(self.smooth, gx, gz)
        abs_grid = ndi.gaussian_filter(abs_grid, 1.0, mode="nearest")
        self.elev0 = float(self._bilinear(abs_grid, 0.0, 0.0))
        self.grid = np.round(abs_grid - self.elev0, 1)
        self.x1 = self.x0 + (self.nx - 1) * st
        self.z1 = self.z0 + (self.nz - 1) * st
        # tif kapsaması denetimi
        lon_min = LON0 + self.x0 / KX
        lon_max = LON0 + self.x1 / KX
        lat_max = LAT0 - self.z0 / KZ
        lat_min = LAT0 - self.z1 / KZ
        h, w = dem.shape
        self.tif_covers = (lon_min >= self.lon_w and lon_max <= self.lon_w + w * sx
                           and lat_max <= self.lat_n and lat_min >= self.lat_n - h * sy)

    def _sample_tif(self, arr, x, z):
        lon = LON0 + np.asarray(x) / KX
        lat = LAT0 - np.asarray(z) / KZ
        c = (lon - self.lon_w) / self.ps_x - 0.5
        r = (self.lat_n - lat) / self.ps_y - 0.5
        return ndi.map_coordinates(arr, [r, c], order=1, mode="nearest")

    def _bilinear(self, grid, x, z):
        fx = min(max((x - self.x0) / self.dx, 0.0), self.nx - 1.000001)
        fz = min(max((z - self.z0) / self.dz, 0.0), self.nz - 1.000001)
        ix, iz = int(fx), int(fz)
        tx, tz = fx - ix, fz - iz
        g = grid
        return ((g[iz, ix] * (1 - tx) + g[iz, ix + 1] * tx) * (1 - tz)
                + (g[iz + 1, ix] * (1 - tx) + g[iz + 1, ix + 1] * tx) * tz)

    def at(self, x: float, z: float) -> float:
        """Tarayıcıdaki heightAt ile aynı: yuvarlanmış ızgarada çift doğrusal örnekleme."""
        return float(self._bilinear(self.grid, x, z))

    def raw_at(self, x: float, z: float) -> float:
        return float(self._sample_tif(self.raw, [x], [z])[0]) - self.elev0

    def in_extent(self, x, z):
        return self.x0 <= x <= self.x1 and self.z0 <= z <= self.z1

    def in_bbox(self, x, z, pad=0.0):
        a, b, c, d = self.bbox_local
        return a - pad <= x <= b + pad and c - pad <= z <= d + pad


# ============================================================================= binalar
def clean_poly(geom, min_area=4.0):
    """Geçerli, sadeleştirilmiş Polygon listesi."""
    if geom is None or geom.is_empty:
        return []
    if not geom.is_valid:
        geom = geom.buffer(0)
    geom = geom.simplify(0.15, preserve_topology=True)
    polys = [geom] if isinstance(geom, Polygon) else [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
    return [orient(p, 1.0) for p in polys if p.area >= min_area]


def ring_coords(ring):
    pts = [[r1(x), r1(z)] for x, z in ring.coords]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    out = []
    for p in pts:
        if not out or out[-1] != p:
            out.append(p)
    return out


def osm_way_poly(el):
    g = el.get("geometry") or []
    if len(g) < 4:
        return None
    return Polygon([to_xz(p["lon"], p["lat"]) for p in g])


def osm_rel_polys(el):
    outers, inners = [], []
    for m in el.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        ls = LineString([to_xz(p["lon"], p["lat"]) for p in m["geometry"]])
        (inners if m.get("role") == "inner" else outers).append(ls)
    if not outers:
        return None
    outer = unary_union(list(polygonize(unary_union(outers))))
    if inners:
        inner = unary_union(list(polygonize(unary_union(inners))))
        outer = outer.difference(inner)
    return outer


def height_from_tags(tags):
    """-> (height, source, levels, min_height, flag)  OSM etiketlerinden; yoksa height None."""
    h = num(tags.get("height") or tags.get("building:height"))
    lv = num(tags.get("building:levels"))
    rlv = num(tags.get("roof:levels")) or 0.0
    minh = num(tags.get("min_height"))
    minlv = num(tags.get("building:min_level"))
    if minh is None and minlv:
        minh = minlv * LEVEL_H
    flag = None
    if h is not None and h <= 0:
        h = None
    if lv is not None and lv <= 0:
        lv = None
    if h is not None and lv is not None and h < 2.0 * lv:
        flag = f"height={h:g} etiketi {lv:g} katla tutarsız; kat sayısı kullanıldı"
        h = None
    if h is not None:
        return h, "osm", lv, minh or 0.0, flag
    if lv is not None:
        return (lv + rlv) * LEVEL_H, "levels", lv, minh or 0.0, flag
    return None, None, None, minh or 0.0, flag


SMALL_KINDS = {"garage", "garages", "shed", "roof", "kiosk", "hut", "carport", "toilets", "service",
               "container", "guardhouse", "canopy", "bunker", "ruins", "cabin"}


def estimate_height(bid, kind, area, local_lv):
    """Etiket yokken: komşuluk kat medyanı + tip + taban alanı + tohumlu sapma."""
    a, b, c = hfloat(bid, "a"), hfloat(bid, "b"), hfloat(bid, "c")
    tri = a + b - 1.0                                # üçgen dağılım (-1,1)
    if kind in SMALL_KINDS or area < 25:
        return round(2.6 + 1.2 * c, 1)
    if kind in ("mosque", "church", "synagogue", "religious", "chapel"):
        return round(9.0 + 5.0 * a, 1)
    if area < 50:
        return round((1 + int(a * 2)) * LEVEL_H + 0.6 * c, 1)
    base = local_lv
    if area < 90:
        base = min(base, 4.0) - 0.5
    if kind in ("school", "university", "kindergarten", "college", "education"):
        base = min(base, 4.0)
    elif kind in ("hospital", "medical"):
        base = max(base, 5.0)
    elif kind in ("industrial", "warehouse", "manufacture"):
        base = 2.0
    elif kind in ("retail", "supermarket") and area > 800:
        base = min(base, 3.5)
    elif kind in ("hotel", "office", "commercial"):
        base = base + 1.0
    elif area > 1500:
        base = min(base, 5.0)
    lv = int(round(base + 1.8 * tri))
    lv = max(2, min(11, lv))
    return round(lv * LEVEL_H + 1.0 * c, 1)


def build_buildings(osm, terrain, log):
    recs = {}      # id -> dict(poly, tags, ...)
    parts = []
    for el in osm["elements"]:
        tags = el.get("tags") or {}
        is_b = "building" in tags and tags["building"] not in ("no",)
        is_p = "building:part" in tags and tags["building:part"] not in ("no",)
        if not (is_b or is_p):
            continue
        if tags.get("location") == "underground":
            continue
        geom = osm_way_poly(el) if el["type"] == "way" else osm_rel_polys(el) if el["type"] == "relation" else None
        polys = clean_poly(geom)
        if not polys:
            continue
        base_id = ("w" if el["type"] == "way" else "r") + str(el["id"])
        for i, p in enumerate(sorted(polys, key=lambda q: -q.area)):
            c = p.centroid
            if not terrain.in_bbox(c.x, c.y):
                continue
            rec = dict(id=base_id if i == 0 else f"{base_id}_{i}", poly=p, tags=tags, src="osm")
            if is_b:
                recs[rec["id"]] = rec
            else:
                parts.append(rec)

    # ---- Overture: OSM kökenli kayıtlar kimlikle eşleşir; MS ML ayak izleri boşlukları doldurur
    ov = json.loads((RAW / "overture_buildings.geojson").read_text(encoding="utf-8"))
    ov_attr = {}        # osm id -> overture props
    ov_extra = []
    for f in ov["features"]:
        pr = f["properties"]
        if pr.get("is_underground"):
            continue
        srcs = pr.get("sources") or [{}]
        ds = srcs[0].get("dataset")
        rid = (srcs[0].get("record_id") or "").split("@")[0]
        g = f["geometry"]
        rings = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        geoms = []
        for poly in rings:
            ext = [to_xz(x, y) for x, y in poly[0]]
            holes = [[to_xz(x, y) for x, y in h] for h in poly[1:]]
            if len(ext) >= 4:
                geoms.append(Polygon(ext, holes))
        if not geoms:
            continue
        geom = geoms[0] if len(geoms) == 1 else unary_union([q.buffer(0) for q in geoms])
        if ds == "OpenStreetMap" and rid:
            ov_attr[rid] = pr
        ov_extra.append((f.get("id") or pr.get("id") or rid, ds, rid, pr, geom))

    # Overture building_part kayıtları (tümü OSM kökenli): yalnız eksik yükseklik/kat için yedek
    ovp = json.loads((RAW / "overture_building_parts.geojson").read_text(encoding="utf-8"))
    for f in ovp["features"]:
        pr = f["properties"]
        srcs = pr.get("sources") or [{}]
        rid = (srcs[0].get("record_id") or "").split("@")[0]
        if rid and srcs[0].get("dataset") == "OpenStreetMap":
            ov_attr.setdefault(rid, pr)
    part_ids = {p["id"] for p in parts}
    base_polys = [r["poly"] for r in recs.values()] + [p["poly"] for p in parts]
    tree = STRtree(base_polys)
    n_ms = n_ovosm = 0
    for fid, ds, rid, pr, geom in sorted(ov_extra, key=lambda t: str(t[0])):
        if ds == "OpenStreetMap" and (rid in recs or rid in part_ids):
            continue
        for p in clean_poly(geom, min_area=12.0)[:1]:
            c = p.centroid
            if not terrain.in_bbox(c.x, c.y):
                continue
            ov_area = sum(base_polys[i].intersection(p).area for i in tree.query(p))
            if ov_area > 0.2 * p.area:
                continue
            bid = "ov" + str(fid).replace("-", "")[:12]
            tags = {}
            if pr.get("class"):
                tags["building"] = pr["class"]
            recs[bid] = dict(id=bid, poly=p, tags=tags, src="ms" if ds != "OpenStreetMap" else "overture-osm", ov=pr)
            if ds == "OpenStreetMap":
                n_ovosm += 1
            else:
                n_ms += 1
    # eklenen Overture ayak izleri kendi aralarında da çakışmasın
    added = [r for r in recs.values() if r["src"] != "osm"]
    if added:
        atree = STRtree([r["poly"] for r in added])
        drop = set()
        for i, r in enumerate(added):
            if r["id"] in drop:
                continue
            for j in atree.query(r["poly"]):
                o = added[j]
                if j <= i or o["id"] in drop:
                    continue
                if r["poly"].intersection(o["poly"]).area > 0.3 * min(r["poly"].area, o["poly"].area):
                    drop.add(o["id"] if o["poly"].area <= r["poly"].area else r["id"])
        for d in drop:
            recs.pop(d, None)
            n_ms -= 1
    log["overtureFootprintsAdded"] = dict(microsoftML=n_ms, osmDerived=n_ovosm)

    # ---- yükseklikler: OSM height -> Overture height -> kat -> (sonra) tahmin
    warnings = []
    for r in list(recs.values()) + parts:
        h, src, lv, minh, flag = height_from_tags(r["tags"])
        if flag:
            warnings.append(f"{r['id']}: {flag}")
        pr = r.get("ov") or ov_attr.get(r["id"]) or {}
        if h is None and pr.get("height"):
            h, src = float(pr["height"]), "overture"
        if h is None and pr.get("num_floors"):
            lv = float(pr["num_floors"])
            h, src = lv * LEVEL_H, "levels"
        r.update(h=h, hsrc=src, lv=lv, minh=minh)
        name = r["tags"].get("name")
        if not name and pr.get("names"):
            name = (pr["names"] or {}).get("primary")
        r["name"] = name
        kind = r["tags"].get("building")
        if kind in (None, "yes"):
            kind = r["tags"].get("building:part")
        if kind in (None, "yes"):
            kind = r["tags"].get("amenity") or pr.get("class") or pr.get("subtype")
        if kind == "residental":
            kind = "residential"
        r["kind"] = kind if kind not in (None, "yes") else None
    log["heightTagWarnings"] = warnings

    # ---- building:part -> ana hat eşleme
    out_ids = list(recs)
    otree = STRtree([recs[i]["poly"] for i in out_ids])
    by_outline = defaultdict(list)
    for p in parts:
        best, ba = None, 0.0
        for j in otree.query(p["poly"]):
            a = recs[out_ids[j]]["poly"].intersection(p["poly"]).area
            if a > ba:
                best, ba = out_ids[j], a
        if best is not None and ba >= 0.5 * p["poly"].area:
            by_outline[best].append(p)
        else:                                   # sahipsiz parça: bağımsız bina gibi davran
            p["standalone"] = True
            recs[p["id"]] = p
    replaced = 0
    for oid, plist in by_outline.items():
        o = recs[oid]
        cov = unary_union([p["poly"] for p in plist]).intersection(o["poly"]).area / o["poly"].area
        if cov >= 0.6:
            # Simple-3D-Buildings kuralı: parçalar ana hattı tümüyle temsil ediyor -> ana hat atılır
            replaced += 1
            del recs[oid]
            for p in plist:
                if p["h"] is None and o["h"] is not None:
                    p.update(h=o["h"], hsrc=o["hsrc"], lv=o["lv"])
                p["partOf"] = oid
                p["name"] = p["name"] or o["name"]
                p["kind"] = p["kind"] if p["kind"] not in (None, "roof") or o["kind"] is None else (p["kind"] or o["kind"])
                if p["kind"] is None:
                    p["kind"] = o["kind"]
                p["outline_dropped"] = True
                recs[p["id"]] = p
        else:
            # ana hat = podyum/kütle; parçalar onun üstünde ayrı hacimler (kuleler)
            o["hasParts"] = True
            for p in plist:
                if p["h"] is None:
                    continue                      # bilgisiz parça bir şey katmıyor
                p["partOf"] = oid
                recs[p["id"]] = p
    log["outlinesReplacedByParts"] = replaced

    # ---- simge yapılar
    lm_of = {}
    for lm, ids in LANDMARK_IDS.items():
        for i in ids:
            lm_of[i] = lm
    for r in recs.values():
        lm = lm_of.get(r["id"]) or lm_of.get(r.get("partOf", ""))
        if lm:
            r["landmark"] = lm

    # ---- tahmin
    known = [(r["poly"].centroid.x, r["poly"].centroid.y, min(r["h"] / LEVEL_H, 12.0))
             for r in recs.values() if r["h"] is not None and not r.get("partOf") and r["poly"].area > 40]
    kt = cKDTree([(k[0], k[1]) for k in known])
    klv = np.array([k[2] for k in known])
    glob = float(np.median(klv))
    for r in recs.values():
        if r["h"] is not None:
            continue
        c = r["poly"].centroid
        idx = kt.query_ball_point((c.x, c.y), 150.0)
        local = float(np.median(klv[idx])) if len(idx) >= 3 else glob
        r["h"] = estimate_height(r["id"], r["kind"], r["poly"].area, local)
        r["hsrc"] = "estimate"
        r["lv"] = None

    # ---- çıktı
    # baseY = ayak izinin altındaki en düşük arazi kotu (bina havada kalmasın); aynı ana hatta
    # bağlı parçalar (podyum + kuleler) ortak baseY kullanır. groundY = ortalama zemin kotu.
    def ground(p):
        ys = [terrain.at(x, z) for x, z in p.exterior.coords] + [terrain.at(p.centroid.x, p.centroid.y)]
        return min(ys), sum(ys) / len(ys)
    grp_base = {}
    for bid, r in recs.items():
        key = r.get("partOf") or bid
        lo, mean = ground(r["poly"])
        r["_g"] = (lo, mean)
        g = grp_base.setdefault(key, [lo, 0.0, 0.0])
        g[0] = min(g[0], lo)
        g[1] += mean * r["poly"].area
        g[2] += r["poly"].area
    out = []
    for bid in sorted(recs):
        r = recs[bid]
        p = r["poly"]
        ring = ring_coords(p.exterior)
        if len(ring) < 3:
            continue
        gb = grp_base[r.get("partOf") or bid]
        base_y, ground_y = gb[0], gb[1] / gb[2]
        minh = r["minh"] if r["minh"] < r["h"] - 0.5 else 0.0
        d = dict(id=bid, ring=ring)
        holes = [ring_coords(i) for i in p.interiors if Polygon(i).area >= 6.0]
        if holes:
            d["holes"] = holes
        d.update(height=r1(r["h"]), minHeight=r1(minh), baseY=r1(base_y), heightSource=r["hsrc"],
                 estimated=r["hsrc"] == "estimate")
        if ground_y - base_y >= 0.5:
            d["groundY"] = r1(ground_y)
        if r["lv"]:
            d["levels"] = int(r["lv"]) if float(r["lv"]).is_integer() else r["lv"]
        if r["name"]:
            d["name"] = r["name"]
        if r["kind"]:
            d["kind"] = r["kind"]
        if r.get("landmark"):
            d["landmark"] = r["landmark"]
        if r.get("partOf"):
            d["part"] = True
            d["partOf"] = r["partOf"]
        if r.get("hasParts"):
            d["hasParts"] = True
        if r["src"] != "osm":
            d["footprint"] = r["src"]
        d["_area"] = p.area
        d["_c"] = (p.centroid.x, p.centroid.y)
        out.append(d)
    return out


# ============================================================================= yollar
def build_roads(osm, terrain, log):
    ways = []
    for el in osm["elements"]:
        tags = el.get("tags") or {}
        hw = tags.get("highway")
        if el["type"] != "way" or not hw or hw in ("proposed", "construction", "razed", "abandoned"):
            continue
        if tags.get("area") == "yes" or len(el.get("geometry", [])) < 2:
            continue
        pts = [to_xz(p["lon"], p["lat"]) for p in el["geometry"]]
        layer = int(num(tags.get("layer")) or 0)
        level = None
        if tags.get("level"):
            lv = [num(v) for v in str(tags["level"]).split(";")]
            lv = [v for v in lv if v is not None]
            level = min(lv) if lv else None
        bridge = tags.get("bridge") not in (None, "no")
        tunnel = tags.get("tunnel") not in (None, "no")
        indoor = tags.get("indoor") == "yes" or hw == "corridor"
        if not tunnel and not bridge and hw in FOOT and hw != "steps" and (layer < 0 or (indoor and (level or 0) < 0)):
            tunnel = True       # etiketsiz yer altı geçidi/koridoru
        if bridge and layer <= 0:
            layer = 1
        ways.append(dict(id=el["id"], hw=hw, tags=tags, pts=pts, nodes=el["nodes"], layer=layer, level=level,
                         bridge=bridge, tunnel=tunnel, veh=hw in VEHICLE, indoor=indoor,
                         viaduct=tags.get("bridge") == "viaduct"))
    ways.sort(key=lambda w: w["id"])

    pos = {}
    node_ways = defaultdict(list)
    for wi, w in enumerate(ways):
        for n, p in zip(w["nodes"], w["pts"]):
            pos[n] = p
            node_ways[n].append(wi)
    veh_node = {n for n, ws in node_ways.items() if any(ways[i]["veh"] for i in ws)}
    T = {n: terrain.at(*p) for n, p in pos.items()}

    def seglen(a, b):
        return math.dist(pos[a], pos[b])

    def components(sel):
        parent = {}

        def find(a):
            while parent.setdefault(a, a) != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        owner = {}
        for wi in sel:
            find(("w", wi))
            for n in ways[wi]["nodes"]:
                if n in owner:
                    parent[find(("w", wi))] = find(("w", owner[n]))
                else:
                    owner[n] = wi
        comps = defaultdict(list)
        for wi in sel:
            comps[find(("w", wi))].append(wi)
        return [sorted(v) for v in sorted(comps.values(), key=lambda v: min(v))]

    def ordered_path(comp):
        """Bileşen basit bir yol ise düğümleri sırayla döndür."""
        adj = defaultdict(set)
        for wi in comp:
            ns = ways[wi]["nodes"]
            for a, b in zip(ns, ns[1:]):
                if a != b:
                    adj[a].add(b)
                    adj[b].add(a)
        ends = sorted(n for n, v in adj.items() if len(v) == 1)
        if len(ends) != 2 or any(len(v) > 2 for v in adj.values()):
            return None
        path, prev, cur = [ends[0]], None, ends[0]
        while True:
            nxt = [n for n in adj[cur] if n != prev]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            path.append(cur)
        return path if len(path) == len(adj) else None

    h = defaultdict(float)          # düğüm -> arazi üstü ofset (m)
    deck_nodes = set()

    # --- A. taşıt köprüleri / viyadükler
    bridge_info = []
    for comp in components([i for i, w in enumerate(ways) if w["bridge"] and w["veh"]]):
        lay = max(ways[i]["layer"] for i in comp)
        clr = (7.0 if any(ways[i]["viaduct"] for i in comp) else 6.0) * max(lay, 1)
        L = sum(seglen(a, b) for i in comp for a, b in zip(ways[i]["nodes"], ways[i]["nodes"][1:]))
        path = ordered_path(comp)
        nodes = {n for i in comp for n in ways[i]["nodes"]}
        if path and L >= 200.0:
            # uzun viyadük: tabliye iki uç arasında DÜZ bir kiriş. Uçlar zeminden başlar; ortada
            # (uçlardan R içeride) en az `clr` açıklık kalana dek kiriş paralel yükseltilir.
            s = [0.0]
            for a, b in zip(path, path[1:]):
                s.append(s[-1] + seglen(a, b))
            R = min(90.0, L / 3.0)
            y0, y1 = T[path[0]], T[path[-1]]
            lift = 0.0
            for k in range(len(path) - 1):
                (ax, az), (bx, bz) = pos[path[k]], pos[path[k + 1]]
                m = max(1, int((s[k + 1] - s[k]) // 10.0))
                for q in range(m + 1):
                    t = q / m
                    sv = s[k] + (s[k + 1] - s[k]) * t
                    need = terrain.at(ax + (bx - ax) * t, az + (bz - az) * t) + clr * smoothstep(min(sv, L - sv) / R)
                    lift = max(lift, need - (y0 + (y1 - y0) * sv / L))
            for n, sv in zip(path, s):
                h[n] = max(h[n], y0 + (y1 - y0) * sv / L + lift - T[n], 0.0)
        else:
            for n in nodes:
                h[n] = max(h[n], clr)
        deck_nodes |= nodes
        bridge_info.append(dict(ways=[ways[i]["id"] for i in comp], cls=ways[comp[0]]["hw"], length=round(L),
                                clearance=clr, viaduct=any(ways[i]["viaduct"] for i in comp)))

    # --- B. rampalar: ofseti komşu yollara eğimle yay
    def slope_of(w):
        if w["hw"] == "steps":
            return 0.5
        if w["hw"] in FOOT:
            return 0.10
        if w["hw"] in ("trunk", "busway", "trunk_link"):
            return 0.035
        return 0.06

    def propagate(allow_vehicle_nodes=True):
        pq = [(-v, n) for n, v in h.items() if v > 0.05]
        heapq.heapify(pq)
        while pq:
            nv, n = heapq.heappop(pq)
            v = -nv
            if v < h[n] - 1e-9:
                continue
            for wi in node_ways[n]:
                w = ways[wi]
                if w["tunnel"]:
                    continue
                sl = slope_of(w)
                ns = w["nodes"]
                for k, m in enumerate(ns):
                    if m != n:
                        continue
                    for kk in (k - 1, k + 1):
                        if 0 <= kk < len(ns):
                            o = ns[kk]
                            if not allow_vehicle_nodes and o in veh_node:
                                continue
                            nvv = v - sl * seglen(n, o)
                            if nvv > h[o] + 1e-6 and nvv > 0.05:
                                h[o] = nvv
                                heapq.heappush(pq, (-nvv, o))
    propagate(True)

    # --- C. yaya üst geçitleri: altından geçtiği yolun kotu + 5.5 m
    def way_h_at(w, k, t):
        a, b = w["nodes"][k], w["nodes"][k + 1]
        return h[a] + (h[b] - h[a]) * t

    lines = [LineString(w["pts"]) for w in ways]
    ltree = STRtree(lines)
    for comp in components([i for i, w in enumerate(ways) if w["bridge"] and not w["veh"]]):
        nodes = {n for i in comp for n in ways[i]["nodes"]}
        base = 0.0
        for i in comp:
            for j in ltree.query(lines[i]):
                o = ways[j]
                if j in comp or o["tunnel"] or (set(o["nodes"]) & nodes) or not lines[i].intersects(lines[j]):
                    continue
                inter = lines[i].intersection(lines[j])
                for g in getattr(inter, "geoms", [inter]):
                    if g.geom_type != "Point":
                        continue
                    best = None
                    for k in range(len(o["pts"]) - 1):
                        seg = LineString([o["pts"][k], o["pts"][k + 1]])
                        dd = seg.distance(g)
                        if best is None or dd < best[0]:
                            best = (dd, k, seg.project(g) / max(seg.length, 1e-6))
                    base = max(base, way_h_at(o, best[1], best[2]))
        for n in nodes:
            if n not in veh_node:
                h[n] = max(h[n], base + 5.5 * max(ways[comp[0]]["layer"], 1))
        deck_nodes |= nodes
        bridge_info.append(dict(ways=[ways[i]["id"] for i in comp], cls=ways[comp[0]]["hw"],
                                clearance=round(base + 5.5, 1), viaduct=False))
    propagate(False)

    # --- D. tüneller / alt geçitler: yalnız tünelin içinde alçalır (ağızlar zeminde)
    for comp in components([i for i, w in enumerate(ways) if w["tunnel"]]):
        cset = set(comp)
        depth = {}
        for i in comp:
            w = ways[i]
            lv = max(abs(w["layer"]), abs(w["level"] or 0), 1)
            dpt = (5.5 if w["veh"] else 4.0) * lv
            for n in w["nodes"]:
                depth[n] = max(depth.get(n, 0.0), dpt)
        portals = [n for n in depth if any(wi not in cset for wi in node_ways[n])]
        dist = {n: 0.0 for n in portals}
        pq = [(0.0, n) for n in sorted(portals)]
        heapq.heapify(pq)
        while pq:
            dv, n = heapq.heappop(pq)
            if dv > dist.get(n, 1e18):
                continue
            for wi in node_ways[n]:
                if wi not in cset:
                    continue
                ns = ways[wi]["nodes"]
                for k, m in enumerate(ns):
                    if m != n:
                        continue
                    for kk in (k - 1, k + 1):
                        if 0 <= kk < len(ns):
                            nd = dv + seglen(n, ns[kk])
                            if nd < dist.get(ns[kk], 1e18):
                                dist[ns[kk]] = nd
                                heapq.heappush(pq, (nd, ns[kk]))
        R = 45.0 if any(ways[i]["veh"] for i in comp) else 10.0
        for n, dpt in depth.items():
            if n in dist:
                if dist[n] > 0:
                    h[n] = -dpt * smoothstep(dist[n] / R)
            else:
                h[n] = -dpt

    # --- genişlik / şerit
    def lanes_width(w):
        t, hw = w["tags"], w["hw"]
        oneway = t.get("oneway") in ("yes", "-1", "1", "true") or t.get("junction") == "roundabout"
        ln = num(t.get("lanes"))
        ln = int(ln) if ln else None
        if ln is None:
            ln = {"trunk": 3, "trunk_link": 1, "primary": 2 if oneway else 4, "primary_link": 1,
                  "secondary": 2, "secondary_link": 1, "tertiary": 1 if oneway else 2, "tertiary_link": 1,
                  "residential": 1 if oneway else 2, "unclassified": 1 if oneway else 2,
                  "living_street": 1, "service": 1, "busway": 1 if oneway else 2}.get(hw, 0)
        wd = num(t.get("width"))
        if wd is None:
            if hw == "trunk":
                wd = 3.6 * ln + 1.5
            elif hw in ("trunk_link", "primary_link", "secondary_link", "tertiary_link"):
                wd = 3.5 * ln + 1.5
            elif hw in ("primary", "secondary"):
                wd = 3.3 * ln + 1.0
            elif hw == "tertiary":
                wd = 3.2 * ln + 1.0
            elif hw in ("residential", "unclassified"):
                wd = 5.0 if ln <= 1 else 3.0 * ln + 0.5
            elif hw == "living_street":
                wd = 4.5
            elif hw == "service":
                wd = 3.5 * max(ln, 1)
            elif hw == "busway":
                wd = 4.0 if ln <= 1 else 3.75 * ln
            elif hw == "pedestrian":
                wd = 6.0
            elif hw == "platform":
                wd = 3.0
            elif hw == "steps":
                wd = 2.5
            else:
                wd = 2.5
        return ln, round(wd, 1), oneway

    # --- çıktı: sıklaştır (<=15 m), y ata, kırp
    roads = []
    node_y = {}
    for w in ways:
        ns, pts = w["nodes"], w["pts"]
        line = []
        for k in range(len(pts)):
            n = ns[k]
            ya = T[n] + h[n]
            node_y[n] = ya
            line.append((pts[k][0], ya, pts[k][1]))
            if k + 1 < len(pts):
                m = ns[k + 1]
                d = math.dist(pts[k], pts[k + 1])
                cnt = int(d // 15.0)
                for q in range(1, cnt + 1):
                    t = q / (cnt + 1)
                    x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t
                    z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t
                    if w["bridge"]:                       # tabliye düğümler arasında düz
                        y = (T[n] + h[n]) * (1 - t) + (T[m] + h[m]) * t
                        y = max(y, terrain.at(x, z))
                    else:
                        y = terrain.at(x, z) + h[n] * (1 - t) + h[m] * t
                    line.append((x, y, z))
        major = w["hw"] in MAJOR
        runs, cur = [], []
        for p in line:
            ok = terrain.in_extent(p[0], p[2]) if major else terrain.in_bbox(p[0], p[2], 40.0)
            if ok:
                cur.append(p)
            else:
                if len(cur) >= 2:
                    runs.append(cur)
                cur = []
        if len(cur) >= 2:
            runs.append(cur)
        ln, wd, oneway = lanes_width(w)
        for i, run in enumerate(runs):
            d = dict(id=f"w{w['id']}" if i == 0 else f"w{w['id']}_{i}", cls=w["hw"],
                     pts=[[r1(x), r1(y), r1(z)] for x, y, z in run], width=wd, lanes=ln, oneway=oneway,
                     bridge=w["bridge"], tunnel=w["tunnel"], layer=w["layer"])
            if w["tags"].get("name"):
                d["name"] = w["tags"]["name"]
            d["busway"] = w["hw"] == "busway"
            if w["viaduct"]:
                d["viaduct"] = True
            if w["indoor"]:
                d["indoor"] = True
            roads.append(d)
    log["bridges"] = bridge_info
    ctx = dict(ways=ways, pos=pos, node_y=node_y, h=h, T=T)
    return roads, ctx


# ============================================================================= POI
def build_pois(osm, terrain, rctx):
    ways_by_id = {w["id"]: w for w in rctx["ways"]}
    P = dict(stations=[], entrances=[], busStops=[], signals=[], trees=[], greens=[], squares=[],
             platforms=[], metrobusLines=[])

    def xz_of(el):
        return to_xz(el["lon"], el["lat"])

    def area_ring(el):
        g = el.get("geometry") or []
        if len(g) < 4 or g[0] != g[-1]:
            return None
        ps = clean_poly(Polygon([to_xz(p["lon"], p["lat"]) for p in g]), 2.0)
        return ps[0] if ps else None

    busway_nodes = [(rctx["pos"][n], rctx["node_y"][n]) for w in rctx["ways"] if w["hw"] == "busway" for n in w["nodes"]]
    bt = cKDTree([p for p, _ in busway_nodes])

    def deck_y(x, z):
        d, i = bt.query((x, z))
        return busway_nodes[i][1] if d < 30 else terrain.at(x, z)

    for el in sorted(osm["elements"], key=lambda e: (e["type"], e["id"])):
        t = el.get("tags") or {}
        if el["type"] == "node":
            x, z = xz_of(el)
            if not terrain.in_bbox(x, z, 40.0):
                continue
            base = dict(id=f"n{el['id']}", x=r1(x), z=r1(z))
            if t.get("name"):
                base["name"] = t["name"]
            if t.get("railway") == "station":
                P["stations"].append(dict(base, kind="metro", y=r1(terrain.at(x, z)),
                                          line=t.get("line") or t.get("network")))
            elif t.get("railway") == "subway_entrance":
                if t.get("ref"):
                    base["ref"] = t["ref"]
                P["entrances"].append(base)
            elif t.get("highway") == "bus_stop":
                mb = "metrob" in (t.get("network", "") + " " + t.get("name", "")).lower().replace("ü", "u")
                P["busStops"].append(dict(base, metrobus=mb))
            elif t.get("highway") == "traffic_signals":
                P["signals"].append([r1(x), r1(z)])
            elif t.get("natural") == "tree":
                P["trees"].append([r1(x), r1(z)])
        elif el["type"] == "way":
            kind = None
            if t.get("leisure") in ("park", "garden", "playground", "pitch", "dog_park"):
                kind = t["leisure"]
            elif t.get("landuse") in ("grass", "forest", "meadow", "village_green", "recreation_ground", "cemetery"):
                kind = t["landuse"]
            elif t.get("natural") in ("wood", "scrub", "grassland"):
                kind = t["natural"]
            if kind or t.get("place") == "square" or t.get("amenity") == "bus_station":
                p = area_ring(el)
                if p is None or not terrain.in_bbox(p.centroid.x, p.centroid.y, 40.0):
                    continue
                d = dict(id=f"w{el['id']}", ring=ring_coords(p.exterior))
                if t.get("name"):
                    d["name"] = t["name"]
                if kind:
                    P["greens"].append(dict(d, kind=kind))
                else:
                    d["kind"] = "square" if t.get("place") == "square" else "bus_station"
                    d["center"] = [r1(p.centroid.x), r1(p.centroid.y)]
                    P["squares"].append(d)
            elif t.get("highway") == "platform" or t.get("railway") == "platform" or t.get("public_transport") == "platform":
                g = el.get("geometry") or []
                pts = [to_xz(q["lon"], q["lat"]) for q in g]
                if not pts or not terrain.in_bbox(pts[0][0], pts[0][1], 40.0):
                    continue
                cx = sum(p[0] for p in pts) / len(pts)
                cz = sum(p[1] for p in pts) / len(pts)
                net = (t.get("network", "") + " " + t.get("name", "")).lower()
                mb = "metrob" in net.replace("ü", "u")
                rail = t.get("railway") == "platform"
                d = dict(id=f"w{el['id']}", kind="metrobus" if mb else "metro" if rail else "bus",
                         pts=[[r1(a), r1(b)] for a, b in pts], closed=len(g) > 3 and g[0] == g[-1],
                         center=[r1(cx), r1(cz)], y=r1(deck_y(cx, cz) if mb else terrain.at(cx, cz)))
                if t.get("name"):
                    d["name"] = t["name"]
                if t.get("ref"):
                    d["ref"] = t["ref"]
                P["platforms"].append(d)
                if mb:
                    P["stations"].append(dict(id=d["id"], x=d["center"][0], z=d["center"][1], y=d["y"],
                                              kind="metrobus", name=t.get("name")))
        elif el["type"] == "relation":
            if t.get("place") == "square":
                geom = osm_rel_polys(el)
                for p in clean_poly(geom, 10.0)[:1]:
                    if terrain.in_bbox(p.centroid.x, p.centroid.y, 40.0):
                        P["squares"].append(dict(id=f"r{el['id']}", ring=ring_coords(p.exterior), name=t.get("name"),
                                                 kind="square", center=[r1(p.centroid.x), r1(p.centroid.y)]))
            elif t.get("route") == "bus" and t.get("ref") == "34":
                # ana metrobüs hattı (34): üye yolları sırayla zincirle -> yön başına tek çizgi
                seq = []
                for m in el.get("members", []):
                    w = ways_by_id.get(m.get("ref")) if m.get("type") == "way" else None
                    if w is not None and w["hw"] == "busway":
                        seq.append(list(w["nodes"]))
                chain = []
                for i, ns in enumerate(seq):
                    if not chain:
                        if i + 1 < len(seq) and ns[0] in (seq[i + 1][0], seq[i + 1][-1]) and ns[-1] not in (seq[i + 1][0], seq[i + 1][-1]):
                            ns = ns[::-1]
                        chain = list(ns)
                        continue
                    if ns[-1] == chain[-1]:
                        ns = ns[::-1]
                    if ns[0] == chain[-1]:
                        chain.extend(ns[1:])
                    else:                       # kopukluk: yakın ucu öne al
                        pc = rctx["pos"][chain[-1]]
                        if math.dist(pc, rctx["pos"][ns[-1]]) < math.dist(pc, rctx["pos"][ns[0]]):
                            ns = ns[::-1]
                        chain.extend(ns)
                pts = []
                for n in chain:
                    x, z = rctx["pos"][n]
                    if terrain.in_extent(x, z):
                        pts.append([r1(x), r1(rctx["node_y"][n]), r1(z)])
                if len(pts) >= 2:
                    gaps = sum(1 for a, b in zip(pts, pts[1:]) if math.dist(a, b) > 150)
                    P["metrobusLines"].append(dict(id=f"r{el['id']}", name=t.get("name"), pts=pts, gaps=gaps))
    return P


# ============================================================================= üstten görünüm (PNG, bağımlılıksız)
def write_png(path, img):
    h, w, _ = img.shape
    raw = b"".join(b"\x00" + img[y].tobytes() for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def overview(path, terrain, buildings, roads, pois, scale=0.5, window=None):
    """scale = piksel/metre. window=(x0,x1,z0,z1) verilirse yalnız o bölge."""
    X0, X1, Z0, Z1 = window or (terrain.x0, terrain.x1, terrain.z0, terrain.z1)
    W, H = int((X1 - X0) * scale), int((Z1 - Z0) * scale)
    xs = X0 + (np.arange(W) + 0.5) / scale
    zs = Z0 + (np.arange(H) + 0.5) / scale
    fx = np.clip((xs - terrain.x0) / terrain.dx, 0, terrain.nx - 1)
    fz = np.clip((zs - terrain.z0) / terrain.dz, 0, terrain.nz - 1)
    tg = ndi.map_coordinates(terrain.grid, np.meshgrid(fz, fx, indexing="ij"), order=1)
    tn = (tg - terrain.grid.min()) / (terrain.grid.max() - terrain.grid.min())
    img = np.stack([40 + 60 * tn, 55 + 70 * tn, 45 + 40 * tn], -1)
    cont = (np.floor(tg / 10) != np.floor(np.roll(tg, 1, 0) / 10)) | (np.floor(tg / 10) != np.floor(np.roll(tg, 1, 1) / 10))
    img[cont] *= 0.8

    def px(x, z):
        return (x - X0) * scale, (z - Z0) * scale

    def fill(ring, col, alpha=1.0):
        pts = np.array([px(x, z) for x, z in ring])
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        inside = np.zeros(gx.shape, bool)
        n = len(pts)
        for i in range(n):
            ax, ay = pts[i]
            bx, by = pts[(i + 1) % n]
            if ay == by:
                continue
            cond = (ay > gy) != (by > gy)
            xi = ax + (gy - ay) * (bx - ax) / (by - ay)
            inside ^= cond & (gx < xi)
        sub = img[y0:y1 + 1, x0:x1 + 1]
        sub[inside] = sub[inside] * (1 - alpha) + np.array(col) * alpha

    def line(pts, col, wd=1):
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            (pax, pay), (pbx, pby) = px(ax, az), px(bx, bz)
            n = int(max(abs(pbx - pax), abs(pby - pay)) * 1.5) + 1
            tx = np.linspace(pax, pbx, n)
            ty = np.linspace(pay, pby, n)
            for ox in range(-(wd // 2), wd - wd // 2):
                for oy in range(-(wd // 2), wd - wd // 2):
                    ix = (tx + ox).astype(int)
                    iy = (ty + oy).astype(int)
                    ok = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
                    img[iy[ok], ix[ok]] = col

    for g in pois["greens"]:
        fill(g["ring"], (70, 140, 70), 0.7)
    for s in pois["squares"]:
        fill(s["ring"], (200, 190, 150), 0.6)
    rcol = {"trunk": (250, 170, 60), "trunk_link": (230, 160, 80), "primary": (240, 220, 120),
            "primary_link": (230, 210, 130), "secondary": (235, 235, 170), "tertiary": (225, 225, 225)}
    order = sorted(roads, key=lambda r: (r["bridge"], r["busway"], r["cls"] in MAJOR))
    for r in order:
        pts = [(p[0], p[2]) for p in r["pts"]]
        wd = max(1, int(round(r["width"] * scale)))
        if r["tunnel"]:
            line(pts, (90, 60, 130), 1)
        elif r["busway"]:
            line(pts, (255, 60, 60), max(2, wd))
        elif r["bridge"]:
            line(pts, (80, 220, 255), max(2, wd))
        elif r["cls"] in FOOT:
            line(pts, (150, 120, 100), 1)
        else:
            line(pts, rcol.get(r["cls"], (170, 170, 170)), wd)
    for b in sorted(buildings, key=lambda b: b["height"]):
        hh = min(b["height"], 160.0) / 160.0
        if b.get("landmark"):
            col = (255, 80, 220)
        elif b["estimated"]:
            g = 95 + 120 * min(b["height"] / 35.0, 1)
            col = (g, g, g)
        else:
            col = (60 + 195 * hh ** 0.5, 150 - 60 * hh, 235 - 200 * hh)
        fill(b["ring"], col)
        for hole in b.get("holes", []):
            fill(hole, (50, 60, 50))
    for t in pois["trees"]:
        line([t, (t[0] + 0.1, t[1])], (40, 255, 80), 3)
    for e in pois["entrances"]:
        line([(e["x"], e["z"]), (e["x"] + 0.1, e["z"])], (255, 255, 0), 4)
    for s in pois["stations"]:
        line([(s["x"] - 8, s["z"]), (s["x"] + 8, s["z"])], (255, 255, 255), 2)
        line([(s["x"], s["z"] - 8), (s["x"], s["z"] + 8)], (255, 255, 255), 2)
    line([(-15, 0), (15, 0)], (255, 0, 0), 2)
    line([(0, -15), (0, 15)], (255, 0, 0), 2)
    a, b, c, d = terrain.bbox_local
    line([(a, c), (b, c), (b, d), (a, d), (a, c)], (255, 255, 255), 1)
    c0 = to_xz(CORE["west"], CORE["north"])
    c1 = to_xz(CORE["east"], CORE["south"])
    line([(c0[0], c0[1]), (c1[0], c0[1]), (c1[0], c1[1]), (c0[0], c1[1]), (c0[0], c0[1])], (255, 255, 120), 1)
    write_png(path, np.clip(img, 0, 255).astype(np.uint8))


# ============================================================================= ana
def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(s + "\n", encoding="utf-8", newline="\n")
    return len(s.encode("utf-8"))


def write_estimated_doc(buildings, counts):
    L = ["# Tahmini / dolaylı yükseklikler", "",
         "`tools/build_data.py` tarafından üretilir; elle düzenleme (yeniden üretimde ezilir).", "",
         "Yükseklik önceliği: OSM `height` → Overture `height` → kat sayısı × 3.2 m → tahmin.",
         "Tahmin = 150 m içindeki etiketli binaların kat medyanı + bina tipi + taban alanı + kimlikten tohumlanan",
         "sapma (2–11 kat). Tahminler `estimated:true`, `heightSource:\"estimate\"` taşır.", "",
         f"Toplam {counts['buildings']} kayıt: " + ", ".join(f"{k} {v}" for k, v in counts["byHeightSource"].items())
         + f" → tahmin oranı %{counts['estimatedPct']}.", ""]

    def row(b):
        return (f"| {b['id']} | {b.get('name', '—')} | {b.get('kind', '—')} | {b['height']} | {b['heightSource']} | "
                f"{round(b['_area'])} | {round(b['_c'][0])}, {round(b['_c'][1])} |")
    head = ["| id | ad | tip | yükseklik (m) | kaynak | taban (m²) | x, z |", "|---|---|---|---|---|---|---|"]
    L += ["## Simge yapılar (verideki değerler)", "",
          "`osm` = OSM `height` etiketi (doğrulanmadı). `levels` = kat × 3.2 m; ölçüm değil, kuleler için büyük",
          "olasılıkla gerçeğin altında. `estimate` = tahmin. Simge ajanı gerçek yükseklikleri ayrıca araştırmalı.", ""] + head
    L += [row(b) for b in buildings if b.get("landmark")]
    named = sorted([b for b in buildings if b["estimated"] and b.get("name")], key=lambda b: -b["_area"])
    L += ["", f"## Adı olan, yüksekliği TAHMİN binalar ({len(named)})", ""] + head + [row(b) for b in named]
    big = sorted([b for b in buildings if b["estimated"] and not b.get("name") and b["_area"] >= 1500],
                 key=lambda b: -b["_area"])
    L += ["", f"## Adsız ama büyük tabanlı (≥1500 m²), yüksekliği TAHMİN binalar ({len(big)})", ""] + head + [row(b) for b in big]
    lv = sorted([b for b in buildings if b["heightSource"] == "levels" and b["height"] >= 45], key=lambda b: -b["height"])
    L += ["", "## Kat sayısından türetilen yüksek yapılar (≥45 m; ölçüm değil)", ""] + head + [row(b) for b in lv]
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "estimated_heights.md").write_text("\n".join(L) + "\n", encoding="utf-8", newline="\n")
    return len(named), len(big)


def main(argv):
    osm = json.loads((RAW / "overpass.json").read_text(encoding="utf-8"))
    log = {}
    terrain = Terrain()
    buildings = build_buildings(osm, terrain, log)
    roads, rctx = build_roads(osm, terrain, log)
    pois = build_pois(osm, terrain, rctx)

    by_src = Counter(b["heightSource"] for b in buildings)
    n_est = by_src.get("estimate", 0)
    counts = dict(
        buildings=len(buildings),
        byHeightSource={k: by_src.get(k, 0) for k in ("osm", "overture", "levels", "estimate")},
        estimated=n_est, estimatedPct=round(100.0 * n_est / max(len(buildings), 1), 1),
        buildingParts=sum(1 for b in buildings if b.get("part")),
        byFootprint=dict(Counter(b.get("footprint", "osm") for b in buildings)),
        landmarks=dict(Counter(b["landmark"] for b in buildings if b.get("landmark"))),
        outlinesReplacedByParts=log["outlinesReplacedByParts"],
        overtureFootprintsAdded=log["overtureFootprintsAdded"],
        roads=len(roads), roadsByClass=dict(sorted(Counter(r["cls"] for r in roads).items())),
        bridges=sum(r["bridge"] for r in roads), tunnels=sum(r["tunnel"] for r in roads),
        busway=sum(r["busway"] for r in roads),
        pois={k: len(v) for k, v in pois.items()},
    )
    core0 = to_xz(CORE["west"], CORE["north"])
    core1 = to_xz(CORE["east"], CORE["south"])
    core_b = [b for b in buildings if core0[0] <= b["_c"][0] <= core1[0] and core0[1] <= b["_c"][1] <= core1[1]]
    counts["core"] = dict(buildings=len(core_b), estimated=sum(b["estimated"] for b in core_b))
    a, b_, c, d = terrain.bbox_local
    meta = dict(
        lat0=LAT0, lon0=LON0,
        origin="Mecidiyeköy metrobüs durağı peronu (OSM way 1305577747) ağırlık merkezi, D-100 ekseni",
        bbox=dict(BBOX, xmin=r1(a), xmax=r1(b_), zmin=r1(c), zmax=r1(d)),
        core=dict(CORE, xmin=r1(core0[0]), xmax=r1(core1[0]), zmin=r1(core0[1]), zmax=r1(core1[1])),
        elevation0=round(terrain.elev0, 2),
        terrain=dict(yMin=float(terrain.grid.min()), yMax=float(terrain.grid.max()),
                     x0=terrain.x0, x1=terrain.x1, z0=terrain.z0, z1=terrain.z1,
                     rawMin=round(terrain.raw_min, 1), rawMax=round(terrain.raw_max, 1),
                     tifCoversGrid=bool(terrain.tif_covers)),
        levelHeight=LEVEL_H,
        sources=dict(
            osm="data/raw/overpass.json (OpenStreetMap, ODbL) — binalar, building:part, yollar, POI",
            overture="data/raw/overture_buildings.geojson + overture_building_parts.geojson (Overture 2026-10-21.0; OSM + Microsoft ML Buildings)",
            terrain="data/raw/cop30.tif (Copernicus GLO-30 DSM; %15 yüzdelik + Gauss ile yumuşatıldı)"),
        counts=counts,
        bridges=log["bridges"],
        heightTagWarnings=log["heightTagWarnings"],
        generatedAt=(osm.get("osm3s") or {}).get("timestamp_osm_base", "unknown"),
    )

    n_named, n_big = write_estimated_doc(buildings, counts)
    if "--overview" in argv:
        overview(ROOT / "out" / "shots" / "data_overview.png", terrain, buildings, roads, pois)
        overview(ROOT / "out" / "shots" / "data_overview_core.png", terrain, buildings, roads, pois, scale=1.5,
                 window=(-450, 1000, -450, 450))

    pub = []
    for b in buildings:
        pub.append({k: v for k, v in b.items() if not k.startswith("_")})
    sizes = dict(
        buildings=dump(OUT / "buildings.json", pub),
        roads=dump(OUT / "roads.json", roads),
        terrain=dump(OUT / "terrain.json", dict(nx=terrain.nx, nz=terrain.nz, x0=terrain.x0, z0=terrain.z0,
                                                dx=terrain.dx, dz=terrain.dz,
                                                heights=[float(v) for v in terrain.grid.ravel()])),
        pois=dump(OUT / "pois.json", pois),
        meta=dump(OUT / "meta.json", meta),
    )

    # ---- özet
    print("origin", LAT0, LON0, "elev0", round(terrain.elev0, 2), "terrain y", terrain.grid.min(), terrain.grid.max(),
          "tif covers grid:", terrain.tif_covers)
    print("sizes(bytes)", sizes)
    print("counts", json.dumps(counts, ensure_ascii=False))
    print("height warnings", len(log["heightTagWarnings"]))
    print("named estimated", n_named, "big estimated", n_big)
    print("top 15:")
    for b in sorted(buildings, key=lambda b: -b["height"])[:15]:
        print("  ", b["id"], b["height"], b["heightSource"], b.get("levels"), b.get("name"), b.get("landmark"),
              "min", b["minHeight"], "at", round(b["_c"][0]), round(b["_c"][1]))
    print("landmarks:")
    for b in buildings:
        if b.get("landmark"):
            print("  ", b["landmark"], b["id"], b["height"], b["heightSource"], "min", b["minHeight"], "baseY", b["baseY"],
                  b.get("name"), "area", round(b["_area"]), "at", round(b["_c"][0]), round(b["_c"][1]))
    print("bridges:")
    for br in log["bridges"]:
        print("  ", br)
    for ln in pois["metrobusLines"]:
        print("metrobus line", ln["id"], ln["name"], len(ln["pts"]), "pts gaps", ln["gaps"], ln["pts"][0], ln["pts"][-1])


if __name__ == "__main__":
    main(sys.argv[1:])
