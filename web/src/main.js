// Mecidiyeköy — çatı: ctx kurulumu, veri, modüller, serbest mod ve render modu.
// CONTRACT §6 (modül arayüzü) ve §7 (determinizm) burada uygulanır.
//
// Sağlamlık kuralları:
//  - Eksik modül sessizce atlanır (konsola bilgi); hatalı modül (import/create/update/render) konsola
//    net yazılır, eklediği nesneler sahneden geri alınır, diğerleri çalışmaya devam eder.
//  - atmosphere*.js yoksa/çökerse yer tutucu ışık + gök; edit.js yoksa yer tutucu yörünge + tod süpürmesi.
//  - Kareler yalnızca (tod, t)'den çizilir; render modunda Math.random / performance.now / Date.now
//    her karede t'ye bağlanır (yanlışlıkla kullanılsa bile kare tek başına aynı çıkar).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { timeState, formatTod, phaseLabel, smoothstep } from './timeline.js';
import { makeHeightAt, create as createTerrain } from './terrain.js';

const params = new URLSearchParams(location.search);
const RENDER = params.get('render') === '1';
const DEBUG = params.get('debug') === '1';
const quality = params.get('q') === 'draft' ? 'draft' : 'final';
const DEG = Math.PI / 180;

// ───────────────────────────── rng (seed'li, deterministik) ─────────────────────────────
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
/** ctx.rng("city/windows") → () => [0,1). Aynı seed → aynı dizi. */
export function rng(seedStr) {
  const h = xmur3(String(seedStr));
  const r = sfc32(h(), h(), h(), h());
  for (let i = 0; i < 12; i++) r();
  return r;
}

// ───────────────────────────── determinizm kalkanı (yalnızca render) ─────────────────────────────
const _real = { random: Math.random, perfNow: performance.now.bind(performance), dateNow: Date.now };
const EPOCH = Date.UTC(2026, 2, 28, 13, 0, 0); // sabit hayali tarih
let _shieldT = 0;
function installShield() {
  let r = rng('shield/0');
  Math.random = () => r();
  performance.now = () => _shieldT * 1000;
  Date.now = () => EPOCH + Math.round(_shieldT * 1000);
  return (t) => { _shieldT = t; r = rng('shield/' + t.toFixed(4)); };
}

// ───────────────────────────── sahne temel ─────────────────────────────
const stage = document.getElementById('stage');
if (RENDER) document.body.classList.add('render');
const W0 = RENDER ? clampInt(params.get('w'), 1080, 16, 8192) : innerWidth;
const H0 = RENDER ? clampInt(params.get('h'), 1920, 16, 8192) : innerHeight;
function clampInt(v, def, lo, hi) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: RENDER, stencil: false,
  });
} catch (e) {
  fatal('WebGL başlatılamadı: ' + e.message);
  throw e;
}
renderer.setPixelRatio(RENDER ? 1 : Math.min(devicePixelRatio || 1, 2));
renderer.setSize(W0, H0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.name = 'mecidiyekoy';
const camera = new THREE.PerspectiveCamera(40, W0 / H0, 1, 30000);
camera.position.set(520, 300, 620);
camera.lookAt(0, 20, 0);

const status = { data: {}, modules: {} };
window.__modules = status;

function fatal(msg) {
  console.error('[main] ' + msg);
  const el = document.getElementById('loading');
  if (el) { el.textContent = msg; el.style.color = '#ff9b8a'; }
}
window.addEventListener('error', (e) => console.error('[main] yakalanmamış hata:', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[main] yakalanmamış söz reddi:', e.reason));

// ───────────────────────────── veri ─────────────────────────────
// Dosya yoksa ctx.data.<ad> = null (CONTRACT §6). Varsa, beklenen dizi alanı eksikse [] ile tamamlanır.
const DATA_DEFAULTS = {
  buildings: () => ({ origin: null, buildings: [] }),
  roads: () => ({ roads: [] }),
  terrain: () => null,
  landmarks: () => ({ landmarks: [] }),
  points: () => ({ points: [] }),
  landuse: () => ({ areas: [] }),
};
async function loadData() {
  const data = {};
  await Promise.all(Object.entries(DATA_DEFAULTS).map(async ([key, def]) => {
    const url = new URL(`../../data/${key}.json`, import.meta.url);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      const d = def();
      // Beklenen dizi alanları eksikse boş dizi ver
      if (d && typeof json === 'object' && json) for (const k of Object.keys(d)) if (Array.isArray(d[k]) && !Array.isArray(json[k])) json[k] = [];
      data[key] = json;
      status.data[key] = 'ok';
    } catch (e) {
      data[key] = null;
      status.data[key] = 'yok';
      console.info(`[main] data/${key}.json yüklenemedi (${e.message}) — ctx.data.${key} = null`);
    }
  }));
  return data;
}

// ───────────────────────────── modüller ─────────────────────────────
async function exists(url) {
  try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch { return false; }
}
async function tryImport(file) {
  const url = new URL(`./${file}`, import.meta.url).href;
  if (!(await exists(url))) { status.modules[file] = 'yok'; console.info(`[main] ${file} yok — atlandı`); return null; }
  try { return await import(url); } catch (e) {
    status.modules[file] = 'import hatası';
    console.error(`[main] ${file} içe aktarılamadı (sözdizimi/import hatası) — atlandı:\n`, e);
    return null;
  }
}

/** Bir modülü güvenle kur; başarısızsa eklediği nesneleri sahneden geri al. */
async function mount(file, mod, ctx) {
  if (!mod) return null;
  if (typeof mod.create !== 'function') {
    status.modules[file] = 'create yok';
    console.error(`[main] ${file}: "export async function create(ctx)" bulunamadı — atlandı`);
    return null;
  }
  const before = new Set(scene.children);
  const fog = scene.fog, bg = scene.background, env = scene.environment;
  try {
    const inst = await mod.create(ctx);
    if (!inst || typeof inst !== 'object') throw new Error('create() bir nesne döndürmedi');
    if (inst.object3D && !inst.object3D.parent) scene.add(inst.object3D);
    status.modules[file] = 'ok';
    return { name: file, inst, errors: 0 };
  } catch (e) {
    status.modules[file] = 'create hatası';
    console.error(`[main] ${file}.create() hata verdi — modül devre dışı, eklediği nesneler kaldırıldı:\n`, e);
    for (const c of [...scene.children]) if (!before.has(c)) scene.remove(c);
    scene.fog = fog; scene.background = bg; scene.environment = env;
    return null;
  }
}

function callSafe(m, method, ...args) {
  const fn = m && m.inst && m.inst[method];
  if (typeof fn !== 'function') return undefined;
  try { return fn.apply(m.inst, args); } catch (e) {
    m.errors++;
    if (m.errors === 1 || m.errors % 300 === 0) console.error(`[main] ${m.name}.${method}() hata (${m.errors}. kez):\n`, e);
    status.modules[m.name] = `${method} hatası`;
    return undefined;
  }
}

// Yükleyici takibi: dokular vb. bitmeden kare çizilmesin.
let loadersPending = 0;
{
  const M = THREE.DefaultLoadingManager;
  const s = M.itemStart.bind(M), e = M.itemEnd.bind(M), x = M.itemError.bind(M);
  M.itemStart = (u) => { loadersPending++; s(u); };
  M.itemEnd = (u) => { loadersPending = Math.max(0, loadersPending - 1); e(u); };
  M.itemError = (u) => { console.error('[main] yüklenemedi:', u); x(u); };
}
async function settleLoaders(timeoutMs = 30000) {
  const t0 = _real.perfNow();
  while (loadersPending > 0 && _real.perfNow() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 30));
  if (loadersPending > 0) console.warn(`[main] ${loadersPending} yükleme ${timeoutMs} ms içinde bitmedi`);
  try { await document.fonts.ready; } catch {}
}

// ───────────────────────────── yer tutucular ─────────────────────────────
// Atmosfer yoksa: güneş + gök yarımküresi + gök/sis rengi. Gerçek atmosfer modülü bunların hepsini üstlenir.
function placeholderAtmosphere() {
  const group = new THREE.Group(); group.name = 'placeholder-atmosphere';
  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a5048, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'draft' ? 1024 : 4096, quality === 'draft' ? 1024 : 4096);
  Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 5000 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  const moon = new THREE.DirectionalLight(0x8ea8ff, 0);
  moon.position.set(600, 900, 400);
  group.add(hemi, sun, sun.target, moon);
  scene.add(group);
  const sky = { day: new THREE.Color(0x8fb8e2), gold: new THREE.Color(0xe9a070), blue: new THREE.Color(0x2c3e74), night: new THREE.Color(0x070b18) };
  const warm = new THREE.Color(0xffa860), white = new THREE.Color(0xfff4e6), c = new THREE.Color();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x8fb8e2, 1500, 9000);
  return {
    update(s) {
      c.copy(sky.day).lerp(sky.gold, s.golden * 0.85).lerp(sky.blue, smoothstep(0, 0.45, s.night) * (1 - s.day))
        .lerp(sky.night, smoothstep(0.4, 1, s.night));
      scene.background.copy(c); scene.fog.color.copy(c);
      sun.position.copy(s.sunDir).multiplyScalar(2000); sun.target.position.set(0, 0, 0);
      const above = smoothstep(-1, 4, s.sunElev);
      sun.intensity = 3.2 * above; sun.visible = above > 0.001;
      sun.color.copy(white).lerp(warm, s.golden);
      hemi.intensity = 0.25 + 1.0 * s.day + 0.25 * s.golden;
      hemi.color.copy(c).lerp(white, 0.4);
      moon.intensity = 0.35 * s.night;
      renderer.toneMappingExposure = 1 + 0.8 * s.night;
    },
  };
}

// ?testscene=1 → çatıyı tek başına sınamak için kutular + t ile dönen "araçlar" + rng ile yanan pencereler.
function testScene(ctx) {
  const g = new THREE.Group(); g.name = 'testscene';
  const r = ctx.rng('testscene');
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const lit = [];
  for (let i = 0; i < 140; i++) {
    const x = (r() - 0.5) * 1200, z = (r() - 0.5) * 1200, hgt = 10 + r() ** 3 * 160;
    if (Math.hypot(x, z) < 70) continue;
    const k = r();
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.1, 0.45 + r() * 0.3), emissive: 0xffc070, emissiveIntensity: 0 });
    const b = new THREE.Mesh(boxGeo, m);
    b.scale.set(20 + r() * 30, hgt, 20 + r() * 30);
    b.position.set(x, ctx.heightAt(x, z) + hgt / 2, z);
    b.castShadow = b.receiveShadow = true;
    g.add(b); lit.push({ m, k });
  }
  const cars = [];
  for (let i = 0; i < 24; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 9), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff3020, emissiveIntensity: 0 }));
    c.castShadow = true; g.add(c); cars.push({ c, ph: r() * Math.PI * 2, sp: 0.04 + r() * 0.05 });
  }
  scene.add(g);
  return {
    update(s) {
      for (const { m, k } of lit) m.emissiveIntensity = s.lightsOn > k ? 0.12 : 0;
      for (const { c, ph, sp } of cars) {
        const a = ph + s.t * sp, R = 120;
        c.position.set(Math.cos(a) * R, ctx.heightAt(Math.cos(a) * R, Math.sin(a) * R) + 1, Math.sin(a) * R);
        c.rotation.y = -a; c.material.emissiveIntensity = 3 * s.lightsOn;
      }
    },
  };
}

// edit.js yoksa: meydan çevresinde yavaş yörünge + 16:30 → 21:30 tod süpürmesi.
const placeholderEdit = {
  DURATION: 36,
  placeholder: true,
  shotAt(t) {
    const u = Math.min(1, Math.max(0, t / 36)), e = u * u * (3 - 2 * u);
    const ang = 0.9 - 1.5 * e, r = 820 - 320 * e, y = 360 - 190 * e;
    return { position: [Math.sin(ang) * r, y, Math.cos(ang) * r], target: [0, 30 * (1 - e) + 10, 0], fov: 42 - 6 * e,
      tod: 16.5 + 5 * (0.15 * u + 0.85 * e) };
  },
};

// ───────────────────────────── kurulum ─────────────────────────────
let mods = [];          // monte edilmiş sahne modülleri (terrain dahil)
let atmo = null;        // atmosfer modülü (monte edilmişse)
let atmoFallback = null;
let edit = placeholderEdit;
let DURATION = 36;
let editErrors = 0;

function shotAt(t) {
  if (edit !== placeholderEdit) {
    try {
      const s = edit.shotAt(t);
      if (s && s.position?.length === 3 && s.target?.length === 3 && [...s.position, ...s.target].every(Number.isFinite)) return s;
      throw new Error('geçersiz shot: ' + JSON.stringify(s));
    } catch (e) {
      if (editErrors++ === 0) console.error('[main] edit.shotAt() hata — o kare için yer tutucu rota kullanılıyor:\n', e);
    }
  }
  return placeholderEdit.shotAt(t);
}

function applyShot(s) {
  camera.position.set(s.position[0], s.position[1], s.position[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(s.target[0], s.target[1], s.target[2]);
  if (s.roll) camera.rotateZ(s.roll * DEG); // roll derece
  const fov = Number.isFinite(s.fov) ? s.fov : 40;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);
}

/** Tek kare: yalnızca (tod, t)'ye bağlı. */
function drawFrame(tod, t) {
  const state = timeState(tod, t);
  for (const m of mods) callSafe(m, 'update', state);
  if (atmo) callSafe(atmo, 'update', state); else atmoFallback?.update(state);
  let done = false;
  if (atmo && typeof atmo.inst.render === 'function' && atmo.errors < 5) {
    const before = atmo.errors;
    callSafe(atmo, 'render', state);
    done = atmo.errors === before;
  }
  if (!done) renderer.render(scene, camera);
  window.__state = state;
  return state;
}

function resize(w, h, aspect = w / h) {
  renderer.setSize(w, h);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  for (const m of [...mods, atmo].filter(Boolean)) callSafe(m, 'resize', w, h, renderer.getPixelRatio());
  window.dispatchEvent(new CustomEvent('scene-resize', { detail: { width: w, height: h, pixelRatio: renderer.getPixelRatio() } }));
}

async function boot() {
  const shield = RENDER ? installShield() : null;
  shield?.(0);
  const data = await loadData();
  const heightAt = makeHeightAt(data.terrain);
  const ctx = { THREE, scene, camera, renderer, data, heightAt, rng, quality, params, render: RENDER };
  window.__ctx = ctx;

  // Sıralı kurulum: hata izolasyonu ve deterministik sahne sırası için.
  const terrain = await mount('terrain.js', { create: createTerrain }, ctx);
  if (terrain) { mods.push(terrain); ctx.ground = terrain.inst.object3D; }

  const atmoParam = (params.get('atmo') || '').toLowerCase();
  // Varsayılan atmosfer B (CONTRACT §4 Tur 2); yoksa sırayla diğerleri.
  const atmoFiles = /^[a-z0-9_-]{1,16}$/.test(atmoParam) ? [`atmosphere.${atmoParam}.js`] : ['atmosphere.b.js', 'atmosphere.js', 'atmosphere.a.js'];
  const [cityMod, lmMod, editMod] = await Promise.all([tryImport('city.js'), tryImport('landmarks.js'), tryImport('edit.js')]);
  let atmoMod = null, atmoFile = null;
  for (const f of atmoFiles) { atmoMod = await tryImport(f); if (atmoMod) { atmoFile = f; break; } }

  if (params.get('testscene') === '1') {
    const m = await mount('testscene', { create: testScene }, ctx);
    if (m) mods.push(m);
  }
  for (const [file, mod] of [['city.js', cityMod], ['landmarks.js', lmMod]]) {
    const m = await mount(file, mod, ctx);
    if (m) mods.push(m);
  }
  if (atmoMod) atmo = await mount(atmoFile, atmoMod, ctx);
  if (!atmo) { atmoFallback = placeholderAtmosphere(); status.modules['atmosphere (yer tutucu)'] = 'ok'; }

  if (editMod) {
    if (typeof editMod.shotAt === 'function') {
      edit = editMod;
      status.modules['edit.js'] = 'ok';
    } else {
      status.modules['edit.js'] = 'shotAt yok';
      console.error('[main] edit.js: "export function shotAt(t)" yok — yer tutucu rota kullanılıyor');
    }
  }
  window.__instances = { mods, atmo, edit }; // denetim/sınama için
  DURATION = Number.isFinite(edit.DURATION) && edit.DURATION > 0 ? edit.DURATION : 36;
  window.__duration = DURATION;

  await settleLoaders();
  // Isınma: shader'ları derle, farklı ışık durumlarını bir kez çiz.
  try { renderer.compile(scene, camera); } catch (e) { console.warn('[main] compile:', e); }
  for (const t of [0, DURATION * 0.5, DURATION * 0.85, 0]) { shield?.(t); const s = shotAt(t); applyShot(s); drawFrame(s.tod, t); }
  await settleLoaders();
  console.info('[main] hazır', JSON.stringify(status));
  return { shield };
}

// ───────────────────────────── render modu ─────────────────────────────
if (RENDER) {
  window.__duration = 36;
  let shield = null;
  window.__ready = boot().then((r) => { shield = r.shield; return true; }).catch((e) => { fatal('kurulum başarısız: ' + (e?.message || e)); throw e; });
  window.__renderFrame = async (t) => {
    await window.__ready;
    t = Number(t);
    if (!Number.isFinite(t)) throw new Error('__renderFrame: t sayı olmalı');
    shield(t);
    const s = shotAt(t);
    applyShot(s);
    drawFrame(Number.isFinite(s.tod) ? s.tod : 16.5, t);
    if (loadersPending > 0) { await settleLoaders(); shield(t); applyShot(s); drawFrame(s.tod, t); }
    renderer.getContext().finish();
    await new Promise((r) => requestAnimationFrame(() => r())); // kompozitöre sunulsun
    return { t, tod: s.tod };
  };
  // Sabit kadraj (shots.mjs / denetçiler): { position, target, fov?, roll?, tod, t? }
  window.__renderView = async (view) => {
    await window.__ready;
    const t = Number.isFinite(view.t) ? view.t : 0;
    shield(t);
    applyShot(view);
    drawFrame(view.tod, t);
    if (loadersPending > 0) { await settleLoaders(); shield(t); applyShot(view); drawFrame(view.tod, t); }
    renderer.getContext().finish();
    await new Promise((r) => requestAnimationFrame(() => r()));
    return true;
  };
} else {
  window.__ready = boot().then(() => { startFreeMode(); return true; })
    .catch((e) => { fatal('kurulum başarısız: ' + (e?.message || e)); });
}

// ───────────────────────────── serbest mod ─────────────────────────────
function startFreeMode() {
  const $ = (id) => document.getElementById(id);
  const ui = $('ui'), slider = $('tod'), clock = $('clock'), phase = $('phase');
  const btnPlay = $('play'), btnPrev = $('preview'), bar = $('preview-bar');
  $('loading').classList.add('done');
  document.body.classList.add('ready');

  // Açılış: altın saatte doğudan kulelere (Trump Towers) ve gün batımına bakış.
  // Dar (dikey) ekranda biraz geri çekil ki kuleler kadraja sığsın.
  const narrow = innerWidth / innerHeight < 0.8;
  camera.position.set(...(narrow ? [520, 190, 330] : [420, 160, 260]));
  camera.fov = narrow ? 50 : 45; camera.updateProjectionMatrix();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(20, 80, -190);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false; // kaydırma yatay düzlemde
  controls.maxPolarAngle = 86 * DEG; controls.minDistance = 25; controls.maxDistance = 2600;
  controls.zoomToCursor = true;
  controls.update();
  // Kamera yerin altına ya da sahnenin çok dışına kaçmasın.
  const LIM = 1400, ctxH = window.__ctx.heightAt;
  function clampView() {
    const tg = controls.target;
    tg.x = Math.min(LIM, Math.max(-LIM, tg.x)); tg.z = Math.min(LIM, Math.max(-LIM, tg.z));
    tg.y = Math.min(400, Math.max(ctxH(tg.x, tg.z), tg.y));
    const c = camera.position;
    const R = LIM + 1200;
    c.x = Math.min(R, Math.max(-R, c.x)); c.z = Math.min(R, Math.max(-R, c.z));
    const floor = ctxH(c.x, c.z) + 6;
    if (c.y < floor) c.y = floor;
    if (c.y > 2600) c.y = 2600;
  }

  const startTod = parseFloat(params.get('tod'));
  let tod = Number.isFinite(startTod) ? Math.min(24, Math.max(0, startTod)) : 18.9;
  slider.min = String(Math.min(6, tod));
  slider.value = String(tod);
  let playing = false, playDir = 1;
  let previewing = false, pt = 0, saved = null;
  const PLAY_FROM = 15.5, PLAY_TO = 22.5, PLAY_SPEED = 7 / 22; // saat/sn → ~22 sn tek yön

  slider.addEventListener('input', () => { tod = parseFloat(slider.value); if (playing) togglePlay(false); });
  function togglePlay(on = !playing) {
    playing = on;
    btnPlay.classList.toggle('on', on);
    btnPlay.querySelector('span').textContent = on ? 'Durdur' : 'Oynat';
    btnPlay.querySelector('svg').innerHTML = on ? '<path d="M2 1h3v10H2zM7 1h3v10H7z"/>' : '<path d="M2 1l9 5-9 5z"/>';
    if (on && (tod >= PLAY_TO - 0.01)) playDir = -1; else if (on && tod <= PLAY_FROM) playDir = 1;
  }
  btnPlay.addEventListener('click', () => { if (previewing) togglePreview(false); togglePlay(); });

  function fitPreview() {
    let h = innerHeight, w = Math.round(h * 9 / 16);
    if (w > innerWidth) { w = innerWidth; h = Math.round(w * 16 / 9); }
    resize(w, h, 9 / 16);
  }
  function togglePreview(on = !previewing) {
    previewing = on;
    btnPrev.classList.toggle('on', on);
    btnPrev.querySelector('span').textContent = on ? 'Önizlemeyi kapat' : 'Videoyu önizle';
    bar.classList.toggle('show', on);
    document.body.classList.toggle('previewing', on);
    if (on) {
      togglePlay(false);
      saved = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, tod };
      controls.enabled = false; pt = 0; fitPreview();
    } else {
      controls.enabled = true;
      if (saved) { camera.position.copy(saved.pos); controls.target.copy(saved.target); camera.fov = saved.fov; tod = saved.tod; slider.value = String(tod); }
      camera.up.set(0, 1, 0);
      resize(innerWidth, innerHeight); controls.update();
    }
  }
  btnPrev.addEventListener('click', () => togglePreview());
  $('preview-close').addEventListener('click', () => togglePreview(false));
  if (edit === placeholderEdit) btnPrev.title = 'edit.js henüz yok — yer tutucu rota önizlenir';

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.code !== 'Space') return;
    if (e.code === 'Space') { e.preventDefault(); if (!previewing) togglePlay(); }
    else if (e.key === 'v' || e.key === 'V') togglePreview();
    else if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden');
    else if (e.key === 'Escape' && previewing) togglePreview(false);
  });
  addEventListener('resize', () => { if (previewing) fitPreview(); else resize(innerWidth, innerHeight); });

  // Durum paneli: yalnızca ?debug=1 ya da bir modül hatalıysa.
  const statusEl = $('status');
  function renderStatus() {
    const entries = Object.entries(status.modules);
    const bad = entries.some(([, v]) => v !== 'ok' && v !== 'yok');
    statusEl.style.display = DEBUG || bad ? 'grid' : 'none';
    if (!(DEBUG || bad)) return;
    statusEl.innerHTML = [...entries.map(([k, v]) => `<div><span class="${v === 'ok' ? 'ok' : v === 'yok' ? '' : 'bad'}">●</span> ${k}: ${v}</div>`),
      `<div>veri: ${Object.entries(status.data).map(([k, v]) => `${k}${v === 'ok' ? '' : ' (yok)'}`).join(', ')}</div>`].join('');
  }
  renderStatus(); setInterval(renderStatus, 2000);

  const t0 = performance.now();
  let last = t0, lastLabel = '';
  const fill = bar.querySelector('.fill'), tc = bar.querySelector('.tc');
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    let state;
    if (previewing) {
      pt += dt;
      if (pt >= DURATION) { togglePreview(false); return; }
      const s = shotAt(pt);
      applyShot(s);
      tod = s.tod;
      slider.value = String(tod);
      state = drawFrame(tod, pt);
      fill.style.width = `${(100 * pt / DURATION).toFixed(2)}%`;
      tc.textContent = `${pt.toFixed(1)} / ${DURATION} sn`;
    } else {
      if (playing) {
        tod += playDir * PLAY_SPEED * dt;
        if (tod >= PLAY_TO) { tod = PLAY_TO; playDir = -1; } else if (tod <= PLAY_FROM) { tod = PLAY_FROM; playDir = 1; }
        slider.value = String(tod);
      }
      controls.update();
      clampView();
      state = drawFrame(tod, (now - t0) / 1000);
    }
    const label = formatTod(state.tod) + '|' + phaseLabel(state);
    if (label !== lastLabel) { lastLabel = label; clock.textContent = formatTod(state.tod); phase.textContent = phaseLabel(state); }
  }
  requestAnimationFrame(loop);
}
