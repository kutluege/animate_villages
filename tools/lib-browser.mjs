// shots.mjs ve render.mjs için ortak: sunucu + GPU'lu headless Chromium + sayfa açma.
//
// Windows'ta bulunan bayraklar (Playwright headless shell, Chromium 131+):
//   bayraksız           → SwiftShader (CPU; yavaş ama kararlı)
//   --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist → gerçek GPU (ANGLE D3D11)
// Linux/mac için ANGLE arka ucu platforma göre seçilir. GPU yoksa SwiftShader'a düşer ve uyarır.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

export function gpuArgs(platform = process.platform) {
  const common = ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio'];
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
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

/** Sunucu (rastgele boş port) + tarayıcı. close() ikisini de kapatır. */
export async function openBrowser({ swiftshader = false } = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const port = server.address().port;
  const browser = await chromium.launch({
    args: swiftshader ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : gpuArgs(),
  });
  return {
    base: `http://127.0.0.1:${port}`,
    browser,
    async close() { await browser.close().catch(() => {}); await new Promise((r) => server.close(r)); },
  };
}

/** Sayfayı aç, konsolu yansıt, __ready'yi bekle. GPU bilgisini döndürür. */
export async function openScene(env, { query, width, height, log = true, timeout = 180000 }) {
  const page = await env.browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    const type = m.type();
    // Eksik modül/veri için tarayıcının kendi 404 satırları beklenen durum (main.js zaten bilgi yazar)
    if (/Failed to load resource: .*404/.test(m.text())) return;
    if (type === 'error') errors.push(m.text());
    if (log && (type === 'error' || type === 'warning')) console.log(`  [sayfa ${type}] ${m.text()}`);
  });
  page.on('pageerror', (e) => { errors.push(String(e)); if (log) console.log('  [sayfa hatası]', e.message); });
  const url = `${env.base}/web/?${new URLSearchParams(query)}`;
  await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout });
  await page.evaluate(() => window.__ready);
  const gpu = await page.evaluate(() => {
    const gl = window.__ctx?.renderer?.getContext();
    if (!gl) return 'bilinmiyor';
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  if (/swiftshader|llvmpipe|software/i.test(gpu)) console.warn(`[uyarı] Yazılım WebGL kullanılıyor (${gpu}) — kareler doğru ama yavaş.`);
  return { page, url, gpu, errors };
}
