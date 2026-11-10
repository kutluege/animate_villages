// IŞIK VE ATMOSFER — B yorumu: "stilize, grafik, sinematik".
// Gök, güneş/ay, sis, ışıklar, gölge, scene.environment, ton eşleme ve post burada.
// Her şey state.tod'un (→ güneş yüksekliği) saf fonksiyonu; birikimli durum yok.
//
//   palette.js  güneş yüksekliği → tüm renk/şiddet/post değerleri (anahtar kareler)
//   sky.js      stilize gök GLSL'i (kubbe + environment + sis rengi ortak)
//   post.js     HDR sahne → yükseklik sisi → bloom → anamorfik şerit → renk kararı
import { paletteAt, moonK, MOON_DIR, MOON_COLOR, MOON_INTENSITY, smooth } from './palette.js';
import { makeSkyUniforms, makeSkyDome } from './sky.js';
import { createPost } from './post.js';

const SHADOW_MAP = 4096;
// Gölgenin kapsadığı dünya kutusu (çekirdek + pay).
const BOX_MIN = [-950, -110, -950];
const BOX_MAX = [950, 210, 950];

export async function create(ctx) {
  const { THREE, scene, camera, renderer } = ctx;
  const FPS = ctx.params?.fps || 30;

  // Ton eşleme post'un son geçişinde; three'ninki kapalı (render hedefinde zaten uygulanmaz).
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene.background = null;
  scene.fog = null; // sis post'ta (derinlikten); malzeme sisi çifte sayım olurdu

  // ---- gök ---------------------------------------------------------------------------
  const skyU = makeSkyUniforms();
  const dome = makeSkyDome(skyU, false);
  dome.renderOrder = 10000; // opakların sonunda: erken-z ile ucuz
  scene.add(dome);

  // environment: aynı gök, sabit bulut zamanı (kare sırasından bağımsız olsun)
  const envU = { ...skyU, uSkyTime: { value: 0 } };
  const envScene = new THREE.Scene();
  envScene.add(makeSkyDome(envU, true));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  let envKey = null;

  // ---- ışıklar -----------------------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.name = 'atmo-b-sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.radius = 1.6;
  sun.shadow.bias = -0.00012;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  hemi.name = 'atmo-b-hemi';
  scene.add(sun, sun.target, hemi);

  // Kimse castShadow kurmadıysa (yer tutucu modüller) gölge görülebilsin diye yedek.
  let anyCaster = false;
  scene.traverse((o) => {
    if (o.isMesh && o.castShadow) anyCaster = true;
  });
  if (!anyCaster) {
    console.warn('[atmo/b] sahnede castShadow kuran ağ yok — opak ağlarda geçici olarak açılıyor');
    scene.traverse((o) => {
      if (o.isMesh && o !== dome && o.material && !o.material.transparent) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // ---- post --------------------------------------------------------------------------
  const post = createPost(renderer, skyU);
  const buf = new THREE.Vector2();
  const syncSize = () => {
    renderer.getDrawingBufferSize(buf);
    post.setSize(buf.x, buf.y);
  };
  syncSize();

  // ---- gölge kadrajı: (kamera kesik piramidi ∩ dünya kutusu)'nun ışık uzayındaki sınırı --
  const vX = new THREE.Vector3();
  const vY = new THREE.Vector3();
  const vZ = new THREE.Vector3();
  const vP = new THREE.Vector3();
  const vD = new THREE.Vector3();
  const vO = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const RANGE = 2600;
  const GRID = 8;

  function fitShadow(dir) {
    vZ.copy(dir).normalize();
    vX.crossVectors(UP, vZ).normalize();
    vY.crossVectors(vZ, vX);

    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let n = 0;
    const add = (p) => {
      const x = p.dot(vX);
      const y = p.dot(vY);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      n++;
    };

    vO.setFromMatrixPosition(camera.matrixWorld);
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) {
        vD.set((i / GRID) * 2 - 1, (j / GRID) * 2 - 1, 0.5).unproject(camera).sub(vO).normalize();
        let t0 = 0;
        let t1 = RANGE;
        for (let a = 0; a < 3; a++) {
          const o = vO.getComponent(a);
          const d = vD.getComponent(a);
          if (Math.abs(d) < 1e-9) {
            if (o < BOX_MIN[a] || o > BOX_MAX[a]) t1 = -1;
          } else {
            let ta = (BOX_MIN[a] - o) / d;
            let tb = (BOX_MAX[a] - o) / d;
            if (ta > tb) [ta, tb] = [tb, ta];
            if (ta > t0) t0 = ta;
            if (tb < t1) t1 = tb;
          }
        }
        if (t1 > t0) {
          add(vP.copy(vO).addScaledVector(vD, t0));
          add(vP.copy(vO).addScaledVector(vD, t1));
        }
      }
    }

    // kutunun ışık uzayı sınırları (derinlik aralığı + üst sınır)
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < 8; k++) {
      vP.set(k & 1 ? BOX_MAX[0] : BOX_MIN[0], k & 2 ? BOX_MAX[1] : BOX_MIN[1], k & 4 ? BOX_MAX[2] : BOX_MIN[2]);
      const x = vP.dot(vX);
      const y = vP.dot(vY);
      const z = vP.dot(vZ);
      bx0 = Math.min(bx0, x);
      bx1 = Math.max(bx1, x);
      by0 = Math.min(by0, y);
      by1 = Math.max(by1, y);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    if (n < 4) {
      x0 = bx0;
      x1 = bx1;
      y0 = by0;
      y1 = by1;
    }
    const padX = (x1 - x0) * 0.05 + 12;
    const padY = (y1 - y0) * 0.05 + 12;
    x0 = Math.max(bx0, x0 - padX);
    x1 = Math.min(bx1, x1 + padX);
    y0 = Math.max(by0, y0 - padY);
    y1 = Math.min(by1, y1 + padY);
    let hw = Math.max(40, (x1 - x0) / 2);
    let hh = Math.max(40, (y1 - y0) / 2);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    const cam = sun.shadow.camera;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    cam.near = 1;
    cam.far = z1 - z0 + 60;
    cam.updateProjectionMatrix();
    sun.position.set(0, 0, 0).addScaledVector(vX, cx).addScaledVector(vY, cy).addScaledVector(vZ, z1 + 30);
    sun.target.position.copy(sun.position).addScaledVector(vZ, -100);
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    const texel = (2 * Math.max(hw, hh)) / SHADOW_MAP;
    sun.shadow.normalBias = 0.25 + texel * 1.6;
  }

  // ---- kare --------------------------------------------------------------------------
  const P = paletteAt(40);
  const moonDir = new THREE.Vector3().fromArray(MOON_DIR).normalize();
  const set3 = (u, a) => u.value.set(a[0], a[1], a[2]);

  function update(state) {
    const e = (state.sunElev * 180) / Math.PI;
    paletteAt(e, P);
    const mk = moonK(e);
    // güneş ufka inerken yön ışığı söner (ufuk altından aydınlatma olmasın)
    const sunK = P.sunI * smooth(-0.8, 1.6, e);

    // gök
    skyU.uSunDir.value.copy(state.sunDir).normalize();
    skyU.uMoonDir.value.copy(moonDir);
    set3(skyU.cZen, P.zen);
    set3(skyU.cMid, P.mid);
    set3(skyU.cMidSun, P.midSun);
    set3(skyU.cHor, P.hor);
    set3(skyU.cHorSun, P.horSun);
    set3(skyU.cGlow, P.glow);
    set3(skyU.cDisc, P.disc);
    set3(skyU.cCloudLit, P.cloudLit);
    set3(skyU.cCloudDark, P.cloudDark);
    skyU.uGlowPow.value = P.glowPow;
    skyU.uDiscR.value = P.discR;
    skyU.uCloudCov.value = P.cloudCov;
    skyU.uCloudOp.value = P.cloudOp;
    skyU.uStars.value = smooth(-5, -13, e);
    skyU.uMoonK.value = mk;
    skyU.uSkyTime.value = state.t;

    // ışıklar: tek yön ışığı — güneş sönünce (ikisi de sıfırken) aya geçer
    let dir;
    if (sunK > 0) {
      dir = state.sunDir;
      sun.color.setRGB(P.sun[0], P.sun[1], P.sun[2]);
      sun.intensity = sunK;
    } else {
      dir = moonDir;
      sun.color.setRGB(MOON_COLOR[0], MOON_COLOR[1], MOON_COLOR[2]);
      sun.intensity = MOON_INTENSITY * mk;
    }
    sun.castShadow = sun.intensity > 0;
    sun.visible = sun.intensity > 0;
    hemi.color.setRGB(P.hemiSky[0], P.hemiSky[1], P.hemiSky[2]);
    hemi.groundColor.setRGB(P.hemiGnd[0], P.hemiGnd[1], P.hemiGnd[2]);
    hemi.intensity = P.hemiI;
    fitShadow(dir);

    // environment (cam yansıması): yalnız saat değişince
    if (envKey !== state.tod) {
      envKey = state.tod;
      const prevRT = renderer.getRenderTarget();
      const next = pmrem.fromScene(envScene, 0, 0.1, 10);
      renderer.setRenderTarget(prevRT);
      scene.environment = next.texture;
      if (envRT) envRT.dispose();
      envRT = next;
    }
    scene.environmentIntensity = P.envI;

    // post
    const f = post.fogU;
    f.uFogK.value = P.fogK;
    f.uFogR.value = P.fogR;
    f.uFogLow.value = P.fogLow;
    f.uFogY0.value = -30;
    f.uFogH.value = 40;
    set3(f.uFogTint, P.fogTint);
    f.uExposure.value = P.exposure;
    post.bloom.strength = P.bloomS;
    post.bloom.threshold = P.bloomT;
    post.bloom.radius = P.bloomR;
    const g = post.finalU;
    g.uStreak.value = P.streak;
    g.uSplit.value = P.split;
    g.uSat.value = P.sat;
    g.uCon.value = P.con;
    g.uVig.value = P.vig;
    g.uNightK.value = smooth(2, -12, e);
    g.uSeed.value = Math.round(state.t * FPS) % 4096;
  }

  return {
    update,
    render(state) {
      void state;
      syncSize();
      post.render(scene, camera);
    },
    resize(w, h) {
      void w;
      void h;
      syncSize();
    },
  };
}
