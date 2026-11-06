// server/vault.mjs'in Android karşılığı: şifreleme Kotlin tarafında, anahtar Android Keystore ile korunur (Vault.kt).
const N = () => globalThis.Native;
export function readSync(file) {
  try { const t = N().sealRead(String(file)); return t == null ? null : JSON.parse(t); } catch { return null; }
}
export const read = async file => readSync(file);
export const writeSync = (file, obj) => N().sealWrite(String(file), JSON.stringify(obj));
export const write = async (file, obj) => writeSync(file, obj);
