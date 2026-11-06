// Çekirdekte adı geçen ama Android'de işi olmayan ya da küçük karşılığı olan Node modülleri.
import { Buffer } from 'buffer';
import { inflateSync } from 'fflate';

export const fileURLToPath = u => String(u).replace(/^file:\/\//, '');          // node:url
export const execFile = () => { throw new Error('Android\'de kullanılamaz'); };  // node:child_process
export const inflateRawSync = data => Buffer.from(inflateSync(new Uint8Array(data)));   // node:zlib
export default { inflateRawSync, fileURLToPath, execFile };
