// UBS sayfalarını ve transkripti kendi şablonumuzla PDF'e çevirir (görünmez Chrome). Okulun kendi PDF çıktılarında
// Türkçe karakterler bozuk geldiği için hepsi buradan üretilir. Tarayıcı ilk istekte açılır, bir süre kullanılmazsa kapanır.
import { chromium } from 'playwright-core';
import { CHANNEL } from './browser.mjs';
import { pdfHtml, esc } from './pdf-sablon.mjs';

const IDLE = 60_000;
let browser = null;
let idleTimer = null;

async function getBrowser() {
  clearTimeout(idleTimer);
  if (!browser) browser = chromium.launch({ channel: CHANNEL, headless: true });
  const b = await browser.catch(e => { browser = null; throw e; });
  if (!b.isConnected()) { browser = null; return getBrowser(); }
  idleTimer = setTimeout(() => { browser = null; b.close().catch(() => {}); }, IDLE);
  return b;
}

// html: önceden sadeleştirilmiş içerik (script yok). Sayfa dışarıya hiçbir istek yapamaz.
export async function htmlToPdf(title, html) {
  const b = await getBrowser();
  const ctx = await b.newContext({ javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', r => r.abort());
    const date = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await page.setContent(pdfHtml(title, html), { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font:7pt Segoe UI,Arial,sans-serif;color:#8a93a6;width:100%;padding:0 14mm;display:flex;justify-content:space-between">
        <span>${esc(title)}</span><span>${date}</span></div>`,
      footerTemplate: `<div style="font:7pt Segoe UI,Arial,sans-serif;color:#8a93a6;width:100%;padding:0 14mm;display:flex;justify-content:space-between">
        <span>UBS'den alınmıştır · resmi belge değildir</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await ctx.close().catch(() => {});
  }
}
