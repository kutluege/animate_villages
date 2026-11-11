// work/voice.wav + sahnelerin sfx ipuçları → work/audio.wav (48 kHz stereo, video süresi kadar; sessiz sahneler tamamen sessiz)
//   node tools/mix.mjs                 (ipuçlarını sayfadan okur: window.__sfx)
//   node tools/mix.mjs --list          (yalnızca ipuçlarını yazdır)
//   node tools/mix.mjs --report [dosya] (ipucu başına efekt/ses düzeyi tablosu; vars. out/mix-report.txt)
// MİKS KURALI (ses her zaman önde; efektler duyulur ama ölçülü bir bantta). S = konuşmanın etkin RMS'i, Pv = sesin tepe değeri.
//   1) Bant: her ipucunun düzeyi (en yüksek 125 ms RMS; kısa tıkırtılarda tepe−14 dB) [S−7, S−2] dB'ye çekilir —
//      kısık efekt (riser/swell/tık) duyulur düzeye yükseltilir, çok yüksek olan indirilir; aradaki `gain` niyeti korunur.
//   2) Yan zincir (duck): konuşma varken efekt yolunun 125 ms RMS'i yerel ses düzeyinin (±0,5 sn) en az 6 dB altında, tepesi Pv−4 dB
//      altında tutulur; o andaki en yumuşak heceye (±150 ms, ≥ S−12) de 6 dB'den fazla yaklaşamaz.
//      Konuşma boşluğunda (≥ ~0,7 sn) efektler daha açık: tavan S−2 dB RMS / Pv−2,5 dB tepe. Kazanç 20 ms önden bakar, yumuşak döner.
//      Hedef (denetçi ölçümü, 125 ms pencere): konuşmada efekt−ses ortancası ≈ −12 dB.
//   3) Master: toplam −14 LUFS'e getirilir, gerçek tepe ≤ −1,5 dBTP (ses/efekt dengesi değişmez); sessiz sahneler tam sıfır.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, openBrowser, openComp, parseArgs } from './lib-browser.mjs';

const SR = 48000, HOP = 48; // blok = 1 ms
export const MASTER = { lufs: -14, truePeak: -1.5 }; // bütünleşik yükseklik (LUFS) ve gerçek tepe tavanı (dBTP)
export const MIX = { bandLo: -7, bandHi: -2, speechMargin: 6, softMargin: 6, gapCeil: -2, peakSpeech: -4, peakGap: -2.5, crest: 14 };
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9)), dBp = (p) => 10 * Math.log10(Math.max(p, 1e-18)), lin = (d) => Math.pow(10, d / 20);

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-af', 'aformat=sample_rates=48000:channel_layouts=stereo', '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 - 1 });
  if (r.status !== 0) throw new Error(`ffmpeg çözemedi: ${file}\n${r.stderr}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength - (r.stdout.byteLength % 8)));
}
/** Araya girmiş stereo → 1 ms'lik bloklar: ortalama güç ve tepe */
function blocks(x, nb = Math.ceil(x.length / 2 / HOP)) {
  const pow = new Float64Array(nb), pk = new Float64Array(nb);
  for (let b = 0; b < nb; b++) {
    let s = 0, m = 0;
    const e = Math.min(x.length, (b + 1) * HOP * 2);
    for (let i = b * HOP * 2; i < e; i++) { const v = x[i]; s += v * v; const a = v < 0 ? -v : v; if (a > m) m = a; }
    pow[b] = s / (HOP * 2); pk[b] = m;
  }
  return { pow, pk };
}
function slideMean(a, w) { // ortalanmış, w blok
  const n = a.length, pre = new Float64Array(n + 1), out = new Float64Array(n), h = w >> 1;
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1); out[i] = (pre[hi] - pre[lo]) / (hi - lo); }
  return out;
}
function slideExt(a, r, max) { // ±r blokta en büyük/en küçük
  const n = a.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = a[i];
    for (let j = Math.max(0, i - r), e = Math.min(n - 1, i + r); j <= e; j++) if (max ? a[j] > m : a[j] < m) m = a[j];
    out[i] = m;
  }
  return out;
}
/** Bir efektin düzeyi (dB): en yüksek 125 ms RMS ile (tepe − crest) büyüğü */
function cueLevel(x) {
  const { pow, pk } = blocks(x);
  const fast = slideMean(pow, Math.min(125, pow.length | 1));
  let f = 0, p = 0;
  for (let i = 0; i < pow.length; i++) { if (fast[i] > f) f = fast[i]; if (pk[i] > p) p = pk[i]; }
  return { level: Math.max(dBp(f), dB(p) - MIX.crest), fast: dBp(f), peak: dB(p) };
}

/** cues: [{ t (global sn), name, gain }], timeline: [{ id, start, end, silent }] */
export async function mixAudio({ cues, duration, timeline, out = join(ROOT, 'work', 'audio.wav'), report = null, log = console.log }) {
  const voiceFile = join(ROOT, 'work', 'voice.wav');
  if (!existsSync(voiceFile)) throw new Error('work/voice.wav yok — önce node tools/build-voice.mjs');
  const silent = timeline.filter((s) => s.silent);
  const inSilent = (t) => silent.some((s) => t >= s.start - 1e-6 && t < s.end);
  const ok = [], missing = new Set();
  for (const c of cues) {
    if (!existsSync(join(ROOT, 'sfx', `${c.name}.wav`))) { missing.add(c.name); continue; }
    if (inSilent(c.t) || c.t >= duration) continue;
    ok.push({ ...c });
  }
  if (missing.size) log(`[mix] uyarı: sfx dosyası yok → atlandı: ${[...missing].join(', ')}`);

  const N = Math.round(duration * SR), NB = Math.ceil(N / HOP);
  const voice = new Float32Array(N * 2);
  voice.set(decode(voiceFile).subarray(0, N * 2));

  // ---- Ses: etkinlik, S (etkin RMS), Pv (tepe), yerel düzey ----
  const vb = blocks(voice, NB), v30 = slideMean(vb.pow, 30);
  let sp = 0, sn = 0, Pv = 0;
  for (let b = 0; b < NB; b++) { if (v30[b] > 1e-4 * 0.316) { sp += vb.pow[b]; sn++; } if (vb.pk[b] > Pv) Pv = vb.pk[b]; } // kaba eşik −45 dBFS
  const S = dBp(sp / Math.max(1, sn)), PvDb = dB(Pv);
  const active = new Float64Array(NB);
  for (let b = 0; b < NB; b++) active[b] = dBp(v30[b]) > S - 25 ? 1 : 0;
  const A = slideMean(slideExt(active, 350, true), 120);            // 350 ms tutma + 120 ms yumuşatma: 0 = boşluk, 1 = konuşma
  const actPow = new Float64Array(NB); for (let b = 0; b < NB; b++) actPow[b] = vb.pow[b] * active[b];
  const num = slideMean(actPow, 1001), den = slideMean(active, 1001); // ±0,5 sn'de etkin konuşmanın düzeyi
  const vloc = new Float64Array(NB);
  for (let b = 0; b < NB; b++) vloc[b] = den[b] > 0.08 ? Math.min(S + 2, Math.max(S - 10, dBp(num[b] / den[b]))) : S;
  const vmin = slideExt(vloc, 300, false);
  const n3 = slideMean(actPow, 301), d3 = slideMean(active, 301);   // aynı andaki ses: ±150 ms'deki etkin konuşmanın RMS'i
  const vsoft = new Float64Array(NB);                                // konuşma sayılan (≥ S−12) en yumuşak hece; yoksa etkisiz (+∞)
  for (let b = 0; b < NB; b++) { const v = d3[b] >= 0.3 ? dBp(n3[b] / d3[b]) : 99; vsoft[b] = v > S - 12 ? v : 99; }
  const vsoftMin = slideMean(slideExt(vsoft, 250, false), 151);

  // ---- Efekt yolu: bant içine çekilmiş ipuçları ----
  const bus = new Float32Array(N * 2), files = new Map(), rows = [];
  for (const c of ok) {
    if (!files.has(c.name)) { const x = decode(join(ROOT, 'sfx', `${c.name}.wav`)); files.set(c.name, { x, ...cueLevel(x) }); }
    const f = files.get(c.name), g0 = Number(c.gain ?? 1), raw = f.level + dB(g0) - S;
    const adj = Math.min(MIX.bandHi, Math.max(MIX.bandLo, raw)) - raw;
    const g = g0 * lin(adj), i0 = Math.max(0, Math.round(c.t * SR));
    // sfx sessiz bölüme taşmasın: sessiz sahne başlangıcında (ya da video sonunda) 30 ms'de söner
    const nextSilent = silent.map((s) => s.start).filter((s) => s > c.t).sort((a, b) => a - b)[0];
    const len = Math.max(0, Math.min(f.x.length / 2, Math.round((nextSilent ?? duration) * SR) - i0, N - i0));
    const fade = Math.min(len, Math.round(0.03 * SR)), cut = len < f.x.length / 2;
    for (let i = 0; i < len; i++) {
      const k = cut && i >= len - fade ? (len - i) / fade : 1;
      bus[(i0 + i) * 2] += f.x[i * 2] * g * k; bus[(i0 + i) * 2 + 1] += f.x[i * 2 + 1] * g * k;
    }
    rows.push({ ...c, raw, adj, len: len / SR });
  }

  // ---- Yan zincir: konuşma varken tavan = yerel ses − margin; boşlukta S + gapCeil ----
  const bb = blocks(bus, NB), fast = slideMean(bb.pow, 125), pkEnv = slideExt(bb.pk, 8, true);
  const gT = new Float64Array(NB);
  for (let b = 0; b < NB; b++) {
    const a = A[b];
    const ceilR = Math.min(a * (vmin[b] - MIX.speechMargin) + (1 - a) * (S + MIX.gapCeil), vsoftMin[b] - MIX.softMargin);
    const ceilP = PvDb + a * MIX.peakSpeech + (1 - a) * MIX.peakGap;
    gT[b] = Math.min(1, lin(ceilR) / Math.max(Math.sqrt(fast[b]), 1e-9), lin(ceilP) / Math.max(pkEnv[b], 1e-9));
  }
  const gS = slideMean(slideExt(gT, 20, false), 21);
  const mix = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const p = i / HOP - 0.5, b0 = Math.max(0, Math.min(NB - 1, Math.floor(p))), b1 = Math.min(NB - 1, b0 + 1), fr = Math.max(0, Math.min(1, p - b0));
    const g = gS[b0] + (gS[b1] - gS[b0]) * fr;
    bus[i * 2] *= g; bus[i * 2 + 1] *= g;
    mix[i * 2] = voice[i * 2] + bus[i * 2]; mix[i * 2 + 1] = voice[i * 2 + 1] + bus[i * 2 + 1];
  }
  for (const s of silent) mix.fill(0, Math.max(0, Math.floor(s.start * SR)) * 2, Math.min(N, Math.ceil(s.end * SR)) * 2);

  // ---- Yaz (master): bütünleşik yükseklik MASTER.lufs'a getirilir, gerçek tepe ≤ MASTER.truePeak (4× örneklemede sınırlayıcı);
  //      ses/efekt dengesi değişmez (kazanç toplamda). Ölç → düzelt döngüsü; sessiz bölümler tam sıfır. ----
  mkdirSync(dirname(out), { recursive: true });
  const tmp = out + '.tmp.f32';
  writeFileSync(tmp, Buffer.from(mix.buffer, mix.byteOffset, mix.byteLength));
  const mute = silent.map((s) => `volume=enable='between(t,${s.start.toFixed(4)},${s.end.toFixed(4)})':volume=0`).join(',');
  const rawIn = ['-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', tmp];
  const loud = (input) => {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...input, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { maxBuffer: 2 ** 28 }).stderr.toString();
    const I = [...r.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop(), P = [...r.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop();
    if (!I || !P) throw new Error('yükseklik ölçülemedi (ffmpeg ebur128)');
    return { I: Number(I[1]), TP: Number(P[1]) };
  };
  let master = null;
  try {
    const src = loud(rawIn);
    let gain = MASTER.lufs - src.I, ceil = MASTER.truePeak - 0.3;
    for (let pass = 0; pass < 5; pass++) {
      const af = `volume=${gain.toFixed(3)}dB,aresample=${SR * 4},alimiter=limit=${lin(ceil).toFixed(5)}:attack=5:release=80:level=0,aresample=${SR},` +
        `atrim=start=0.005,asetpts=PTS-STARTPTS,apad=whole_dur=${duration.toFixed(4)}` + // sınırlayıcının 5 ms önden bakma gecikmesini geri al
        `${mute ? ',' + mute : ''},atrim=0:${duration.toFixed(4)}`;
      const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...rawIn, '-af', af, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', out]);
      if (r.status !== 0) throw new Error('ffmpeg master başarısız: ' + r.stderr.toString().slice(-600));
      const m = loud(['-i', out]);
      master = { before: src, after: m, gain, ceil, passes: pass + 1 };
      const okI = Math.abs(m.I - MASTER.lufs) <= 0.1, okP = m.TP <= MASTER.truePeak;
      if (okI && okP) break;
      if (!okI) gain += MASTER.lufs - m.I;
      if (!okP) ceil -= m.TP - MASTER.truePeak + 0.1;
    }
  } finally { rmSync(tmp, { force: true }); }

  // ---- Sayısal doğrulama: ipucu başına son efekt düzeyi ↔ aynı andaki ses ----
  const fb = blocks(bus, NB), ffast = slideMean(fb.pow, 125);
  const st = { speech: [], gap: [], bad: 0, quiet: 0, maxPkSpeech: -99, maxPkGap: -99 };
  const lines = [`S (konuşma etkin RMS) ${S.toFixed(1)} dBFS · Pv (ses tepe) ${PvDb.toFixed(1)} dBFS · bant [S${MIX.bandLo}, S${MIX.bandHi}] · konuşmada ≤ yerel ses −${MIX.speechMargin} dB · boşlukta ≤ S${MIX.gapCeil}`,
    '     t  sahne    efekt               gain  bant-ayarı  efekt-düz.  efekt-tepe   ses-RMS   fark(dB)  durum   (efekt-düz. = en yüksek 125 ms RMS; tıkırtıda tepe−14)'];
  for (const r of rows) {
    const b0 = Math.min(NB - 1, Math.floor(r.t * 1000)), b1 = Math.min(NB, b0 + Math.max(60, Math.round(Math.min(r.len, 2) * 1000)));
    // Konuşma anı: o blokta ±150 ms'nin ≥ %30'u etkin ses ve düzeyi > S−12 (nefes/sözcük kuyruğu konuşma sayılmaz).
    // fark = pencere içinde AYNI ANDAKİ (efekt 125 ms RMS − ses) farkının en büyüğü; konuşma yoksa efekt − S.
    let f = 0, p = 0, worst = -Infinity, ref = S, vn = 0;
    for (let b = b0; b < b1; b++) {
      if (ffast[b] > f) f = ffast[b]; if (fb.pk[b] > p) p = fb.pk[b];
      if (d3[b] < 0.3) continue;
      const v = dBp(n3[b] / d3[b]);
      if (v <= S - 12) continue;
      vn++;
      const dd = dBp(ffast[b]) - v;
      if (dd > worst) { worst = dd; ref = v; }
    }
    const speech = vn >= 60, lvl = Math.max(dBp(f), dB(p) - MIX.crest), d = speech ? worst : lvl - S;
    if (!speech) ref = S;
    let flag = '';
    if (speech) { st.speech.push(d); st.maxPkSpeech = Math.max(st.maxPkSpeech, dB(p)); if (d > -3.5) { flag = 'YÜKSEK'; st.bad++; } }
    else { st.gap.push(d); st.maxPkGap = Math.max(st.maxPkGap, dB(p)); if (d > MIX.gapCeil + 1) { flag = 'YÜKSEK'; st.bad++; } }
    if (lvl - S < -20) { flag = 'kısık'; st.quiet++; }
    lines.push(`${r.t.toFixed(2).padStart(7)}  ${String(r.scene || '').padEnd(8)} ${r.name.padEnd(18)} ${Number(r.gain ?? 1).toFixed(2).padStart(5)}  ${(r.adj >= 0 ? '+' : '') + r.adj.toFixed(1).padStart(r.adj >= 0 ? 4 : 5)} dB   ${lvl.toFixed(1).padStart(7)}    ${dB(p).toFixed(1).padStart(7)}   ${(speech ? ref.toFixed(1) : 'boşluk').padStart(7)}   ${d.toFixed(1).padStart(7)}   ${flag}`);
  }
  // Bağımsız denetçinin ölçümü: üst üste binmeyen 125 ms pencereler; efekt yolu RMS'i − aynı penceredeki ses RMS'i
  const wd = [], wg = [], ws = [];
  for (let b = 0; b + 125 <= NB; b += 125) {
    let e = 0, v = 0;
    for (let k = b; k < b + 125; k++) { e += fb.pow[k]; v += vb.pow[k]; }
    const ed = dBp(e / 125), vd = dBp(v / 125);
    if (ed <= -45) continue;
    if (vd > -45) wd.push(ed - vd); else wg.push(ed - S);
    if (vd > S - 12) ws.push(ed - vd);
  }
  const q = (a, k) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(1) : '—');
  const sum = [`konuşma üstü ${st.speech.length} ipucu: efekt−ses farkı en çok ${q(st.speech, 1)} / ortanca ${q(st.speech, 0.5)} / en az ${q(st.speech, 0)} dB · efekt tepe ≤ ${st.maxPkSpeech.toFixed(1)} dBFS (ses tepe ${PvDb.toFixed(1)})`,
    `boşlukta ${st.gap.length} ipucu: efekt−S farkı en çok ${q(st.gap, 1)} / ortanca ${q(st.gap, 0.5)} / en az ${q(st.gap, 0)} dB · efekt tepe ≤ ${st.maxPkGap.toFixed(1)} dBFS`,
    `125 ms pencere ölçümü (efekt > −45 dBFS): konuşmada ${wd.length} pencere, efekt−ses ortanca ${q(wd, 0.5)} / p90 ${q(wd, 0.9)} dB; belirgin konuşmada (ses > S−12, ${ws.length} pencere) ortanca ${q(ws, 0.5)} / en çok ${q(ws, 1)} dB · boşlukta ${wg.length} pencere, efekt−S ortanca ${q(wg, 0.5)} / en çok ${q(wg, 1)} dB`,
    `master: ${master.before.I.toFixed(1)} → ${master.after.I.toFixed(1)} LUFS (hedef ${MASTER.lufs}) · gerçek tepe ${master.before.TP.toFixed(1)} → ${master.after.TP.toFixed(1)} dBTP (tavan ${MASTER.truePeak}) · kazanç ${master.gain >= 0 ? '+' : ''}${master.gain.toFixed(2)} dB, ${master.passes} geçiş`,
    `kural dışı (konuşmada efekt aynı andaki sese 3,5 dB'den yakın / boşlukta S${MIX.gapCeil + 1} dB üstü): ${st.bad} · çok kısık (efekt düzeyi < S−20): ${st.quiet}`];
  if (report) { mkdirSync(dirname(report), { recursive: true }); writeFileSync(report, [...lines, '', ...sum].join('\n') + '\n'); }
  for (const s of sum) log(`[mix] ${s}`);
  log(`[mix] ✓ ${out.replace(ROOT, '').replace(/^[\\/]/, '')}  ${duration.toFixed(2)} sn, ${ok.length} sfx ipucu${report ? ` · tablo: ${report.replace(ROOT, '').replace(/^[\\/]/, '')}` : ''}`);
  return { used: ok.length, missing: [...missing], S, Pv: PvDb, stats: st, master };
}

/** Sayfadan ipuçlarını oku */
export async function readCues(env) {
  const { page } = await openComp(env, { width: 270, height: 480, log: false });
  const r = await page.evaluate(() => ({ cues: window.__sfx, duration: window.__duration, timeline: window.__timeline }));
  await page.close();
  return r;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  const env = await openBrowser();
  let code = 0;
  try {
    const r = await readCues(env);
    if (args.list) for (const c of r.cues) console.log(`${c.t.toFixed(3).padStart(8)}  ${c.scene.padEnd(8)} ${c.name} ×${c.gain}`);
    else await mixAudio({ ...r, report: args.report ? resolve(ROOT, args.report === true ? 'out/mix-report.txt' : String(args.report)) : null });
  } catch (e) { console.error('[mix] başarısız:', e.message); code = 1; } finally { await env.close(); }
  process.exit(code);
}
