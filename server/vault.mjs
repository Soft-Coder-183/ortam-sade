// Yerel şifreleme. Uygulama ilk açılışta rastgele bir AES-256 anahtarı üretir; anahtar Windows DPAPI ile korunarak
// .cache/key.dpapi dosyasında durur, yani yalnızca bu bilgisayardaki bu Windows hesabı çözebilir. Okul sitelerinin
// oturum çerezleri, okuldan alınan kişisel veriler (önbellek) ve bildirimler bu anahtarla AES-256-GCM ile şifrelenip yazılır.
// Not: Aynı Windows hesabında çalışan başka bir program da DPAPI'yi çözebilir; şifreleme dosyaların kopyalanmasına,
// başka bir hesaba ya da bilgisayara taşınmasına karşı korur.
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const KEY_FILE = '.cache/key.dpapi';
const MAGIC = Buffer.from('OSV1');
const ENTROPY = "[Text.Encoding]::UTF8.GetBytes('ortam-sade-anahtar-v1')";

function dpapi(op, b64) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Add-Type -AssemblyName System.Security; $in = [Console]::In.ReadToEnd().Trim(); ` +
    `[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${op}([Convert]::FromBase64String($in), ${ENTROPY}, 'CurrentUser'))`],
  { input: b64, windowsHide: true, maxBuffer: 1 << 20 }).toString().trim();
}

let key = null;
function getKey() {
  if (key) return key;
  fs.mkdirSync('.cache', { recursive: true });
  if (process.platform !== 'win32') {                 // geliştirme (Windows dışı): anahtar yalnızca kullanıcının okuyabildiği dosyada
    const f = '.cache/key.bin';
    try { key = fs.readFileSync(f); if (key.length === 32) return key; } catch {}
    key = crypto.randomBytes(32);
    fs.writeFileSync(f, key, { mode: 0o600 });
    return key;
  }
  try {
    const k = Buffer.from(dpapi('Unprotect', fs.readFileSync(KEY_FILE, 'utf8').trim()), 'base64');
    if (k.length === 32) return (key = k);
  } catch {}
  // Anahtar yok ya da çözülemiyor (ör. başka bir hesaptan kopyalanmış klasör): yenisi üretilir, eski şifreli dosyalar okunamaz sayılır
  key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, dpapi('Protect', key.toString('base64')));
  return key;
}

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}
export const isSealed = buf => buf.length > 32 && buf.subarray(0, 4).equals(MAGIC);
export function unseal(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', getKey(), buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(32)), d.final()]).toString('utf8'));
}
// Okuma: şifreli ise çözülür; eski düz JSON dosyalar da okunur (bir sonraki yazışta şifrelenir). Okunamazsa null.
export function readSync(file) {
  try { const b = fs.readFileSync(file); return isSealed(b) ? unseal(b) : JSON.parse(b.toString('utf8')); } catch { return null; }
}
export async function read(file) {
  try { const b = await fsp.readFile(file); return isSealed(b) ? unseal(b) : JSON.parse(b.toString('utf8')); } catch { return null; }
}
export const writeSync = (file, obj) => fs.writeFileSync(file, seal(obj));
export const write = (file, obj) => fsp.writeFile(file, seal(obj));
