// Android uygulamasının web içeriğini hazırlar: public/ + çekirdek paketi (mobile/core.mjs) + PDF görüntüleyici + ders verisi.
// Çıktı mobile/android/app/src/main/assets altına yazılır (git'e girmez). Sonra: cd mobile/android && gradlew assembleRelease
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { TELEFON } from '../mobile/metinler.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'mobile/android/app/src/main/assets');
const WWW = path.join(ASSETS, 'www');
const SHIM = path.join(ROOT, 'mobile/shim');
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, fs.readFileSync(from)); };
const copyDir = (from, to) => { for (const f of fs.readdirSync(from, { withFileTypes: true })) (f.isDirectory() ? copyDir : copy)(path.join(from, f.name), path.join(to, f.name)); };

fs.rmSync(ASSETS, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

// server/ içindeki platforma bağlı dosyalar Android karşılıklarıyla değişir
const swap = { name: 'android-karsiliklari', setup(b) {
  b.onResolve({ filter: /\.\/(browser|pdf|vault|credentials|update)\.mjs$/ }, a =>
    (a.importer.includes(`${path.sep}server${path.sep}`) ? { path: path.join(SHIM, path.basename(a.path)) } : undefined));
} };
await esbuild.build({
  entryPoints: [path.join(ROOT, 'mobile/core.mjs')], outfile: path.join(WWW, 'core.js'), bundle: true, format: 'iife', platform: 'browser',
  target: 'chrome100', minify: true, legalComments: 'none', inject: [path.join(SHIM, 'env.mjs')], plugins: [swap],
  define: { 'import.meta.url': '"file:///app/server/core.mjs"' },
  alias: { 'node:fs/promises': path.join(SHIM, 'fs.mjs'), 'node:fs': path.join(SHIM, 'fs.mjs'), 'node:crypto': path.join(SHIM, 'crypto.mjs'),
    'node:path': 'path-browserify', 'node:url': path.join(SHIM, 'misc.mjs'), 'node:zlib': path.join(SHIM, 'misc.mjs'), 'node:child_process': path.join(SHIM, 'misc.mjs') },
});

// Arayüz: aynı dosyalar; telefona özgü davranışı app.js window.Native'den anlar
copyDir(path.join(ROOT, 'public'), WWW);
const rename = s => s.replaceAll('Ortam Sade', 'ETÜ Cep');
let app = fs.readFileSync(path.join(WWW, 'app.js'), 'utf8');
for (const [from, to] of TELEFON) {
  if (!app.includes(from)) throw new Error('Metin app.js\'te yok: ' + from.slice(0, 70));
  app = app.replaceAll(from, to);
}
fs.writeFileSync(path.join(WWW, 'app.js'), rename(app));
await esbuild.transform(app, { loader: 'js' });              // metin değişimi sözdizimini bozduysa derleme burada durur
fs.writeFileSync(path.join(WWW, 'pdfview.js'), rename(fs.readFileSync(path.join(WWW, 'pdfview.js'), 'utf8')));
fs.appendFileSync(path.join(WWW, 'style.css'), '\n[data-shutdown], .srv-state { display: none !important; }\n');
const index = rename(fs.readFileSync(path.join(WWW, 'index.html'), 'utf8')).replace('<script src="app.js" type="module">', '<script src="core.js"></script>\n  <script src="app.js" type="module">');
fs.writeFileSync(path.join(WWW, 'index.html'), index);
fs.writeFileSync(path.join(WWW, 'arka-plan.html'), '<!doctype html><meta charset="utf-8"><script>window.__ARKA_PLAN = true;</script><script src="core.js"></script>\n');

// PDF görüntüleyici ve ders verisi
const PDFJS = path.join(ROOT, 'node_modules/pdfjs-dist');
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) copy(path.join(PDFJS, 'legacy/build', f), path.join(WWW, 'vendor/pdfjs/legacy/build', f));
for (const d of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) if (fs.existsSync(path.join(PDFJS, d))) copyDir(path.join(PDFJS, d), path.join(WWW, 'vendor/pdfjs', d));
copy(path.join(ROOT, 'data/ders-programi.json'), path.join(ASSETS, 'app/data/ders-programi.json'));

console.log('Android web içeriği hazır:', path.relative(ROOT, ASSETS), `(core.js ${(fs.statSync(path.join(WWW, 'core.js')).size / 1024).toFixed(0)} KB)`);
