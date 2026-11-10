// node_modules/three → web/vendor/three (yerel kopya, CDN yok).
// Çekirdek + sahne için gerekli eklenti klasörleri. `npm install` sonrası otomatik çalışır.
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three');
const dst = join(root, 'web', 'vendor', 'three');
if (!existsSync(src)) { console.error('[vendor] node_modules/three yok — önce npm install'); process.exit(1); }

rmSync(dst, { recursive: true, force: true });
mkdirSync(join(dst, 'build'), { recursive: true });
for (const f of ['three.module.js', 'three.module.min.js', 'three.core.js', 'three.core.min.js']) {
  if (existsSync(join(src, 'build', f))) cpSync(join(src, 'build', f), join(dst, 'build', f));
}
// Eklentiler: three/addons/... → web/vendor/three/addons/...
const JSM = join(src, 'examples', 'jsm');
const dirs = ['controls', 'postprocessing', 'shaders', 'objects', 'math', 'utils', 'geometries',
  'environments', 'lines', 'misc', 'curves', 'lights', 'textures', 'helpers', 'modifiers', 'effects',
  'loaders', 'interactive', 'csm'];
for (const d of dirs) if (existsSync(join(JSM, d))) cpSync(join(JSM, d), join(dst, 'addons', d), { recursive: true });
// loaders'ın ihtiyaç duyduğu küçük kütüphaneler
mkdirSync(join(dst, 'addons', 'libs'), { recursive: true });
for (const f of ['fflate.module.js', 'stats.module.js', 'lil-gui.module.min.js', 'chevrotain.module.min.js', 'opentype.module.js']) {
  if (existsSync(join(JSM, 'libs', f))) cpSync(join(JSM, 'libs', f), join(dst, 'addons', 'libs', f));
}
cpSync(join(src, 'LICENSE'), join(dst, 'LICENSE'));
const ver = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version;
writeFileSync(join(dst, 'VERSION'), ver + '\n');
console.log(`[vendor] three ${ver} → web/vendor/three`);
