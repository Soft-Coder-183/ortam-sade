// Android çekirdeği: server/ klasöründeki kodun aynısı WebView'in içinde çalışır, arada yerel sunucu yoktur.
// fetch burada üç yöne ayrılır: /api/* doğrudan çekirdeğe (handleApi), okul siteleri telefonun ağ katmanına (Native.http),
// uygulamanın kendi dosyaları WebView'e. Native, Kotlin tarafındaki köprüdür (mobile/android, Native.kt).
import { Buffer } from 'buffer';
import { handleApi, startBackground, prepare } from '../server/api.mjs';
import * as notify from '../server/notify.mjs';
import { reloadJars } from '../server/session.mjs';

const Native = globalThis.Native;
const realFetch = globalThis.fetch.bind(globalThis);

// ---------- okul sitelerine istek ----------
const pending = new Map();
let seq = 0;
const call = (id, fn) => new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); fn(); });
export const nextId = () => ++seq;
// Native bir işi bitirince çağırır. Gövde ayrı alınır: büyük dosyalar evaluateJavascript metnine sığdırılmaz.
globalThis.__done = (id, json) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  const r = JSON.parse(json);
  if (r.error) p.reject(new Error(r.error)); else p.resolve(r);
};
globalThis.__call = (make) => { const id = nextId(); return call(id, () => make(id)); };

class NativeHeaders {
  constructor(list) { this.list = list; }
  get(name) {
    const n = name.toLowerCase(), hit = this.list.filter(([k]) => k.toLowerCase() === n);
    return hit.length ? hit.map(x => x[1]).join(', ') : null;
  }
  getSetCookie() { return this.list.filter(([k]) => k.toLowerCase() === 'set-cookie').map(x => x[1]); }
}
class NativeResponse {
  constructor(r, bytes) {
    this.status = r.status; this.ok = r.status >= 200 && r.status < 300; this.url = r.url;
    this.headers = new NativeHeaders(r.headers); this.bytes = bytes;
  }
  async text() { return this.bytes.toString('utf8'); }
  async json() { return JSON.parse(this.bytes.toString('utf8')); }
  async arrayBuffer() { return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.length); }
}

async function encodeBody(body, headers) {
  if (body == null) return null;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body instanceof URLSearchParams) {
    headers['Content-Type'] ??= 'application/x-www-form-urlencoded;charset=UTF-8';
    return Buffer.from(body.toString(), 'utf8');
  }
  if (body instanceof FormData) {
    const boundary = '----EtuCep' + Math.random().toString(36).slice(2);
    const parts = [];
    for (const [name, value] of body.entries()) {
      const safe = s => String(s).replace(/["\r\n]/g, '_');
      if (typeof value === 'string') parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(name)}"\r\n\r\n${value}\r\n`));
      else {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(name)}"; filename="${safe(value.name || 'dosya')}"\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`));
        parts.push(Buffer.from(await value.arrayBuffer()), Buffer.from('\r\n'));
      }
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    return Buffer.concat(parts);
  }
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  return Buffer.from(body);
}

async function nativeFetch(url, init = {}) {
  const headers = Object.fromEntries(new Headers(init.headers ?? {}).entries());
  const body = await encodeBody(init.body, headers);
  const id = nextId();
  const r = await call(id, () => Native.http(id, JSON.stringify({ url, method: init.method || 'GET', headers,
    redirect: init.redirect || 'follow', body: body ? body.toString('base64') : null })));
  return new NativeResponse(r, Buffer.from(Native.takeBody(id) || '', 'base64'));
}

// ---------- uygulamanın kendi /api/* çağrıları ----------
let lockCookie = '';
let ready = Promise.resolve();
async function apiFetch(u, init = {}) {
  await ready;
  const raw = await encodeBody(init.body, {});
  const r = await handleApi({ method: init.method || 'GET', url: u, cookie: lockCookie, readBody: async () => raw ?? Buffer.alloc(0) })
    .catch(e => { console.error(u.pathname, e); return { code: 500, body: { error: e.message } }; });
  const extra = { ...r.headers };
  if (extra['Set-Cookie']) { lockCookie = extra['Set-Cookie'].split(';')[0]; delete extra['Set-Cookie']; }
  delete extra['Content-Security-Policy'];
  const body = typeof r.body === 'string' || Buffer.isBuffer(r.body) ? r.body : JSON.stringify(r.body);
  return new Response(body, { status: r.code, headers: { 'Content-Type': r.type || 'application/json; charset=utf-8', ...extra } });
}

globalThis.fetch = (input, init) => {
  const u = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (u.origin !== location.origin) return nativeFetch(u.href, init);
  return u.pathname.startsWith('/api/') ? apiFetch(u, init) : realFetch(input, init);
};

// ---------- platform ayarları ----------
notify.configure({
  every: { uzak: 30 },                                 // Android'de Uzak yarım saatte bir denetlenir
  defaults: { mail: false },                           // özet e-posta telefonda varsayılan kapalı: bildirim zaten telefona gelir
  brand: 'ETÜ Cep', device: 'telefonunuzda', appLink: false,
  toast: (title, body, link) => Native.notify(title, body, link || ''),
});

if (globalThis.__ARKA_PLAN) {
  // Uygulama kapalıyken: yalnızca süresi gelen bildirim kontrolleri çalışır, sonra WebView kapatılır.
  (async () => {
    try { await prepare(); await notify.runDue(); }
    catch (e) { console.error('arka plan', e.message); }
    finally { Native.backgroundDone(); }
  })();
} else {
  ready = startBackground().catch(e => console.error('başlangıç', e));
  // Uygulama öne geldi: arka plan kontrolünün yazdıkları (çerezler, bildirimler) diskten okunur
  globalThis.__resume = () => { reloadJars(); notify.reload().then(() => globalThis.dispatchEvent(new Event('app-resume'))); };
  // Geri tuşu: açık PDF'i kapatır ya da bir önceki sayfaya döner; Ana Sayfa'daysa uygulama arka plana iner
  globalThis.__back = () => {
    if (document.body.classList.contains('drawer-open')) { document.body.classList.remove('drawer-open'); return true; }
    if (history.state?.pdfv || !/^#?\/?(anasayfa)?$/.test(location.hash)) { history.back(); return true; }
    return false;
  };
  // Dosya bağlantıları ve indirme: Blob adresleri WebView'de inmez, dosya telefonun İndirilenler klasörüne yazılıp açılır
  const save = (name, type, bytes) => Native.saveFile(name, type || 'application/octet-stream', Buffer.from(bytes).toString('base64'));
  document.addEventListener('click', async e => {
    const a = e.target.closest?.('a[download], a[href^="/api/file"]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    try {
      const r = await fetch(a.href);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Dosya alınamadı');
      const name = a.getAttribute('download') || decodeURIComponent(r.headers.get('X-File-Name') || '') || 'dosya';
      save(name, r.headers.get('Content-Type'), await r.arrayBuffer());
    } catch (err) { Native.showToast(err.message); }
  }, true);
  // Blob'tan indirme (app.js showFile, pdfview İndir): bağlantıya basılmadan önce yakalanır
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith('blob:') && this.download) {
      realFetch(this.href).then(async r => save(this.download, r.headers.get('Content-Type'), await r.arrayBuffer()));
      return;
    }
    click.call(this);
  };
  // Dış bağlantılar telefonun tarayıcısında açılır; window.open('', '_blank') + w.location kalıbı da desteklenir
  globalThis.open = url => {
    if (url) { Native.openUrl(new URL(url, location.href).href); return null; }
    return { opener: null, close() {}, set location(v) { Native.openUrl(String(v)); } };
  };
}
