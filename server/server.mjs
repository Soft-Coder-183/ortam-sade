// Yerel geliştirme sunucusu: arayüzü sunar, /api/* isteklerini ilgili okul sitesinin TEK sayfasından karşılar.
// Daha önce açılmış bir ekranın son verisi anında döner, yenisi arka planda çekilir (X-Refreshing başlığı).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SITES, LoginRequired, login, keepAlive, getPage, isAlive } from './session.mjs';
import * as autologin from './autologin.mjs';
import * as credentials from './credentials.mjs';
import * as ortam from './ortam.mjs';
import * as etu from './etu.mjs';
import * as ubs from './ubs.mjs';
import { moodle } from './moodle.mjs';
import * as piazza from './piazza.mjs';
import * as courses from './courses.mjs';
import * as planner from './plan.mjs';
import * as notify from './notify.mjs';
import * as webmail from './webmail.mjs';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PDFJS = path.join(ROOT, 'node_modules', 'pdfjs-dist');   // PDF görüntüleyici (tarayıcıda çalışır), /vendor/pdfjs/ altından sunulur
const CACHE_DIR = '.cache/api';
const CACHE_VER = 11;            // ayrıştırıcıların çıktısı değişince artır: eski kayıtlar açılışta silinir
const STALE_AFTER = 20_000;      // varsayılan: kayıtlı veri hemen gösterilir, bu süreden eskiyse arka planda yenilenir
// Seyrek değişen bilgiler okulun sunucusuna her açılışta sorulmaz (dakika cinsinden).
const STALE_MIN = { exams: 10, schedule: 30, courses: 30, course: 360, derslerim: 10, mufredat: 60, bilgilerim: 60, notlar: 10,
  ortak: 60, 'yabanci-dil': 60, odeme: 60, cap: 60, 'ortam-acilan': 360, 'ortam-basvuru': 10, 'etu-takvim': 1440, 'etu-fakulteler': 1440, 'etu-kadro': 1440, 'uzak-course': 10, 'piazza-resources': 30, 'uzakydb-course': 10, ubs: 5, plan: 10 };
const staleAfter = name => (STALE_MIN[name] ?? 0) * 60_000 || STALE_AFTER;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm' };

// İndirilen dosyalar: tarayıcıda yalnızca PDF ve resim olduğu gibi açılır; diğer her şey (ör. bir e-postadaki HTML eki)
// indirme olarak verilir. "sandbox" ilkesi, dosya yine de açılırsa uygulamanın sayfalarına erişemesin diye.
const INLINE_TYPES = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/i;
const MOODLE_SITES = new Set(['uzak', 'uzakydb']);
const files = {
  'ubs-export': q => ubs.exportPdf(q.get('path'), q.get('target')),
  'ubs-doc': q => ubs.docPdf(q.get('path')),
  'ubs-temp': q => ubs.tempFile(q.get('id')),               // UBS düğmesinin döndürdüğü dosya (ör. belge)
  'webmail': q => webmail.attachment(q.get('uid'), q.get('mbox') || 'INBOX', q.get('part')),
  'moodle': q => {
    if (!MOODLE_SITES.has(q.get('site'))) throw new Error('Bilinmeyen site');
    return moodle(q.get('site')).file({ cm: q.get('cm'), path: q.get('path') });
  },
  'piazza': q => piazza.file({ nid: q.get('nid'), rid: q.get('rid'), path: q.get('path') }),
};

// uç adı -> [site, fonksiyon]
const routes = {
  bilgilerim: ['ortam', ortam.bilgilerim], notlar: ['ortam', ortam.notlar], mufredat: ['ortam', ortam.mufredat],
  ortak: ['ortam', ortam.ortak], 'yabanci-dil': ['ortam', ortam.yabanciDil], odeme: ['ortam', ortam.odeme],
  courses: ['ortam', ortam.courses], course: ['ortam', q => ortam.course(q.get('id'))], schedule: ['ortam', ortam.schedule],
  exams: ['ortam', ortam.exams], cap: ['ortam', ortam.cap],
  'ortam-acilan': ['ortam', ortam.offered],                 // dönemde açılan dersler (kodlar, ders veren öğretim elemanları)
  // Okulun herkese açık sitesi (giriş gerekmez): akademik takvim, fakülte/bölüm listesi, akademik kadro dizini
  'etu-takvim': ['etu', etu.calendar], 'etu-fakulteler': ['etu', etu.faculties], 'etu-kadro': ['etu', etu.staffIndex],
  'ortam-basvuru': ['ortam', q => ortam.applyPage(q.get('path'))],   // hareketlilik formları ve başvurularım
  derslerim: ['ortam', courses.derslerim],
  plan: ['ubs', planner.plan],                             // ortalama ve ders planı verisi (transkript + müfredat)                 // Ortam + Uzak + Piazza birleşik ders listesi
  ubs: ['ubs', ubs.home], 'ubs-page': ['ubs', q => ubs.page(q.get('path'))],
  uzakydb: ['uzakydb', () => moodle('uzakydb').home()], uzak: ['uzak', () => moodle('uzak').home()],
  'uzak-course': ['uzak', q => moodle('uzak').course(q.get('id'))],
  'uzak-page': ['uzak', q => moodle('uzak').page(q.get('path'))], 'uzakydb-page': ['uzakydb', q => moodle('uzakydb').page(q.get('path'))],
  'uzak-link': ['uzak', q => moodle('uzak').link(q.get('cm'))],
  'uzakydb-course': ['uzakydb', q => moodle('uzakydb').course(q.get('id'))], 'uzakydb-link': ['uzakydb', q => moodle('uzakydb').link(q.get('cm'))],
  piazza: ['piazza', piazza.classes], 'piazza-feed': ['piazza', q => piazza.feed(q.get('nid'))],
  'piazza-post': ['piazza', q => piazza.post(q.get('nid'), q.get('cid'))], 'piazza-resources': ['piazza', q => piazza.resources(q.get('nid'))],
  webmail: ['webmail', q => webmail.inbox(q.get('mbox') || 'INBOX', q.get('page'))],
  'webmail-message': ['webmail', q => webmail.message(q.get('uid'), q.get('mbox') || 'INBOX')],
  'webmail-starred': ['webmail', () => webmail.starred()],                       // Yıldızlılar (bütün klasörler)
};

const needLogin = new Set();  // oturumu kapalı olduğu bilinen siteler
const memo = new Map();       // anahtar -> { t, data }
const inflight = new Map();   // anahtar -> Promise
const fileOf = key => path.join(CACHE_DIR, `v${CACHE_VER}-${encodeURIComponent(key)}.json`);

async function cached(key) {
  if (memo.has(key)) return memo.get(key);
  try { const e = JSON.parse(await fs.readFile(fileOf(key), 'utf8')); memo.set(key, e); return e; } catch { return null; }
}

// Bir uç taze veriyle yenilendiğinde başka uçların önbelleği de eskir: e-posta önizlemesi postayı okundu yapar,
// klasör listeleri (okunmamış sayıları) yeniden çekilmeli.
const AFTER = { 'webmail-message': () => invalidate('webmail?') };

function refresh(key, site, fn) {
  if (!inflight.has(key)) {
    inflight.set(key, fn().catch(e => { if (e instanceof LoginRequired) needLogin.add(site); throw e; }).then(async data => {
      needLogin.delete(site);
      const e = { t: Date.now(), data };
      memo.set(key, e);
      await fs.writeFile(fileOf(key), JSON.stringify(e)).catch(() => {});
      AFTER[key.split('?')[0]]?.();
      return e;
    }).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

// Önbellekten anahtarı prefix ile başlayan kayıtları siler (bellek + disk).
async function invalidate(prefix) {
  for (const k of memo.keys()) if (k.startsWith(prefix)) memo.delete(k);
  const head = `v${CACHE_VER}-${encodeURIComponent(prefix)}`;
  for (const f of await fs.readdir(CACHE_DIR).catch(() => [])) if (f.startsWith(head)) await fs.rm(path.join(CACHE_DIR, f), { force: true });
}

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
async function readJson(req, max = 10_000) {
  const body = (await readBody(req, max)).toString('utf8');
  try { return JSON.parse(body || '{}'); } catch { throw new Error('Geçersiz istek'); }
}

// Webmail değişiklikleri (okulun sunucusuna yazılır). Gönderim, silme vb. yalnızca kullanıcının tıklamasıyla çağrılır.
const WEBMAIL_ACTIONS = {
  mark: b => webmail.mark(b.uids, b.flag, b.mbox),
  move: b => webmail.move(b.uids, b.mbox, b.target),
  delete: b => webmail.remove(b.uids, b.mbox),
  compose: b => webmail.compose(b),
  send: b => webmail.send(b),
  'remove-attachment': b => webmail.removeAttachment(b.id, b.file),
  // Okunanları 12 saat sonra Çöp'e taşıma: durum, aç/kapa, e-posta bazında muafiyet, deneme (hiçbir şey taşımaz)
  'auto-status': () => webmail.autoStatus(),
  'auto-settings': b => webmail.setAuto(b),
  'auto-exempt': b => webmail.setExempt(b.uid, !!b.exempt),
  'auto-dryrun': () => webmail.runAuto({ dryRun: true }),
};
const CHANGES_MAIL = new Set(['mark', 'move', 'delete', 'send', 'auto-settings', 'auto-exempt']);

async function accountStatus() {
  const sessions = Object.fromEntries(await Promise.all(Object.keys(SITES).map(async s => [s, await isAlive(s).catch(() => false)])));
  return { email: credentials.get()?.email ?? null, remembered: await credentials.remembered(), sessions, custom: Object.keys(credentials.get()?.sites ?? {}), ...autologin.status() };
}

const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body, type = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  if (!LOCAL_HOSTS.has(req.headers.host)) return send(403, 'yasak', 'text/plain');

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5);
    if (req.method === 'POST' && !trustedPost(req, name === 'webmail/upload')) return send(403, { error: 'İzin verilmeyen istek' });

    // UBS formları: düğme/seçim, sayfanın kendi geri gönderimiyle okulun sistemine iletilir (yalnızca kullanıcının tıklamasıyla).
    // Ortam: başvuru formu gönderimi (iki tıklamalı onaydan sonra)
    if (name === 'ortam/basvuru' && req.method === 'POST') {
      try {
        const b = await readJson(req, 100_000);
        const r = await ortam.applySubmit(b.path, b.fields || {});
        await invalidate('ortam-basvuru');
        return send(200, r);
      } catch (e) {
        if (e instanceof LoginRequired) { needLogin.add('ortam'); return send(401, { error: e.message, site: 'ortam', siteName: 'Ortam' }); }
        console.error(name, e.message);
        return send(502, { error: e.message.split('\n')[0] });
      }
    }

    if (name === 'ubs/postback' && req.method === 'POST') {
      try {
        const b = await readJson(req, 200_000);
        const r = await ubs.postback(b.path, { target: b.target, argument: b.argument, submit: b.submit, fields: b.fields || {} });
        await invalidate('ubs-page');
        needLogin.delete('ubs');
        return send(200, r);
      } catch (e) {
        if (e instanceof LoginRequired) { needLogin.add('ubs'); return send(401, { error: e.message, site: 'ubs', siteName: 'UBS' }); }
        console.error('ubs/postback', e.message);
        return send(502, { error: e.message });
      }
    }

    if (name.startsWith('webmail/') && req.method === 'POST') {
      const act = name.slice(8);
      try {
        let r;
        if (act === 'upload') {
          r = await webmail.upload(url.searchParams.get('id'), (url.searchParams.get('name') || 'dosya').slice(0, 200), await readBody(req, 45 * 2 ** 20));
        } else {
          if (!WEBMAIL_ACTIONS[act]) return send(404, { error: 'Bilinmeyen işlem' });
          r = await WEBMAIL_ACTIONS[act](await readJson(req, 4_000_000));
        }
        if (CHANGES_MAIL.has(act)) await invalidate('webmail');
        needLogin.delete('webmail');
        return send(200, r);
      } catch (e) {
        if (e instanceof LoginRequired) { needLogin.add('webmail'); return send(401, { error: e.message, site: 'webmail', siteName: 'Webmail' }); }
        console.error('webmail/' + act, e.message);
        return send(502, { error: e.message });
      }
    }

    // Tek giriş: e-posta + şifre bir kez girilir, doğrudan girilebilen sitelere paralel giriş yapılır.
    if (name === 'account' && req.method === 'GET') return send(200, await accountStatus());

    // Bildirimler (Piazza/Uzak'taki yenilikler): liste, okundu işaretleme, ayarlar, deneme
    if (name === 'notifications' && req.method === 'GET') return send(200, await notify.list());
    if (name.startsWith('notifications/') && req.method === 'POST') {
      try {
        const b = await readJson(req);
        const act = name.slice(14);
        if (act === 'read') return send(200, await notify.markRead(typeof b.course === 'string' ? b.course : null));
        if (act === 'settings') return send(200, await notify.setSettings(b));
        if (act === 'test') return send(200, notify.testToast());
        if (act === 'check') return send(200, await notify.checkNow());
        return send(404, { error: 'Bilinmeyen işlem' });
      } catch (e) { return send(500, { error: e.message }); }
    }
    if (name === 'account/login' && req.method === 'POST') {
      try {
        const { email, password, sites = {}, remember } = await readJson(req);
        const mail = String(email || '').trim().toLowerCase();
        // Şifre boş bırakılırsa (aynı e-posta için) kayıtlı şifre kullanılır; siteye özel şifreler yalnızca girilenlerle güncellenir.
        const saved = credentials.get()?.email === mail ? credentials.get() : null;
        const main = password || saved?.password;
        if (!/^[^@\s]+@etu\.edu\.tr$/i.test(mail) || !main) return send(400, { error: 'E-posta (isim@etu.edu.tr) ve şifre gerekli' });
        const merged = { ...(saved?.sites ?? {}) };
        for (const [k, v] of Object.entries(sites || {})) if (SITES[k] && typeof v === 'string' && v) merged[k] = v;
        const r = await autologin.loginAll({ email: mail, password: main, sites: merged }, remember !== false);
        for (const [site, x] of Object.entries(r.results)) if (x.ok) needLogin.delete(site);
        return send(200, r);
      } catch (e) { return send(500, { error: e.message }); }
    }
    if (name === 'account/forget' && req.method === 'POST') { await credentials.forget(); return send(200, { ok: true }); }

    // Tek site girişi: kayıtlı bilgiyle doğrudan girilebiliyorsa pencere açılmaz; yoksa giriş penceresi açılır.
    if (name === 'login') {
      const site = url.searchParams.get('site') || 'ortam';
      if (req.method !== 'POST') return send(405, { error: 'POST gerekli' });
      if (!SITES[site]) return send(404, { error: 'Bilinmeyen site' });
      if (autologin.supports(site) && !credentials.get())
        return send(409, { error: 'Önce Hesap ekranından e-posta ve şifrenizi girin.', account: true });
      // Pencereyle girişte kayıtlı bilgiler forma doldurulur (Ortam; UBS doğrulama kodu isterse)
      const c = credentials.get();
      const fill = c ? { user: SITES[site].user === 'local' ? c.email.split('@')[0] : c.email, password: credentials.passwordFor(c, site) } : null;
      try {
        if (autologin.supports(site)) {
          const r = await autologin.loginSite(site, c);
          // Site doğrulama kodu isterse kod çözülmez: okulun giriş sayfası pencerede açılır, bilgiler doldurulur, kodu kullanıcı girer.
          if (r.captcha) await login(site, fill);
          else if (!r.ok) return send(r.rejected ? 403 : 502, { error: r.rejected ? 'Şifre kabul edilmedi. Hesap sayfasından bilgilerinizi güncelleyin.' : r.error, rejected: !!r.rejected });
        } else await login(site, fill);
        needLogin.delete(site);
        return send(200, { ok: true });
      } catch (e) { return send(500, { error: 'Giriş tamamlanmadı: ' + e.message.split('\n')[0] }); }
    }
    // Dosyalar (PDF, e-posta ekleri): önbelleğe alınmaz, her istekte okulun sunucusundan çekilir.
    if (name.startsWith('file/')) {
      const fn = files[name.slice(5)];
      if (!fn) return send(404, { error: 'Bilinmeyen dosya türü' });
      try {
        const f = await fn(url.searchParams);
        const inline = INLINE_TYPES.test(f.type) && !url.searchParams.has('download');
        return send(200, f.body, INLINE_TYPES.test(f.type) ? f.type : 'application/octet-stream', {
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          'X-File-Name': encodeURIComponent(f.name), 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' });
      } catch (e) {
        if (e instanceof LoginRequired) return send(401, { error: e.message, site: e.site, siteName: SITES[e.site].name });
        console.error(name, e.message);
        return send(502, { error: e.message });
      }
    }
    if (name === 'raw') {            // geliştirme aracı: bir sitenin sayfasını oturumla ham HTML olarak verir
      const site = url.searchParams.get('site');
      if (!SITES[site]) return send(404, { error: 'Bilinmeyen site' });
      try { return send(200, await getPage(site, url.searchParams.get('path') || SITES[site].home), 'text/html; charset=utf-8'); }
      catch (e) { return send(e instanceof LoginRequired ? 401 : 502, { error: e.message }); }
    }
    const [site, fn] = routes[name] ?? [];
    if (!fn) return send(404, { error: 'Bilinmeyen uç nokta' });
    const key = name + url.search;
    const run = () => fn(url.searchParams);
    try {
      const hit = await cached(key);
      if (hit) {
        const stale = Date.now() - hit.t > staleAfter(name);
        if (stale) refresh(key, site, run).catch(e => console.error(key, e.message));
        return send(200, hit.data, undefined, { 'X-Cached-At': String(hit.t),
          ...(stale ? { 'X-Refreshing': '1' } : {}), ...(needLogin.has(site) ? { 'X-Login-Required': site } : {}) });
      }
      send(200, (await refresh(key, site, run)).data);
    } catch (e) {
      if (e instanceof LoginRequired) return send(401, { error: e.message, site: e.site, siteName: SITES[e.site].name });
      console.error(key, e);
      send(502, { error: 'Okul sunucusundan veri alınamadı: ' + e.message });
    }
    return;
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

// Uygulamayı tarayıcıda aç (paketli sürümde başlatıcı ORTAM_AC=1 verir). Zaten açıksa ikinci kopya başlamaz, yalnızca sayfayı açar.
const APP_URL = `http://localhost:${PORT}/`;
const openBrowser = () => { if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', APP_URL], { windowsHide: true }, () => {}); };
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

// Oturumları canlı tut: her site kendi aralığıyla (SITES[site].ping.every dakika). Düşen oturum,
// kayıtlı bilgi varsa arka planda yeniden açılır.
const ping = site => keepAlive(site)
  .then(async alive => {
    if (alive) return needLogin.delete(site);
    if (alive === false && !(await autologin.relogin(site))) needLogin.add(site);
    else if (alive === false) needLogin.delete(site);
  })
  .catch(() => {});
for (const f of await fs.readdir(CACHE_DIR).catch(() => []))          // eski sürümün önbellek kayıtları
  if (f.endsWith('.json') && !f.startsWith(`v${CACHE_VER}-`)) await fs.rm(path.join(CACHE_DIR, f), { force: true });
await credentials.load();
notify.start();                  // Piazza/Uzak yenilik kontrolü (ilk turda yalnızca mevcut durum kaydedilir)
webmail.startAuto();             // okunan e-postaları 12 saat sonra Çöp'e taşıma (ayar kapalıyken hiçbir şey yapmaz)
for (const [site, s] of Object.entries(SITES)) { setInterval(() => ping(site), s.ping.every * 60_000); ping(site); }
