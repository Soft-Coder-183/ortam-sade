// Windows'taki yerel sunucu: arayüzü sunar, /api/* isteklerini çekirdeğe (api.mjs) iletir.
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleApi, hooks, startBackground } from './api.mjs';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PDFJS = path.join(ROOT, 'node_modules', 'pdfjs-dist');   // PDF görüntüleyici (tarayıcıda çalışır), /vendor/pdfjs/ altından sunulur
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm' };

hooks.shutdown = () => { console.log('\nUygulama arayüzden kapatıldı.'); process.exit(0); };

// Yalnızca bu bilgisayardaki uygulama sayfası konuşabilsin: Host başlığı (DNS rebinding'e karşı) ve
// POST'larda Origin + JSON içerik türü (başka bir sitenin form/istekle giriş tetiklemesine karşı) kontrol edilir.
// Ek yükleme ham dosya (octet-stream) gönderir; bu tür de başka sitelerden ön kontrolsüz gönderilemez.
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const trustedPost = (req, binary = false) => {
  const type = req.headers['content-type'] || '';
  return req.method === 'POST' && (type.startsWith('application/json') || (binary && type.startsWith('application/octet-stream'))) &&
    (!req.headers.origin || LOCAL_HOSTS.has(req.headers.origin.replace(/^http:\/\//, '')));
};

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', d => { size += d.length; if (size > max) { reject(new Error('Dosya çok büyük')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body, type = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  if (!LOCAL_HOSTS.has(req.headers.host)) return send(403, 'yasak', 'text/plain');

  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'POST' && !trustedPost(req, url.pathname === '/api/webmail/upload')) return send(403, { error: 'İzin verilmeyen istek' });
    const r = await handleApi({ method: req.method, url, cookie: req.headers.cookie || '', readBody: max => readBody(req, max) })
      .catch(e => { console.error(url.pathname, e); return { code: 500, body: { error: e.message } }; });
    return send(r.code, r.body, r.type, r.headers);
  }

  // /vendor/pdfjs/… -> node_modules/pdfjs-dist/… (yalnızca tarayıcının ihtiyaç duyduğu klasörler)
  const vendor = url.pathname.match(/^\/vendor\/pdfjs\/((?:legacy\/build|cmaps|standard_fonts|wasm|iccs)\/[\w.-]+)$/);
  const file = vendor ? path.join(PDFJS, vendor[1]) : path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(vendor ? PDFJS : PUBLIC)) return send(403, 'yasak', 'text/plain');
  try {
    send(200, await fs.readFile(file), TYPES[path.extname(file)] || 'application/octet-stream',
      vendor ? { 'Cache-Control': 'max-age=86400' } : {});
  } catch {
    send(404, 'bulunamadı', 'text/plain');
  }
});

// Uygulamayı aç (paketli sürümde başlatıcı ORTAM_AC=1 verir). Zaten açıksa ikinci kopya başlamaz, yalnızca pencereyi açar.
// Uygulama penceresi: varsayılan tarayıcı Chromium tabanlıysa (Chrome, Edge, Brave, Vivaldi) onun "uygulama" modu, değilse
// (ör. Firefox'ta bu mod yok) Windows'ta her zaman bulunan Edge. Adres çubuğu ve sekme olmaz, görev çubuğunda kendi simgesiyle
// ayrı görünür; dış bağlantılar normal tarayıcıda açılır. ORTAM_PENCERE=tarayici ile eskisi gibi normal sekmede açılır.
const APP_URL = `http://localhost:${PORT}/`;
const reg = (key, value) => new Promise(ok => execFile('reg.exe', ['query', key, ...(value ? ['/v', value] : ['/ve'])], { windowsHide: true },
  (e, out) => ok(e ? null : (String(out).match(/REG_\w+\s+(.*)$/m) || [])[1]?.trim() ?? null)));
async function appBrowser() {
  const prog = await reg('HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', 'ProgId');
  const cmd = prog && await reg(`HKCR\\${prog}\\shell\\open\\command`);
  const exe = cmd?.match(/^"([^"]+)"|^(\S+)/)?.slice(1).find(Boolean);
  if (exe && /[\\/](chrome|msedge|brave|vivaldi)\.exe$/i.test(exe) && existsSync(exe)) return exe;
  return [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES].filter(Boolean)
    .map(d => path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(f => existsSync(f)) ?? null;
}
async function openBrowser() {
  if (process.platform !== 'win32') return;
  const exe = process.env.ORTAM_PENCERE !== 'tarayici' ? await appBrowser().catch(() => null) : null;
  if (exe) spawn(exe, ['--app=' + APP_URL, '--window-size=1320,880'], { detached: true, stdio: 'ignore' }).unref();
  else execFile('cmd.exe', ['/c', 'start', '', APP_URL], { windowsHide: true }, () => {});
}
srv.on('error', e => {
  if (e.code !== 'EADDRINUSE') { console.error(e); process.exit(1); }
  console.log(`Ortam Sade zaten çalışıyor: ${APP_URL}`);
  if (process.env.ORTAM_AC) openBrowser();
  setTimeout(() => process.exit(0), 500);
});
srv.listen(PORT, '127.0.0.1', () => {
  console.log(`Ortam Sade çalışıyor: ${APP_URL}`);
  if (process.env.ORTAM_AC) openBrowser();
});
await new Promise(ok => srv.once('listening', ok));          // arka plan işleri yalnızca bu kopya sunucuyu açabildiyse başlar

await startBackground();
