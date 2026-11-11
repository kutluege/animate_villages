// Seslendirme kurgusu: özgün work/voice.orig.wav + transcript.orig.json → work/voice.wav + transcript.json (+ voice.json, timeline.json)
//   node tools/edit-voice.mjs          (her çalıştırmada ÖZGÜNLERDEN yeniden kurar; tekrar çalıştırmak güvenli)
// İlk çalıştırmada voice.wav / transcript.json / voice.json / timeline.json dosyalarının özgünleri *.orig.* adıyla yedeklenir.
// Yaptıkları (sırayla; bütün zamanlar ÖZGÜN voice.wav saatine göre yazılır):
//   1) FIXES — transkriptteki kelime zamanlarını kayda göre düzeltir (ASR'nin sessizliğe/yanlış heceye yaydığı kelimeler; ölçüm: 5 ms RMS).
//   2) CUTS  — sözcük keser: [a, b) aralığı atılır, ek yeri XFADE sn çapraz geçişle birleşir (iki uç da oda sessizliğinde seçilir → tık yok),
//      sonrası öne kayar; kelime transkriptten silinir, sonraki kelime/cümle zamanları kayar, cümle başı büyük harfe çevrilir.
//   3) tools/build-timeline.mjs çalıştırılır (sahne sınırları yeni cümle başlarına göre).
// Sonra: node tools/mix.mjs (audio.wav) ve render. build-voice.mjs / build-transcript.py yeniden çalıştırılırsa bu betik de yeniden çalıştırılmalı.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';

const XFADE = 0.008;
/** Kelime zamanı düzeltmeleri: { i: kelime sırası (özgün transkript), text: denetim için, start?/end? } */
const FIXES = [
  { i: 3, text: 'mi?', end: 1.56 },            // "mi?" 1,56'da biter (transkript 1,45)
  { i: 6, text: 'ya.', end: 3.5 },             // "ya." 3,50'de biter (3,25)
  { i: 7, text: 'Burası', start: 4.03 },       // ikinci "Burası" 4,035'te başlar (3,41: ASR önceki sessizliğe yaymış)
  { i: 20, text: 'bu', start: 10.09, end: 10.17 },   // 9,89–10,05 "Evet"in güçlü /t/ patlaması; "bu" 10,08–10,09'da başlar
  { i: 21, text: 'güzel', start: 10.17, end: 10.39 },
  { i: 22, text: 've', start: 10.4 },
];
/** Kesimler: { i: silinecek kelime, text, a, b } — a: kelimeden hemen önceki oda sessizliği, b: sonraki kelimenin hemen öncesi */
const CUTS = [
  // "Evet, bu güzel ve kaotik semtin simülasyonunu Claude Code kullanarak gerçekleştirdim." cümlesinin başındaki "Evet,"
  // (kayıtta 9,69–10,07; /t/ patlaması 9,885–10,05). a = 9,656 (−60 dB oda sesi), b = 10,056 (−52 dB; "bu" 10,08'de başlar)
  // → tam 0,400 sn = 12 kare çıkar: sonraki bütün sahneler tam 12 kare öne kayar (kare ızgarası bozulmaz, sahne içi zamanlar aynı kalır);
  // "bu" eski "Evet"in başladığı yere (9,68) oturur, önceki cümleyle arası 0,48 sn (özgündeki nefes payı).
  { i: 19, text: 'Evet,', a: 9.656, b: 10.056 },
];

const W = (f) => join(ROOT, 'work', f);
for (const [cur, orig] of [['voice.wav', 'voice.orig.wav'], ['transcript.json', 'transcript.orig.json'], ['voice.json', 'voice.orig.json'], ['timeline.json', 'timeline.orig.json']]) {
  if (!existsSync(W(orig))) { copyFileSync(W(cur), W(orig)); console.log(`[edit-voice] yedek: work/${orig}`); }
}

// ---- WAV oku (PCM s16) ----
const buf = readFileSync(W('voice.orig.wav'));
let off = 12, fmt = null, data = null;
while (off + 8 <= buf.length) {
  const id = buf.toString('ascii', off, off + 4), len = buf.readUInt32LE(off + 4);
  if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(off + 10), sr: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22), tag: buf.readUInt16LE(off + 8) };
  if (id === 'data') { data = buf.subarray(off + 8, off + 8 + len); break; }
  off += 8 + len + (len & 1);
}
if (!fmt || !data || fmt.tag !== 1 || fmt.bits !== 16 || fmt.ch !== 1) throw new Error('voice.orig.wav: 16 bit mono PCM bekleniyor');
const SR = fmt.sr;
let x = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength - (data.byteLength % 2)));
const origDur = x.length / SR;

// ---- transkript: düzeltmeler ----
const tr = JSON.parse(readFileSync(W('transcript.orig.json'), 'utf8'));
const words = tr.words.map((w) => ({ ...w }));
const chk = (i, text) => { if (words[i]?.text !== text) throw new Error(`kelime ${i} "${text}" bekleniyordu, "${words[i]?.text}" bulundu (transcript.orig.json değişmiş)`); };
const notes = [];
for (const f of FIXES) {
  chk(f.i, f.text);
  const w = words[f.i], was = `${w.start}–${w.end}`;
  if (f.start !== undefined) w.start = f.start;
  if (f.end !== undefined) w.end = f.end;
  notes.push(`kayda göre zaman düzeltmesi: "${f.text}" (kelime ${f.i}) ${was} → ${w.start}–${w.end}`);
}

// ---- kesimler (sondan başa: özgün saat bozulmasın) ----
const r3 = (v) => +v.toFixed(3);
const removed = new Set(), edits = [];
const shiftAt = []; // { b, d }: özgün saatte b'den sonraki her şey d kadar öne kayar
for (const c of [...CUTS].sort((p, q) => q.a - p.a)) {
  chk(c.i, c.text);
  const n = Math.round(XFADE * SR), ia = Math.round(c.a * SR), ib = Math.round(c.b * SR);
  const w = words[c.i], nx = words[c.i + 1], pv = words[c.i - 1];
  if (!(pv.end <= c.a && c.a <= w.start + 0.03 && w.end <= c.b + 0.4 && c.b <= nx.start + 0.01)) throw new Error(`kesim ${c.text}: a/b kelime sınırlarıyla uyuşmuyor`);
  const out = new Int16Array(x.length - (ib - ia));
  out.set(x.subarray(0, ia), 0);
  for (let k = 0; k < n; k++) { const g = k / n; out[ia + k] = Math.round(x[ia + k] * (1 - g) + x[ib + k] * g); } // çapraz geçiş
  out.set(x.subarray(ib + n), ia + n);
  x = out;
  const d = (ib - ia) / SR;
  shiftAt.push({ b: c.b, d });
  removed.add(c.i);
  edits.push({ type: 'cut', word: c.text, wordIndex: c.i, from: c.a, to: c.b, removed: r3(d), xfade: XFADE });
  notes.push(`kesildi: "${c.text}" (kelime ${c.i}, özgün ${w.start}–${w.end}); ${c.a}–${c.b} sn atıldı (${d.toFixed(3)} sn), sonrası öne kaydı`);
}
const map = (t) => r3(t - shiftAt.reduce((s, c) => s + (t >= c.b - 1e-6 ? c.d : t > c.b - c.d ? Math.max(0, t - (c.b - c.d)) : 0), 0));

// ---- yeni kelimeler + cümleler ----
const idx = new Map(); // özgün sıra → yeni sıra
const newWords = [];
words.forEach((w, i) => { if (removed.has(i)) return; idx.set(i, newWords.length); newWords.push({ ...w, start: map(w.start), end: map(w.end) }); });
const cap = (s) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
const sentences = [];
for (const s of tr.sentences) {
  const ks = []; for (let i = s.w0; i <= s.w1; i++) if (idx.has(i)) ks.push(idx.get(i));
  if (!ks.length) continue;
  if (removed.has(s.w0)) newWords[ks[0]].text = cap(newWords[ks[0]].text); // cümle başındaki sözcük gitti → yeni ilk sözcük büyük harfle
  const ws = ks.map((k) => newWords[k]);
  sentences.push({ ...s, text: ws.map((w) => w.text).join(' '), start: ws[0].start, end: ws[ws.length - 1].end, w0: ks[0], w1: ks[ks.length - 1] });
}
for (let i = 1; i < newWords.length; i++) if (newWords[i].start < newWords[i - 1].start) throw new Error(`kelime sırası bozuldu: ${i} "${newWords[i].text}"`);
const newDur = r3(x.length / SR);

// ---- yaz ----
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + x.length * 2, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
head.writeUInt16LE(1, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(x.length * 2, 40);
writeFileSync(W('voice.wav'), Buffer.concat([head, Buffer.from(x.buffer, x.byteOffset, x.byteLength)]));
writeFileSync(W('transcript.json'), JSON.stringify({ ...tr, duration: newDur,
  note: tr.note + ' tools/edit-voice.mjs ile kurgulandı (özgün: transcript.orig.json / voice.orig.wav).',
  words: newWords, sentences, corrections: [...(tr.corrections || []), ...notes] }, null, 1));
const vj = JSON.parse(readFileSync(W('voice.orig.json'), 'utf8'));
writeFileSync(W('voice.json'), JSON.stringify({ ...vj, duration: newDur, original: { file: 'work/voice.orig.wav', duration: r3(origDur) }, edits,
  cuts: vj.cuts.map((c) => ({ ...c, outStart: map(c.outStart), outEnd: map(c.outEnd) })) }, null, 1));
for (const n of notes) console.log('[edit-voice] ' + n);
console.log(`[edit-voice] ✓ work/voice.wav ${origDur.toFixed(3)} → ${newDur.toFixed(3)} sn · ${tr.words.length} → ${newWords.length} kelime`);

const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'build-timeline.mjs')], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('build-timeline başarısız');
