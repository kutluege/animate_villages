// Kapanış sahnelerinin (senaryo/sonuc) ek efektleri — kodla sentezlenir, tohumlu (her çalıştırmada aynı çıktı).
//   node sfx/kapanis-make.mjs   →  sfx/kapanis-counter.wav, sfx/kapanis-curtain.wav  (48 kHz, 16 bit, stereo)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000, OUT = dirname(fileURLToPath(import.meta.url));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
/** Bant geçiren (RBJ); f sabit ya da (t) => Hz */
function bandpass(x, f, q) {
  const y = new Float32Array(x.length); let b0 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % 16 === 0) {
      const F = typeof f === 'function' ? f(i / SR) : f, w = 2 * Math.PI * F / SR, al = Math.sin(w) / (2 * q), d0 = 1 + al;
      b0 = al / d0; b2 = -al / d0; a1 = -2 * Math.cos(w) / d0; a2 = (1 - al) / d0;
    }
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function write(name, L, R, peakDb) {
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = Math.pow(10, peakDb / 20) / (pk || 1), n = L.length, fo = Math.round(0.02 * SR), data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / 48, (n - 1 - i) / fo);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * e)) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * e)) * 32767), 46 + i * 4);
  }
  writeFileSync(join(OUT, name + '.wav'), data);
  console.log(`[sfx] ${name}.wav  ${(n / SR).toFixed(2)} sn`);
}

// Sayaç: hızlı başlayıp yavaşlayan, perdesi yükselen kısa tıkırtılar (rakam yerine oturana kadar ~0,8 sn)
{
  const dur = 0.95, L = buf(dur), R = buf(dur), r = rng(907), N = 18;
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1), t0 = 0.004 + 0.78 * (1 - Math.pow(1 - u, 2.1)); // sayaç eğrisinin tersi: başta sık, sonda seyrek
    const f = 1250 + 950 * u, pan = 0.5 + 0.16 * (r() - 0.5), amp = 0.55 + 0.45 * u, o = Math.round(t0 * SR);
    for (let i = 0; i < 0.07 * SR && o + i < L.length; i++) {
      const t = i / SR, v = amp * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.011) + 0.35 * (r() * 2 - 1) * Math.exp(-t / 0.0015));
      L[o + i] += v * (1 - pan) * 2; R[o + i] += v * pan * 2;
    }
  }
  write('kapanis-counter', L, R, -9);
}

// Perde: açılan kumaş gibi yumuşak hava kabarması (ortadan yanlara açılır), alçak bir uğultuyla
{
  const dur = 1.25, r = rng(431), n = buf(dur);
  for (let i = 0; i < n.length; i++) n[i] = r() * 2 - 1;
  const air = bandpass(n, (t) => 380 + 1500 * Math.pow(Math.min(1, t / 0.95), 1.6), 0.9);
  const L = buf(dur), R = buf(dur);
  for (let i = 0; i < L.length; i++) {
    const t = i / SR, u = t / dur;
    const e = Math.pow(Math.sin(Math.PI * Math.min(1, u / 0.86) * 0.5), 2.2) * (u > 0.8 ? Math.pow(Math.max(0, (1 - u) / 0.2), 1.6) : 1);
    const low = 0.22 * Math.sin(2 * Math.PI * (62 + 26 * u) * t) * e;
    const side = 0.25 * Math.min(1, u * 1.4);
    L[i] = (air[i] * (1 + side) + low) * e; R[i] = (air[Math.max(0, i - 190)] * (1 + side) + low) * e;
  }
  write('kapanis-curtain', L, R, -11);
}
