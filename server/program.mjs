// Dönem ders programı: bütün bölümlerin şube, gün/saat, derslik ve ders hocası bilgisi (Açılan Dersler için).
//
// Ortam bu bilgiyi yalnızca görünmez reCAPTCHA korumalı bölüm aramasıyla veriyor. Uygulama bu formu kendiliğinden doldurup
// göndermez ve doğrulamayı aşmaya çalışmaz. Veri iki yoldan gelir:
//  1) Kullanıcı Ortam'ın ders programı sayfasını uygulamanın açtığı pencerede kendisi kullanır (bölümü seçer, "Göster"e basar,
//     doğrulama çıkarsa yanıtlar); uygulama yalnızca kullanıcının açtığı sonuç sayfalarını okuyup kaydeder.
//  2) Daha önce kaydedilmiş sonuç sayfaları (dept_*.html) ya da "ETÜ Sınıf Durumu" sayfası/veri dosyası içe aktarılır.
// Veri yalnızca bu bilgisayarda, .cache/ders-programi.json içinde tutulur.
import fs from 'node:fs/promises';
import { decodeHTML } from 'entities';
import { userWindow } from './session.mjs';

const FILE = '.cache/ders-programi.json';
const ORTAM = 'https://ortam.etu.edu.tr';
const EMPTY = () => ({ term: null, updated: null, depts: {}, sessions: [], sources: [] });
let db = null;
async function load() {
  db ??= await fs.readFile(FILE, 'utf8').then(JSON.parse).catch(EMPTY);
  return db;
}
async function save() {
  db.updated = Date.now();
  await fs.mkdir('.cache', { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db));
}

// ---------- Derslikler: bina ve kat ----------
export const BUILDINGS = [
  { id: 'ana', name: 'Ana Bina' }, { id: 'st', name: 'Sosyal Tesisler' }, { id: 'tepav', name: 'TEPAV' },
  { id: 'mtf', name: 'Mimarlık ve Tasarım Fakültesi' }, { id: 'ydb', name: 'Yabancı Diller' }, { id: 'tm', name: 'Teknoloji Merkezi' },
];
const BINA_IDS = [['ana bina', 'ana'], ['sosyal', 'st'], ['tepav', 'tepav'], ['teknoloji', 'tm'], ['mimarl', 'mtf'], ['yabanc', 'ydb'], ['ydb', 'ydb']];
const LANG = new Set(['ALM', 'ARP', 'CIN', 'FRA', 'İNG', 'ING', 'RUS', 'İSP', 'ISP', 'ITA', 'HZR']);
const lower = s => String(s).toLocaleLowerCase('tr');
function buildingOf(bina, name) {
  const low = lower(bina);
  if (low === 'sanal derslik') return name.startsWith('TM') ? 'tm' : null;
  return BINA_IDS.find(([k]) => low.includes(k))?.[1] ?? null;
}
// Ders programındaki (bina, derslik) → { b: bina, r: derslik adı }; sanal/kopya derslikler için null
export function classifyRoom(bina, name, course = '') {
  name = String(name).trim();
  if (!String(bina).trim() && /^\d{3}$/.test(name)) bina = LANG.has(course.split(' ')[0].toLocaleUpperCase('tr')) ? 'Yabancı Diller' : 'Ana Bina';
  if (name.startsWith('X.')) return null;
  const b = buildingOf(bina, name);
  if (!b) return null;
  if (b === 'tepav') return { b, r: name.replace('3.KAT (TEPAV)', '3. Kat') };
  if (b === 'tm') return { b, r: name.split(' (')[0] };
  if (b === 'ydb') { const m = name.match(/\d{3}/); return { b, r: m ? `YDB ${m[0]}` : name }; }
  if (b === 'mtf') {
    const n = name.replace(/\s*\(Mimarl[ıi]k\)/, '');
    const z = n.match(/^Z-?(\d{2})$/);
    return { b, r: z ? `MTF Z${z[1]}` : n };
  }
  if (b === 'ana') { const m = name.match(/^([BZ])-?(\d{2})$/); return { b, r: m ? m[1] + m[2] : name }; }
  return { b, r: name };
}

// ---------- Ortam sonuç sayfası (bir bölümün haftalık programı) ----------
const strip = s => decodeHTML(String(s).replace(/<[^>]*>/g, ''));
export function parseDeptPage(html) {
  const i = html.indexOf('<tbody'), j = html.indexOf('</table>', i);
  if (i < 0 || j < 0) return [];
  const out = [];
  for (const row of html.slice(i, j).split(/<tr[^>]*>/).slice(1)) {
    const tds = row.split(/<td[^>]*>/).slice(1);
    if (!tds.length) continue;
    const slot = strip(tds[0]).trim();
    tds.slice(1).forEach((td, k) => {
      for (const m of td.matchAll(/<span[^>]*class="c[^"]*"[^>]*>([\s\S]*?)<hr>\s*<\/span>/g)) {
        const b = m[1];
        const code = strip(b.split('<strong')[0]).replace(/^[\s-]+|[\s-]+$/g, '');
        const room = b.match(/title="Bina: ([^|]*)\| Kapasite:(\d+)"[^>]*>([\s\S]*?)<\/strong>/);
        if (!room || !code) continue;
        const info = b.match(/<span data-toggle="tooltip"[^>]*title="([^"]*)"><i/);
        const [title = '', instr = ''] = info ? decodeHTML(info[1]).split('|') : [];
        out.push({ slot, day: k + 1, course: code, bina: decodeHTML(room[1]).trim(), cap: +room[2], room: strip(room[3]).trim(), title: title.trim(), instructor: instr.trim() });
      }
    });
  }
  return out;
}
const toSession = e => {
  const c = classifyRoom(e.bina, e.room, e.course);
  return c ? { c: e.course, t: e.title, i: e.instructor, d: e.day, s: e.slot, b: c.b, r: c.r, cap: e.cap || 0 } : null;
};

// Yeni gelen bölüm/dosya verisi: aynı derslerin (şube kodu) eski kayıtları atılır, yenileri eklenir.
// Dönem adları farklı yazılabiliyor ("2026 - 2027 Güz" / "2026-2027 Güz"): boşluksuz ve küçük harfle karşılaştırılır.
export const termKey = t => lower(t || '').replace(/\s+/g, '').replace(/dönemi$/, '');
function merge(sessions, { term, dept, source }) {
  if (term && db.term && termKey(term) !== termKey(db.term)) Object.assign(db, EMPTY());   // yeni dönem: eski dönemin verisi silinir
  if (term) db.term = term.replace(/\s*-\s*/, '-');
  const codes = new Set(sessions.map(s => s.c));
  db.sessions = db.sessions.filter(s => !codes.has(s.c));
  const seen = new Set(db.sessions.map(key));
  for (const s of sessions) if (!seen.has(key(s))) { db.sessions.push(s); seen.add(key(s)); }
  if (dept) db.depts[dept.id || dept.name] = { name: dept.name, at: Date.now(), n: sessions.length };
  db.sources = [...(db.sources || []).filter(x => x.name !== source.name), { ...source, at: Date.now(), n: sessions.length }].slice(-60);
}
const key = s => `${s.c}|${s.d}|${s.s}|${s.r}`;

// ---------- İçe aktarma ----------
// "ETÜ Sınıf Durumu" sayfası ya da veri dosyası (window.DATA = {...}), ham sonuç sayfası (dept_*.html) ya da bu uygulamanın JSON'u.
export async function importFile(name, buf) {
  await load();
  const text = buf.toString('utf8');
  let data = null;
  const m = text.match(/window\.DATA\s*=\s*(\{[\s\S]*?\});?\s*(?:\n|<\/script>)/);
  try { data = m ? JSON.parse(m[1]) : /^\s*\{/.test(text) ? JSON.parse(text) : null; } catch { data = null; }
  if (data?.rooms) {
    const sessions = [];
    for (const room of data.rooms) for (const [k, list] of Object.entries(room.sessions || {})) {
      const [d, s] = k.split('|');
      for (const x of list) sessions.push({ c: x.c, t: x.t || '', i: x.i || '', d: +d, s, b: room.b, r: room.label, cap: room.cap || 0 });
    }
    merge(sessions, { term: data.meta?.semester || null, source: { name, kind: 'sinif-durumu', built: data.meta?.built || null, depts: data.meta?.deptLoaded ?? null } });
    for (const n of data.meta?.deptNames ?? []) db.depts[n] ??= { name: n, at: Date.parse(data.meta?.built) || Date.now(), n: null };
    await save();
    return summary();
  }
  if (data?.sessions && Array.isArray(data.sessions)) {                        // bu uygulamanın kendi dosyası
    merge(data.sessions, { term: data.term, source: { name, kind: 'json' } });
    for (const [k, v] of Object.entries(data.depts || {})) db.depts[k] ??= v;
    await save();
    return summary();
  }
  const rows = parseDeptPage(text);
  if (rows.length) {
    merge(rows.map(toSession).filter(Boolean), { source: { name, kind: 'sayfa' }, dept: { id: name, name: name.replace(/\.html?$/i, '') } });
    await save();
    return summary();
  }
  throw new Error('Dosyada ders programı bulunamadı (ETÜ Sınıf Durumu sayfası, Ortam sonuç sayfası ya da bu uygulamanın veri dosyası olmalı)');
}

// ---------- Kullanıcının yönettiği Ortam penceresi ----------
let capture = { active: false, count: 0, last: null, error: null };
const BANNER = `(() => { if (document.getElementById('ortam-sade-serit')) return;
  const d = document.createElement('div'); d.id = 'ortam-sade-serit';
  d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:12px 16px;border-radius:10px;background:#1b449c;color:#fff;font:14px/1.45 Segoe UI,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3)';
  d.textContent = 'Ortam Sade: Bölümü seçip aramayı sen yap. Açtığın her sonuç sayfası uygulamaya kaydedilir. İstediğin bölümler bitince bu sekmeyi kapat.';
  document.body.appendChild(d); })()`;

// Seçilen dersler (Ortam'daki ders seçeneklerinin değerleri): formda işaretlenir ve aramayı başlatan düğme vurgulanır.
// Düğmeye kullanıcı basar; uygulama formu göndermez. Sonuç gelince sekme kendiliğinden kapanır.
const PRESELECT = ids => `(() => {
  const sel = document.querySelector('select[name="courses[]"]');
  if (!sel) return false;
  const want = new Set(${JSON.stringify(ids)});
  for (const o of sel.options) o.selected = want.has(o.value);
  if (window.jQuery) window.jQuery(sel).trigger('change'); else sel.dispatchEvent(new Event('change', { bubbles: true }));
  const btn = sel.closest('form')?.querySelector('button[type=submit], input[type=submit], button:not([type])');
  if (btn) {
    btn.style.setProperty('box-shadow', '0 0 0 4px #fff, 0 0 0 8px #f08921', 'important');
    btn.style.setProperty('transform', 'scale(1.08)', 'important');
    sel.closest('.card')?.style.setProperty('box-shadow', '0 0 0 3px #f08921', 'important');
    btn.scrollIntoView({ block: 'center' });
  }
  const d = document.getElementById('ortam-sade-serit');
  if (d) d.textContent = 'Ortam Sade: Seçtiğin ' + want.size + ' ders işaretlendi. Şube ve saatleri getirmek için turuncu çerçeveli düğmeye bas; sonuç gelince bu sekme kendiliğinden kapanır.';
  return true;
})()`;

export async function startCapture(path = '/Guz-Donemi-Ders-Programi', term = null, courses = []) {
  await load();
  if (capture.active) return captureState();
  const ids = (Array.isArray(courses) ? courses : []).map(String).filter(x => /^\d{1,9}$/.test(x)).slice(0, 40);
  capture = { active: true, count: 0, last: null, error: null, courses: ids.length };
  const url = ORTAM + (/^\/[\w-]+$/.test(path) ? path : '/Guz-Donemi-Ders-Programi');
  userWindow(url, {
    onLoad: async page => { await page.evaluate(BANNER).catch(() => {}); if (ids.length) await page.evaluate(PRESELECT(ids)).catch(() => {}); },
    onResponse: async (r, page) => {
      if (r.request().method() !== 'POST' || !r.url().startsWith(ORTAM) || r.status() !== 200) return;
      const html = await r.text().catch(() => '');
      if (!html.includes('<tbody') || !html.includes('Kapasite')) return;
      const rows = parseDeptPage(html);
      if (!rows.length) return;
      const id = new URLSearchParams(r.request().postData() || '').get('department') || '';
      const name = id ? await page.$eval(`select[name=department] option[value="${id.replace(/"/g, '')}"]`, o => o.textContent.trim()).catch(() => id) : 'Seçilen dersler';
      merge(rows.map(toSession).filter(Boolean), { term, dept: id ? { id, name } : null, source: { name: `Ortam: ${name}`, kind: 'ortam' } });
      await save();
      capture.count++; capture.last = name;
      if (ids.length) setTimeout(() => page.close().catch(() => {}), 1500);   // seçilen derslerin sonucu geldi: sekme kapanır
    },
  }).catch(e => { capture.error = e.message; }).finally(() => { capture.active = false; });
  return captureState();
}
const captureState = () => ({ ...capture });

// ---------- Uç ----------
function summary() {
  const codes = new Set(db.sessions.map(s => s.c));
  return { term: db.term, updated: db.updated, sections: codes.size, rooms: new Set(db.sessions.map(s => `${s.b}:${s.r}`)).size,
    depts: Object.values(db.depts).map(d => d.name).sort((a, b) => a.localeCompare(b, 'tr')), sources: db.sources || [] };
}
export async function get() {
  await load();
  return { ...summary(), sessions: db.sessions, buildings: BUILDINGS, capture: captureState() };
}
