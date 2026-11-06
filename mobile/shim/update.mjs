// server/update.mjs'in Android karşılığı. Görünmez güncelleme yoktur: "Güncelle"ye basılınca APK yalnızca bu deponun GitHub
// Releases sayfasından indirilir, GitHub'ın SHA-256 özetiyle doğrulanır ve Android'in kurulum ekranı açılır.
const REPO = 'Soft-Coder-183/ortam-sade';
const CHECK_EVERY = 6 * 3600_000;
export const RESTART_CODE = 75;
export const current = globalThis.Native.appVersion();

const newer = (a, b) => {
  const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

let info = null, checkedAt = 0, pending = null, applying = null;
export function check(force = false) {
  if (!force && info && Date.now() - checkedAt < CHECK_EVERY) return Promise.resolve(status());
  pending ??= (async () => {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'etu-cep-updater', Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub yanıtı: ${r.status}`);
    const j = await r.json();
    const asset = (j.assets ?? []).find(a => /\.apk$/i.test(a.name));
    info = { latest: String(j.tag_name || '').replace(/^v/, ''), notes: String(j.body || '').slice(0, 4000), url: j.html_url,
      published: Date.parse(j.published_at) || null,
      asset: asset ? { name: asset.name, size: asset.size, digest: asset.digest || null, download: asset.browser_download_url } : null };
    checkedAt = Date.now();
    return status();
  })().finally(() => { pending = null; });
  return pending;
}
export function status() {
  return { current, packaged: true, latest: info?.latest ?? null, newer: !!info?.asset && newer(info.latest, current), notes: info?.notes ?? '',
    url: info?.url ?? `https://github.com/${REPO}/releases`, published: info?.published ?? null, size: info?.asset?.size ?? null,
    checkedAt: checkedAt || null, applying: !!applying };
}
async function doApply() {
  const s = await check(true);
  if (!s.newer) throw new Error('Zaten en güncel sürüm kullanılıyor.');
  const a = info.asset, m = /^sha256:([0-9a-f]{64})$/i.exec(a.digest || '');
  if (!m) throw new Error('Sürüm dosyasının özeti GitHub\'da yok, güvenle kurulamıyor.');
  if (!/^https:\/\/github\.com\/Soft-Coder-183\/ortam-sade\/releases\/download\//.test(a.download)) throw new Error('Beklenmeyen indirme adresi.');
  await globalThis.__call(id => globalThis.Native.installApk(id, a.download, m[1].toLowerCase()));
  return { ok: true, version: info.latest, installer: true };
}
export function apply() {
  applying ??= doApply().finally(() => { applying = null; });
  return applying;
}
export const restart = () => {};                     // yeniden açmayı Android'in kurulum ekranı yapar
