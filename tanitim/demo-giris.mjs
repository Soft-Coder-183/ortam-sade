// GitHub Pages demosu (docs/demo/, soft-coder-183.github.io/ortam-sade/demo/): uygulamanın arayüzü, sunucu yerine tarayıcıda
// çalışan sahte veriyle. Bütün /api/* istekleri tanitim/veri.mjs'in yanıtlayıcısına gider; okula ya da başka bir yere istek
// çıkmaz. Herkese açık veriden yalnızca ders programı verisi ve akademik takvim, derleme anındaki kopyasıyla gelir
// (tanitim/demo.mjs). Saat, sahte verinin "şimdi"sine (SIMDI) kaydırılır ki dersler, sınavlar ve bildirimler tutarlı görünsün.
import { yanitla, yeniDurum, SIMDI } from './veri.mjs';
import ANLIK from 'demo:anlik';

// ---------- saat ----------
const fark = SIMDI - Date.now();
const GercekDate = Date;
class DemoDate extends GercekDate {
  constructor(...a) { if (a.length) super(...a); else super(GercekDate.now() + fark); }
  static now() { return GercekDate.now() + fark; }
}
window.Date = DemoDate;

// ---------- sahte sunucu ----------
const d = yeniDurum({ email: 'ada.ornek@etu.edu.tr', ortam: true, gecikme: 150 });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const KAPALI = { error: 'Tanıtım sürümünde bu bölüm kapalı: gerçek uygulamada okulun herkese açık sitesinden gelir.' };

async function sahte(url, init = {}) {
  const u = new URL(url, location.origin);
  const ad = u.pathname.slice(5);
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET') {
    if (ad === 'program') return json(ANLIK.program);
    if (ad === 'etu-takvim') return json(ANLIK.takvim);
    if (ad === 'hatirlatmalar') return json({ days: 10, items: [] });
  }
  if (/^(etu-|mevzuat|rezervasyon)/.test(ad)) return json(KAPALI, 503);
  // veri.mjs Playwright'ın route nesnesini bekler: aynı arayüz burada Response'a çevrilir
  return new Promise(resolve => {
    const route = {
      request: () => ({ url: () => u.href, method: () => method, postData: () => (typeof init.body === 'string' ? init.body : null) }),
      fulfill: ({ status = 200, contentType, headers = {}, body = '' }) =>
        resolve(new Response(body, { status, headers: { ...headers, ...(contentType ? { 'Content-Type': contentType } : {}) } })),
      continue: () => resolve(json(KAPALI, 503)),
    };
    yanitla(route, d).catch(e => resolve(json({ error: e.message }, 500)));
  });
}

const gercekFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  return /^\/api\//.test(url) || url.startsWith(location.origin + '/api/') ? sahte(url, init) : gercekFetch(input, init);
};

// PDF'ler tarayıcıda yeni sekmede açılır (app.js showPdf): sahte dosya bir blob adresiyle açılır
const gercekOpen = window.open.bind(window);
window.open = (url, ...rest) => {
  if (typeof url !== 'string' || !url.startsWith('/api/')) return gercekOpen(url, ...rest);
  const w = gercekOpen('', ...rest);
  if (w) sahte(url).then(r => r.blob()).then(b => { w.location.href = URL.createObjectURL(b); });
  return w;
};
