// Uygulamanın çekirdeği: /api/* isteklerini ilgili okul sitesinin TEK sayfasından karşılar. Windows'ta server.mjs'in HTTP sunucusu,
// Android'de WebView içindeki köprü (mobile/core.mjs) çağırır; bu dosya HTTP'yi bilmez, her uç { code, body, type, headers } döndürür.
// Daha önce açılmış bir ekranın son verisi anında döner, yenisi arka planda çekilir (X-Refreshing başlığı).
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITES, LoginRequired, login, keepAlive, getPage, isAlive, logout, sessionInfo, openPage } from './session.mjs';
import * as vault from './vault.mjs';
import * as settings from './settings.mjs';
import crypto from 'node:crypto';
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
import * as update from './update.mjs';
import * as mevzuat from './mevzuat.mjs';
import * as program from './program.mjs';
import * as rez from './rezervasyon.mjs';

const CACHE_DIR = '.cache/api';
const CACHE_VER = 13;            // ayrıştırıcıların çıktısı değişince artır: eski kayıtlar açılışta silinir
const STALE_AFTER = 20_000;      // varsayılan: kayıtlı veri hemen gösterilir, bu süreden eskiyse arka planda yenilenir
// Seyrek değişen bilgiler okulun sunucusuna her açılışta sorulmaz (dakika cinsinden).
const STALE_MIN = { exams: 10, schedule: 30, courses: 30, course: 360, derslerim: 10, mufredat: 60, bilgilerim: 60, notlar: 10,
  ortak: 60, 'yabanci-dil': 60, odeme: 60, cap: 60, 'ortam-acilan': 360, 'ortam-basvuru': 10, 'etu-takvim': 1440, 'etu-fakulteler': 1440, 'etu-kadro': 1440, 'etu-kadro-bolum': 1440, 'uzak-course': 10, 'piazza-resources': 30, 'uzakydb-course': 10, ubs: 5, plan: 10,
  'ortam-duyuru': 30, 'uzakydb-ek': 360, hatirlatmalar: 360 };
const staleAfter = name => (STALE_MIN[name] ?? 0) * 60_000 || STALE_AFTER;

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
  'rez-kod': () => rez.captcha(),                           // rezervasyon güvenlik kodu görseli (kodu kullanıcı yazar)
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
  'etu-kadro-bolum': ['etu', q => etu.staff(q.get('slug'))],
  'ortam-basvuru': ['ortam', q => ortam.applyPage(q.get('path'))],   // hareketlilik formları ve başvurularım
  derslerim: ['ortam', courses.derslerim],
  'ortam-duyuru': ['ortam', ortam.notices],               // Ortam ana sayfasındaki anket ve duyuru kartları
  'uzakydb-ek': ['uzakydb', () => moodle('uzakydb').extras()],   // UZAKYDB panosu ve ön sayfasındaki ek bloklar/duyurular
  hatirlatmalar: ['etu', () => notify.deadlines()],        // Akademik takvimde yaklaşan son tarihler
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

// ---------- kilit ----------
const lockTokens = new Map();     // açık kilit oturumları: belirteç -> son kullanım (yalnızca bellekte; uygulama kapanınca biter)
let lockFails = 0, lockFailedAt = 0;
const lockWait = () => (lockFails < 5 ? 0 : Math.max(0, lockFailedAt + Math.min(15 * 60_000, 30_000 * 2 ** (lockFails - 5)) - Date.now()));
const tokenOf = req => (/(?:^|;\s*)os_kilit=([0-9a-f]{48})/.exec(req.cookie || '') || [])[1];
function unlocked(req) {
  if (!settings.get().lock) return true;
  const t = tokenOf(req), seen = t && lockTokens.get(t);
  const idle = (settings.get().lockIdle || 0) * 60_000;
  if (!seen || (idle && Date.now() - seen > idle) || Date.now() - seen > 12 * 3600_000) { if (t) lockTokens.delete(t); return false; }
  lockTokens.set(t, Date.now());
  return true;
}

// ---------- durum ----------
const STARTED = Date.now();
const lastPing = {};
function status() {
  const s = settings.get(), info = sessionInfo(), n = notify.schedule(), u = update.status(), now = Date.now();
  const jobs = [];
  for (const [site, x] of Object.entries(SITES)) {
    const every = x.ping.every;
    const on = s.keepAlive && info[site].cookies && !info[site].loggedOut;
    jobs.push({ id: 'ping-' + site, label: `${x.name} oturumunu açık tutma`, every, on, last: lastPing[site] ?? null, next: on ? (lastPing[site] ?? STARTED) + every * 60_000 : null });
  }
  for (const [k, v] of Object.entries(n)) jobs.push({ id: 'notify-' + k, label: v.label, every: v.every, on: v.on, last: v.last, next: v.on ? Math.max(now, (v.last ?? STARTED) + v.every * 60_000) : null });
  jobs.push({ id: 'update', label: 'Yeni sürüm denetimi (GitHub)', every: 360, on: true, last: u.checkedAt, next: (u.checkedAt ?? STARTED) + (u.checkedAt ? 360 : 1) * 60_000 });
  return { version: update.current, pid: process.pid, startedAt: STARTED, now, keepAlive: s.keepAlive, autoRelogin: s.autoRelogin,
    lock: !!s.lock, lockIdle: s.lockIdle, sessions: info, jobs, encrypted: true };
}
const memo = new Map();       // anahtar -> { t, data }
const inflight = new Map();   // anahtar -> Promise
const fileOf = key => path.join(CACHE_DIR, `v${CACHE_VER}-${encodeURIComponent(key)}.json`);

async function cached(key) {
  if (memo.has(key)) return memo.get(key);
  const e = await vault.read(fileOf(key));              // okuldan alınan kişisel veri: diskte AES-256-GCM ile şifreli
  if (e) memo.set(key, e);
  return e;
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
      await vault.write(fileOf(key), e).catch(() => {});
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

async function readJson(req, max = 10_000) {
  const body = (await req.readBody(max)).toString('utf8');
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

export const hooks = { shutdown: () => {} };

// Giriş penceresinde kullanıcı bilgilerini kendisi yazdıysa: kayıtlı bilgi yoksa bunlarla diğer bütün sitelere de girilir
// (Hesap'taki tek girişle aynı); başka şifre yazdıysa yalnızca o siteye özel şifre olarak saklanır.
async function adoptTyped(site, r) {
  const typed = r?.typed;
  const email = String(typed?.user || '').trim().toLowerCase();
  if (!typed?.password || !/^[^@\s]+@etu\.edu\.tr$/i.test(email)) return;
  const saved = credentials.get();
  if (saved?.email === email) {
    if (credentials.passwordFor(saved, site) === typed.password) return;
    return credentials.save({ ...saved, sites: { ...saved.sites, [site]: typed.password } }, await credentials.remembered());
  }
  const all = await autologin.loginAll({ email, password: typed.password, sites: {} }, true).catch(() => null);
  for (const [s, x] of Object.entries(all?.results ?? {})) if (x.ok) needLogin.delete(s);
}     // "Uygulamayı kapat": Windows'ta süreci bitirir

// req: { method, url: URL, cookie, readBody(enFazla) -> Buffer }. Dönen değer: { code, body, type, headers }.
export async function handleApi(req) {
  const url = req.url;
  const send = (code, body, type = 'application/json; charset=utf-8', headers = {}) => ({ code, body, type, headers });
  const name = url.pathname.slice(5);
  // ---------- Giriş PIN'i ----------
  // PIN açıksa kilit açılmadan hiçbir veri ucu yanıt vermez (423); arayüz kilit ekranını gösterir.
  if (name === 'lock' && req.method === 'GET') return send(200, { enabled: !!settings.get().lock, unlocked: unlocked(req), idle: settings.get().lockIdle });
  if (name === 'lock/unlock' && req.method === 'POST') {
    const wait = lockWait();
    if (wait) return send(429, { error: `Çok fazla yanlış deneme. ${Math.ceil(wait / 1000)} saniye sonra tekrar dene.` });
    const b = await readJson(req).catch(() => ({}));
    if (!settings.get().lock || settings.checkPin(b.pin)) {
      lockFails = 0;
      const t = crypto.randomBytes(24).toString('hex');
      lockTokens.set(t, Date.now());
      return send(200, { ok: true }, undefined, { 'Set-Cookie': `os_kilit=${t}; HttpOnly; SameSite=Strict; Path=/` });
    }
    lockFails++; lockFailedAt = Date.now();
    return send(403, { error: 'PIN yanlış' });
  }
  if (settings.get().lock && !unlocked(req)) return send(423, { locked: true, error: 'Uygulama kilitli' });
  if (name === 'lock/lock' && req.method === 'POST') { lockTokens.delete(tokenOf(req)); return send(200, { ok: true }); }
  if (name === 'lock/set' && req.method === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    if (!settings.pinValid(b.pin)) return send(400, { error: 'PIN 4–8 rakam olmalı' });
    settings.setPin(b.pin);
    lockTokens.clear();
    const t = crypto.randomBytes(24).toString('hex');
    lockTokens.set(t, Date.now());
    return send(200, { ok: true }, undefined, { 'Set-Cookie': `os_kilit=${t}; HttpOnly; SameSite=Strict; Path=/` });
  }
  if (name === 'lock/clear' && req.method === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    if (!settings.checkPin(b.pin)) return send(403, { error: 'PIN yanlış' });
    settings.clearPin();
    return send(200, { ok: true });
  }

  // ---------- Uygulama durumu ve güvenlik ayarları ----------
  if (name === 'status' && req.method === 'GET') return send(200, status());
  if (name === 'shutdown' && req.method === 'POST') {
    setTimeout(hooks.shutdown, 300);
    return send(200, { ok: true });
  }
  if (name === 'security' && req.method === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    const patch = {};
    for (const k of ['keepAlive', 'autoRelogin']) if (typeof b[k] === 'boolean') patch[k] = b[k];
    if ([0, 5, 15, 30, 60].includes(b.lockIdle)) patch.lockIdle = b.lockIdle;
    settings.set(patch);
    return send(200, status());
  }
  if (name === 'logout' && req.method === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    const sites = b.site === 'all' ? Object.keys(SITES) : SITES[b.site] ? [b.site] : [];
    if (!sites.length) return send(400, { error: 'Bilinmeyen site' });
    const results = await Promise.all(sites.map(s => logout(s).catch(e => ({ site: s, error: e.message }))));
    for (const s of sites) needLogin.add(s);
    for (const [n, [site]] of Object.entries(routes)) if (sites.includes(site)) await invalidate(n);   // o sitenin önbelleğe alınmış verisi silinir
    return send(200, { results, status: status() });
  }

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
        r = await webmail.upload(url.searchParams.get('id'), (url.searchParams.get('name') || 'dosya').slice(0, 200), await req.readBody(45 * 2 ** 20));
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
  // Güncelleme: denetim (GET) ve yalnızca kullanıcının onayıyla kurulum (POST). Kurulumdan sonra başlatıcı yeni sürümü açar.
  if (name === 'update' && req.method === 'GET') {
    try { return send(200, await update.check(url.searchParams.get('force') === '1')); }
    catch (e) { return send(200, { ...update.status(), error: 'Güncelleme denetlenemedi: ' + e.message }); }
  }
  if (name === 'update/apply' && req.method === 'POST') {
    try {
      const r = await update.apply();
      setTimeout(update.restart, 800);
      return send(200, r);
    } catch (e) { return send(500, { error: e.message }); }
  }
  // Mevzuat (herkese açık kaynaklar, giriş gerekmez): modül belgeleri kendi önbelleğinde tutar (.cache/mevzuat)
  // Dönem ders programı: uygulamayla gelen veri dosyası (Açılan Dersler ve haftalık plan)
  if (name === 'program' && req.method === 'GET') return send(200, program.get());
  // Kütüphane ve müzik stüdyosu rezervasyonu: boş saatler her açılışta okulun sitesinden alınır, gönderim yalnızca kullanıcının tıklamasıyla
  if (name === 'rezervasyon' && req.method === 'GET') {
    try { return send(200, await rez.grid(url.searchParams.get('kind'), url.searchParams.get('date'))); }
    catch (e) { return send(502, { error: e.message }); }
  }
  if ((name === 'rezervasyon/check' || name === 'rezervasyon/confirm') && req.method === 'POST') {
    try { return send(200, name.endsWith('check') ? await rez.check(await readJson(req)) : await rez.confirm()); }
    catch (e) { return send(400, { error: e.message }); }
  }
  const MEVZUAT = { mevzuat: () => mevzuat.listing(), 'mevzuat-doc': q => mevzuat.doc(q.get('id')), 'mevzuat-ara': q => mevzuat.search(q.get('q') || ''),
    'mevzuat-yanitlar': () => mevzuat.answers(), 'mevzuat-duyurular': () => mevzuat.news(), 'mevzuat-duyuru': q => mevzuat.newsItem(q.get('path')) };
  if (MEVZUAT[name] && req.method === 'GET') {
    try { return send(200, await MEVZUAT[name](url.searchParams)); }
    catch (e) { console.error(name, e.message); return send(502, { error: 'Mevzuat alınamadı: ' + e.message }); }
  }
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
      if (r.results.webmail?.ok) notify.flushMail();          // girişten önce gönderilemeyen bildirim e-postaları
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
        if (r.captcha) await adoptTyped(site, await login(site, fill));
        else if (!r.ok) return send(r.rejected ? 403 : 502, { error: r.rejected ? 'Şifre kabul edilmedi. Hesap sayfasından bilgilerinizi güncelleyin.' : r.error, rejected: !!r.rejected });
      } else await adoptTyped(site, await login(site, fill));
      needLogin.delete(site);
      return send(200, { ok: true });
    } catch (e) { return send(500, { error: 'Giriş tamamlanmadı: ' + e.message.split('\n')[0] }); }
  }
  // Okul sitesinin bir sayfasını (ör. Ortam'daki anket) uygulamanın oturumuyla görünür pencerede açar; kullanıcı pencereyi
  // kapatınca yanıt döner ve o sayfaya bağlı önbellek silinir (anket doldurulduysa uyarı kalkar).
  if (name === 'open-page' && req.method === 'POST') {
    const site = url.searchParams.get('site') || 'ortam';
    const p = url.searchParams.get('path') || '/';
    if (!SITES[site] || !p.startsWith('/') || p.startsWith('//')) return send(400, { error: 'Geçersiz sayfa' });
    const c = credentials.get();
    const fill = c ? { user: SITES[site].user === 'local' ? c.email.split('@')[0] : c.email, password: credentials.passwordFor(c, site) } : null;
    try { await openPage(site, p, fill); }
    catch (e) { return send(500, { error: 'Pencere açılamadı: ' + e.message.split('\n')[0] }); }
    if (site === 'ortam') { await invalidate('ortam-duyuru'); await invalidate('notlar'); }
    return send(200, { ok: true });
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
    return send(200, (await refresh(key, site, run)).data);
  } catch (e) {
    if (e instanceof LoginRequired) return send(401, { error: e.message, site: e.site, siteName: SITES[e.site].name });
    console.error(key, e);
    return send(502, { error: 'Okul sunucusundan veri alınamadı: ' + e.message });
  }
}

// Oturumları canlı tut: her site kendi aralığıyla (SITES[site].ping.every dakika). Düşen oturum,
// kayıtlı bilgi varsa arka planda yeniden açılır.
// Ayar kapalıysa (Güvenlik ve Oturumlar) hiç sorulmaz; kendiliğinden yeniden giriş de ayara bağlıdır.
const ping = site => keepAlive(site)
  .then(async alive => {
    if (alive === 'off') return;
    lastPing[site] = Date.now();
    if (alive) return needLogin.delete(site);
    if (alive === false && !(settings.get().autoRelogin && await autologin.relogin(site))) needLogin.add(site);
    else if (alive === false) needLogin.delete(site);
  })
  .catch(() => {});

// Sunucu açılınca (Windows) ya da uygulama açılınca (Android) çalışan arka plan işleri. Dosya ve kimlik hazırlığı ayrı tutulur:
// Android'in arka plan kontrolü yalnızca prepare() + notify.runDue() yapar.
export async function prepare() {
  for (const f of await fs.readdir(CACHE_DIR).catch(() => []))          // eski sürümün önbellek kayıtları
    if (f.endsWith('.json') && !f.startsWith(`v${CACHE_VER}-`)) await fs.rm(path.join(CACHE_DIR, f), { force: true });
  await credentials.load();
}
export async function startBackground() {
  await prepare();
  notify.start();                  // Piazza/Uzak yenilik kontrolü (ilk turda yalnızca mevcut durum kaydedilir)
  webmail.startAuto();             // okunan e-postaları 12 saat sonra Çöp'e taşıma (ayar kapalıyken hiçbir şey yapmaz)
  // Yeni sürüm denetimi: açılıştan 1 dk sonra ve 6 saatte bir; yeni sürüm ilk görüldüğünde bir kez bildirim.
  const checkUpdate = () => update.check().then(u => u.newer && notify.announceUpdate(u.latest)).catch(() => {});
  setTimeout(checkUpdate, 60_000);
  setInterval(checkUpdate, 6 * 3600_000);
  for (const [site, s] of Object.entries(SITES)) { setInterval(() => ping(site), s.ping.every * 60_000); ping(site); }
}
