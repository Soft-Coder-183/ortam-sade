// Masaüstü tarayıcısı (Chrome ya da Edge): görünür giriş penceresi ve kayıtlı profilden sessiz oturum alma.
// Android'de bunun yerini mobile/shim/browser.mjs alır (uygulama içi WebView).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import tls from 'node:tls';
import path from 'node:path';

// Giriş penceresi ve PDF için tarayıcı: Chrome yoksa Windows'ta her zaman bulunan Edge kullanılır.
const CHROME = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  .map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'));
export const CHANNEL = process.platform !== 'win32' || CHROME.some(f => fs.existsSync(f)) ? 'chrome' : 'msedge';

// uzak.etu.edu.tr sertifika zincirini eksik gönderiyor (ara sertifika yok). Tarayıcılar eksiği kendileri tamamlar,
// Node tamamlamaz; Windows'un sertifika deposu da (ara sertifika orada) güvenilenlere eklenir (= node --use-system-ca).
try { tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])]); } catch {}

const PROFILE = '.profile';               // giriş bilgileri bu Chrome profilinde kalır
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const LOGIN_TIMEOUT = 10 * 60_000;

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

// Kayıtlı profilde oturum açıksa sitenin çerezleri, değilse null.
export function seedCookies(s) {
  return withHiddenBrowser(async ctx => {
    const page = await ctx.newPage();
    try {
      await page.goto(s.base + s.home, { waitUntil: 'load', timeout: 30_000 });
      return (await pageLoggedIn(page, s)) ? await ctx.cookies(s.base) : null;
    } finally {
      await page.close().catch(() => {});
    }
  });
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
// Sayfada şifre alanı kalmayınca (iki kontrol üst üste) çerezleri döndürür ve sekmeyi kapatır.
export async function visibleLogin(s, fill = null) {
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
    return await ctx.cookies(s.base);
  } finally {
    await page.close().catch(() => {});
    await releaseVisible(ctx);
  }
}

export const clearCookies = host => withHiddenBrowser(ctx => ctx.clearCookies({ domain: host }));
