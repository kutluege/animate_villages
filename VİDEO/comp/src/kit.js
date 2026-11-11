// Küçük DOM yardımcıları + kartografik yapı taşları (sahneler kullanır). Görsel sabitler theme.js'te.
import { C, GEO, H, ROUTE, W } from './theme.js';

/** h('div', { class: 'card', style: { left: '10px' } }, 'metin', childEl) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** SVG öğesi: s('path', { d: '...', fill: 'none' }) */
export function s(tag, props = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** transform dizgesi: tf({ x, y, s, r, sx, sy }) → 'translate(..) rotate(..) scale(..)' */
export function tf({ x = 0, y = 0, s = 1, r = 0, sx, sy } = {}) {
  return `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx ?? s}, ${sy ?? s})`;
}

/** Yazıyı kelime <span>'lerine böler (kelime kelime animasyon için). Döner: { el, words: [span...] } */
export function splitWords(text, props = {}) {
  const el = h('div', props);
  const words = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) el.append(' ');
    else { const sp = h('span', { style: { display: 'inline-block' } }, part); words.push(sp); el.append(sp); }
  });
  return { el, words };
}

// ================= Kartografik yapı taşları (stiller theme.CSS'te) =================
const px = (v) => (v == null ? null : typeof v === 'number' ? v + 'px' : v);

/** "+" nirengi işareti (haritadaki beyaz artılar). Döner: <svg> */
export function crosshair(size = 22, color = C.ink, weight = 2) {
  const m = size / 2;
  return s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { display: 'block', flex: 'none', overflow: 'visible' } },
    s('path', { d: `M${m} 0V${size}M0 ${m}H${size}`, stroke: color, 'stroke-width': weight, fill: 'none' }));
}

/** Ondalık derece → 41°04′02″N 28°59′33″E. Argümansız: Mecidiyeköy (theme.GEO). */
export function fmtCoord(lat = GEO.lat, lon = GEO.lon) {
  const dms = (v, pos, neg) => {
    const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = Math.round((mf - m) * 60);
    const [mm, ss] = sec === 60 ? [m + 1, 0] : [m, sec];
    return `${d}°${String(mm).padStart(2, '0')}′${String(ss).padStart(2, '0')}″${v >= 0 ? pos : neg}`;
  };
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
}

/** Koordinat etiketi: coordLabel() ya da coordLabel('AJAN 03 · VERİ', { color: C.pink, size: 26 }). Döner: <span class="coord"> */
export function coordLabel(text = fmtCoord(), { color, cross = true, size } = {}) {
  return h('span', { class: 'coord', style: { color, fontSize: px(size) } },
    cross ? crosshair(size ? Math.round(size * 0.8) : 18, color || C.dim, 2) : null, text);
}

/** Harita kartı: ince krem çerçeve, köşe nirengi çentikleri, isteğe bağlı başlık şeridi (sol: title, sağ: coord).
 *  const card = mapCard({ x, y, w, h, title: 'VERİ', coord: 'A-01', accent: C.cyan, pad: 28 }, ...çocuklar)
 *  card.body = içerik kabı (çocuklar buraya eklenir), card.head = başlık şeridi. strong: daha opak zemin. ticks: false = çentiksiz. */
export function mapCard({ x, y, w, h: hh, title, coord, accent = C.pink, pad = 28, strong = false, ticks = true, style = {} } = {}, ...children) {
  const body = h('div', { class: 'mapcard-body', style: { padding: px(pad) } }, ...children);
  const head = title || coord
    ? h('div', { class: 'mapcard-head' },
      h('span', { class: 'ttl' }, title ? h('i', { style: { background: accent } }) : null, title || ''),
      coord ? h('span', {}, coord) : null)
    : null;
  const el = h('div', { class: 'mapcard' + (strong ? ' strong' : ''), style: { left: px(x), top: px(y), width: px(w), height: px(hh), ...style } },
    head, body, ticks ? ['tl', 'tr', 'bl', 'br'].map((c) => h('div', { class: 'tick ' + c })) : null);
  el.body = body; el.head = head;
  return el;
}

/** Lejant satırı. kind: 'fill' (alan) | 'line' (hat) | 'dash' (kesikli) | 'dot' | 'ring'. value: sağa yaslı mono değer. */
export function legendRow({ color = C.pink, label = '', kind = 'fill', value } = {}) {
  const sw = h('span', { class: 'sw ' + (kind === 'fill' ? '' : kind), style: { background: color, borderColor: color } });
  const el = h('div', { class: 'legend-row' }, sw, h('span', { class: 'lbl' }, label), value != null ? h('span', { class: 'val' }, value) : null);
  el.swatch = sw;
  return el;
}
/** legend([{ color, label, kind, value }, …], { title: 'LEJANT' }) → <div class="legend"> ; .rows = satır öğeleri */
export function legend(rows = [], { title } = {}) {
  const els = rows.map(legendRow);
  const el = h('div', { class: 'legend' }, title ? h('div', { class: 'legend-title' }, title) : null, els);
  el.rows = els;
  return el;
}

/** Harita iğnesi: halka + nokta + isteğe bağlı etiket. (x,y) iğnenin merkezi. el.ring / el.dot / el.label animasyon için. */
export function marker({ x = 0, y = 0, label, color = C.pink, r = 16, side = 'right' } = {}) {
  const ring = h('div', { class: 'ring', style: { left: -r + 'px', top: -r + 'px', width: 2 * r + 'px', height: 2 * r + 'px', borderColor: color } });
  const d = Math.max(4, Math.round(r * 0.36));
  const dot = h('div', { class: 'dot', style: { left: -d + 'px', top: -d + 'px', width: 2 * d + 'px', height: 2 * d + 'px', background: color } });
  const lbl = label == null ? null : h('div', { class: 'lbl', style: side === 'left'
    ? { right: r + 14 + 'px', transform: 'translateY(-50%)' } : { left: r + 14 + 'px', transform: 'translateY(-50%)' } }, label);
  const el = h('div', { class: 'marker', style: { left: x + 'px', top: y + 'px' } }, ring, dot, lbl);
  el.ring = ring; el.dot = dot; el.label = lbl;
  return el;
}

/** Ölçek çubuğu: scaleBar({ w: 220, label: '0 — 200 m' }) */
export function scaleBar({ w = 220, label = '0 — 200 m' } = {}) {
  return h('div', { class: 'scalebar' }, h('div', { class: 'bar', style: { width: w + 'px' } }), label);
}

/** Sahne boyu SVG katmanı (route çizimleri için): const svg = mapSvg(); el.append(svg); svg.append(route(...)) */
export function mapSvg(w = W, hh = H) {
  return s('svg', { width: w, height: hh, viewBox: `0 0 ${w} ${hh}`, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' } });
}

/** Yol / hat çizgisi (SVG <g>): route('M100 200 C…', { kind: 'road'|'street'|'rail'|'bus'|'march'|'link', width, color, arrow })
 *  g.draw(k): 0..1 çizilme oranı (saf fonksiyon; update(t) içinde çağır). arrow: true → ucunda ok başı (k ile ilerler).
 *  g.length → yol uzunluğu (px), g.pointAt(k) → { x, y, angle° } (yol üstünde nesne yürütmek için). */
export function route(d, { kind = 'road', width, color, arrow = false } = {}) {
  const st = ROUTE[kind] || ROUTE.road;
  const wd = width ?? st.width, col = color ?? st.color;
  const mk = (stroke, sw) => s('path', { d, fill: 'none', stroke, 'stroke-width': sw, 'stroke-linecap': st.dash ? 'butt' : 'round', 'stroke-linejoin': 'round' });
  const paths = [];
  if (st.casing) paths.push(mk(st.casing, wd + Math.max(4, wd * 0.5)));
  const main = mk(col, wd); paths.push(main);
  if (st.core) paths.push(mk(st.core, Math.max(2, wd * 0.28)));
  const hw = Math.max(wd, 6);
  const head = arrow ? s('path', { d: `M${hw * 1.2} 0L${-hw * 2.6} ${-hw * 2}L${-hw * 1.6} 0L${-hw * 2.6} ${hw * 2}Z`, fill: col }) : null;
  const g = s('g', {}, paths, head);
  let L = null;
  const len = () => (L ??= main.getTotalLength());
  g.pointAt = (k) => {
    const a = Math.max(0, Math.min(1, k)) * len(), p = main.getPointAtLength(a);
    const q = main.getPointAtLength(Math.max(0, a - 3)), q2 = main.getPointAtLength(Math.min(len(), a + 3));
    return { x: p.x, y: p.y, angle: Math.atan2(q2.y - q.y, q2.x - q.x) * 180 / Math.PI };
  };
  g.draw = (k = 1) => {
    k = Math.max(0, Math.min(1, k));
    const total = len(), on = total * k;
    let arr;
    if (st.dash) {
      const [a, b] = st.dash, n = Math.floor(on / (a + b)), rem = on - n * (a + b);
      arr = `${`${a} ${b} `.repeat(n)}${Math.min(a, rem).toFixed(2)} ${(total + a + b).toFixed(2)}`;
    } else arr = `${on.toFixed(2)} ${(total + wd + 10).toFixed(2)}`;
    for (const p of paths) p.setAttribute('stroke-dasharray', arr);
    g.style.visibility = k <= 0 ? 'hidden' : 'visible';
    if (head) { const p = g.pointAt(k); head.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)})`); }
    return g;
  };
  Object.defineProperty(g, 'length', { get: len });
  g.main = main;
  return g;
}
