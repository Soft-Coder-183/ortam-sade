// node:fs ve node:fs/promises: dosyalar uygulamanın özel klasöründe (Native.fs*). "/app/…" yolları APK'nın içinden okunur.
import { Buffer } from 'buffer';
const N = () => globalThis.Native;
const missing = f => Object.assign(new Error(`ENOENT: ${f}`), { code: 'ENOENT' });
const b64 = data => (typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)).toString('base64');

export function readFileSync(f, opt) {
  const raw = N().fsRead(String(f));
  if (raw == null) throw missing(f);
  const buf = Buffer.from(raw, 'base64'), enc = typeof opt === 'string' ? opt : opt?.encoding;
  return enc ? buf.toString(enc) : buf;
}
export const writeFileSync = (f, data) => N().fsWrite(String(f), b64(data));
export const appendFileSync = (f, data) => N().fsAppend(String(f), b64(data));
export const existsSync = f => N().fsExists(String(f));
export const mkdirSync = () => {};                        // üst klasörler yazarken açılır
export const rmSync = f => N().fsRemove(String(f));

export const readFile = async (f, opt) => readFileSync(f, opt);
export const writeFile = async (f, data) => writeFileSync(f, data);
export const rm = async f => rmSync(f);
export const mkdir = async () => {};
export const readdir = async d => JSON.parse(N().fsList(String(d)));
export const access = async f => { if (!existsSync(f)) throw missing(f); };

export const promises = { readFile, writeFile, rm, mkdir, readdir, access };
export default { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync, promises, readFile, writeFile, rm, mkdir, readdir, access };
