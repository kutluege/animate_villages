// ATMO A — "sıcak, nemli, gerçek İstanbul" (belgesel/doğalcı yorum).
// Arayüz: create(ctx) → { update(state), render(state), resize(w,h) }  (CONTRACT §5)
//
// Her şey tek girdiden türetilir: güneş yüksekliği (state.sunElev ← tod) + state.t (bulut kayması,
// gren tohumu). Birikimli durum yok → aynı kare, aynı piksel.
//
// Katmanlar
//   palette.js  güneş yüksekliğine anahtarlı renk/şiddet tablosu
//   sky.js      gök kubbesi (pus bandı, Mie parlaması, bulut, güneş diski, ay) + env çeşidi
//   post.js     derinlikten hava perspektifi (sis rengi = o yöndeki ufuk rengi), bloom, film eğrisi, gren
//   burada      güneş (gölgeli), başucu gök ışığı (gölgeli → viyadük altı gerçekten koyulaşır),
//               yarıküre dolgusu, ay ışığı, scene.environment (PMREM)
//
// Diğer modüller için notlar
//   * scene.fog KULLANILMIYOR (null): pus post'ta derinlikten uygulanır; özel shader'ların sis
//     desteğine gerek yok. Derinlik yazmayan saydam/toplamalı nesneler arkalarındaki yüzeyin pusunu alır.
//   * Gölge: castShadow/receiveShadow ikisi de false bırakılmış opak Mesh'lere bu modül ikisini de açar
//     (istemeyen `mesh.userData.noShadow = true` koyar).
//   * scene.environmentIntensity = ENV_K; cam için material.envMapIntensity ile ölçeklenebilir.
import { makePalette, samplePalette } from './palette.js';
import { makeSkyUniforms, makeSkyDome } from './sky.js';
import { makePost } from './post.js';

const ENV_K = 0.42; // env'in dağınık/aynasal katkısı (kalan ortam ışığı gölgeli başucu ışığından gelir)
const SKY_LIGHT_K = 1.7; // başucu gök ışığı = amb × bu
const HEMI_SKY_K = 0.4;
const HEMI_GND_K = 1.5;

export async function create(ctx) {
  const { THREE, scene, renderer, data, params } = ctx;
  const RENDER = !!(params && params.render);

  renderer.toneMapping = THREE.NoToneMapping; // film eğrisi post'ta
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene.background = null;
  scene.fog = null;
  scene.environmentIntensity = ENV_K;

  const pal = makePalette();
  const skyU = makeSkyUniforms(THREE);

  // ---- gök ----------------------------------------------------------------------------
  const dome = makeSkyDome(THREE, skyU, false);
  scene.add(dome);
  const envScene = new THREE.Scene();
  envScene.add(makeSkyDome(THREE, skyU, true));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  let envKey = null;

  // Uzak zemin: veri sınırının ötesi boşluk kalmasın; pus içinde ufka erir.
  const far = new THREE.Mesh(
    new THREE.CircleGeometry(16000, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 1, metalness: 0 }),
  );
  far.name = 'atmo-a-far-ground';
  far.position.y = -114;
  far.userData.noShadow = true;
  far.receiveShadow = false;
  scene.add(far);

  // ---- ışıklar ------------------------------------------------------------------------
  const maxTex = renderer.capabilities.maxTextureSize || 4096;
  const sunMap = Math.min(maxTex, RENDER ? 8192 : 4096);
  const skyMap = Math.min(maxTex, RENDER ? 4096 : 2048);

  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.name = 'atmo-a-sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(sunMap, sunMap);
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.45;
  sun.shadow.radius = 1.6;

  // Başucundan gelen gök ışığı: gölgeli olduğu için köprü/saçak altı gerçekten kararır.
  const skyLight = new THREE.DirectionalLight(0xffffff, 1);
  skyLight.name = 'atmo-a-skylight';
  skyLight.castShadow = true;
  skyLight.shadow.mapSize.set(skyMap, skyMap);
  skyLight.shadow.bias = -0.0002;
  skyLight.shadow.normalBias = 0.9;
  skyLight.shadow.radius = 5;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemi.name = 'atmo-a-hemi';

  // (Gün batımı sonrası ayrı bir yön ışığı YOK: camda sahte parlama yapıyordu; o ışık env'den gelir.)
  // Ay / gece göğünün yönlü bileşeni.
  const moon = new THREE.DirectionalLight(0xffffff, 0);
  moon.name = 'atmo-a-moon';

  scene.add(sun, sun.target, skyLight, skyLight.target, hemi, moon, moon.target);

  // ---- gölge kutusu: sahne AABB'si ışık uzayına oturtulur --------------------------------
  const core = (data && data.meta && data.meta.core) || null;
  const cb = Array.isArray(core) ? null : core;
  const bx0 = (cb && Number.isFinite(cb.xmin) ? cb.xmin : -650) - 130;
  const bx1 = (cb && Number.isFinite(cb.xmax) ? cb.xmax : 700) + 130;
  const bz0 = (cb && Number.isFinite(cb.zmin) ? cb.zmin : -570) - 130;
  const bz1 = (cb && Number.isFinite(cb.zmax) ? cb.zmax : 765) + 130;
  const by0 = -75;
  const by1 = 235;
  const center = new THREE.Vector3((bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2);
  const corners = [];
  for (const x of [bx0, bx1]) for (const y of [by0, by1]) for (const z of [bz0, bz1]) corners.push(new THREE.Vector3(x, y, z));
  const _m = new THREE.Matrix4();
  const _mi = new THREE.Matrix4();
  const _v = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();

  function fitShadow(light, dir) {
    const D = 4000;
    light.position.copy(center).addScaledVector(dir, D);
    light.target.position.copy(center);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    _m.lookAt(light.position, center, _up);
    _m.setPosition(light.position);
    _mi.copy(_m).invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of corners) {
      _v.copy(c).applyMatrix4(_mi);
      x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x);
      y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
      z0 = Math.min(z0, _v.z); z1 = Math.max(z1, _v.z);
    }
    const cam = light.shadow.camera;
    cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1;
    cam.near = Math.max(1, -z1 - 20);
    cam.far = -z0 + 20;
    cam.updateProjectionMatrix();
  }

  const SKY_DIR = new THREE.Vector3(0.1, 1, 0.07).normalize();
  fitShadow(skyLight, SKY_DIR);

  // ---- başkalarının opak mesh'lerine gölge (yalnız hiç ayarlanmamışsa) --------------------
  let adoptedCount = -1;
  function adoptShadows() {
    let n = 0;
    scene.traverse(() => n++);
    if (n === adoptedCount) return;
    adoptedCount = n;
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.noShadow || o.userData.__atmoShadow) return;
      if (o.castShadow || o.receiveShadow) return; // sahibi ayarlamış
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const opaque = mats.every(
        (m) => m && !m.transparent && m.depthWrite !== false && m.blending === THREE.NormalBlending && m.visible !== false,
      );
      if (!opaque) return;
      const lit = mats.every((m) => m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial);
      o.userData.__atmoShadow = true;
      o.receiveShadow = lit;
      o.castShadow = lit;
      if (lit) mats.forEach((m) => (m.needsUpdate = true));
    });
  }

  // ---- post ---------------------------------------------------------------------------
  const post = makePost(ctx, skyU);

  let lastP = { fog: 0.0006, exp: 1, bloom: 0.2, seed: 0 };

  function updateEnv(state) {
    // Render kipinde her kare (geçmişe bağlı olmasın). Serbest kipte yalnız gerektiğinde.
    if (!RENDER && envRT && envKey && Math.abs(envKey.tod - state.tod) < 0.004 && Math.abs(envKey.t - state.t) < 1.5) return;
    const prevTarget = renderer.getRenderTarget();
    const rt = pmrem.fromScene(envScene, 0, 1, 100);
    renderer.setRenderTarget(prevTarget);
    scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt;
    envKey = { tod: state.tod, t: state.t };
  }

  function update(state) {
    adoptShadows();
    const elevDeg = (state.sunElev * 180) / Math.PI;
    samplePalette(elevDeg, pal);

    // gök uniformları
    skyU.uZen.value.fromArray(pal.zen);
    skyU.uHor.value.fromArray(pal.hor);
    skyU.uHorS.value.fromArray(pal.horS);
    skyU.uBand.value.fromArray(pal.band);
    skyU.uBandS.value.fromArray(pal.bandS);
    skyU.uGlow.value.fromArray(pal.glow);
    skyU.uCloudLit.value.fromArray(pal.cLit);
    skyU.uCloudDark.value.fromArray(pal.cDark);
    skyU.uSunCol.value.fromArray(pal.sun);
    skyU.uGnd.value.fromArray(pal.gnd);
    skyU.uSunDir.value.copy(state.sunDir).normalize();
    const hl = Math.hypot(state.sunDir.x, state.sunDir.z) || 1;
    skyU.uSunAz.value.set(state.sunDir.x / hl, state.sunDir.z / hl);
    skyU.uAzPow.value = pal.azp;
    skyU.uDisc.value = pal.disc;
    skyU.uMoon.value = pal.moon;
    skyU.uStars.value = pal.stars;
    skyU.uWind.value.set(1.7 + state.t * 0.016, 4.2 + state.t * 0.006);

    // güneş
    sun.color.fromArray(pal.sun);
    sun.intensity = pal.sunI;
    if (pal.sunI > 1e-4) {
      // Ufka çok yakınken gölge kutusu dejenere olmasın: gölge yönü en az −4°'de tutulur.
      _dir.copy(state.sunDir);
      const minY = Math.sin((-4 * Math.PI) / 180);
      if (_dir.y < minY) _dir.y = minY;
      _dir.normalize();
      fitShadow(sun, _dir);
      sun.shadow.autoUpdate = true;
    } else {
      sun.shadow.autoUpdate = false; // şiddet 0: bayat harita görünmez, kare maliyeti düşer
    }

    // gök ışığı + yarıküre
    skyLight.color.fromArray(pal.amb);
    skyLight.intensity = SKY_LIGHT_K;
    hemi.color.fromArray(pal.amb).multiplyScalar(HEMI_SKY_K);
    hemi.groundColor.fromArray(pal.gnd).multiplyScalar(HEMI_GND_K);
    hemi.intensity = 1;

    // ay
    moon.color.setRGB(0.55, 0.62, 0.85);
    moon.intensity = 0.05 * pal.moon;
    moon.position.copy(skyU.uMoonDir.value).multiplyScalar(3000);

    updateEnv(state);

    lastP = {
      fog: pal.fog,
      exp: pal.exp,
      bloom: pal.bloom,
      seed: Math.round(state.t * 30) % 4096,
    };
  }

  return {
    update,
    render() {
      post.render(lastP);
    },
    resize() {
      post.setSize();
    },
    // hata ayıklama / ince ayar için (sözleşme dışı)
    debug: { pal, skyU, sun, skyLight, hemi, post },
  };
}
