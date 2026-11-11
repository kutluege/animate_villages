// 1.mp3 … 7.mp3 → work/voice.wav (kırpılmış, art arda, loudnorm) + work/voice.json (kesim tablosu: kaynak→voice saati)
//   node tools/build-voice.mjs
// Her kaydın baştaki/sondaki sessizliği kırpılır (konuşmaya PAD_IN/PAD_OUT pay bırakılır), aralara GAP sn sessizlik konur.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';

const CLIPS = ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3', '7.mp3'];
const PAD_IN = 0.12, PAD_OUT = 0.18, GAP = 0.2, SR = 48000;
const NOISE_DB = -50;   // bu düzeyin altı sessizlik sayılır
const BLIP = 0.55;      // kaydın başındaki/sonundaki bundan kısa ses (tık, nefes) atılır — ardından ≥0.3 sn sessizlik varsa
const TARGET = { I: -15, TP: -1.5, LRA: 11 };

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('error', fail);
    p.on('exit', (c) => (c === 0 ? ok({ out, err }) : fail(new Error(`${cmd} ${c}\n${err.slice(-2000)}`))));
  });
}

async function analyse(file) {
  const dur = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).out.trim());
  const { err } = await run('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${NOISE_DB}dB:d=0.25`, '-f', 'null', '-']);
  const sil = [];
  let s = null;
  for (const line of err.split('\n')) {
    const a = /silence_start: ([\d.]+)/.exec(line); if (a) s = Number(a[1]);
    const b = /silence_end: ([\d.]+)/.exec(line); if (b) { sil.push([s ?? 0, Number(b[1])]); s = null; }
  }
  if (s !== null) sil.push([s, dur]);
  // konuşma aralıkları = sessizliklerin tümleyeni
  const speech = [];
  let cur = 0;
  for (const [a, b] of sil) { if (a > cur + 1e-3) speech.push([cur, a]); cur = b; }
  if (cur < dur - 1e-3) speech.push([cur, dur]);
  // baştaki/sondaki kısa "blip"leri at
  while (speech.length > 1 && speech[0][1] - speech[0][0] < BLIP && speech[1][0] - speech[0][1] >= 0.3) speech.shift();
  while (speech.length > 1 && speech.at(-1)[1] - speech.at(-1)[0] < BLIP && speech.at(-1)[0] - speech.at(-2)[1] >= 0.3) speech.pop();
  return { dur, sil, speech, on: speech[0][0], off: speech.at(-1)[1] };
}

const work = join(ROOT, 'work');
mkdirSync(work, { recursive: true });
const cuts = [];
let t = 0;
for (const f of CLIPS) {
  const a = await analyse(join(ROOT, f));
  const srcStart = Math.max(0, a.on - PAD_IN), srcEnd = Math.min(a.dur, a.off + PAD_OUT);
  if (cuts.length) t += GAP;
  cuts.push({ file: f, srcDur: +a.dur.toFixed(3), srcStart: +srcStart.toFixed(3), srcEnd: +srcEnd.toFixed(3),
    outStart: +t.toFixed(3), outEnd: +(t + srcEnd - srcStart).toFixed(3), speechOn: +a.on.toFixed(3), speechOff: +a.off.toFixed(3),
    silences: a.sil.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]) });
  t += srcEnd - srcStart;
  console.log(`[voice] ${f}: ${srcStart.toFixed(2)}–${srcEnd.toFixed(2)} (kaynak ${a.dur.toFixed(2)} sn) → ${cuts.at(-1).outStart.toFixed(2)}–${cuts.at(-1).outEnd.toFixed(2)}`);
}

// Filtre: her kayıt → kırp, 48k mono, 10 ms kenar yumuşatma, highpass; aralara sessizlik; birleştir
const inputs = CLIPS.flatMap((f) => ['-i', join(ROOT, f)]);
const parts = [];
let chain = '';
cuts.forEach((c, i) => {
  const len = c.srcEnd - c.srcStart;
  chain += `[${i}:a]atrim=start=${c.srcStart}:end=${c.srcEnd},asetpts=PTS-STARTPTS,aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=mono,` +
    `highpass=f=70,afade=t=in:d=0.01,afade=t=out:st=${(len - 0.015).toFixed(3)}:d=0.015,apad=pad_dur=${i < cuts.length - 1 ? GAP : 0}[c${i}];`;
  parts.push(`[c${i}]`);
});
chain += `${parts.join('')}concat=n=${cuts.length}:v=0:a=1,acompressor=threshold=-26dB:ratio=2.5:attack=8:release=150:knee=6[cat]`;
const tmp = join(work, 'voice-raw.wav');
await run('ffmpeg', ['-y', '-hide_banner', ...inputs, '-filter_complex', chain, '-map', '[cat]', '-c:a', 'pcm_s16le', tmp]);

// İki geçişli loudnorm (doğrusal)
const ln = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
const m1 = (await run('ffmpeg', ['-hide_banner', '-i', tmp, '-af', ln + ':print_format=json', '-f', 'null', '-'])).err;
const js = JSON.parse(m1.slice(m1.lastIndexOf('{'), m1.lastIndexOf('}') + 1));
const ln2 = `${ln}:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`;
await run('ffmpeg', ['-y', '-hide_banner', '-i', tmp, '-af', `${ln2},aresample=${SR}`, '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_s16le', join(work, 'voice.wav')]);
const dur = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(work, 'voice.wav')])).out.trim());
writeFileSync(join(work, 'voice.json'), JSON.stringify({ file: 'work/voice.wav', duration: +dur.toFixed(3), sampleRate: SR,
  loudnorm: { target: TARGET, measuredInput: { I: js.input_i, TP: js.input_tp, LRA: js.input_lra } }, pad: { in: PAD_IN, out: PAD_OUT, gap: GAP }, cuts }, null, 1));
console.log(`[voice] ✓ work/voice.wav ${dur.toFixed(2)} sn (giriş ${js.input_i} LUFS → ${TARGET.I})`);
