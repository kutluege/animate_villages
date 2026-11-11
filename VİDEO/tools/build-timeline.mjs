// work/transcript.json → work/timeline.json (sahne sınırları cümle başlarına göre, kare ızgarasına yuvarlı)
//   node tools/build-timeline.mjs
// `final` sahnesinin süresi YALNIZCA timeline.json'daki "duration" alanından gelir; bu betik mevcut değeri korur.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';

const FPS = 30;
// Her sahnenin İLK cümlesinin başı (küçük harf, noktalamasız önek) ve önerilen sahibi
const SCENES = [
  { id: 'hook', first: 'burası neresi', owner: 'sahne-ajani-1' },
  { id: 'gercek', first: 'evet burası her gün', owner: 'sahne-ajani-1' },
  { id: 'vaat', first: 'evet bu güzel ve kaotik', owner: 'sahne-ajani-1' },
  { id: 'baglam', first: 'bunu yaparken tek bir sohbette', owner: 'sahne-ajani-2' },
  { id: 'ekip', first: 'onun yerine bir ekip', owner: 'sahne-ajani-2' },
  { id: 'maresal', first: 'size de tavsiyem', owner: 'sahne-ajani-2' },
  { id: 'dongu', first: 'peki normalde', owner: 'sahne-ajani-2' },
  { id: 'senaryo', first: 'konuyu bilenler', owner: 'sahne-ajani-3' },
  { id: 'sonuc', first: 'sonuç ne mi oldu', owner: 'sahne-ajani-3' },
];
const LEAD = 0.2;   // sahne, ilk cümlesinden bu kadar önce başlar (ses başlamadan görüntü otursun)
const TAIL = 0.5;   // son konuşmadan sonra sessiz finale geçmeden önceki nefes

const tr = JSON.parse(readFileSync(join(ROOT, 'work', 'transcript.json'), 'utf8'));
const path = join(ROOT, 'work', 'timeline.json');
const old = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const finalDur = old?.scenes?.find((s) => s.id === 'final')?.duration ?? 32;
const snap = (t) => Math.round(t * FPS) / FPS;
const norm = (s) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

const starts = SCENES.map((s, i) => {
  const k = tr.sentences.findIndex((x) => norm(x.text).startsWith(s.first));
  if (k < 0) throw new Error(`${s.id}: "${s.first}" ile başlayan cümle yok`);
  if (i === 0) return { k, t: 0 };
  const prevEnd = tr.sentences[k - 1].end;
  return { k, t: snap(Math.max(prevEnd + 0.04, tr.sentences[k].start - LEAD)) };
});
const lastEnd = tr.words.at(-1).end;
const aEnd = snap(Math.max(lastEnd + TAIL, tr.duration));
const scenes = SCENES.map((s, i) => {
  const start = starts[i].t, end = i + 1 < SCENES.length ? starts[i + 1].t : aEnd;
  const k0 = starts[i].k, k1 = i + 1 < SCENES.length ? starts[i + 1].k : tr.sentences.length;
  return { id: s.id, start: +start.toFixed(4), end: +end.toFixed(4), owner: s.owner,
    said: tr.sentences.slice(k0, k1).map((x) => x.text).join(' ') };
});
scenes.push({ id: 'final', start: aEnd, duration: finalDur, owner: 'sahne-ajani-3', silent: true,
  said: '(sessiz) yan yana kıyas 8–10 sn, sonra Fable videosundan en iyi 20–25 sn; son kare kapak' });

const out = {
  note: 'Saniye. final.duration tek ayar noktasıdır (end hesaplanır). Sınırları elle oynatırsan tools/build-timeline.mjs yeniden çalıştırma.',
  fps: FPS, width: 1080, height: 1920, voice: 'work/voice.wav', voiceDuration: tr.duration,
  totalDuration: +(aEnd + finalDur).toFixed(4), scenes,
};
writeFileSync(path, JSON.stringify(out, null, 1));
console.log(scenes.map((s) => `${s.id} ${s.start.toFixed(2)}–${(s.end ?? s.start + s.duration).toFixed(2)}`).join(' | '));
console.log(`[timeline] toplam ${out.totalDuration.toFixed(2)} sn`);
