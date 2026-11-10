// Tohumlu, deterministik rastgelelik. Math.random YOK.
//
//   const r = ctx.rng('city/windows');   // aynı isim → her zaman aynı dizi
//   r()            → [0,1)
//   r.range(a,b)   → [a,b)
//   r.int(n)       → 0..n-1
//   r.pick(arr)    → eleman
//   r.sign()       → −1 | +1
//   r.gauss()      → ~N(0,1)
//   r.fork('alt')  → bağımsız alt üreteç (çağrı sırasından etkilenmez)
//
// Sıra bağımsız, durumsuz karma gerekiyorsa (ör. bina id'sinden eşik θ):
//   hash01('pencere', id, kat, sütun) → [0,1)

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GLOBAL_SEED = 'mecidiyekoy-2026';

export function makeRng(seed = '') {
  const key = `${GLOBAL_SEED}/${seed}`;
  const next = mulberry32(xmur3(key)());
  const r = () => next();
  r.range = (a, b) => a + (b - a) * next();
  r.int = (n) => Math.floor(next() * n);
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.sign = () => (next() < 0.5 ? -1 : 1);
  r.gauss = () => {
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.fork = (sub) => makeRng(`${seed}/${sub}`);
  return r;
}

/** Durumsuz karma: aynı argümanlar → aynı [0,1) değeri. */
export function hash01(...parts) {
  return mulberry32(xmur3(`${GLOBAL_SEED}#${parts.join('|')}`)())();
}
