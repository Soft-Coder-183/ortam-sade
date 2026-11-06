// node:crypto'nun çekirdekte kullanılan parçası (PIN özeti ve rastgele belirteç). Şifreleme Android Keystore tarafında (vault.mjs).
import { Buffer } from 'buffer';
import { syncScrypt } from 'scrypt-js';

const randomBytes = n => Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(n)));
const scryptSync = (password, salt, len) => Buffer.from(syncScrypt(Buffer.from(password, 'utf8'), Buffer.from(salt), 16384, 8, 1, len));
const timingSafeEqual = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
export { randomBytes, scryptSync, timingSafeEqual };
export default { randomBytes, scryptSync, timingSafeEqual };
