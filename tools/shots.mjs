#!/usr/bin/env node
// DENETİM EKRAN GÖRÜNTÜLERİ → out/shots/  (CONTRACT §7–§8). Sunucu/tarayıcı: render.mjs ile ortak.
//
// Film kareleri:
//   node tools/shots.mjs --frames 0,45,540,1079          belirli kareler
//   node tools/shots.mjs --count 12                      eşit aralıklı 12 kare (ilk ve son dahil)
//   node tools/shots.mjs --times 0,1.5,18,36             saniye cinsinden
// Serbest görünüm (kamera modülünden bağımsız):
//   node tools/shots.mjs --tod 15,19.4,22.5 --view "-520,420,720;0,40,0;40"
//        view = "px,py,pz;tx,ty,tz[;fov[;ux,uy,uz]]"  (birden çok görünüm: '|' ile ayır; up = dik bakışlar için)
//   --tod film karesiyle birlikte verilirse o karenin kamerası korunur, yalnız saat değişir.
// Ortak: --atmo a|b (a) · --w 540 --h 960 · --name önek (varsayılan "shot")
//        --sheet [--cols N]  tüm kareleri tek kontak baskıda birleştir (out/shots/<önek>_<atmo>_sheet.png)
//        --sheet-only      tek tek dosyaları out/tmp/'ye yaz, out/shots/'a yalnız kontak baskı
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT, OUT, parseArgs, ensureServer, launchBrowser, openRenderPage, capturePng, ffmpegBin } from './render.mjs';

const nums = (s) => String(s).split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));

function parseViews(s) {
  return String(s).split('|').map((one, k) => {
    const parts = one.split(';').map((p) => nums(p));
    if (parts.length < 2 || parts[0].length !== 3 || parts[1].length !== 3) throw new Error(`--view biçimi: "px,py,pz;tx,ty,tz[;fov]" (${one})`);
    const v = { id: `v${k + 1}`, pos: parts[0], target: parts[1], fov: parts[2]?.[0] ?? 40 };
    if (parts[3]?.length === 3) v.up = parts[3]; // dik (kuşbakışı / alttan) bakışlar için
    return v;
  });
}

async function main() {
  const o = parseArgs(process.argv.slice(2), {
    frames: 'str', count: 'num', times: 'str', tod: 'str', view: 'str', atmo: 'str', w: 'num', h: 'num',
    name: 'str', sheet: 'bool', cols: 'num', 'sheet-only': 'bool', port: 'num', help: 'bool',
  });
  if (o.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }
  const w = o.w ?? 540;
  const h = o.h ?? 960;
  const atmo = o.atmo === 'b' ? 'b' : 'a';
  const name = o.name ?? 'shot';
  const sheet = o.sheet || o['sheet-only'];

  const base = await ensureServer(o.port ?? 5174);
  const browser = await launchBrowser();
  const files = [];
  try {
    const { page, info } = await openRenderPage(browser, base, { w, h, atmo });
    const last = info.frames - 1;
    let frames = [];
    if (o.frames) frames = nums(o.frames).map((i) => Math.round(i));
    if (o.times) frames.push(...nums(o.times).map((t) => Math.round(t * info.fps)));
    if (o.count) for (let k = 0; k < o.count; k++) frames.push(Math.round((k * last) / Math.max(1, o.count - 1)));
    frames = frames.map((i) => Math.max(0, Math.min(last, i)));
    const tods = o.tod ? nums(o.tod) : [null];
    const views = o.view ? parseViews(o.view) : [null];
    if (!frames.length && !o.view) frames = [0, Math.round(last / 2), last];
    if (!frames.length) frames = [0];

    const dirOne = o['sheet-only'] ? path.join(OUT, 'tmp', 'shots') : path.join(OUT, 'shots');
    fs.mkdirSync(dirOne, { recursive: true });
    fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
    for (const f of frames) {
      for (const v of views) {
        for (const tod of tods) {
          const r = await page.evaluate(
            async ({ f, v, tod }) => {
              let s = await window.__setFrame(f); // geçersiz kılmaları sıfırlar
              if (v) s = await window.__setView({ pos: v.pos, target: v.target, fov: v.fov, up: v.up });
              if (tod !== null) s = await window.__setTod(tod);
              return s;
            },
            { f, v, tod },
          );
          const tag = [name, atmo, v ? v.id : `f${String(f).padStart(4, '0')}`, tod !== null ? `tod${tod}` : null].filter(Boolean).join('_');
          const file = path.join(dirOne, `${tag}.png`);
          await capturePng(page, file);
          files.push(file);
          console.log(`${path.relative(ROOT, file)}  (t=${r.t.toFixed(2)} tod=${r.tod.toFixed(2)})`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (sheet && files.length > 1) {
    const cols = Math.max(1, Math.round(o.cols ?? Math.min(6, files.length)));
    const rows = Math.ceil(files.length / cols);
    const out = path.join(OUT, 'shots', `${name}_${atmo}_sheet.png`);
    const args = ['-y', '-hide_banner', '-loglevel', 'error'];
    for (const f of files) args.push('-i', f);
    const cw = Math.round(1620 / cols / 2) * 2;
    const scaled = files.map((_, i) => `[${i}:v]scale=${cw}:-2[s${i}]`).join(';');
    const lay = files.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, k) => `w${k}`).join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k * cols}`).join('+') : '0'}`).join('|');
    args.push('-filter_complex', `${scaled};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${lay}:fill=black[o]`, '-map', '[o]', '-frames:v', '1', out);
    const r = spawnSync(ffmpegBin(), args, { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('kontak baskı üretilemedi (ffmpeg)');
    console.log(`${path.relative(ROOT, out)}  (${cols}×${rows})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('[hata]', e.message);
    process.exit(1);
  });
}
