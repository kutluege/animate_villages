// İSKELET — renderer, sahne, veri, modül yükleme, döngü ve sayfa modları (CONTRACT §5–§7).
//
// Modlar
//   /                         serbest kamera (OrbitControls) + arayüz
//   /?film=1                  kamera rotası gerçek zamanlı (9:16 sahne)
//   /?render=1&w=1080&h=1920  arayüz yok, döngü yok; kareler yalnız aşağıdaki çağrılarla çizilir
//   ortak: ?atmo=a|b (varsayılan a) · ?tod=15.5 (serbest kip başlangıç saati)
//
// Render arayüzü (hepsi, kare ÇİZİLDİKTEN sonra çözülen Promise döndürür)
//   await window.__ready            → { ok, mode, modules:{city,landmarks,atmo,camera}, warnings, fps, duration, frames, width, height }
//   await window.__setFrame(i)      film karesi: t=i/FPS, tod=todAt(t), kamera = kamera modülü.
//                                   __setTod / __setView ile konmuş geçersiz kılmaları SIFIRLAR.
//   await window.__setTod(tod)      t aynı kalır, yalnız saat değişir (null → film saatine dön)
//   await window.__setView({pos:[x,y,z], target:[x,y,z], fov})   kamerayı sabitler (null → kamera modülüne dön)
//   window.__capture()              tuvalin PNG data-URL'i (page.screenshot'a alternatif; ek)
//
// Modül sözleşmesi: create(ctx) → { update(state), render?(state), resize?(w,h) }
//   Oluşturma sırası: city → landmarks → atmo → camera (sıralı, await'li).
//   Kare sırası: uniforms → kamera → city.update → landmarks.update → atmo.update → çizim.
//   Dokular/modeller create() içinde await edilmeli; yoksa ilk kareler eksik çıkar.
//
// Determinizm: render kipinde zaman YALNIZ __setFrame'den gelir (dt = 1/FPS sabit).
// Serbest/film kipinde saat requestAnimationFrame zaman damgasından ilerler — bu yalnız iskelette.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FPS, DURATION, todAt, stateAt, clamp } from './timeline.js';
import { makeRng } from './rng.js';
import { loadData, makeGeo, makeHeightAt } from './geo.js';

// Var olan modüller derleme anında bulunur; olmayan klasör hata değil, yalnızca uyarıdır.
const MODULES = import.meta.glob([
  '../city/index.js',
  '../landmarks/index.js',
  '../camera/index.js',
  '../atmo/*/index.js',
]);

const q = new URLSearchParams(location.search);
const flag = (k) => q.has(k) && q.get(k) !== '0' && q.get(k) !== 'false';
const num = (k, d) => {
  const v = parseFloat(q.get(k));
  return Number.isFinite(v) ? v : d;
};

const RENDER = flag('render');
const params = {
  mode: RENDER ? 'render' : flag('film') ? 'film' : 'free',
  render: RENDER,
  film: flag('film'),
  atmo: q.get('atmo') === 'b' ? 'b' : 'a',
  width: Math.max(16, Math.round(num('w', 1080))),
  height: Math.max(16, Math.round(num('h', 1920))),
  fps: FPS,
  duration: DURATION,
  query: Object.fromEntries(q),
};

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`[iskelet] ${msg}`);
};

// ---- renderer / sahne ----------------------------------------------------------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: RENDER, // ekran görüntüsü / toDataURL her an geçerli olsun
});
renderer.setClearColor(0x07090d, 1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 9 / 16, 2, 20000);
camera.position.set(-520, 420, 720);
camera.lookAt(0, 40, 0);

const uniforms = {
  uTime: { value: 0 },
  uTod: { value: 15 },
  uNight: { value: 0 },
  uLit: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
};

const size = { width: 1, height: 1 };
const mods = { city: null, landmarks: null, atmo: null, camera: null };

// ---- zaman / kip durumu --------------------------------------------------------------
let filming = params.mode !== 'free'; // kamera modülü mü sürüyor?
let tFree = 0; // serbest kipte akan sahne zamanı (trafik vb.)
let tFilm = 0;
let freeTod = clamp(num('tod', 15), 0, 24);
let todTween = null; // { from, to, u }
let todOverride = null; // __setTod
let viewOverride = null; // __setView
let manual = RENDER; // true → rAF döngüsü çizmez
let frameT = 0; // render kipindeki geçerli t
let controls = null;
let ui = null;
let lastState = null;
const failed = new Set();

function layout() {
  let w;
  let h;
  let left = 0;
  if (RENDER) {
    w = params.width;
    h = params.height;
  } else if (filming) {
    h = window.innerHeight;
    w = Math.min(window.innerWidth, Math.round((h * 9) / 16));
    h = Math.min(h, Math.round((w * 16) / 9));
    left = Math.round((window.innerWidth - w) / 2);
  } else {
    w = window.innerWidth;
    h = window.innerHeight;
  }
  w = Math.max(1, w);
  h = Math.max(1, h);
  renderer.setPixelRatio(RENDER ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, true);
  renderer.domElement.style.left = `${left}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  size.width = w;
  size.height = h;
  for (const k of Object.keys(mods)) call(k, 'resize', w, h);
}

function call(name, fn, ...args) {
  const m = mods[name];
  if (!m || typeof m[fn] !== 'function') return false;
  try {
    m[fn](...args);
    return true;
  } catch (err) {
    const key = `${name}.${fn}`;
    if (!failed.has(key)) {
      failed.add(key);
      console.error(`[iskelet] ${key} hata verdi:`, err);
    }
    return false;
  }
}

function applyView(v) {
  if (v.pos) camera.position.fromArray(v.pos);
  if (v.up) camera.up.fromArray(v.up);
  else camera.up.set(0, 1, 0);
  if (v.target) camera.lookAt(v.target[0], v.target[1], v.target[2]);
  if (Number.isFinite(v.fov) && v.fov !== camera.fov) {
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
  }
}

/** Tek kare: durumu kur, modülleri güncelle, çiz. Eşzamanlı. */
function draw(t, tod, dt, film) {
  const state = stateAt(t, tod);
  state.dt = dt;
  state.film = film;

  uniforms.uTime.value = t;
  uniforms.uTod.value = state.tod;
  uniforms.uNight.value = state.night;
  uniforms.uLit.value = state.lit;
  uniforms.uSunDir.value.copy(state.sunDir);

  if (viewOverride) applyView(viewOverride);
  else if (film) call('camera', 'update', state);
  else if (controls) controls.update();
  camera.updateMatrixWorld();

  call('city', 'update', state);
  call('landmarks', 'update', state);
  call('atmo', 'update', state);

  if (!(mods.atmo && typeof mods.atmo.render === 'function' && call('atmo', 'render', state))) {
    renderer.render(scene, camera);
  }
  lastState = state;
  return state;
}

/** Çizilen karenin sunulmasını bekle (rAF; sekme arka plandaysa zaman aşımı). */
function presented() {
  return new Promise((resolve) => {
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(fin);
    setTimeout(fin, 120);
  });
}

function drawManual() {
  const tod = todOverride ?? todAt(frameT);
  // Film karesi mi? Evet → kamera modülü; __setView varsa o kazanır.
  return draw(frameT, tod, 1 / FPS, true);
}

// ---- döngü (serbest / film) ----------------------------------------------------------
let lastTs = null;
function tick(ts) {
  requestAnimationFrame(tick);
  const dt = lastTs === null ? 0 : clamp((ts - lastTs) / 1000, 0, 0.1);
  lastTs = ts;
  if (manual) return;

  let state;
  if (filming) {
    tFilm = Math.min(DURATION, tFilm + dt);
    state = draw(tFilm, todAt(tFilm), dt, true);
    freeTod = state.tod;
  } else {
    tFree += dt;
    if (todTween) {
      todTween.u = Math.min(1, todTween.u + dt / 3.2);
      const e = todTween.u * todTween.u * (3 - 2 * todTween.u);
      freeTod = todTween.from + (todTween.to - todTween.from) * e;
      if (todTween.u >= 1) todTween = null;
    }
    state = draw(tFree, freeTod, dt, false);
  }
  if (ui) ui.sync({ tod: state.tod, night: state.night, filming, progress: tFilm / DURATION });
}

function setFilming(on) {
  filming = on;
  todTween = null;
  if (on) tFilm = 0;
  else {
    // Kamera modülünün bıraktığı yerden serbest kameraya geç.
    camera.up.set(0, 1, 0);
    if (controls) {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      const d = dir.y < -0.05 ? Math.min(3000, (camera.position.y - 20) / -dir.y) : 600;
      controls.target.copy(camera.position).addScaledVector(dir, d);
    }
  }
  if (controls) controls.enabled = !on;
  layout();
}

// ---- kurulum -------------------------------------------------------------------------
async function loadModule(name, path) {
  const loader = MODULES[path];
  if (!loader) {
    warn(`modül yok: ${path.replace('../', 'web/src/')}`);
    return null;
  }
  try {
    const mod = await loader();
    if (typeof mod.create !== 'function') throw new Error('create(ctx) dışa verilmemiş');
    const inst = (await mod.create(ctx)) || {};
    inst.__module = mod;
    return inst;
  } catch (err) {
    console.error(`[iskelet] modül kurulamadı: ${name}`, err);
    warnings.push(`modül kurulamadı: ${name} (${err.message})`);
    return null;
  }
}

let ctx = null;

async function boot() {
  layout();

  const data = await loadData('/data/', warnings);
  warnings.forEach((w) => console.warn(`[iskelet] ${w}`));
  const geo = makeGeo(data.meta);

  ctx = {
    THREE,
    scene,
    camera,
    renderer,
    data,
    heightAt: makeHeightAt(data.terrain),
    rng: makeRng,
    uniforms,
    params,
    // ekler (sözleşme dışı, isteğe bağlı):
    geo, // { lat0, lon0, toLocal(lat,lon)→[x,z], toLatLon(x,z) }
    size, // { width, height } — canlı; değişimde modülün resize(w,h)'i çağrılır
  };

  mods.city = await loadModule('city', '../city/index.js');
  mods.landmarks = await loadModule('landmarks', '../landmarks/index.js');
  mods.atmo = await loadModule(`atmo/${params.atmo}`, `../atmo/${params.atmo}/index.js`);
  mods.camera = await loadModule('camera', '../camera/index.js');

  if (!mods.atmo) {
    // Atmosfer hiç yoksa sahne kapkara kalmasın.
    scene.background = new THREE.Color(0x8fb4dc);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));
  }
  const camDur = mods.camera?.__module?.DURATION;
  if (camDur !== undefined && camDur !== DURATION) warn(`camera DURATION (${camDur}) ≠ timeline DURATION (${DURATION})`);

  if (!RENDER) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 40, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 20;
    controls.maxDistance = 6000;
    controls.enabled = !filming;

    const { createUI } = await import('./ui.js');
    ui = createUI({
      onTod: (tod) => {
        todTween = null;
        freeTod = tod;
      },
      onDayNight: () => {
        const night = lastState ? lastState.night : 0;
        todTween = { from: freeTod, to: night > 0.5 ? 15.0 : 22.5, u: 0 };
      },
      onFilm: () => setFilming(!filming),
    });
    ui.setStatus(warnings);
    window.addEventListener('resize', layout);
  }
  layout();

  // ---- render / denetim arayüzü (her kipte tanımlı; çağrılınca döngü durur) ----------
  const manualDraw = async () => {
    manual = true;
    if (!filming && !RENDER) setFilming(true);
    const s = drawManual();
    await presented();
    return { t: s.t, tod: s.tod, frame: Math.round(s.t * FPS) };
  };
  window.__setFrame = (i) => {
    frameT = (Number(i) || 0) / FPS;
    todOverride = null;
    viewOverride = null;
    return manualDraw();
  };
  window.__setTod = (tod) => {
    todOverride = Number.isFinite(tod) ? tod : null;
    return manualDraw();
  };
  window.__setView = (v) => {
    viewOverride = v || null;
    return manualDraw();
  };
  window.__capture = (type = 'image/png', quality) => renderer.domElement.toDataURL(type, quality);

  if (RENDER) {
    // Isınma: gölgelendiriciler derlensin, ilk gerçek kare tam çıksın.
    drawManual();
    await presented();
    drawManual();
    await presented();
  } else {
    requestAnimationFrame(tick);
  }

  return {
    ok: true,
    mode: params.mode,
    atmo: params.atmo,
    modules: Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, !!v])),
    warnings: warnings.slice(),
    fps: FPS,
    duration: DURATION,
    frames: FPS * DURATION,
    width: size.width,
    height: size.height,
  };
}

boot().then(
  (info) => window.__resolveReady(info),
  (err) => {
    console.error('[iskelet] açılış başarısız:', err);
    window.__resolveReady({ ok: false, error: String(err && err.message ? err.message : err), warnings });
  },
);
