// Başlangıç efekt kütüphanesi: kodla sentezlenir (tohumlu, her çalıştırmada aynı) → sfx/<ad>.wav (48 kHz, 16 bit, stereo)
//   node tools/make-sfx.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
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

// Hava süpürmesi: bant geçiren gürültü, merkez frekans yükselip iner; stereo kaydırma
S.whoosh = (dur = 0.75, seed = 11) => {
  const n = noise(dur, seed);
  const pk = 0.55;
  const f = (t) => 300 + 2600 * Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;
  let x = biquad(n, 'bp', f, 1.1);
  x = biquad(x, 'lp', 7000);
  env(x, (t) => { const u = t / dur; return u < pk ? sstep(u / pk) ** 1.6 : Math.pow(1 - (u - pk) / (1 - pk), 2.2); });
  const L = Float32Array.from(x), R = Float32Array.from(x);
  for (let i = 0; i < x.length; i++) { const p = i / x.length; L[i] *= 1.15 - 0.6 * p; R[i] *= 0.55 + 0.6 * p; }
  const [rl] = reverb(L, { wet: 0.12, tail: 0.3 }); const [, rr] = reverb(R, { wet: 0.12, tail: 0.3 });
  return [rl, rr];
};
S['whoosh-short'] = () => S.whoosh(0.38, 12);

// Yumuşak pop: hızlı düşen perdeli sinüs + çok kısa tık
S.pop = () => {
  const d = 0.16;
  const x = env(sine(d, (t) => 260 + 620 * Math.exp(-t / 0.018)), (t) => att(t, 0.002) * decay(t, 0.035));
  add(x, env(biquad(noise(0.01, 3), 'bp', 2400, 1.2), (t) => decay(t, 0.002)), 0.25);
  return reverb(x, { wet: 0.08, tail: 0.25, size: 0.3 });
};

// Arayüz tık'ı: kısa rezonanslı tıkırtı
S.tick = () => {
  const x = env(biquad(noise(0.05, 5), 'bp', 3200, 4), (t) => decay(t, 0.006));
  add(x, env(sine(0.05, 1800), (t) => decay(t, 0.008)), 0.12);
  return reverb(x, { wet: 0.05, tail: 0.15, size: 0.2 });
};

// Klavye tuşu (3 çeşit) + kısa yazma dizisi
const key = (seed, pitch = 1) => {
  const x = env(biquad(noise(0.08, seed), 'bp', 2600 * pitch, 2.2), (t) => decay(t, 0.007));
  add(x, env(biquad(noise(0.08, seed + 1), 'lp', 900), (t) => decay(t, 0.012)), 0.6);           // tuşun dibe çarpması
  add(x, env(biquad(noise(0.06, seed + 2), 'bp', 4200 * pitch, 3), (t) => decay(t, 0.004)), 0.35, 0.045); // geri dönüş
  return x;
};
S['type-1'] = () => reverb(key(21, 1.0), { wet: 0.06, tail: 0.12, size: 0.2 });
S['type-2'] = () => reverb(key(31, 0.88), { wet: 0.06, tail: 0.12, size: 0.2 });
S['type-3'] = () => reverb(key(41, 1.12), { wet: 0.06, tail: 0.12, size: 0.2 });
S.typing = () => {
  const r = rng(77), x = buf(1.6); let t = 0.02, i = 0;
  while (t < 1.45) { add(x, key(100 + i * 3, 0.85 + r() * 0.3), 0.55 + r() * 0.45, t); t += 0.055 + r() * 0.09 + (r() < 0.12 ? 0.12 : 0); i++; }
  return reverb(x, { wet: 0.06, tail: 0.15, size: 0.2 });
};

// Fotoğraf deklanşörü: iki mekanik tık (bas-bırak)
S.shutter = () => {
  const x = buf(0.25);
  const clk = (seed, f) => env(biquad(biquad(noise(0.06, seed), 'hp', 1500), 'peak', f, 3, 9), (t) => att(t, 0.0008) * decay(t, 0.009));
  add(x, clk(51, 3500), 1.0, 0.0);
  add(x, env(biquad(noise(0.05, 52), 'lp', 600), (t) => decay(t, 0.01)), 0.5, 0.0);
  add(x, clk(53, 2800), 0.7, 0.075);
  return reverb(x, { wet: 0.1, tail: 0.25, size: 0.35 });
};
// Polaroid: deklanşör + baskı çıkarma motoru vızıltısı
S.polaroid = () => {
  const [l, r] = S.shutter();
  const dur = 0.62, x = buf(dur);
  const saw = buf(dur); let ph = 0;
  for (let i = 0; i < saw.length; i++) { const t = i / SR; ph += (118 + 8 * Math.sin(t * 40)) / SR; saw[i] = 2 * (ph % 1) - 1; }
  add(x, biquad(biquad(saw, 'bp', 900, 0.9), 'lp', 2500), 0.5);
  add(x, biquad(noise(dur, 61), 'bp', 1800, 0.8), 0.12);
  env(x, (t) => sstep(t / 0.04) * (t < dur - 0.08 ? 1 : (dur - t) / 0.08));
  const [ml, mr] = reverb(x, { wet: 0.08, tail: 0.2 });
  const L = new Float32Array(l.length + ml.length), R = new Float32Array(L.length);
  add(L, l); add(R, r); add(L, ml, 0.55, 0.16); add(R, mr, 0.55, 0.16);
  return [L, R];
};

// Kâğıt/kart düşüşü: yumuşak tokat
S.drop = () => {
  const x = env(biquad(noise(0.2, 71), 'lp', 2200), (t) => att(t, 0.001) * decay(t, 0.025));
  add(x, env(sine(0.2, (t) => 140 - 60 * t / 0.2), (t) => decay(t, 0.03)), 0.5);
  return reverb(x, { wet: 0.12, tail: 0.3, size: 0.4 });
};

// Yumuşak darbe (thump): düşük frekans, perde düşüşü
S.thud = () => {
  const x = env(sine(0.6, (t) => 48 + 70 * Math.exp(-t / 0.04)), (t) => att(t, 0.003) * decay(t, 0.14));
  add(x, env(biquad(noise(0.1, 81), 'lp', 400), (t) => decay(t, 0.02)), 0.35);
  return reverb(x, { wet: 0.15, tail: 0.5, size: 0.5, damp: 0.6 });
};
// Sinematik vuruş: thud + parlak gürültü patlaması + uzun kuyruk
S.hit = () => {
  const x = env(sine(1.4, (t) => 42 + 90 * Math.exp(-t / 0.05)), (t) => att(t, 0.002) * decay(t, 0.35));
  add(x, env(biquad(noise(0.5, 91), 'bp', 1800, 0.6), (t) => decay(t, 0.06)), 0.35);
  add(x, env(biquad(noise(1.2, 92), 'lp', 5000), (t) => decay(t, 0.25)), 0.07);
  return reverb(x, { wet: 0.3, tail: 1.2, size: 0.8, damp: 0.5 });
};

// Yükselen ton: iki katmanlı (tını + yükselen filtreli gürültü), sona doğru hızlanan perde
const riser = (dur, seed) => {
  const f0 = 180, f1 = 900;
  const fr = (t) => f0 * Math.pow(f1 / f0, Math.pow(t / dur, 1.6));
  const x = buf(dur);
  for (const [k, g] of [[1, 0.5], [1.5, 0.25], [2, 0.18], [1.005, 0.4]]) add(x, sine(dur, (t) => fr(t) * k), g);
  const nz = biquad(noise(dur, seed), 'bp', (t) => 400 + 6000 * Math.pow(t / dur, 2), 1.4);
  add(x, nz, 0.5);
  env(x, (t) => Math.pow(t / dur, 2.2) * (t > dur - 0.03 ? (dur - t) / 0.03 : 1));
  return reverb(x, { wet: 0.25, tail: 0.6, size: 0.7 });
};
S.riser = () => riser(1.5, 101);
S['riser-long'] = () => riser(3.0, 102);

// Ters süpürme (swell): ortaya çıkıştan hemen önce kabaran hava
S.swell = () => {
  const d = 1.1, x = biquad(noise(d, 111), 'lp', (t) => 300 + 7000 * Math.pow(t / d, 3), 0.9);
  env(x, (t) => Math.pow(t / d, 3) * (t > d - 0.02 ? (d - t) / 0.02 : 1));
  return reverb(x, { wet: 0.2, tail: 0.3, size: 0.6 });
};

// Onay çınlaması: iki nota çan (uyumsuz kısmi tonlarla), temiz kuyruk
const bell = (f, d = 2.2) => {
  const x = buf(d);
  for (const [k, g, tau] of [[1, 1, 0.5], [2.0, 0.35, 0.3], [2.76, 0.18, 0.18], [5.4, 0.06, 0.08]]) add(x, env(sine(d, f * k), (t) => att(t, 0.002) * decay(t, tau)), g);
  return x;
};
S.chime = () => {
  const x = buf(2.4);
  add(x, bell(1318.5), 0.6, 0); add(x, bell(1975.5), 0.5, 0.09);
  return reverb(x, { wet: 0.28, tail: 0.9, size: 0.7, damp: 0.3 });
};
// Tek yumuşak not (bilgi, etiket belirmesi)
S.ping = () => reverb(env(bell(1760, 0.9), (t) => 1), { wet: 0.22, tail: 0.6, size: 0.6, damp: 0.35 });

// Dijital bozulma ("saçmalama"): kesik kesik, örnek-tutmalı gürültü + kare dalga parçaları
S.glitch = () => {
  const r = rng(121), d = 0.55, x = buf(d);
  let t = 0;
  while (t < d - 0.03) {
    const len = 0.015 + r() * 0.05, f = 200 + r() * 1800, hold = 1 + Math.floor(r() * 12);
    const seg = buf(len); let v = 0;
    for (let i = 0; i < seg.length; i++) { if (i % hold === 0) v = (Math.sin(2 * Math.PI * f * i / SR) > 0 ? 0.6 : -0.6) + (r() - 0.5) * 0.6; seg[i] = v; }
    env(seg, (u) => Math.min(1, u / 0.002, (len - u) / 0.002));
    if (r() > 0.25) add(x, seg, 0.5 + r() * 0.5, t);
    t += len + (r() < 0.3 ? r() * 0.03 : 0);
  }
  return reverb(biquad(x, 'lp', 6000), { wet: 0.06, tail: 0.15 });
};

mkdirSync(OUT, { recursive: true });
// Tepe düzeyleri: gain=1 iken -15 LUFS sese karşı makul bir varsayılan denge
const PEAK = { whoosh: -9, 'whoosh-short': -10, pop: -7, tick: -9, 'type-1': -11, 'type-2': -11, 'type-3': -11, typing: -12,
  shutter: -6, polaroid: -6, drop: -7, thud: -4, hit: -3, riser: -9, 'riser-long': -9, swell: -10, chime: -9, ping: -11, glitch: -12 };
for (const [name, fn] of Object.entries(S)) finish(name, fn(), { peakDb: PEAK[name] ?? -8 });
