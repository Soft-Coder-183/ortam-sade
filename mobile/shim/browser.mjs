// server/browser.mjs'in Android karşılığı: görünür giriş penceresi uygulama içi WebView'dir (LoginActivity).
// Doğrulama sorusu çıkarsa kullanıcı yanıtlar; atlatılmaz, çözülmez. Arka plan kontrolünde pencere açılmaz.
const N = () => globalThis.Native;

export const CHANNEL = '';
// WebView'deki oturum çerezleri (önceki bir pencereyle giriş) kullanılabiliyorsa alınır; geçerliliğini session.mjs dener.
export async function seedCookies(s) {
  const list = JSON.parse(N().webCookies(s.base));
  return list.length ? list : null;
}
export async function visibleLogin(s, fill = null) {
  if (globalThis.__ARKA_PLAN) throw new Error('Arka planda giriş penceresi açılmaz');
  const r = await globalThis.__call(id => N().openLogin(id, JSON.stringify({ url: s.base + s.home, base: s.base, name: s.name,
    passwordField: s.passwordField, userField: s.userField ?? null, submit: s.submit ?? null, captchaField: s.captchaField ?? null, fill })));
  return { cookies: r.cookies, typed: r.typed ?? null };
}
// Sayfa uygulama içi pencerede açılır, kullanıcı "Kapat"a basana kadar kalır (masaüstündeki openPage'in karşılığı).
export async function openPage(s, url, { fill = null, cookies = [] } = {}) {
  if (globalThis.__ARKA_PLAN) throw new Error('Arka planda pencere açılmaz');
  const r = await globalThis.__call(id => N().openLogin(id, JSON.stringify({ url, base: s.base, name: s.name, stay: true, cookies,
    passwordField: s.passwordField, userField: s.userField ?? null, submit: s.submit ?? null, captchaField: s.captchaField ?? null, fill })));
  return r.cookies?.length ? r.cookies : null;
}
export const clearCookies = async host => N().clearWebCookies(host);
