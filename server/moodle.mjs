// Moodle siteleri (uzak.etu.edu.tr, uzakydb.etu.edu.tr) için ortak maske. Listeler Moodle'ın kendi JSON servisinden
// (lib/ajax/service.php), ders içerikleri ve etkinlik sayfaları sadeleştirilmiş HTML'den gelir; her ekran tek istek atar.
import * as cheerio from 'cheerio';
import { SITES, getPage, getFile, fileName, ExternalRedirect } from './session.mjs';

export const decode = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();

const instances = {};
export const moodle = site => (instances[site] ??= create(site));

// Etkinlik simgesinden dosya türü: .../f/pdf-24 -> pdf
const fileKind = src => (/\/f\/([a-z]+)/.exec(src || '') || [])[1] || null;
const PAGE = /^\/mod\/\w+\/(view\.php\?id=\d+|discuss\.php\?d=\d+)$/;      // uygulamanın içinde açılabilen etkinlik sayfaları
const PLUGINFILE = /^\/pluginfile\.php\/[^?#]+$/;
const SEBCONF = /^\/mod\/quiz\/accessrule\/seb\/config\.php\?cmid=\d+$/;     // Safe Exam Browser yapılandırma dosyası (.seb)

function create(site) {
  const BASE = SITES[site].base;
  let sesskey = null;                     // Moodle oturum anahtarı; geçersiz olursa yeniden alınır

  async function freshSesskey() {
    const html = await getPage(site, '/user/preferences.php');
    sesskey = (html.match(/"sesskey":"([^"]+)"/) || [])[1];
    if (!sesskey) throw new Error('Moodle oturum anahtarı bulunamadı');
  }

  // calls: [[metot, argümanlar], ...] -> her çağrının verisi (hatalıysa null)
  async function call(calls) {
    if (!sesskey) await freshSesskey();
    const body = JSON.stringify(calls.map(([methodname, args], index) => ({ index, methodname, args })));
    for (let attempt = 0; ; attempt++) {
      const text = await getPage(site, `/lib/ajax/service.php?sesskey=${sesskey}&info=${calls.map(c => c[0]).join(',')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const res = JSON.parse(text);
      const badKey = (res.errorcode ?? res[0]?.exception?.errorcode) === 'invalidsesskey';
      if (badKey && attempt === 0) { await freshSesskey(); continue; }
      if (!Array.isArray(res)) throw new Error(res.error || 'Moodle servisi hata verdi');
      return res.map(r => (r.error ? null : r.data));
    }
  }

  const COURSES = ['core_course_get_enrolled_courses_by_timeline_classification',
    { offset: 0, limit: 0, classification: 'all', sort: 'fullname', customfieldname: '', customfieldvalue: '' }];
  const mapCourse = x => ({ id: x.id, name: decode(x.fullname), short: decode(x.shortname), category: decode(x.coursecategory),
    url: x.viewurl, progress: x.hasprogress ? Math.round(x.progress) : null, end: x.enddate * 1000 });

  // Ana ekran: dersler, yaklaşan etkinlikler ve son erişilenler tek istekte.
  async function home() {
    const now = Math.floor(Date.now() / 1000);
    const [c, e, r] = await call([COURSES,
      ['core_calendar_get_action_events_by_timesort', { limitnum: 20, timesortfrom: now - 7 * 86400, limittononsuspendedevents: true }],
      ['block_recentlyaccesseditems_get_recent_items', { limit: 9 }],
    ]);
    return {
      courses: (c?.courses ?? []).map(mapCourse),
      events: (e?.events ?? []).map(x => ({ name: decode(x.activityname || x.name), course: decode(x.course?.fullname), courseId: x.course?.id,
        time: x.timesort * 1000, url: x.action?.url || x.url, action: decode(x.action?.name), overdue: !!x.overdue, module: x.modulename })),
      recent: (r ?? []).map(x => ({ name: decode(x.name), course: decode(x.coursename), courseId: x.courseid, url: x.viewurl, module: x.modname,
        cmid: x.cmid, time: x.timeaccess * 1000 })),
    };
  }

  // Dönemsel ek içerik: panodaki (/my/) standart olmayan bloklar (ör. "Safe Exam Browser indir", sınav duyurusu) ve
  // ön sayfadaki site duyuruları. Ders içerikleri ve etkinlikler zaten ders sayfalarında; bunlar ders dışında kalanlar.
  const STD_BLOCKS = new Set(['timeline', 'calendar_month', 'calendar_upcoming', 'recentlyaccesseditems', 'myoverview', 'starredcourses',
    'online_users', 'badges', 'private_files', 'navigation', 'settings', 'lp', 'recentlyaccessedcourses', 'course_list', 'search_forums',
    'news_items', 'activity_modules', 'site_main_menu', 'login', 'calendar']);
  async function extras() {
    const blocks = [];
    const read = async path => {
      const $ = cheerio.load(await getPage(site, path));
      $('script,style').remove();
      $('section.block[data-block], div.block[data-block]').each((_, b) => {
        const name = $(b).attr('data-block');
        if (STD_BLOCKS.has(name)) return;
        const body = $(b).find('.card-text, .content').first();
        const text = txt(body.text()).slice(0, 600);
        if (!text) return;
        blocks.push({ title: txt($(b).find('h5, h3, .card-title').first().text()) || 'Duyuru', text,
          links: body.find('a[href]').map((_, a) => ({ text: txt($(a).text()) || $(a).attr('href'), url: $(a).attr('href') })).get().slice(0, 8) });
      });
      // Ön sayfadaki site duyuruları ve konu metni
      $('#site-news-forum .forumpost, #frontpage-news-forum .forumpost, .sitetopic .no-overflow').each((_, p) => {
        const text = txt($(p).find('.post-content-container, .content, .posting').first().text() || $(p).text()).slice(0, 600);
        if (text) blocks.push({ title: txt($(p).find('h3, h4, .subject').first().text()) || 'Site duyurusu', text,
          links: $(p).find('a[href]').map((_, a) => ({ text: txt($(a).text()) || $(a).attr('href'), url: $(a).attr('href') })).get().slice(0, 8) });
      });
    };
    await read('/my/');
    await read('/?redirect=0');
    const seen = new Set();
    return { site, items: blocks.filter(b => !seen.has(b.text) && seen.add(b.text)), url: SITES[site].base };
  }

  // Yalnızca kayıtlı dersler (Derslerim birleştirmesi için).
  async function courses() {
    const [c] = await call([COURSES]);
    if (!c) throw new Error(`${SITES[site].name} ders listesi alınamadı`);
    return c.courses.map(mapCourse);
  }

  // Ders sayfası: haftalar/konular ve içindeki etkinlikler. Dosyanın türü etkinlik simgesinden okunur.
  async function course(id) {
    if (!/^\d+$/.test(String(id))) throw new Error('Geçersiz ders');
    const $ = cheerio.load(await getPage(site, `/course/view.php?id=${id}`));
    const sections = $('li.section').map((_, s) => {
      const items = $(s).find('li.activity').map((_, a) => {
        const type = (($(a).attr('class') || '').match(/modtype_(\w+)/) || [])[1];
        const cmid = Number(($(a).attr('id') || '').replace('module-', '')) || null;
        if (type === 'label') {
          const text = txt($(a).find('.contentwithoutlink, .no-overflow').first().text());
          return text ? [{ type, cmid, text }] : [];
        }
        const link = $(a).find('a.aalink, .activityinstance a').first();
        const name = txt(link.find('.instancename').clone().children().remove().end().text()) || txt(link.text());
        if (!name) return [];
        return [{ type, cmid, name, kind: type === 'resource' ? fileKind($(a).find('img').first().attr('src')) : null,
          desc: txt($(a).find('.contentafterlink').text()).slice(0, 300), url: link.attr('href') || '' }];
      }).get();
      const name = txt($(s).find('.sectionname').first().text()) || ($(s).attr('id') === 'section-0' || $(s).attr('data-sectionid') === '0' ? 'Genel' : '');
      const summary = txt($(s).find('.summary').first().text()).slice(0, 400);
      return items.length || summary ? [{ name, summary, items }] : [];
    }).get();
    return { id: Number(id), title: txt($('.page-header-headings h1, h1').first().text()), sections };
  }

  // Etkinlik sayfasının (duyuru forumu, ödev/not, sınav, sayfa…) ana bölümü, sadeleştirilmiş HTML olarak.
  // Bağlantılar: aynı sitedeki etkinlik sayfaları uygulamada açılır (data-mpage), dosyalar dosya düğmesi olur (data-mfile).
  async function page(path) {
    if (!PAGE.test(path || '')) throw new Error('İzin verilmeyen sayfa');
    const $ = cheerio.load(await getPage(site, path));
    const main = $('[role=main]').first().length ? $('[role=main]').first() : $('#region-main');
    const title = txt($('.page-header-headings h1, h1').first().text()) || txt($('title').text());
    // Sınava başlama, ödev yükleme, foruma yazma gibi işlemler okulun sitesinde yapılır: düğme adları ve sayfanın
    // adresi döner, arayüz "Uzak'ta aç" bağlantısıyla gösterir (formlar burada gönderilmez).
    const actions = [...new Set(main.find('form button[type=submit], form input[type=submit], form button:not([type])').map((_, b) =>
      txt($(b).text()) || txt($(b).attr('value'))).get().filter(t => t && t.length < 60))].slice(0, 4);
    main.find('script,style,link,meta,noscript,iframe,object,embed,video,audio,form,input,select,button,textarea,.commentsarea,.comment-area,[class*=comment-ctrl]').remove();
    main.find('.sr-only,.accesshide,.hidden,[hidden],.visually-hidden').remove();
    main.find('tr').filter((_, tr) => !$(tr).find('tr').length && /___\w+___/.test($(tr).text())).remove();   // yorum şablonu kalıntısı
    main.find('img').each((_, el) => {
      const u = new URL($(el).attr('src') || '', BASE);
      if (u.origin === BASE && PLUGINFILE.test(u.pathname)) $(el).attr('src', `/api/file/moodle?site=${site}&path=${encodeURIComponent(u.pathname)}`);
      else $(el).remove();
    });
    main.find('a').each((_, el) => {
      let u;
      try { u = new URL($(el).attr('href') || '', BASE); } catch { u = null; }
      const label = $(el).html();
      if (u && u.origin === BASE && (PLUGINFILE.test(u.pathname) || SEBCONF.test(u.pathname + u.search)))
        $(el).replaceWith($('<button class="att"></button>').attr('data-mfile', PLUGINFILE.test(u.pathname) ? u.pathname : u.pathname + u.search).attr('data-site', site).html(label));
      else if (u && /^sebs?:$/.test(u.protocol))     // "Safe Exam Browser'ı başlat": bilgisayardaki SEB uygulamasını açar
        $(el).replaceWith($('<a class="seb"></a>').attr('href', u.href).html(label));
      else if (u && u.origin === BASE && PAGE.test(u.pathname + u.search))
        $(el).replaceWith($('<a class="mlink" href="#"></a>').attr('data-mpage', u.pathname + u.search).attr('data-site', site).html(label));
      else if (u && /^https?:$/.test(u.protocol) && u.origin !== BASE)
        $(el).replaceWith($('<a target="_blank" rel="noopener noreferrer"></a>').attr('href', u.href).html(label));
      else $(el).replaceWith(label ?? '');
    });
    const KEEP = /^(colspan|rowspan|src|href|target|rel|data-mfile|data-mpage|data-site|class)$/;
    main.find('*').each((_, el) => {
      for (const a of Object.keys(el.attribs || {})) if (!KEEP.test(a) || (a === 'class' && !/^(att|mlink|seb)$/.test(el.attribs.class))) $(el).removeAttr(a);
    });
    for (let i = 0; i < 4; i++) main.find('div,span,p,li,ul,table,tr').filter((_, el) => !txt($(el).text()) && !$(el).find('img,button').length).remove();
    return { title, html: main.html() || '', actions, source: BASE + path };
  }

  // Dosya: kaynak etkinliği (cm) ya da klasördeki dosyanın yolu (/pluginfile.php/…).
  async function file({ cm, path }) {
    let r;
    if (cm) {
      if (!/^\d+$/.test(cm)) throw new Error('Geçersiz dosya');
      r = await getFile(site, `/mod/resource/view.php?id=${cm}&redirect=1`);
    } else {
      if (!PLUGINFILE.test(path || '') && !SEBCONF.test(path || '')) throw new Error('Geçersiz dosya yolu');
      r = await getFile(site, path);
    }
    if (r.status !== 200 || /text\/html/i.test(r.type)) throw new Error('Dosya indirilemedi');
    const last = SEBCONF.test(path || '') ? 'sinav.seb' : (path || '').split('/').pop() || 'dosya';
    const name = fileName(r.disposition, (() => { try { return decodeURIComponent(last); } catch { return last; } })());
    return { body: r.body, name, type: /\.pdf$/i.test(name) ? 'application/pdf' : r.type.split(';')[0] };
  }

  // URL etkinliğinin gösterdiği dış adres.
  async function link(cm) {
    if (!/^\d+$/.test(cm || '')) throw new Error('Geçersiz bağlantı');
    try { await getPage(site, `/mod/url/view.php?id=${cm}&redirect=1`); }
    catch (e) { if (e instanceof ExternalRedirect) return { url: e.url }; throw e; }
    return { url: `${BASE}/mod/url/view.php?id=${cm}` };
  }

  return { call, home, extras, courses, course, page, file, link };
}
