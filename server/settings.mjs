// Güvenlik ve oturum ayarları (.cache/settings.json). Kullanıcı Hesap > Güvenlik ve Oturumlar'dan değiştirir.
//  keepAlive:   oturumlar arka planda düzenli kontrolle açık tutulsun mu
//  autoRelogin: oturum kapanınca kayıtlı bilgilerle (ya da kayıtlı tarayıcı profilinden) kendiliğinden yeniden girilsin mi
//  loggedOut:   kullanıcının "Oturumu kapat" dediği siteler: kullanıcı yeniden giriş yapana kadar uygulama bu sitelere girmez
//  lock:        isteğe bağlı giriş PIN'i (yalnızca tuzlu scrypt özeti saklanır); lockIdle: hareketsizlikte kilitlenme (dakika, 0 = kapalı)
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE = '.cache/settings.json';
const DEFAULTS = { keepAlive: true, autoRelogin: true, loggedOut: [], lock: null, lockIdle: 15 };
let s = { ...DEFAULTS };
try { s = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}

export const get = () => s;
export function set(patch) {
  s = { ...s, ...patch };
  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
  return s;
}
export const setLoggedOut = (site, on) => set({ loggedOut: on ? [...new Set([...s.loggedOut, site])] : s.loggedOut.filter(x => x !== site) });
export const isLoggedOut = site => s.loggedOut.includes(site);

// ---------- PIN ----------
const hash = (pin, salt) => crypto.scryptSync(String(pin), Buffer.from(salt, 'hex'), 32).toString('hex');
export const pinValid = pin => /^\d{4,8}$/.test(String(pin ?? ''));
export function setPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return set({ lock: { salt, hash: hash(pin, salt) } });
}
export const clearPin = () => set({ lock: null });
export function checkPin(pin) {
  if (!s.lock) return true;
  const a = Buffer.from(hash(pin, s.lock.salt), 'hex'), b = Buffer.from(s.lock.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
