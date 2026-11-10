// Bağımlılıksız statik sunucu: repo kökü → http://localhost:5173 (sayfa: /web/).
// Nokta ile başlayan hiçbir yol parçası (.env, .git …) ve anahtar dosyaları sunulmaz. Cache kapalı.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.tif': 'image/tiff',
};
// Gizli kabul edilen adlar (her yol parçası için): nokta ile başlayan, apikey*, *.key, *.pem
const FORBIDDEN = [/^\./, /^apikey/i, /\.key$/i, /\.pem$/i, /^node_modules$/];

function deny(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(msg);
}

export function startServer({ port = 5173, host = '127.0.0.1', quiet = false } = {}) {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(res, 405, 'method not allowed');
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return deny(res, 400, 'bad url'); }
    if (path.includes('\0') || path.includes('\\') || path.includes(':')) return deny(res, 400, 'bad url');
    const parts = path.split('/').filter(Boolean);
    if (parts.some((p) => p === '..' || FORBIDDEN.some((re) => re.test(p)))) return deny(res, 404, 'not found');
    if (path === '/' || path === '') { res.writeHead(302, { Location: '/web/' }); return res.end(); }

    let file = normalize(join(ROOT, ...parts));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) return deny(res, 403, 'forbidden');
    // Normalleştirme sonrası da her parça yeniden denetlenir
    if (relative(ROOT, file).split(sep).some((p) => FORBIDDEN.some((re) => re.test(p)))) return deny(res, 404, 'not found');
    let st;
    try { st = statSync(file); } catch { return deny(res, 404, 'not found'); }
    if (st.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
      file = join(file, 'index.html');
      try { st = statSync(file); } catch { return deny(res, 404, 'not found'); }
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache', Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      if (!quiet) console.log(`[serve] http://localhost:${port}/web/  (kök: ${ROOT})`);
      ok(server);
    });
  });
}

// Doğrudan çalıştırıldıysa
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = Number(i > 0 ? process.argv[i + 1] : process.env.PORT || 5173);
  startServer({ port }).catch((e) => { console.error('[serve]', e.message); process.exit(1); });
}
