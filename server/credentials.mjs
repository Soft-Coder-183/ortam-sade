// Tek giriş bilgileri (e-posta, şifre, isteğe bağlı farklı Piazza şifresi).
// "Beni hatırla" seçiliyse Windows DPAPI ile şifrelenip diske yazılır: yalnızca bu Windows kullanıcısı bu bilgisayarda
// çözebilir. Düz metin hiçbir yere yazılmaz; PowerShell'e de komut satırından değil standart girdiden verilir.
// (APK'da bunun yerini Android Keystore alacak.)
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';

const FILE = '.cache/credentials.dpapi';
const ENTROPY = "[Text.Encoding]::UTF8.GetBytes('okul-ortam-v1')";

let creds = null;                         // { email, password, sites: { site: şifre } } — yalnızca bellekte

// Siteye özel şifre yoksa ana şifre kullanılır (herkesin bütün sitelerde şifresi aynı olmayabilir).
export const passwordFor = (c, site) => c?.sites?.[site] || c?.password;

function powershell(script, input) {
  return new Promise((resolve, reject) => {
    const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -AssemblyName System.Security; $in = [Console]::In.ReadToEnd().Trim(); ${script}`],
      { windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout) => (err ? reject(new Error('DPAPI işlemi başarısız')) : resolve(stdout.trim())));
    child.stdin.end(input);
  });
}

// Girdi ve çıktı base64 taşınır (Türkçe karakterli şifrelerde kodlama sorunu olmasın).
const protect = b64 => powershell(`[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Convert]::FromBase64String($in), ${ENTROPY}, 'CurrentUser'))`, b64);
const unprotect = b64 => powershell(`[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($in), ${ENTROPY}, 'CurrentUser'))`, b64);

export async function load() {
  try {
    const plain = await unprotect((await fs.readFile(FILE, 'utf8')).trim());
    creds = JSON.parse(Buffer.from(plain, 'base64').toString('utf8'));
    if (creds.piazzaPassword) { creds.sites = { ...creds.sites, piazza: creds.piazzaPassword }; delete creds.piazzaPassword; }   // eski biçim
  } catch { creds = null; }
  return !!creds;
}

export async function save(c, remember) {
  const sites = Object.fromEntries(Object.entries(c.sites ?? {}).filter(([, v]) => typeof v === 'string' && v));
  creds = { email: c.email, password: c.password, ...(Object.keys(sites).length ? { sites } : {}) };
  if (remember) await fs.writeFile(FILE, await protect(Buffer.from(JSON.stringify(creds), 'utf8').toString('base64')));
  else await fs.rm(FILE, { force: true });
}

export async function forget() {
  creds = null;
  await fs.rm(FILE, { force: true });
}

export const get = () => creds;
export const remembered = () => fs.access(FILE).then(() => true, () => false);
