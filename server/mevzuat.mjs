// Mevzuat: okulun Mevzuat sayfasındaki kanun, yönetmelik ve yönergeler tek yerde, madde madde ve aranabilir.
// Belgeler dağınık: bir kısmı mevzuat.gov.tr'de (güncel, değişiklikler işlenmiş metin), bir kısmı okulun sitesinde PDF/Word.
// Her belge ilk açılışta kaynağından bir kez indirilir, düz metne ve maddelere ayrılır, .cache/mevzuat altında saklanır
// (haftada bir arka planda yenilenir). Giriş gerekmez; hepsi herkese açık sayfalar.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import * as cheerio from 'cheerio';
import { ANSWERS } from './mevzuat-yanitlar.mjs';

const ETU = 'https://www.etu.edu.tr';
const MG = 'https://www.mevzuat.gov.tr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const DIR = path.join('.cache', 'mevzuat');
const DOC_VER = 2;                         // ayrıştırıcı değişince artır: eski kayıtlar yeniden işlenir
const FRESH = 7 * 24 * 3600_000;           // belge metni haftada bir yenilenir
const txt = s => String(s ?? '').replace(/[\s ]+/g, ' ').trim();

// mevzuat.gov.tr zaman zaman çok geç yanıt veriyor: zaman aşımı ya da bağlantı hatasında bir kez daha denenir.
async function get(url, timeout = 30_000, retry = true) {
  let r;
  try {
    r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'tr' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    if (retry) return get(url, timeout * 1.5, false);
    throw e.name === 'TimeoutError' ? new Error('Kaynak site geç yanıt verdi, biraz sonra tekrar dene') : e;
  }
  if (!r.ok) throw new Error(`Kaynak yanıt vermedi (${r.status})`);
  return r;
}
// Eski Resmî Gazete sayfaları windows-1254 olabilir: karakter kümesi başlıktan ya da <meta>'dan okunur.
async function html(url) {
  const r = await get(url);
  const buf = Buffer.from(await r.arrayBuffer());
  let cs = (/charset=([\w-]+)/i.exec(r.headers.get('content-type') || '') || [])[1];
  cs ??= (/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4000).toString('latin1')) || [])[1];
  let s;
  try { s = new TextDecoder(cs || 'utf-8').decode(buf); } catch { s = buf.toString('utf8'); }
  return cheerio.load(s);
}

// ---------- Türkçe karşılaştırma ----------
// Aramada büyük/küçük harf ve şapka/nokta farkı yok sayılır: "yandal" = "Yan Dal", "cift anadal" = "Çift Anadal".
const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export const norm = s => String(s ?? '').normalize('NFC').toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => TR[c]).replace(/i̇/g, 'i')
  .replace(/[’'`´]/g, '').replace(/[^a-z0-9%,./()\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- Kaynak türleri ----------
// mevzuat.gov.tr bağlantıları birçok biçimde verilmiş (Metin.Aspx?MevzuatKod=8.5.15287, mevzuat?MevzuatNo=…, MevzuatMetin/1.5.2547.pdf);
// hepsi aynı belgeye (tür + numara) indirgenir ve değişiklikleri işlenmiş güncel metin (iframe sayfası) okunur.
function classify(href) {
  let u;
  try { u = new URL(href.replace(/&amp;/g, '&'), ETU); } catch { return null; }
  if (/(^|\.)mevzuat\.gov\.tr$/i.test(u.hostname)) {
    const q = k => [...u.searchParams].find(([n]) => n.toLowerCase() === k.toLowerCase())?.[1];
    let tur = q('MevzuatTur'), no = q('MevzuatNo'), tertip = q('MevzuatTertip');
    const kod = q('MevzuatKod') || (u.pathname.match(/MevzuatMetin\/(\d+\.\d+\.\d+)\.(?:pdf|doc)/i) || [])[1];
    if (kod) [tur, tertip, no] = kod.split('.');
    if (/^\d+$/.test(tur) && /^\d+$/.test(no)) {
      tertip = /^\d+$/.test(tertip) ? tertip : '5';
      return { kind: 'mg', id: `mg-${tur}-${no}`, url: `${MG}/mevzuat?MevzuatNo=${no}&MevzuatTur=${tur}&MevzuatTertip=${tertip}`,
        fetch: `${MG}/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=${tur}&MevzuatNo=${no}&MevzuatTertip=${tertip}` };
    }
  }
  if (/(^|\.)resmigazete\.gov\.tr$/i.test(u.hostname) && /\.html?$/i.test(u.pathname))
    return { kind: 'rg', id: 'rg-' + path.basename(u.pathname).replace(/\.\w+$/, ''), url: u.href, fetch: u.href };
  const f = u.hostname === 'www.etu.edu.tr' && u.pathname.match(/^\/files\/dosyalar\/(\d{4})\/(\d{2})\/(\d{2})\/(\w+)\.(pdf|docx|doc)$/i);
  if (f) return { kind: f[5].toLowerCase(), id: 'f-' + f[4].slice(0, 12), url: u.href, fetch: u.href, uploaded: `${f[1]}-${f[2]}-${f[3]}` };
  return { kind: 'link', id: null, url: u.href };
}

// Öğrenciyi doğrudan ilgilendirmeyenler (araştırma merkezleri, personel, ihale…) listede "Diğer" altında durur, aramaya girmez.
const OTHER_RE = /arastirma merkezi|uygulama ve arastirma|arastirma ve uygulama|ihale|laboratuvar okullari|personel|gorevlendirme|guvenlik hizmet|atama ve yukseltme|kalite|sinai mulkiyet|teknoloji transfer|misafir ogretim|kurulus kanunu|vakif yuksekogretim|meslek yuksekokullari/;
const OTHER = { test: s => OTHER_RE.test(norm(s)) };
const TITLE_FIX = s => txt(s).replace(/\s*\(TOBB ET[ÜU][^)]*$/, '').replace(/^TOBB ETÜ\s+/i, '');

// ---------- Okulun Mevzuat sayfası (dizin) ----------
let indexMemo = null;
export async function index() {
  if (indexMemo && Date.now() - indexMemo.t < 6 * 3600_000) return indexMemo.data;
  const $ = await html(ETU + '/tr/sayfa/mevzuat');
  // İçerik kutusu: bütün bölüm başlıklarını (h2) içeren en yakın kap
  const h2 = $('h2');
  if (!h2.length) throw new Error('Mevzuat sayfası okunamadı');
  let box = h2.first().parent();
  while (box.length && box.find('h2').length < h2.length) box = box.parent();
  const sections = [];
  const seen = new Set();
  box.find('h2, a[href]').each((_, el) => {
    if (el.tagName === 'h2') return void sections.push({ title: txt($(el).text()), items: [] });
    if (!sections.length) return;
    const title = TITLE_FIX($(el).text());
    const c = classify($(el).attr('href'));
    if (!title || !c) return;
    const key = c.id || c.url;
    if (seen.has(key)) return;               // aynı rehber Türkçe/İngilizce iki kez verilmiş olabilir
    seen.add(key);
    sections.at(-1).items.push({ title, ...c, other: OTHER.test(title) });
  });
  const data = { source: ETU + '/tr/sayfa/mevzuat', sections: sections.filter(s => s.items.length) };
  indexMemo = { t: Date.now(), data };
  return data;
}
// Liste: belge açılmış/aranmışsa (önbellekte varsa) tarihleri ve madde sayısıyla. Liste için belge indirilmez.
export async function listing() {
  const ix = await index();
  const info = async i => {
    if (!i.id) return i;
    let hit = memo.get(i.id);
    if (!hit) { hit = await fs.readFile(fileOf(i.id), 'utf8').then(JSON.parse).catch(() => null); if (hit) memo.set(i.id, hit); }
    return { ...i, dates: hit?.data.dates ?? null, arts: hit ? hit.data.arts.length : null };
  };
  return { ...ix, sections: await Promise.all(ix.sections.map(async s => ({ ...s, items: await Promise.all(s.items.map(info)) }))) };
}
const allItems = async () => (await index()).sections.flatMap(s => s.items.map(i => ({ ...i, section: s.title })));

// ---------- Metin çıkarma ----------
// Her biçimden paragraf listesi: HTML'de her <p> bir paragraftır; PDF/Word'de satırlar paragrafa birleştirilir.
function fromHtml($, root) {
  const out = [];
  root.find('script, style').remove();
  // Sayfa düzeni için kullanılan tablolar (Resmî Gazete) açılır; gerçek çizelgeler (ör. harf notları) satır satır metne
  root.find('table').get().reverse().forEach(t => {
    if ($(t).find('p').length > 6) return void $(t).replaceWith($(t).find('td, th').map((_, c) => $(c).html()).get().join(''));
    const rows = $(t).find('tr').map((_, tr) => $(tr).children('td, th').map((_, c) => txt($(c).text())).get().filter(Boolean).join(' | ')).get();
    $(t).replaceWith(`<p>${rows.map(r => r.replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;'))).join('</p><p>')}</p>`);
  });
  root.find('p, h1, h2, h3, h4, h5, h6, li').each((_, el) => {
    if ($(el).find('p, li').length) return;  // iç içe yapılarda yalnızca en içteki
    const s = txt($(el).text());
    if (s) out.push(s);
  });
  return out;
}

const START = /^((EK|GE[ÇC][İI]C[İI])\s+MADDE|MADDE)\s*\d*|^\(\d+\)|^[a-zçğıöşü]{1,2}\)\s|^[-•–]\s|^\d+[.)]\s|^[IVX]+[.)]\s|^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU|ONUNCU)\b/;
const upper = s => s.length > 3 && s === s.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(s);
// PDF/Word satırları → paragraflar: yeni madde, fıkra, bent, başlık ya da boş satır yeni paragraf başlatır.
function fromLines(lines) {
  const ls = lines.map(l => txt(l)).filter(l => !/^\d{1,3}$/.test(l));   // sayfa numaraları
  const out = [];
  let cur = '';
  const flush = () => { if (cur) out.push(cur); cur = ''; };
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (!l) { flush(); continue; }
    const next = ls.slice(i + 1).find(Boolean) || '';
    const heading = (l.length < 90 && !/[.,;:]$/.test(l) && ART.test(next)) || upper(l);
    if (START.test(l) || heading || /[:]$/.test(cur) || upper(cur)) flush();
    cur = cur ? (cur.endsWith('-') && /^[a-zçğıöşü]/.test(l) ? cur.slice(0, -1) + l : cur + ' ' + l) : l;
    if (heading) flush();
  }
  flush();
  return out;
}

let pdfjsP = null;
async function pdfLines(buf) {
  // Paketli sürümde çizim kütüphanesi (@napi-rs/canvas) yok; metin çıkarmak için gerekmez. pdf.js yüklenirken
  // bunun için bastığı "Warning: Cannot load/polyfill …" satırları siyah pencereyi kirletmesin diye susturulur.
  pdfjsP ??= (async () => {
    const orig = { log: console.log, warn: console.warn };
    const quiet = f => (...a) => (/^Warning: Cannot (load|polyfill)/.test(String(a[0])) ? undefined : f(...a));
    console.log = quiet(orig.log); console.warn = quiet(orig.warn);
    try { return await import('pdfjs-dist/legacy/build/pdf.mjs'); } finally { Object.assign(console, orig); }
  })();
  const { getDocument } = await pdfjsP;
  const task = getDocument({ data: new Uint8Array(buf), verbosity: 0, isEvalSupported: false, useSystemFonts: false });
  const doc = await task.promise;
  const lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    let line = '', y = null;
    for (const it of c.items) {
      const yy = it.transform[5];
      if (y !== null && Math.abs(yy - y) > 2) { lines.push(line); line = ''; }
      line += it.str; y = yy;
      if (it.hasEOL) { lines.push(line); line = ''; y = null; }
    }
    lines.push(line, '');
  }
  await task.destroy();
  return lines;
}

// .docx bir zip: word/document.xml içindeki paragraflar (<w:p>) okunur. Küçük bir zip okuyucu yeterli (ek paket gerekmez).
function unzip(buf, name) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Word dosyası açılamadı');
  let p = buf.readUInt32LE(e + 16);
  for (let i = buf.readUInt16LE(e + 10); i > 0; i--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28);
    const xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + nl) === name) {
      const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const data = buf.subarray(start, start + size);
      return method === 8 ? zlib.inflateRawSync(data) : data;
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('Word dosyası açılamadı');
}
const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = s => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, k) => k[0] === '#' ? String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : +k.slice(1)) : XML_ENT[k] ?? m);
function docxParas(buf) {
  const xml = unzip(buf, 'word/document.xml').toString('utf8');
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(([p]) =>
    unxml(p.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, '\n').replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<[^>]+>/g, (_, t) => t ?? ''))).map(txt).filter(Boolean);
}
// Eski .doc (Word 97-2003): metin dosyanın içinde UTF-16 parçalar hâlinde durur. Biçimi çözmek yerine okunur uzun
// UTF-16 dizileri alınır; Türkçe harfler (ş, ğ, ı) yalnızca bu kodlamayla saklanabildiği için metnin tamamı gelir.
function docParas(buf) {
  const out = [];
  let run = '';
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const c = buf.readUInt16LE(i);
    const ok = (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c < 0x250) || c === 0x2019 || c === 0x201c || c === 0x201d || c === 0x2013 || c === 0x2026 || c === 13 || c === 11 || c === 7 || c === 9;
    if (ok) run += String.fromCharCode(c);
    else { if (run.length > 40) out.push(run); run = ''; }
  }
  if (run.length > 40) out.push(run);
  // En uzun dizi gövde metnidir; diğerleri (yazı tipi adları, özet bilgisi) atılır.
  const body = out.sort((a, b) => b.length - a.length)[0] || '';
  return fromLines(body.split(/[\r\v\x07]/).map(s => s.replace(/\t/g, ' ')));
}

// ---------- Yapı: bölüm, madde başlığı, madde ----------
// "MADDE 5 –", "Madde 54 –", "EK MADDE 3 –", "Geçici Madde 1 –" (İ/i büyük-küçük harf eşleşmesi JS'de kendiliğinden olmaz)
const ART = /^((EK|GE[ÇC][İI]C[İI])\s+)?MADDE\s*[-–]?\s*(\d+)\s*([-–—]|\.|$)?/i;
const artKey = m => (m[2] ? (/^ek/i.test(m[2]) ? 'ek' : 'g') : '') + m[3];
const PART = /^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU|ONUNCU|[A-ZÇĞİÖŞÜ]+NCİ|[A-ZÇĞİÖŞÜ]+NCI)\s+(BÖLÜM|KISIM)$/i;
function structure(paras) {
  const blocks = [];
  let art = null;
  for (let i = 0; i < paras.length; i++) {
    const s = paras[i];
    const m = ART.exec(s);
    if (m) {
      art = artKey(m);
      // Hemen önceki kısa, noktasız satır maddenin başlığıdır
      const prev = blocks.at(-1);
      if (prev && prev.k === 'p' && prev.x.length < 120 && !/[.;:,]$/.test(prev.x) && !/^\(|^[a-zçğıöşü]{1,2}\)/.test(prev.x)) { prev.k = 'h'; prev.a = art; }
      blocks.push({ k: 'p', x: s, a: art, start: true });
      continue;
    }
    if (PART.test(s)) { blocks.push({ k: 'part', x: s }); art = null; continue; }
    if (blocks.at(-1)?.k === 'part' && blocks.at(-1).x.match(PART) && s.length < 120 && !ART.test(paras[i + 1] || '') ) { blocks.push({ k: 'part', x: s }); continue; }
    blocks.push({ k: !art && !blocks.some(b => b.a) && (upper(s) || i === 0) ? 'title' : 'p', x: s, ...(art ? { a: art } : {}) });
  }
  const arts = [];
  for (const [i, b] of blocks.entries()) if (b.start) arts.push({ a: b.a, i, t: blocks[i - 1]?.k === 'h' ? blocks[i - 1].x : '' });
  return { blocks, arts };
}

// Belgenin tarihleri: Resmî Gazete yayımı/değişiklikleri (mevzuat.gov.tr) ya da Senato karar tarihleri (yönergeler).
function dates(item, paras) {
  const all = paras.join('\n');
  const dmy = s => { const m = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
  const amend = [...all.matchAll(/(?:Değişik|Ek|Mülga|İptal)[^:()]{0,20}:\s*RG-(\d{1,2}\/\d{1,2}\/\d{4})/g)].map(m => dmy(m[1]));
  // "30.05.2017 tarih ve S-2017-11/01 sayılı Senato kararı", "(Değişik: 04.01.2024 tarih 01/1 sayılı Senato Kararı)"
  const senato = [...all.matchAll(/(\d{2}[./]\d{2}[./]\d{4})\s*tarih\S*\s*(?:ve\s*)?(?:S-|[\w/-]*\s*sayılı\s*Senato|Senato)/gi)].map(m => dmy(m[1]));
  const sorted = a => [...new Set(a.filter(Boolean))].sort();
  return { lastAmend: sorted(amend).at(-1) || null, senato: sorted(senato), uploaded: item.uploaded || null };
}

// ---------- Belgeler (önbellekli) ----------
const memo = new Map();       // id -> { t, data }
const inflight = new Map();
const fileOf = id => path.join(DIR, `v${DOC_VER}-${id}.json`);

async function build(item) {
  let paras, rg = null;
  if (item.kind === 'mg' || item.kind === 'rg') {
    // Metin ve (mevzuat.gov.tr'de) yayım bilgisini taşıyan çerçeve sayfası aynı anda istenir
    const [$, w] = await Promise.all([html(item.fetch),
      item.kind === 'mg' ? html(item.url).then($ => txt($('body').text())).catch(() => '') : '']);
    paras = fromHtml($, $('body'));
    // mevzuat.gov.tr'nin "bulunamadı" sayfası
    if (paras.length < 5) throw new Error('Belge kaynağında bulunamadı');
    // Yayım bilgisi çerçeve sayfasının başlığında: "Resmî Gazete Tarihi: 12.09.2011 Resmî Gazete Sayısı: 28052"
    if (item.kind === 'mg') {
      const m = /Resmî Gazete Tarihi:\s*(\d{2})\.(\d{2})\.(\d{4})\s*Resmî Gazete Sayısı:\s*(\d+)/.exec(w);
      if (m) rg = { date: `${m[3]}-${m[2]}-${m[1]}`, no: m[4] };
    }
  } else {
    const buf = Buffer.from(await (await get(item.fetch, 60_000)).arrayBuffer());
    paras = item.kind === 'pdf' ? fromLines(await pdfLines(buf)) : item.kind === 'docx' ? docxParas(buf) : docParas(buf);
  }
  if (!paras.length) throw new Error('Belgenin metni okunamadı');
  // mevzuat.gov.tr metinlerinin sonundaki Resmî Gazete çizelgesi ve dipnotlar ayrı tutulur
  let notes = [];
  const cut = paras.findIndex(p => /^Yönetmeliğin Yayımlandığı|^Kanunun Yayımlandığı|^Resmî Gazete['’]nin$|^_{5,}$/.test(p));
  if (cut > 0) { notes = paras.slice(cut); paras = paras.slice(0, cut); }
  const { blocks, arts } = structure(paras);
  return { id: item.id, title: item.title, kind: item.kind, url: item.url, section: item.section, other: item.other,
    dates: { ...dates(item, [...paras, ...notes]), rg }, notes: notes.slice(0, 80), blocks, arts, at: Date.now() };
}

async function load(item, { force = false } = {}) {
  const hit = memo.get(item.id) ?? await fs.readFile(fileOf(item.id), 'utf8').then(JSON.parse).catch(() => null);
  if (hit) memo.set(item.id, hit);
  const fresh = hit && Date.now() - hit.t < FRESH;
  if (hit && (fresh || !force)) {
    if (!fresh) refresh(item).catch(() => {});   // eskiyse arka planda yenile, şimdilik eldekini ver
    return hit.data;
  }
  return (await refresh(item)).data;
}
function refresh(item) {
  if (!inflight.has(item.id)) inflight.set(item.id, build(item).then(async data => {
    const e = { t: Date.now(), data };
    memo.set(item.id, e);
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(fileOf(item.id), JSON.stringify(e)).catch(() => {});
    return e;
  }).finally(() => inflight.delete(item.id)));
  return inflight.get(item.id);
}

export async function doc(id) {
  const items = await allItems();
  const item = items.find(i => i.id === id);
  if (!item) throw new Error('Bu belge okulun Mevzuat sayfasında yok');
  const d = await load(item);
  return { ...d, related: related(d, items) };
}

// Belgenin metninde adı geçen, listedeki diğer belgeler (ör. bir yönergenin dayandığı YÖK yönetmeliği)
// Yalnızca üst mevzuat (listede daha önceki bölümler: Kanun > YÖK yönetmeliği > ETÜ yönetmeliği > yönerge) gösterilir.
function related(d, items) {
  const letters = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const stem = t => letters(t.replace(/^TOBB ETÜ\s*/i, '')).replace(/ (yonetmeligi|yonetmelik|yonergesi|yonerge|esaslari|esaslar|kanunu|kanun)$/, '');
  const body = letters(d.blocks.map(b => b.x).join(' '));
  const order = [...new Set(items.map(i => i.section))];
  const mine = order.indexOf(d.section);
  return items.filter(i => i.id && i.id !== d.id && !i.other && i.title.length > 12 && order.indexOf(i.section) < mine)
    .filter(i => { const k = stem(i.title); return k.length > 10 && (body.includes(k) || (/^\d+ sayili/.test(k) && body.includes(k.split(' ')[0] + ' sayili'))); })
    .map(i => ({ id: i.id, title: i.title, section: i.section, lastAmend: memo.get(i.id)?.data.dates.lastAmend ?? null })).slice(0, 8);
}

// ---------- Arama ----------
// Öğrenciyi ilgilendiren bütün belgeler (ilk aramada indirilir, sonra önbellekten) madde madde taranır.
let warmP = null;
async function corpus() {
  const items = (await allItems()).filter(i => i.id && !i.other);
  warmP ??= (async () => {
    const out = [];
    for (let i = 0; i < items.length; i += 4)                // okulun sitesini yormamak için 4'erli
      out.push(...await Promise.all(items.slice(i, i + 4).map(it => load(it).catch(e => (console.error('mevzuat', it.title, e.message), null)))));
    return out.filter(Boolean);
  })().finally(() => setTimeout(() => { warmP = null; }, 60_000));
  return warmP;
}

function snippet(text, terms) {
  const n = norm(text);
  // norm() harf sayısını değiştirebilir (İ → i); eşleşme konumu yaklaşık, kesit biraz geniş tutulur
  const pos = Math.max(0, Math.min(...terms.map(t => { const i = n.indexOf(t); return i < 0 ? Infinity : i; })));
  const from = Math.max(0, (Number.isFinite(pos) ? pos : 0) - 90);
  return (from ? '…' : '') + text.slice(from, from + 280) + (from + 280 < text.length ? '…' : '');
}

// Öğrencilerin kullandığı adlar mevzuattaki terimlerle aynı değil: "kayıt dondurma" yönetmelikte "dönem izni",
// "YAP" ise "yandal". Aranan söz bu listedeyse mevzuattaki karşılığıyla da aranır.
const SYNONYMS = [
  [/\bkayit dondur\w*/, 'izin'], [/\bdondurma\b/, 'izin'], [/\b(withdraw|cekilme|dersten cekil\w*)\b/, 'vazgec'],
  [/\byap\b/, 'yandal'], [/\bcap\b/, 'cift anadal'], [/\bdevamsizlik\b/, 'devam'], [/\bnot itiraz\w*/, 'maddi hata'],
  [/\bgpa\b/, 'genel not ortalamasi'], [/\bgno\b/, 'genel not ortalamasi'], [/\byaz okulu\b/, 'yaz donemi'], [/\bstaj\b/, 'ortak egitim'],
  [/\bmazeret sinavi\b/, 'mazeret'], [/\bbutunleme\b/, 'mezuniyet ek sinavi'], [/\bdisiplin cezasi\b/, 'disiplin'],
];
function variants(q) {
  const base = norm(q);
  let alt = base;
  for (const [re, to] of SYNONYMS) alt = alt.replace(re, to);
  return [...new Set([base, alt])];
}
const termsOf = s => s.split(' ').filter(t => t.length > 1).slice(0, 8);

export async function search(q) {
  const vs = variants(q).map(termsOf).filter(t => t.length);
  if (!vs.length) return { q, results: [], docs: (await corpus()).length };
  const docs = await corpus();
  const found = new Map();
  for (const d of docs) {
    const titleN = norm(d.title);
    // Madde madde; maddesi olmayan belgelerde (rehber, esaslar) paragraf paragraf
    const groups = new Map();
    d.blocks.forEach((b, i) => {
      const k = d.arts.length ? (b.a ?? '_') : 'p' + i;
      if (!groups.has(k)) groups.set(k, { text: '', i });
      groups.get(k).text += ' ' + b.x;
    });
    for (const [k, g] of groups) {
      const n = norm(g.text), ns = n.replace(/\s/g, '');
      for (const terms of vs) {
        if (!terms.every(t => n.includes(t) || ns.includes(t.replace(/\s/g, '')))) continue;
        const a = /^p\d+$|^_$/.test(k) ? null : k;
        const art = a && d.arts.find(x => x.a === a);
        // Uzun maddeler sırf uzun oldukları için öne geçmesin: her sözün en fazla 3 geçişi sayılır.
        // Okulun kendi yönetmelik ve yönergeleri, genel kanundan önce gelir.
        let score = 2 * terms.reduce((s, t) => s + Math.min(3, n.split(t).length - 1 || 1), 0) / terms.length;
        if (art?.t && terms.some(t => norm(art.t).includes(t))) score += 6;
        if (terms.some(t => titleN.includes(t))) score += 3;
        if (/TOBB ETÜ/i.test(d.section || '')) score += 2;
        if (k === '_') score -= 4;
        const key = d.id + '/' + k;
        if ((found.get(key)?.score ?? -1) < score)
          found.set(key, { id: d.id, doc: d.title, a, b: a ? null : g.i, t: art?.t || '', snippet: snippet(txt(g.text), terms), score });
      }
    }
  }
  // Bir belgeden en fazla 4 madde (maddesiz belgelerde 2 paragraf): sonuçlar tek bir uzun belgeyle dolmasın
  const per = new Map();
  const results = [...found.values()].sort((x, y) => y.score - x.score).filter(r => {
    const c = (per.get(r.id) ?? 0) + 1;
    per.set(r.id, c);
    return c <= (r.a ? 4 : 2);
  });
  return { q, terms: [...new Set(vs.flat())], also: vs.slice(1).map(t => t.join(' ')), results: results.slice(0, 60), total: results.length, docs: docs.length };
}

// ---------- Öğrenci İşleri duyuruları ----------
let newsMemo = null;
export async function news() {
  if (newsMemo && Date.now() - newsMemo.t < 3 * 3600_000) return newsMemo.data;
  const items = [];
  for (const pg of [1, 2, 3]) {
    const $ = await html(`${ETU}/tr/ogrenci-isleri${pg > 1 ? '?pgNb=' + pg : ''}`);
    $('a[href*="/ogrenci-isleri/duyuru/"]').each((_, a) => {
      const href = $(a).attr('href');
      const p = new URL(href, ETU).pathname;
      if (items.some(x => x.path === p)) return;
      const t = txt($(a).text());
      const ago = (t.match(/^(\d+\s+\S+\s+ÖNCE)\s*/i) || [])[1] || '';
      const title = txt(t.slice(ago.length));
      if (title) items.push({ path: p, title, ago: ago.toLocaleLowerCase('tr') });
    });
  }
  const data = { source: ETU + '/tr/ogrenci-isleri', items };
  newsMemo = { t: Date.now(), data };
  return data;
}

export async function newsItem(p) {
  if (!/^\/tr\/ogrenci-isleri\/duyuru\/[\w-]+$/.test(p || '')) throw new Error('Geçersiz duyuru');
  const $ = await html(ETU + p);
  const title = txt($('h1').first().text()) || txt($('title').text());
  // Gövde: duyuru metni kutusu; yoksa doğrudan paragraf içeren en uzun kutu
  let body = $('.haber_icerik .wysi-icerik, .wysi-icerik').first();
  if (!body.length) {
    let best = 0;
    body = null;
    $('div, article, section').each((_, el) => {
      const own = $(el).children('p, ul, ol, table').text().length;
      if (own > best) { best = own; body = $(el); }
    });
  }
  const paras = body ? fromHtml($, body.clone()) : [];
  const links = body ? body.find('a[href]').map((_, a) => ({ text: txt($(a).text()), ...classify($(a).attr('href')) })).get().filter(l => l.url && l.text) : [];
  // Duyurudaki belge bağlantısı Mevzuat sayfasındaki sürümden farklıysa (eski sürüm) işaretlenir
  const items = await allItems().catch(() => []);
  for (const l of links) {
    if (!l.id) continue;
    const same = items.find(i => i.id === l.id);
    if (same) { l.docId = same.id; continue; }
    const key = norm(TITLE_FIX(l.text)).replace(/ (yonergesi|yonetmeligi|esaslari)$/, '');
    const twin = key.length > 8 && items.find(i => norm(i.title).startsWith(key));
    if (twin) l.newer = { id: twin.id, title: twin.title, uploaded: twin.uploaded || null, older: !!(l.uploaded && twin.uploaded && l.uploaded < twin.uploaded) };
  }
  return { path: p, url: ETU + p, title, paras, links };
}

// ---------- Hızlı yanıtlar ----------
// Sık sorulan kurallar, kaynak madde ve o maddeden birebir alıntıyla. Alıntı güncel metinde hâlâ geçiyor mu her
// açılışta denetlenir: belge değişmişse yanıt "kaynağı kontrol et" uyarısıyla gösterilir (eskimiş bilgi sessizce kalmaz).
let calMemo = null;
export async function answers() {
  const items = await allItems();
  const docs = new Map();
  const need = [...new Set(ANSWERS.flatMap(x => x.cites.map(c => c.doc)))];
  await Promise.all(need.map(async key => {
    const item = items.find(i => i.id === key || norm(i.title) === norm(key));
    if (item) docs.set(key, await load(item).catch(() => null));
  }));
  let calendar = null, newsList = null;
  if (!calMemo || Date.now() - calMemo.t > 6 * 3600_000)
    calMemo = { t: Date.now(), p: import('./etu.mjs').then(m => m.calendar()).catch(() => { calMemo = null; return null; }) };
  const calP = calMemo.p.then(c => { calendar = c; });
  const newsP = news().then(n => { newsList = n; }).catch(() => {});
  await Promise.all([calP, newsP]);
  const now = Date.now();
  return {
    answers: ANSWERS.map(x => ({
      id: x.id, q: x.q, a: x.a, tags: x.tags || [],
      cites: x.cites.map(c => {
        const d = docs.get(c.doc);
        if (!d) return { doc: c.doc, a: c.a, title: c.title || c.doc, ok: null };
        const text = norm(d.blocks.filter(b => b.a === c.a).map(b => b.x).join(' '));
        return { id: d.id, title: d.title, a: c.a, t: d.arts.find(z => z.a === c.a)?.t || '', ok: !!text && c.quote.split(' … ').every(part => text.includes(norm(part))) };
      }),
      // Akademik takvimdeki ilgili satırlar (ör. ÇAP/YAP başvuru tarihleri) ve son Öğrenci İşleri duyurusu
      calendar: x.calendar ? (calendar?.tabs ?? []).filter(t => /lisans/i.test(t.title) && !/lisansüstü/i.test(t.title)).flatMap(t => t.terms.flatMap(term =>
        term.items.filter(i => x.calendar.test(i.what) && (!i.end || i.end > now - 30 * 86_400_000)).map(i => ({ term: term.title, when: i.when, what: i.what, start: i.start, end: i.end })))).slice(0, 6) : [],
      news: x.news ? (newsList?.items ?? []).filter(n => x.news.test(n.title)).slice(0, 2) : [],
    })),
  };
}
