// Hook laboratuvarı efektleri: üç açılış seçeneğinin kendi ses tasarımı. Kodla sentezlenir (tohumlu, her çalıştırmada aynı);
// DSP kiti tools/make-sfx.mjs'ten kopyadır (o dosya içe aktarılmaz: çalışınca kendi kütüphanesini yeniden yazar).
//   node tools/hook-lab-sfx.mjs [regex]   → sfx/hook-a-*.wav, sfx/hook-b-*.wav, sfx/hook-c-*.wav (48 kHz, 16 bit, stereo)
// Yalnız "hook-" ile başlayan YENİ dosyalar yazılır; mevcut sfx dosyalarına dokunulmaz.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';

const SR = 48000;
const OUT = join(ROOT, 'sfx');

// ---------- küçük DSP kiti ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const noise = (sec, seed = 1) => { const r = rng(seed), b = buf(sec); for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1; return b; };

/** RBJ biquad; f, q sabit ya da (t)=>değer (her 16 örnekte güncellenir). type: lp|hp|bp|peak */
function biquad(x, type, f, q = 0.707, gainDb = 0) {
  const y = new Float32Array(x.length);
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const coef = (t) => {
    const F = Math.min(SR * 0.45, Math.max(20, typeof f === 'function' ? f(t) : f));
    const Q = typeof q === 'function' ? q(t) : q;
    const w = 2 * Math.PI * F / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * Q), A = Math.pow(10, gainDb / 40);
    let n0, n1, n2, d0, d1, d2;
    if (type === 'lp') { n0 = (1 - cs) / 2; n1 = 1 - cs; n2 = n0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    else if (type === 'hp') { n0 = (1 + cs) / 2; n1 = -(1 + cs); n2 = n0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    else if (type === 'bp') { n0 = al; n1 = 0; n2 = -al; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    else { n0 = 1 + al * A; n1 = -2 * cs; n2 = 1 - al * A; d0 = 1 + al / A; d1 = -2 * cs; d2 = 1 - al / A; }
    b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0;
  };
  for (let i = 0; i < x.length; i++) {
    if (i % 16 === 0) coef(i / SR);
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** Faz biriktirerek sinüs; f sabit ya da (t)=>Hz */
function sine(sec, f, phase = 0) {
  const b = buf(sec); let ph = phase;
  for (let i = 0; i < b.length; i++) { b[i] = Math.sin(ph); ph += 2 * Math.PI * (typeof f === 'function' ? f(i / SR) : f) / SR; }
  return b;
}
const env = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR); return x; };
const add = (a, b, g = 1, at = 0) => { const o = Math.round(at * SR); for (let i = 0; i < b.length && i + o < a.length; i++) a[i + o] += b[i] * g; return a; };
const decay = (t, tau) => Math.exp(-t / tau);
const att = (t, a) => Math.min(1, t / a);
const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/** Schroeder/Freeverb tarzı küçük oda yankısı → stereo [L, R] */
function reverb(x, { size = 0.5, damp = 0.4, wet = 0.2, tail = 0.8 } = {}) {
  // kuru sinyalin sonunu yumuşat (kesik bitişte tık olmasın)
  x = Float32Array.from(x);
  const tp = Math.min(Math.round(0.15 * SR), Math.round(x.length * 0.3));
  for (let i = 0; i < tp; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / tp);
  const len = x.length + Math.round(tail * SR);
  const outs = [];
  for (const spread of [0, 23]) {
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round((d + spread) * SR / 44100));
    const aps = [556, 441, 341, 225].map((d) => Math.round((d + spread) * SR / 44100));
    const y = new Float32Array(len);
    const fb = 0.7 + 0.28 * size;
    for (const d of combs) {
      const line = new Float32Array(d); let idx = 0, filt = 0;
      for (let i = 0; i < len; i++) {
        const inp = i < x.length ? x[i] : 0;
        const o = line[idx]; filt = o * (1 - damp) + filt * damp;
        line[idx] = inp * 0.015 + filt * fb; idx = (idx + 1) % d; y[i] += o;
      }
    }
    for (const d of aps) {
      const line = new Float32Array(d); let idx = 0;
      for (let i = 0; i < len; i++) { const bo = line[idx]; const v = -y[i] + bo; line[idx] = y[i] + bo * 0.5; idx = (idx + 1) % d; y[i] = v; }
    }
    const o = new Float32Array(len);
    for (let i = 0; i < len; i++) o[i] = (i < x.length ? x[i] : 0) + y[i] * wet;
    outs.push(o);
  }
  return outs;
}
const stereo = (x) => [x, Float32Array.from(x)];

function finish(name, ch, { peakDb = -3, fadeOut = 0.02 } = {}) {
  let [L, R] = ch;
  // sondaki sessizliği kırp
  let end = L.length; const thr = 1e-4;
  while (end > 1 && Math.abs(L[end - 1]) < thr && Math.abs(R[end - 1]) < thr) end--;
  // 2 ms ön boşluk: atak kenar yumuşatmasıyla ezilmesin
  const pre = Math.round(0.002 * SR);
  const L2 = new Float32Array(end + pre), R2 = new Float32Array(end + pre);
  L2.set(L.subarray(0, end), pre); R2.set(R.subarray(0, end), pre); L = L2; R = R2;
  // DC temizliği (hafif HP 25 Hz)
  L = biquad(L, 'hp', 25); R = biquad(R, 'hp', 25);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = Math.pow(10, peakDb / 20) / (pk || 1);
  const fo = Math.round(fadeOut * SR), fi = 1;
  const n = L.length, data = Buffer.alloc(44 + n * 4);
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


// ---------- sesler ----------
const S = {};
const pan = (x, p) => [Float32Array.from(x, (v) => v * Math.min(1, 1 - p)), Float32Array.from(x, (v) => v * Math.min(1, 1 + p))];
/** yumuşak doyum: alt bas telefon hoparlöründe de duyulsun diye üst harmonik üretir */
const sat = (x, drive = 2) => { const k = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(drive * x[i]) / k; return x; };
const tone = (sec, f, partials = [[1, 1]]) => { const x = buf(sec); for (const [k, g] of partials) add(x, sine(sec, typeof f === 'function' ? (t) => f(t) * k : f * k), g); return x; };

// ======== A — RİTİM: kuru, sıkı, film kurgusu vuruşları ========
// Kesme: kısa alt gövde (perde düşen sinüs) + parlak tık + çok kısa hava; neredeyse kuru
S['hook-a-cut'] = () => {
  const d = 0.32;
  const x = sat(env(sine(d, (t) => 62 + 120 * Math.exp(-t / 0.02)), (t) => att(t, 0.0015) * decay(t, 0.07)), 2.6);
  add(x, env(biquad(biquad(noise(0.03, 201), 'hp', 2500), 'peak', 5200, 2, 6), (t) => decay(t, 0.0045)), 0.6);
  add(x, env(biquad(noise(0.12, 202), 'bp', 1100, 0.9), (t) => att(t, 0.001) * decay(t, 0.02)), 0.5);
  add(x, env(biquad(noise(0.12, 203), 'bp', 260, 1.2), (t) => att(t, 0.001) * decay(t, 0.03)), 0.6);
  return reverb(x, { wet: 0.06, tail: 0.18, size: 0.25, damp: 0.6 });
};
// Geri çekilme: kısa ters süpürme (hava emilir) — vuruşa bağlanır
S['hook-a-whip'] = () => {
  const d = 0.26, x = biquad(noise(d, 211), 'bp', (t) => 500 + 5200 * Math.pow(t / d, 1.8), 1.3);
  env(x, (t) => Math.pow(t / d, 2.4) * (t > d - 0.012 ? (d - t) / 0.012 : 1));
  const [l, r] = pan(x, 0); for (let i = 0; i < l.length; i++) { const p = i / l.length; l[i] *= 1.2 - 0.5 * p; r[i] *= 0.7 + 0.5 * p; }
  return [l, r];
};
// İniş vuruşu: derin, kısa kuyruklu (sinematik ama gürültüsüz)
S['hook-a-impact'] = () => {
  const d = 1.3;
  const x = sat(env(sine(d, (t) => 50 + 130 * Math.exp(-t / 0.035)), (t) => att(t, 0.002) * decay(t, 0.26)), 3);
  add(x, env(biquad(noise(0.25, 221), 'lp', 1600), (t) => att(t, 0.001) * decay(t, 0.035)), 0.7);
  add(x, env(biquad(noise(0.4, 223), 'bp', 220, 1.4), (t) => att(t, 0.001) * decay(t, 0.08)), 0.7);
  add(x, env(biquad(biquad(noise(0.05, 222), 'hp', 3000), 'peak', 6000, 2, 4), (t) => decay(t, 0.006)), 0.4);
  return reverb(x, { wet: 0.22, tail: 0.9, size: 0.7, damp: 0.55 });
};
// Damga: ad plakası çakılır — gövde + "klak" + tek, kısa tını (üç plaka: yükselen üç nota)
const stamp = (f, seed) => {
  const d = 0.6;
  const x = sat(env(sine(d, (t) => 80 + 140 * Math.exp(-t / 0.018)), (t) => att(t, 0.001) * decay(t, 0.06)), 2.4);
  add(x, env(biquad(noise(0.08, seed), 'bp', 1500, 1.6), (t) => decay(t, 0.012)), 0.7);
  add(x, env(biquad(noise(0.02, seed + 1), 'hp', 4000), (t) => decay(t, 0.003)), 0.35);
  add(x, env(tone(d, f, [[1, 1], [2.01, 0.3], [3.0, 0.12]]), (t) => att(t, 0.002) * decay(t, 0.14)), 0.16);
  return reverb(x, { wet: 0.1, tail: 0.35, size: 0.35, damp: 0.5 });
};
S['hook-a-stamp-1'] = () => stamp(587.3, 231);
S['hook-a-stamp-2'] = () => stamp(659.3, 241);
S['hook-a-stamp-3'] = () => stamp(880.0, 251);

// ======== B — TEK PLAN: tek uzun yükseliş → tek vuruş ========
// Yükseliş (1,55 sn; sonu vuruşa kesilir): yükselen glissando tınısı (oktav), hızlanan titreşim, açılan hava
S['hook-b-rise'] = () => {
  const d = 1.55;
  const fr = (t) => 98 * Math.pow(2, Math.pow(t / d, 1.5) * 1.15);
  const x = tone(d, fr, [[1, 0.55], [2, 0.32], [3, 0.16], [4.01, 0.09], [1.004, 0.4]]);
  let ph = 0;
  for (let i = 0; i < x.length; i++) { const u = i / SR / d; ph += 2 * Math.PI * (3 + 12 * u * u) / SR; x[i] *= 1 - 0.35 * u * (0.5 + 0.5 * Math.sin(ph)); }
  const tonal = biquad(x, 'lp', (t) => 500 + 3800 * Math.pow(t / d, 2), 0.9);
  const air = biquad(noise(d, 301), 'bp', (t) => 350 + 5200 * Math.pow(t / d, 2.2), 1.1);
  const y = buf(d);
  add(y, tonal, 0.9); add(y, air, 0.55);
  env(y, (t) => (0.08 + 0.92 * Math.pow(t / d, 2.1)) * att(t, 0.04) * (t > d - 0.008 ? (d - t) / 0.008 : 1));
  const L = Float32Array.from(y), R = Float32Array.from(y);
  const dl = Math.round(0.0004 * SR); for (let i = R.length - 1; i >= dl; i--) R[i] = y[i - dl];
  return [L, R];
};
// Vuruş: alt bas düşüşü + gövde + çatırtı + yumuşak tını kuyruğu (geniş yankı)
S['hook-b-boom'] = () => {
  const d = 2.6;
  const x = sat(env(sine(d, (t) => 46 + 140 * Math.exp(-t / 0.05)), (t) => att(t, 0.002) * decay(t, 0.5)), 3.2);
  add(x, env(biquad(noise(0.5, 311), 'lp', 1100), (t) => att(t, 0.001) * decay(t, 0.08)), 0.75);
  add(x, env(biquad(noise(0.8, 313), 'bp', 180, 1.2), (t) => att(t, 0.001) * decay(t, 0.16)), 0.8);
  add(x, env(biquad(biquad(noise(0.08, 312), 'hp', 2200), 'peak', 4500, 1.5, 5), (t) => decay(t, 0.012)), 0.45);
  add(x, env(tone(d, 110, [[1, 0.5], [1.5, 0.35], [2, 0.3], [3.01, 0.12], [8, 0.05], [12.02, 0.03]]), (t) => att(t, 0.03) * decay(t, 0.9)), 0.16);
  return reverb(x, { wet: 0.34, tail: 2.0, size: 0.88, damp: 0.45 });
};
// Parıltı: ad belirir — yüksek, yumuşak çan + hava pırıltısı
S['hook-b-glint'] = () => {
  const d = 1.0, x = buf(d);
  for (const [f, g, tau, at] of [[2637, 0.5, 0.22, 0], [3951, 0.28, 0.16, 0.012], [5274, 0.12, 0.09, 0.02]]) add(x, env(sine(d, f), (t) => att(t, 0.003) * decay(t, tau)), g, at);
  add(x, env(biquad(noise(0.3, 321), 'hp', 6000), (t) => att(t, 0.01) * decay(t, 0.06)), 0.12);
  return reverb(x, { wet: 0.3, tail: 0.8, size: 0.7, damp: 0.3 });
};
// Dalış: 0,8 sn'de kabaran hava + yükselen perde (gercek'in ilk fotoğrafına bağlanır)
S['hook-b-dive'] = () => {
  const d = 0.8;
  const air = biquad(noise(d, 331), 'lp', (t) => 250 + 6500 * Math.pow(t / d, 2.6), 0.8);
  const tn = tone(d, (t) => 180 * Math.pow(2, 1.6 * Math.pow(t / d, 2)), [[1, 0.4], [2, 0.15]]);
  const x = buf(d); add(x, air, 1); add(x, tn, 0.18);
  env(x, (t) => Math.pow(t / d, 2.6) * (t > d - 0.015 ? (d - t) / 0.015 : 1));
  const L = Float32Array.from(x), R = Float32Array.from(x);
  for (let i = 0; i < x.length; i++) { const p = i / x.length; L[i] *= 0.7 + 0.4 * p; R[i] *= 1.1 - 0.4 * p; }
  const [rl] = reverb(L, { wet: 0.12, tail: 0.25, size: 0.5 }); const [, rr] = reverb(R, { wet: 0.12, tail: 0.25, size: 0.5 });
  return [rl, rr];
};

// ======== C — TESPİT: alet sesleri (sinüs bip'ler, tarama, veri akışı, eşleşme) ========
// Tarama: radar kolu geçer — dar bant süpürmesi + alçak nabız
S['hook-c-sweep'] = () => {
  const d = 1.1;
  const x = biquad(noise(d, 401), 'bp', (t) => 700 + 1800 * Math.sin(Math.PI * t / d), 6);
  env(x, (t) => Math.sin(Math.PI * Math.min(1, t / d)) ** 2);
  add(x, env(sine(d, 74), (t) => att(t, 0.01) * decay(t, 0.25)), 0.35);
  const L = Float32Array.from(x), R = Float32Array.from(x);
  for (let i = 0; i < x.length; i++) { const p = i / x.length; L[i] *= 1.1 - 0.6 * p; R[i] *= 0.5 + 0.6 * p; }
  const [rl] = reverb(L, { wet: 0.2, tail: 0.5, size: 0.6 }); const [, rr] = reverb(R, { wet: 0.2, tail: 0.5, size: 0.6 });
  return [rl, rr];
};
// Temas: kısa sonar bip'i
S['hook-c-blip'] = () => {
  const d = 0.5, x = env(tone(d, 1568, [[1, 1], [2, 0.12]]), (t) => att(t, 0.002) * decay(t, 0.045));
  return reverb(x, { wet: 0.28, tail: 0.5, size: 0.55, damp: 0.4 });
};
// Kilit: üç hızlı yükselen bip + mekanik tık (nişangâh oturur)
S['hook-c-lock'] = () => {
  const d = 0.5, x = buf(d);
  [[1318.5, 0], [1568, 0.055], [2093, 0.11]].forEach(([f, at]) => add(x, env(tone(0.06, f, [[1, 1], [3, 0.08]]), (t) => att(t, 0.002) * Math.min(1, (0.06 - t) / 0.01) * decay(t, 0.05)), 0.5, at));
  add(x, env(biquad(noise(0.03, 411), 'bp', 3500, 3), (t) => decay(t, 0.004)), 0.5, 0.17);
  add(x, env(sine(0.12, (t) => 140 + 200 * Math.exp(-t / 0.01)), (t) => decay(t, 0.03)), 0.4, 0.17);
  return reverb(x, { wet: 0.12, tail: 0.3, size: 0.4 });
};
// Veri akışı: kısa, hızlı sayısal tıkırtı dizisi (koordinatlar akarken)
S['hook-c-data'] = () => {
  const r = rng(421), d = 0.5, x = buf(d);
  for (let t = 0.0; t < d - 0.02;) {
    const f = [2093, 2349, 2637, 3136][Math.floor(r() * 4)];
    add(x, env(tone(0.018, f), (u) => att(u, 0.0008) * Math.min(1, (0.018 - u) / 0.004)), 0.18 + 0.12 * r(), t);
    t += 0.026 + r() * 0.02;
  }
  env(x, (t) => Math.min(1, t / 0.03) * (t > d - 0.08 ? (d - t) / 0.08 : 1));
  return reverb(biquad(x, 'lp', 7000), { wet: 0.1, tail: 0.2, size: 0.3 });
};
// Eşleşme: yumuşak üç notalı onay + alt gövde
S['hook-c-match'] = () => {
  const d = 1.6, x = buf(d);
  add(x, env(tone(d, 659.3, [[1, 1], [2, 0.2]]), (t) => att(t, 0.006) * decay(t, 0.45)), 0.4, 0);
  add(x, env(tone(d, 987.8, [[1, 1], [2, 0.15]]), (t) => att(t, 0.006) * decay(t, 0.5)), 0.34, 0.07);
  add(x, env(tone(d, 1318.5, [[1, 1]]), (t) => att(t, 0.006) * decay(t, 0.4)), 0.2, 0.14);
  add(x, sat(env(sine(0.5, (t) => 70 + 110 * Math.exp(-t / 0.03)), (t) => att(t, 0.002) * decay(t, 0.1)), 2.4), 0.5, 0);
  return reverb(x, { wet: 0.3, tail: 1.0, size: 0.7, damp: 0.35 });
};

const PEAK = { 'hook-a-cut': -4, 'hook-a-whip': -10, 'hook-a-impact': -3, 'hook-a-stamp-1': -5, 'hook-a-stamp-2': -5, 'hook-a-stamp-3': -5,
  'hook-b-rise': -9, 'hook-b-boom': -3, 'hook-b-glint': -12, 'hook-b-dive': -10,
  'hook-c-sweep': -12, 'hook-c-blip': -10, 'hook-c-lock': -8, 'hook-c-data': -14, 'hook-c-match': -8 };
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (const [name, fn] of Object.entries(S)) {
  if (!name.startsWith('hook-')) throw new Error('yalnız hook-* yazılır');
  if (only && !only.test(name)) continue;
  finish(name, fn(), { peakDb: PEAK[name] ?? -8 });
}
