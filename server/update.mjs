// Güncelleme: GitHub'daki son sürümü denetler, yeni sürüm varsa arayüz kullanıcıya sorar. Görünmez güncelleme yoktur:
// indirme ve kurulum yalnızca kullanıcı "Güncelle" dediğinde (POST /api/update/apply) yapılır.
// Kurulum: sürüm dosyası (zip) indirilir, GitHub'ın verdiği SHA-256 özetiyle doğrulanır, .cache/update altına açılır,
// içindeki sürüm numarası denetlenir; sonra uygulama klasörleri yeniden adlandırılarak değiştirilir (eskiler yedekte kalır)
// ve sunucu 75 koduyla çıkar — başlatıcı (server/start.mjs) yeni sürümü açar. Kişisel veriler (.cache, .profile) dokunulmaz.
// Git ile indirilmiş klasörde aynı düğme sürüm etiketini çekip bağımlılıkları günceller: kullanıcı komut çalıştırmaz.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'Soft-Coder-183/ortam-sade';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, '.cache', 'update');
// Yalnızca yerel deneme için: ORTAM_UPDATE_FEED=http://127.0.0.1:<port>/… sahte bir sürüm beslemesi verir (indirme de oradan).
const FEED = /^http:\/\/127\.0\.0\.1:\d+\//.test(process.env.ORTAM_UPDATE_FEED || '') ? process.env.ORTAM_UPDATE_FEED : null;
const CHECK_EVERY = 6 * 3600_000;                // 6 saatte bir (GitHub'a tek istek)
export const RESTART_CODE = 75;

export const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
// Paketli sürüm mü (runtime\node.exe ile çalışıyor)? Git klasöründe güncelleme git ile, diğer her durumda paketle yapılır.
const packaged = fs.existsSync(path.join(ROOT, 'runtime', 'node.exe')) && fs.existsSync(path.join(ROOT, 'server', 'start.mjs'));
const isGit = fs.existsSync(path.join(ROOT, '.git'));

const newer = (a, b) => {                        // a > b ? (1.10.0 > 1.9.3)
  const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// Önceki güncellemeden kalan yedek ve geçici dosyalar: yeni sürüm açıldığına göre artık gerekmez (açılıştan 30 sn sonra silinir).
setTimeout(() => {
  if (applying) return;
  fs.rmSync(WORK, { recursive: true, force: true });
  try { fs.rmSync(path.join(ROOT, 'runtime', 'node.old.exe'), { force: true }); } catch {}   // başlatıcı hâlâ kullanıyorsa sonraki açılışta
}, 30_000).unref();

let info = null, checkedAt = 0, pending = null;
export function check(force = false) {
  if (!force && info && Date.now() - checkedAt < CHECK_EVERY) return Promise.resolve(status());
  pending ??= (async () => {
    const r = await fetch(FEED || `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { 'User-Agent': 'ortam-sade-updater', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`GitHub yanıtı: ${r.status}`);
    const j = await r.json();
    const asset = (j.assets ?? []).find(a => /-win-x64\.zip$/i.test(a.name));
    info = { latest: String(j.tag_name || '').replace(/^v/, ''), notes: String(j.body || '').slice(0, 4000), url: j.html_url,
      published: Date.parse(j.published_at) || null,
      asset: asset ? { name: asset.name, size: asset.size, digest: asset.digest || null, download: asset.browser_download_url } : null };
    checkedAt = Date.now();
    return status();
  })().finally(() => { pending = null; });
  return pending;
}

let applying = null;
export function status() {
  return { current, packaged, latest: info?.latest ?? null, newer: !!info && newer(info.latest, current), notes: info?.notes ?? '',
    url: info?.url ?? `https://github.com/${REPO}/releases`, published: info?.published ?? null, size: info?.asset?.size ?? null,
    checkedAt: checkedAt || null, applying: !!applying };
}

// Kullanıcının onayıyla: indir, doğrula, aç, değiştir. Başarılıysa { ok, version } döner; çağıran sunucuyu yeniden başlatır.
export function apply() {
  applying ??= doApply().finally(() => { applying = null; });
  return applying;
}

async function doApply() {
  const s = await check(true);
  if (!s.newer) throw new Error('Zaten en güncel sürüm kullanılıyor.');
  if (!packaged && isGit && gitAvailable()) return gitUpdate(info.latest);
  const a = info.asset;
  const ok = u => { try { const h = new URL(u); if (FEED) return h.origin === new URL(FEED).origin; return h.protocol === 'https:' && h.hostname === 'github.com' && h.pathname.startsWith(`/${REPO}/releases/download/`); } catch { return false; } };
  if (!a || !ok(a.download)) throw new Error('Sürümde Windows paketi bulunamadı.');
  if (!/^sha256:[0-9a-f]{64}$/.test(a.digest || '')) throw new Error('Sürüm dosyasının doğrulama özeti yok; güncelleme yapılmadı.');

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const res = await fetch(a.download, { headers: { 'User-Agent': 'ortam-sade-updater' }, redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if ('sha256:' + sha !== a.digest) throw new Error('İndirilen dosya doğrulanamadı (SHA-256 uyuşmuyor); güncelleme yapılmadı.');
  const zip = path.join(WORK, a.name);
  fs.writeFileSync(zip, buf);
  const x = path.join(WORK, 'x');
  fs.mkdirSync(x);
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', x], { windowsHide: true });
  const src = path.join(x, 'OrtamSade');
  const ver = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
  if (ver !== info.latest) throw new Error(`Paketteki sürüm (${ver}) beklenenle (${info.latest}) uyuşmuyor.`);
  for (const need of ['server/server.mjs', 'server/start.mjs', 'public/app.js', 'data/ders-programi.json', 'node_modules', 'runtime/node.exe'])
    if (!fs.existsSync(path.join(src, need))) throw new Error(`Paket eksik: ${need}`);

  // Değiştirme: eski klasör/dosya yedeğe taşınır, yenisi yerine taşınır (aynı disk: yalnızca yeniden adlandırma).
  const old = path.join(WORK, `eski-${current}`);
  fs.mkdirSync(old);
  const moved = [];
  try {
    for (const name of fs.readdirSync(src)) {
      if (name === 'runtime') continue;
      const from = path.join(src, name), to = path.join(ROOT, name);
      if (fs.existsSync(to)) { fs.renameSync(to, path.join(old, name)); moved.push(name); }
      fs.renameSync(from, to);
    }
    // Node.js çalışırken dosyası değiştirilemez ama yeniden adlandırılabilir; yalnızca farklıysa değiştirilir.
    const newNode = path.join(src, 'runtime', 'node.exe'), curNode = path.join(ROOT, 'runtime', 'node.exe');
    const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    if (!fs.existsSync(curNode)) {                  // pakette olmayan kurulum (kaynak dosyalar): Node.js de pakettekiyle gelir
      fs.mkdirSync(path.dirname(curNode), { recursive: true });
      fs.renameSync(newNode, curNode);
    } else if (hash(newNode) !== hash(curNode)) {
      fs.rmSync(path.join(ROOT, 'runtime', 'node.old.exe'), { force: true });
      fs.renameSync(curNode, path.join(ROOT, 'runtime', 'node.old.exe'));
      fs.renameSync(newNode, curNode);
    }
  } catch (e) {
    // Yarıda kalırsa eski dosyalar geri konur
    for (const name of moved) {
      try { fs.rmSync(path.join(ROOT, name), { recursive: true, force: true }); fs.renameSync(path.join(old, name), path.join(ROOT, name)); } catch {}
    }
    throw new Error('Dosyalar değiştirilemedi, eski sürüm korundu: ' + e.message);
  }
  fs.rmSync(zip, { force: true });
  return { ok: true, version: ver };
}

// Git klasörü: yayımlanan sürümün etiketine ileri sarılır; kullanıcının değiştirdiği dosyalara dokunulmaz.
const git = (...a) => execFileSync('git', a, { cwd: ROOT, windowsHide: true, stdio: 'pipe', timeout: 180_000 }).toString().trim();
function gitAvailable() { try { git('--version'); return true; } catch { return false; } }
function gitUpdate(ver) {
  const before = git('rev-parse', 'HEAD');
  try {
    git('fetch', '--tags', '--force', 'origin');
    git('merge', '--ff-only', `v${ver}`);
  } catch {
    throw new Error('Güncelleme kurulamadı: bu klasörde değiştirilmiş dosyalar var. Eski sürüm çalışmaya devam ediyor.');
  }
  if (git('diff', '--name-only', before, 'HEAD').split('\n').includes('package-lock.json'))
    execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: ROOT, windowsHide: true, stdio: 'pipe', timeout: 300_000 });
  return { ok: true, version: ver };
}

// Kurulumdan sonra yeniden başlatma. Başlatıcıyla (Ortam Sade.cmd) açıldıysa 75 koduyla çıkmak yeter; değilse (npm start)
// eski süreç kapanınca siyah pencere yeniden açılır, böylece uygulama görünmez çalışmaz.
export function restart() {
  if (packaged || process.env.ORTAM_GOZETIM || process.platform !== 'win32') process.exit(RESTART_CODE);
  spawn('cmd.exe', ['/c', 'ping -n 3 127.0.0.1 >nul & set ORTAM_YENIDEN=1& start "Ortam Sade" "Ortam Sade.cmd"'],
    { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  process.exit(0);
}
