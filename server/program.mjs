// Dönem ders programı (Açılan Dersler ve haftalık ders planı için): uygulamayla birlikte gelen veri dosyası.
// data/ders-programi.json: { term, updated, courses: [{ c: kod, n: ad, s: [{ s: şube, h: hoca, m: [[gün, başlangıç, bitiş, derslik]] }] }] }
// Dönem başında dosya yenilenir ve yeni sürümle dağıtılır; ekranda son güncelleme tarihi gösterilir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ders-programi.json');
let cache = null;
export function get() {
  cache ??= JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return cache;
}
