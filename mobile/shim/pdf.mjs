// server/pdf.mjs'in Android karşılığı: aynı şablon, görünmez WebView'in yazdırma çıktısıyla PDF'e çevrilir (Pdf.kt).
import { Buffer } from 'buffer';
import { pdfHtml } from '../../server/pdf-sablon.mjs';

export async function htmlToPdf(title, html) {
  const r = await globalThis.__call(id => globalThis.Native.htmlToPdf(id, pdfHtml(title, html)));
  return Buffer.from(globalThis.Native.takeBody(r.id), 'base64');
}
