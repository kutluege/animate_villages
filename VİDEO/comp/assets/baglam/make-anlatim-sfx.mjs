// Anlatım sahnelerinin (baglam / ekip / maresal / dongu) ek ses efektleri — kodla sentezlenir, tohumlu (her çalıştırmada aynı).
//   node comp/assets/baglam/make-anlatim-sfx.mjs      → sfx/anlatim-*.wav (48 kHz, 16 bit, stereo)
// Dışarıdan örnek yok; lisans: projeye ait, serbest kullanım. (tools/make-sfx.mjs ile aynı yaklaşım, bağımsız küçük DSP kiti.)
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../sfx');

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const noise = (sec, seed = 1) => { const r = rng(seed), b = buf(sec); for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1; return b; };
const val = (f, t) => (typeof f === 'function' ? f(t) : f);
function biquad(x, type, f, q = 0.707) {
  const y = new Float32Array(x.length);
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % 16 === 0) {
      const F = Math.min(SR * 0.45, Math.max(20, val(f, i / SR))), Q = val(q, i / SR);
      const w = 2 * Math.PI * F / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
      let n0, n1, n2;
      if (type === 'lp') { n0 = (1 - cs) / 2; n1 = 1 - cs; n2 = n0; } else if (type === 'hp') { n0 = (1 + cs) / 2; n1 = -(1 + cs); n2 = n0; } else { n0 = al; n1 = 0; n2 = -al; }
      const d0 = 1 + al; b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * cs / d0; a2 = (1 - al) / d0;
    }
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function osc(sec, f, shape = 'sin') {
  const b = buf(sec); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const p = ph / (2 * Math.PI) % 1;
    b[i] = shape === 'saw' ? 2 * p - 1 : shape === 'tri' ? 4 * Math.abs(p - 0.5) - 1 : Math.sin(ph);
    ph += 2 * Math.PI * val(f, i / SR) / SR;
  }
  return b;
}
const env = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR); return x; };
const add = (a, b, g = 1, at = 0) => { const o = Math.round(at * SR); for (let i = 0; i < b.length && i + o < a.length; i++) a[i + o] += b[i] * g; return a; };
const decay = (t, tau) => Math.exp(-t / tau);
const att = (t, a) => Math.min(1, t / a);
/** Küçük oda: birkaç geri beslemeli gecikme → stereo */
function room(x, { wet = 0.15, tail = 0.35 } = {}) {
  const len = x.length + Math.round(tail * SR);
  return [0, 31].map((spread) => {
    const y = new Float32Array(len);
    for (const [d, fb] of [[1117, 0.62], [1361, 0.58], [1553, 0.55], [1777, 0.5]]) {
      const D = Math.round((d + spread) * SR / 44100), line = new Float32Array(D); let idx = 0, lp = 0;
      for (let i = 0; i < len; i++) { const o = line[idx]; lp = o * 0.6 + lp * 0.4; line[idx] = (i < x.length ? x[i] : 0) * 0.25 + lp * fb; idx = (idx + 1) % D; y[i] += o; }
    }
    const o = new Float32Array(len);
    for (let i = 0; i < len; i++) o[i] = (i < x.length ? x[i] : 0) + y[i] * wet;
    return o;
  });
}
function finish(name, ch, peakDb = -9) {
  let [L, R] = ch;
  L = biquad(L, 'hp', 30); R = biquad(R, 'hp', 30);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = Math.pow(10, peakDb / 20) / (pk || 1), n = L.length, fo = Math.round(0.03 * SR), fi = Math.round(0.002 * SR);
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / fi, (n - 1 - i) / fo);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * e)) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * e)) * 32767), 46 + i * 4);
  }
  writeFileSync(join(OUT, name + '.wav'), data);
  console.log(`[sfx] ${name}.wav  ${(n / SR).toFixed(2)} sn`);
}

// ---- gerilen balon/lastik: sürtünmeli, yükselen gıcırtı ("bağlam şişer") ----
{
  const d = 0.85;
  const f = (t) => 95 + 210 * Math.pow(t / d, 1.6);
  let x = osc(d, (t) => f(t) * (1 + 0.012 * Math.sin(t * 190)), 'saw');
  x = biquad(x, 'bp', (t) => 500 + 1500 * (t / d), 2.2);
  env(x, (t) => att(t, 0.08) * (0.55 + 0.45 * Math.sin(t * 46) ** 2) * Math.pow(1 - t / d, 0.5));
  add(x, env(biquad(noise(d, 21), 'bp', (t) => 900 + 2600 * (t / d), 3), (t) => att(t, 0.1) * (1 - t / d) * 0.5), 0.5);
  finish('anlatim-stretch', room(x, { wet: 0.1, tail: 0.25 }), -12);
}
// ---- çatlama: art arda keskin kırılma tıkları ----
{
  const d = 0.5, x = buf(d), r = rng(77);
  let t = 0;
  for (let k = 0; k < 11; k++) {
    const c = env(biquad(noise(0.03, 100 + k), 'hp', 1800 + r() * 2500), (u) => decay(u, 0.0035 + r() * 0.004));
    add(x, c, (1 - k / 14) * (0.5 + r() * 0.5), t);
    t += 0.012 + r() * 0.05 * (1 + k * 0.25);
    if (t > d - 0.05) break;
  }
  add(x, env(osc(0.12, (u) => 240 * Math.exp(-u / 0.03) + 60), (u) => decay(u, 0.03)), 0.5);
  finish('anlatim-crack', room(x, { wet: 0.12, tail: 0.3 }), -9);
}
// ---- tarama: yumuşak, yükselen ince ton + hava ----
{
  const d = 0.8;
  const x = env(osc(d, (t) => 620 + 520 * (t / d)), (t) => att(t, 0.12) * Math.pow(1 - t / d, 1.2) * 0.5);
  add(x, env(osc(d, (t) => 1240 + 1040 * (t / d)), (t) => att(t, 0.12) * Math.pow(1 - t / d, 1.5) * 0.16));
  add(x, env(biquad(noise(d, 31), 'bp', (t) => 2400 + 2600 * (t / d), 4), (t) => att(t, 0.1) * Math.pow(1 - t / d, 1.2)), 0.45);
  finish('anlatim-scan', room(x, { wet: 0.14, tail: 0.3 }), -15);
}
// ---- kâğıt: kısa hışırtı/çırpınma ----
{
  const d = 0.34;
  let x = biquad(noise(d, 41), 'bp', (t) => 2600 + 2200 * Math.sin(t * 30), 1.2);
  x = biquad(x, 'hp', 1200);
  env(x, (t) => att(t, 0.01) * Math.pow(1 - t / d, 1.4) * (0.35 + 0.65 * Math.abs(Math.sin(t * 58))));
  finish('anlatim-paper', room(x, { wet: 0.08, tail: 0.2 }), -12);
}
// ---- flama: kumaş şaklaması + direk tok sesi ----
{
  const d = 0.4;
  const x = env(biquad(noise(d, 51), 'bp', (t) => 900 + 1800 * Math.exp(-t / 0.05), 0.9), (t) => att(t, 0.004) * decay(t, 0.06) * (0.6 + 0.4 * Math.abs(Math.sin(t * 70))));
  add(x, env(osc(0.2, (t) => 150 * Math.exp(-t / 0.05) + 70), (t) => att(t, 0.003) * decay(t, 0.06)), 0.8, 0.02);
  finish('anlatim-flag', room(x, { wet: 0.12, tail: 0.3 }), -10);
}
// ---- damga: ağır, tok vuruş (rütbe rozeti) ----
{
  const d = 0.6;
  const x = env(osc(d, (t) => 46 + 120 * Math.exp(-t / 0.028)), (t) => att(t, 0.002) * decay(t, 0.13));
  add(x, env(biquad(noise(0.08, 61), 'bp', 1900, 1), (t) => decay(t, 0.008)), 0.5);
  add(x, env(biquad(noise(0.3, 62), 'lp', 700), (t) => decay(t, 0.07)), 0.35);
  add(x, env(osc(0.5, 1320), (t) => att(t, 0.004) * decay(t, 0.12)), 0.05, 0.01);
  finish('anlatim-stamp', room(x, { wet: 0.2, tail: 0.5 }), -6);
}
// ---- yürüyüş: dört kısa trampet vuruşu (ordular ilerler) ----
{
  const d = 0.75, x = buf(d);
  [0, 0.14, 0.28, 0.42].forEach((t0, k) => {
    const hit = env(biquad(noise(0.12, 70 + k), 'bp', 1500, 0.8), (t) => att(t, 0.002) * decay(t, 0.03));
    add(hit, env(osc(0.12, (t) => 190 * Math.exp(-t / 0.04) + 110), (t) => decay(t, 0.035)), 0.9);
    add(x, hit, 0.6 + 0.13 * k, t0);
  });
  finish('anlatim-march', room(x, { wet: 0.14, tail: 0.35 }), -10);
}
// ---- makara: hızlanan film projektörü tıkırtısı ("kare kare") ----
{
  const d = 1.6, x = buf(d);
  let t = 0, k = 0;
  while (t < d - 0.04) {
    const c = env(biquad(noise(0.02, 200 + k), 'bp', 2600 + (k % 2) * 700, 2.5), (u) => decay(u, 0.004));
    add(x, c, 0.45 + 0.45 * Math.min(1, t / 0.9), t);
    t += Math.max(0.03, 0.11 * Math.pow(1 - t / d, 1.3));
    k++;
  }
  add(x, env(biquad(noise(d, 91), 'bp', (u) => 500 + 900 * (u / d), 1.5), (u) => att(u, 0.3) * Math.pow(1 - u / d, 0.6)), 0.25);
  env(x, (u) => Math.min(1, (d - u) / 0.25));
  finish('anlatim-reel', room(x, { wet: 0.08, tail: 0.2 }), -12);
}
