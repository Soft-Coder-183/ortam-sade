// Derslerim birleştirmesi: Ortam'daki dersler + Uzak'taki ders sayfaları + Piazza sınıfları, ders koduna göre eşleşir.
// Her kaynak tek istek atar (Ortam /derslerim, Uzak ders listesi servisi, Piazza user.status); biri açılamazsa
// diğerleri yine gösterilir ve hangi kaynağın eksik olduğu bildirilir.
import * as ortam from './ortam.mjs';
import { moodle } from './moodle.mjs';
import * as piazza from './piazza.mjs';
import { LoginRequired } from './session.mjs';

// "BİL 214.1", "[BİL 214.1] Sistem Programlama", "BIL 345", "BİL 214.1-2026Güz" -> "BIL214"
export function courseKey(s) {
  const up = String(s ?? '').toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
  const m = up.match(/\b([A-Z]{2,4})\s*(\d{3})\b/);
  return m ? m[1] + m[2] : null;
}

const outcome = r => (r.status === 'fulfilled' ? 'ok' : r.reason instanceof LoginRequired ? 'login' : 'error');

export async function derslerim() {
  const [o, u, p] = await Promise.allSettled([ortam.courses(), moodle('uzak').courses(), piazza.classes()]);
  const list = [];
  const byKey = new Map();
  const entry = (key, code, name) => {
    if (key && byKey.has(key)) return byKey.get(key);
    const e = { key: key || code, code, name, ortamId: null, uzak: null, piazza: null };
    list.push(e);
    if (key) byKey.set(key, e);
    return e;
  };
  for (const c of o.value?.courses ?? []) entry(courseKey(c.code), c.code, c.name).ortamId = c.id;

  // Uzak: Ortam'da karşılığı olmayan ders yalnızca eşleşen derslerle aynı dönemdeyse eklenir (eski dönemler karışmasın).
  const uz = (u.value ?? []).map(c => ({ ...c, key: courseKey(c.name) ?? courseKey(c.short) }));
  const terms = uz.filter(c => byKey.has(c.key)).map(c => c.category);
  for (const c of uz) {
    if (!byKey.has(c.key) && terms.length && !terms.includes(c.category)) continue;
    const code = (c.name.match(/^\[([^\]]+)\]/) || [])[1] || c.short;
    entry(c.key, code, c.name.replace(/^\[[^\]]+\]\s*/, '')).uzak = { id: c.id, name: c.name };
  }
  for (const n of (p.value ?? []).filter(x => x.active)) {
    entry(courseKey(n.code), n.code, n.name).piazza = { id: n.id, name: n.name, fresh: n.fresh };
  }
  const why = r => (r.status === 'rejected' ? r.reason.message : null);
  return {
    courses: list,
    sources: { ortam: outcome(o), uzak: outcome(u), piazza: outcome(p) },
    errors: { ortam: why(o), uzak: why(u), piazza: why(p) },
  };
}
