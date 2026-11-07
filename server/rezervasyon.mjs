// Kütüphane grup çalışma odası ve müzik stüdyosu rezervasyonu (www.etu.edu.tr/tr/rezervasyon). Okulun sistemi giriş istemez;
// rezervasyonda öğrenci numarası ve şifre (Ortam şifresi), katılımcıların öğrenci numaraları istenir. Okulun sistemi gerekli görürse
// güvenlik kodu ister: kod görseli okulun sitesinden alınıp gösterilir, kodu kullanıcı yazar (çözülmez, atlatılmaz).
// Akış okulun sayfasıyla aynıdır: form denetimi (form-check) → önizleme → kullanıcının onayıyla kesinleştirme. Gönderimler yalnızca
// kullanıcının tıklamasıyla yapılır. Çerezler (okulun oturumu) yalnızca bellekte tutulur.
import * as cheerio from 'cheerio';
import * as credentials from './credentials.mjs';

const BASE = 'https://www.etu.edu.tr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
export const KINDS = { kutuphane: 'Kütüphane', 'muzik-studyosu': 'Müzik Stüdyosu' };
const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();
const jar = new Map();
const pages = new Map();          // tür -> { date, token, action, tip, slots: Set }
let preview = null;               // { action, fields } — önizlemedeki onay formu

async function req(path, { method = 'GET', body = null, headers = {} } = {}, hops = 0) {
  const r = await fetch(BASE + path, { method, body, redirect: 'manual',
    headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'User-Agent': UA, 'Accept-Language': 'tr', ...headers } });
  for (const line of r.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';'), i = pair.indexOf('=');
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  if (r.status >= 300 && r.status < 400 && hops < 5) {
    const u = new URL(r.headers.get('location') || '/', BASE + path);
    if (u.origin !== BASE) throw new Error('Okulun sitesi başka bir adrese yönlendirdi');
    return req(u.pathname + u.search, {}, hops + 1);
  }
  return r;
}

const checkKind = kind => { if (!KINDS[kind]) throw new Error('Bilinmeyen rezervasyon türü'); };
const checkDate = date => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Geçersiz tarih'); };

// Tarih için boş ve dolu saatler, kurallar ve en ileri tarih
export async function grid(kind, date) {
  checkKind(kind); checkDate(date);
  const r = await req(`/tr/rezervasyon/${kind}/${date}`);
  if (!r.ok) throw new Error(`Okulun sitesi yanıt vermedi (${r.status})`);
  const html = await r.text();
  const $ = cheerio.load(html);
  const form = $('#rezervasyon-form');
  if (!form.length) throw new Error('Rezervasyon sayfası okunamadı');
  const table = form.find('table').first();
  const rooms = table.find('tr').first().find('th').slice(1).map((_, th) => txt($(th).text())).get();
  const slots = new Set();
  const rows = table.find('tr').slice(1).map((_, tr) => {
    const tds = $(tr).find('td');
    return [{ time: txt(tds.first().text()), cells: tds.slice(1).map((_, td) => {
      const cb = $(td).find('input[type=checkbox]');
      if (!cb.length) return [null];
      const free = cb.attr('disabled') === undefined;
      if (free) slots.add(cb.attr('name'));
      return [{ slot: cb.attr('name'), free }];
    }).get() }];
  }).get();
  const boxes = form.find('.rezervasyon__katilimcilar');
  const info = boxes.filter((_, b) => !$(b).find('input').length).first();   // giriş ve katılımcı kutuları değil, açıklama
  pages.set(kind, { date, token: form.find('input[name=_token]').val(), action: form.attr('action'), tip: form.find('input[name=tip]').val() ?? null, slots });
  const max = Number((html.match(/ogrenciSayisi > (\d+)/) || [])[1]);
  return {
    kind, title: KINDS[kind], date, kinds: KINDS, rooms, rows,
    maxDate: (html.match(/maxDate:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] ?? date,
    notes: info.find('p').map((_, p) => txt($(p).text())).get().filter(Boolean),
    rulesTitle: txt(info.find('strong').first().text()),
    rules: info.find('li').map((_, li) => txt($(li).text())).get().filter(Boolean),
    maxPeople: Number.isFinite(max) ? max + 1 : null,
    url: `${BASE}/tr/rezervasyon/${kind}/${date}`,
  };
}

// Güvenlik kodu görseli (okulun sistemi istediğinde); kodu kullanıcı yazar
export async function captcha() {
  const r = await req('/tr/iletisim/captcha?' + Math.random());
  return { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png', name: 'kod.png' };
}

// Sayfadaki ana içerik metin satırları olarak (okulun HTML'i olduğu gibi gösterilmez)
function lines($, root) {
  const out = [];
  root.find('h1,h2,h3,h4,p,li,tr,dt,dd,.alert,strong').each((_, el) => {
    if ($(el).parents('form,script,style,nav,footer,header').length || $(el).find('p,li,tr').length) return;
    const t = txt($(el).text());
    if (t && !out.includes(t)) out.push(t);
  });
  return out.slice(0, 40);
}

// Form denetimi; uygunsa önizleme. Sonuç: { stage: 'captcha' | 'error' | 'preview', message?, lines?, canConfirm? }
export async function check({ kind, date, slot, studentNo, password, people = [], code = '' }) {
  checkKind(kind); checkDate(date);
  const p = pages.get(kind);
  if (!p || p.date !== date) throw new Error('Sayfa yenilendi, saati yeniden seç.');
  if (!p.slots.has(slot)) throw new Error('Bu saat artık boş değil, başka bir saat seç.');
  if (!/^\d{5,12}$/.test(String(studentNo || ''))) throw new Error('Öğrenci numaranı yaz.');
  const pass = password || credentials.passwordFor(credentials.get(), 'ortam');
  if (!pass) throw new Error('Şifre yok: şifreni yaz ya da Hesap sayfasından giriş bilgilerini kaydet.');
  const list = people.map(x => String(x).trim()).filter(Boolean);
  if (list.some(x => !/^\d{5,12}$/.test(x))) throw new Error('Katılımcıların öğrenci numaralarını kontrol et.');
  const body = new URLSearchParams();
  body.set('_token', p.token);
  if (p.tip) body.set('tip', p.tip);
  body.set(slot, 'on');
  body.set('ogrenci_no', String(studentNo));
  body.set('ogrenci_sifre', pass);
  if (code) body.set('captcha', String(code).trim());
  for (const x of list) body.append('ogrenci[]', x);
  const form = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
  const answer = txt(await (await req('/tr/rezervasyon/form-check', { method: 'POST', body: body.toString(), headers: { ...form, 'X-Requested-With': 'XMLHttpRequest' } })).text());
  if (answer !== 'Ok') {
    if (answer.startsWith('captcha|')) return { stage: 'captcha', message: answer.slice(8) };
    return { stage: 'error', message: answer.slice(0, 400) || 'Okulun sistemi rezervasyonu kabul etmedi.' };
  }
  const r = await req(p.action.replace(BASE, ''), { method: 'POST', body: body.toString(), headers: form });
  const $ = cheerio.load(await r.text());
  const root = $('main').length ? $('main') : $('body');
  const confirm = root.find('form').filter((_, f) => !/\/ara\b/.test($(f).attr('action') || '')).first();
  preview = confirm.length ? { action: new URL(confirm.attr('action') || '', BASE + p.action).pathname,
    fields: confirm.find('input[name]').map((_, i) => [[$(i).attr('name'), $(i).attr('value') ?? '']]).get() } : null;
  return { stage: 'preview', lines: lines($, root), canConfirm: !!preview };
}

// Önizlemedeki onay formu gönderilir (yalnızca kullanıcı onaylayınca)
export async function confirm() {
  if (!preview) throw new Error('Onaylanacak rezervasyon yok.');
  const { action, fields } = preview;
  preview = null;
  const r = await req(action, { method: 'POST', body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  const $ = cheerio.load(await r.text());
  return { stage: 'done', ok: r.ok, lines: lines($, $('main').length ? $('main') : $('body')) };
}
