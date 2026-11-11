// render / shot / mix / check için ortak: sunucu + headless Chromium + kompozisyonu açma + kare çekme.
// (Üst projenin tools/lib-browser.mjs dosyasından uyarlandı.)
import { chromium } from 'playwright';
import { PORT, ROOT, startServer } from './serve.mjs';

export { ROOT };

export function browserArgs(platform = process.platform) {
  const common = ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--font-render-hinting=none', '--disable-lcd-text'];
  if (platform === 'win32') return ['--use-angle=d3d11', ...common];
  if (platform === 'darwin') return ['--use-angle=metal', ...common];
  return ['--use-angle=vulkan', '--enable-features=Vulkan', ...common];
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] !== undefined && !/^--/.test(argv[i + 1])) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

async function serverUp(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/comp/src/main.js`, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

/** Sunucu + tarayıcı. 5288'de bu projenin sunucusu çalışıyorsa onu kullanır, yoksa geçici bir port açar. */
export async function openBrowser({ swiftshader = false } = {}) {
  const reuse = await serverUp(PORT);
  const server = reuse ? null : await startServer({ port: 0, quiet: true });
  const port = reuse ? PORT : server.address().port;
  const browser = await chromium.launch({
    args: swiftshader ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--force-color-profile=srgb', '--font-render-hinting=none'] : browserArgs(),
  });
  return {
    base: `http://127.0.0.1:${port}`,
    browser,
    async close() { await browser.close().catch(() => {}); if (server) await new Promise((r) => server.close(r)); },
  };
}

/** Kompozisyonu ?render=1 ile aç, konsolu yansıt, __ready'yi bekle. width×height = çıktı boyutu (sahne 1080×1920 ölçeklenir). */
export async function openComp(env, { width = 1080, height = 1920, query = {}, log = true, timeout = 180000 } = {}) {
  const page = await env.browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    const type = m.type();
    if (/Failed to load resource: .*404/.test(m.text())) return; // eksik sahne modülü: beklenen durum
    if (type === 'error') errors.push(m.text());
    if (log && (type === 'error' || type === 'warning')) console.log(`  [sayfa ${type}] ${m.text()}`);
  });
  page.on('pageerror', (e) => { errors.push(String(e)); if (log) console.log('  [sayfa hatası]', e.message); });
  const url = `${env.base}/comp/?${new URLSearchParams({ render: '1', ...query })}`;
  await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout });
  await page.evaluate(() => window.__ready);
  return { page, url, errors };
}

/** t anını çiz ve PNG (Buffer) döndür. */
export async function grab(page, t, { type = 'png', quality } = {}) {
  await page.evaluate((tt) => window.__renderFrame(tt), t);
  return page.screenshot({ type, quality, animations: 'disabled', caret: 'hide', scale: 'css' });
}

export function ffmpeg(argv, { quiet = false } = {}) {
  return import('node:child_process').then(({ spawn }) => new Promise((ok, fail) => {
    const p = spawn('ffmpeg', argv, { stdio: ['ignore', quiet ? 'ignore' : 'inherit', quiet ? 'pipe' : 'inherit'] });
    let err = '';
    p.stderr?.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg çıkış kodu ' + c + (err ? '\n' + err.slice(-1500) : '')))));
  }));
}
