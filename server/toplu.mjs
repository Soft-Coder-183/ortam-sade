// Piazza kaynaklarını bölüm bölüm toplu indirme (Kaynaklar > bölüm başlığındaki düğmeler).
//  - zip:    bölümün bütün dosyaları tek zip'te ("BİL 214 - Lecture Notes.zip")
//  - ayıkla: aynı, ama bölümdeki zip dosyaları açılmış hâlde (her zip kendi adında bir klasöre, içindeki klasörlerle)
//  - klasör: (yalnızca Windows) dosyalar İndirilenler'de "BİL 214 - Lecture Notes" klasörüne yazılır ve klasör açılır;
//            ayıkla seçilirse zipler orada açılır.
// Dosyalar sırayla, tek tek indirilir (Piazza'yı yormamak için); hata freni sınırına takılırsa beklenip yeniden denenir.
// Bağlantı türündeki kaynaklar dosya değildir: adresleri "Bağlantılar.txt"ye yazılır.
import fs from 'node:fs';
import path from 'node:path';
import * as cp from 'node:child_process';        // Android karşılığında yalnızca execFile var (orada klasöre indirme yok)
import { zipSync, unzipSync } from 'fflate';
import * as piazza from './piazza.mjs';

const MAX_TOTAL = 1024 ** 3;                       // 1 GB: daha büyüğü belleğe sığmayabilir
const bekle = ms => new Promise(r => setTimeout(r, ms));

// Dosya/klasör adında Windows'un kabul etmediği karakterler ve sondaki nokta/boşluk temizlenir.
const safe = s => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 150) || 'dosya';
// Zip içindeki yol: "../", mutlak yol ve sürücü harfi atılır (zip-slip), her parça temizlenir.
const safePath = p => String(p).split(/[\\/]+/).filter(x => x && x !== '.' && x !== '..').map(safe).join('/');
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i;

// Aynı adlı ikinci dosya "ad (2).uzantı" olur.
function unique(name, used) {
  if (!used.has(name.toLowerCase())) { used.add(name.toLowerCase()); return name; }
  const m = name.match(/^(.*?)(\.[^.\/]{1,8})?$/);
  for (let i = 2; ; i++) {
    const n = `${m[1]} (${i})${m[2] || ''}`;
    if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
  }
}

async function section(nid, s) {
  const r = await piazza.resources(nid);
  const sec = r.sections[Number(s)];
  if (!sec) throw new Error('Kaynak bölümü bulunamadı');
  return { sec, base: safe(`${await piazza.codeOf(nid)} - ${sec.title}`) };
}

async function fetchOne(nid, id) {
  for (let tries = 0; ; tries++) {
    try { return await piazza.file({ nid, rid: id }); }
    catch (e) { if (!e.braked || tries >= 3) throw e; await bekle(15_000); }
  }
}

// Bölümün dosyaları: [{ path, data: Uint8Array }]. ayikla: .zip dosyaları açılıp içerikleri "<zip adı>/..." altına konur.
async function collect(nid, s, ayikla) {
  const { sec, base } = await section(nid, s);
  const out = [], used = new Set(), links = [], failed = [];
  let total = 0;
  for (const it of sec.items) {
    if (it.type === 'link') { if (it.url) links.push(`${it.name}\r\n${it.url}\r\n`); continue; }
    let f;
    try { f = await fetchOne(nid, it.id); }
    catch (e) { failed.push(`${it.name}: ${e.message}`); continue; }
    total += f.body.length;
    if (total > MAX_TOTAL) throw new Error('Bölüm 1 GB\'tan büyük; dosyaları tek tek indir.');
    const name = safe(f.name);
    if (ayikla && /\.zip$/i.test(name)) {
      try {
        const dir = unique(name.replace(/\.zip$/i, ''), used);
        const inner = unzipSync(new Uint8Array(f.body));
        for (const [p, data] of Object.entries(inner)) {
          if (p.endsWith('/') || JUNK.test(p)) continue;
          const sp = safePath(p);
          if (sp) out.push({ path: `${dir}/${sp}`, data });
        }
        continue;
      } catch { /* açılamayan zip olduğu gibi konur */ }
    }
    out.push({ path: unique(name, used), data: new Uint8Array(f.body) });
  }
  if (links.length) out.push({ path: unique('Bağlantılar.txt', used), data: new TextEncoder().encode(links.join('\r\n')) });
  if (failed.length) out.push({ path: unique('İndirilemeyenler.txt', used), data: new TextEncoder().encode(failed.join('\r\n')) });
  if (!out.length) throw new Error('Bu bölümde indirilecek dosya yok.');
  return { base, files: out, failed: failed.length };
}

// /api/file/piazza-zip?nid=&s=&ayikla=1 → tek zip (sıkıştırmasız: PDF ve zip zaten sıkıştırılmış).
export async function zip({ nid, s, ayikla }) {
  const { base, files } = await collect(nid, s, ayikla);
  const tree = Object.fromEntries(files.map(f => [f.path, [f.data, { level: 0 }]]));
  return { body: Buffer.from(zipSync(tree)), name: `${base}${ayikla ? ' (açılmış)' : ''}.zip`, type: 'application/zip' };
}

// Windows'ta İndirilenler klasörü (kullanıcı taşımış olabilir: kayıt defterindeki yer, yoksa %USERPROFILE%\Downloads).
function downloadsDir() {
  try {
    const out = cp.execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
      '/v', '{374DE290-123F-4565-9164-39C4925E467B}'], { encoding: 'utf8', windowsHide: true });
    const v = (/REG_(?:EXPAND_)?SZ\s+(.+)/.exec(out) || [])[1]?.trim();
    if (v) { const p = v.replace(/%([^%]+)%/g, (_, k) => process.env[k] ?? ''); if (fs.existsSync(p)) return p; }
  } catch {}
  return path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
}

export const canSaveFolder = () => process.platform === 'win32' && !globalThis.Native;

// POST /api/piazza-klasor { nid, s, ayikla } → dosyalar İndirilenler'de yeni klasöre yazılır, klasör Gezgin'de açılır.
export async function folder({ nid, s, ayikla }) {
  if (!canSaveFolder()) throw new Error('Klasöre indirme yalnızca Windows\'ta var; zip olarak indir.');
  const { base, files, failed } = await collect(nid, s, ayikla);
  const root = downloadsDir();
  let dir = path.join(root, base);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(root, `${base} (${i})`);
  for (const f of files) {
    const to = path.join(dir, ...f.path.split('/'));
    if (!to.startsWith(dir + path.sep)) continue;              // safePath'ten sonra olmamalı; yine de klasör dışına yazılmaz
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, f.data);
  }
  cp.execFile('explorer.exe', [dir], { windowsHide: false }, () => {});
  return { ok: true, dir, count: files.length, failed };
}
