// server/credentials.mjs'in Android karşılığı: "Beni hatırla" seçiliyse bilgiler Keystore korumalı dosyada durur.
import * as vault from './vault.mjs';
import fs from './fs.mjs';

const FILE = '.cache/credentials.enc';
let creds = null;

export const passwordFor = (c, site) => c?.sites?.[site] || c?.password;
export async function load() { creds = await vault.read(FILE); return !!creds; }
export async function save(c, remember) {
  const sites = Object.fromEntries(Object.entries(c.sites ?? {}).filter(([, v]) => typeof v === 'string' && v));
  creds = { email: c.email, password: c.password, ...(Object.keys(sites).length ? { sites } : {}) };
  if (remember) await vault.write(FILE, creds); else await fs.rm(FILE);
}
export async function forget() { creds = null; await fs.rm(FILE); }
export const get = () => creds;
export const remembered = () => fs.access(FILE).then(() => true, () => false);
