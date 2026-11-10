// Çıkartma atlası: afiş, grafiti, ayak numarası, ikaz şeridi, yön levhası, dükkân tabelası.
// Tek tuval dokusu + tek ağ. Tabelalar gece eşikle ışır (aGlow = θ; <0 → ışımaz).
const N = 8;
const T = 256;

const POSTERS = [
  ['KİRALIK', '#d8261c', '#fff'], ['SATILIK', '#f2c200', '#111'], ['KONSER', '#1b1b1b', '#f5d800'], ['İNDİRİM', '#e8501a', '#fff'],
  ['ÖZEL DERS', '#f4f1e6', '#1a3c8a'], ['NAKLİYAT', '#1f5fae', '#fff'], ['ÇİLİNGİR', '#f4f1e6', '#c21a1a'], ['HALI YIKAMA', '#2b8f5a', '#fff'],
  ['KURS', '#7a2c8f', '#fff'], ['USTA', '#f4f1e6', '#111'], ['TİYATRO', '#b01030', '#f7e9c8'], ['MİTİNG', '#f4f1e6', '#d8261c'],
  ['FESTİVAL', '#12a3a8', '#fff'], ['ELEMAN', '#f2c200', '#c21a1a'], ['SERGİ', '#262626', '#fff'], ['AÇILIŞ', '#e23d7a', '#fff'],
];
const SIGNS = [
  ['Zincirlikuyu', '↑', '#1456a8'], ['Şişli', '→', '#1456a8'], ['Beşiktaş', '↗', '#1456a8'], ['Kağıthane', '←', '#1456a8'],
  ['Mecidiyeköy', '↓', '#1456a8'], ['D-100', '↑', '#1c7a3c'], ['Otogar', '←', '#1c7a3c'], ['Levent', '↑', '#1456a8'],
];
const SHOPS = [
  ['BÜFE', '#d8261c', '#fff'], ['ECZANE', '#fff', '#d8261c'], ['MARKET', '#f2c200', '#c21a1a'], ['DÖNER', '#7a1c12', '#f7d774'],
  ['ÇAY EVİ', '#1f4f2e', '#fff'], ['TEKEL', '#1b2a6b', '#fff'], ['BERBER', '#fff', '#1b2a6b'], ['BÖREK', '#e8a21a', '#3a1a08'],
  ['KUAFÖR', '#c2187a', '#fff'], ['LOKANTA', '#f4f1e6', '#7a1c12'], ['FIRIN', '#8a4a1a', '#fff'], ['TOST', '#f26a1a', '#fff'],
  ['GSM', '#0f8fd0', '#fff'], ['DÖVİZ', '#111', '#3be06a'], ['KIRTASİYE', '#2a6fd0', '#fff'], ['PİDE', '#b01a1a', '#ffe9a8'],
];

export const TILES = {
  hazard: 0,
  num: (k) => 1 + (k % 7),
  poster: (k) => 8 + (k % 16),
  graf: (k) => 24 + (k % 8),
  sign: (k) => 32 + (k % 8),
  shop: (k) => 40 + (k % 16),
  stop: 56, taxi: 57, dolmus: 58, iett: 59,
  ad: (k) => 60 + (k % 4),
};

function paint(ctx) {
  const r = ctx.rng('city/decals');
  const cv = document.createElement('canvas');
  cv.width = cv.height = N * T;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const tile = (i, fn) => {
    c.save();
    c.translate((i % N) * T, Math.floor(i / N) * T);
    c.beginPath();
    c.rect(0, 0, T, T);
    c.clip();
    fn();
    c.restore();
  };
  const text = (s, x, y, px, col, maxW = T - 24) => {
    c.font = `bold ${px}px Arial, Helvetica, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = col;
    c.fillText(s, x, y, maxW);
  };
  const grime = (a) => {
    for (let k = 0; k < 60; k++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '30,28,24' : '120,112,100'},${(a * r()).toFixed(3)})`;
      c.fillRect(r() * T, r() * T, 6 + r() * 60, 2 + r() * 14);
    }
  };

  // 0: sarı-siyah ikaz şeridi
  tile(0, () => {
    c.fillStyle = '#d9b21a';
    c.fillRect(0, 0, T, T);
    c.fillStyle = '#16161a';
    for (let k = -2; k < 8; k++) {
      c.beginPath();
      c.moveTo(k * 64, T);
      c.lineTo(k * 64 + 32, T);
      c.lineTo(k * 64 + 32 + T, 0);
      c.lineTo(k * 64 + T, 0);
      c.fill();
    }
    grime(0.35);
  });
  // 1–7: ayak numaraları (beyaz zemine şablon)
  for (let k = 0; k < 7; k++) {
    tile(1 + k, () => {
      c.fillStyle = '#d9d6cc';
      c.fillRect(8, 56, T - 16, T - 112);
      text(`${'ABCD'[k % 4]}${String(11 + k * 7).padStart(2, '0')}`, T / 2, T / 2 + 4, 110, '#1c1c1e');
      grime(0.25);
    });
  }
  // 8–23: afişler (kimi yırtık)
  POSTERS.forEach(([w, bg, fg], k) => {
    tile(8 + k, () => {
      c.fillStyle = bg;
      c.fillRect(6, 6, T - 12, T - 12);
      c.fillStyle = fg;
      c.globalAlpha = 0.25;
      c.fillRect(22, 24, T - 44, 54);
      c.globalAlpha = 1;
      text(w, T / 2, 104, 58, fg);
      text('0 (212) 000 00 00', T / 2, 170, 24, fg);
      c.fillStyle = fg;
      for (let j = 0; j < 3; j++) c.fillRect(30, 200 + j * 12, 80 + r() * 110, 5);
      grime(0.3);
      if (r() < 0.45) {
        // yırtık köşe
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        const cx = r() < 0.5 ? 0 : T;
        c.moveTo(cx, T);
        c.lineTo(cx, T - 60 - r() * 90);
        c.lineTo(cx + (cx ? -1 : 1) * (50 + r() * 90), T);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    });
  });
  // 24–31: grafiti (saydam zemin)
  const GC = ['#e23d7a', '#19b6c9', '#f2c200', '#f4f1e6', '#7bd13a', '#f26a1a', '#9a5cf0', '#111'];
  for (let k = 0; k < 8; k++) {
    tile(24 + k, () => {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? GC[k] : '#101012';
        c.lineWidth = pass ? 13 : 21;
        const rr = ctx.rng(`city/graf${k}`);
        c.beginPath();
        let x = 26;
        let y = 150 + rr() * 30;
        c.moveTo(x, y);
        for (let j = 0; j < 7; j++) {
          const nx = x + 22 + rr() * 22;
          c.bezierCurveTo(x + rr() * 50 - 10, 40 + rr() * 60, nx - rr() * 40, 200 + rr() * 30, nx, 90 + rr() * 90);
          x = nx;
          y = 0;
        }
        c.stroke();
      }
    });
  }
  // 32–39: yön levhaları
  SIGNS.forEach(([w, ar, bg], k) => {
    tile(32 + k, () => {
      c.fillStyle = '#f4f4f0';
      c.fillRect(2, 62, T - 4, 132);
      c.fillStyle = bg;
      c.fillRect(8, 68, T - 16, 120);
      text(ar, 44, 128, 70, '#fff', 60);
      text(w, 152, 130, 40, '#fff', 170);
    });
  });
  // 40–55: dükkân tabelaları
  SHOPS.forEach(([w, bg, fg], k) => {
    tile(40 + k, () => {
      c.fillStyle = bg;
      c.fillRect(0, 64, T, 128);
      c.strokeStyle = fg;
      c.lineWidth = 5;
      c.strokeRect(8, 72, T - 16, 112);
      text(w, T / 2, 130, 62, fg, T - 40);
    });
  });
  const round = (i, bg, fg, s, px) => tile(i, () => {
    c.fillStyle = '#f4f4f0';
    c.fillRect(20, 20, T - 40, T - 40);
    c.fillStyle = bg;
    c.fillRect(30, 30, T - 60, T - 60);
    text(s, T / 2, T / 2 + 4, px, fg, T - 80);
  });
  round(56, '#1456a8', '#fff', 'D', 150);
  round(57, '#f2c200', '#111', 'TAKSİ', 64);
  round(58, '#f2c200', '#111', 'DOLMUŞ', 52);
  round(59, '#c21a1a', '#fff', 'İETT', 78);
  // 60–63: durak reklam panoları (ışıklı)
  const AD = [['#0e2a4f', '#ffd23a', 'YAZ', 'İNDİRİMİ'], ['#f4f1e6', '#c21a1a', 'YENİ', 'SEZON'], ['#12312a', '#e8f5d0', 'İSTANBUL', 'GECE'], ['#f26a1a', '#fff', '%50', 'FIRSAT']];
  AD.forEach(([bg, fg, a, b], k) => tile(60 + k, () => {
    c.fillStyle = bg;
    c.fillRect(0, 0, T, T);
    c.fillStyle = fg;
    c.globalAlpha = 0.18;
    c.beginPath();
    c.arc(T * 0.7, T * 0.35, 90, 0, 7);
    c.fill();
    c.globalAlpha = 1;
    text(a, T / 2, 96, 74, fg);
    text(b, T / 2, 176, 46, fg);
  }));
  return cv;
}

export function createDecals(ctx) {
  const { THREE, renderer } = ctx;
  const pos = [];
  const nrm = [];
  const uv = [];
  const glow = [];
  const idx = [];
  let n = 0;
  /**
   * tile: karo no · c: merkez · U, V: yarı kenar vektörleri (sağ, yukarı) · nr: normal
   * glowTh: <0 ışımaz; ≥0 → uLit eşiği · both: arka yüzü de çiz
   */
  const add = (tile, c, U, V, nr, glowTh = -1, both = false) => {
    const col = tile % N;
    const row = Math.floor(tile / N);
    const p = 3 / T;
    const u0 = col / N + p / N * 2;
    const u1 = (col + 1) / N - p / N * 2;
    const v0 = row / N + p / N * 2;
    const v1 = (row + 1) / N - p / N * 2;
    const o = 0.025;
    const P = (su, sv) => [c[0] + U[0] * su + V[0] * sv + nr[0] * o, c[1] + U[1] * su + V[1] * sv + nr[1] * o, c[2] + U[2] * su + V[2] * sv + nr[2] * o];
    const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
    const uvs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
    for (let k = 0; k < 4; k++) {
      pos.push(q[k][0], q[k][1], q[k][2]);
      nrm.push(nr[0], nr[1], nr[2]);
      uv.push(uvs[k][0], uvs[k][1]);
      glow.push(glowTh);
    }
    // (U × V) · n > 0 ise sıra saat yönünün tersine
    const cx = U[1] * V[2] - U[2] * V[1];
    const cy = U[2] * V[0] - U[0] * V[2];
    const cz = U[0] * V[1] - U[1] * V[0];
    if (cx * nr[0] + cy * nr[1] + cz * nr[2] > 0) idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    else idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    n += 4;
    if (both) add(tile, c, [-U[0], -U[1], -U[2]], V, [-nr[0], -nr[1], -nr[2]], glowTh, false);
  };

  const finish = (group) => {
    if (!n) return null;
    const tex = new THREE.CanvasTexture(paint(ctx));
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
    g.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.8, metalness: 0, envMapIntensity: 0.4 });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -4;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uLit = ctx.uniforms.uLit;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow; uniform float uLit;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (vGlow >= 0.0) totalEmissiveRadiance += diffuseColor.rgb * (0.06 + 2.4 * smoothstep(vGlow, vGlow + 0.03, uLit));`,
        );
    };
    mat.customProgramCacheKey = () => 'city-decal-v1';
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'city-decals';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };

  return { add, finish, get count() { return n / 4; } };
}
