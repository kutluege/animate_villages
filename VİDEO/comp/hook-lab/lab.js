// HOOK LABORATUVARI — comp/src/main.js'in kopyası (ana dosyaya dokunulmaz). Fark: `?hook=a|b|c` ile `hook` sahnesi yerine
// comp/src/scenes/hook.<v>.js yüklenir (vars. mevcut hook.js); yalnız `?limit=` saniyesinden önce başlayan sahneler yüklenir,
// süre = limit (vars. 10). Sayfa: comp/hook-lab.html?render=1&hook=b
// Sahne yükleyici + altyazı + kare saati. Her kare yalnızca t'nin saf fonksiyonu.
//   ?render=1        render modu (UI yok, sahne viewport'a ölçeklenir)
//   ?t=12.5          önizlemede başlangıç anı
//   ?only=hook,vaat  yalnızca bu sahne modüllerini yükle (diğerleri yer tutucu) — hızlı/izole deneme
//   ?safe=1          Instagram arayüz bölgelerini (üst 220 / alt 420 px) göster
//   ?nosubs=1        altyazıyı gizle
// Katmanlar (alttan üste): #backdrop (ortak topografya fonu) → #scenes → #grain → #subsRoot → #safe
import * as theme from '../src/theme.js';
import { h } from '../src/kit.js';
import { Subtitles } from '../src/subtitles.js';
import { createBackdrop } from '../src/backdrop.js';
import { createPlaceholder } from '../src/placeholder.js';

const P = new URLSearchParams(location.search);
const RENDER = P.get('render') === '1';
const ONLY = P.get('only') ? new Set(P.get('only').split(',')) : null;
const ROOT = new URL('../../', import.meta.url); // VİDEO/
const HOOK = (P.get('hook') || '').replace(/[^a-z0-9-]/gi, '');
const LIMIT = Number(P.get('limit')) || 10;
const modPath = (id) => (id === 'hook' && HOOK && HOOK !== 'mevcut' ? `../src/scenes/hook.${HOOK}.js` : `../src/scenes/${id}.js`);
const { W, H } = theme;

// ---- Determinizm bekçisi: render modunda Math.random uyarır (yine de tohumlu değer döndürür) ----
if (RENDER) {
  const r = theme.rng(12345);
  let warned = false;
  Math.random = () => { if (!warned) { warned = true; console.error('[determinizm] Math.random kullanıldı — theme.rng(seed) kullanın'); } return r(); };
}

// ---- Bekleyen işler (görsel decode vb.): __ready ve her __renderFrame bunları bekler ----
const pending = new Set();
function track(p) {
  const q = Promise.resolve(p).catch((e) => console.error('[yükleme]', e?.message || e));
  pending.add(q); q.finally(() => pending.delete(q));
  return p;
}
async function settle() { while (pending.size) await Promise.all([...pending]); }

const getJSON = async (rel) => { const r = await fetch(new URL(rel, ROOT)); if (!r.ok) throw new Error(`${rel}: ${r.status}`); return r.json(); };

// ---- Sayfa iskeleti ----
const style = document.createElement('style');
style.textContent = theme.CSS + `
html,body{margin:0;background:${RENDER ? theme.C.night : '#000'};overflow:hidden;}
#stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden;background:${theme.C.night};contain:strict;}
.layer{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;}
#backdrop{z-index:0;} #scenes{z-index:1;isolation:isolate;} #grain{z-index:2;} #subsRoot{z-index:3;} #safe{z-index:4;}
#grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:0.07;}
#safe{position:absolute;inset:0;pointer-events:none;display:none;}
#safe div{position:absolute;left:0;width:100%;background:rgba(255,0,80,0.22);border:2px dashed rgba(255,80,120,0.9);box-sizing:border-box;
  font:600 26px/1 ${theme.FONT.mono};color:#fff;padding:14px;}
${RENDER ? '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}' : ''}
`;
document.head.append(style);
const stage = h('div', { id: 'stage' });
const scenesRoot = h('div', { id: 'scenes', class: 'layer' });
const grain = h('div', { id: 'grain' });
const subsRoot = h('div', { id: 'subsRoot', class: 'layer', style: { pointerEvents: 'none' } });
const safe = h('div', { id: 'safe' },
  h('div', { style: { top: '0', height: '220px' } }, 'IG ÜST 220'),
  h('div', { style: { top: H - 420 + 'px', height: '420px' } }, 'IG ALT 420'));
stage.append(scenesRoot, grain, subsRoot, safe);
document.body.append(stage);
if (P.get('safe') === '1') safe.style.display = 'block';

function fitStage() {
  if (RENDER) { stage.style.transform = `scale(${innerWidth / W})`; return; }
  const availH = innerHeight - 76, availW = innerWidth;
  const k = Math.min(availH / H, availW / W);
  stage.style.transform = `translate(${(availW - W * k) / 2}px, 0px) scale(${k})`;
}
addEventListener('resize', fitStage);
fitStage();

// Statik, tohumlu film greni (karo); konumu kare saatinden türetilir
function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const img = g.createImageData(256, 256); const r = theme.rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = (r() * 255) | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  grain.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
}

// ---- Sahne bağlamı (ctx) ----
function makeCtx(sc, transcript) {
  const id = sc.id;
  const words = transcript.words.filter((w) => w.start >= sc.start - 0.05 && w.start < sc.end)
    .map((w) => ({ ...w, start: +(w.start - sc.start).toFixed(3), end: +(w.end - sc.start).toFixed(3) }));
  return {
    id, start: sc.start, end: sc.end, duration: sc.end - sc.start, silent: !!sc.silent,
    W, H, SAFE: theme.SAFE, theme, render: RENDER,
    words, text: words.map((w) => w.text).join(' '),
    /** Kelimenin (sahneye göre) zamanı: ctx.at('mareşal') → { start, end } | null ; n: kaçıncı geçiş (0'dan) */
    at(word, n = 0) {
      const norm = (s) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');
      const hits = words.filter((w) => norm(w.text) === norm(word) || norm(w.text).startsWith(norm(word)));
      return hits[n] || null;
    },
    /** comp/assets/<id>/<rel> adresi (başka sahnenin dosyası için '../<diğer>/x.png') */
    asset: (rel) => new URL(`comp/assets/${id}/${rel}`, ROOT).href,
    /** VİDEO köküne göre adres: ctx.url('work/transcript.json') */
    url: (rel) => new URL(rel, ROOT).href,
    json: (rel) => track(fetch(new URL(rel, ROOT)).then((r) => r.json())),
    /** Görseli yükle + decode et (hazır olmadan kare çizilmez). Döner: Promise<HTMLImageElement> */
    image(src, props = {}) {
      const img = h('img', { draggable: 'false', ...props });
      img.decoding = 'sync';
      img.src = /^(https?:|data:|blob:)/.test(src) ? src : new URL(`comp/assets/${id}/${src}`, ROOT).href;
      return track(img.decode().then(() => img));
    },
    /** img.src değiştir; yeni kare decode olmadan çerçeve yakalanmaz. */
    setSrc(img, src) { if (img.getAttribute('src') !== src) { img.src = src; track(img.decode()); } },
    /** Kare dizisi (tools/frames.mjs çıktısı). Döner: { el, fps, count, duration, show(i), at(sec) } */
    async frames(rel, props = {}) {
      const base = new URL(rel.replace(/\/?$/, '/'), new URL(`comp/assets/${id}/`, ROOT));
      const man = await track(fetch(new URL('manifest.json', base)).then((r) => { if (!r.ok) throw new Error(`${base}manifest.json yok`); return r.json(); }));
      const el = h('img', { class: 'fill', draggable: 'false', ...props });
      const name = (i) => new URL(man.pattern.replace(/%0(\d)d/, (_, n) => String(i).padStart(Number(n), '0')), base).href;
      const ctxRef = this;
      const seq = {
        el, fps: man.fps, count: man.count, duration: man.count / man.fps, manifest: man, index: -1,
        show(i) { i = Math.max(0, Math.min(man.count - 1, Math.floor(i))); if (i !== seq.index) { seq.index = i; ctxRef.setSrc(el, name(i)); } },
        at(sec) { seq.show(Math.floor(sec * man.fps + 1e-6)); },
      };
      seq.show(0);
      return seq;
    },
    track,
  };
}

// ---- Yükleme ----
const status = { modules: {}, errors: [] };
let scenes = [], subs = null, backdrop = null, DURATION = 0, timeline = null;

async function boot() {
  await theme.loadFonts();
  makeGrain();
  backdrop = await createBackdrop({ pixelScale: RENDER ? Math.min(1, innerWidth / W) : 1 }); // fon tuvali bir kez çizilir (yazı tipleri yüklendikten sonra: koordinat etiketleri)
  stage.prepend(backdrop.el);
  let transcript;
  [timeline, transcript] = await Promise.all([getJSON('work/timeline.json'), getJSON('work/transcript.json')]);
  // final süresi tek yerden: timeline.json → scenes[].duration (end verilmemişse)
  let prevEnd = 0;
  const list = timeline.scenes.map((s) => {
    const start = s.start ?? prevEnd;
    const end = s.end ?? start + s.duration;
    prevEnd = end;
    return { ...s, start, end };
  }).filter((s) => s.start < LIMIT);
  DURATION = Math.min(LIMIT, list[list.length - 1].end);

  scenes = await Promise.all(list.map(async (sc, z) => {
    const ctx = makeCtx(sc, transcript);
    const layer = h('div', { class: 'layer', 'data-scene': sc.id, style: { zIndex: z, display: 'none' } });
    scenesRoot.append(layer);
    let mod = null, state = 'yer-tutucu', err = null;
    if (!ONLY || ONLY.has(sc.id)) {
      let m = null;
      try { m = await import(modPath(sc.id)); } catch (e) {
        // modül yoksa sessizce yer tutucu; sözdizimi hatası vb. ise raporla
        const exists = await fetch(new URL(modPath(sc.id), import.meta.url), { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
        if (exists) { err = `import: ${e.message}`; console.error(`[sahne ${sc.id}] ${err}`); }
      }
      if (m) {
        try {
          if (typeof m.create !== 'function') throw new Error('create(ctx) export edilmemiş');
          mod = await m.create(ctx);
          if (!mod || !(mod.el instanceof Node) || typeof mod.update !== 'function') throw new Error('create() { el, update } döndürmeli');
          state = 'yüklendi';
        } catch (e) { mod = null; err = `create: ${e.message}`; console.error(`[sahne ${sc.id}] ${err}`, e); }
      }
    }
    if (!mod) mod = createPlaceholder(ctx, err);
    layer.append(mod.el);
    status.modules[sc.id] = err ? `HATA → yer tutucu (${err})` : state;
    if (err) status.errors.push({ scene: sc.id, error: err });
    const ext = mod.extend || {};
    return { ...sc, ctx, mod, layer, from: sc.start - (ext.before || 0), to: sc.end + (ext.after || 0), failed: false };
  }));

  subs = new Subtitles(subsRoot, transcript.words);

  // SFX ipuçları → global saat (sessiz sahnelerinki atılır)
  const sfx = [];
  for (const sc of scenes) {
    let cues = sc.mod.sfx;
    if (typeof cues === 'function') cues = cues();
    for (const c of cues || []) {
      const t = sc.start + Number(c.t);
      if (!c.name || !Number.isFinite(t)) continue;
      const silent = scenes.some((x) => x.silent && t >= x.start && t < x.end);
      if (silent) { console.warn(`[sfx] ${sc.id}: ${c.name} @${t.toFixed(2)} sessiz bölümde — atlandı`); continue; }
      sfx.push({ t: +t.toFixed(4), name: c.name, gain: c.gain ?? 1, scene: sc.id });
    }
  }
  sfx.sort((a, b) => a.t - b.t);

  window.__duration = DURATION;
  window.__timeline = scenes.map(({ id, start, end, from, to, owner, silent }) => ({ id, start, end, from, to, owner, silent: !!silent }));
  window.__sfx = sfx;
  window.__modules = status;
  window.__subtitleChunks = subs.chunks;
  await settle();
}

// ---- Kare çizimi ----
let lastT = null;
async function renderFrame(t) {
  t = Math.max(0, Math.min(DURATION, Number(t) || 0));
  lastT = t;
  let primary = null;
  for (const sc of scenes) {
    const vis = t >= sc.from && (t < sc.to || (sc.to >= DURATION && t <= DURATION));
    sc.layer.style.display = vis ? '' : 'none';
    if (t >= sc.start && (t < sc.end || (sc.end >= DURATION && t <= DURATION))) primary = sc;
    if (!vis) continue;
    try { await sc.mod.update(t - sc.start, t); }
    catch (e) {
      if (!sc.failed) { sc.failed = true; console.error(`[sahne ${sc.id}] update(${(t - sc.start).toFixed(3)}): ${e.message}`, e); status.errors.push({ scene: sc.id, error: 'update: ' + e.message }); }
    }
  }
  // Altyazı: konum/görünürlüğü ÖBEĞİN SAHİBİ sahne belirler (öbeğin ilk kelimesi hangi sahnedeyse). Öbek, son kelimeden sonraki
  // bekleme payıyla sahne sınırını aşsa da ekseni öbek boyunca değişmez → sahne geçişinde altyazı zıplamaz. Sessiz sahnede yok.
  const m = primary?.mod || {};
  const tl = primary ? t - primary.start : 0;
  const ci = subs.chunkAt(t);
  let owner = primary;
  if (ci >= 0) {
    const w0 = subs.chunks[ci].words[0].start;
    for (const sc of scenes) if (w0 >= sc.start - 0.05 && w0 < sc.end) owner = sc;
  }
  const om = owner?.mod || {};
  const otl = owner ? Math.max(0, Math.min(owner.end - owner.start, t - owner.start)) : 0;
  let hidden = !primary || !!primary.silent || P.get('nosubs') === '1';
  if (!hidden && om.subtitles !== undefined) hidden = !(typeof om.subtitles === 'function' ? om.subtitles(otl) : om.subtitles);
  let y = typeof om.subtitleY === 'function' ? om.subtitleY(otl) : om.subtitleY;
  subs.update(t, { hidden, y: Number.isFinite(y) ? y : theme.SUBTITLE_Y });
  // Ortak fon: sahne `backdrop: false | 0..1 | (tl) => …` ile kapatabilir/kısabilir (tam ekran video/fotoğraf anları)
  let bd = typeof m.backdrop === 'function' ? m.backdrop(tl) : m.backdrop;
  bd = bd === undefined || bd === true ? 1 : bd === false ? 0 : theme.clamp(Number(bd) || 0);
  backdrop.update(t, bd);
  // Gren: kare saatine bağlı kayma; sahne `grain: false` ile kapatabilir
  const fi = Math.floor(t * 24);
  grain.style.display = m.grain === false ? 'none' : '';
  grain.style.backgroundPosition = `${Math.floor(theme.hash01(fi, 1) * 256)}px ${Math.floor(theme.hash01(fi, 2) * 256)}px`;
  await settle();
  await document.fonts.ready;
}

window.__renderFrame = renderFrame;
window.__ready = boot().then(async () => {
  const t0 = Number(P.get('t'));
  await renderFrame(Number.isFinite(t0) ? t0 : 0);
  if (!RENDER) (await import('../src/preview.js')).initPreview({ renderFrame, duration: DURATION, scenes: window.__timeline, startT: t0 || 0, safe, root: ROOT });
  return true;
}).catch((e) => { console.error('[boot]', e); document.body.append(h('pre', { style: { color: '#f66', position: 'fixed', top: '10px', left: '10px', font: '16px monospace' } }, 'boot hatası: ' + e.message)); throw e; });
