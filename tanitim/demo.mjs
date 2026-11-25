// GitHub Pages demosunu üretir: node tanitim/demo.mjs → docs/demo/ (index.html, demo.js, style.css, simge.png).
// Uygulamanın arayüzü (public/app.js) ile sahte veri (veri.mjs) tek pakette; sunucu yok, okula istek gitmez.
// Herkese açık iki veri derleme anında kopyalanır: ders programı verisi (data/) ve akademik takvim (okulun sitesinden bir istek).
// Arayüz değişince yeniden üretilip commit'lenir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as program from '../server/program.mjs';
import * as etu from '../server/etu.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'demo');
const SHIM = path.join(ROOT, 'tanitim', 'demo-shim.mjs');

const anlik = { program: program.get(), takvim: await etu.calendar() };
const sanal = { name: 'demo-anlik', setup(b) {
  b.onResolve({ filter: /^demo:anlik$/ }, () => ({ path: 'anlik', namespace: 'demo' }));
  b.onLoad({ filter: /.*/, namespace: 'demo' }, () => ({ contents: JSON.stringify(anlik), loader: 'json' }));
} };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// Giriş: önce sahte sunucu (fetch'i ele alır), sonra uygulamanın kendisi
const giris = path.join(ROOT, 'tanitim', '.demo-paket.mjs');
fs.writeFileSync(giris, "import './demo-giris.mjs';\nimport '../public/app.js';\n");
try {
  await esbuild.build({
    entryPoints: [giris], outfile: path.join(OUT, 'demo.js'), bundle: true, format: 'esm', platform: 'browser', target: 'chrome100',
    minify: true, legalComments: 'none', plugins: [sanal],
    alias: { 'node:fs': SHIM, 'node:url': SHIM, 'node:path': 'path-browserify' },
  });
} finally { fs.rmSync(giris, { force: true }); }

for (const f of ['style.css', 'simge.png']) fs.copyFileSync(path.join(ROOT, 'public', f), path.join(OUT, f));
const SERIT = `<div class="demo-serit" role="note"><span>Tanıtım sürümü<span class="uzun">: öğrenci ve bütün veriler uydurmadır, okul sitelerine bağlanılmaz</span><span class="kisa"> · veriler uydurma</span></span>
  <a href="../">İndir</a><button type="button" aria-label="Kapat" onclick="this.parentNode.remove()">×</button></div>
  <style>.demo-serit{position:fixed;z-index:9999;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;white-space:nowrap;
  max-width:calc(100% - 24px);padding:5px 6px 5px 14px;border-radius:999px;background:#1b449c;color:#fff;font:600 12.5px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2)}
  .demo-serit a{color:#ffd28a}.demo-serit button{border:0;background:rgba(255,255,255,.15);color:#fff;width:22px;height:22px;border-radius:50%;font:inherit;line-height:1;cursor:pointer}
  .demo-serit .kisa{display:none}@media (max-width:800px){.demo-serit{bottom:74px}.demo-serit .uzun{display:none}.demo-serit .kisa{display:inline}}</style>`;
let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8')
  .replace('<title>Ortam Sade</title>', '<title>Ortam Sade · Tanıtım</title>\n  <meta name="robots" content="noindex">')
  .replace('<script src="app.js" type="module"></script>', `${SERIT}\n  <script src="demo.js" type="module"></script>`);
if (!html.includes('demo.js')) throw new Error('index.html beklenen biçimde değil');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('demo hazır:', path.relative(ROOT, OUT), `(${(fs.statSync(path.join(OUT, 'demo.js')).size / 1024).toFixed(0)} KB)`);
