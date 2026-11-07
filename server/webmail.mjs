// Webmail (webmail.etu.edu.tr, Roundcube 1.5) maskesi. Gelen kutusu Roundcube'un kendi AJAX listesinden
// (_action=list&_remote=1) alınır; bir e-posta yalnızca tıklanınca çekilir.
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import { getPage, getFile, fileName } from './session.mjs';
import { courseKey } from './courses.mjs';

const SITE = 'webmail';
let token = null;                         // Roundcube istek anahtarı (request_token)
let folders = [];

const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();
const plain = html => txt(cheerio.load(`<div>${html ?? ''}</div>`)('div').text());

async function freshToken() {
  const html = await getPage(SITE, '/roundcube/?_task=mail&_mbox=INBOX');
  const env = JSON.parse((html.match(/rcmail\.set_env\((\{.*?\})\);/s) || [])[1] || '{}');
  token = env.request_token;
  folders = (env.mailboxes_list ?? []).map(id => ({ id, name: env.mailboxes?.[id]?.name ?? id }));
  if (!token) throw new Error('Roundcube istek anahtarı bulunamadı');
}

async function remote(query) {
  if (!token) await freshToken();
  for (let attempt = 0; ; attempt++) {
    const text = await getPage(SITE, `/roundcube/?${query}&_remote=1&_=${Date.now()}`,
      { headers: { 'X-Roundcube-Request': token, 'X-Requested-With': 'XMLHttpRequest' } });
    if (text.trim().startsWith('{')) return JSON.parse(text);
    if (attempt > 0) throw new Error('Roundcube beklenmeyen yanıt verdi');
    await freshToken();                   // anahtar eskimiş olabilir
  }
}

// exec metnindeki çağrının argümanını (dengeli parantezli JSON nesnesi) ayıklar.
function jsonAt(s, from) {
  const start = s.indexOf('{', from);
  let depth = 0, inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return { value: JSON.parse(s.slice(start, i + 1)), end: i + 1 };
  }
  return null;
}

// Liste yanıtındaki satırlar. Tek klasör listesinde kimlik 626, çok klasörlü aramada "626-INBOX" biçimindedir.
function rows(exec, mbox) {
  const messages = [];
  for (let i = exec.indexOf('add_message_row('); i >= 0; i = exec.indexOf('add_message_row(', i + 1)) {
    const rest = exec.slice(i + 16);
    const id = rest.match(/^"(\d+)-((?:[^"\\]|\\.)+)"/) || rest.match(/^(\d+)/);
    const cols = jsonAt(exec, i);
    const flags = cols && jsonAt(exec, cols.end);
    if (!id || !cols) continue;
    const f = flags?.value ?? {};
    messages.push({ uid: id[1], mbox: id[2] ? unq(id[2]) : mbox, subject: plain(cols.value.subject), from: plain(cols.value.fromto), date: plain(cols.value.date),
      size: plain(cols.value.size), seen: !!f.seen, flagged: !!f.flagged, answered: !!f.answered,
      attachment: /attachment|multipart\/(mixed|report)/.test(cols.value.attachment || f.ctype || '') });
  }
  return messages;
}

export async function inbox(mbox = 'INBOX', pageNo = 1) {
  // Sıra belirtilmezse Roundcube klasöre giriş sırasını verir: Çöp'te e-postalar silinme sırasına göre dizilir. Her klasör e-postanın tarihine göre, yeniden eskiye.
  const j = await remote(`_task=mail&_action=list&_mbox=${encodeURIComponent(mbox)}&_page=${Number(pageNo) || 1}&_sort=date_DESC`);
  const exec = j.exec || '';
  const messages = rows(exec, mbox);
  const unread = Number((exec.match(/set_unread_count\("INBOX",\s*(\d+)/) || [])[1] ?? messages.filter(m => !m.seen).length);
  const rowcount = plain((exec.match(/set_rowcount\("([^"]*)"/) || [])[1]);
  return { mbox, folders, unread, rowcount, messages, auto: autoView(mbox, messages) };
}

// Yıldızlılar: Roundcube'un kendi araması (FLAGGED süzgeci), bütün klasörlerde. Her e-posta kendi klasörüyle gelir.
export async function starred() {
  if (!folders.length) await freshToken();
  const j = await remote(`_task=mail&_action=search&_q=&_headers=subject&_filter=FLAGGED&_scope=all&_mbox=INBOX`);
  const messages = rows(j.exec || '', 'INBOX').filter(m => m.flagged);
  return { mbox: '__starred', folders, unread: 0, rowcount: `Toplam: ${messages.length}`, messages, auto: { enabled: false } };
}

// piazza.com bağlantısı -> uygulamadaki dersin Piazza sekmesi (#/donem/derslerim/<ders>/piazza).
// Ders, Piazza e-postasının konusundan bilinir ("Daily Digest for BİL 214 on Piazza"); bilinmiyorsa bağlantıdaki sınıf
// kimliğiyle #/piazza/<sınıf> verilir ve arayüz tıklanınca o sınıfın dersine geçer (data-pz-nid). Sınıf biçimleri:
//   /class?cid=<gönderi>&nid=<sınıf>&token=…   (günlük özet "Click here")
//   /class/<sınıf>?cid=<gönderi>   /class/<sınıf>/post/<numara>   /class/<sınıf>
// Abonelikten çıkma, ayarlar, giriş gibi bağlantılar olduğu gibi (Piazza'da) kalır.
const PZ_ID = /^[a-z0-9]{8,20}$/;
const PZ_KEEP = /unsubscribe|settings|preferences|login|signup|account|privacy|terms/i;
export function piazzaRoute(href, key = null) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (!/(^|\.)piazza\.com$/i.test(u.hostname) || PZ_KEEP.test(u.pathname + u.search)) return null;
  if (key) return { to: `#/donem/derslerim/${encodeURIComponent(key)}/piazza` };
  const m = u.pathname.match(/^\/class(?:\/([a-z0-9]+))?(?:\/post\/(\d+|[a-z0-9]+))?\/?$/i);
  if (!m) return null;
  const nid = m[1] || u.searchParams.get('nid');
  if (!nid || !PZ_ID.test(nid)) return null;
  return { to: `#/piazza/${nid}`, nid };
}

// E-posta HTML'ini gösterilecek hale getirir: script/stil/olay öznitelikleri ve uzak görseller (izleme pikselleri) silinir.
function cleanHtml($, el, pzKey = null) {
  el.find('script,style,link,meta,iframe,object,embed,form').remove();
  el.find('*').each((_, x) => {
    for (const a of Object.keys(x.attribs || {})) {
      if (/^on/i.test(a) || a === 'style' || a === 'class' || a === 'id') $(x).removeAttr(a);
      if ((a === 'href' || a === 'src') && /^\s*javascript:/i.test(x.attribs[a] || '')) $(x).removeAttr(a);
    }
  });
  el.find('a[href]').attr('target', '_blank').attr('rel', 'noopener noreferrer');
  // Piazza bildirimlerindeki bağlantılar uygulamadaki dersin Piazza sekmesinde açılır (Piazza'ya gitmez)
  el.find('a[href]').each((_, a) => {
    const r = piazzaRoute($(a).attr('href'), pzKey);
    if (!r) return;
    $(a).attr('href', r.to).removeAttr('target').removeAttr('rel').attr('class', 'inapp');
    if (r.nid) $(a).attr('data-pz-nid', r.nid);
  });
  el.find('img').remove();
  return el;
}

// Tek e-posta: başlıklar ve gövde (gövde sadeleştirilir; script/stil/olay öznitelikleri silinir).
// Roundcube önizlemeyi açmak e-postayı okundu yapar (okulun Webmail'iyle aynı davranış).
export async function message(uid, mbox = 'INBOX') {
  if (!/^\d+$/.test(uid || '')) throw new Error('Geçersiz e-posta numarası');
  const html = await getPage(SITE, `/roundcube/?_task=mail&_action=preview&_uid=${uid}&_mbox=${encodeURIComponent(mbox)}&_framed=1`);
  noteRead([String(uid)], mbox, true);      // önizleme e-postayı okundu yapar: okunma anı (otomatik silme için)
  const $ = cheerio.load(html);
  const headers = {};                     // "Gönderen", "Alıcı", "Tarih" … satırları
  $('table.header-headers tr').each((_, tr) => {
    headers[txt($(tr).find('td.header-title').text())] = txt($(tr).find('td.header').text());
  });
  const subject = $('h2.subject').first().clone();
  subject.find('.voice, a').remove();
  // Piazza'dan gelen e-postanın konusu dersin kodunu taşır: bağlantılar o dersin Piazza sekmesine gider
  const pzKey = /piazza/i.test(headers['Gönderen'] || '') ? courseKey(txt(subject.text())) : null;
  const body = cleanHtml($, $('#messagebody'), pzKey);
  return {
    uid, subject: txt(subject.text()),
    from: headers['Gönderen'] || '', to: headers['Alıcı'] || headers['Kime'] || '', cc: headers['Bilgi'] || headers['Cc'] || '',
    date: headers['Tarih'] || txt($('.header-summary .text-nowrap').first().text()),
    // Ek: <li class="application pdf"><a href="…&_part=2"><span class="attachment-name">…</span><span class="attachment-size">(~228 KB)</span>
    attachments: $('#attachment-list li, .attachmentslist li').map((_, li) => {
      const a = $(li).find('a').first();
      const [major, minor] = ($(li).attr('class') || '').trim().split(/\s+/);
      return { name: txt($(li).find('.attachment-name').text()) || txt(a.text()), size: txt($(li).find('.attachment-size').text()).replace(/[()~]/g, ''),
        part: (/[?&]_part=([\d.]+)/.exec(a.attr('href') || '') || [])[1], mime: minor ? `${major}/${minor}` : '' };
    }).get().filter(x => x.part),
    html: body.html() || '',
  };
}

// ---------- Değişiklikler: okundu/okunmadı, taşıma, silme (okulun Webmail'iyle eşzamanlı) ----------
// Roundcube'un kendi AJAX uçlarına POST + istek anahtarı; yanıt JSON'unda hata mesajı varsa yakalanır.
const FORM = 'application/x-www-form-urlencoded';
const unq = s => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
const errorIn = s => unq((String(s).match(/display_message\("((?:[^"\\]|\\.)*)",\s*"error"/) || [])[1] ?? '') || null;

async function post(action, fields) {
  for (let attempt = 0; ; attempt++) {
    if (!token) await freshToken();
    const text = await getPage(SITE, `/roundcube/?_task=mail&_action=${action}`, { method: 'POST',
      headers: { 'Content-Type': FORM, 'X-Roundcube-Request': token, 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({ ...fields, _remote: '1' }).toString() });
    if (text.trim().startsWith('{')) {
      const j = JSON.parse(text);
      const err = errorIn(j.exec || '');
      if (err) throw new Error(err);
      return j;
    }
    if (attempt > 0) throw new Error('Webmail isteği kabul etmedi');
    token = null;                         // istek anahtarı eskimiş olabilir
  }
}

const checkUids = uids => {
  const list = [].concat(uids ?? []).map(String);
  if (!list.length || !list.every(u => /^\d+$/.test(u))) throw new Error('Geçersiz e-posta numarası');
  return list.join(',');
};
async function checkMbox(m) {
  if (!folders.length) await freshToken();
  if (!folders.some(f => f.id === m)) throw new Error('Bilinmeyen klasör');
  return m;
}
const FLAGS = new Set(['read', 'unread', 'flagged', 'unflagged']);
export const TRASH = 'Trash';

// Okundu/okunmadı (ve yıldız): işaret okulun sunucusuna yazılır; Roundcube ve diğer posta uygulamaları da aynısını görür.
export async function mark(uids, flag, mbox = 'INBOX') {
  if (!FLAGS.has(flag)) throw new Error('Geçersiz işaret');
  await post('mark', { _uid: checkUids(uids), _flag: flag, _mbox: await checkMbox(mbox) });
  if (flag === 'read' || flag === 'unread') noteRead([].concat(uids).map(String), mbox, flag === 'read');
  return { ok: true };
}

export async function move(uids, mbox, target) {
  await post('move', { _uid: checkUids(uids), _mbox: await checkMbox(mbox), _target_mbox: await checkMbox(target) });
  return { ok: true };
}

// Silme: Çöp kutusuna taşır (geri alınabilir). Yalnızca Çöp kutusundayken kalıcı siler.
export async function remove(uids, mbox) {
  if (mbox !== TRASH) return move(uids, mbox, TRASH);
  await post('delete', { _uid: checkUids(uids), _mbox: TRASH });
  return { ok: true, permanent: true };
}

// ---------- Posta yazma ----------
// Roundcube her yeni/yanıt/iletme için sunucuda bir "yazma oturumu" açar (_id): alıcılar, konu ve alıntı orada hazırlanır,
// ekler oraya yüklenir, gönderim o oturumun formuyla yapılır. Alıntının asıl HTML'i burada tutulur, arayüze yalnızca
// sadeleştirilmiş önizlemesi gider.
const composes = new Map();               // _id -> { token, isHtml, quote, inline: [ek id], from, storeTarget }
const MODES = { new: '', reply: '&_reply_uid=', replyall: '&_reply_uid=', forward: '&_forward_uid=' };

export async function compose({ mode = 'new', uid, mbox = 'INBOX' } = {}) {
  if (!(mode in MODES)) throw new Error('Geçersiz işlem');
  let q = '/roundcube/?_task=mail&_action=compose';
  if (mode !== 'new') q += `${MODES[mode]}${checkUids(uid)}&_mbox=${encodeURIComponent(await checkMbox(mbox))}${mode === 'replyall' ? '&_all=all' : ''}`;
  const $ = cheerio.load(await getPage(SITE, q, { headers: {} }));   // yönlendirmeyle ?_id=… sayfasına gelir
  const f = $('form[name="form"]');
  const id = f.find('input[name="_id"]').val();
  if (!id) throw new Error('Yazma sayfası açılamadı');
  const isHtml = f.find('input[name="_is_html"]').val() === '1';
  const quote = $('textarea[name="_message"]').text();
  const attachments = $('#attachment-list li').map((_, li) => ({ id: $(li).attr('id'), name: txt($(li).find('.attachment-name').text()) })).get();
  const preview = isHtml ? cleanHtml($, cheerio.load(`<div id="q">${quote}</div>`)('#q')).html() : null;
  composes.set(id, {
    token: f.find('input[name="_token"]').val(), isHtml, quote,
    inline: mode.startsWith('reply') ? attachments.map(a => a.id) : [],          // yanıtta alıntının içindeki görseller
    storeTarget: $('select[name="_store_target"] option[selected]').attr('value') || 'Sent',
  });
  return {
    id, mode,
    from: $('select[name="_from"] option').map((_, o) => ({ id: $(o).attr('value'), label: txt($(o).text()), selected: $(o).attr('selected') !== undefined })).get(),
    to: txt($('textarea[name="_to"]').text()), cc: txt($('textarea[name="_cc"]').text()), bcc: txt($('textarea[name="_bcc"]').text()),
    subject: f.find('input[name="_subject"]').val() || '',
    quote: quote ? (isHtml ? preview : quote) : '',
    quoteIsHtml: isHtml,
    attachments: mode === 'forward' ? attachments : [],   // iletilen e-postanın ekleri
  };
}

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function send({ id, from, to, cc = '', bcc = '', subject = '', text = '', includeQuote = true } = {}) {
  const c = composes.get(id);
  if (!c) throw new Error('Yazma oturumu bulunamadı; postayı yeniden açın');
  if (!String(to).trim()) throw new Error('Alıcı (Kime) gerekli');
  // Alıntı eklenmeyecekse yanıtın içindeki görsel ekleri de çıkar
  if (!includeQuote) for (const f of c.inline) await removeAttachment(id, f).catch(() => {});
  const quote = includeQuote && c.quote ? c.quote : '';
  const message = c.isHtml
    ? `<div>${escHtml(text).replace(/\r?\n/g, '<br>')}</div>${quote ? '<br>' + quote : ''}`
    : `${text}${quote ? '\n\n' + quote : ''}`;
  const body = new URLSearchParams({ _token: c.token, _task: 'mail', _action: 'send', _id: id, _attachments: '',
    _from: from || '', _to: to, _cc: cc, _bcc: bcc, _replyto: '', _followupto: '', _subject: subject,
    _draft_saveid: '', _draft: '', _is_html: c.isHtml ? '1' : '0', _framed: '1', _message: message,
    _priority: '0', _store_target: c.storeTarget }).toString();
  const res = await getPage(SITE, `/roundcube/?_task=mail&_unlock=loading${Date.now()}&_framed=1`, { method: 'POST', headers: { 'Content-Type': FORM }, body });
  if (!/sent_successfully/.test(res)) throw new Error(errorIn(res) || 'Posta gönderilemedi');
  composes.delete(id);
  return { ok: true };
}

// Ek yükleme: dosya yazma oturumuna eklenir. Dönen kimlikle kaldırılabilir.
export async function upload(id, name, data) {
  const c = composes.get(id);
  if (!c) throw new Error('Yazma oturumu bulunamadı; postayı yeniden açın');
  const fd = new FormData();
  fd.append('_attachments[]', new Blob([data]), name);
  const text = await getPage(SITE, `/roundcube/?_task=mail&_action=upload&_id=${encodeURIComponent(id)}&_uploadid=upload${Date.now()}&_from=compose&_remote=1`,
    { method: 'POST', headers: { 'X-Roundcube-Request': c.token, 'X-Requested-With': 'XMLHttpRequest' }, body: fd });
  const j = JSON.parse(text);
  const err = errorIn(j.exec || '');
  if (err) throw new Error(err);
  const file = ((j.exec || '').match(/add2attachment_list\("([^"]+)"/) || [])[1];
  if (!file) throw new Error('Ek yüklenemedi');
  return { id: file, name };
}

export async function removeAttachment(id, file) {
  const c = composes.get(id);
  if (!c) throw new Error('Yazma oturumu bulunamadı');
  if (!/^rcmfile\w+$/.test(file || '')) throw new Error('Geçersiz ek');
  const text = await getPage(SITE, '/roundcube/?_task=mail&_action=remove-attachment', { method: 'POST',
    headers: { 'Content-Type': FORM, 'X-Roundcube-Request': c.token, 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams({ _id: id, _file: file, _remote: '1' }).toString() });
  const err = errorIn(text);
  if (err) throw new Error(err);
  c.inline = c.inline.filter(x => x !== file);
  return { ok: true };
}

// Bir e-postanın eki (ham dosya). Ek açmak e-postanın okundu durumunu değiştirmez.
export async function attachment(uid, mbox = 'INBOX', part) {
  if (!/^\d+$/.test(uid || '') || !/^\d+(\.\d+)*$/.test(part || '')) throw new Error('Geçersiz ek');
  for (let attempt = 0; ; attempt++) {
    if (!token) await freshToken();
    const r = await getFile(SITE, `/roundcube/?_task=mail&_action=get&_mbox=${encodeURIComponent(mbox)}&_uid=${uid}&_part=${part}&_download=1&_token=${token}`);
    if (r.status === 200 && !/text\/html/i.test(r.type)) {
      const name = fileName(r.disposition, `ek-${part}`);
      return { body: r.body, name, type: /\.pdf$/i.test(name) ? 'application/pdf' : r.type.split(';')[0] || 'application/octet-stream' };
    }
    if (attempt > 0) throw new Error('Ek indirilemedi');
    token = null;                         // istek anahtarı eskimiş olabilir
  }
}

// ---------- Okunan e-postaları otomatik silme ----------
// Ayar açıkken (varsayılan KAPALI) Gelen kutusundaki okunmuş e-postalar, okunduktan sonra seçilen sürede (12 saat, 24 saat, 3 gün, 1 hafta) Çöp kutusuna TAŞINIR
// Uygulamanın kendi bildirim e-postaları ([Ortam Sade · Bildirim] / [ETÜ Cep · Bildirim]) ayrı bir ayarla (varsayılan AÇIK, 24 saat)
// okunsun okunmasın Gelen kutusundan ve Gönderilmiş klasöründen Çöp'e taşınır. Süre, e-postanın listede ilk görüldüğü andan sayılır.
// (kalıcı silme yok; Çöp'ten geri alınabilir). Yıldızlı e-postalar ve kullanıcının "otomatik silme" kutucuğunu kaldırdığı
// e-postalar hiç taşınmaz. Okunma anı: uygulamada okunanlarda tam an; başka yerde (okulun Webmail'i, telefon) okunanlarda
// listede ilk kez okunmuş görüldüğü an — böylece ayar açıldığında eski e-postalar hemen değil, 12 saat sonra gider.
const AUTO_FILE = '.cache/webmail-auto.json';
export const AUTO_CHOICES = [12, 24, 72, 168];       // saat: 12 saat, 24 saat, 3 gün, 1 hafta
const AUTO_EVERY = 60 * 60_000;                     // saatte bir kontrol
const NOTIF_SUBJECT = /^\[(Ortam Sade|ETÜ Cep) · Bildirim\]/;
let auto = { enabled: false, afterHours: 12, notif: { enabled: true, afterHours: 24 }, readAt: {}, seenAt: {}, exempt: {},
  lastRun: null, nextRun: null, lastMoved: 0, totalMoved: 0, lastError: null };
try { const f = JSON.parse(fs.readFileSync(AUTO_FILE, 'utf8')); auto = { ...auto, ...f, notif: { ...auto.notif, ...f.notif }, seenAt: f.seenAt ?? {} }; } catch {}
const hoursOf = h => (AUTO_CHOICES.includes(h) ? h : 12) * 3600_000;
const isNotif = m => NOTIF_SUBJECT.test(m.subject || '');
// Gönderilen bildirim e-postalarının kopyası
const sentFolder = () => folders.find(f => /^(INBOX[./])?(Sent|Sent Items|Sent Messages)$/i.test(f.id) || /^(Gönderilmiş|Gönderilenler|Sent)/i.test(f.name))?.id ?? null;
const saveAuto = () => fs.promises.writeFile(AUTO_FILE, JSON.stringify(auto)).catch(() => {});
const akey = (mbox, uid) => `${mbox}:${uid}`;

function noteRead(uids, mbox, read) {
  if (mbox !== 'INBOX') return;
  for (const uid of uids) {
    if (read) auto.readAt[akey(mbox, uid)] ??= Date.now();
    else delete auto.readAt[akey(mbox, uid)];
  }
  saveAuto();
}

// Listede görülen durumla okunma anlarını eşitler (başka yerde okunan/okunmamış yapılanlar); bildirim e-postalarının ilk görüldüğü an.
function syncSeen(mbox, messages) {
  let changed = false;
  for (const m of messages) if (isNotif(m) && !auto.seenAt[akey(mbox, m.uid)]) { auto.seenAt[akey(mbox, m.uid)] = Date.now(); changed = true; }
  if (mbox !== 'INBOX') { if (changed) saveAuto(); return; }
  for (const m of messages) {
    const k = akey(mbox, m.uid);
    if (m.seen && !auto.readAt[k]) { auto.readAt[k] = Date.now(); changed = true; }
    if (!m.seen && auto.readAt[k]) { delete auto.readAt[k]; changed = true; }
  }
  if (changed) saveAuto();
}

// Saf seçim (test edilebilir): yıldızsız, muaf değil ve
//  - bildirim e-postası: ilk görülmesinin üstünden bildirim süresi geçmiş (okunmuş olması gerekmez), ya da
//  - Gelen kutusunda okunmuş: okunalı seçilen süre geçmiş.
export function selectDue(messages, s, now = Date.now(), mbox = 'INBOX') {
  return messages.filter(m => {
    const k = akey(mbox, m.uid);
    if (m.flagged || s.exempt[k]) return false;
    if (isNotif(m) && s.notif?.enabled) return !!s.seenAt?.[k] && now - s.seenAt[k] >= hoursOf(s.notif.afterHours);
    return mbox === 'INBOX' && s.enabled && m.seen && !!s.readAt[k] && now - s.readAt[k] >= hoursOf(s.afterHours);
  }).map(m => m.uid);
}

// Listeye eklenen bilgi: her okunmuş e-posta için kutucuk durumu ve ne zaman taşınacağı.
function autoView(mbox, messages) {
  syncSeen(mbox, messages);
  if (mbox !== 'INBOX' || !(auto.enabled || auto.notif.enabled)) return { enabled: false };
  const items = {};
  for (const m of messages) {
    const k = akey(mbox, m.uid), notif = isNotif(m) && auto.notif.enabled;
    if (notif) items[m.uid] = { exempt: !!auto.exempt[k] || m.flagged, starred: m.flagged, notif: true, dueAt: auto.seenAt[k] ? auto.seenAt[k] + hoursOf(auto.notif.afterHours) : null };
    else if (auto.enabled && m.seen) items[m.uid] = { exempt: !!auto.exempt[k] || m.flagged, starred: m.flagged, dueAt: auto.readAt[k] ? auto.readAt[k] + hoursOf(auto.afterHours) : null };
  }
  return { enabled: auto.enabled, notif: auto.notif.enabled, afterHours: auto.afterHours, items };
}

// Bir klasörün tamamı (sayfa sayfa; en çok 10 sayfa).
async function allInbox(mbox = 'INBOX') {
  const out = [];
  for (let p = 1; p <= 10; p++) {
    const r = await inbox(mbox, p);
    out.push(...r.messages);
    if (r.messages.length < 100) break;
  }
  return out;
}

// dryRun: hiçbir şey taşımadan hangi e-postaların taşınacağını söyler.
export async function runAuto({ dryRun = false } = {}) {
  const on = auto.enabled || auto.notif.enabled;
  if (!folders.length) await freshToken();
  const boxes = ['INBOX', ...(auto.notif.enabled && sentFolder() ? [sentFolder()] : [])];
  const info = [];
  let checked = 0;
  for (const mbox of boxes) {
    const messages = await allInbox(mbox);
    checked += messages.length;
    const due = selectDue(messages, auto, Date.now(), mbox);
    info.push(...due.map(uid => { const m = messages.find(x => x.uid === uid); return { uid, mbox, subject: m.subject, from: m.from, notif: isNotif(m) }; }));
    if (dryRun || !on || !due.length) continue;
    await move(due, mbox, TRASH);
    for (const uid of due) { const k = akey(mbox, uid); delete auto.readAt[k]; delete auto.exempt[k]; delete auto.seenAt[k]; }
  }
  for (const [k, t] of Object.entries(auto.seenAt)) if (Date.now() - t > 60 * 86_400_000) delete auto.seenAt[k];
  if (dryRun || !on) return { dryRun: true, enabled: on, wouldMove: info, checked };
  auto.lastRun = Date.now();
  auto.lastMoved = info.length;
  auto.totalMoved += info.length;
  await saveAuto();
  return { dryRun: false, moved: info, checked };
}

let autoTimer = null;
export function startAuto() {
  clearInterval(autoTimer);
  const tick = async () => {
    auto.nextRun = Date.now() + AUTO_EVERY;
    if (!auto.enabled && !auto.notif.enabled) return saveAuto();
    try { await runAuto(); auto.lastError = null; } catch (e) { auto.lastError = e.message; await saveAuto(); }
  };
  setTimeout(tick, 2 * 60_000);                     // açılıştan 2 dk sonra, sonra saatte bir
  autoTimer = setInterval(tick, AUTO_EVERY);
  auto.nextRun = Date.now() + 2 * 60_000;
}

export function autoStatus() {
  return { enabled: auto.enabled, afterHours: auto.afterHours, choices: AUTO_CHOICES, notif: auto.notif, lastRun: auto.lastRun,
    nextRun: auto.enabled || auto.notif.enabled ? auto.nextRun : null,
    lastMoved: auto.lastMoved, totalMoved: auto.totalMoved, lastError: auto.lastError, tracked: Object.keys(auto.readAt).length };
}
export async function setAuto({ enabled, afterHours, notifEnabled, notifHours }) {
  if (typeof enabled === 'boolean') auto.enabled = enabled;
  if (AUTO_CHOICES.includes(afterHours)) auto.afterHours = afterHours;
  if (typeof notifEnabled === 'boolean') auto.notif.enabled = notifEnabled;
  if (AUTO_CHOICES.includes(notifHours)) auto.notif.afterHours = notifHours;
  await saveAuto();
  return autoStatus();
}
export async function setExempt(uid, exempt) {
  if (!/^\d+$/.test(String(uid || ''))) throw new Error('Geçersiz e-posta numarası');
  if (exempt) auto.exempt[akey('INBOX', uid)] = true; else delete auto.exempt[akey('INBOX', uid)];
  await saveAuto();
  return { ok: true };
}
