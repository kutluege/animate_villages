// Hook laboratuvarı aracı: comp/hook-lab.html üzerinden seçenek (a|b|c|mevcut) için kare / kontak tabakası / sesli mp4.
// Tek tarayıcı, tek sayfa (bellek). Ara dosyalar yalnız out/hook-lab/ altına; teslim out/secenekler/hook-<V>.mp4.
//   node tools/hook-lab.mjs shot   --v b --t 0,0.3,0.7,1 [--size 540x960] [--tag r1] [--cols 6]  → out/hook-lab/<v>/<tag>.jpg
//   node tools/hook-lab.mjs render --v b [--draft] [--to 10]                                   → mp4 (+ ses raporu)
//   node tools/hook-lab.mjs cues   --v b                                                         (sfx ipuçlarını yazdır)
//   node tools/hook-lab.mjs check  --v b --t 0,1.5                                               (determinizm)
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { ROOT, ffmpeg, openBrowser, parseArgs } from './lib-browser.mjs';
import { mixAudio } from './mix.mjs';

const args = parseArgs();
const cmd = args._[0] || 'shot';
const V = String(args.v || 'b');
const LIMIT = Number(args.to) || 10;
const draft = !!args.draft;
let [W, H] = args.size ? String(args.size).split('x').map(Number) : (cmd === 'render' && !draft ? [1080, 1920] : [540, 960]);
const FPS = Number(args.fps) || (draft ? 15 : 30);
const labDir = join(ROOT, 'out', 'hook-lab', V);
mkdirSync(labDir, { recursive: true });

const freeGB = () => os.freemem() / 2 ** 30;
async function waitMem(min = 2.5) {
  for (let i = 0; freeGB() < min; i++) {
    if (i % 6 === 0) console.log(`[lab] boş bellek ${freeGB().toFixed(2)} GB < ${min} GB — bekleniyor…`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

const env = await openBrowser();
let code = 0;
try {
  const page = await env.browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) { errors.push(m.text()); console.log('  [sayfa]', m.text()); } });
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('  [sayfa hatası]', e.message); });
  await page.goto(`${env.base}/comp/hook-lab.html?render=1&hook=${V}&limit=${LIMIT}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => window.__ready);
  const info = await page.evaluate(() => ({ duration: window.__duration, timeline: window.__timeline, modules: window.__modules, sfx: window.__sfx }));
  console.log('[lab] modüller:', Object.entries(info.modules.modules).map(([k, v]) => `${k}=${v}`).join('  '));
  const grab = async (t, opts) => { await page.evaluate((tt) => window.__renderFrame(tt), t); return page.screenshot({ ...opts, animations: 'disabled', caret: 'hide', scale: 'css' }); };

  if (cmd === 'cues') {
    for (const c of info.sfx) console.log(`${c.t.toFixed(3).padStart(8)}  ${c.scene.padEnd(8)} ${c.name} ×${c.gain}`);
  } else if (cmd === 'shot') {
    const ts = String(args.t || '0,0.3,0.7,1,1.5,2,2.5,3,3.5,4,4.5,5,5.4,5.8,6.5').split(',').map(Number);
    const tag = String(args.tag || 'sheet');
    const dir = join(labDir, 'shots');
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (const [i, t] of ts.entries()) writeFileSync(join(dir, `s${String(i).padStart(2, '0')}.jpg`), await grab(t, { type: 'jpeg', quality: 88 }));
    const cols = Number(args.cols) || Math.min(ts.length, 6), sw = Number(args.thumb) || 360;
    const rows = Math.ceil(ts.length / cols);
    await ffmpeg(['-y', '-v', 'error', '-framerate', '1', '-i', join(dir, 's%02d.jpg'), '-vf',
      `scale=${sw}:-1,drawtext=fontfile='C\\:/Windows/Fonts/consola.ttf':text='%{eif\\:n\\:d}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=4`,
      '-frames:v', '1', join(labDir, `${tag}.jpg`)], { quiet: true });
    console.log(`[lab] ✓ out/hook-lab/${V}/${tag}.jpg  (t = ${ts.join(', ')})`);
    if (args.full) for (const [i, t] of ts.entries()) writeFileSync(join(labDir, `${tag}-${t.toFixed(2)}.png`), await grab(t, { type: 'png' }));
  } else if (cmd === 'check') {
    // determinizm: aynı t farklı sırayla iki kez çizilir; pikseller karşılaştırılır
    const ts = String(args.t || '0,0.7,1.5,3,5.6').split(',').map(Number);
    const first = [];
    for (const t of ts) first.push(await grab(t, { type: 'png' }));
    for (const [i, t] of [...ts.entries()].reverse()) {
      await grab(t + 0.37, { type: 'png' });
      const again = await grab(t, { type: 'png' });
      const same = Buffer.compare(first[i], again) === 0;
      console.log(`[lab] t=${t}: ${same ? 'aynı' : 'FARKLI'}`);
      if (!same) { writeFileSync(join(labDir, `chk-${t}-1.png`), first[i]); writeFileSync(join(labDir, `chk-${t}-2.png`), again); }
    }
  } else if (cmd === 'render') {
    await waitMem(draft ? 1.8 : 2.5);
    const N = Math.round(info.duration * FPS);
    const fdir = join(labDir, `frames-${W}x${H}-${FPS}`);
    rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      if (i % 60 === 0 && freeGB() < 1.5) await waitMem(2.0);
      writeFileSync(join(fdir, `f${String(i).padStart(5, '0')}.jpg`), await grab(i / FPS, { type: 'jpeg', quality: draft ? 90 : 95 }));
      if (i % FPS === 0) process.stdout.write(`\r[lab] ${i}/${N} kare  ${(i / ((Date.now() - t0) / 1000 + 1e-3)).toFixed(1)} kare/sn  `);
    }
    process.stdout.write('\n');
    const audio = join(labDir, 'audio.wav');
    await mixAudio({ cues: info.sfx, duration: info.duration, timeline: info.timeline, out: audio, report: join(labDir, 'mix-report.txt') });
    const outDir = draft ? labDir : join(ROOT, 'out', 'secenekler');
    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, draft ? 'draft.mp4' : `hook-${V === 'mevcut' ? 'mevcut' : V.toUpperCase()}.mp4`);
    await ffmpeg(['-y', '-hide_banner', '-loglevel', 'warning',
      '-framerate', String(FPS), '-i', join(fdir, 'f%05d.jpg'), '-i', audio, '-frames:v', String(N),
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '23' : '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', ...(draft ? [] : ['-tune', 'film']),
      '-g', String(FPS * 2), '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-map', '0:v:0', '-map', '1:a:0',
      '-t', info.duration.toFixed(4), '-movflags', '+faststart', out]);
    if (!draft) rmSync(fdir, { recursive: true, force: true });
    console.log(`[lab] ✓ ${out.replace(ROOT, '').replace(/^[\\/]/, '')} (${(statSync(out).size / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  }
  if (errors.length) { console.log(`[lab] sayfa hataları: ${errors.length}`); code = 2; }
} catch (e) { console.error('[lab] başarısız:', e.stack || e.message); code = 1; } finally { await env.close(); }
process.exit(code);
