// UBS sayfalarını ve transkripti kendi şablonumuzla PDF'e çevirir (görünmez Chrome). Okulun kendi PDF çıktılarında
// Türkçe karakterler bozuk geldiği için hepsi buradan üretilir. Tarayıcı ilk istekte açılır, bir süre kullanılmazsa kapanır.
import { chromium } from 'playwright-core';
import { CHANNEL } from './session.mjs';

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

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// TOBB ETÜ mavisi başlıklarda, turuncu ince vurgu; tablolar yoğun ama okunur.
const CSS = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font: 9.5pt/1.45 "Segoe UI", "Noto Sans", Arial, sans-serif; color: #14213d; margin: 0; }
  header.doc { border-bottom: 2.5pt solid #1f4e96; padding-bottom: 6pt; margin-bottom: 10pt; }
  header.doc .uni { color: #1f4e96; font-weight: 700; font-size: 10pt; letter-spacing: .02em; }
  header.doc h1 { font-size: 16pt; margin: 2pt 0 0; }
  header.doc .bar { height: 2pt; width: 60pt; background: #d97000; margin-top: 4pt; }
  h2 { font-size: 11.5pt; color: #1f4e96; margin: 14pt 0 5pt; padding-bottom: 2pt; border-bottom: .75pt solid #dde3ee; break-after: avoid; }
  h3 { font-size: 10pt; margin: 10pt 0 4pt; break-after: avoid; }
  p { margin: 3pt 0; }
  .muted { color: #5a6478; }
  table { width: 100%; border-collapse: collapse; margin: 3pt 0 6pt; }
  th { text-align: left; font-weight: 600; color: #5a6478; font-size: 8.5pt; border-bottom: 1pt solid #1f4e96; padding: 3pt 5pt; }
  td { padding: 3pt 5pt; border-bottom: .5pt solid #dde3ee; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f6f8fc; }
  tr { break-inside: avoid; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  .code { white-space: nowrap; font-weight: 600; }
  .grade { display: inline-block; min-width: 22pt; text-align: center; font-weight: 700; padding: 0 3pt; border-radius: 3pt; background: #e6eef9; }
  .grade.g-a { color: #1b7a3a; } .grade.g-f { color: #c0262d; }
  dl.kv, dl.u-kv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2pt 18pt; margin: 4pt 0 8pt; }
  dl.kv > div, dl.u-kv > div { display: flex; gap: 8pt; border-bottom: .5pt solid #eef1f6; padding: 2pt 0; }
  dt { color: #5a6478; min-width: 95pt; } dd { margin: 0; font-weight: 600; }
  .summary { display: flex; gap: 10pt; margin: 6pt 0 4pt; }
  .summary > div { flex: 1; border: .75pt solid #dde3ee; border-left: 3pt solid #d97000; border-radius: 4pt; padding: 5pt 8pt; }
  .summary span { display: block; color: #5a6478; font-size: 8pt; } .summary b { font-size: 13pt; }
  section.term { break-inside: avoid-page; }
  table.sum th, table.sum td { font-size: 8.5pt; background: none !important; }
  table.sum { margin-top: 0; } table.sum tbody th { border-bottom: .5pt solid #dde3ee; color: #14213d; }
  .u-sec { margin: 6pt 0; } .u-note { color: #5a6478; }
  .u-check { display: inline-flex; gap: 4pt; margin-right: 10pt; }`;

// html: önceden sadeleştirilmiş içerik (script yok). Sayfa dışarıya hiçbir istek yapamaz.
export async function htmlToPdf(title, html) {
  const b = await getBrowser();
  const ctx = await b.newContext({ javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', r => r.abort());
    const date = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await page.setContent(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head>
      <body><header class="doc"><div class="uni">TOBB Ekonomi ve Teknoloji Üniversitesi</div><h1>${esc(title)}</h1><div class="bar"></div></header>${html}</body></html>`, { waitUntil: 'load' });
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
