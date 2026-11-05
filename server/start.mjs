// Başlatıcı: sunucuyu çalıştırır; sunucu güncelleme sonrası 75 koduyla çıkarsa yeni sürümü yeniden başlatır.
// "Ortam Sade.cmd" bunu çağırır. Tarayıcı yalnızca ilk açılışta açılır (yeniden başlatmada açık sayfa kendini yeniler).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE = path.join(ROOT, 'runtime', 'node.exe');
const RESTART_CODE = 75;

function run(first) {
  const env = { ...process.env, ORTAM_GOZETIM: '1' };   // sunucu güncellemeden sonra 75 koduyla çıkıp yeniden açılabileceğini bilir
  if (!first) delete env.ORTAM_AC;
  const child = spawn(fs.existsSync(NODE) ? NODE : process.execPath, ['server/server.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
  child.on('exit', code => {
    if (code === RESTART_CODE) { console.log('\nGüncelleme kuruldu, Ortam Sade yeniden başlatılıyor…\n'); return run(false); }
    process.exit(code ?? 0);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => child.kill());
}
run(true);
