// Okulun herkese açık sitesi (www.etu.edu.tr): akademik takvim, fakülte/bölüm listesi ve akademik kadro dizini.
// Giriş gerekmez; sayfalar seyrek değiştiği için uzun süre önbellekte tutulur (server.mjs STALE_MIN).
import * as cheerio from 'cheerio';

const BASE = 'https://www.etu.edu.tr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const txt = s => (s ?? '').replace(/\s+/g, ' ').trim();

async function page(path) {
  const r = await fetch(BASE + path, { headers: { 'User-Agent': UA, 'Accept-Language': 'tr' } });
  if (!r.ok) throw new Error(`Okulun sitesi yanıt vermedi (${r.status})`);
  return cheerio.load(await r.text());
}

// ---------- Akademik takvim ----------
// Sayfa: sekmeler (Lisans / Lisansüstü / Tıp) → dönemler (Güz/Bahar/Yaz) → "tarih aralığı + olay" satırları.
const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const ay = s => AYLAR.indexOf(String(s).toLocaleLowerCase('tr'));

// "03 - 14 Ağustos 2026", "31 Ağustos - 03 Eylül 2026", "28 Aralık 2026 - 08 Ocak 2027", "30 Ağustos 2026" -> [başlangıç, bitiş] (ms)
export function parseRange(text) {
  const parts = txt(text).split(/\s+-\s+|\s*–\s*/);
  const parse = (s, fallback = {}) => {
    const m = /^(\d{1,2})(?:\s+([A-Za-zÇĞİÖŞÜçğıöşü]+))?(?:\s+(\d{4}))?$/.exec(txt(s));
    if (!m) return null;
    return { d: +m[1], m: m[2] ? ay(m[2]) : fallback.m, y: m[3] ? +m[3] : fallback.y };
  };
  const end = parse(parts.at(-1));
  if (!end || end.m < 0 || !end.y) return [null, null];
  let start = parts.length > 1 ? parse(parts[0], end) : end;
  if (!start || start.m < 0) start = end;
  if (start.y === end.y && start.m > end.m) start.y -= 1;           // "28 Aralık - 08 Ocak 2027"
  const ms = x => Date.UTC(x.y, x.m, x.d) - 3 * 3600_000;            // İstanbul gece yarısı
  return [ms(start), ms(end) + 86_400_000 - 1];
}

export async function calendar() {
  const $ = await page('/tr/akademik-takvim');
  const tabs = $('.tabs__title').map((_, t) => {
    // Dönem başlıkları (h3) ve satırlar aynı akışta sırayla gelir: her başlık yeni dönemi başlatır
    const content = $(t).next('.tabs__content');
    const terms = [];
    content.find('.timeline__header, .timeline__item').each((_, el) => {
      if ($(el).hasClass('timeline__header')) return void terms.push({ title: txt($(el).text()), items: [] });
      const when = txt($(el).find('h4').first().text());
      const [start, end] = parseRange(when);
      const what = txt($(el).clone().find('h4').remove().end().text());
      if (!terms.length) terms.push({ title: '', items: [] });
      if (what) terms.at(-1).items.push({ when, what, start, end });
    });
    terms.splice(0, terms.length, ...terms.filter(x => x.items.length));
    return { title: txt($(t).text()), terms };
  }).get().filter(x => x.terms.length);
  if (!tabs.length) throw new Error('Akademik takvim okunamadı');
  return { source: BASE + '/tr/akademik-takvim', tabs };
}

// ---------- Fakülteler, bölümler ve akademik kadro ----------
export async function faculties() {
  const $ = await page('/tr/akademik');
  const list = $('li.fakulte-listesi__item').map((_, li) => ({
    title: txt($(li).find('.fakulte-listesi__item__block__bilgi__header').first().text()),
    units: $(li).find('a[href^="/tr/bolum/"]').map((_, a) => {
      const slug = ($(a).attr('href').match(/^\/tr\/bolum\/([\w-]+)$/) || [])[1];
      return slug ? [{ name: txt($(a).text()), slug, staffUrl: `${BASE}/tr/bolum/${slug}/akademik-kadro`, pageUrl: `${BASE}/tr/bolum/${slug}` }] : [];
    }).get(),
  })).get().filter(f => f.title && f.units.length);
  // Aynı bölüm birden çok yerde geçebilir: ilk göründüğü fakültede kalsın
  const seen = new Set();
  for (const f of list) f.units = f.units.filter(u => !seen.has(u.slug) && seen.add(u.slug));
  return { faculties: list.filter(f => f.units.length) };
}

// Bir bölümün kadro sayfası: kişiler, eğitim, araştırma alanları, iş deneyimi ve bağlantıları (uygulamanın içinde gösterilir).
export async function staff(slug) {
  if (!/^[\w-]+$/.test(slug || '')) throw new Error('Geçersiz bölüm');
  const $ = await page(`/tr/bolum/${slug}/akademik-kadro`);
  const people = $('article.user-list__item').map((_, a) => {
    const el = $(a), h3 = el.find('h3').first(), name = txt(h3.find('strong').text());
    if (!name) return [];
    const img = el.find('.user-list__item__content img').attr('src');
    const contact = el.find('h4').filter((_, h) => /Bağlantı/.test($(h).text())).first().parent();
    return [{ id: el.attr('id') || '', name, title: txt(txt(h3.text()).replace(name, '').replace(/^\s*,\s*/, '')),
      role: txt(el.find('.user-list__item__content > span').first().text()),
      photo: img ? new URL(img, BASE).href : null,
      education: el.find('.timeline__item').map((_, t) => ({ year: $(t).attr('data-year') || '', degree: txt($(t).find('h5').text()),
        school: txt($(t).find('strong').text()), field: txt($(t).find('span').first().text()) })).get().filter(e => e.degree || e.school),
      research: el.find('.user-list__detail__info__arastirma li').map((_, l) => txt($(l).text())).get().filter(Boolean),
      experience: el.find('.user-list__detail__info__deneyim li').map((_, l) => ({ place: txt($(l).find('strong').text()), role: txt($(l).find('span').text()) })).get().filter(e => e.place || e.role),
      links: contact.find('li').map((_, l) => {
        const link = $(l).find('a').first(), href = link.attr('href');
        return { text: txt($(l).text()), href: href ? new URL(href, BASE).href : null };
      }).get().filter(l => l.text) }];
  }).get();
  return { people };
}

// Bütün bölümlerin kadro sayfalarından ad -> { unvan, bölüm, profil bağlantısı } dizini (aramada kullanılır).
export async function staffIndex() {
  const { faculties: fs } = await faculties();
  const units = fs.flatMap(f => f.units.map(u => ({ ...u, faculty: f.title })));
  const people = [];
  for (let i = 0; i < units.length; i += 4) {                         // okulun sitesini yormamak için 4'erli
    await Promise.all(units.slice(i, i + 4).map(async u => {
      const $ = await page(`/tr/bolum/${u.slug}/akademik-kadro`).catch(() => null);
      $?.('article.user-list__item').each((_, a) => {
        const h3 = $(a).find('h3').first();
        const name = txt(h3.find('strong').text());
        if (!name) return;
        people.push({ name, title: txt(txt(h3.text()).replace(name, '').replace(/^\s*,\s*/, '')), role: txt($(a).find('.user-list__item__content > span').first().text()),
          unit: u.name, faculty: u.faculty, url: `${u.staffUrl}#${$(a).attr('id') || ''}` });
      });
    }));
  }
  return { people, at: Date.now() };
}
