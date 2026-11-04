// Ortalama ve ders planı için veri: UBS transkripti (tüm denemeler ve notlar) + Ortam müfredatı (yarıyıllara göre dersler).
// Hesaplamalar arayüzde yapılır (öğrencinin seçtiği hedef notlarla anında); burada yalnızca veri birleştirilir.
// Kurallar: TOBB ETÜ Lisans Eğitim-Öğretim ve Sınav Yönetmeliği — md. 16 (kredi yükü: program kredisinin en az %9'u,
// en çok %16'sı), md. 25 (tekrar: son alınan not geçerli; CC–BA notlu derslerden en fazla 5 ders tekrar), md. 27 (katsayılar),
// md. 30 (ortalamalar, iki basamağa yuvarlanır), md. 32 (sınamalı/başarısız öğrencilerin yeni ders sınırları).
import * as ubs from './ubs.mjs';
import * as ortam from './ortam.mjs';

const GRADES = new Set(['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FF']);
const IMPROVE = new Set(['CC', 'CB', 'BB', 'BA']);       // md. 25/3: bu notlarla tekrar, 5 ders hakkından düşer
const num = s => parseFloat(String(s ?? '').replace(',', '.')) || 0;
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();

function nextTermName(name) {
  const m = /(\d{4})\s*-\s*(\d{4})\s+(Güz|Bahar|Yaz)/.exec(name || '');
  if (!m) return '';
  const [, a, b, t] = m;
  return t === 'Güz' ? `${a}-${b} Bahar` : t === 'Bahar' ? `${a}-${b} Yaz` : `${+a + 1}-${+b + 1} Güz`;
}

export async function plan() {
  const [t, m] = await Promise.allSettled([ubs.page('/Ogrenci/Ogr0204/Default.aspx?lang=tr-TR'), ortam.mufredat()]);
  if (t.status === 'rejected') throw t.reason;
  const tr = t.value;
  if (tr.kind !== 'transcript') throw new Error('Transkript okunamadı');

  // Notlu bütün denemeler, zaman sırasıyla (aynı dersin sonraki denemesi öncekinin yerine geçer)
  const attempts = tr.terms.flatMap((s, ti) => s.courses.filter(c => GRADES.has(c.grade))
    .map(c => ({ code: norm(c.code), name: c.name, credit: num(c.credit), ects: num(c.ects), grade: c.grade, term: s.name, ti })));
  // Bu dönem: notu henüz girilmemiş dersler (son dönemde)
  const last = tr.terms.at(-1);
  const currentTerm = last && last.courses.some(c => !GRADES.has(c.grade)) ? last : null;
  const current = (currentTerm?.courses ?? []).filter(c => !GRADES.has(c.grade)).map(c => {
    const code = norm(c.code);
    const prev = [...attempts].reverse().find(a => a.code === code);
    return { code, name: c.name, credit: num(c.credit), ects: num(c.ects), prev: prev ? { grade: prev.grade, term: prev.term } : null };
  });

  // Not yükseltme hakkı (md. 25/3): CC–BA notundan sonra yeniden alınmış dersler
  const later = (code, ti) => attempts.some(a => a.code === code && a.ti > ti) || current.some(c => c.code === code);
  const improveUsed = new Set(attempts.filter(a => IMPROVE.has(a.grade) && later(a.code, a.ti)).map(a => a.code)).size;

  const curriculum = m.status === 'fulfilled' ? m.value.terms.map(s => ({
    sem: parseInt(s.term, 10) || null, title: s.term,
    courses: s.courses.map(c => ({ code: norm(c.code), name: c.name, credit: num(c.credit), ects: num(c.ects), grade: c.grade || '', status: c.status || '', elective: c.elective || '' })),
  })) : [];
  const programCredits = curriculum.reduce((a, s) => a + s.courses.reduce((b, c) => b + c.credit, 0), 0) || null;
  const currentSem = tr.terms.length;                     // hazırlık hariç kaçıncı dönem
  const nextSem = curriculum.find(s => s.sem > currentSem && s.courses.some(c => c.credit > 0))?.sem ?? currentSem + 1;
  return {
    gano: tr.gano, totals: tr.totals, attempts, current,
    currentTerm: currentTerm?.name || '', nextTerm: nextTermName(currentTerm?.name || last?.name), currentSem, nextSem,
    curriculum, curriculumError: m.status === 'rejected' ? m.reason.message : null,
    programCredits,
    limits: programCredits ? { min: Math.floor(programCredits * 0.09), max: Math.ceil(programCredits * 0.16) } : null,
    improveUsed, improveMax: 5,
  };
}
