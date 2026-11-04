// Paylaşılabilir Windows paketi: dist/OrtamSade-<sürüm>-win-x64.zip
// İçinde Node.js (runtime/node.exe, bu betiği çalıştıran Node'un kopyası), uygulama dosyaları, gerekli bağımlılıklar ve
// çift tıklanınca açılan "Ortam Sade.cmd" vardır. Kurulum gerekmez; kişisel veri (.cache, .profile) pakete girmez.
// Kullanım: npm run paketle   (önce npm install)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = 'OrtamSade';
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, NAME);
const ZIP = path.join(DIST, `${NAME}-${version}-win-x64.zip`);

if (process.platform !== 'win32') throw new Error('Paket Windows için; betiği Windows\'ta çalıştırın.');
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(OUT, { recursive: true });

// fs.cpSync, Node 24'te Türkçe karakterli yollarda Windows'ta çöküyor; bu yüzden basit özyinelemeli kopya.
function copyTree(src, dst, filter) {
  if (filter && !filter(src)) return;
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copyTree(path.join(src, name), path.join(dst, name), filter);
  } else fs.copyFileSync(src, dst);
}
const copy = (from, to = from, filter) => copyTree(path.join(ROOT, from), path.join(OUT, to), filter);
for (const f of ['server', 'public', 'package.json', 'LICENSE', 'README.md', 'Ortam Sade.cmd']) copy(f);

// Bağımlılıklar: tarayıcıda kullanılmayan pdf.js parçaları ve pdf.js'in Node'da çizim için istediği isteğe bağlı
// @napi-rs/canvas pakete alınmaz (sunucu pdf.js'i yalnızca tarayıcıya dosya olarak verir).
const PDFJS_KEEP = /^(legacy[\\/]build|cmaps|standard_fonts|wasm|iccs|package\.json|LICENSE)/;
copy('node_modules', 'node_modules', src => {
  const rel = path.relative(path.join(ROOT, 'node_modules'), src);
  if (/^@napi-rs([\\/]|$)/.test(rel) || /^\.(bin|package-lock\.json)/.test(rel)) return false;
  const pdf = rel.match(/^pdfjs-dist[\\/](.+)$/);
  if (pdf && !PDFJS_KEEP.test(pdf[1]) && !/^legacy$/.test(pdf[1])) return false;
  if (pdf && /\.map$/.test(rel)) return false;
  return true;
});

fs.mkdirSync(path.join(OUT, 'runtime'));
fs.copyFileSync(process.execPath, path.join(OUT, 'runtime', 'node.exe'));

// Windows'un kendi tar'ı zip yazabilir (bsdtar).
execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-cf', ZIP, '-C', DIST, NAME], { stdio: 'inherit' });
const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`Hazır: ${ZIP} (${mb(fs.statSync(ZIP).size)}) · Node ${process.version}`);
