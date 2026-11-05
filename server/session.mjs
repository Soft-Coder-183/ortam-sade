// Okul sitelerinin oturumları: her site için ayrı çerez kutusu, sessiz oturum alma (kayıtlı Chrome profili),
// kullanıcının kendisinin giriş yaptığı pencere ve oturumu canlı tutma. Kayıtlı bilgiyle doğrudan giriş
// autologin.mjs'dedir; burası ona yalnızca çerez kutusu/istek araçlarını ve "yeniden giriş" kancasını sunar.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import tls from 'node:tls';
import path from 'node:path';
import * as vault from './vault.mjs';
import * as settings from './settings.mjs';

// Giriş penceresi ve PDF için tarayıcı: Chrome yoksa Windows'ta her zaman bulunan Edge kullanılır.
const CHROME = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  .map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'));
export const CHANNEL = process.platform !== 'win32' || CHROME.some(f => fs.existsSync(f)) ? 'chrome' : 'msedge';

// uzak.etu.edu.tr sertifika zincirini eksik gönderiyor (ara sertifika yok). Tarayıcılar eksiği kendileri tamamlar,
// Node tamamlamaz; Windows'un sertifika deposu da (ara sertifika orada) güvenilenlere eklenir (= node --use-system-ca).
try { tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])]); } catch {}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const PROFILE = '.profile';               // giriş bilgileri bu Chrome profilinde kalır
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const TTL = 10_000;                       // aynı sayfayı bu süre içinde tekrar çekme
const JARS_FILE = '.cache/jars.enc';      // çerez kutuları: AES-256-GCM ile şifreli (vault.mjs)
const LOGIN_TIMEOUT = 10 * 60_000;

// home: oturum açıkken açılan sayfa (giriş penceresi de buradan başlar; oturum yoksa site girişe yönlendirir).
// loginRedirect: girişe yönlendiren adres; loginPage: giriş formunu (ya da JSON/AJAX'ta "oturum yok" yanıtını) tanıtan metin;
// passwordField: formdaki şifre alanı; ping: canlı tutma isteği ve aralığı (dakika), sitenin oturum süresine göre;
// user: kullanıcı adı biçimi ('email' = isim@etu.edu.tr, 'local' = isim).
export const SITES = {
  // userField/submit: giriş penceresinde kayıtlı bilgilerin otomatik doldurulması için (bkz. login()).
  ortam: { name: 'Ortam', base: 'https://ortam.etu.edu.tr', home: '/bilgilerim', ping: { method: 'HEAD', path: '/bilgilerim', every: 10 }, // oturum ~15 dk
    loginRedirect: /giris-yap/, loginPage: /<title>Giriş Yap/, passwordField: 'input[name="password"]', user: 'email',
    userField: '#login_form input[name="email"]', submit: '#login_form button' },
  ubs: { name: 'UBS', base: 'https://ubs.etu.edu.tr', home: '/', ping: { every: 15 },                                 // ASP.NET varsayılanı 20 dk
    loginRedirect: /login\.aspx/i, loginPage: /name="txtPassword"/, passwordField: 'input[name="txtPassword"]', user: 'email',
    userField: 'input[name="txtLogin"]', submit: '#btnLogin', captchaField: '#pnlCaptcha input, #pnlCaptcha img' },
  uzakydb: { name: 'UZAKYDB', base: 'https://uzakydb.etu.edu.tr', home: '/my/', ping: { method: 'HEAD', path: '/my/', every: 180 }, // 4 sa
    loginRedirect: /\/login\/index\.php/, loginPage: /<form[^>]+id="login"|"errorcode":"(servicerequireslogin|requireloginerror)"/,
    passwordField: 'input[name="password"]', user: 'local' },
  webmail: { name: 'Webmail', base: 'https://webmail.etu.edu.tr', home: '/roundcube/?_task=mail', ping: { every: 150 }, // 3 sa
    loginRedirect: /_task=login/, loginPage: /name="_pass"|session_error/, passwordField: 'input[name="_pass"]', user: 'local' },
  uzak: { name: 'Uzak', base: 'https://uzak.etu.edu.tr', home: '/my/', ping: { method: 'HEAD', path: '/my/', every: 180 },  // 4 sa
    loginRedirect: /\/login\/index\.php/, loginPage: /<form[^>]+id="login"|"errorcode":"(servicerequireslogin|requireloginerror)"/,
    passwordField: 'input[name="password"]', user: 'local' },
  // Piazza: oturum yokken /class ana sayfaya ("/") yönlendirir; API "oturum yok" yanıtı loginPage ile tanınır.
  piazza: { name: 'Piazza', base: 'https://piazza.com', home: '/class', ping: { path: '/class', every: 240 },
    loginRedirect: /^(https:\/\/piazza\.com)?\/(\?.*)?$|\/account\/login/, loginPage: /id="login-form"|"error":"(Not logged in|Not authorized|Request not valid)/i,
    passwordField: 'input[name="password"]', user: 'email' },
};

export class LoginRequired extends Error {
  constructor(site) { super(`${SITES[site].name} oturumu kapalı. Devam etmek için giriş yapın.`); this.site = site; }
}

// Sayfa başka bir siteye yönlendirdi (ör. UBS "Dönemlik Ders Programı" -> program.etu.edu.tr?oturumNo=…).
export class ExternalRedirect extends Error {
  constructor(url) { super('Bu sayfa başka bir sitede açılıyor: ' + new URL(url).host); this.url = url; }
}

// ---------- çerez kutuları ----------

const state = Object.fromEntries(Object.keys(SITES).map(k => [k, { jar: new Map(), pages: new Map(), failedAt: 0, seeding: null, loggingIn: null }]));
fs.mkdirSync('.cache/api', { recursive: true });
for (const site of settings.get().loggedOut) if (state[site]) state[site].loggedOut = true;
const saveJars = () => vault.writeSync(JARS_FILE, Object.fromEntries(Object.entries(state).map(([k, s]) => [k, Object.fromEntries(s.jar)])));
{
  // Eski sürümlerin düz metin çerez dosyaları okunur, şifreli dosyaya taşınır ve silinir
  const plain = ['.cache/jars.json', '.cache/jar.json'].filter(f => fs.existsSync(f));
  const saved = vault.readSync(JARS_FILE) ?? vault.readSync('.cache/jars.json');
  if (saved) for (const [site, jar] of Object.entries(saved)) if (state[site]) for (const [k, v] of Object.entries(jar)) state[site].jar.set(k, v);
  if (!saved) { const old = vault.readSync('.cache/jar.json'); if (old) for (const [k, v] of Object.entries(old)) state.ortam.jar.set(k, v); }
  if (plain.length) { saveJars(); for (const f of plain) fs.rmSync(f, { force: true }); }
}

const cookieHeader = jar => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
export const cookie = (site, name) => state[site].jar.get(name);    // ör. Piazza'nın CSRF başlığı oturum çerezinden gelir

function takeCookies(site, cookies) {
  const jar = state[site].jar;
  jar.clear();
  for (const c of cookies) jar.set(c.name, c.value);
  state[site].pages.clear();
  loggedIn(site);
  saveJars();
}
// Kullanıcı yeniden giriş yaptı: "oturumu kapattım" işareti kalkar
function loggedIn(site) {
  if (!state[site].loggedOut) return;
  state[site].loggedOut = false;
  settings.setLoggedOut(site, false);
}

// Giriş denemeleri geçici bir kutuda yapılır; yalnızca başarılı olursa sitenin kutusunun yerine geçer.
export const newJar = () => new Map();
export function commitJar(site, jar) {
  const st = state[site];
  st.jar.clear();
  for (const [k, v] of jar) st.jar.set(k, v);
  st.pages.clear();
  st.failedAt = 0;
  loggedIn(site);
  saveJars();
}

function absorbSetCookie(jar, res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = line.split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
    const expired = attrs.some(a => /^\s*max-age=0\s*$/i.test(a) || (/^\s*expires=/i.test(a) && Date.parse(a.split('=')[1]) < Date.now()));
    if (expired || value === 'deleted' || value === '-del-') jar.delete(name); else jar.set(name, value);
  }
  if (Object.values(state).some(st => st.jar === jar)) saveJars();
}

// Tek istek (yönlendirme izlenmez). Giriş akışları yönlendirmeleri kendileri izler.
// binary: gövde metin yerine Buffer olarak döner (PDF, ek dosyalar).
export async function rawFetch(site, path, { method = 'GET', headers = {}, body, binary = false } = {}, jar = state[site].jar) {
  const s = SITES[site];
  const res = await fetch(s.base + path, { method, body, redirect: 'manual',
    headers: { Cookie: cookieHeader(jar), 'User-Agent': UA, 'Accept-Language': 'tr', ...headers } });
  absorbSetCookie(jar, res);
  const out = { status: res.status, location: res.headers.get('location'),
    type: res.headers.get('content-type') || '', disposition: res.headers.get('content-disposition') || '' };
  if (binary) out.body = Buffer.from(await res.arrayBuffer());
  else out.text = method === 'HEAD' ? '' : await res.text();
  return out;
}

// ---------- tarayıcı (yalnızca oturum almak/giriş için) ----------

// Aynı profil aynı anda tek Chrome'da açılabilir; açma/kapama işlemleri sırayla yapılır.
let visible = null;                       // { ctx, users } — açık giriş penceresi
let lock = Promise.resolve();
const exclusive = fn => { const p = lock.then(fn, fn); lock = p.catch(() => {}); return p; };

async function cdpAvailable() {
  try { return (await fetch(CDP + '/json/version', { signal: AbortSignal.timeout(500) })).ok; } catch { return false; }
}

async function pageLoggedIn(page, s) {
  try {
    if (new URL(page.url()).origin !== s.base) return false;
    return await page.evaluate(sel => document.readyState === 'complete' && !document.querySelector(sel), s.passwordField);
  } catch { return false; }       // sayfa o an yönleniyorsa
}

// Görünmez kontrol: açık giriş penceresi varsa onu, yoksa profilli görünmez Chrome'u kullanır.
async function withHiddenBrowser(fn) {
  if (visible) return fn(visible.ctx);
  return exclusive(async () => {
    if (visible) return fn(visible.ctx);
    if (await cdpAvailable()) {
      const b = await chromium.connectOverCDP(CDP, { timeout: 5000 });
      try { return await fn(b.contexts()[0]); } finally { await b.close().catch(() => {}); }
    }
    const ctx = await chromium.launchPersistentContext(PROFILE, { channel: CHANNEL, headless: true });
    try { return await fn(ctx); } finally { await ctx.close().catch(() => {}); }
  });
}

function acquireVisible() {
  return exclusive(async () => {
    if (!visible) {
      const ctx = await chromium.launchPersistentContext(PROFILE, { channel: CHANNEL, headless: false, viewport: null, args: ['--window-size=620,880'] });
      visible = { ctx, users: 0 };
      ctx.on('close', () => { if (visible?.ctx === ctx) visible = null; });
    }
    visible.users++;
    return visible.ctx;
  });
}

function releaseVisible(ctx) {
  if (visible?.ctx !== ctx || --visible.users > 0) return;
  visible = null;
  return exclusive(() => ctx.close().catch(() => {}));
}

// Kullanıcının kendisinin kullandığı görünür sekme: url açılır, kullanıcı sayfada istediğini yapar (form seçer, gönderir;
// doğrulama çıkarsa kendisi yanıtlar). Uygulama hiçbir şeye tıklamaz; onResponse yalnızca sayfanın aldığı yanıtları okur
// (ör. kullanıcının yaptığı aramanın sonucu). onLoad her sayfa yüklenişinde çağrılır (ör. bilgi şeridi göstermek için).
// Sekme kapanınca ya da süre dolunca biter.
export async function userWindow(url, { onResponse, onLoad, timeout = 30 * 60_000 } = {}) {
  const ctx = await acquireVisible();
  const page = await ctx.newPage();
  try {
    if (onResponse) page.on('response', r => { Promise.resolve(onResponse(r, page)).catch(() => {}); });
    if (onLoad) page.on('load', () => { Promise.resolve(onLoad(page)).catch(() => {}); });
    await page.goto(url, { waitUntil: 'load' });
    await page.bringToFront();
    await Promise.race([page.waitForEvent('close', { timeout: 0 }), new Promise(ok => setTimeout(ok, timeout))]);
  } finally {
    if (!page.isClosed()) await page.close().catch(() => {});
    await releaseVisible(ctx);
  }
}

// ---------- oturum alma ----------

async function seedSilently(site) {
  const s = SITES[site];
  await withHiddenBrowser(async ctx => {
    const page = await ctx.newPage();
    try {
      await page.goto(s.base + s.home, { waitUntil: 'load', timeout: 30_000 });
      if (await pageLoggedIn(page, s)) takeCookies(site, await ctx.cookies(s.base));
    } finally {
      await page.close().catch(() => {});
    }
  });
}

function seed(site) {
  const st = state[site];
  st.seeding ??= seedSilently(site).catch(() => {}).finally(() => { st.seeding = null; });
  return st.seeding;
}

// Kayıtlı bilgiler (fill) varsa giriş formuna yazılır ve düğmeye basılır. Ortam'ın görünmez reCAPTCHA'sı gerçek tarayıcıda
// kendi kontrolünü yapar; soru gösterirse kullanıcı pencerede yanıtlar (atlatılmaz, çözülmez). Doğrulama kodu kutusu olan
// sayfalarda (UBS) yalnızca doldurulur, kodu kullanıcı yazar. Doldurulamazsa kullanıcı her şeyi kendisi girer.
async function autofill(page, s, { user, password }) {
  await page.waitForSelector(s.passwordField, { timeout: 15_000 });
  await page.fill(s.userField, user);
  await page.fill(s.passwordField, password);
  if (s.submit && !(s.captchaField && (await page.$(s.captchaField)))) await page.click(s.submit);
}

// Sitenin giriş sayfasını görünür pencerede açar (fill varsa bilgileri doldurur); gerisini kullanıcı tamamlar.
// Sayfada şifre alanı kalmayınca (iki kontrol üst üste) çerezleri alır ve sekmeyi kapatır.
export function login(site, fill = null) {
  const s = SITES[site], st = state[site];
  st.loggingIn ??= (async () => {
    const ctx = await acquireVisible();
    const page = await ctx.newPage();
    try {
      await page.goto(s.base + s.home, { waitUntil: 'load' });
      await page.bringToFront();
      if (fill && s.userField && !(await pageLoggedIn(page, s))) await autofill(page, s, fill).catch(() => {});
      const until = Date.now() + LOGIN_TIMEOUT;
      let streak = 0;
      while (streak < 2) {
        if (page.isClosed()) throw new Error('Giriş penceresi kapatıldı');
        if (Date.now() > until) throw new Error('Giriş için süre doldu');
        streak = (await pageLoggedIn(page, s)) ? streak + 1 : 0;
        await new Promise(r => setTimeout(r, 1000));
      }
      takeCookies(site, await ctx.cookies(s.base));
      st.failedAt = 0;
      return { ok: true };
    } finally {
      await page.close().catch(() => {});
      await releaseVisible(ctx);
    }
  })().finally(() => { st.loggingIn = null; });
  return st.loggingIn;
}


// ---------- sayfa çekme ----------

// Oturumlu istek; oturum yoksa (girişe yönlendirme, giriş formu ya da "oturum yok" yanıtı) null döner.
// Metin isteğinde sayfanın HTML'i, ikili istekte (opts.binary) rawFetch yanıtının tamamı döner.
async function rawRequest(site, path, opts = {}, hops = 0) {
  const s = SITES[site];
  const res = await rawFetch(site, path, opts);
  if (res.status >= 300 && res.status < 400) {
    const u = new URL(res.location || '/', s.base + path);
    if (s.loginRedirect.test(u.href) || hops > 5) return null;
    if (u.origin !== s.base) throw new ExternalRedirect(u.href);
    return rawRequest(site, u.pathname + u.search, { binary: opts.binary }, hops + 1);
  }
  if (opts.binary) return /html/i.test(res.type) && s.loginPage.test(res.body.toString('utf8')) ? null : res;
  return s.loginPage.test(res.text) ? null : res.text;
}

// Oturum düşünce önce kayıtlı bilgiyle doğrudan giriş denenir (autologin.mjs bu kancayı kurar),
// olmazsa kayıtlı Chrome profilinden sessizce oturum alınır.
let relogin = async () => false;
export const setRelogin = fn => { relogin = fn; };

async function authed(site, path, opts) {
  const st = state[site];
  if (st.loggedOut) throw new LoginRequired(site);           // kullanıcı bu sitede oturumu kapattı: kendisi girene kadar girilmez
  const recentlyFailed = Date.now() - st.failedAt < 15_000;
  let r = st.jar.size ? await rawRequest(site, path, opts) : null;
  // Ayar kapalıysa oturum düşünce kendiliğinden yeniden girilmez; kullanıcı Giriş yap'a basar
  if (r === null && !recentlyFailed && settings.get().autoRelogin) {
    if (await relogin(site).catch(() => false)) r = await rawRequest(site, path, opts);
    if (r === null) {
      await seed(site);
      if (st.jar.size) r = await rawRequest(site, path, opts);
    }
  }
  if (r === null) {
    st.failedAt = Date.now();
    throw new LoginRequired(site);
  }
  st.usedAt = Date.now();             // gerçek istek oturumu zaten tazeler: canlı tutma o tur atlanır
  return r;
}

// opts (POST, özel başlık) verilirse sayfa önbelleği kullanılmaz.
export async function getPage(site, path, opts) {
  const st = state[site];
  const hit = !opts && st.pages.get(path);
  if (hit && Date.now() - hit.t < TTL) return hit.html;
  const html = await authed(site, path, opts);
  if (!opts) st.pages.set(path, { t: Date.now(), html });
  return html;
}

// Dosya (PDF, ek) indirme: { status, type, disposition, body: Buffer }. Önbelleğe alınmaz.
export const getFile = (site, path, opts = {}) => authed(site, path, { ...opts, binary: true });

// Content-Disposition'dan dosya adı (filename* UTF-8 biçimi dahil).
export function fileName(disposition, fallback) {
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(disposition || '');
  if (star) try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch {}
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition || '');
  if (!plain) return fallback;
  const raw = plain[1].trim();
  // Bazı sunucular UTF-8 adı Latin-1 başlıkta gönderir; bozuk görünüyorsa düzelt.
  const fixed = Buffer.from(raw, 'latin1').toString('utf8');
  return fixed.includes('�') ? raw : fixed;
}

// ---------- canlı tutma ----------

// ---------- oturumu kapatma ----------
// Sitenin kendisinde çıkış (oturum sunucuda da biter), sonra uygulamadaki ve kayıtlı tarayıcı profilindeki çerezler silinir.
// UBS'nin bilinen bir çıkış adresi yok: orada yalnızca uygulamadaki oturum silinir, sunucudaki oturum kısa sürede kendiliğinden düşer.
const LOGOUT = {
  ortam: async () => '/cikis-yap',
  uzak: async site => moodleLogout(site), uzakydb: async site => moodleLogout(site),
  webmail: async () => { const r = await rawFetch('webmail', '/roundcube/?_task=mail'); const t = (r.text.match(/"request_token":"(\w+)"/) || [])[1]; return t ? `/roundcube/?_task=logout&_token=${t}` : null; },
  piazza: async () => '/logout',
};
async function moodleLogout(site) {
  const r = await rawFetch(site, '/my/');
  const k = (r.text.match(/"sesskey":"(\w+)"/) || [])[1];
  return k ? `/login/logout.php?sesskey=${k}` : null;
}
export async function logout(site) {
  const st = state[site];
  let remote = false;
  if (st.jar.size && LOGOUT[site]) {
    try { const p = await LOGOUT[site](site); if (p) { await rawFetch(site, p); remote = true; } } catch {}
  }
  st.jar.clear();
  st.pages.clear();
  st.loggedOut = true;
  settings.setLoggedOut(site, true);
  saveJars();
  // Kayıtlı tarayıcı profili (Ortam/UBS penceresiyle giriş) bu sitenin çerezlerini de unutur
  await withHiddenBrowser(ctx => ctx.clearCookies({ domain: new URL(SITES[site].base).hostname })).catch(() => {});
  return { site, remote };
}
export const sessionInfo = () => Object.fromEntries(Object.keys(SITES).map(s => [s, { cookies: state[s].jar.size > 0, loggedOut: !!state[s].loggedOut, usedAt: state[s].usedAt ?? null }]));

// Verilen çerez kutusuyla sitenin oturumu açık mı? (giriş doğrulaması ve canlı tutma ortak kullanır)
export async function isAlive(site, jar = state[site].jar) {
  const s = SITES[site];
  const { method = 'GET', path = s.home } = s.ping;
  const res = await rawFetch(site, path, { method }, jar);
  if (res.status >= 300 && res.status < 400) return !s.loginRedirect.test(res.location || '');
  return res.status === 200 && !s.loginPage.test(res.text);
}

// Oturum açık değilse null, açıksa true, kapanmışsa false döner. Sonuç .cache/session.log'a yazılır.
// Son ping aralığı içinde siteye gerçek bir istek gittiyse (ekran açıldı, bildirim kontrolü) ayrıca sorulmaz: 'skip'.
export async function keepAlive(site) {
  if (!settings.get().keepAlive || state[site].loggedOut) return 'off';
  if (!state[site].jar.size) return null;
  if (Date.now() - (state[site].usedAt ?? 0) < SITES[site].ping.every * 60_000 * 0.8) return 'skip';
  const alive = await isAlive(site);
  fs.appendFileSync('.cache/session.log', `${new Date().toISOString()} ${site} ${alive ? 'açık' : 'KAPALI'}\n`);
  return alive;
}
