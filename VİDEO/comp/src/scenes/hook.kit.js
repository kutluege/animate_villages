// hook.kit — açılış seçeneklerinin (hook.a / hook.b / hook.c) ortak "dünyası": aynı topografya haritası (comp/assets/hook/map.jpg)
// + yakın plan katmanları (comp/assets/hook-lab/L1, L2 — tools/hook-lab-map.mjs, aynı veri ve renk kuralları), döndürülebilir
// perspektif kamera ve pembe simge yapıların yüksekliğiyle çizilen (hafif 3B) hâli. Her şey yazılım tuvalinde (CPU) çizilir:
// aynı t → aynı pikseller. Sahne değil; yalnız yardımcı modül.
import { C, W, H, alpha, clamp, lerp, range } from '../theme.js';

/** Kamera: cx, cz (metre; x doğu, z güney) ekranın (px, py) noktasına düşer; s = yerde px/metre; rot = radyan (saat yönü);
 *  F = odak (px): kamera yüksekliği F/s metre → yüksek yapılar merkezden dışa doğru "yükselir". */
export const camera = (o) => ({ px: W / 2, py: H / 2, rot: 0, F: 2600, ...o });

/** Yer (x, z) + yükseklik h → ekran [X, Y] */
export function project(cam, x, z, h = 0) {
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  const dx = x - cam.cx, dz = z - cam.cz;
  const Hc = cam.F / cam.s, f = Hc / Math.max(1e-3, Hc - h);
  return [cam.px + (dx * c - dz * s) * cam.s * f, cam.py + (dx * s + dz * c) * cam.s * f];
}
/** Ekran → yer (h = 0) */
export function unproject(cam, X, Y) {
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  const rx = (X - cam.px) / cam.s, rz = (Y - cam.py) / cam.s;
  return [cam.cx + rx * c + rz * s, cam.cz - rx * s + rz * c];
}
/** İki kamera arasında: ölçek logaritmik (yakınlaşma hızı göze sabit), merkez/dönüş doğrusal. */
export function camLerp(a, b, k) {
  return { ...a, s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), k)), cx: lerp(a.cx, b.cx, k), cz: lerp(a.cz, b.cz, k),
    rot: lerp(a.rot, b.rot, k), px: lerp(a.px, b.px, k), py: lerp(a.py, b.py, k), F: lerp(a.F ?? 2600, b.F ?? 2600, k) };
}

/** Kamerayı, yerdeki `g` noktası ekranın `scr` noktasına düşecek şekilde kur. */
export function aim(o0, [gx, gz], [sx, sy]) {
  const o = camera(o0);
  const c = Math.cos(o.rot), sn = Math.sin(o.rot), rx = (sx - o.px) / o.s, ry = (sy - o.py) / o.s;
  return { ...o, cx: gx - (rx * c + ry * sn), cz: gz - (-rx * sn + ry * c) };
}
/** İki kamera arasında, yerdeki `anchor` noktası ekranda düz bir yol izleyerek (konu kadrajdan kaçmaz). */
export function camVia(a, b, k, anchor, kPos = k) {
  const m = camLerp(a, b, k);
  const A = project(a, anchor[0], anchor[1]), B = project(b, anchor[0], anchor[1]);
  return aim(m, anchor, [lerp(A[0], B[0], kPos), lerp(A[1], B[1], kPos)]);
}

// Adlar: build_data.py LANDMARK_IDS + OSM etiketleri (hook.js ile aynı; değiştirme)
export const NAMES = { trump: 'TRUMP TOWERS', torun: 'TORUN CENTER', cevahir: 'CEVAHİR AVM' };
const ORDER = ['trump', 'torun', 'cevahir'];

export async function loadWorld(ctx) {
  const [map, levels, base] = await Promise.all([
    ctx.json('comp/assets/hook/map.json'), ctx.json('comp/assets/hook-lab/levels.json'), ctx.image(ctx.url('comp/assets/hook/map.jpg')),
  ]);
  const cpu = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const MS = map.scale, { x0, z0 } = map.window;
  const [bc, bg] = cpu(base.naturalWidth, base.naturalHeight); bg.drawImage(base, 0, 0);
  const layers = [{ id: 'L0', canvas: bc, x0, z0, scale: MS }];
  for (const L of levels.levels) {
    const imgs = await Promise.all(L.tiles.map((t) => ctx.image(ctx.url(`comp/assets/hook-lab/${t.file}`))));
    const w = Math.round((L.win.x1 - L.win.x0) * L.scale), h = Math.round((L.win.z1 - L.win.z0) * L.scale);
    const [c, g] = cpu(w, h);
    L.tiles.forEach((t, i) => {
      const ox = Math.round((t.x0 - L.win.x0) * L.scale) + L.mg, oz = Math.round((t.z0 - L.win.z0) * L.scale) + L.mg;
      g.drawImage(imgs[i], L.mg, L.mg, t.w - 2 * L.mg, t.h - 2 * L.mg, ox, oz, t.w - 2 * L.mg, t.h - 2 * L.mg);
    });
    // kenarları yumuşat: alt katmana dikişsiz geçiş
    const f = Math.round(Math.min(w, h) * 0.07);
    g.globalCompositeOperation = 'destination-out';
    const edge = (x, y, ww, hh, gx0, gy0, gx1, gy1) => { const gr = g.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, ww, hh); };
    edge(0, 0, f, h, 0, 0, f, 0); edge(w - f, 0, f, h, w, 0, w - f, 0); edge(0, 0, w, f, 0, 0, 0, f); edge(0, h - f, w, f, 0, h, 0, h - f);
    g.globalCompositeOperation = 'source-over';
    layers.push({ id: L.id, canvas: c, x0: L.win.x0, z0: L.win.z0, scale: L.scale, win: L.win });
  }

  const m2 = ([px, pz]) => [px / MS + x0, pz / MS + z0];
  const landmarks = ORDER.map((key, idx) => {
    const parts = (map.landmarks[key] || []).map((b) => ({ h: b.height, ring: b.ring.map(m2) })).sort((a, b) => a.h - b.h);
    const all = parts.flatMap((p) => p.ring);
    const xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
    const bb = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    // ağırlık merkezi: yüksek kütlenin (varsa) ortası
    const tall = parts.filter((p) => p.h >= 100);
    const src = (tall.length ? tall : parts).flatMap((p) => p.ring);
    const c = [src.reduce((a, p) => a + p[0], 0) / src.length, src.reduce((a, p) => a + p[1], 0) / src.length];
    const top = Math.max(...parts.map((p) => p.h));
    return { key, idx, name: NAMES[key], parts, bb, c, top, r: Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2 };
  });

  /** Haritayı kameradan çiz. Yakın planda yüksek çözünürlüklü katmanlar (L1 ≥ 1.3 px/m, L2 ≥ 3.4 px/m) yumuşak geçişle üste biner. */
  function drawMap(g, cam) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.night; g.fillRect(0, 0, W, H);
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    g.setTransform(cam.s * c, cam.s * s, -cam.s * s, cam.s * c, cam.px - cam.s * (cam.cx * c - cam.cz * s), cam.py - cam.s * (cam.cx * s + cam.cz * c));
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const want = { L0: 1, L1: range(cam.s, 1.22, 1.5), L2: range(cam.s, 3.3, 4.4) };
    for (const L of layers) {
      const a = want[L.id] ?? 0;
      if (a <= 0.002) continue;
      g.globalAlpha = a > 0.995 ? 1 : a;
      g.drawImage(L.canvas, L.x0, L.z0, L.canvas.width / L.scale, L.canvas.height / L.scale);
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Simge yapı: duvarlar (yüksekliğe göre, perspektifle) + çatı. st: { fill, glow, flash, edge, pop, lift, wall } (0..1) */
  function drawLandmark(g, cam, L, st = {}) {
    const { fill = 1, glow = 0, flash = 0, edge = 0, pop = 1, lift = 1, color = C.pink, glowBlur = 46 } = st;
    // yakın planda alçak kütlelerin çatısı biraz koyulaşır: kuleler okunur (uzakta hepsi aynı pembe)
    const lowTint = (h) => 0.26 * range(cam.s, 1.8, 4) * (1 - Math.min(h, 110) / 110);
    if (fill <= 0 && glow <= 0 && flash <= 0) return;
    const nadir = unproject(cam, cam.px, cam.py);
    const P = (p, h) => {
      const x = L.c[0] + (p[0] - L.c[0]) * pop, z = L.c[1] + (p[1] - L.c[1]) * pop;
      return project(cam, x, z, h * lift);
    };
    const faces = []; // [{ pts, shade }]
    for (const part of L.parts) {
      const r = part.ring, n = r.length;
      const hh = part.h;
      const back = [], front = [];
      for (let i = 0; i < n; i++) {
        const a = r[i], b = r[(i + 1) % n];
        // dışa bakan normal (sarım yönünden bağımsız: halkanın ağırlık merkezinden uzağa)
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        let nx = b[1] - a[1], nz = -(b[0] - a[0]);
        const cx = r.reduce((s2, p) => s2 + p[0], 0) / n, cz = r.reduce((s2, p) => s2 + p[1], 0) / n;
        if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
        const ln = Math.hypot(nx, nz) || 1; nx /= ln; nz /= ln;
        const facing = nx * (nadir[0] - mx) + nz * (nadir[1] - mz) > 0;
        const light = 0.5 + 0.5 * (nx * -0.55 + nz * -0.62) / 0.83;      // kuzeybatı ışığı (harita ile aynı)
        const quad = [P(a, 0), P(b, 0), P(b, hh), P(a, hh)];
        (facing ? front : back).push({ pts: quad, shade: 0.3 + 0.34 * light });
      }
      faces.push(...back.map((f) => ({ ...f, kind: 'wall' })), ...front.map((f) => ({ ...f, kind: 'wall' })), { pts: r.map((p) => P(p, hh)), shade: 1 - lowTint(hh), kind: 'roof' });
    }
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    g.save();
    g.lineJoin = 'round';
    // yere düşen gölge (kuzeybatı ışığı → güneydoğuya): yakın planda derinlik verir
    const shA = (st.shadow ?? 0.42) * Math.min(1, fill) * (0.35 + 0.65 * range(cam.s, 1.2, 3));
    if (shA > 0.01) {
      g.beginPath();
      for (const part of L.parts) {
        const len = part.h * lift * 0.55, N = 10;
        for (let k = 0; k <= N; k++) {
          const ox = 0.55 / 0.83 * len * k / N, oz = 0.62 / 0.83 * len * k / N;
          part.ring.forEach((p, i) => { const q = P([p[0] + ox / pop, p[1] + oz / pop], 0); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
          g.closePath();
        }
      }
      g.globalAlpha = shA; g.fillStyle = C.night; g.fill('nonzero');
    }
    if (glow > 0) {
      g.globalAlpha = Math.min(1, glow); g.shadowColor = color; g.shadowBlur = glowBlur; g.fillStyle = color;
      for (const f of faces) { path(f.pts); g.fill(); }
      g.shadowBlur = 0; g.shadowColor = 'transparent';
    }
    if (fill > 0) {
      g.globalAlpha = Math.min(1, fill);
      for (const f of faces) {
        path(f.pts);
        g.fillStyle = f.shade >= 1 ? color : mixHex(color, C.night, 1 - f.shade);
        g.fill();
        if (f.kind === 'wall') { g.strokeStyle = alpha(C.night, 0.18); g.lineWidth = 1; g.stroke(); }
      }
      if (edge > 0) {
        g.globalAlpha = Math.min(1, fill) * edge; g.strokeStyle = C.ink; g.lineWidth = 1.6;
        for (const f of faces) if (f.kind === 'roof') { path(f.pts); g.stroke(); }
      }
    }
    if (flash > 0) {
      g.globalAlpha = Math.min(1, flash); g.fillStyle = C.ink;
      for (const f of faces) { path(f.pts); g.fill(); }
    }
    g.restore();
  }

  /** Bir yapının ekrandaki sınır kutusu (çatılar dahil) */
  function screenBox(cam, L, lift = 1) {
    const pts = L.parts.flatMap((p) => p.ring.flatMap((q) => [project(cam, q[0], q[1], 0), project(cam, q[0], q[1], p.h * lift)]));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  return { map, layers, landmarks, drawMap, drawLandmark, screenBox, project, unproject };
}

const hx = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
/** İki belirteç arasında karışım (a → b, k) → rgb() */
export function mixHex(a, b, k) {
  const A = hx(a), B = hx(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k))).join(',')})`;
}

/** Yazılım tuvali (CPU raster; GPU yuvarlamasına bağlı değil) */
export function cpuCanvas(w = W, h = H, style = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px', ...style });
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

/** Tam ekran katman solması: 1'e/0'a çok yakın saydamlıklar tam değere yuvarlanır */
export const snap = (o) => (o > 0.985 ? 1 : o < 0.015 ? 0 : o);
