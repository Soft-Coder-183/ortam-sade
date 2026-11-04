// Ortam (ortam.etu.edu.tr) ayrıştırıcıları. Her fonksiyon okulun TEK bir sayfasını çeker ve JSON'a çevirir;
// arayüz yalnızca kullanıcının açtığı ekranın sayfasını ister (maske mantığı).
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import { getPage } from './session.mjs';

const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();

const load = async path => {
  const $ = cheerio.load(await getPage('ortam', path));
  $('script,style,svg').remove();
  return $;
};

// ---------- yardımcılar ----------

function tableRows($, table) {
  const heads = $(table).find('thead th').map((_, h) => txt($(h).text())).get();
  return $(table).find('tbody tr').map((_, tr) => {
    const cells = $(tr).find('th,td').map((_, td) => txt($(td).text())).get();
    return [Object.fromEntries(heads.map((h, i) => [h, cells[i] ?? '']))];
  }).get();
}

const cardTitle = ($, el) => txt($(el).closest('.card').find('.card-title').first().text());
const accessLimited = $ => /Erişim Sınırı/.test($('#kt_content').text());
const limitMessage = $ => (txt($('#kt_content').text()).match(/Erişim Sınırı\s*(.*?)\s*Bir sorun/) || [])[1] || 'Bu bölüm şu an kapalı.';

// Profil sayfalarının hepsinde bulunan kimlik kartı.
function identity($) {
  const lines = $('#kt_content').text().split('\n').map(txt).filter(Boolean);
  const at = lines.indexOf('Öğrenci Numarası:');
  const val = label => lines[lines.indexOf(label) + 1] ?? '';
  return {
    name: lines[at - 2], program: lines[at - 1], number: val('Öğrenci Numarası:'),
    email: val('E-posta:'), advisor: val('Danışman:'), advisorEmail: val('Danışman E-posta:'),
  };
}

// Başlık + tek tablo olan sade sayfalar için genel biçim.
async function simpleTable(path) {
  const $ = await load(path);
  const t = $('#kt_content table').first();
  const columns = t.find('thead th').map((_, h) => txt($(h).text())).get();
  const rows = tableRows($, t).map(r => columns.map(c => r[c]));
  const only = rows.length === 1 && rows[0].filter(Boolean).length === 1 ? rows[0].find(Boolean) : null;
  return { identity: identity($), title: cardTitle($, t), columns, rows: only ? [] : rows, note: only };
}

// ---------- Profil ----------

export async function bilgilerim() {
  const $ = await load('/bilgilerim');
  const info = [];
  $('#kt_content table tr').each((_, tr) => {
    const c = $(tr).find('td').map((_, td) => txt($(td).text())).get().filter(Boolean);
    if (c.length >= 2) info.push([c[0].replace(/\s*:$/, ''), c[1]]);
  });
  return { identity: identity($), title: cardTitle($, $('#kt_content table').first()), info };
}

export async function notlar() {
  const $ = await load('/bilgilerim/not-goruntuleme');
  const pane = sel => $(sel).find('table').map((_, t) => ({ term: cardTitle($, t), rows: tableRows($, t) })).get();
  const liste = pane('#home').map(t => ({ term: t.term, courses: t.rows.map(r => ({
    code: r['Ders Kodu'], name: r['Ders Adı'], type: r['Ders Türü'], branch: r['Dal Türü'], repeat: r['Tekrar Dersi'], grade: r['Harf Notu'] })) }));
  const donemlik = pane('#profile').map(t => ({ term: t.term, courses: t.rows.map(r => ({ code: r['Ders Kodu'], grade: r['Harf Notu'] })) }));
  // Dönem sonunda notlar ders değerlendirme anketi doldurulmadan gösterilmeyebilir: sayfa not yerine anket uyarısı/bağlantısı
  // verirse arayüz bunu gösterir ve anketi okulun sitesinde açar (anket uygulamada doldurulmaz).
  let survey = null;
  const body = txt($('#kt_content').text());
  if (/anket/i.test(body) && (!liste.length || $('#kt_content a[href*="nket"], #kt_content form[action*="nket"]').length)) {
    const a = $('#kt_content a[href*="nket"]').first();
    survey = { text: (body.match(/[^.]*anket[^.]*\./i) || [])[0]?.slice(0, 400) || 'Notları görmek için önce anketleri doldurman gerekiyor.',
      link: a.length ? new URL(a.attr('href'), 'https://ortam.etu.edu.tr').href : 'https://ortam.etu.edu.tr/bilgilerim/not-goruntuleme' };
  }
  return { identity: identity($), liste, donemlik, survey };
}

// Ortam ana sayfasındaki dönemsel kartlar (anketler, duyurular). Ders programı, ortalama, Zoom istatistiği gibi
// sabit kartlar atlanır; geri kalan her kart (ör. "Servis Hizmeti Değerlendirme Anketi") uygulamanın Ana Sayfasında
// "Ortam'da seni bekleyen" olarak gösterilir. Anket formları uygulamada doldurulmaz, Ortam'da açılır.
const HOME_FIXED = /^(Ortalama Değişimi|Yaklaşan Dersler|Ders Programı|Profilim)$|Kayıt Onayı|Zoom|Toplam Süre/i;
export async function notices() {
  const $ = await load('/');
  const out = [];
  $('#kt_content .container .card').each((_, c) => {
    const $c = $(c);
    if ($c.parents('.card').length) return;
    const title = txt($c.find('.card-header .card-title, .card-title, .card-label').first().text());
    if (!title || HOME_FIXED.test(title)) return;
    const survey = $c.find('form').length > 0 || /anket/i.test(title);
    const text = txt($c.find('.card-body p').first().text() || $c.find('.card-body').first().text()).slice(0, 300);
    out.push({ id: $c.attr('id') || title, title, kind: survey ? 'anket' : 'duyuru', text });
  });
  return { items: out, url: 'https://ortam.etu.edu.tr/' };
}

export async function mufredat() {
  const $ = await load('/bilgilerim/mufredat-goruntuleme');
  const terms = $('#kt_content table').map((_, t) => ({ term: cardTitle($, t), courses: tableRows($, t).map(r => {
    const [credit, ects] = (r['Kredi / ECTS'] || '').split('/').map(txt);
    return { code: r['Ders Kodu'], name: r['Ders Adı'], credit, ects, grade: r['Harf Notu'], status: r['Başarı Durumu'], elective: r['Secmeli Ders'] };
  }) })).get();
  return { identity: identity($), terms };
}

export const ortak = () => simpleTable('/bilgilerim/ortak-egitim-bilgilerim');
export const yabanciDil = () => simpleTable('/bilgilerim/ikinci-yabanci-dil-bilgilerim');
export const odeme = () => simpleTable('/bilgilerim/odeme-bilgilerim');

// ---------- Dönem ----------

// /derslerim: yalnızca ders listesi (tek sayfa). Ayrıntılar kullanıcı bir derse tıklayınca course() ile gelir.
export async function courses() {
  const $ = await load('/derslerim');
  const list = [];
  $('#kt_content a[href*="/derslerim/"]').each((_, a) => {
    const m = ($(a).attr('href') || '').match(/\/derslerim\/(\d+)$/);
    if (!m || list.some(c => c.id === m[1])) return;
    const code = txt($(a).text());
    list.push({ id: m[1], code, name: txt($(a).parent().text()).replace(code, '').trim() });
  });
  return { courses: list };
}

export async function course(id) {
  if (!/^\d+$/.test(id || '')) throw new Error('Geçersiz ders numarası');
  const $ = await load('/derslerim/' + id);
  const body = txt($('#kt_content').text());
  const num = re => (body.match(re) || [])[1];
  const mail = $('#kt_content a[href^="mailto:"]').first();
  return {
    id, section: num(/(\d+)\.\s*Şube/), credit: num(/Kredi\s*([\d.,]+)/), students: num(/Öğrenci Sayısı\s*(\d+)/),
    avgGno: num(/([\d.,]+)\s*Dersi Alan Öğrencilerin GNO/),
    instructor: txt(mail.parent().contents().first().text()), instructorEmail: txt(mail.text()),
    history: tableRows($, $('#kt_content table').first()),
  };
}

export async function schedule() {
  const $ = await load('/ders-programim');
  const t = $('#kt_content table').first();
  const days = t.find('thead th').slice(1).map((_, h) => txt($(h).text())).get();
  const slots = t.find('tbody tr').map((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => {
      const a = $(td).find('a').first();
      if (!a.length) return [null];
      const lines = a.html().split(/<br\s*\/?>/i).map(s => txt(cheerio.load(s).text()));
      const [name, ...rest] = (a.attr('title') || '').split(' - ');
      return [{ code: lines[0], room: (lines[1] || '').replace(/^Derslik\s*:\s*/, ''), name: txt(name),
        instructor: txt(rest.join(' - ')), inPerson: a.hasClass('btn-danger') }];
    }).get();
    return [{ time: txt($(tr).find('th').text()), cells }];
  }).get();
  return { days, slots };
}

// ---------- Sınav takvimi ----------

const EXAMS = [
  { kind: 'ara', label: 'Ara Sınav', path: '/ara-sinav-takvimim' },
  { kind: 'final', label: 'Final', path: '/final-takvimim' },
  { kind: 'butunleme', label: 'Bütünleme', path: '/butunleme-takvimim' },
];
// Açık olan sınav dönemi diske de yazılır: uygulama yeniden açılınca üç takvim sayfası yerine yalnızca o sayfa sorulur.
const STATE_FILE = '.cache/state.json';
let lastKind = (() => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).examKind ?? null; } catch { return null; } })();
function rememberKind(kind) {
  if (kind === lastKind) return;
  lastKind = kind;
  let s = {};
  try { s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  try { fs.writeFileSync(STATE_FILE, JSON.stringify({ ...s, examKind: kind })); } catch {}
}

async function tryExam(e) {
  const $ = await load(e.path);
  return !accessLimited($) && $('#kt_content table').length ? { e, $ } : null;
}

// Önce en son açık olan takvimi dener; kapalıysa diğerlerine bakar. Açık olanı döndürür.
export async function exams() {
  const order = [...EXAMS].sort((a, b) => (b.kind === lastKind) - (a.kind === lastKind));
  let open = null;
  if (lastKind) open = await tryExam(order[0]);
  if (!open) open = (await Promise.all(order.slice(lastKind ? 1 : 0).map(tryExam))).find(Boolean) ?? null;
  if (!open) { rememberKind(null); return { active: null, message: 'Şu an dönemi açık bir sınav takvimi yok.', exams: [] }; }
  const { e, $ } = open;
  rememberKind(e.kind);
  const t = $('#kt_content table').first();
  const stamps = t.find('tbody tr').map((_, tr) => Number($(tr).find('td[data-sort]').attr('data-sort')) || 0).get();
  const pick = (r, ...keys) => { const k = Object.keys(r).find(h => keys.some(x => h.includes(x))); return k ? r[k] : ''; };
  const list = tableRows($, t).map((r, i) => ({
    code: pick(r, 'Ders Kodu'), name: pick(r, 'Ders Adı'), dateText: pick(r, 'Tarih'), ts: stamps[i] * 1000,
    room: pick(r, 'Derslik'), start: pick(r, 'Başlangıç'), end: pick(r, 'Bitiş'), type: pick(r, 'Türü'), proctor: pick(r, 'Gözetmen'),
  })).sort((a, b) => a.ts - b.ts);
  return { active: { kind: e.kind, label: e.label }, exams: list };
}

// ---------- ÇAP / YAP ----------

export async function cap() {
  const $ = await load('/CAP-YAP-Basvurusu');
  if (accessLimited($)) return { active: false, message: limitMessage($) };
  const box = $('#kt_content .container').first();
  return { active: true, text: txt(box.text()) };
}

// ---------- Açılan dersler (Güz/Bahar Dönemi Ders Programı) ----------
// Sayfanın kendisi (GET) doğrulama istemez: dönemde açılan derslerin kodları ve öğretim elemanları listesi buradan gelir.
// Bir dersin şube/saat/derslik ayrıntısı Ortam'da yalnızca görünmez reCAPTCHA korumalı aramayla verilir; uygulama bu doğrulamayı
// aşmaz ve ayrı tarayıcı açmaz — bu yüzden ayrıntı alınmaz. Bölüm bazlı arama ve "hızlı dersler" bölümü de alınmaz.
const PROGRAM_PAGES = ['/Guz-Donemi-Ders-Programi', '/Bahar-Donemi-Ders-Programi', '/Yaz-Donemi-Ders-Programi'];
let programPath = PROGRAM_PAGES[0];

export async function offered() {
  let $ = null;
  for (const p of [programPath, ...PROGRAM_PAGES.filter(x => x !== programPath)]) {
    const page = await load(p).catch(() => null);
    if (page && page('select[name="courses[]"]').length) { $ = page; programPath = p; break; }
  }
  if (!$) return { active: false, message: 'Yayımlanmış bir dönem ders programı bulunamadı.', courses: [], academics: [] };
  if (accessLimited($)) return { active: false, message: limitMessage($), courses: [], academics: [] };
  const term = txt($('title').text()).replace(/\s*\|\s*/g, ' ').replace(/\s*Ders Programı.*$/i, '').replace(/\s*Dönemi$/i, '');
  const courses = $('select[name="courses[]"] option').map((_, o) => {
    const code = txt($(o).text());
    return /SINIF$/i.test(code) || !code ? [] : [{ id: $(o).attr('value'), code }];
  }).get();
  const academics = $('select[name="academic"] option').map((_, o) => txt($(o).text())).get().filter(Boolean);
  // Ders adları müfredattan (aynı oturum; sayfa önbellekte)
  const names = {};
  try { for (const t of (await mufredat()).terms) for (const c of t.courses) names[c.code] = c.name; } catch {}
  return { active: true, term, path: programPath, courses: courses.map(c => ({ ...c, name: names[c.code] || '' })), academics };
}

// ---------- Başvurular (ÇAP/YAP ve Dış İlişkiler hareketlilik formları) ----------
// Her sayfa: kapalıysa okulun mesajı; açıksa formun denetimleri (gerçek alanlar) ve başvuru listesi tabloları.
// Gönderim: formun kendi alanları + CSRF ile okulun adresine; form reCAPTCHA istiyorsa gönderim okulun sitesinde yapılır.
export const APPLY = {
  staj: { title: 'Staj Hareketliliği', form: '/dis-iliskiler/staj-hareketliligi-formu', list: '/basvurularim/staj-hareketliligi-basvurularim' },
  ogrenim: { title: 'Öğrenim Hareketliliği', form: '/dis-iliskiler/ogrenim-hareketliligi-formu', list: '/basvurularim/ogrenim-hareketliligi-basvurularim' },
  mezun: { title: 'Mezuniyet Sonrası Staj Hareketliliği', form: '/dis-iliskiler/mezuniyet-sonrasi-staj-hareketliligi-formu', list: '/basvurularim/mezuniyet-sonrasi-staj-hareketliligi-basvurularim' },
};
const FORM_PATHS = new Set(Object.values(APPLY).flatMap(a => [a.form, a.list]));
const rawForms = new Map();                      // yol -> son HTML (CSRF ve form alanları için)
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ortam'ın "Merhaba kullanıcı, …" / "Sayın …," hitabı: metnin başından atılır
const GREETING = /^(merhaba|sayın|selam)\b[^,.!:]{0,40}[,.!:]\s*/i;
const noGreeting = s => txt(s).replace(GREETING, '').replace(/^\p{Ll}/u, c => c.toLocaleUpperCase('tr'));

function maskPage($, path) {
  const box = $('#kt_content .card-body').length ? $('#kt_content .card-body') : $('#kt_content');
  box.find('*').filter((_, el) => !$(el).children().length && GREETING.test(txt($(el).text()))).each((_, el) => {
    const rest = noGreeting($(el).text());
    if (rest) $(el).text(rest); else $(el).remove();
  });
  box.find('script,style,svg,img,iframe,.subheader,.breadcrumb').remove();
  const captcha = box.find('.g-recaptcha,[data-sitekey]').length > 0;
  const hasFile = box.find('input[type=file]').length > 0;
  box.find('input[type=hidden]').remove();
  box.find('input[type=file]').each((_, el) => { $(el).replaceWith(`<span class="muted small">Dosya ekleme okulun sitesinde yapılır.</span>`); });
  box.find('button, input[type=submit]').each((_, el) => {
    const label = txt($(el).text() || $(el).attr('value')) || 'Gönder';
    $(el).replaceWith(`<button type="button" class="btn primary" data-o-submit="${escH(path)}">${escH(label)}</button>`);
  });
  box.find('input[name], select[name], textarea[name]').each((_, el) => {
    for (const a of Object.keys(el.attribs)) if (!/^(name|type|value|checked|selected|multiple|required|placeholder|rows)$/.test(a)) $(el).removeAttr(a);
  });
  box.find('option').each((_, el) => { for (const a of Object.keys(el.attribs)) if (!/^(value|selected)$/.test(a)) $(el).removeAttr(a); });
  box.find('*').not('input,select,textarea,option,button').each((_, el) => {
    for (const a of Object.keys(el.attribs || {})) if (!/^(colspan|rowspan|for|data-o-submit|class)$/.test(a) || (a === 'class' && !/^(btn|muted)/.test(el.attribs.class))) $(el).removeAttr(a);
  });
  box.find('a').each((_, a) => { $(a).replaceWith($(a).html() || ''); });
  return { html: (box.html() || '').replace(/>\s+</g, '> <').trim(), captcha, hasFile };
}

export async function applyPage(path) {
  if (!FORM_PATHS.has(path)) throw new Error('İzin verilmeyen sayfa');
  const html = await getPage('ortam', path);
  rawForms.set(path, html);
  const $ = cheerio.load(html);
  if (accessLimited($)) return { active: false, message: noGreeting(limitMessage($)), path };
  const title = txt($('title').text()).replace(/\s*\|.*$/, '');
  return { active: true, title, path, url: 'https://ortam.etu.edu.tr' + path, ...maskPage($, path) };
}

// Formu okula gönderir (iki tıklamalı onaydan sonra çağrılır). reCAPTCHA'lı formlar burada gönderilmez.
export async function applySubmit(path, fields = {}) {
  if (!FORM_PATHS.has(path)) throw new Error('İzin verilmeyen sayfa');
  const html = rawForms.get(path) ?? await getPage('ortam', path);
  const $ = cheerio.load(html);
  if (accessLimited($)) throw new Error(limitMessage($));
  const form = $('#kt_content form').first();
  if (!form.length) throw new Error('Bu sayfada form yok');
  if (form.find('.g-recaptcha,[data-sitekey]').length) throw new Error('Bu form doğrulama (reCAPTCHA) istiyor; okulun sitesinde gönderin');
  if (form.find('input[type=file]').length) throw new Error('Bu form dosya istiyor; okulun sitesinde gönderin');
  const data = new URLSearchParams();
  form.find('input[type=hidden][name]').each((_, el) => data.append(el.attribs.name, el.attribs.value ?? ''));
  const allowed = new Set(form.find('input[name],select[name],textarea[name]').map((_, el) => el.attribs.name).get());
  for (const [k, v] of Object.entries(fields)) if (allowed.has(k) && !data.has(k)) for (const x of [].concat(v)) if (x !== false && x != null) data.append(k, x === true ? 'on' : String(x));
  const action = new URL(form.attr('action') || path, 'https://ortam.etu.edu.tr' + path);
  if (action.origin !== 'https://ortam.etu.edu.tr') throw new Error('Beklenmeyen form adresi');
  const res = await getPage('ortam', action.pathname + action.search, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() });
  rawForms.delete(path);
  const $r = cheerio.load(res);
  const msg = txt($r('#kt_content .alert').first().text()) || 'Gönderildi; sonucu Başvurularım bölümünden kontrol edin.';
  return { ok: true, message: msg };
}
