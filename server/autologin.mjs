// Tek giriş: kayıtlı e-posta/şifreyle sitelere doğrudan (HTTP formu üzerinden, pencere açmadan) giriş.
// Her deneme geçici bir çerez kutusunda yapılır ve sitenin kendi "oturum açık mı" kontrolüyle doğrulanır;
// yalnızca başarılıysa sitenin oturumunun yerine geçer (başarısız deneme mevcut oturumu bozmaz).
// Hesap kilitlenmesin diye: şifresi reddedilen site, kullanıcı bilgileri yeniden girene kadar otomatik denenmez.
import * as cheerio from 'cheerio';
import { SITES, rawFetch, newJar, commitJar, isAlive, setRelogin } from './session.mjs';
import * as credentials from './credentials.mjs';

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const form = fields => new URLSearchParams(fields).toString();
const RETRY_GAP = 30_000;                 // aynı siteye otomatik deneme aralığı (ağ hatalarında)

// Site içi yönlendirmeleri izler (Moodle girişten sonra ?testsession=… ara adımıyla yönlendirir).
async function follow(site, res, jar) {
  for (let hops = 0; res.location && hops < 8; hops++) {
    const u = new URL(res.location, SITES[site].base);
    if (u.origin !== SITES[site].base) break;
    res = await rawFetch(site, u.pathname + u.search, {}, jar);
  }
  return res;
}

const ubsCaptcha = $ => $('#pnlCaptcha').find('img,input').length > 0;

const moodleLogin = site => async (user, password, jar) => {
  const page = await rawFetch(site, '/login/index.php', {}, jar);
  const token = cheerio.load(page.text)('form#login input[name="logintoken"]').val();
  if (!token) throw new Error(`${SITES[site].name} giriş formu bulunamadı`);
  await follow(site, await rawFetch(site, '/login/index.php',
    { method: 'POST', headers: FORM, body: form({ anchor: '', logintoken: token, username: user, password }) }, jar), jar);
};

// site -> (kullanıcı adı, şifre, geçici çerez kutusu) => giriş isteklerini yapar
const ADAPTERS = {
  webmail: async (user, password, jar) => {
    const page = await rawFetch('webmail', '/roundcube/?_task=login', {}, jar);
    const token = cheerio.load(page.text)('input[name="_token"]').val();
    if (!token) throw new Error('Webmail giriş formu bulunamadı');
    await follow('webmail', await rawFetch('webmail', '/roundcube/?_task=login', { method: 'POST', headers: FORM,
      body: form({ _token: token, _task: 'login', _action: 'login', _timezone: 'Europe/Istanbul', _url: '', _user: user, _pass: password }) }, jar), jar);
  },
  uzakydb: moodleLogin('uzakydb'),
  uzak: moodleLogin('uzak'),
  // UBS (ASP.NET): giriş sayfasının durum alanları (__VIEWSTATE vb.) + kullanıcı adı/şifre ile form gönderilir.
  // Doğrulama kodu paneli (pnlCaptcha) normalde boştur; doluysa kod çözülmez, pencereyle girişe dönülür.
  ubs: async (email, password, jar) => {
    const $ = cheerio.load((await rawFetch('ubs', '/login.aspx', {}, jar)).text);
    if (!$('input[name="txtPassword"]').length) throw new Error('UBS giriş formu bulunamadı');
    if (ubsCaptcha($)) throw Object.assign(new Error('UBS doğrulama kodu istiyor'), { captcha: true });
    const fields = {};
    $('form input[type=hidden][name]').each((_, el) => { fields[el.attribs.name] = el.attribs.value ?? ''; });
    const end = await follow('ubs', await rawFetch('ubs', '/login.aspx', { method: 'POST', headers: FORM,
      body: form({ ...fields, txtLogin: email, txtPassword: password, btnLogin: 'Giriş' }) }, jar), jar);
    const $end = cheerio.load(end.text || '');
    if ($end('input[name="txtPassword"]').length && ubsCaptcha($end)) throw Object.assign(new Error('UBS doğrulama kodu istiyor'), { captcha: true });
  },
  // Piazza: önce CSRF anahtarı alınır, sonra giriş formu (piazza.com/class) gönderilir. Sayfada CAPTCHA yok.
  piazza: async (email, password, jar) => {
    const csrf = ((await rawFetch('piazza', '/main/csrf_token', {}, jar)).text.match(/CSRF_TOKEN\s*=\s*"([^"]+)"/) || [])[1];
    if (!csrf) throw new Error('Piazza giriş anahtarı alınamadı');
    await follow('piazza', await rawFetch('piazza', '/class', { method: 'POST', headers: FORM,
      body: form({ from: '/signup', email, password, remember: 'on', csrf_token: csrf }) }, jar), jar);
  },
};

const blocked = new Set();                // şifresi reddedilen siteler
const lastTry = new Map();                // site -> son otomatik deneme zamanı
const pending = new Map();                // site -> devam eden giriş

export const supports = site => !!ADAPTERS[site];

// Sonuç: { ok: true } | { ok: false, rejected: true } (şifre kabul edilmedi) | { ok: false, error, captcha? }
export function loginSite(site, creds) {
  if (!pending.has(site)) {
    pending.set(site, (async () => {
      const user = SITES[site].user === 'local' ? creds.email.split('@')[0] : creds.email;
      const password = credentials.passwordFor(creds, site);
      const jar = newJar();
      try {
        await ADAPTERS[site](user, password, jar);
        if (!(await isAlive(site, jar))) { blocked.add(site); return { ok: false, rejected: true }; }
        commitJar(site, jar);
        blocked.delete(site);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message, ...(e.captcha ? { captcha: true } : {}) };
      }
    })().finally(() => pending.delete(site)));
  }
  return pending.get(site);
}

// Giriş ekranından: doğrudan girilebilen tüm sitelere paralel giriş. Bilgiler en az bir sitede
// kabul edildiyse (ya da hiçbir yerde açıkça reddedilmediyse) kaydedilir.
export async function loginAll(creds, remember) {
  blocked.clear();
  const sites = Object.keys(ADAPTERS);
  const results = Object.fromEntries(await Promise.all(sites.map(async s => [s, await loginSite(s, creds)])));
  const accepted = sites.some(s => results[s].ok);
  const allRejected = sites.every(s => results[s].rejected);
  if (accepted || !allRejected) await credentials.save(creds, remember);
  return { saved: accepted || !allRejected, results };
}

// Oturum düştüğünde (getPage ya da canlı tutma) kayıtlı bilgiyle sessiz yeniden giriş.
export async function relogin(site) {
  const creds = credentials.get();
  if (!creds || !ADAPTERS[site] || blocked.has(site)) return false;
  if (!pending.has(site) && Date.now() - (lastTry.get(site) ?? 0) < RETRY_GAP) return false;
  lastTry.set(site, Date.now());
  return (await loginSite(site, creds)).ok;
}
setRelogin(relogin);

export const status = () => ({ direct: Object.keys(ADAPTERS), blocked: [...blocked] });
