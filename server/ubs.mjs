// UBS (ubs.etu.edu.tr, Unipa) maskesi.
// - Ana sayfa: menü (Özgeçmiş Girişi hariç), duyurular, mesaj sayısı.
// - Menü sayfaları okunur bir yapıya çevrilir: "Etiket : değer" satırları bilgi listesine, ızgaralar düz tablolara,
//   alan grupları bölümlere, sekmeli sayfalar sekmelere. Formlar (ör. Konuk Evi başvurusu) gerçek denetimlerle gelir;
//   düğmeye basılınca sayfanın kendi geri gönderimi (postback) yapılır.
// - Transkript ayrıca ayrıştırılır (dönemler, notlar, YANO/GANO). Ders Kayıtlanma kapalıyken okulun mesajı gösterilir.
// - PDF: her sayfa ve transkript kendi şablonumuzla PDF'e çevrilir (Türkçe karakterler ve düzen sorunsuz).
import * as cheerio from 'cheerio';
import { getPage, getFile, rawFetch, fileName, ExternalRedirect } from './session.mjs';
import { htmlToPdf } from './pdf.mjs';

const BASE = 'https://ubs.etu.edu.tr';
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HIDDEN_MENU = /^\/ozgecmis\//i;           // kullanıcı istemedi: Özgeçmiş Girişi

export async function home() {
  const [h, d] = await Promise.all([getPage('ubs', '/'), getPage('ubs', '/UniFrame/ProjeDuyuru.Receive/default.aspx')]);
  const $ = cheerio.load(h);
  const groups = new Map();
  $('span.file[menuurl]').each((_, el) => {
    const path = $(el).attr('menuurl');
    if (HIDDEN_MENU.test(path || '')) return;
    const group = txt($(el).closest('ul').closest('li').children('span.folder').text()) || 'Öğrenci';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ name: txt($(el).attr('menuname')), path });
  });
  const $d = cheerio.load(d);
  const announcements = $d('tr[id*=duyuruitem]').map((_, tr) => txt($d(tr).text())).get().filter(Boolean);
  return {
    name: txt($('#ctl00_DashAppHeader_ctl02_lblUserName').text()),
    unread: Number((txt($('body').text()).match(/(\d+)\s*okunmamış mesaj/) || [])[1] ?? 0),
    announcements,
    // Menüdeki tek başına öğeler önce, klasörler sonra
    menu: [...groups].map(([group, items]) => ({ group, items })).sort((a, b) => (b.group === 'Öğrenci') - (a.group === 'Öğrenci')),
  };
}

const ALLOWED = /^\/(Ogrenci|OrtakEgitim|Yurt|Messaging|UniFrame)\/[\w./-]+\.aspx(\?lang=tr-TR)?$/i;
const checkPath = path => { if (!ALLOWED.test(path || '')) throw new Error('İzin verilmeyen UBS sayfası'); };
const raw = new Map();                         // yol -> sayfanın son HTML'i (geri gönderim için __VIEWSTATE vb. buradan)

// ---------- sayfa: okunur yapıya çevirme ----------

const PRIVATE = /TC Kimlik|Adres|Cep No|Telefon|GSM/i;  // kişisel bilgiler gösterilmez (Ortam profilinde de kaldırıldı)
const PAY = /öde|ödeme|kredi kartı/i;                    // ödeme düğmeleri maskeye alınmaz

// Bir satırdaki "Etiket : değer" çiftleri. Etiket ":" ile biter ya da sonraki hücre ":"; değer sonraki etikete kadar.
function kvRow($, tr) {
  const cells = $(tr).children('td,th').toArray();
  const text = cells.map(c => txt($(c).text()));
  const labels = [];
  for (let i = 0; i < cells.length; i++) {
    if (text[i + 1] === ':' && text[i] && text[i] !== ':') labels.push({ i, label: text[i], from: i + 2 });
    else if (/^[^:]{1,60}:$/.test(text[i])) labels.push({ i, label: text[i].replace(/\s*:$/, ''), from: i + 1 });
  }
  if (!labels.length) return null;
  const notes = text.slice(0, labels[0].i).filter(Boolean);
  const pairs = labels.map((l, k) => {
    const end = k + 1 < labels.length ? labels[k + 1].i : cells.length;
    const parts = cells.slice(l.from, end).filter((c, j) => text[l.from + j] && text[l.from + j] !== ':' || $(c).find('select,input,textarea').length);
    return { label: l.label, html: parts.map(c => $(c).html()).join(' ') };
  });
  return { notes, pairs };
}

function toKv($, table) {
  const rows = $(table).children('tbody').length ? $(table).children('tbody').children('tr') : $(table).children('tr');
  const out = [];
  let kvRows = 0, other = 0;
  rows.each((_, tr) => {
    if (!txt($(tr).text()) && !$(tr).find('select,input,textarea').length) return;
    const r = kvRow($, tr);
    if (r) { kvRows++; out.push(r); } else other++;
  });
  if (!kvRows || other > kvRows) return false;
  const html = out.map(r => r.notes.map(n => `<p class="u-note">${esc(n)}</p>`).join('') +
    r.pairs.map(p => `<div><dt>${esc(p.label)}</dt><dd>${txt(cheerio.load(p.html || '', null, false).text()) || /<(select|input|textarea)/.test(p.html) ? p.html : '—'}</dd></div>`).join('')).join('');
  $(table).replaceWith(`<dl class="u-kv">${html}</dl>`);
  return true;
}

// Metindeki "anahtar{ … }" nesnesi (iç içe süslü parantezler dengelenerek); Telerik $create ayarları için.
function objectAfter(s, key) {
  const at = s.indexOf(key);
  if (at < 0) return null;
  const start = s.indexOf('{', at);
  let depth = 0, inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

// Telerik RadGrid -> düz tablo (sıralama/sayfalama/süzme araçları olmadan).
function toGrid($, grid) {
  const g = $(grid);
  const heads = g.find('thead tr').not('.rgFilterRow,.rgPager,.rgCommandRow').last().children('th')
    .map((_, th) => txt($(th).text())).get();
  const rows = g.find('tbody tr.rgRow, tbody tr.rgAltRow').map((_, tr) =>
    `<tr>${$(tr).children('td').map((_, td) => `<td>${$(td).html()}</td>`).get().join('')}</tr>`).get();
  const keep = heads.map((h, i) => h || rows.some(r => cheerio.load(`<table>${r}</table>`)('td').eq(i).text().trim()));
  const hi = heads.map((h, i) => (keep[i] ? `<th>${esc(h)}</th>` : '')).join('');
  const body = rows.map(r => {
    const $r = cheerio.load(`<table>${r}</table>`);
    $r('td').each((i, td) => { if (!keep[i]) $r(td).remove(); });
    return $r('tr').toString();
  }).join('');
  g.replaceWith(rows.length ? `<div class="u-scroll"><table class="u-grid"><thead><tr>${hi}</tr></thead><tbody>${body}</tbody></table></div>`
    : '<p class="muted">Kayıt yok.</p>');
}

// Form denetimleri: görünür ve etkin olanlar gerçek denetim olarak kalır, diğerleri metne döner.
function controls($) {
  const doPostBack = s => (/__doPostBack\(\\?'([^'\\]+)\\?',\s*\\?'([^'\\]*)\\?'\)/.exec(s || '') || []).slice(1);
  $('select[name]').each((_, el) => {
    const s = $(el);
    const opts = s.find('option');
    const sel = opts.filter('[selected]').first().length ? opts.filter('[selected]').first() : opts.first();
    if (s.attr('disabled') !== undefined) return void s.replaceWith(`<b>${esc(txt(sel.text()))}</b>`);
    const [auto] = doPostBack(s.attr('onchange'));
    s.replaceWith(`<select name="${esc(s.attr('name'))}"${auto ? ` data-u-auto="${esc(auto)}"` : ''}>${opts.map((_, o) =>
      `<option value="${esc($(o).attr('value') ?? $(o).text())}"${$(o).is(sel) ? ' selected' : ''}>${esc(txt($(o).text()))}</option>`).get().join('')}</select>`);
  });
  $('input[name]').each((_, el) => {
    const i = $(el);
    const type = (i.attr('type') || 'text').toLowerCase();
    const name = i.attr('name');
    if (type === 'hidden' || type === 'image' || /ClientState$/.test(name)) return void i.remove();
    if (type === 'submit' || type === 'button') {
      const label = txt(i.attr('value'));
      if (!label || PAY.test(label) || i.attr('disabled') !== undefined) return void i.remove();
      // Telerik düğmesinde onay sorusu dıştaki bağlantıdadır; düz düğmeler __doPostBack ile de gönderebilir
      const wrap = i.closest('a.RadButton, .RadButton');
      const js = `${i.attr('onclick') || ''} ${wrap.attr('href') || ''} ${wrap.attr('onclick') || ''}`;
      const confirm = (/confirm\(\s*'([^']+)'/.exec(js) || [])[1];
      const [pbTarget, pbArg] = doPostBack(i.attr('onclick'));
      const how = pbTarget ? `data-u-target="${esc(pbTarget)}" data-u-arg="${esc(pbArg ?? '')}"` : `data-u-submit="${esc(name)}"`;
      return void (wrap.length ? wrap : i).replaceWith(`<button type="button" class="btn" ${how}${
        confirm ? ` data-u-confirm="${esc(confirm)}"` : ''}>${esc(label)}</button>`);
    }
    const disabled = i.attr('disabled') !== undefined || i.attr('readonly') !== undefined;
    if (type === 'checkbox' || type === 'radio') {
      const id = i.attr('id');
      const lab = id ? $(`label[for="${id}"]`) : $();
      const text = txt(lab.text());
      lab.remove();
      const [auto] = doPostBack(i.attr('onclick'));
      return void i.replaceWith(`<label class="u-check"><input type="${type}" name="${esc(name)}" value="${esc(i.attr('value') ?? 'on')}"${
        i.attr('checked') !== undefined ? ' checked' : ''}${disabled ? ' disabled' : ''}${auto ? ` data-u-auto="${esc(auto)}"` : ''}> ${esc(text)}</label>`);
    }
    if (disabled || $(el).closest('.RadComboBox,.RadPicker').length) return;   // açılır kutular aşağıda metne döner
    i.replaceWith(`<input type="text" name="${esc(name)}" value="${esc(i.attr('value') ?? '')}">`);
  });
  $('textarea[name]').each((_, el) => {
    const t = $(el);
    if (t.attr('disabled') !== undefined || t.attr('readonly') !== undefined) return void t.replaceWith(`<div>${esc(t.text())}</div>`);
    t.replaceWith(`<textarea name="${esc(t.attr('name'))}" rows="4">${esc(t.text())}</textarea>`);
  });
  // Bağlantı biçimindeki geri gönderimler (tablo başlıklarındaki sıralama bağlantıları hariç)
  $('a').each((_, el) => {
    const a = $(el);
    const [target, arg] = doPostBack(a.attr('href') || a.attr('onclick'));
    const label = txt(a.text());
    if (target && label && !a.closest('th, .rgHeader, thead').length && !PAY.test(label))
      a.replaceWith(`<button type="button" class="btn" data-u-target="${esc(target)}" data-u-arg="${esc(arg ?? '')}">${esc(label)}</button>`);
  });
}

// Sayfanın gösterilecek hali: { title, html, tabs: [{ title, html }], interactive }
export function render(html, path) {
  const $ = cheerio.load(html);
  const title = txt($('title').text());
  const printable = $('#btnBelgeYazdir, input[onclick*="window.print"]').length > 0;
  $('script,style,link,meta,noscript,iframe,img,[id*=indowManager],.appheaderpopup,[id*=RadToolTip],[id*=Tooltip],[id^=AppHeader]').remove();
  $('.RadComboBoxDropDown,.rcbSlide,.RadMenu_Context,[id$=_rfltMenu],.RadCalendar,.RadCalendarPopup,.rgGroupPanel,[id$=_GroupPanel],.RadUpload,.RadAsyncUpload,.ruFileWrap').remove();

  // Kişisel bilgiler
  $('tr').filter((_, tr) => !$(tr).find('tr').length && PRIVATE.test($(tr).text())).remove();
  $('[id*=AdresBilgileri],[id*=IletisimBilgileri]').remove();
  $('fieldset').filter((_, f) => /^(Adres|İletişim)\s*Bilgileri/i.test(txt($(f).children('legend').text()))).remove();

  // Sayfa adı + sayfa kodu satırı ("Başarı Durum Belgesi (Transkript) OGR.0204-01"): başlık zaten üstte
  $('span').filter((_, el) => /^([A-Z]{2,6}\.)?\d{4}-\d{2}$/.test(txt($(el).text()))).remove();
  $('span').filter((_, el) => txt($(el).text()) === title).first().each((_, el) => {
    const t = $(el).closest('table');
    (t.length && txt(t.text()) === title ? t : $(el)).remove();
  });

  // Açılır pencere kalıntıları ("×" kapatma düğmesi, "Modal Header" başlığı)
  $('*').filter((_, el) => !$(el).children().length && /^(×|Modal Header)$/.test(txt($(el).text()))).remove();

  // Sekmeli sayfa (RadTabStrip + RadMultiPage): her sekmenin içeriği ayrı tutulur
  const strip = objectAfter(html, 'Telerik.Web.UI.RadTabStrip,');
  if (strip) {
    try {
      const cfg = JSON.parse(strip);
      const titles = $('.RadTabStrip .rtsTxt').map((_, x) => txt($(x).text())).get();
      (cfg.tabData || []).forEach((t, i) => {
        const view = $(`#${t._implPageViewID}`);
        if (view.length) view.wrap(`<u-tab data-title="${esc(titles[i] || `Sekme ${i + 1}`)}"></u-tab>`);
      });
    } catch {}
  }
  $('.RadTabStrip').remove();

  // Açılır kutu, tarih ve sayı kutuları (Telerik): seçili/girili değer metin olarak
  $('.RadComboBox,.RadPicker,.RadInput,.riSingle').each((_, el) => {
    const v = txt($(el).find('input.rcbInput, input.riTextBox, input[type=text]').first().attr('value'));
    $(el).replaceWith(v ? `<b>${esc(v)}</b>` : '');
  });
  $('input').filter((_, el) => /display:\s*none|visibility:\s*hidden/i.test($(el).attr('style') || '')).remove();
  $('.RadGrid').each((_, g) => toGrid($, g));
  controls($);
  $('fieldset').each((_, f) => {
    const legend = txt($(f).children('legend').text());
    $(f).children('legend').remove();
    $(f).replaceWith(`<section class="u-sec">${legend ? `<h3>${esc(legend)}</h3>` : ''}${$(f).html()}</section>`);
  });
  // İç içe olmayan tablolar: "Etiket : değer" düzenindeyse bilgi listesine (önce boş kalan tablolar atılır)
  for (let i = 0; i < 3; i++) $('table').filter((_, t) => !txt($(t).text()) && !$(t).find('select,input,textarea,button').length).remove();
  for (let pass = 0; pass < 3; pass++)
    $('table').not('.u-grid').filter((_, t) => !$(t).find('table').length).each((_, t) => { toKv($, t); });
  // Bootstrap düzeni: iki çocuklu satırlar, ilki "Etiket:" ise bilgi satırı
  $('div').filter((_, d) => { const k = $(d).children(); return k.length === 2 && /^[^:]{1,60}:$/.test(txt(k.eq(0).text())); }).each((_, d) => {
    const k = $(d).children();
    $(d).replaceWith(`<dl class="u-kv"><div><dt>${esc(txt(k.eq(0).text()).replace(/\s*:$/, ''))}</dt><dd>${k.eq(1).html()}</dd></div></dl>`);
  });
  $('*').contents().filter((_, n) => n.type === 'comment').remove();
  // Okulun çok sütunlu düzen tabloları (içinde liste/bölüm/tablo olan) düz bloklara açılır; dar sütunlara sıkışma olmaz
  for (let pass = 0; pass < 4; pass++) {
    $('table').not('.u-grid').filter((_, t) => $(t).find('dl,section,table,h3,button,select,textarea').length > 0).each((_, t) => {
      const blocks = $(t).find('td,th').filter((_, c) => !$(c).parentsUntil(t, 'td,th').length).map((_, c) => $(c).html()).get();
      $(t).replaceWith(`<div class="u-flow">${blocks.map(b => `<div>${b}</div>`).join('')}</div>`);
    });
  }
  // Yan yana bilgi listeleri tek listede; içinde form denetimi olan liste tek sütun (form düzeni)
  $('dl.u-kv').each((_, dl) => {
    let next = $(dl).next();
    while (next.is('dl.u-kv')) { $(dl).append(next.children()); const n = next.next(); next.remove(); next = n; }
  });
  $('dl.u-kv').filter((_, dl) => $(dl).find('select,input,textarea,button').length > 0).addClass('u-form');

  // Öznitelikler: yalnızca bizim eklediklerimiz ve denetimlerin gerekli öznitelikleri kalır
  const KEEP = /^(colspan|rowspan|name|value|type|checked|selected|disabled|rows|data-u-[\w-]+|data-title)$/;
  $('*').each((_, el) => {
    for (const a of Object.keys(el.attribs || {})) {
      if (a === 'class' && /^(u-[\w-]+|btn|muted)( |$)/.test(el.attribs.class)) continue;
      if (!KEEP.test(a)) $(el).removeAttr(a);
    }
  });
  $('a').each((_, a) => { $(a).replaceWith($(a).html() ?? ''); });
  // Yalnızca başlık satırı kalan tablolar (kayıt olmayan liste): "Kayıt yok."
  $('table').not('.u-grid').filter((_, t) => $(t).find('tr').length === 1 && $(t).find('td,th').length >= 3 && !$(t).find('select,input,textarea,button').length)
    .each((_, t) => { $(t).replaceWith('<p class="muted">Kayıt yok.</p>'); });
  $('.rgNoRecords td, td').each((_, td) => { if (/^No records to display\.?$/i.test(txt($(td).text()))) $(td).text('Kayıt yok.'); });
  const hasCtl = el => $(el).find('select,input,textarea,button').length > 0;
  for (let i = 0; i < 4; i++) $('div,span,tr,table,p,section,dl,u-tab').filter((_, el) => !txt($(el).text()) && !hasCtl(el)).remove();

  const squeeze = h => (h || '').replace(/>\s+</g, '> <').trim();
  const tabs = $('u-tab').map((_, t) => ({ title: $(t).attr('data-title'), html: squeeze($(t).html()) })).get()
    .filter(x => { const t = txt(cheerio.load(x.html, null, false).text()); return t && t !== x.title; });   // boş kalan sekmeler (ör. gizlenen Adres) çıkar
  $('u-tab').remove();
  const root = $('form').first().length ? $('form').first() : $('body');
  const out = squeeze(root.html());
  const interactive = /data-u-(submit|target|auto)/.test(out + tabs.map(t => t.html).join(''));
  return { kind: 'page', title, html: out, tabs, interactive, printable, path };
}

// Bazı menü öğeleri (ör. Müfredat) sayfa yerine doğrudan PDF döndürür: o zaman arayüz görüntüleyiciyi açar.
const pdfs = new Map();                        // yol -> { body, name, t } (kısa süre saklanır; görüntüleyici aynısını ister)
export async function page(path) {
  checkPath(path);
  if (/\/Ogr0249\//i.test(path)) return registration(path);
  let r;
  try { r = await getFile('ubs', path); }
  catch (e) { if (e instanceof ExternalRedirect) return { kind: 'external', external: e.url, host: new URL(e.url).host }; throw e; }
  if (/pdf/i.test(r.type) || r.body.subarray(0, 5).toString('latin1') === '%PDF-') {
    const name = fileName(r.disposition, 'UBS.pdf').replace(/\.PDF$/, '.pdf');
    pdfs.set(path, { body: r.body, name, t: Date.now() });
    return { kind: 'pdf', title: name.replace(/\.pdf$/i, ''), name, path };
  }
  const html = r.body.toString('utf8');
  raw.set(path, html);
  if (/\/Ogr0204\//i.test(path)) return transcript(html);
  return render(html, path);
}

// ---------- geri gönderim (form düğmeleri, otomatik gönderilen seçimler) ----------

// ASP.NET formunun tarayıcının göndereceği alanları (düğmeler hariç).
function formFields($, form) {
  const f = new URLSearchParams();
  form.find('input[name]').each((_, el) => {
    const t = (el.attribs.type || 'text').toLowerCase();
    if (['submit', 'button', 'image', 'file', 'reset'].includes(t)) return;
    if ((t === 'checkbox' || t === 'radio') && el.attribs.checked === undefined) return;
    f.append(el.attribs.name, el.attribs.value ?? '');
  });
  form.find('select[name]').each((_, el) => {
    const o = $(el).find('option[selected]').first().length ? $(el).find('option[selected]').first() : $(el).find('option').first();
    if (o.length) f.append(el.attribs.name, o.attr('value') ?? o.text());
  });
  form.find('textarea[name]').each((_, el) => f.append(el.attribs.name, $(el).text()));
  return f;
}

// Geri gönderimden sonra sayfanın gösterdiği uyarı kutuları (radalert). Mesaj etiketleri zaten sayfa içeriğinde.
function messages(html) {
  const out = [];
  for (const m of html.matchAll(/radalert\(\s*(['"])((?:(?!\1).){2,400})\1/g)) out.push(txt(m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')));
  return [...new Set(out)].filter(m => !/^\{\d\}$|##LOC/.test(m));
}

// { target, argument } bağlantı/otomatik gönderim, { submit } düğme; fields: kullanıcının denetimlerdeki değerleri.
export async function postback(path, { target = '', argument = '', submit = '', fields = {} } = {}) {
  checkPath(path);
  const html = raw.get(path) ?? await getPage('ubs', path);
  const $ = cheerio.load(html);
  const form = $('form').first();
  const data = formFields($, form);
  // Yalnızca sayfada görünür ve etkin olan denetimlerin değeri kullanıcıdan alınır
  const editable = new Map();
  form.find('input[name],select[name],textarea[name]').each((_, el) => {
    const type = (el.attribs.type || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'file'].includes(type) || el.attribs.disabled !== undefined) return;
    editable.set(el.attribs.name, type);
  });
  for (const [name, value] of Object.entries(fields)) {
    const type = editable.get(name);
    if (!type) continue;
    if (type === 'checkbox') { data.delete(name); if (value) data.append(name, typeof value === 'string' ? value : 'on'); }
    else data.set(name, String(value));
  }
  const refs = new Set([...html.matchAll(/__doPostBack\(\\?'([^'\\]+)\\?'/g)].map(m => m[1]));
  if (target && !refs.has(target) && !editable.has(target)) throw new Error('Bu sayfada böyle bir işlem yok');
  data.set('__EVENTTARGET', target);
  data.set('__EVENTARGUMENT', argument);
  if (submit) {
    const btn = form.find('input').filter((_, el) => el.attribs.name === submit && /^(submit|button)$/i.test(el.attribs.type || ''));
    if (!btn.length) throw new Error('Bu sayfada böyle bir düğme yok');
    data.set(submit, btn.attr('value') ?? '');
  }
  const action = new URL(form.attr('action') || path, BASE + path);
  if (action.origin !== BASE) throw new Error('Beklenmeyen form adresi');
  const r = await getFile('ubs', action.pathname + action.search, { method: 'POST', headers: FORM, body: data.toString() });
  // Bazı düğmeler (ör. Hazırlık Yeterlilik Belgesi) sayfa yerine dosya döndürür: geçici olarak saklanır, arayüz açar
  if (!/text\/html/i.test(r.type)) {
    const id = Math.random().toString(36).slice(2);
    temp.set(id, { body: r.body, type: /pdf/i.test(r.type) ? 'application/pdf' : r.type.split(';')[0], name: fileName(r.disposition, 'UBS-belge') });
    setTimeout(() => temp.delete(id), 10 * 60_000);
    return { kind: 'file', file: { id, name: temp.get(id).name, type: temp.get(id).type } };
  }
  const res = r.body.toString('utf8');
  raw.set(path, res);
  const model = /\/Ogr0204\//i.test(path) ? transcript(res) : render(res, path);
  return { ...model, messages: messages(res) };
}

const temp = new Map();                        // geri gönderimin döndürdüğü dosyalar (10 dk)
export function tempFile(id) {
  const f = temp.get(id || '');
  if (!f) throw new Error('Dosyanın süresi doldu; düğmeye yeniden basın');
  return f;
}

// ---------- Ders Kayıtlanma ----------
// Sayfa ayrı bir (Angular) uygulamadır; açılınca obs.etu.edu.tr'deki servise "kayıtlanma kontrolleri" sorulur.
// Aynı kontrol (yalnızca okuma) burada yapılır: kapalıysa okulun mesajı, açıksa sayfayı yeni sekmede açma bağlantısı.
async function registration(path) {
  const r = await rawFetch('ubs', path);
  const oturumNo = (/oturumNo=([\w-]+)/.exec(r.location || '') || [])[1];
  if (!oturumNo) { await getPage('ubs', path); throw new Error('Ders kayıtlanma sayfası açılamadı'); }   // oturum kapalıysa getPage girişe yönlendirir
  const res = await fetch('https://obs.etu.edu.tr/Services/DersKayitlanma/DersKayitlanmaSrvc.asmx/KayitlanmaKontrolleriYap', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Origin: BASE, Referer: BASE + '/' },
    body: new URLSearchParams({ oturumNo }).toString() });
  const body = (/<string[^>]*>([\s\S]*)<\/string>/.exec(await res.text()) || [])[1] || '';
  const j = JSON.parse(cheerio.load(`<x>${body}</x>`, null, false)('x').text() || '{}');
  const url = `${BASE}${path.split('?')[0]}?oturumNo=${oturumNo}`;
  return { kind: 'notice', title: 'Ders Kayıtlanma', open: !!j.IsSuccess,
    message: txt(j.Message) || (j.IsSuccess ? 'Ders kayıtlanma açık.' : 'Ders kayıtlanma şu an kapalı.'), url: j.IsSuccess ? url : null };
}

// ---------- Transkript ----------

const COURSE = /^[A-ZÇĞİÖŞÜ]{2,4}\s?\d{3}[A-Z]?$/;
export function transcript(html) {
  const $ = cheerio.load(html);
  const t = s => txt(s);
  const kv = new Map();
  $('table.tdRight tr').filter((_, tr) => !$(tr).find('tr').length).each((_, tr) => {
    kvRow($, tr)?.pairs.forEach(p => { if (!PRIVATE.test(p.label)) kv.set(p.label, t(cheerio.load(p.html || '', null, false).text())); });
  });
  // Belgedeki iki sütunlu düzen yerine okunur sıra; Adı + Soyadı tek satır
  const info = [['Ad Soyad', [kv.get('Adı'), kv.get('Soyadı')].filter(Boolean).join(' ')]];
  for (const k of ['Öğrenci No', 'Fakülte', 'Bölüm', 'Eğitim Düzeyi', 'Kayıt Tarihi', 'Mezuniyet Tarihi']) if (kv.get(k)) info.push([k, kv.get(k)]);
  for (const [k, v] of kv) if (!['Adı', 'Soyadı'].includes(k) && !info.some(x => x[0] === k) && v) info.push([k, v]);
  const date = (t($('[id*=pnlTranscript]').text()).match(/Tarih\s*:\s*([\d.]+)/) || [])[1] || '';
  // En içteki satırların hücreleri; "2 | 2" gibi kredi | AKTS hücreleri ikiye ayrılır.
  const cellsOf = tr => $(tr).children('td').map((_, td) => t($(td).text()).split(/\s*\|\s*/)).get();
  const leafRows = el => $(el).find('tr').filter((_, tr) => !$(tr).find('tr').length).toArray();
  const prep = leafRows($('[id$=tblHazirlik]')).map(tr => $(tr).children('td').map((_, td) => t($(td).text())).get())
    .filter(c => COURSE.test(c[0] || '')).map(c => ({ code: c[0], name: c[1], score: c[2], grade: c[3], status: c[4] }));
  const terms = $('[id*=rptSemesters][id$=tblSemester]').map((_, sem) => {
    const s = $(sem);
    const name = (t(s.text()).match(/\d{4}\s*-\s*\d{4}\s+(Güz|Bahar|Yaz)/) || [])[0] || '';
    const sum = {};
    const courses = [];
    for (const tr of leafRows(s)) {
      const c = cellsOf(tr);
      if (COURSE.test(c[0] || '')) { courses.push({ code: c[0], name: c[1], credit: c[2], ects: c[3], grade: c[4] || '', note: c[5] || '' }); continue; }
      if (/^Alınan Ders Sayısı/.test(c[0] || '')) sum.count = (c[0].match(/\d+/) || [])[0];
      const key = /^Yarıyıl/.test(c[0] || '') ? 'term' : /^Birikimli/.test(c[0] || '') ? 'total' : null;
      if (key) sum[key] = { credit: c[1], ects: c[2], doneCredit: c[3], doneEcts: c[4], points: c[5], yano: c[6], gano: c[7] };
    }
    return [{ name, courses, ...sum }];
  }).get();
  const last = [...terms].reverse().find(x => x.total && x.total.gano && x.total.gano !== '-' && x.total.gano !== '0,00');
  return { kind: 'transcript', title: 'Başarı Durum Belgesi (Transkript)', date, info, prep, terms,
    gano: last?.total.gano || '', totals: terms.at(-1)?.total || null };
}

// ---------- PDF ----------

const gradeClass = g => (/^(AA|BA|BB)$/.test(g) ? 'g-a' : /^(FF|FD|DZ|U|NA)$/.test(g) ? 'g-f' : '');

function transcriptHtml(tr) {
  const info = `<dl class="kv">${tr.info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>`;
  const head = `<div class="summary"><div><span>GANO</span><b>${esc(tr.gano || '—')}</b></div>${tr.totals ? `
    <div><span>Alınan kredi / AKTS</span><b>${esc(tr.totals.credit)} / ${esc(tr.totals.ects)}</b></div>
    <div><span>Tamamlanan kredi / AKTS</span><b>${esc(tr.totals.doneCredit)} / ${esc(tr.totals.doneEcts)}</b></div>` : ''}</div>`;
  const prep = tr.prep.length ? `<h2>Hazırlık</h2><table><thead><tr><th>Kod</th><th>Ders</th><th>Puan</th><th>Not</th><th>Durum</th></tr></thead><tbody>${
    tr.prep.map(p => `<tr><td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.score)}</td><td>${esc(p.grade)}</td><td>${esc(p.status)}</td></tr>`).join('')}</tbody></table>` : '';
  const terms = tr.terms.map(s => `<section class="term"><h2>${esc(s.name)}</h2><table><thead><tr><th>Kod</th><th>Ders</th><th class="n">Kredi</th><th class="n">AKTS</th><th>Not</th><th>Açıklama</th></tr></thead><tbody>${
    s.courses.map(c => `<tr><td class="code">${esc(c.code)}</td><td>${esc(c.name)}</td><td class="n">${esc(c.credit)}</td><td class="n">${esc(c.ects)}</td><td><span class="grade ${gradeClass(c.grade)}">${esc(c.grade || '—')}</span></td><td class="muted">${esc(c.note)}</td></tr>`).join('')}</tbody></table>${
    s.term ? `<table class="sum"><thead><tr><th></th><th class="n">Kredi</th><th class="n">AKTS</th><th class="n">Tam. kredi</th><th class="n">Tam. AKTS</th><th class="n">Puan</th><th class="n">YANO</th><th class="n">GANO</th></tr></thead><tbody>${
      [['Yarıyıl', s.term], ['Birikimli', s.total]].filter(x => x[1]).map(([k, v]) => `<tr><th>${k}</th><td class="n">${esc(v.credit)}</td><td class="n">${esc(v.ects)}</td><td class="n">${esc(v.doneCredit)}</td><td class="n">${esc(v.doneEcts)}</td><td class="n">${esc(v.points)}</td><td class="n">${esc(v.yano)}</td><td class="n">${esc(v.gano)}</td></tr>`).join('')}</tbody></table>` : ''}</section>`).join('');
  return `${tr.date ? `<p class="muted">Belge tarihi: ${esc(tr.date)}</p>` : ''}${info}${head}${prep}${terms}`;
}

// Sayfa PDF'i: denetimler metne döner, düğmeler çıkar, sekmeler alt alta bölümler olur.
function pageHtml(m) {
  const flat = h => {
    const $ = cheerio.load(h || '', null, false);
    $('button').remove();
    $('select').each((_, s) => { $(s).replaceWith(esc(txt($(s).find('option[selected]').first().text() || $(s).find('option').first().text()))); });
    $('input[type=text]').each((_, i) => { $(i).replaceWith(esc($(i).attr('value') || '—')); });
    $('input[type=checkbox],input[type=radio]').each((_, i) => { $(i).replaceWith($(i).attr('checked') !== undefined ? '☑' : '☐'); });
    $('textarea').each((_, x) => { $(x).replaceWith(`<div>${esc($(x).text())}</div>`); });
    return $.html();
  };
  return flat(m.html) + m.tabs.map(t => `<h2>${esc(t.title)}</h2>${flat(t.html)}`).join('');
}

export async function docPdf(path) {
  // Sayfa zaten PDF ise (Müfredat): okulun PDF'i olduğu gibi (az önce çekildiyse yeniden istenmez)
  const hit = pdfs.get(path);
  if (hit && Date.now() - hit.t < 60_000) return { body: hit.body, type: 'application/pdf', name: hit.name };
  const m = await page(path);
  if (m.kind === 'pdf') return { body: pdfs.get(path).body, type: 'application/pdf', name: m.name };
  if (m.kind === 'external' || m.kind === 'notice') throw new Error('Bu sayfanın PDF hali yok');
  const body = m.kind === 'transcript' ? transcriptHtml(m) : pageHtml(m);
  return { body: await htmlToPdf(m.title, body), type: 'application/pdf', name: `${m.title}.pdf` };
}

// Okulun kendi "PDF e aktar" çıktısı (artık arayüzde kullanılmıyor; Telerik çıktısında Türkçe karakterler bozuk geliyor).
export async function exportPdf(path, target) {
  checkPath(path);
  if (!/^[\w$]+\$ExportToPdfButton$/.test(target || '')) throw new Error('Geçersiz tablo');
  const $ = cheerio.load(await getPage('ubs', path));
  const form = $('form').first();
  if (!form.find('input').filter((_, el) => el.attribs.name === target).length) throw new Error('Bu sayfada böyle bir tablo yok');
  const fields = formFields($, form);
  fields.set('__EVENTTARGET', target);
  fields.set('__EVENTARGUMENT', '');
  const action = new URL(form.attr('action') || path, BASE + path);
  if (action.origin !== BASE) throw new Error('Beklenmeyen form adresi');
  const r = await getFile('ubs', action.pathname + action.search, { method: 'POST', headers: FORM, body: fields.toString() });
  if (!/pdf/i.test(r.type)) throw new Error('UBS bu tablo için PDF üretmedi');
  return { body: r.body, type: 'application/pdf', name: fileName(r.disposition, 'UBS.pdf') };
}
