// Simge yapıların geometrisi. Ayak izi: buildings.json (landmark kayıtları, kimlikle).
// Yükseklik/biçim: docs/sources.md. Çıktı: tek birleşik BufferGeometry + ikaz ışığı noktaları
// + tabela tanımları.

// Kullanılan yükseklikler (m). "ref" = yüksekliğin ölçüldüğü zemin (kaydın groundY'si).
export const HEIGHTS = {
  trumpResidence: 155, // ARAŞTIRMA (Wikipedia 155; CTBUH 156; geliştirici 154) — veri 124.8 (kat×3.2) idi
  trumpOffice: 145, // ARAŞTIRMA (Wikipedia 145; CTBUH 145.1) — veri 118.4 idi
  trumpPodium: 9.6, // VERİ (3 kat; OSM)
  torunResidence: 160, // VERİ = ARAŞTIRMA (OSM height=160; CTBUH 160)
  torunOffice: 144, // ARAŞTIRMA (CTBUH 144 m) — veri 160 idi
  torunBar: 40, // VARSAYIM: 4. OSM ayak izi (w728793801) kule değil yatay blok sayıldı; yükseklik doğrulanmadı
  torunLow: 5, // VERİ
  torunSmall: 25.7, // VERİ (tahmin)
  cevahir: 27, // VARSAYIM: 6 kat (veri+araştırma) × 4.5 m perakende katı; veri 19.2 (kat×3.2) idi
};

const ID = {
  trumpPodium: 'w163629174',
  trumpRes: 'w1222286465',
  trumpOff: 'w1455454989',
  torunA: 'w728793798',
  torunB: 'w728793799',
  torunC: 'w728793800',
  torunBar: 'w728793801',
  torunLow: 'w728793802',
  torunSmall: 'w1321569694',
  cevahir: 'w46962419',
};

// stil: [tip, katH, panelW, yananOran], [spandrel, dikme, taçH, derzN], [spandrelAçıklık, sıcaklık, taçIşık, taçSıcak]
const S = {
  matte: (col) => ({ col, a: [0, 0, 0, 0], b: [0, 0, 0, 0], c: [0, 0, 0, 0] }),
  emis: (col, theta, inten) => ({ col, a: [5, theta, 0, inten], b: [0, 0, 0, 0], c: [0, 0, 0, 0] }),
  glassRoof: (col, pw, glow) => ({ col, a: [4, 0, pw, glow], b: [0, 0, 0, 0], c: [0, 0, 0, 0] }),
};

class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.fac = [];
    this.tan = [];
    this.a = [];
    this.b = [];
    this.c = [];
    this.d = [];
  }
  // v: {p:[x,y,z], f:[u,v,topD]}
  tri(v0, v1, v2, n, t, st, seed) {
    const ax = v1.p[0] - v0.p[0], ay = v1.p[1] - v0.p[1], az = v1.p[2] - v0.p[2];
    const bx = v2.p[0] - v0.p[0], by = v2.p[1] - v0.p[1], bz = v2.p[2] - v0.p[2];
    let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const len = Math.hypot(cx, cy, cz);
    if (len < 1e-9) return;
    if (!n) n = [cx / len, cy / len, cz / len];
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const order = flip ? [v0, v2, v1] : [v0, v1, v2];
    for (const v of order) {
      this.pos.push(v.p[0], v.p[1], v.p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(st.col[0], st.col[1], st.col[2]);
      this.fac.push(v.f[0], v.f[1], v.f[2], seed);
      this.tan.push(t[0], t[1], t[2]);
      this.a.push(...st.a);
      this.b.push(...st.b);
      this.c.push(...st.c);
      this.d.push(...(st.d || [0, 0, 0, 0]));
    }
  }
  quad(v0, v1, v2, v3, n, t, st, seed) {
    this.tri(v0, v1, v2, n, t, st, seed);
    this.tri(v0, v2, v3, n, t, st, seed);
  }
  /** Halka duvarı. y0/y1/vBase: sayı ya da (x,z)→sayı. Cephe v = y − vBase. */
  wall(ring, y0, y1, vBase, st, seed) {
    const f = (q) => (typeof q === 'function' ? q : () => q);
    const Y0 = f(y0), Y1 = f(y1), VB = f(vBase);
    const sgn = area(ring) > 0 ? 1 : -1;
    let u = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const t = [dx / len, 0, dz / len];
      const n = [(sgn * dz) / len, 0, (-sgn * dx) / len];
      const mk = (pt, uu) => {
        const yb = Y0(pt[0], pt[1]), yt = Y1(pt[0], pt[1]), vb = VB(pt[0], pt[1]);
        return [
          { p: [pt[0], yb, pt[1]], f: [uu, yb - vb, yt - yb] },
          { p: [pt[0], yt, pt[1]], f: [uu, yt - vb, 0] },
        ];
      };
      const [pb, ptp] = mk(p, u);
      const [qb, qtp] = mk(q, u + len);
      this.quad(pb, qb, qtp, ptp, n, t, st, seed);
      u += len;
    }
  }
  /** Halka kapağı (çatı); y sayı ya da doğrusal (x,z)→y. Cephe (u,v) = (x,z). */
  cap(THREE, ring, y, st, seed) {
    const Y = typeof y === 'function' ? y : () => y;
    const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [i, j, k] of faces) {
      const v = [i, j, k].map((m) => {
        const [x, z] = ring[m];
        return { p: [x, Y(x, z), z], f: [x, z, 0] };
      });
      // normal: üçgenden, yukarı bakacak biçimde
      const a = v[0].p, b = v[1].p, c = v[2].p;
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) continue;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      this.tri(v[0], v[1], v[2], [nx / l, ny / l, nz / l], [1, 0, 0], st, seed);
    }
  }
  /** Y ekseninde dönmüş kutu; alt yüz yok. dir = [dx,dz] uzun eksen birim vektörü. */
  box(cx, y0, cz, len, h, wid, dir, st, seed, topSt) {
    const ax = [dir[0] * len * 0.5, dir[1] * len * 0.5];
    const bx = [-dir[1] * wid * 0.5, dir[0] * wid * 0.5];
    const ring = [
      [cx - ax[0] - bx[0], cz - ax[1] - bx[1]],
      [cx + ax[0] - bx[0], cz + ax[1] - bx[1]],
      [cx + ax[0] + bx[0], cz + ax[1] + bx[1]],
      [cx - ax[0] + bx[0], cz - ax[1] + bx[1]],
    ];
    this.wall(ring, y0, y0 + h, y0, st, seed);
    this.capQuad(ring, y0 + h, topSt || st, seed);
  }
  capQuad(ring, y, st, seed) {
    const v = ring.map(([x, z]) => ({ p: [x, y, z], f: [x, z, 0] }));
    this.quad(v[0], v[1], v[2], v[3], [0, 1, 0], [1, 0, 0], st, seed);
  }
  /** Tonoz (cam çatı): merkez, eksen yönü, uzunluk, genişlik, taban kotu, yükselti. */
  vault(cx, y0, cz, dir, len, wid, rise, segs, st, seed) {
    const perp = [-dir[1], dir[0]];
    const prof = [];
    let arc = 0;
    for (let k = 0; k <= segs; k++) {
      const a = (Math.PI * k) / segs;
      const o = -Math.cos(a) * wid * 0.5, h = Math.sin(a) * rise;
      if (k > 0) arc += Math.hypot(o - prof[k - 1].o, h - prof[k - 1].h);
      prof.push({ o, h, arc });
    }
    const P = (s, pr) => [cx + dir[0] * s + perp[0] * pr.o, y0 + pr.h, cz + dir[1] * s + perp[1] * pr.o];
    const t = [dir[0], 0, dir[1]];
    for (let k = 0; k < segs; k++) {
      const p0 = prof[k], p1 = prof[k + 1];
      const v0 = { p: P(-len / 2, p0), f: [0, p0.arc, 0] };
      const v1 = { p: P(len / 2, p0), f: [len, p0.arc, 0] };
      const v2 = { p: P(len / 2, p1), f: [len, p1.arc, 0] };
      const v3 = { p: P(-len / 2, p1), f: [0, p1.arc, 0] };
      // dışa bakan normal: profil normalinden
      const do_ = p1.o - p0.o, dh = p1.h - p0.h;
      const l = Math.hypot(do_, dh);
      const n = [(perp[0] * -dh) / l, do_ / l, (perp[1] * -dh) / l];
      if (n[1] < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
      this.quad(v0, v1, v2, v3, n, t, st, seed);
    }
    // alınlar
    for (const s of [-len / 2, len / 2]) {
      const n = [dir[0] * Math.sign(s), 0, dir[1] * Math.sign(s)];
      const c = { p: [cx + dir[0] * s, y0, cz + dir[1] * s], f: [0, 0, 0] };
      for (let k = 0; k < segs; k++) {
        const a = { p: P(s, prof[k]), f: [prof[k].o, prof[k].h, 0] };
        const b = { p: P(s, prof[k + 1]), f: [prof[k + 1].o, prof[k + 1].h, 0] };
        this.tri(c, a, b, n, [perp[0], 0, perp[1]], st, seed);
      }
    }
  }
  toGeometry(THREE) {
    const g = new THREE.BufferGeometry();
    const A = (arr, n) => new THREE.Float32BufferAttribute(arr, n);
    g.setAttribute('position', A(this.pos, 3));
    g.setAttribute('normal', A(this.nor, 3));
    g.setAttribute('color', A(this.col, 3));
    g.setAttribute('aFac', A(this.fac, 4));
    g.setAttribute('aTan', A(this.tan, 3));
    g.setAttribute('aSty', A(this.a, 4));
    g.setAttribute('aSty2', A(this.b, 4));
    g.setAttribute('aSty3', A(this.c, 4));
    g.setAttribute('aSty4', A(this.d, 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function area(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
function centroid(ring) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const w = p[0] * q[1] - q[0] * p[1];
    a += w; cx += (p[0] + q[0]) * w; cz += (p[1] + q[1]) * w;
  }
  return [cx / (3 * a), cz / (3 * a)];
}
function scaled(ring, k, c = centroid(ring)) {
  return ring.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);
}
function inside(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** dir yönüne en çok bakan (uzunluk ağırlıklı) kenar → {mid, n, t, len} */
function facingEdge(ring, dir, minLen = 0) {
  const sgn = area(ring) > 0 ? 1 : -1;
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const len = Math.hypot(dx, dz);
    if (len < Math.max(0.5, minLen)) continue;
    const n = [(sgn * dz) / len, (-sgn * dx) / len];
    const d = n[0] * dir[0] + n[1] * dir[1];
    const score = d * Math.sqrt(len) * (d > 0.5 ? 1 : 0.2);
    if (!best || score > best.score) best = { score, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n, len };
  }
  return best;
}
function longAxis(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!best || len > best.len) best = { len, dir: [(q[0] - p[0]) / len, (q[1] - p[1]) / len] };
  }
  return best;
}

export function build(ctx) {
  const { THREE, data, heightAt } = ctx;
  const list = Array.isArray(data.buildings) ? data.buildings : [];
  const byId = new Map(list.filter((b) => b.landmark).map((b) => [b.id, b]));
  if (!byId.size) return null;

  const B = new Builder();
  const beacons = { pos: [], col: [], blink: [] };
  const signs = [];
  const info = {};
  const rng = ctx.rng('landmarks');
  const RED = [1.0, 0.1, 0.05];
  const addBeacon = (x, y, z, col = RED, period = 2.0, phase = 0, size = 5) => {
    beacons.pos.push(x, y, z);
    beacons.col.push(...col);
    beacons.blink.push(period, phase, size);
  };
  const ground = (b) => b.groundY ?? b.baseY ?? heightAt(b.ring[0][0], b.ring[0][1]);
  const sign = (edge, y, h, text, opt = {}) => {
    if (!edge) return;
    signs.push({ text, h, y, x: edge.mid[0] + edge.n[0] * 0.6, z: edge.mid[1] + edge.n[1] * 0.6, n: edge.n, maxW: edge.len * 0.86, ...opt });
  };

  const roofDark = S.matte([0.1, 0.105, 0.11]);
  const roofGrey = S.matte([0.3, 0.3, 0.3]);
  const mech = S.matte([0.42, 0.43, 0.44]);

  // ================= TRUMP TOWERS =================
  {
    const pod = byId.get(ID.trumpPodium);
    const res = byId.get(ID.trumpRes);
    const off = byId.get(ID.trumpOff);
    const ref = pod ? ground(pod) : res ? ground(res) : 0;
    let podTop = ref + HEIGHTS.trumpPodium;
    if (pod) {
      // Arsa kuzeye sert iner: podyum üstü, güney (D-100) cephesinde 3 kat görünecek kotta.
      const gMax = Math.max(...pod.ring.map(([x, z]) => heightAt(x, z)));
      podTop = gMax + HEIGHTS.trumpPodium;
      const st = {
        col: [0.5, 0.5, 0.49],
        a: [3, 4.6, 7.5, 0.5],
        b: [0.85, 0, 0.8, 0],
        c: [0, 0, 0, 0],
      };
      B.wall(pod.ring, pod.baseY - 3, podTop + 1.1, (x, z) => heightAt(x, z), st, 3.1);
      B.cap(THREE, pod.ring, podTop, roofGrey, 3.1);
      // podyum çatısı: iki kule arasında ışıklık
      if (res && off) {
        const c1 = centroid(res.ring), c2 = centroid(off.ring);
        const d = [c2[0] - c1[0], c2[1] - c1[1]];
        const L = Math.hypot(d[0], d[1]);
        const dir = [d[0] / L, d[1] / L];
        B.vault((c1[0] + c2[0]) / 2, podTop, (c1[1] + c2[1]) / 2, dir, Math.max(10, L - 62), 13, 4.2, 5, S.glassRoof([0.3, 0.42, 0.5], 1.8, 0.2), 3.7);
      }
      const e = facingEdge(pod.ring, [0.15, 1], 12); // güney: D-100'e bakan yüz
      sign(e, podTop - 1.6, 2.6, 'TRUMP TOWERS', { col: [1.0, 0.84, 0.5], font: 'serif', track: 0.12 });
      const e2 = facingEdge(pod.ring, [1, 0], 30); // doğu
      sign(e2, podTop - 1.6, 2.4, 'TRUMP ALIŞVERİŞ MERKEZİ', { col: [1.0, 0.84, 0.5], font: 'serif', track: 0.1 });
    }
    const tower = (b, H, drop, type, lit, seed, warm) => {
      if (!b) return;
      const peak = ref + H;
      const ax = longAxis(b.ring);
      // Tepe, uzun eksen boyunca eğik kesik: güney uç zirve (bellekten; fotoğrafla doğrulanmadı).
      let dir = ax.dir;
      if (dir[1] < 0) dir = [-dir[0], -dir[1]];
      const proj = b.ring.map(([x, z]) => x * dir[0] + z * dir[1]);
      const s0 = Math.min(...proj), s1 = Math.max(...proj);
      const top = (x, z) => peak - drop * (1 - (x * dir[0] + z * dir[1] - s0) / (s1 - s0));
      const st = {
        col: [0.3, 0.42, 0.58],
        a: [type, 3.85, 1.5, lit], // podyum üstü 36/34 kat
        b: [0.2, 0.7, 1.4, 18],
        c: [0.2, warm, 1.7, 0.05],
        d: [0, 0.11, 3.0, 0.2],
      };
      B.wall(b.ring, podTop, top, podTop, st, seed);
      // çatı: parapetin 1.2 m altında koyu eğik düzlem
      B.cap(THREE, b.ring, (x, z) => top(x, z) - 1.2, roofDark, seed);
      // zirve ucunda ve alçak uçta ikaz ışıkları
      const hi = b.ring.reduce((m, p) => (top(p[0], p[1]) > top(m[0], m[1]) ? p : m));
      const c = centroid(b.ring);
      for (const p of b.ring) {
        const y = top(p[0], p[1]);
        const near = Math.abs(y - top(hi[0], hi[1])) < 0.5;
        addBeacon(p[0] + (c[0] - p[0]) * 0.05, y + 1.2, p[1] + (c[1] - p[1]) * 0.05, RED, near ? 1.6 : 99, seed * 0.13, near ? 7 : 4);
      }
      info[b.id] = { top: +peak.toFixed(1), low: +(peak - drop).toFixed(1), base: +podTop.toFixed(1) };
      return { top, dir };
    };
    const r = tower(res, HEIGHTS.trumpResidence, 21, 2, 0.46, 11.3, 0.85);
    tower(off, HEIGHTS.trumpOffice, 16, 1, 0.5, 12.7, 0.25);
    if (res && r) {
      const e = facingEdge(res.ring, [0, 1]);
      const yTop = r.top(e.mid[0], e.mid[1]);
      sign(e, yTop - 6.5, 3.0, 'TRUMP', { col: [1.0, 0.86, 0.55], font: 'serif', track: 0.22, glow: 1.3 });
    }
  }

  // ================= TORUN CENTER =================
  {
    // Yarım düzlem kırpma (Sutherland–Hodgman): n·(p−o) ≥ 0 tarafı kalır.
    const clip = (ring, o, n) => {
      const out = [];
      const d = (p) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1];
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        const dp = d(p), dq = d(q);
        if (dp >= 0) out.push(p);
        if (dp >= 0 !== dq >= 0) {
          const t = dp / (dp - dq);
          out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      return out;
    };
    // Her kule, birbirine göre kaymış iki cam dilim olarak kurulur (ayak izi L biçimli: veriden);
    // dilimlerden biri 3 kat alçak → basamaklı tepe. Dilim yükseklik farkı VARSAYIM (bkz. sources.md).
    const torunTower = (b, H, type, lit, seed, warm, lowSide) => {
      if (!b) return;
      const g = ground(b);
      const xs = b.ring.map((p) => p[0]), zs = b.ring.map((p) => p[1]);
      const dir = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs) ? [1, 0] : [0, 1];
      const c = centroid(b.ring);
      const halves = [clip(b.ring, c, dir), clip(b.ring, c, [-dir[0], -dir[1]])];
      const floors = type === 2 ? 42 : 38;
      halves.forEach((ring, k) => {
        if (ring.length < 3) return;
        const top = g + H - (k === lowSide ? 11.4 : 0);
        const st = {
          col: [0.34, 0.45, 0.5], // açık mavi-yeşil yansıtıcı cam
          a: [type, H / floors, 1.35, lit],
          b: [0.13, 1.5, 0.9, 14], // ince koyu spandrel, belirgin dikey dikme, tepe LED hattı, 14 katta bir mekanik
          c: [0.1, warm, 1.5, 0.7],
          d: [2, 0.1, 3.0, 0.8], // çift katlı lobi, panel sapması, parlama tavanı, açık renk dikme
        };
        B.wall(ring, b.baseY - 2, top, g, st, seed + k * 0.37);
        B.cap(THREE, ring, top - 1.8, roofDark, seed);
        const rc = centroid(ring);
        if (inside(ring, rc[0], rc[1])) {
          B.box(rc[0], top - 1.8, rc[1], 9, 4.6, 7, dir, mech, seed);
          if (k !== lowSide) addBeacon(rc[0], top + 3.4, rc[1], RED, 2.2, seed * 0.21, 8);
        }
        for (const p of ring) addBeacon(p[0] + (rc[0] - p[0]) * 0.04, top + 0.6, p[1] + (rc[1] - p[1]) * 0.04, RED, 99, 0, 3.2);
      });
      info[b.id] = { top: +(g + H).toFixed(1), base: +g.toFixed(1) };
    };
    // Araştırma: 3 kule (2 konut 160 m + 1 ofis 144 m). OSM'deki dört ayak izinden sıra hâlindeki
    // üçü kule sayıldı; hangisinin ofis olduğu DOĞRULANMADI (batıdaki varsayıldı).
    torunTower(byId.get(ID.torunA), HEIGHTS.torunOffice, 1, 0.6, 21.3, 0.15, 0);
    torunTower(byId.get(ID.torunB), HEIGHTS.torunResidence, 2, 0.5, 22.9, 0.9, 1);
    torunTower(byId.get(ID.torunC), HEIGHTS.torunResidence, 2, 0.52, 23.4, 0.9, 0);

    const bar = byId.get(ID.torunBar);
    if (bar) {
      const g = ground(bar);
      const st = { col: [0.34, 0.45, 0.5], a: [1, 4.0, 1.35, 0.5], b: [0.14, 1.5, 0.9, 0], c: [0.1, 0.3, 1.2, 0.7], d: [2, 0.1, 3.0, 0.8] };
      B.wall(bar.ring, bar.baseY - 2, g + HEIGHTS.torunBar, g, st, 24.6);
      B.cap(THREE, bar.ring, g + HEIGHTS.torunBar - 1.2, roofDark, 24.6);
      const e = facingEdge(bar.ring, [-0.2, -1], 20);
      sign(e, g + HEIGHTS.torunBar - 4.5, 2.6, 'TORUN CENTER', { col: [1, 1, 1], track: 0.1 });
      info[bar.id] = { top: +(g + HEIGHTS.torunBar).toFixed(1) };
    }
    const low = byId.get(ID.torunLow);
    if (low) {
      const g = ground(low);
      const st = { col: [0.42, 0.42, 0.41], a: [3, 4.0, 6, 0.5], b: [0.6, 0, 0.6, 0], c: [0, 0, 0, 0] };
      B.wall(low.ring, low.baseY - 2, g + HEIGHTS.torunLow + 0.8, (x, z) => heightAt(x, z), st, 25.2);
      B.cap(THREE, low.ring, g + HEIGHTS.torunLow, roofGrey, 25.2);
    }
    const sm = byId.get(ID.torunSmall);
    if (sm) {
      const g = ground(sm);
      const st = { col: [0.34, 0.45, 0.5], a: [1, 3.7, 1.35, 0.5], b: [0.14, 1.5, 0, 0], c: [0.1, 0.3, 0, 0], d: [1, 0.1, 3.0, 0.8] };
      B.wall(sm.ring, sm.baseY - 2, g + HEIGHTS.torunSmall, g, st, 26.8);
      B.cap(THREE, sm.ring, g + HEIGHTS.torunSmall - 1, roofDark, 26.8);
    }
  }

  // ================= CEVAHİR AVM =================
  {
    const b = byId.get(ID.cevahir);
    if (b) {
      const g = ground(b);
      const top = g + HEIGHTS.cevahir;
      const st = {
        col: [0.74, 0.63, 0.49], // sıcak bej taş kaplama
        a: [3, 4.5, 8, 0.38],
        b: [0.35, 0, 1.0, 0],
        c: [0, 0, 0, 0],
      };
      const stUp = { ...st, col: [0.66, 0.58, 0.47], a: [3, 4.5, 8, 0.3], b: [0.9, 0, 0.5, 0] };
      B.wall(b.ring, b.baseY - 3, top + 1.2, (x, z) => heightAt(x, z), st, 31.4);
      B.cap(THREE, b.ring, top, S.matte([0.36, 0.35, 0.33]), 31.4);
      // geri çekilmiş üst kat
      const c = centroid(b.ring);
      const tier = scaled(b.ring, 0.8, c);
      const tierTop = top + 5;
      B.wall(tier, top, tierTop + 0.9, top - 60, stUp, 32.6);
      B.cap(THREE, tier, tierTop, S.matte([0.3, 0.3, 0.29]), 32.6);
      // cam çatı (≈2 500 m²: 26 × 96 m tonoz) — yapının uzun ekseni boyunca
      const dir = [0.36, 0.933];
      const perp = [-dir[1], dir[0]];
      const vl = 96, vw = 26;
      const glass = S.glassRoof([0.3, 0.42, 0.5], 2.0, 0.2);
      B.vault(c[0], tierTop, c[1], dir, vl, vw, 9, 7, glass, 33.3);
      // çatı mekaniği (tohumlu)
      const r = rng.fork('cevahir-roof');
      const inner = scaled(b.ring, 0.72, c);
      let placed = 0;
      for (let i = 0; i < 400 && placed < 16; i++) {
        const x = c[0] + r.range(-110, 110), z = c[1] + r.range(-130, 130);
        if (!inside(inner, x, z)) continue;
        const s = (x - c[0]) * dir[0] + (z - c[1]) * dir[1];
        const o = (x - c[0]) * perp[0] + (z - c[1]) * perp[1];
        if (Math.abs(o) < vw / 2 + 8 && Math.abs(s) < vl / 2 + 8) continue;
        B.box(x, tierTop, z, r.range(6, 14), r.range(2.2, 4), r.range(4, 8), r() < 0.5 ? dir : perp, mech, 34 + placed);
        placed++;
      }
      // tabelalar: Büyükdere Cd. (kuzeydoğu) ve kuzey/batı yüzleri
      const red = { col: [1.0, 0.2, 0.14], track: 0.04, glow: 1.2 };
      sign(facingEdge(b.ring, [1, -0.75], 25), top - 4.2, 5.2, 'Cevahir', red);
      sign(facingEdge(b.ring, [-0.8, -0.6], 20), top - 4.2, 4.6, 'Cevahir', red);
      sign(facingEdge(b.ring, [1, 0.8], 25), top - 4.2, 4.6, 'Cevahir', red);
      sign(facingEdge(b.ring, [-1, 0.75], 25), top - 4.2, 4.6, 'Cevahir', red);
      info[b.id] = { top: +top.toFixed(1), tier: +tierTop.toFixed(1), base: +g.toFixed(1) };
    }
  }

  // ================= METRO GİRİŞ TOTEMLERİ (tanınırlık dokunuşu) =================
  {
    const ents = data.pois && Array.isArray(data.pois.entrances) ? data.pois.entrances : [];
    const pole = S.matte([0.2, 0.2, 0.21]);
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!Number.isFinite(e.x) || !Number.isFinite(e.z)) continue;
      const y = heightAt(e.x, e.z);
      B.box(e.x, y, e.z, 0.35, 4.2, 0.35, [1, 0], pole, 40 + i);
      B.box(e.x, y + 4.2, e.z, 1.5, 1.5, 0.5, [1, 0], S.emis([1.0, 0.16, 0.1], 0.1 + 0.02 * (i % 5), 3.2), 40 + i);
    }
  }

  const geometry = B.toGeometry(THREE);
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(beacons.pos, 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute(beacons.col, 3));
  bg.setAttribute('aBlink', new THREE.Float32BufferAttribute(beacons.blink, 3));
  info.triangles = B.pos.length / 9;
  return { geometry, beacons: bg, signs, info };
}
