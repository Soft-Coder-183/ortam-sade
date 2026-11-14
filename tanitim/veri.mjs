// Tanıtım videosunun örnek verisi. Buradaki öğrenci, hocalar, notlar, e-postalar ve gönderilerin HEPSİ UYDURMADIR; gerçek bir
// hesaptan alınmış tek satır yoktur. Kişisel uçların tümü buradan yanıtlanır; herkese açık olanlar (Açılan Dersler verisi,
// Akademik Takvim, Mevzuat…) uygulamanın kendi sunucusuna bırakılır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
// Videodaki "şimdi": Salı 17 Kasım 2026, 10:42 (BİL 212 dersinin ortası, ara sınav haftası)
export const SIMDI = Date.parse('2026-11-17T10:42:00+03:00');
const GECE = Date.parse('2026-11-17T00:00:00+03:00');
const gun = n => GECE + n * 864e5;
const tarih = n => new Date(gun(n) + 3 * 3600e3).toISOString().slice(0, 10).split('-').reverse().join('.');
const dk = n => SIMDI - n * 60_000;

export const OGRENCI = { ad: 'Ada Örnek', eposta: 'ada.ornek@etu.edu.tr' };
const kimlik = { name: 'ADA ÖRNEK', program: 'Bilgisayar Mühendisliği', number: '231101042', email: OGRENCI.eposta, advisor: 'Selin KARACA', advisorEmail: 'ornek.danisman@etu.edu.tr' };

// ---------- dersler ----------
const DERSLER = [
  { key: 'BIL212', kod: 'BİL 212', sube: 1, ad: 'Veri Yapıları', kr: 4, akts: 7, hoca: 'Doç. Dr. Emre TUNA', uzak: 4101, piazza: 'pz212', oid: '611201' },
  { key: 'BIL214', kod: 'BİL 214', sube: 2, ad: 'Sistem Programlama', kr: 4, akts: 7, hoca: 'Dr. Öğr. Üyesi Zeynep ARAS', uzak: 4102, piazza: 'pz214', oid: '611202' },
  { key: 'BIL245', kod: 'BİL 245', sube: 1, ad: 'Doğrusal Cebir ve Uygulamaları', kr: 3, akts: 5, hoca: 'Prof. Dr. Kerem ÖZBEK', uzak: 4103, piazza: null, oid: '611203' },
  { key: 'BIL265', kod: 'BİL 265', sube: 1, ad: 'Mantık Devresi Tasarımı ve Uygulamaları', kr: 4, akts: 7, hoca: 'Dr. Öğr. Üyesi Burak ŞEN', uzak: 4104, piazza: 'pz265', oid: '611204' },
  { key: 'MAT202', kod: 'MAT 202', sube: 3, ad: 'Diferansiyel Denklemler', kr: 4, akts: 6, hoca: 'Doç. Dr. Elif DURU', uzak: 4105, piazza: null, oid: '611205' },
  { key: 'TAR101', kod: 'TAR 101', sube: 1, ad: 'Uygarlıklar Tarihi', kr: 2, akts: 3, hoca: 'Dr. Öğr. Üyesi Can YALIN', uzak: null, piazza: null, oid: '611206' },
];
const ders = key => DERSLER.find(d => d.key === key);
const PIAZZA = [
  { id: 'pz214', name: 'Sistem Programlama', code: 'BİL 214', term: 'Güz 2026', active: true, fresh: 2 },
  { id: 'pz212', name: 'Veri Yapıları', code: 'BİL 212', term: 'Güz 2026', active: true, fresh: 0 },
  { id: 'pz265', name: 'Mantık Devresi Tasarımı ve Uygulamaları', code: 'BİL 265', term: 'Güz 2026', active: true, fresh: 0 },
  { id: 'pz142', name: 'Bilgisayar Programlama II', code: 'BİL 142', term: 'Bahar 2026', active: false, fresh: 0 },
  { id: 'pz113', name: 'Bilgisayar Programlama I', code: 'BİL 113', term: 'Güz 2025', active: false, fresh: 0 },
].map(p => ({ ...p, sections: [{ name: 'lecture_notes', title: 'Ders Notları' }, { name: 'homework', title: 'Ödevler' }] }));

const derslerim = () => ({
  courses: DERSLER.map(d => ({ key: d.key, code: `${d.kod}.${d.sube}`, name: d.ad, ortamId: d.oid,
    uzak: d.uzak ? { id: d.uzak, name: `[${d.kod}.${d.sube}] ${d.ad}` } : null,
    piazza: d.piazza ? { id: d.piazza, fresh: PIAZZA.find(p => p.id === d.piazza).fresh } : null })),
  sources: { ortam: 'ok', uzak: 'ok', piazza: 'ok' }, errors: { ortam: null, uzak: null, piazza: null },
});

// ---------- ders programı ----------
const SAATLER = ['8:30 - 9:20', '9:30 - 10:20', '10:30 - 11:20', '11:30 - 12:20', '12:30 - 13:20', '13:30 - 14:20', '14:30 - 15:20', '15:30 - 16:20',
  '16:30 - 17:20', '17:30 - 18:20', '18:30 - 19:20', '19:30 - 20:20', '20:30 - 21:20'];
// [gün (0 = Pazartesi), ilk saat, son saat, ders, derslik, yüz yüze]
const PROGRAM = [
  [0, 1, 2, 'BIL214', 'Amfi 2', true], [0, 5, 6, 'BIL245', '204', true],
  [1, 0, 1, 'MAT202', '106', true], [1, 2, 3, 'BIL212', 'Amfi 1', true], [1, 5, 6, 'BIL265', '301', true],
  [2, 2, 3, 'BIL214', 'Amfi 2', true], [2, 7, 8, 'TAR101', 'Çevrimiçi', false],
  [3, 0, 1, 'BIL212', 'Amfi 1', true], [3, 3, 4, 'MAT202', '106', true], [3, 6, 7, 'BIL265', 'Lab 3', true],
  [4, 2, 3, 'BIL245', '204', true], [4, 5, 6, 'BIL212', 'Lab 1', true],
];
const schedule = () => ({
  days: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
  slots: SAATLER.map((time, i) => ({ time, cells: [0, 1, 2, 3, 4, 5, 6].map(g => {
    const p = PROGRAM.find(x => x[0] === g && i >= x[1] && i <= x[2]);
    if (!p) return null;
    const d = ders(p[3]);
    return { code: `${d.kod}.${d.sube}`, room: p[4], name: d.ad, instructor: d.hoca.split(' ').slice(-2).join(' '), inPerson: p[5] };
  }) })),
});

const SINAVLAR = [[-1, 'TAR101', '17:30', '19:00', 'Çevrimiçi', 'Çevrimiçi'], [2, 'MAT202', '18:30', '20:00', 'Amfi 3', 'Yüz Yüze'],
  [4, 'BIL212', '10:00', '11:30', 'Amfi 1 · Amfi 2', 'Yüz Yüze'], [7, 'BIL245', '13:00', '14:30', '204', 'Yüz Yüze'],
  [9, 'BIL214', '18:30', '20:30', 'Amfi 2', 'Yüz Yüze'], [11, 'BIL265', '10:00', '12:00', '301 · 302', 'Yüz Yüze']];
const exams = () => ({ active: { kind: 'ara', label: 'Ara Sınav' }, exams: SINAVLAR.map(([n, k, start, end, room, type]) =>
  ({ code: ders(k).kod, name: ders(k).ad, dateText: tarih(n), ts: gun(n), room, start, end, type, proctor: 'Var' })) });

// ---------- notlar, transkript, müfredat, plan ----------
const GECMIS = [
  { term: '2025-2026 Güz', sem: 1, dersler: [['BİL 113', 'Bilgisayar Programlama I', 4, 7, 'AA'], ['MAT 101', 'Matematik I', 4, 7, 'BA'], ['FİZ 101', 'Fizik I', 4, 6, 'BB'],
    ['BİL 121', 'Bilişim Teknolojilerine ve Yapay Zekâya Giriş', 3, 5, 'AA'], ['TÜR 101', 'Türk Dili I', 2, 2, 'BA'], ['OEG 101', 'Ortak Eğitime Giriş', 1, 3, 'AA']] },
  { term: '2025-2026 Bahar', sem: 2, dersler: [['BİL 142', 'Bilgisayar Programlama II', 4, 7, 'BA'], ['BİL 132', 'Bilgisayar Bilimleri için Ayrık Matematik', 4, 7, 'BB'],
    ['MAT 102', 'Matematik II', 4, 7, 'CB'], ['FİZ 102', 'Fizik II', 4, 6, 'CC'], ['TÜR 102', 'Türk Dili II', 2, 3, 'AA']] },
];
const BU_DONEM = '2026-2027 Güz';
const SONRAKI = [
  [4, [['BİL 331', 'Algoritma Analizi', 4, 7], ['BİL 361', 'Bilgisayar Mimarisi ve Organizasyonu', 4, 7], ['BİL 345', 'Olasılık Teorisi', 3, 5], ['BİL 372', 'Veritabanı Sistemleri', 4, 7],
    ['TAR 102', 'Atatürk İlkeleri ve İnkılap Tarihi', 2, 3], ['İYD 1', 'İkinci Yabancı Dil I', 3, 4, 'Seçmeli']]],
  [5, [['OEG 300', 'Ortak Eğitim I', 0, 30]]],
  [6, [['BİL 334', 'Biçimsel Diller ve Otomata', 4, 7], ['BİL 395', 'Programlama Dilleri', 4, 7], ['BİL 362', 'Mikroişlemciler', 4, 7], ['İYD 2', 'İkinci Yabancı Dil II', 3, 4, 'Seçmeli']]],
  [7, [['BİL 461', 'İşletim Sistemleri', 4, 7], ['BİL 481', 'Yazılım Mühendisliği', 4, 7], ['BİL 495', 'Bitirme Projesi I', 2, 5], ['TSD 1', 'Teknik Seçmeli Ders I', 3, 6, 'Seçmeli']]],
  [8, [['BİL 496', 'Bitirme Projesi II', 4, 8], ['BİL 452', 'Bilgisayar Ağları', 4, 7], ['TSD 2', 'Teknik Seçmeli Ders II', 3, 6, 'Seçmeli']]],
];
const GP = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2 };
const tr2 = x => x.toFixed(2).replace('.', ',');
const mufDonemleri = () => [
  ...GECMIS.map(g => ({ sem: g.sem, courses: g.dersler.map(([code, name, credit, ects, grade]) => ({ code, name, credit, ects, grade, status: 'Başarılı', elective: '' })) })),
  { sem: 3, courses: DERSLER.map(d => ({ code: d.kod, name: d.ad, credit: d.kr, ects: d.akts, grade: '', status: 'Bu dönem alıyor', elective: '' })) },
  ...SONRAKI.map(([sem, l]) => ({ sem, courses: l.map(([code, name, credit, ects, elective = '']) => ({ code, name, credit, ects, grade: '', status: 'Alınmadı', elective })) })),
];
const mufredat = () => {
  const terms = mufDonemleri().map(s => ({ term: `${s.sem}. Dönem`, courses: s.courses.map(c => ({ ...c, credit: c.credit.toFixed(2), ects: c.ects.toFixed(2) })) }));
  return { identity: kimlik, terms, programs: [{ name: 'Ana Dal', terms }] };
};
const toplam = list => { const kr = list.reduce((a, c) => a + c[2], 0), ak = list.reduce((a, c) => a + c[3], 0), p = list.reduce((a, c) => a + c[2] * GP[c[4]], 0); return { kr, ak, p }; };
const TUM = toplam(GECMIS.flatMap(g => g.dersler));
const TOPLAMLAR = { credit: String(TUM.kr), ects: String(TUM.ak), doneCredit: String(TUM.kr), doneEcts: String(TUM.ak), points: tr2(TUM.p), yano: '-', gano: tr2(TUM.p / TUM.kr) };
const plan = () => ({
  gano: TOPLAMLAR.gano, totals: TOPLAMLAR,
  attempts: GECMIS.flatMap((g, ti) => g.dersler.map(([code, name, credit, ects, grade]) => ({ code, name, credit, ects, grade, term: g.term, ti }))),
  current: DERSLER.map(d => ({ code: d.kod, name: d.ad, credit: d.kr, ects: d.akts, prev: null })),
  currentTerm: BU_DONEM, nextTerm: '2026-2027 Bahar', currentSem: 3, nextSem: 4,
  curriculum: mufDonemleri().map(s => ({ ...s, title: `${s.sem}. Dönem` })), curriculumError: null,
  programCredits: 140, limits: { min: 12, max: 23 }, improveUsed: 0, improveMax: 5,
  firstTerm: GECMIS[0].term, courseTerms: [...GECMIS.map(g => g.term), BU_DONEM], withdrawals: [], failedOpen: [],
});
const notlar = () => {
  const donemler = [{ term: BU_DONEM, courses: DERSLER.map(d => ({ code: d.kod, name: d.ad, type: 'Zorunlu', branch: 'Ana Dal', repeat: '', grade: '' })) },
    ...[...GECMIS].reverse().map(g => ({ term: g.term, courses: g.dersler.map(([code, name, , , grade]) => ({ code, name, type: 'Zorunlu', branch: 'Ana Dal', repeat: '', grade })) }))];
  return { identity: kimlik, liste: donemler, donemlik: donemler.map(t => ({ term: t.term, courses: t.courses.map(c => ({ code: c.code, grade: c.grade })) })), survey: null };
};
const transkript = () => {
  let kr = 0, ak = 0, p = 0;
  const terms = GECMIS.map(g => {
    const t = toplam(g.dersler); kr += t.kr; ak += t.ak; p += t.p;
    return { name: g.term, courses: g.dersler.map(([code, name, credit, ects, grade]) => ({ code, name, credit: String(credit), ects: String(ects), grade, note: '' })), count: String(g.dersler.length),
      term: { credit: String(t.kr), ects: String(t.ak), doneCredit: String(t.kr), doneEcts: String(t.ak), points: tr2(t.p), yano: tr2(t.p / t.kr), gano: '-' },
      total: { credit: String(kr), ects: String(ak), doneCredit: String(kr), doneEcts: String(ak), points: tr2(p), yano: '-', gano: tr2(p / kr) } };
  });
  terms.push({ name: BU_DONEM, courses: DERSLER.map(d => ({ code: d.kod, name: d.ad, credit: String(d.kr), ects: String(d.akts), grade: '', note: '' })), count: String(DERSLER.length),
    term: { credit: '21', ects: '35', doneCredit: '0', doneEcts: '0', points: '0,00', yano: '-', gano: '-' }, total: null });
  return { kind: 'transcript', title: 'Başarı Durum Belgesi (Transkript)', date: tarih(0),
    info: [['Adı Soyadı', 'ADA ÖRNEK'], ['Öğrenci No', kimlik.number], ['Fakülte', 'Mühendislik Fakültesi'], ['Bölüm', 'Bilgisayar Mühendisliği'], ['Sınıf', '2'], ['Kayıt Tarihi', '15.09.2025'], ['Öğrenim Durumu', 'Aktif']],
    prep: [], terms, gano: TOPLAMLAR.gano, totals: TOPLAMLAR };
};
const UBS = { name: 'ADA ÖRNEK', unread: 0, announcements: [], menu: [
  { group: 'Öğrenci', items: [['Başarı Durum Belgesi (Transkript)', 'Ogr0204'], ['Dönemlik Ders Programı', 'Ogr0206'], ['Ders Kayıtlanma', 'Ogr0249'], ['Müfredat Durumu', 'Ogr0149'],
    ['Öğrenci Bilgileri', 'Ogr0201'], ['Ödev ve Duyurular', 'Ogr0214'], ['Belge Talebi', 'Ogr0241'], ['Ortak Eğitim İşlemleri', 'Ogr0320']] },
  { group: 'Başvurular', items: [['Yaz Okulu Başvurusu', 'Ogr0260'], ['Yatay Geçiş Başvurusu', 'Ogr0270'], ['Mazeret Sınavı Başvurusu', 'Ogr0280']] },
  { group: 'Genel', items: [['Mesajlar', 'Gen0101'], ['Anketler', 'Gen0110'], ['Konukevi ve Yurt', 'Gen0140']] },
].map(g => ({ group: g.group, items: g.items.map(([name, kod]) => ({ name, path: `/Ogrenci/${kod}/Default.aspx?lang=tr-TR` })) })) };

// ---------- Webmail ----------
const POSTA = [
  { uid: '2041', from: 'Piazza', subject: 'BİL 214: Ödev 3 teslim tarihi uzatıldı', date: 'Bugün 09:58', size: '14 KB', seen: false, flagged: false,
    html: '<p>Merhaba,</p><p>Ödev 3 için teslim tarihi <b>23 Kasım Pazartesi 23:59</b>\'a uzatıldı. Başlangıç dosyaları Piazza kaynaklarında.</p><p>Sorularınızı Piazza üzerinden sorabilirsiniz.</p><p>Zeynep Aras</p>' },
  { uid: '2040', from: 'Öğrenci İşleri', subject: 'Ara sınav programı hakkında', date: 'Bugün 08:15', size: '212 KB', seen: false, flagged: false, attachment: true,
    ekler: [{ part: '2', name: 'ara-sinav-programi.pdf', size: '198 KB', mime: 'application/pdf' }],
    html: '<p>Değerli öğrencimiz,</p><p>2026-2027 Güz dönemi ara sınav programı ekte yer almaktadır. Sınav derslikleri sınavdan bir gün önce Ortam üzerinden duyurulacaktır.</p><p>Başarılar dileriz.</p><p>Öğrenci İşleri Müdürlüğü</p>' },
  { uid: '2038', from: 'Kütüphane', subject: 'Grup çalışma odası rezervasyonunuz onaylandı', date: 'Dün 16:42', size: '9 KB', seen: false, flagged: false,
    html: '<p>Rezervasyonunuz onaylanmıştır.</p><p><b>Oda:</b> Grup Çalışma Odası 2<br><b>Tarih:</b> 18 Kasım Çarşamba, 14:00–16:00</p>' },
  { uid: '2035', from: 'Selin Karaca', subject: 'Re: Danışmanlık görüşmesi', date: 'Dün 11:20', size: '11 KB', seen: true, flagged: true, answered: true,
    html: '<p>Merhaba Ada,</p><p>Perşembe 15:30 benim için uygun. Bahar dönemi ders seçimini de o zaman konuşalım; planını yanında getirirsen iyi olur.</p><p>İyi çalışmalar,<br>Selin Karaca</p>' },
  { uid: '2031', from: 'Ortak Eğitim Ofisi', subject: 'Bahar dönemi ortak eğitim bilgilendirme toplantısı', date: 'Paz 19:03', size: '18 KB', seen: true, flagged: false,
    html: '<p>Bahar döneminde ortak eğitime çıkacak öğrenciler için bilgilendirme toplantısı 25 Kasım Çarşamba 12:30\'da Konferans Salonu\'nda yapılacaktır.</p>' },
  { uid: '2029', from: 'Uzak', subject: 'MAT 202: Hafta 8 çalışma soruları eklendi', date: 'Cmt 14:37', size: '7 KB', seen: true, flagged: false, html: '<p>Derse yeni bir dosya eklendi: <b>Hafta 8 - Çalışma Soruları</b>.</p>' },
  { uid: '2025', from: 'Bilgi İşlem', subject: 'Planlı bakım çalışması (21 Kasım)', date: 'Cum 10:12', size: '8 KB', seen: true, flagged: false, html: '<p>21 Kasım Cumartesi 02:00–04:00 arasında planlı bakım çalışması yapılacaktır.</p>' },
  { uid: '2019', from: 'Robotik Topluluğu', subject: 'Tanışma toplantısı ve atölye duyurusu', date: '12/11/2026 17:45', size: '22 KB', seen: true, flagged: false, html: '<p>Yeni dönem tanışma toplantımız bu hafta!</p>' },
  { uid: '2014', from: 'Emre Tuna', subject: 'BİL 212 proje grupları', date: '11/11/2026 09:30', size: '10 KB', seen: true, flagged: false, html: '<p>Proje gruplarınızı cuma gününe kadar bildirmenizi rica ederim.</p>' },
];
const KLASORLER = [{ id: 'INBOX', name: 'Gelen' }, { id: 'Drafts', name: 'Taslaklar' }, { id: 'Sent', name: 'Gönderilmiş' }, { id: 'Junk', name: 'İstenmeyen' }, { id: 'Trash', name: 'Çöp' }];
const postaSatiri = m => ({ uid: m.uid, mbox: 'INBOX', subject: m.subject, from: m.from, date: m.date, size: m.size, seen: m.seen, flagged: m.flagged, answered: !!m.answered, attachment: !!m.attachment });
const webmail = (d, kutu) => {
  const l = kutu === 'INBOX' ? d.posta : [];
  return { mbox: kutu, folders: KLASORLER, unread: d.posta.filter(m => !m.seen).length, rowcount: `İletiler: 1 - ${l.length} , Toplam: ${kutu === 'INBOX' ? 42 : 0}`,
    messages: l.map(postaSatiri), auto: { enabled: false, notif: true, afterHours: 12, items: {} } };
};
const WM_AYAR = { enabled: false, afterHours: 24, choices: [6, 12, 24, 72], notif: { enabled: true, afterHours: 12 }, instant: { enabled: true, rules: ['Yabancı Diller "New sign in to your … account" e-postaları'], moved: 6 },
  purge: { enabled: true, days: 30, fastDays: 3, deleted: 14 }, lastRun: dk(38), lastMoved: 2, nextRun: dk(-22), totalMoved: 57, lastError: null };

// ---------- Piazza ----------
const GONDERILER = {
  pz214: [
    ['p214a', 61, 'note', 'Ödev 3 teslim tarihi uzatıldı', 'Ödev 3 için teslim tarihi 23 Kasım Pazartesi 23:59\'a uzatıldı. Başlangıç dosyaları kaynaklarda.', 44, true, true, 'Ders hocası'],
    ['p214b', 60, 'question', 'fork() sonrası dosya tanımlayıcıları paylaşılıyor mu?', 'Ödevde ebeveyn süreç dosyayı açtıktan sonra fork çağırıyoruz. Çocuk süreçte aynı tanımlayıcıyı kapatınca…', 95, true, false, 'Öğrenci'],
    ['p214c', 58, 'note', 'Ara sınav kapsamı ve çalışma soruları', 'Ara sınav 1–7. haftaları kapsayacak. Çalışma soruları kaynaklar bölümüne eklendi.', 60 * 26, false, true, 'Ders hocası'],
    ['p214d', 55, 'question', 'Makefile\'da -Wall -Werror zorunlu mu?', 'Derleme bayrakları için ödev metninde bir şey göremedim.', 60 * 50, false, false, 'Öğrenci'],
    ['p214e', 51, 'note', 'Laboratuvar 5: sinyaller', 'Bu haftaki laboratuvarda sinyal işleyicileri yazacağız.', 60 * 74, false, false, 'Ders asistanı'],
    ['p214f', 47, 'question', 'valgrind çıktısında "still reachable" uyarısı', 'Program bitince still reachable: 72 bytes uyarısı alıyorum, puan kırılır mı?', 60 * 120, false, false, 'Öğrenci'],
  ],
};
const gonderiler = nid => (GONDERILER[nid] ?? [
  ['g1', 34, 'note', 'Ara sınav yerleri', 'Sınav derslikleri Ortam\'da duyurulacak.', 60 * 20, false, true, 'Ders hocası'],
  ['g2', 33, 'question', 'Proje grupları kaç kişi olabilir?', 'Gruplar en fazla üç kişi olabilir mi?', 60 * 46, false, false, 'Öğrenci'],
  ['g3', 30, 'note', 'Hafta 7 ders notları yüklendi', 'Notlar kaynaklar bölümünde.', 60 * 96, false, false, 'Ders asistanı'],
]).map(([id, nr, type, subject, snippet, once, isNew, pinned, role]) => ({ id, nr, type, subject, snippet, updated: dk(once), isNew, pinned, instructor: role !== 'Öğrenci', unanswered: false, folders: ['genel'], role }));
const gonderi = (nid, cid) => {
  const g = gonderiler(nid).find(p => p.id === cid || String(p.nr) === cid) ?? gonderiler(nid)[0];
  const ozel = {
    p214a: { html: '<p>Merhaba arkadaşlar,</p><p>Ödev 3 için teslim tarihi <b>23 Kasım Pazartesi 23:59</b>\'a uzatıldı. Başlangıç dosyaları ve test betiği kaynaklar bölümünde.</p><p>Teslimde <code>make test</code> çıktısını da eklemeyi unutmayın.</p>',
      answers: [{ kind: 'Takip tartışması', role: 'Öğrenci', created: dk(31), html: '<p>Geç teslim hakkımız bu ödevde de geçerli mi?</p>',
        replies: [{ html: '<p>Evet, toplam üç günlük geç teslim hakkınız bu ödev için de kullanılabilir.</p>', role: 'Ders asistanı', created: dk(18) }] }] },
    p214b: { html: '<p>Ödevde ebeveyn süreç dosyayı açtıktan sonra <code>fork()</code> çağırıyoruz. Çocuk süreçte aynı tanımlayıcıyı kapatınca ebeveyndeki de kapanıyor mu?</p>',
      answers: [{ kind: 'Hocanın yanıtı', role: 'Ders hocası', created: dk(70), html: '<p>Hayır. <code>fork()</code> tanımlayıcı tablosunu kopyalar; ikisi aynı açık dosya kaydını gösterir ama her süreç kendi tanımlayıcısını ayrı kapatır. Dosya konumu ise ortaktır.</p>', replies: [] },
        { kind: 'Öğrencilerin yanıtı', role: 'Öğrenci', created: dk(82), html: '<p>Ders notlarında 3. haftadaki şekle bakabilirsin, tam bu durumu anlatıyor.</p>', replies: [] }] },
  }[g.id] ?? { html: `<p>${g.snippet}</p>`, answers: g.type === 'question' ? [{ kind: 'Hocanın yanıtı', role: 'Ders hocası', created: g.updated, html: '<p>Ödev metnindeki kurallar geçerli; ayrıntı için ders notlarına bakabilirsiniz.</p>', replies: [] }] : [] };
  return { id: g.id, nr: g.nr, subject: g.subject, created: g.updated, role: g.role, ...ozel };
};
const kaynaklar = nid => ({ nid, sections: [
  { title: 'Ders Notları', items: [['01_Giris_ve_C_Tekrari.pdf', 'Sep 22, 2026'], ['02_Surecler_ve_fork.pdf', 'Sep 29, 2026'], ['03_Dosya_Tanimlayicilari.pdf', 'Oct 6, 2026'], ['04_Bellek_Yonetimi.pdf', 'Oct 13, 2026'],
    ['05_Sinyaller.pdf', 'Oct 20, 2026'], ['06_Borular_ve_IPC.pptx', 'Oct 27, 2026'], ['07_Is_Parcaciklari.pdf', 'Nov 3, 2026'], ['Ara_Sinav_Calisma_Sorulari.pdf', 'Nov 10, 2026']] },
  { title: 'Ödevler', items: [['Odev_1_Kabuk.pdf', 'Sep 30, 2026'], ['Odev_2_Bellek_Ayirici.pdf', 'Oct 19, 2026'], ['Odev_3_Boru_Hatti.pdf', 'Nov 9, 2026'], ['odev3_baslangic.zip', 'Nov 9, 2026']] },
  { title: 'Laboratuvar', items: [['lab4_sinyal.c', 'Oct 21, 2026'], ['lab5_boru.c', 'Oct 28, 2026'], ['Makefile_ornek.txt', 'Sep 23, 2026']] },
  { title: 'Bağlantılar', items: [['Linux man sayfaları', 'Sep 22, 2026', 'https://man7.org/linux/man-pages/']] },
].map((s, si) => ({ title: s.title, items: s.items.map(([name, date, url], i) => ({ id: `r${si}${i}`, name, type: url ? 'link' : 'file', date, url: url ?? null })) })) });

// ---------- Uzak ve UZAKYDB ----------
const uzakDers = (id, site) => {
  const d = DERSLER.find(x => x.uzak === id);
  const kod = d?.kod ?? 'ALM 001', b = id * 10;
  const hafta = (n, konu, ekstra = []) => ({ name: `${n}. Hafta: ${konu}`, summary: '', items: [
    { type: 'resource', cmid: b * 10 + n * 3, name: `Hafta ${n} - Ders Notları`, kind: 'pdf', desc: '', url: `https://${site}.etu.edu.tr/mod/resource/view.php?id=${b * 10 + n * 3}` }, ...ekstra] });
  if (site === 'uzakydb') return { id, title: '26-27_G1_ALM001', sections: [
    { name: 'Genel', summary: '', items: [{ type: 'forum', cmid: 9001, name: 'Duyurular', kind: null, desc: '', url: '' }, { type: 'attendance', cmid: 9002, name: 'Yoklama', kind: null, desc: '', url: '' }] },
    { name: 'Lektion 5: Mein Tag', summary: '', items: [{ type: 'resource', cmid: 9011, name: 'Arbeitsblatt 5', kind: 'pdf', desc: '', url: '' }, { type: 'quiz', cmid: 9012, name: 'Wortschatz Quiz 5', kind: null, desc: '', url: '' },
      { type: 'assign', cmid: 9013, name: 'Schreibaufgabe: Mein Tagesablauf', kind: null, desc: '', url: '' }] }] };
  return { id, title: `[${kod}] ${d?.ad ?? ''}`, sections: [
    { name: 'Genel', summary: '', items: [{ type: 'label', cmid: b + 1, text: `${tarih(-1)} Ara sınav ${kod} için sınav derslikleri Ortam'da duyurulacaktır.` },
      { type: 'forum', cmid: b + 2, name: 'Duyurular', kind: null, desc: '', url: '' }, { type: 'resource', cmid: b + 3, name: 'Ders İzlencesi', kind: 'pdf', desc: '', url: '' }] },
    hafta(8, 'Tekrar ve çalışma soruları', [{ type: 'resource', cmid: b * 10 + 82, name: 'Hafta 8 - Çalışma Soruları', kind: 'pdf', desc: 'Ara sınav öncesi', url: '' },
      { type: 'quiz', cmid: b * 10 + 83, name: 'Deneme Sınavı', kind: null, desc: '', url: '' }]),
    hafta(7, 'Uygulamalar', [{ type: 'assign', cmid: b * 10 + 72, name: 'Ödev 3', kind: null, desc: 'Son teslim: 23 Kasım 23:59', url: '' },
      { type: 'url', cmid: b * 10 + 73, name: 'Ders kaydı (video)', kind: null, desc: '', url: '' }]),
    hafta(6, 'Temel kavramlar', [{ type: 'resource', cmid: b * 10 + 62, name: 'Örnek Kodlar', kind: 'archive', desc: '', url: '' }]),
  ] };
};
const uzakSayfa = yol => (/assign/.test(yol)
  ? { html: '<table class="generaltable"><tbody><tr><th>Gönderim durumu</th><td>Henüz gönderilmedi</td></tr><tr><th>Son teslim tarihi</th><td>23 Kasım 2026, 23:59</td></tr><tr><th>Kalan süre</th><td>6 gün 13 saat</td></tr></tbody></table><p>Boru hattı (pipe) kullanan küçük bir kabuk yazmanız bekleniyor. Ayrıntılar ödev belgesinde.</p>',
    actions: ['Gönderim ekle'], source: 'https://uzak.etu.edu.tr/mod/assign/view.php' }
  : { html: '<p><b>Ara sınav hakkında</b></p><p>Ara sınav 1–7. haftaları kapsayacaktır. Sınavda hesap makinesi kullanılamaz.</p>', actions: [], source: '' });
const UZAKYDB = { courses: [{ id: 812, name: '26-27_G1_ALM001', short: '26-27_G1_ALM001', category: '26-27 Güz YDB', url: 'https://uzakydb.etu.edu.tr/course/view.php?id=812', progress: 64, end: 0 }], events: [],
  recent: [['Wortschatz Quiz 5', 'quiz', 9012, 95], ['Arbeitsblatt 5', 'resource', 9011, 60 * 22], ['Schreibaufgabe: Mein Tagesablauf', 'assign', 9013, 60 * 47]].map(([name, module, cmid, once]) =>
    ({ name, course: '26-27_G1_ALM001', courseId: 812, url: `https://uzakydb.etu.edu.tr/mod/${module}/view.php?id=${cmid}`, module, cmid, time: dk(once) })) };

// ---------- bildirimler, hesap, durum ----------
const bildirimler = d => {
  const items = [
    { id: 'n1', t: dk(44), read: d.okundu.has('BIL214'), source: 'piazza', course: 'BIL214', courseName: 'BİL 214', title: 'BİL 214 · Piazza', text: 'Ödev 3 teslim tarihi uzatıldı. (Ders hocası)', link: '#/donem/derslerim/BIL214/piazza/p214a' },
    { id: 'n2', t: dk(95), read: d.okundu.has('BIL214'), source: 'piazza', course: 'BIL214', courseName: 'BİL 214', title: 'BİL 214 · Piazza', text: 'fork() sonrası dosya tanımlayıcıları paylaşılıyor mu? (Öğrenci)', link: '#/donem/derslerim/BIL214/piazza/p214b' },
    { id: 'n3', t: dk(180), read: d.okundu.has('MAT202'), source: 'uzak', course: 'MAT202', courseName: 'MAT 202', title: 'MAT 202 · Uzak', text: 'Yeni dosya: Hafta 8 - Çalışma Soruları', link: '#/donem/derslerim/MAT202/uzak/4105082' },
    { id: 'n4', t: dk(60 * 17), read: true, source: 'takvim', course: null, courseName: 'Sınav', title: 'Ara Sınav hatırlatması', text: 'Yarın 17:30–18:30: TAR 101 Uygarlıklar Tarihi · Çevrimiçi', link: '#/sinav' },
  ];
  const yeni = items.filter(i => !i.read), say = (f, s = {}) => { for (const i of yeni) { const k = f(i); if (k) s[k] = (s[k] || 0) + 1; } return s; };
  const kaynakli = {};
  for (const i of yeni) (kaynakli[i.course] ??= {})[i.source] = (kaynakli[i.course][i.source] || 0) + 1;
  return { items, unread: yeni.length, byCourse: say(i => i.course), bySource: say(i => i.source), byCourseSrc: kaynakli, settings: d.bildirimAyar, last: { takvim: dk(130), uzak: dk(21), piazza: dk(9) }, outbox: 0, lastMail: dk(44) };
};
const SITELER = { ortam: 'Ortam', ubs: 'UBS', uzakydb: 'UZAKYDB', webmail: 'Webmail', uzak: 'Uzak', piazza: 'Piazza' };
const DOGRUDAN = ['webmail', 'uzakydb', 'uzak', 'piazza', 'ubs'];
const hesap = d => ({ email: d.email, remembered: !!d.email, sessions: Object.fromEntries(Object.keys(SITELER).map(s => [s, !!d.email && (s !== 'ortam' || d.ortam)])), custom: [], direct: DOGRUDAN, blocked: [] });
const ISLER = [['ping-ortam', 'Ortam oturumunu açık tutma', 10], ['ping-ubs', 'UBS oturumunu açık tutma', 15], ['ping-uzakydb', 'UZAKYDB oturumunu açık tutma', 180], ['ping-webmail', 'Webmail oturumunu açık tutma', 150],
  ['ping-uzak', 'Uzak oturumunu açık tutma', 180], ['ping-piazza', 'Piazza oturumunu açık tutma', 240], ['notify-piazza', 'Piazza yeni gönderi kontrolü', 30], ['notify-uzak', 'Uzak yeni içerik kontrolü', 60],
  ['notify-takvim', 'Akademik takvim ve sınav hatırlatmaları', 180], ['update', 'Yeni sürüm denetimi (GitHub)', 360]];
const durumu = d => ({ version: '1.8.0', pid: 4242, startedAt: dk(60 * 26 + 12), now: SIMDI, keepAlive: d.guvenlik.keepAlive, autoRelogin: d.guvenlik.autoRelogin, lock: d.pin, lockIdle: 15,
  sessions: Object.fromEntries(Object.keys(SITELER).map(s => [s, { cookies: !!d.email, loggedOut: false, usedAt: dk(3) }])),
  jobs: ISLER.map(([id, label, every], i) => ({ id, label, every, on: true, last: dk(Math.round(every * (0.2 + (i % 4) * 0.2))), next: dk(-Math.round(every * (0.8 - (i % 4) * 0.2))) })), encrypted: true });

// ---------- yanıtlayıcı ----------
const SITE_OF = { webmail: 'webmail', piazza: 'piazza', ubs: 'ubs', uzakydb: 'uzakydb', uzak: 'uzak', plan: 'ubs' };
const GECIR = /^(program|etu-|mevzuat|hatirlatmalar|rezervasyon$)/;      // herkese açık veri: uygulamanın kendi sunucusu yanıtlar
export function yeniDurum(o = {}) {
  return { email: null, ortam: false, pin: false, kilitli: false, guncelleme: false, okundu: new Set(), posta: POSTA.map(m => ({ ...m })),
    guvenlik: { keepAlive: true, autoRelogin: true }, bildirimAyar: { takvim: true, toast: true, mail: true }, gecikme: 90, ...o };
}
const pdfler = {};                // yap.mjs üretir: ornek.pdf (ders notu), sinav.pdf (e-posta eki)
const ornekPdf = ad => (pdfler[ad] ??= fs.readFileSync(path.join(BURASI, '..', 'dist', 'tanitim', ad)));

export async function yanitla(route, d) {
  const req = route.request(), url = new URL(req.url()), ad = url.pathname.slice(5), q = url.searchParams, POST = req.method() === 'POST';
  const json = (code, body) => route.fulfill({ status: code, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
  const govde = () => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } };
  if (GECIR.test(ad) && !POST) return route.continue();
  await new Promise(r => setTimeout(r, d.gecikme));

  if (ad === 'lock') return json(200, { enabled: d.pin, unlocked: !d.kilitli, idle: 15 });
  if (ad === 'lock/unlock') { d.kilitli = false; return json(200, { ok: true }); }
  if (ad === 'lock/set') { d.pin = true; return json(200, { ok: true }); }
  if (ad === 'lock/lock') { d.kilitli = true; return json(200, { ok: true }); }
  if (ad === 'update') return json(200, d.guncelleme ? { current: '1.7.0', latest: '1.8.0', newer: true, size: 29.4 * 1048576,
    notes: 'Giriş ekranı: Windows ve web arayüzü artık kendi giriş ekranıyla açılıyor.\nTek tip "Giriş yap" düğmeleri ve "oturum kapalı" kutusu.\nWebmail: okunan bildirimler 6 saatte gider.' }
    : { current: '1.8.0', latest: '1.8.0', newer: false });
  if (ad === 'account' && !POST) return json(200, hesap(d));
  if (ad === 'status') return json(200, durumu(d));
  if (ad === 'security') { Object.assign(d.guvenlik, govde()); return json(200, durumu(d)); }
  if (ad === 'notifications') return json(200, bildirimler(d));
  if (ad === 'notifications/read') { const c = govde().course; if (c) d.okundu.add(c); else ['BIL214', 'MAT202'].forEach(x => d.okundu.add(x)); return json(200, bildirimler(d)); }
  if (ad === 'notifications/settings') { Object.assign(d.bildirimAyar, govde()); return json(200, d.bildirimAyar); }
  if (ad === 'notifications/check') { await new Promise(r => setTimeout(r, 900)); return json(200, bildirimler(d)); }
  if (ad === 'notifications/test') return json(200, { ok: true });
  if (ad === 'account/login') {
    await new Promise(r => setTimeout(r, 1500));
    d.email = String(govde().email || OGRENCI.eposta).toLowerCase();
    return json(200, { saved: true, results: Object.fromEntries(DOGRUDAN.map(s => [s, { ok: true }])) });
  }
  if (ad === 'login') { await new Promise(r => setTimeout(r, q.get('site') === 'ortam' ? 2600 : 900)); if (q.get('site') === 'ortam') d.ortam = true; return json(200, { ok: true }); }
  if (ad === 'open-page') { await new Promise(r => setTimeout(r, 2500)); return json(200, { ok: true }); }

  // Buradan sonrası kişisel veri: giriş yapılmadıysa "oturum kapalı"
  const site = SITE_OF[ad.split(/[-/]/)[0]] || 'ortam';
  if (!d.email || (site === 'ortam' && !d.ortam)) return json(401, { error: `${SITELER[site]} oturumu kapalı. Devam etmek için giriş yapın.`, site, siteName: SITELER[site] });

  if (ad.startsWith('file/')) { const f = ad.startsWith('file/moodle') ? 'ornek.pdf' : 'sinav.pdf';
    return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'X-File-Name': encodeURIComponent(f) }, body: ornekPdf(f) }); }
  if (ad.startsWith('webmail/')) {
    const b = govde(), is = ad.slice(8);
    if (is === 'auto-status') return json(200, WM_AYAR);
    if (is === 'mark') { for (const m of d.posta) if (b.uids?.includes(m.uid)) { if (b.flag === 'read') m.seen = true; if (b.flag === 'unread') m.seen = false; if (b.flag === 'flagged') m.flagged = true; if (b.flag === 'unflagged') m.flagged = false; } return json(200, { ok: true }); }
    if (is === 'delete' || is === 'move') { d.posta = d.posta.filter(m => !b.uids?.includes(m.uid)); return json(200, { ok: true }); }
    if (is === 'compose') {
      const m = d.posta.find(x => x.uid === b.uid);
      return json(200, { id: 'yazma-1', from: [{ id: '1', label: `${OGRENCI.ad} <${OGRENCI.eposta}>`, selected: true }], to: m && b.mode !== 'forward' ? 'ornek.danisman@etu.edu.tr' : '', cc: '', bcc: '',
        subject: m ? (b.mode === 'forward' ? 'Fwd: ' : 'Re: ') + m.subject.replace(/^Re: /, '') : '', quote: m ? m.html : '', quoteIsHtml: true, attachments: [] });
    }
    return json(200, { ok: true });
  }
  if (POST) return json(400, { error: 'Tanıtım kaydında bu işlem kapalı' });

  const T = {
    schedule, exams, derslerim, notlar, plan, mufredat, piazza: () => PIAZZA, ubs: () => UBS, uzakydb: () => UZAKYDB,
    bilgilerim: () => ({ identity: kimlik, title: 'Ana Dal Bilgileri', info: [['Fakülte', 'Mühendislik Fakültesi'], ['Bölüm', 'Bilgisayar Mühendisliği'], ['Sınıf', '2. Sınıf'], ['Dönem', '3'], ['Kayıt Yılı', '2025-2026'], ['Öğrenim Durumu', 'Aktif']] }),
    'ortam-duyuru': () => ({ items: d.anket === false ? [] : [{ kind: 'anket', title: 'Ders Değerlendirme Anketi (BİL 214)', link: '/anket/ders-degerlendirme' }], url: 'https://ortam.etu.edu.tr/' }),
    'uzakydb-ek': () => ({ site: 'uzakydb', items: [], url: 'https://uzakydb.etu.edu.tr' }),
    'yabanci-dil': () => ({ identity: kimlik, title: 'İkinci Yabancı Dil Bilgileri', columns: ['Dil', 'Düzey', 'Seçmeli Ders Kodu', 'Dönem', 'Harf Notu', 'Durum'], rows: [], note: 'Kayıt bulunmamaktadır.' }),
    webmail: () => webmail(d, q.get('mbox') || 'INBOX'),
    'webmail-starred': () => ({ ...webmail(d, 'INBOX'), mbox: '__starred', messages: d.posta.filter(m => m.flagged).map(postaSatiri) }),
    'webmail-message': () => { const m = d.posta.find(x => x.uid === q.get('uid')) ?? d.posta[0]; m.seen = true;
      return { uid: m.uid, subject: m.subject, from: `${m.from} <${m.from === 'Selin Karaca' ? 'ornek.danisman' : 'duyuru'}@etu.edu.tr>`, to: OGRENCI.eposta, cc: '', date: m.date, attachments: m.ekler ?? [], html: m.html }; },
    'piazza-feed': () => ({ nid: q.get('nid'), posts: gonderiler(q.get('nid')) }),
    'piazza-post': () => gonderi(q.get('nid'), q.get('cid')),
    'piazza-resources': () => kaynaklar(q.get('nid')),
    'uzak-course': () => uzakDers(Number(q.get('id')), 'uzak'), 'uzakydb-course': () => uzakDers(Number(q.get('id')), 'uzakydb'),
    'uzak-page': () => uzakSayfa(q.get('path')), 'uzakydb-page': () => uzakSayfa(q.get('path')),
    course: () => { const x = DERSLER.find(c => c.oid === q.get('id')) ?? DERSLER[0];
      return { id: x.oid, section: String(x.sube), credit: String(x.kr), students: '84', avgGno: '2.87', instructor: x.hoca, instructorEmail: 'ornek.hoca@etu.edu.tr',
        history: [['2025', 'Güz', 14, 9, 12, 11, 13, 8, 6, 9], ['2024', 'Güz', 11, 8, 14, 12, 15, 9, 7, 11], ['2023', 'Güz', 9, 10, 11, 13, 16, 10, 8, 12]].map(([y, dn, AA, BA, BB, CB, CC, DC, DD, FF]) =>
          ({ 'Öğretim Yılı': y, 'Öğretim Dönemi': dn, AA: String(AA), BA: String(BA), BB: String(BB), CB: String(CB), CC: String(CC), DC: String(DC), DD: String(DD), FF: String(FF), V: '0', U: '2', 'Başarısızlık': `%${FF + 2}`, 'Geçme Ortalaması': 'CB' })) }; },
    'ubs-page': () => (/Ogr0204/.test(q.get('path')) ? transkript() : { kind: 'page', title: 'UBS', html: '<p class="muted">Bu sayfa tanıtım kaydında yok.</p>', tabs: [] }),
  };
  const f = T[ad];
  return f ? json(200, f()) : json(404, { error: 'Tanıtım verisinde bu uç yok: ' + ad });
}
