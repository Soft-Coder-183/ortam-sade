// Piazza (piazza.com) maskesi. Piazza'nın kendi JSON servisini (logic/api) kullanır: sınıflar, gönderi akışı ve
// tek gönderi; ders kaynakları (Resources) sınıf profil sayfasındaki RESOURCES listesinden gelir.
import * as cheerio from 'cheerio';
import { getPage, getFile, fileName, cookie, ExternalRedirect } from './session.mjs';

const SITE = 'piazza';
const BASE = 'https://piazza.com';
const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();
const plain = html => txt(cheerio.load(`<div>${html ?? ''}</div>`)('div').text());
const NID = /^[a-z0-9]{8,20}$/;
const FILE_PATH = /^\/(redirect\/s3\?bucket=uploads&prefix=[\w%/.\-~]+|class_profile\/get_resource\/[a-z0-9]+\/[a-z0-9]+)$/;

async function api(method, params = {}) {
  const text = await getPage(SITE, `/logic/api?method=${method}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': cookie(SITE, 'session_id') || '' },
    body: JSON.stringify({ method, params }) });
  const j = JSON.parse(text);
  if (j.error) throw new Error('Piazza: ' + j.error);
  return j.result;
}

let networks = [];                        // son user.status'taki sınıflar (kaynak sayfası adresi için)

// Kullanıcının sınıfları ve her sınıftaki yeni gönderi sayısı (tek istek).
export async function classes() {
  const s = await api('user.status');
  networks = s.networks ?? [];
  return networks.map(n => ({
    id: n.id, name: n.name, code: n.course_number, term: n.term, active: n.status === 'active',
    fresh: s.new_questions?.[n.id] ?? 0,
    sections: (n.config?.resource_sections ?? []).map(x => ({ name: x.name, title: x.title })),
  }));
}

// Sınıfın ders kodu (ör. "BİL 214"): toplu indirmede klasör/zip adı için
export async function codeOf(nid) {
  if (!networks.some(n => n.id === nid)) await classes();
  return networks.find(n => n.id === nid)?.course_number || 'Piazza';
}

// Yazarın sınıftaki rolü: sınıfın hoca/asistan listesinde ise "Ders hocası" / "Ders asistanı", değilse "Öğrenci".
// Kimliği görünmeyen (anonim) yazarlarda boş: belirleyemediğimiz rolü yazmıyoruz.
const ROLE = { professor: 'Ders hocası', instructor: 'Ders hocası', ta: 'Ders asistanı' };
async function staffOf(nid) {
  if (!networks.some(n => n.id === nid)) await classes();
  return new Map((networks.find(n => n.id === nid)?.profs ?? []).map(p => [p.id, { role: ROLE[p.role] || 'Ders hocası', name: plain(p.name) }]));
}
// Anonim yazılmışsa öğrencidir (ders hocaları ve asistanlar anonim yazmaz). Ne kimlik ne anonimlik bilgisi varsa boş.
// Yazarın görünen adı: hoca/asistan listede adıyla; öğrenci kimliği açıksa Piazza'nın kullanıcı kaydından; anonimse "Anonim".
// Adı bulunamazsa boş (bildirim rol etiketine döner).
const names = new Map();                                   // kullanıcı kimliği -> ad (öğrenciler; oturum boyunca)
async function nameOf(nid, staff, uid, anon) {
  if (!uid) return anon ? 'Anonim' : '';
  const s = staff.get(uid);
  if (s) return s.name || '';
  if (!names.has(uid)) {
    try { const r = await api('network.get_users', { ids: [uid], nid }); names.set(uid, plain((Array.isArray(r) ? r[0] : r)?.name)); }
    catch { names.set(uid, ''); }
  }
  return names.get(uid);
}
const roleOf = (staff, uid, anon) => (uid ? staff.get(uid)?.role || 'Öğrenci' : anon ? 'Öğrenci' : '');

// Bildirim için gönderen adı (hoca/asistan adıyla, anonimse "Anonim"); bulunamazsa boş.
export async function authorName(nid, uid, anon) { return nameOf(nid, await staffOf(nid), uid, anon); }

// Sınıfın gönderi akışı (son güncellenenler; sabitlenmişler işaretli).
export async function feed(nid) {
  if (!NID.test(nid || '')) throw new Error('Geçersiz sınıf');
  const [r, staff] = await Promise.all([api('network.get_my_feed', { nid, offset: 0, limit: 30, sort: 'updated' }), staffOf(nid)]);
  return {
    nid, posts: (r.feed ?? []).map(p => ({ id: p.id, nr: p.nr, type: p.type, subject: plain(p.subject), snippet: plain(p.content_snipet).slice(0, 200),
      updated: Date.parse(p.updated) || null, isNew: !!p.is_new, pinned: (p.tags ?? []).includes('pin') || !!p.pin,
      instructor: (p.tags ?? []).includes('instructor-note') || (p.tags ?? []).includes('instructor-question'),
      unanswered: !!p.no_answer, folders: p.folders ?? [],
      created: (c => Date.parse(c?.t || c?.when || '') || null)((p.log ?? []).find(l => l.n === 'create')),   // gönderinin açıldığı an
      uid: (p.log ?? []).find(l => l.n === 'create')?.u || null,
      role: (c => (c ? roleOf(staff, c.u, !c.u) : ''))((p.log ?? []).find(l => l.n === 'create')) })),   // oluşturma kaydında kimlik yoksa anonim
  };
}

// Piazza HTML'ini sadeleştirir: script/olay öznitelikleri silinir, Piazza'daki dosya ve görseller uygulama üzerinden açılır.
function clean(html) {
  const $ = cheerio.load(`<div id="r">${html ?? ''}</div>`);
  const r = $('#r');
  r.find('script,style,link,meta,iframe,object,embed,form,input,button').remove();
  const local = href => { try { const u = new URL(href, BASE); const p = u.pathname + u.search; return u.origin === BASE && FILE_PATH.test(p) ? p : null; } catch { return null; } };
  r.find('img').each((_, el) => {
    const p = local($(el).attr('src') || '');
    if (p) $(el).attr('src', `/api/file/piazza?path=${encodeURIComponent(p)}`); else $(el).remove();
  });
  linkifyText($, r);
  r.find('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const p = local(href);
    const post = postLink(href);
    if (p) $(el).replaceWith($('<button class="att"></button>').attr('data-pfile', p).html($(el).html()));
    else if (post) {
      // Hocanın yapıştırdığı Piazza gönderisi bağlantısı: uygulamada o dersin o gönderisi açılır (Piazza'ya gidilmez).
      // Bağlantının metni adresin kendisiyse "Piazza gönderisi @12" gibi okunur bir ada çevrilir.
      $(el).attr('href', `#/piazza/${post.nid}`).attr('class', 'inapp').attr('data-pz-nid', post.nid).removeAttr('target').removeAttr('rel');
      if (post.post) $(el).attr('data-pz-post', post.post);
      if (/^\s*(https?:\/\/)?(www\.)?piazza\.com\//i.test($(el).text())) $(el).text(post.post ? `Piazza gönderisi ${/^\d+$/.test(post.post) ? '@' + post.post : ''}`.trim() : 'Piazza sınıfı');
    }
    else if (/^https?:\/\//i.test(href)) $(el).attr('target', '_blank').attr('rel', 'noopener noreferrer');
    else $(el).replaceWith($(el).html() ?? '');
  });
  r.find('*').each((_, el) => {
    for (const a of Object.keys(el.attribs || {})) if (!/^(href|src|target|rel|colspan|rowspan|data-pfile|data-pz-nid|data-pz-post|class)$/.test(a) || (a === 'class' && !/^(att|inapp)$/.test(el.attribs.class))) $(el).removeAttr(a);
  });
  return r.html() || '';
}

// Piazza gönderisi/sınıfı adresi -> { nid, post? }. Biçimler: /class/<sınıf>/post/<numara|kimlik>, /class/<sınıf>?cid=<gönderi>,
// /class?nid=<sınıf>&cid=<gönderi>, /class/<sınıf>. Dosya, ayar ve hesap adresleri dönmez (olduğu gibi kalır).
function postLink(href) {
  let u;
  try { u = new URL(href, BASE); } catch { return null; }
  if (!/(^|\.)piazza\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/class(?:\/([a-z0-9]+))?(?:\/post\/([a-z0-9]+))?\/?$/i);
  if (!m) return null;
  const nid = m[1] || u.searchParams.get('nid');
  if (!nid || !NID.test(nid)) return null;
  const post = m[2] || u.searchParams.get('cid');
  return { nid, post: post && /^[a-z0-9]{1,20}$/i.test(post) ? post : null };
}

// Gönderi metninde bağlantı olmadan yazılmış adresler (hoca adresi düz metin olarak yapıştırmış) bağlantıya çevrilir;
// sonra yukarıdaki kural Piazza adreslerini uygulamaya, diğerlerini yeni pencereye yönlendirir. Kod blokları ellenmez.
const URL_TEXT = /https?:\/\/[^\s<>"']+/g;
function linkifyText($, root) {
  const walk = node => {
    for (const n of [...(node.children || [])]) {
      if (n.type === 'tag' && !/^(a|code|pre|button)$/i.test(n.name)) walk(n);
      if (n.type !== 'text' || !URL_TEXT.test(n.data)) continue;
      URL_TEXT.lastIndex = 0;
      const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const html = esc(n.data).replace(URL_TEXT, u => {
        const tail = u.match(/[.,;:!?)]+$/)?.[0] ?? '';
        const a = u.slice(0, u.length - tail.length);
        return `<a href="${a}">${a}</a>${tail}`;
      });
      $(n).replaceWith(html);
    }
  };
  walk(root[0]);
}

// Tek gönderi: içerik, öğrenci/hoca yanıtları ve takip tartışmaları.
export async function post(nid, cid) {
  // cid: gönderinin kimliği ya da numarası (@nr; e-postadaki bağlantılar ikisini de kullanabilir)
  if (!NID.test(nid || '') || !(NID.test(cid || '') || /^\d{1,6}$/.test(cid || ''))) throw new Error('Geçersiz gönderi');
  const [p, staff] = await Promise.all([api('content.get', { nid, cid }), staffOf(nid)]);
  const last = h => (h ?? [])[0] ?? {};
  // Yazar: gönderide ilk sürüm (history'nin sonu); yanıt ve tartışmalarda kendi kimliği. Anonimse kimlik gelmez.
  const author = x => {
    const first = (x.history ?? []).at(-1);
    const anon = x.anon ?? first?.anon;
    return roleOf(staff, x.uid ?? first?.uid, anon === 'stud' || anon === 'full');
  };
  const answers = (p.children ?? []).map(c => {
    const kind = c.type === 'i_answer' ? 'Ders hocası / asistanı yanıtı' : c.type === 's_answer' ? 'Öğrencilerin yanıtı' : 'Tartışma';
    return { kind, role: c.type === 'followup' ? author(c) : '', html: clean(last(c.history).content ?? c.subject), created: Date.parse(c.created) || null,
      replies: (c.children ?? []).map(x => ({ role: author(x), html: clean(x.subject ?? last(x.history).content), created: Date.parse(x.created) || null })) };
  });
  return { id: p.id, nr: p.nr, subject: plain(last(p.history).subject), html: clean(last(p.history).content), created: Date.parse(p.created) || null,
    role: author(p), answers };
}

// Sınıfın kaynakları (Resources sayfası): bölümler ve dosyalar/bağlantılar.
export async function resources(nid) {
  if (!NID.test(nid || '')) throw new Error('Geçersiz sınıf');
  if (!networks.some(n => n.id === nid)) await classes();
  const n = networks.find(x => x.id === nid);
  if (!n) throw new Error('Sınıf bulunamadı');
  const html = await getPage(SITE, `/${n.school_ext}/${n.term_key}/${n.short_number}/resources`);
  const i = html.indexOf('var RESOURCES = ');
  if (i < 0) return { nid, sections: [] };
  const list = JSON.parse(arrayAt(html, i));
  const byId = new Map(list.map(x => [x.id, x]));
  const item = x => ({ id: x.id, name: plain(x.subject), type: x.config?.resource_type, date: x.config?.date || '',
    url: x.config?.resource_type === 'link' ? plain(x.content) : null });
  const sections = (n.config?.resource_sections ?? []).map(s => ({ title: s.title,
    items: (s.ordering ?? []).map(id => byId.get(id)).filter(Boolean).filter(x => x.config?.visibility !== 'none').map(item) }))
    .filter(s => s.items.length);
  return { nid, sections };
}

// "var RESOURCES = [ … ];" içindeki dizi (dengeli köşeli parantez).
function arrayAt(s, from) {
  const start = s.indexOf('[', from);
  let depth = 0, inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return s.slice(start, i + 1);
  }
  throw new Error('Piazza kaynak listesi okunamadı');
}

// Dosya: sınıf kaynağı (nid + rid) ya da gönderideki ek/görsel (Piazza içi yol).
export async function file({ nid, rid, path }) {
  const p = nid || rid ? `/class_profile/get_resource/${nid}/${rid}` : path;
  if ((nid || rid) && (!NID.test(nid || '') || !NID.test(rid || ''))) throw new Error('Geçersiz dosya');
  if (!FILE_PATH.test(p || '')) throw new Error('Geçersiz dosya yolu');
  let r;
  try { r = await getFile(SITE, p); }
  catch (e) {
    // Gönderi ekleri Piazza'nın depolama alanına (S3) imzalı, süreli bir adresle yönlenir; o adres çerezsiz çekilir.
    if (!(e instanceof ExternalRedirect) || !/^https:\/\/([\w.-]+\.)?(amazonaws\.com|piazza\.com)\//.test(e.url)) throw e;
    const res = await fetch(e.url);
    r = { status: res.status, type: res.headers.get('content-type') || '', disposition: res.headers.get('content-disposition') || '',
      body: Buffer.from(await res.arrayBuffer()) };
  }
  if (r.status !== 200 || /text\/html/i.test(r.type)) throw new Error('Dosya indirilemedi');
  const last = p.split(/%2F|\//i).pop() || 'piazza-dosya';
  const name = fileName(r.disposition, (() => { try { return decodeURIComponent(last); } catch { return last; } })());
  return { body: r.body, name, type: /\.pdf$/i.test(name) ? 'application/pdf' : r.type.split(';')[0] };
}
