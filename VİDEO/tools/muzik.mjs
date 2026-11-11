// Fon müziği seçenekleri: work/audio.wav (ses + efekt, salt okunur) + muzik/kaynak/<parça> → muzik/miks-N.wav + out/secenekler/muzik-N.mp4
//   node tools/muzik.mjs --secenek 1            (1 | 2 | 3 | 1,2,3)
//   node tools/muzik.mjs --secenek 2 --video out/onceki/icerik.mp4   (görüntü kaynağını elle seç)
//   node tools/muzik.mjs --secenek 3 --yalniz-ses                    (mp4 üretme)
// Görüntü yeniden render EDİLMEZ: video akışı -c:v copy ile kopyalanır. Varsayılan kaynak out/icerik.mp4; dosya yoksa ya da
// son 60 sn içinde yazılmışsa (render sürüyor) out/onceki/icerik.mp4.
// Yalnız şunlara yazar: muzik/miks-N.wav, muzik/ara/*, muzik/olcum-N.json, out/secenekler/muzik-N.mp4.
//
// MİKS KURALI
//   - Müzik yalnız 0 → MUSIC_END (≈119,95 sn) arasında; 120,07 sn'den (final sahnesi) sonra tam dijital sıfır.
//   - Konuşma (transkriptteki kelimeler, 120 ms önden / 200 ms arkadan genişletilmiş, < 0,6 sn boşluklar doldurulmuş) varken müzik
//     GAP_OPEN dB kısık; ayrıca ses hecelerine bağlı hafif yan zincir (en çok SC_MAX dB). Taban kazanç kalibre edilir:
//     konuşma pencerelerinde (400 ms, K-ağırlıklı) ses − müzik ortancası = TARGET_SPEECH_GAP dB (16–20 dB bandının ortası).
//   - Müzikte sabit EQ: 30 Hz altı kesik, 1,2 kHz −1,5 dB, 2,8 kHz −3 dB (konuşmanın anlaşılırlık bandına yer açar).
//   - Master: toplam −14 LUFS; gerçek tepe (4× aşırı örnekleme) TP_CEIL dBTP tavanında ileri bakışlı sınırlayıcı; kırpılma yok.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const P = (...a) => join(ROOT, ...a);
const FINAL_START = 120.0667;      // timeline.json → final.start (müzik kesin olarak bunun öncesinde biter)
const MUSIC_END = 119.95;          // son kelime 119,56'da biter; söniş bu ana kadar tamamlanır
const TARGET_SPEECH_GAP = 18;      // dB, konuşmada ses − müzik (ortanca)
const GAP_OPEN = 4.5;              // dB, konuşma boşluğunda müzik bu kadar açılır
const SC_MAX = 2;                  // dB, hece yan zinciri en fazla
const MASTER_LUFS = -14;
const TP_CEIL = -1.8;              // dBTP, sınırlayıcı tavanı (AAC sonrası −1,5 altında kalsın diye pay)
const EQ = 'highpass=f=30,equalizer=f=1200:t=q:w=1.0:g=-1.5,equalizer=f=2800:t=q:w=1.2:g=-3';

// Kurgu: segs = [{ at: videoSn, src: parçaSn }] — her parça, bir sonrakinin `at` anına kadar çalar; geçişler XF sn eşit güçlü çapraz geçiş.
// Kesim noktaları parçanın vuruş ızgarasında (ölçüm: muzik/SOURCES.md "Kurgu" satırları).
// rise: [[sn, dB], ...] doğrusal kazanç eğrisi (hüküm bölümüne yükseliş); fadeIn sn; sweep: açılışta alçak geçiren süzgeç açılması.
export const OPTIONS = {
  1: {
    name: 'Galactic Rap — Kevin MacLeod', file: 'muzik/kaynak/kmac-galactic-rap.mp3',
    // 120 bpm, ızgara 0,025 + 0,5k. Parça baştan çalar; 1:34'teki ton değişimi (≈95,9 sn) "Bana göre kazanan açık:" sonrasına düşer.
    segs: [{ at: 0, src: 0 }], fadeIn: 0.4,
    sweep: { t0: 0, t1: 5.6, f0: 380, f1: 16000 },   // kanca: boğuk/uzaktan başlar, "Evet, burası…" (5,76) ile tam açılır
    rise: [[0, 0], [84, 0], [95.5, 2.0], [117.6, 2.0]],
  },
  2: {
    name: 'Deep Haze — Kevin MacLeod', file: 'muzik/kaynak/kmac-deep-haze.mp3',
    // 120 bpm, 16 sn (8 ölçü) döngülü atmosferik giriş. 42,02'deki ölçü başı vuruşundan hemen önce (41,95) 25,95'e geri atlanır
    // (+16 sn = 32 vuruş; o noktada iki kopyanın spektral benzerliği 0,905). Çapraz geçiş 60 ms ve vuruştan önceki sessizlikte
    // (orijinalde −18 dB çukur), böylece 42,0'daki vuruş tek kopyadan gelir, ikiye katlanmaz.
    // Sonuç: vurmalılar videoda ≈63,5'te (döngü sahnesi) girer, tepe ≈88–112 (senaryo sonu + hüküm), çekilme ≈113 (maliyet cümlesi).
    segs: [{ at: 0, src: 0 }, { at: 41.95, src: 25.95 }], xf: 0.06, fadeIn: 0.15,
    // yükseliş parçanın kendi kurgusunda (vurmalı tepe zaten senaryo/hükümde); konuşma farkı 16 dB altına inmesin diye ek kazanç yok,
    // yalnız tepeden sonraki çekilmede (maliyet cümlesi) +1 dB ile alttaki pad taşınır
    rise: [[0, 0], [110, 0], [114, 1.0], [117.6, 1.0]],
  },
  3: {
    name: 'Roof Tops — HoliznaCC0', file: 'muzik/kaynak/holizna-roof-tops.mp3',
    // 80 bpm, ölçü 3 sn (ızgara 0'dan). 2,98 sn'den başlar: ilk akor videonun ilk karesinde, davul 9,0'da ("Evet, bu güzel ve kaotik semt…"),
    // ara (break) 57–69 (mareşal → "Peki…"), sonra dolgunlaşarak hükme akar.
    segs: [{ at: 0, src: 2.98 }], fadeIn: 0.02,
    rise: [[0, 0], [86, 0], [100, 1.5], [117.6, 1.5]],
  },
};
const FADE_OUT = [117.6, MUSIC_END];

// ---------- yardımcılar ----------
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const lin = (d) => Math.pow(10, d / 20);
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const [k, v] = argv[i].slice(2).split('=');
    if (v !== undefined) o[k] = v; else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true;
  }
  return o;
}
function ff(args, opts = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', ...args], { maxBuffer: 2 ** 31 - 1, ...opts });
  if (r.status !== 0) throw new Error(`ffmpeg hata: ${args.join(' ')}\n${r.stderr}`);
  return r;
}
function decode(file, ch, af = '') {
  const filt = `aresample=${SR}:resampler=soxr${af ? ',' + af : ''}`;
  const r = ff(['-i', file, '-af', filt, '-ac', String(ch), '-f', 'f32le', '-']);
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength - (b.byteLength % (4 * ch))));
}
function deinterleave(x, ch) {
  const n = x.length / ch, out = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = x[i * ch + c];
  return out;
}
function interleave(chs) {
  const n = chs[0].length, out = new Float32Array(n * chs.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < chs.length; c++) out[i * chs.length + c] = chs[c][i];
  return out;
}
function writeRaw(file, f32) { writeFileSync(file, Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength)); }
function writeWav(file, chs, codec = 'pcm_s24le') {
  const tmp = file + '.f32';
  writeRaw(tmp, interleave(chs));
  ff(['-y', '-f', 'f32le', '-ar', String(SR), '-ac', String(chs.length), '-i', tmp, '-c:a', codec, file]);
  rmSync(tmp);
}
function biquad(x, b0, b1, b2, a1, a2) { // yerinde değil, yeni dizi
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** BS.1770 K-ağırlığı (48 kHz) → 100 ms blok güçleri (kanallar toplamı) */
function kBlocks(chs) {
  const n = chs[0].length, H = SR / 10, nb = Math.floor(n / H), pow = new Float64Array(nb);
  for (const c of chs) {
    const s1 = biquad(c, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585);
    const s2 = biquad(s1, 1, -2, 1, -1.99004745483398, 0.99007225036621);
    for (let b = 0; b < nb; b++) { let s = 0; for (let i = b * H; i < (b + 1) * H; i++) s += s2[i] * s2[i]; pow[b] += s / H; }
  }
  return pow;
}
/** 400 ms anlık yükseklik (LUFS), 100 ms adımla; m[i] = [i*0.1-0.3, i*0.1+0.1) penceresi, merkezi i*0.1-0.1 */
function momentary(pow) {
  const m = new Float64Array(pow.length).fill(-120);
  for (let i = 3; i < pow.length; i++) m[i] = -0.691 + 10 * Math.log10(Math.max((pow[i] + pow[i - 1] + pow[i - 2] + pow[i - 3]) / 4, 1e-15));
  return m;
}
function integrated(pow) {
  const z = [];
  for (let i = 3; i < pow.length; i++) z.push((pow[i] + pow[i - 1] + pow[i - 2] + pow[i - 3]) / 4);
  const L = (p) => -0.691 + 10 * Math.log10(p);
  const g1 = z.filter((p) => L(p) > -70);
  const rel = L(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter((p) => L(p) > rel);
  return L(g2.reduce((a, b) => a + b, 0) / g2.length);
}
function quant(arr, q) { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; }
function ebur(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { maxBuffer: 2 ** 28 });
  const s = r.stderr.toString();
  const I = s.match(/I:\s+(-?[\d.]+) LUFS/), TP = s.match(/Peak:\s+(-?[\d.inf]+) dBFS/), LRA = s.match(/LRA:\s+(-?[\d.]+) LU/);
  return { I: I ? +I[1] : NaN, TP: TP ? +TP[1] : NaN, LRA: LRA ? +LRA[1] : NaN };
}

// ---------- kaynaklar ----------
function speechMask(nb1ms) {
  const tr = JSON.parse(readFileSync(P('work', 'transcript.json'), 'utf8'));
  const iv = tr.words.map((w) => [w.start - 0.12, w.end + 0.2]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of iv) {
    if (merged.length && a - merged[merged.length - 1][1] < 0.6) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b);
    else merged.push([a, b]);
  }
  const m = new Uint8Array(nb1ms);
  for (const [a, b] of merged) for (let i = Math.max(0, Math.floor(a * 1000)); i < Math.min(nb1ms, Math.ceil(b * 1000)); i++) m[i] = 1;
  return { mask: m, words: tr.words };
}
function pickVideo(arg) {
  if (arg && arg !== true) return { file: resolve(ROOT, arg), why: 'elle verildi (--video)' };
  const main = P('out', 'icerik.mp4'), prev = P('out', 'onceki', 'icerik.mp4');
  if (existsSync(main)) {
    const age = (Date.now() - statSync(main).mtimeMs) / 1000;
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', main]);
    if (age > 60 && probe.status === 0 && +probe.stdout.toString() > 100) return { file: main, why: 'out/icerik.mp4 (hazır)' };
  }
  if (existsSync(prev)) return { file: prev, why: 'out/onceki/icerik.mp4 (out/icerik.mp4 yok ya da yazılıyor)' };
  throw new Error('kaynak video yok');
}

// ---------- müzik yolu ----------
function buildMusic(opt, n) {
  const src = deinterleave(decode(P(opt.file), 2, EQ), 2);
  const tl = src[0].length;
  const out = [new Float32Array(n), new Float32Array(n)];
  const xf = opt.xf ?? 0.5, endN = Math.ceil(MUSIC_END * SR);
  opt.segs.forEach((s, k) => {
    const next = opt.segs[k + 1];
    const a = k === 0 ? 0 : s.at - xf / 2, b = next ? next.at + xf / 2 : MUSIC_END;
    for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(endN, Math.round(b * SR)); i++) {
      const t = i / SR, j = Math.round((t - s.at + s.src) * SR);
      if (j < 0 || j >= tl) continue;
      let w = 1;
      if (k > 0 && t < s.at + xf / 2) w *= Math.sin((Math.PI / 2) * ((t - (s.at - xf / 2)) / xf));
      if (next && t > next.at - xf / 2) w *= Math.cos((Math.PI / 2) * ((t - (next.at - xf / 2)) / xf));
      out[0][i] += w * src[0][j]; out[1][i] += w * src[1][j];
    }
  });
  if (opt.sweep) { // alçak geçiren süzgeç f0 → f1 (üstel), t1'den sonra 0,3 sn'de kuru sinyale çapraz geçiş
    const { t0, t1, f0, f1 } = opt.sweep, B = 32, xfEnd = t1 + 0.3;
    for (const c of out) {
      const dry = c.slice(0, Math.ceil(xfEnd * SR) + 1);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b1, b2, a1, a2;
      for (let i = 0; i < dry.length && i < c.length; i++) {
        if (i % B === 0) {
          const t = i / SR, k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
          const fc = f0 * Math.pow(f1 / f0, k), w0 = 2 * Math.PI * fc / SR, al = Math.sin(w0) / (2 * Math.SQRT1_2), cs = Math.cos(w0), a0 = 1 + al;
          b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0; a1 = -2 * cs / a0; a2 = (1 - al) / a0;
        }
        const v = b0 * dry[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = dry[i]; y2 = y1; y1 = v;
        const t = i / SR, m = t <= t1 ? 1 : Math.max(0, 1 - (t - t1) / 0.3);
        c[i] = m * v + (1 - m) * dry[i];
      }
    }
  }
  return out;
}
/** 1 ms çözünürlüklü kazanç eğrisi (dB, taban hariç) */
function gainCurve(opt, nb, mask, voice) {
  const g = new Float64Array(nb);
  // 1) konuşma boşluğunda açılma (konuşmaya girerken 40 ms, çıkarken 300 ms)
  let s = 0;
  for (let i = 0; i < nb; i++) {
    const target = mask[i] ? 0 : GAP_OPEN, tc = target < s ? 40 : 300;
    s += (target - s) * (1 - Math.exp(-1 / tc));
    g[i] = s - GAP_OPEN; // konuşmada −GAP_OPEN, boşlukta 0 (taban kalibrasyonu konuşmaya göre yapılır)
  }
  // 2) hece yan zinciri: ses düzeyi (10 ms RMS) ortancanın üstüne çıktıkça en çok SC_MAX dB ek kısma (atak 15 ms, bırakma 250 ms)
  const W = 48 * 10, lv = new Float64Array(nb);
  for (let i = 0; i < nb; i++) {
    let p = 0, c = 0;
    for (let j = Math.max(0, i * 48 - W / 2); j < Math.min(voice.length, i * 48 + W / 2); j++) { p += voice[j] * voice[j]; c++; }
    lv[i] = c ? 10 * Math.log10(p / c + 1e-15) : -150;
  }
  const act = []; for (let i = 0; i < nb; i++) if (mask[i] && lv[i] > -60) act.push(lv[i]);
  const med = quant(act, 0.5);
  let r = 0;
  for (let i = 0; i < nb; i++) {
    const want = Math.min(SC_MAX, Math.max(0, (lv[i] - (med - 6)) * 0.25)), tc = want > r ? 15 : 250;
    r += (want - r) * (1 - Math.exp(-1 / tc));
    g[i] -= r;
  }
  // 3) yükseliş, giriş/söniş
  const rise = opt.rise;
  for (let i = 0; i < nb; i++) {
    const t = i / 1000;
    let d = rise[rise.length - 1][1];
    for (let k = 1; k < rise.length; k++) if (t <= rise[k][0]) { const [t0, d0] = rise[k - 1], [t1, d1] = rise[k]; d = d0 + (d1 - d0) * (t - t0) / (t1 - t0); break; }
    g[i] += d;
  }
  return g;
}
function applyGain(chs, gdb, base, fadeIn) {
  const n = chs[0].length, out = chs.map((c) => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const t = i / SR, q = i / 48, k = Math.min(gdb.length - 2, Math.floor(q)), f = q - k;
    let a = lin(base + gdb[k] * (1 - f) + gdb[k + 1] * f);
    if (t < fadeIn) a *= Math.sin((Math.PI / 2) * (t / fadeIn));
    if (t >= FADE_OUT[0]) a *= t >= FADE_OUT[1] ? 0 : 0.5 * (1 + Math.cos(Math.PI * (t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0])));
    if (t >= FINAL_START) a = 0;
    for (let c = 0; c < chs.length; c++) out[c][i] = chs[c][i] * a;
  }
  return out;
}

// ---------- master ----------
function truePeakLimit(chs, ceilDb, tmpDir) {
  const n = chs[0].length, tmp = join(tmpDir, 'tp.f32');
  writeRaw(tmp, interleave(chs));
  const r = ff(['-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', tmp, '-af', `aresample=${SR * 4}:resampler=soxr`, '-f', 'f32le', '-']);
  rmSync(tmp);
  const up = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength - (r.stdout.byteLength % 8)));
  const ceil = lin(ceilDb), need = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    let m = Math.max(Math.abs(chs[0][i]), Math.abs(chs[1][i]));
    for (let k = 0; k < 8; k++) { const v = up[(i * 4) * 2 + k]; if (v !== undefined) m = Math.max(m, Math.abs(v)); }
    if (m > ceil) need[i] = ceil / m;
  }
  const R = 96; // 2 ms ileri bakış: min süzgeç (yarıçap R) + aynı genişlikte ortalama → her noktada kazanç ≤ gereken
  const mf = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) if (need[i] < 1) for (let j = Math.max(0, i - R); j <= Math.min(n - 1, i + R); j++) if (need[i] < mf[j]) mf[j] = need[i];
  const g = new Float32Array(n); let acc = 0;
  for (let i = 0; i < n + R; i++) { if (i < n) acc += mf[i]; if (i - 2 * R - 1 >= 0) acc -= mf[i - 2 * R - 1]; const c = i - R; if (c >= 0 && c < n) g[c] = acc / (Math.min(n - 1, c + R) - Math.max(0, c - R) + 1); }
  const rel = 1 - Math.exp(-1 / (0.08 * SR)); let s = 1, hits = 0, minG = 1;
  for (let i = 0; i < n; i++) { s = g[i] < s ? g[i] : s + (g[i] - s) * rel; g[i] = s; if (s < 0.999) hits++; if (s < minG) minG = s; }
  return { out: chs.map((c) => c.map((v, i) => v * g[i])), gain: g, limitedMs: hits / 48, maxGr: -dB(minG) };
}

// ---------- ana akış ----------
async function run(id, args) {
  const opt = OPTIONS[id];
  if (!opt) throw new Error(`bilinmeyen seçenek: ${id}`);
  const ara = P('muzik', 'ara'); mkdirSync(ara, { recursive: true }); mkdirSync(P('out', 'secenekler'), { recursive: true });
  console.log(`\n== Seçenek ${id}: ${opt.name}`);
  const audio = deinterleave(decode(P('work', 'audio.wav'), 2), 2);
  const n = audio[0].length, nb = Math.floor(n / 48);
  const voiceM = decode(P('work', 'voice.wav'), 1);
  const voice = new Float32Array(n); voice.set(voiceM.subarray(0, Math.min(n, voiceM.length)));
  // ses yolunun audio.wav içindeki kanal kazançları (en küçük kareler) → ses ve efekt (artık) tahmini
  const gch = audio.map((a) => { let xy = 0, xx = 0; for (let i = 0; i < voice.length; i++) { xy += a[i] * voice[i]; xx += voice[i] * voice[i]; } return xy / xx; });
  const vSt = gch.map((g) => voice.map((v) => v * g));
  const sfx = audio.map((a, c) => a.map((v, i) => v - vSt[c][i]));
  const { mask, words } = speechMask(nb);

  const music = buildMusic(opt, n);
  const gdb = gainCurve(opt, nb, mask, voice);
  // taban kalibrasyonu: konuşma pencerelerinde ses − müzik ortancası = TARGET_SPEECH_GAP
  const speechWin = (m) => { // momentary dizisinde, pencere merkezi bir kelimenin içinde olanlar
    const idx = [];
    for (let i = 3; i < m.length; i++) { const tc = i * 0.1 - 0.1; if (words.some((w) => tc >= w.start && tc <= w.end)) idx.push(i); }
    return idx;
  };
  const vMom = momentary(kBlocks(vSt));
  const sIdx = speechWin(vMom);
  const diffs = (mus) => { const mm = momentary(kBlocks(mus)); return { mm, d: sIdx.map((i) => vMom[i] - mm[i]) }; };
  let base = 0;
  for (let it = 0; it < 2; it++) {
    const { d } = diffs(applyGain(music, gdb, base, opt.fadeIn ?? 0.05));
    base += quant(d, 0.5) - TARGET_SPEECH_GAP;
  }
  const mus = applyGain(music, gdb, base, opt.fadeIn ?? 0.05);

  // master: toplam → −14 LUFS → gerçek tepe sınırlayıcı (iki tur: sınırlayıcı sonrası yükseklik düzeltmesi)
  const sum = audio.map((a, c) => a.map((v, i) => v + mus[c][i]));
  let G = MASTER_LUFS - integrated(kBlocks(sum)), lim, ceil = TP_CEIL;
  const out = P('muzik', `miks-${id}.wav`);
  for (let it = 0; it < 4; it++) {
    lim = truePeakLimit(sum.map((c) => c.map((v) => v * lin(G))), ceil, ara);
    const fi = FINAL_START * SR;
    for (const c of lim.out) c.fill(0, Math.ceil(fi));
    writeWav(out, lim.out);
    const m = ebur(out);
    console.log(`   tur ${it + 1}: ${m.I} LUFS, ${m.TP} dBTP (kazanç ${G.toFixed(2)} dB, tavan ${ceil})`);
    if (m.TP > -1.6) { ceil -= 0.2; continue; }
    if (Math.abs(m.I - MASTER_LUFS) > 0.1) { G += MASTER_LUFS - m.I; continue; }
    break;
  }
  const mg = lim.gain, Gl = lin(G);
  const musF = mus.map((c) => c.map((v, i) => v * Gl * mg[i]));
  writeWav(P('muzik', 'ara', `muzik-${id}-yalniz.wav`), musF);

  // ---------- ölçüm ----------
  const m = ebur(out);
  const fin = deinterleave(decode(out, 2), 2);
  let sp = 0, clip = 0, tailMax = 0; const fi = Math.ceil(FINAL_START * SR);
  for (const c of fin) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > sp) sp = a; if (a >= 0.99997) clip++; if (i >= fi && a > tailMax) tailMax = a; }
  const { mm, d } = diffs(mus);
  const gapIdx = []; for (let i = 3; i < mm.length; i++) { const tc = i * 0.1 - 0.1; if (tc < 119.6 && !mask[Math.floor(tc * 1000)] && mm[i] > -70) gapIdx.push(i); }
  const sfxMom = momentary(kBlocks(sfx));
  // efekt anları: tahmini efekt yolunun (audio − ses) anlık yüksekliği kendi üst çeyreğinde ve konuşma yokken ya da varken fark etmeksizin
  const sfxThr = quant([...sfxMom].filter((v) => v > -70), 0.75);
  const sfxIdx = []; for (let i = 3; i < sfxMom.length; i++) if (i * 0.1 < 119.6 && sfxMom[i] > sfxThr && mm[i] > -70) sfxIdx.push(i);
  const mIntAll = mm; // müzik anlık (master öncesi; fark ölçümleri ölçek bağımsız)
  const tlj = JSON.parse(readFileSync(P('work', 'timeline.json'), 'utf8'));
  const scenes = tlj.scenes.filter((s) => s.id !== 'final').map((s) => {
    const a = Math.ceil((s.start + 0.3) * 10), b = Math.floor((Math.min(s.end, FADE_OUT[0])) * 10);
    let p = 0, c = 0; for (let i = a; i < b; i++) { p += Math.pow(10, mIntAll[i] / 10); c++; }
    const dd = sIdx.filter((i) => i * 0.1 - 0.1 >= s.start && i * 0.1 - 0.1 < s.end).map((i) => vMom[i] - mm[i]);
    return { id: s.id, muzik_LUFS: +(10 * Math.log10(p / c) + G).toFixed(1), konusma_farki_dB: dd.length ? +quant(dd, 0.5).toFixed(1) : null };
  });
  const res = {
    secenek: id, parca: opt.name,
    integrated_LUFS: m.I, true_peak_dBTP: m.TP, LRA: m.LRA, sample_peak_dBFS: +dB(sp).toFixed(2), kirpilan_ornek: clip,
    final_sonrasi_max: tailMax,
    konusma_ses_eksi_muzik_dB: { ortanca: +quant(d, 0.5).toFixed(1), p10: +quant(d, 0.1).toFixed(1), p90: +quant(d, 0.9).toFixed(1) },
    konusmada_ses_LUFS_p10_p50_p90: [0.1, 0.5, 0.9].map((q) => +(quant(sIdx.map((i) => vMom[i]), q) + G).toFixed(1)),
    konusmada_muzik_LUFS_p10_p50_p90: [0.1, 0.5, 0.9].map((q) => +(quant(sIdx.map((i) => mm[i]), q) + G).toFixed(1)),
    bosluk_ses_ortancasi_eksi_muzik_dB: +(quant(sIdx.map((i) => vMom[i]), 0.5) - quant(gapIdx.map((i) => mm[i]), 0.5)).toFixed(1),
    efekt_eksi_muzik_dB_ortanca: +quant(sfxIdx.map((i) => sfxMom[i] - mm[i]), 0.5).toFixed(1),
    sinirlayici: { calisan_ms: Math.round(lim.limitedMs), en_fazla_kisma_dB: +lim.maxGr.toFixed(2) },
    sahne_basina_muzik_LUFS: scenes,
  };

  if (!args['yalniz-ses']) {
    const v = pickVideo(args.video);
    const mp4 = P('out', 'secenekler', `muzik-${id}.mp4`);
    const vd = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v.file]).stdout.toString();
    // ffmpeg'in yerleşik AAC kodlayıcısı bazı geçişlerde 192 kbps'de tepe taşması üretiyor (ölçüldü: +2,9 dBTP); tepe ≤ −1,5 olan
    // ilk bit hızı seçilir (render.mjs ile aynı 192k'dan başlar)
    let mm4, br;
    for (br of ['192k', '256k', '320k']) {
      ff(['-y', '-i', v.file, '-i', out, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', br, '-ar', String(SR),
        '-t', vd.toFixed(4), '-movflags', '+faststart', mp4]);
      mm4 = ebur(mp4);
      if (mm4.TP <= -1.5) break;
    }
    const dec = deinterleave(decode(mp4, 2), 2); let t4 = 0;
    for (const c of dec) for (let i = Math.ceil(120.3 * SR); i < c.length; i++) t4 = Math.max(t4, Math.abs(c[i]));
    res.video = { kaynak: v.why, cikti: `out/secenekler/muzik-${id}.mp4`, aac_bit_hizi: br, mp4_LUFS: mm4.I, mp4_true_peak_dBTP: mm4.TP, mp4_120_3sn_sonrasi_max: t4 };
    console.log(`   video: ${v.why} → out/secenekler/muzik-${id}.mp4`);
  }
  writeFileSync(P('muzik', `olcum-${id}.json`), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
}

const args = parseArgs(process.argv.slice(2));
if (!args.secenek) { console.log('kullanım: node tools/muzik.mjs --secenek 1|2|3 [--video yol] [--yalniz-ses]'); process.exit(1); }
for (const id of String(args.secenek).split(',')) await run(id.trim(), args);
