// README ekran görüntüleri (docs/ekran/*.png): node tanitim/ekran.mjs. Sahte öğrenci verisi (veri.mjs); sunucu açılmaz, okula istek gitmez,
// arayüz dosyaları diskten verilir. Telefon görüntüsünde mobile/metinler.mjs değişimleri uygulanır (ETÜ Cep metinleri).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { yanitla, yeniDurum, SIMDI } from './veri.mjs';
import { TELEFON } from '../mobile/metinler.mjs';
import * as program from '../server/program.mjs';

const ROOT = path.resolve('public');
const OUT = path.resolve('docs/ekran');
fs.mkdirSync(OUT, { recursive: true });
const SAAT = `(() => { const fark = ${SIMDI} - Date.now(); const A = Date;
  class S extends A { constructor(...a) { if (a.length) super(...a); else super(A.now() + fark); } static now() { return A.now() + fark; } }
  window.Date = S; })();`;

async function sayfa(b, { w, h, telefon = false, tema = 'light', hazirlik = '' }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: tema });
  await ctx.addInitScript(SAAT + hazirlik);
  const d = yeniDurum({ email: 'ada.ornek@etu.edu.tr', ortam: true, gecikme: 0 });
  await ctx.route('http://t.local/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/program') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(program.get()) });
    if (u.pathname === '/api/hatirlatmalar') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ days: 10, items: [] }) });
    if (/^\/api\/(etu-|mevzuat|rezervasyon)/.test(u.pathname)) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (u.pathname.startsWith('/api/')) return yanitla(r, d);
    const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream';
    let body = fs.readFileSync(f);
    if (telefon && f.endsWith('app.js')) { let s = body.toString('utf8'); for (const [a, c] of TELEFON) s = s.split(a).join(c); body = s; }
    r.fulfill({ status: 200, contentType: type, body });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('HATA', e.message));
  return p;
}

const b = await chromium.launch({ channel: 'chrome', args: ['--force-color-profile=srgb'] });

// 1) Windows: Ana Sayfa
let p = await sayfa(b, { w: 1440, h: 900 });
await p.goto('http://t.local/#/anasayfa');
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, 'windows-anasayfa.png') });

// 2) Telefon (ETÜ Cep): Ana Sayfa
p = await sayfa(b, { w: 390, h: 844, telefon: true });
await p.goto('http://t.local/#/anasayfa');
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, 'telefon-anasayfa.png') });

// 3) Açılan Dersler: dersler eklenir, şubeler seçilir
p = await sayfa(b, { w: 1440, h: 1000 });
await p.goto('http://t.local/#/ekstra/acilan');
await p.waitForSelector('.ac-search');
for (const kod of ['BİL 331', 'MAT 202', 'BİL 214', 'ELE 224']) { await p.fill('[data-ac-q]', kod); await p.waitForTimeout(250); await p.keyboard.press('Enter'); await p.waitForTimeout(300); }
for (const sec of ['MAT 202|2', 'BİL 214|2']) await p.click(`.pl-cal [data-pl-pick="${sec}"]`).catch(e => console.log('seçilemedi', sec, e.message.split('\n')[0]));
await p.waitForTimeout(600);
const cal = await p.$('.pl-cal');
await cal.scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, -90));
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'acilan-dersler.png') });
await b.close();
console.log('tamam', fs.readdirSync(OUT));
