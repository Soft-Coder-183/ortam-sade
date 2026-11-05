// Arayüz (maske): her ekran yalnızca kendi /api/* ucunu, o da okulun tek sayfasını çağırır.
// bottom: masaüstünde menünün en altında. rare: telefonun alt çubuğunda yok (Ana Sayfa kısayollarında);
// extra: telefonda sağ üstteki ⚙ düğmesinde.
const NAV = [
  { id: 'profil', label: 'Profil', short: 'Profil', icon: 'user', items: [
    ['bilgilerim', 'Bilgilerim'], ['notlar', 'Not Görüntüleme'], ['ortalama', 'Ortalama ve Ders Planı'], ['mufredat', 'Müfredat Görüntüleme'],
    ['ortak', 'Ortak Eğitim Bilgilerim'], ['yabanci-dil', 'İkinci Yabancı Dil Bilgilerim'], ['odeme', 'Ödeme Bilgilerim']] },
  { id: 'anasayfa', label: 'Ana Sayfa', short: 'Anasayfa', icon: 'home' },
  { id: 'donem', label: 'Dönem Bilgilerim', short: 'Dönem', icon: 'calendar', items: [['derslerim', 'Derslerim'], ['program', 'Ders Programım']] },
  { id: 'sinav', label: 'Sınav Takvimi', short: 'Sınav', icon: 'clipboard' },
  { id: 'webmail', label: 'Webmail', short: 'Posta', icon: 'mail' },
  { id: 'piazza', label: 'Piazza', short: 'Piazza', icon: 'message' },
  { id: 'ubs', label: 'UBS', short: 'UBS', icon: 'landmark' },
  { id: 'uzakydb', label: 'UZAKYDB', short: 'YDB', icon: 'globe' },
  // Ekstra: telefonda alt çubukta yok (Ana Sayfa kısayollarında)
  { id: 'ekstra', label: 'Ekstra', short: 'Ekstra', icon: 'star', rare: true, items: [
    ['acilan', 'Açılan Dersler'], ['takvim', 'Akademik Takvim'], ['kadro', 'Akademik Kadro'], ['yabanci-diller', 'Yabancı Diller'],
    ['mevzuat', 'Mevzuat'], ['duyurular', 'Öğrenci İşleri Duyuruları']] },
  { id: 'cap', label: 'ÇAP/YAP - Başvurular', short: 'Başvuru', icon: 'arrows', bottom: true, rare: true, items: [
    ['capyap', 'ÇAP / YAP'], ['staj', 'Staj Hareketliliği'], ['ogrenim', 'Öğrenim Hareketliliği'], ['mezun', 'Mezuniyet Sonrası Staj']] },
  { id: 'hakkinda', label: 'Hakkında ve SSS', short: 'Hakkında', icon: 'help', rare: true, items: [
    ['hakkimizda', 'Hakkımızda'], ['siteler', 'Okulun Siteleri'], ['sss', 'Sık Sorulan Sorular'], ['sorumluluk', 'Sorumluluk Reddi']] },
  { id: 'hesap', label: 'Hesap', short: 'Hesap', icon: 'settings', bottom: true, extra: true },
];

const $nav = document.getElementById('nav');
const $view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Simgeler ----------
// Tek tip çizgi simgeler (24×24, renk yazı renginden). Emoji yerine her yerde bunlar kullanılır: icon('mail').
const ICONS = {
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="m9 13 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  landmark: '<path d="M2.5 10 12 4l9.5 6zM3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  message: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8 8.5h8M8 12h5"/>',
  arrows: '<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  paperclip: '<path d="m20 11.5-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
  'reply-all': '<path d="M7 14 2 9l5-5"/><path d="m12 14-5-5 5-5"/><path d="M7 9h8a6 6 0 0 1 6 6v4"/>',
  forward: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v4"/>',
  pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l9 5V5L7 10H4a1 1 0 0 0-1 1z"/><path d="M19.5 9a4 4 0 0 1 0 6"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  calculator: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  pin: '<path d="M12 16v5M8 3h8l-1 6 3 3v2H6v-2l3-3z"/>',
  scale: '<path d="M12 3v18M7 21h10M4 7h16M6 7l-3 7a3.5 3.5 0 0 0 6 0zM18 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10 6-3.5v11l-6-3.5z"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  presentation: '<path d="M3 4h18M4.5 4v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V4M12 15v4M8.5 21l3.5-2 3.5 2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  dot: '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
};
const icon = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] ?? ''}</svg>`;

let needsRefresh = false;
let loginStale = null;         // önbellekten eski veri gösteriliyor ve bu sitenin oturumu kapalı
async function api(name) {
  const r = await fetch('/api/' + name);
  const j = await r.json().catch(() => ({}));
  if (r.status === 423) showLock();                       // PIN kilidi: kilit ekranı açılır, kilit açılınca ekran yeniden çizilir
  if (!r.ok) throw Object.assign(new Error(j.error || 'Hata'), r.status === 401 ? { login: j.site, siteName: j.siteName } : {});
  if (r.headers.get('X-Refreshing')) needsRefresh = true;
  if (r.headers.get('X-Login-Required')) loginStale = r.headers.get('X-Login-Required');
  return j;
}

const state = { notTab: 'liste', day: null, mbox: 'INBOX' };

// Dersler renk renk boyanmaz: kart nötr, sol kenar yüz yüze derste TOBB ETÜ kırmızısı, çevrimiçi derste gri kesik çizgi.
const mode = b => (b.inPerson ? 'f2f' : 'online');
const gradeCls = g => /^(AA|BA|BB)$/.test(g) ? 'g-a' : /^(FF|FD|DZ|U)$/.test(g) ? 'g-f' : '';
const gradeChip = g => g ? `<span class="grade ${gradeCls(g)}">${esc(g)}</span>` : '<span class="muted">—</span>';
const todayIdx = () => (new Date().getDay() + 6) % 7;
const todayTR = () => new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' });

// ---------- ortak parçalar ----------
const header = (title, sub = '') => `<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>`;

function tabs(items, current, key) {
  return `<div class="tabs">${items.map(([id, label]) =>
    `<button data-tab="${key}:${id}" class="${id === current ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

function table(cols, rows) {
  return `<div class="scroll"><table class="t"><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function identityCard(p) {
  return `<div class="card idc"><b>${esc(p.name)}</b><span class="muted">${esc(p.program)} · ${esc(p.number)}</span>
    <span class="muted">${esc(p.email)} · Danışman: ${esc(p.advisor)} (${esc(p.advisorEmail)})</span></div>`;
}

// ---------- Dönem: Ders Programım ----------
function blocks(schedule) {
  // Aynı dersin art arda saatlerini tek blokta birleştirir; günlere göre blok listesi döner.
  return schedule.days.map((_, d) => {
    const out = [];
    let cur = null;
    schedule.slots.forEach((s, i) => {
      const c = s.cells[d];
      const [start, end] = s.time.split(' - ');
      if (c && cur && cur.code === c.code && cur.room === c.room && cur.last === i - 1) { cur.last = i; cur.end = end; return; }
      cur = c ? { ...c, first: i, last: i, start, end } : null;
      if (cur) out.push(cur);
    });
    return out;
  });
}

// ---------- Ders Programı: haftalar ve sınavlar ----------
// Dersler her hafta aynıdır; sınavlar (Sınav Takvimi'nden) yalnızca kendi haftasında, kendi gün/saat hücresinde görünür.
// ‹ › ile haftalar arasında gezilir; "şimdi" çizgisi yalnızca bu haftada. Sınav kutusuna tıklayınca ayrıntı kartı açılır
// (derslik kutuya sığmasa da orada görünür).
const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
let progExams = [];              // görüntülenen haftanın sınavları (ayrıntı kartı için)

function weekStart(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - todayIdx() + offset * 7);
  return d;
}
const dayDate = (offset, d) => new Date(weekStart(offset).getTime() + d * 864e5);

function weekExams(e, offset) {
  if (!e?.active) return [];
  const s = weekStart(offset).getTime(), end = s + 7 * 864e5;
  return e.exams.filter(x => x.ts >= s && x.ts < end).sort((a, b) => a.ts - b.ts || minOf(a.start) - minOf(b.start))
    .map(x => ({ ...x, day: (new Date(x.ts).getDay() + 6) % 7, label: e.active.label }));
}

// Ders saatleri [başlangıç, bitiş] dakika; son dersten sonra biten sınav için aynı düzende satır eklenir.
function slotRanges(schedule, exams) {
  const r = schedule.slots.map(s => s.time.replace(/\s/g, '').split('-').map(minOf));
  const latest = Math.max(0, ...exams.map(x => minOf(x.end || x.start)));
  while (r.length && latest > r.at(-1)[1] + 10) { const [a] = r.at(-1); r.push([a + 60, a + 110]); }
  return r;
}
const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
function examRows(ranges, x) {
  const s = minOf(x.start), e = minOf(x.end || x.start) || s + 50;
  let a = 0, b = 0;
  ranges.forEach(([rs], i) => { if (rs <= s) a = i; if (rs < e) b = i; });
  return [a, Math.max(a, b)];
}

function weekGrid(schedule, perDay, exams = [], offset = 0) {
  const ranges = slotRanges(schedule, exams);
  const cols = schedule.days.map((_, d) => d).filter(d => perDay[d].length || d < 5 || exams.some(x => x.day === d));
  const isToday = d => offset === 0 && d === todayIdx();
  const head = cols.map((d, i) => { const dt = dayDate(offset, d);
    return `<div class="h ${isToday(d) ? 'today' : ''}" style="grid-column:${i + 2};grid-row:1">${esc(schedule.days[d] ?? DAY_LONG[d])}<small>${dt.getDate()} ${MONTHS[dt.getMonth()]}</small></div>`; }).join('');
  const times = ranges.map(([s], i) => `<div class="tm" style="grid-column:1;grid-row:${i + 2}">${hm(s)}</div>`).join('');
  const bl = cols.map((d, i) => perDay[d].map(b => `<div class="bl ${mode(b)}" title="${esc(b.name)} · ${esc(b.instructor)}${b.inPerson ? '' : ' · çevrimiçi'}" style="grid-column:${i + 2};grid-row:${b.first + 2}/span ${b.last - b.first + 1}">
      <b>${esc(b.code)}</b>${esc(b.room)}<br><small>${esc(b.name)}</small></div>`).join('')).join('');
  const ex = exams.map((x, k) => {
    if (!cols.includes(x.day)) return '';
    const [a, b] = examRows(ranges, x);
    return `<button type="button" class="bl exam" data-exam="${k}" title="Sınav: ${esc(x.code)} · ${esc(x.room || 'derslik belli değil')} — ayrıntı için tıklayın"
      style="grid-column:${cols.indexOf(x.day) + 2};grid-row:${a + 2}/span ${b - a + 1}"><span class="exam-tag">Sınav</span><b>${esc(x.code)}</b>
      <span class="exam-room">${icon('pin')}${esc(x.room || 'Derslik ?')}</span><small>${esc(x.start)}–${esc(x.end)}</small></button>`;
  }).join('');
  // Şu anki saat çizgisi: yerini updateNow() dakikada bir ayarlar (yalnızca bu hafta ve bugün tabloda varsa).
  const tcol = offset === 0 ? cols.indexOf(todayIdx()) : -1;
  const now = `<div class="nowline" hidden></div><div class="nowline today" hidden></div><div class="nowlabel" hidden></div>`;
  return `<div class="week card" data-slots="${ranges.map(([s, e]) => `${hm(s)}-${hm(e)}`).join(',')}" data-tcol="${tcol >= 0 ? tcol + 2 : ''}"
    style="grid-template-columns:44px repeat(${cols.length},minmax(0,1fr));grid-template-rows:auto repeat(${ranges.length},30px)">${head}${times}${bl}${ex}${now}</div>`;
}

function agenda(schedule, perDay, exams = [], offset = 0) {
  const t = offset === 0 ? todayIdx() : -1;
  const has = d => perDay[d]?.length || exams.some(x => x.day === d);
  if (state.day === null || !has(state.day) && state.day !== t) state.day = t >= 0 && has(t) ? t : [0, 1, 2, 3, 4, 5, 6].find(has) ?? Math.max(t, 0);
  const chips = DAY_SHORT.map((n, d) => has(d) || d === t
    ? `<button class="chip ${d === state.day ? 'on' : ''} ${d === t ? 'today' : ''} ${exams.some(x => x.day === d) ? 'has-exam' : ''}" data-day="${d}">${n} <small>${dayDate(offset, d).getDate()}</small></button>` : '').join('');
  const items = [
    ...(perDay[state.day] ?? []).map(b => ({ m: minOf(b.start), html: `<div class="slot ${mode(b)}" data-s="${b.start}" data-e="${b.end}"><div class="time">${b.start}<br><span class="muted">${b.end}</span></div>
      <div><b>${esc(b.code)}</b> · ${esc(b.name)}<br><span class="muted">${esc(b.room)} · ${esc(b.instructor)}${b.inPerson ? '' : ' · çevrimiçi'}</span></div></div>` })),
    ...exams.map((x, k) => [x, k]).filter(([x]) => x.day === state.day).map(([x, k]) => ({ m: minOf(x.start), html: `<button type="button" class="slot exam" data-exam="${k}">
      <div class="time">${esc(x.start)}<br><span class="muted">${esc(x.end)}</span></div>
      <div><span class="exam-tag">Sınav · ${esc(x.label)}</span><b>${esc(x.code)}</b> · ${esc(x.name)}<br><span class="exam-room">${icon('pin')}${esc(x.room || 'Derslik henüz belli değil')}</span></div></button>` })),
  ].sort((a, b) => a.m - b.m);
  return `<div class="agenda" data-today="${state.day === t ? 1 : ''}"><div class="day-chips">${chips}</div>${
    items.length ? items.map(i => i.html).join('') : '<div class="msg">Bu gün ders yok.</div>'}</div>`;
}

// Hafta gezintisi; bu haftada sınav yoksa ve ileride varsa o haftaya kısayol.
function weekNav(offset, exams, e) {
  const ws = weekStart(offset), we = new Date(ws.getTime() + 6 * 864e5);
  const range = ws.getMonth() === we.getMonth() ? `${ws.getDate()}–${we.getDate()} ${MONTHS_LONG[we.getMonth()]}`
    : `${ws.getDate()} ${MONTHS_LONG[ws.getMonth()]} – ${we.getDate()} ${MONTHS_LONG[we.getMonth()]}`;
  let hint = '';
  if (!exams.length && e?.active) {
    const base = weekStart(offset).getTime() + 7 * 864e5;
    const next = e.exams.filter(x => x.ts >= base).sort((a, b) => a.ts - b.ts)[0];
    if (next) {
      const dt = new Date(next.ts);
      const week = Math.floor((dt - weekStart(0)) / (7 * 864e5));
      hint = `<button class="btn wk-jump" data-week="${week}">Sonraki sınav: ${esc(next.code)} · ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${icon('chevron-right')}</button>`;
    }
  }
  return `<div class="wk-nav"><div class="wk-btns" role="group" aria-label="Hafta">
      <button data-week="${offset - 1}" aria-label="Önceki hafta">‹</button>
      <button data-week="0" class="${offset === 0 ? 'on' : ''}">Bu hafta</button>
      <button data-week="${offset + 1}" aria-label="Sonraki hafta">›</button></div>
    <span class="wk-range"><b>${range}</b>${exams.length ? ` · <span class="wk-exams">${exams.length} sınav</span>` : ''}</span>${hint}</div>`;
}

async function viewProgram(r, ctx) {
  const [s, e] = await Promise.all([api('schedule'), api('exams').catch(() => null)]);
  const offset = state.week ?? 0;
  const exams = progExams = weekExams(e, offset);
  const per = blocks(s);
  ctx.after = startNowTicker;
  return header('Ders Programım', 'Kırmızı kenarlı dersler yüz yüze, gri kesikli kenarlılar çevrimiçi; sınavlar kendi haftasında') +
    weekNav(offset, exams, e) + weekGrid(s, per, exams, offset) + agenda(s, per, exams, offset);
}

// Sınav ayrıntı kartı (masaüstünde kutunun yanında, telefonda alttan açılır)
function examPop(btn) {
  closeExamPop();
  const x = progExams[Number(btn.dataset.exam)];
  if (!x) return;
  const dt = new Date(x.ts);
  const pop = document.createElement('div');
  pop.className = 'exam-pop';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `<button type="button" class="exam-pop-x" aria-label="Kapat">×</button>
    <span class="exam-tag">Sınav · ${esc(x.label)}</span><h3>${esc(x.code)}</h3><p class="muted">${esc(x.name)}</p>
    <dl><div><dt>Tarih</dt><dd>${dt.getDate()} ${MONTHS_LONG[dt.getMonth()]} ${DAY_LONG[x.day]}</dd></div>
    <div><dt>Saat</dt><dd>${esc(x.start)}–${esc(x.end)}</dd></div>
    <div><dt>Derslik</dt><dd>${x.room ? `<b>${esc(x.room)}</b>` : '<span class="muted">Henüz belli değil</span>'}</dd></div>
    <div><dt>Tür</dt><dd>${esc(x.type || '—')}</dd></div></dl>
    <a class="btn" href="#/sinav">Sınav Takvimi ${icon('chevron-right')}</a>`;
  document.body.append(pop);
  if (window.innerWidth > 800) {
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.right + 8;
    if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.min(Math.max(8, r.top), window.innerHeight - h - 8)}px`;
  } else pop.classList.add('sheet');
  pop.querySelector('.exam-pop-x').focus();
}
function closeExamPop() { document.querySelectorAll('.exam-pop').forEach(p => p.remove()); }
document.addEventListener('click', e => {
  const wk = e.target.closest('#view [data-week]');
  if (wk) { state.week = Number(wk.dataset.week) || 0; closeExamPop(); return render(); }
  const ex = e.target.closest('#view [data-exam]');
  if (ex) { e.stopPropagation(); return examPop(ex); }
  if (e.target.closest('.exam-pop-x') || !e.target.closest('.exam-pop')) closeExamPop();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExamPop(); });
window.addEventListener('hashchange', closeExamPop);
// ---------- Ders Programı: haftalar ve sınavlar sonu ----------

// Şu anki saat: haftalık tabloda yatay çizgi (bugünün sütununda kalın, noktalı), telefondaki gün listesinde "şimdi" işareti.
// Ders saatleri arasında (teneffüs) çizgi iki satırın arasına konur. Sayfa açıkken dakika başında güncellenir.
const ROW_PX = 30, GAP_PX = 4;                 // .week satır yüksekliği ve satır aralığı (style.css ile aynı)
const minOf = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function nowPos(slots, mins) {
  if (!slots.length || mins < slots[0][0] || mins > slots.at(-1)[1]) return null;
  for (let i = 0; i < slots.length; i++) {
    const [s, e] = slots[i];
    if (mins >= s && mins <= e) return { row: i, offset: Math.round(((mins - s) / (e - s)) * ROW_PX) };
    if (slots[i + 1] && mins > e && mins < slots[i + 1][0]) return { row: i, offset: ROW_PX + GAP_PX / 2 };
  }
  return null;
}

function updateNow() {
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  const label = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const wk = $view.querySelector('.week[data-slots]');
  if (wk) {
    const pos = nowPos(wk.dataset.slots.split(',').filter(Boolean).map(x => x.split('-').map(minOf)), mins);
    const show = !!(pos && wk.dataset.tcol);
    wk.querySelectorAll('.nowline, .nowlabel').forEach(el => {
      el.hidden = !show;
      if (!show) return;
      el.style.gridRow = String(pos.row + 2);
      el.style.marginTop = `${pos.offset}px`;
      if (el.classList.contains('today')) el.style.gridColumn = wk.dataset.tcol;
      if (el.classList.contains('nowlabel')) el.textContent = label;
    });
  }
  const ag = $view.querySelector('.agenda');
  if (!ag) return;
  ag.querySelectorAll('.now-mark').forEach(x => x.remove());
  ag.querySelectorAll('.slot.now').forEach(x => x.classList.remove('now'));
  if (ag.dataset.today !== '1') return;
  const slots = [...ag.querySelectorAll('.slot[data-s]')];
  const ranges = slots.map(el => [minOf(el.dataset.s), minOf(el.dataset.e)]);
  if (!slots.length || mins < ranges[0][0] || mins > ranges.at(-1)[1]) return;
  const i = ranges.findIndex(([s, e]) => mins >= s && mins <= e);
  if (i >= 0) {                                  // derstesiniz: kartın içinde, geçen süre oranında
    const [s, e] = ranges[i];
    slots[i].classList.add('now');
    slots[i].insertAdjacentHTML('beforeend', `<div class="now-mark in" style="top:${Math.round(((mins - s) / (e - s)) * 100)}%" title="Şu an ${label}"></div>`);
  } else {                                       // teneffüs/boş saat: iki kartın arasında
    slots[ranges.findIndex(([s]) => s > mins)].insertAdjacentHTML('beforebegin', `<div class="now-mark"><span>şimdi · ${label}</span></div>`);
  }
}

let nowTimer = null;
function startNowTicker() {
  clearTimeout(nowTimer);
  updateNow();
  const tick = () => {
    if (!$view.querySelector('.week[data-slots], .agenda')) { nowTimer = null; return; }   // sayfadan çıkıldı
    updateNow();
    nowTimer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  nowTimer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
}

// ---------- Dönem: Derslerim (Ortam + Uzak + Piazza) ----------
// #/donem/derslerim → birleşik ders listesi; #/donem/derslerim/<ders>/<genel|uzak|piazza> → dersin sayfası.
// Her sekme yalnızca kendi kaynağını çeker; haftalardaki etkinlikler, gönderiler ve kaynaklar tıklanınca yüklenir.
const SOURCE_NAMES = { ortam: 'Ortam', uzak: 'Uzak', piazza: 'Piazza' };
function sourcesBanner(d) {
  return Object.entries(d.sources).filter(([, s]) => s !== 'ok').map(([site, s]) => `<div class="banner">${s === 'login'
    ? `${SOURCE_NAMES[site]} oturumu kapalı; ${SOURCE_NAMES[site]} içerikleri listede yok. ${loginButton('Giriş yap', site)}`
    : `${SOURCE_NAMES[site]} verisi alınamadı: ${esc(d.errors[site] || '')}`}</div>`).join('');
}

async function viewDerslerim(r) {
  if (r.param) return viewCourse(r);
  const d = await api('derslerim');
  return header('Derslerim', `${d.courses.length} ders · Ortam, Uzak ve Piazza bir arada`) + sourcesBanner(d) + `<div class="list">${d.courses.map(c =>
    `<a class="card course-row" href="#/donem/derslerim/${encodeURIComponent(c.key)}">
      <span class="cr-name"><span class="code">${esc(c.code)}</span><span>${esc(c.name)}</span></span>
      <span class="badges">${srcDots(notif.byCourseSrc?.[c.key])}${c.uzak ? '<span class="pill src-uzak">Uzak</span>' : ''}${c.piazza ? `<span class="pill src-piazza">Piazza${c.piazza.fresh ? ` · ${c.piazza.fresh} yeni` : ''}</span>` : ''}
        ${icon('chevron-right', 'go')}</span>
    </a>`).join('')}</div>`;
}

// Sekmeler: Tümü (Piazza'nın son gönderileri ve kaynakları, Uzak içeriği, en altta Derse Bakış — tek sayfada), Piazza, Uzak,
// Derse Bakış (Ortam'daki ders bilgisi). Ders açılınca Tümü gelir. Her bölüm kendi kaynağından gelir; biri açılamazsa diğerleri görünür.
const COURSE_TABS = [['tumu', 'Tümü'], ['piazza', 'Piazza'], ['uzak', 'Uzak'], ['bakis', 'Derse Bakış']];
async function viewCourse(r) {
  const [key, tabId] = r.param.split('/');
  const back = '<p><a href="#/donem/derslerim">← Derslerim</a></p>';
  const d = await api('derslerim');
  const c = d.courses.find(x => x.key === key);
  if (!c) return back + '<div class="card msg">Ders bulunamadı.</div>';
  const avail = COURSE_TABS.filter(([id]) => (id === 'tumu' ? true : id === 'bakis' ? c.ortamId : c[id]));
  const tab = (avail.find(t => t[0] === (tabId === 'genel' ? 'bakis' : tabId)) ?? avail[0])[0];
  const base = `#/donem/derslerim/${encodeURIComponent(key)}`;
  const bar = `<div class="tabs">${avail.map(([id, label]) => `<a href="${base}/${id}" class="${id === tab ? 'on' : ''}">${label}${
    id === 'piazza' && c.piazza.fresh ? ` · ${c.piazza.fresh} yeni` : ''}</a>`).join('')}</div>`;
  const overview = async () => `<div class="card">${courseBody(await api('course?id=' + c.ortamId))}</div>`;
  let body;
  if (tab === 'tumu') {
    // Bölümler paralel yüklenir; hata veren bölüm yerinde kısa bir mesaj gösterir
    const part = (title, link, fn) => fn().then(html => ({ title, link, html }),
      e => ({ title, link, html: `<div class="card msg err">${esc(e.message)}${e.login ? `<br>${loginButton(`${e.siteName} için giriş yap`, e.login)}` : ''}</div>` }));
    const parts = await Promise.all([
      c.piazza && part('Piazza', `${base}/piazza`, () => coursePiazza(c, { recent: 4, resources: 'inline' })),
      c.uzak && part('Uzak', `${base}/uzak`, () => courseUzak(c, { sub: true })),
      c.ortamId && part('Derse Bakış', `${base}/bakis`, overview),
    ].filter(Boolean));
    body = parts.map(p => `<section class="course-part"><div class="course-part-h"><h2>${p.title}</h2><a class="muted" href="${p.link}">Yalnızca ${p.title} →</a></div>${p.html}</section>`).join('')
      || '<div class="card msg">Bu ders için gösterilecek içerik yok.</div>';
  } else body = tab === 'bakis' ? await overview() : tab === 'uzak' ? await courseUzak(c) : await coursePiazza(c);
  const news = notif.items.filter(n => !n.read && n.course === c.key);
  if (news.length) post('/api/notifications/read', { course: c.key }).then(r => r.json()).then(j => { notif = j; renderNav(route()); }).catch(() => {});
  const newsBox = news.length ? `<div class="card news"><b>Yeni</b><ul>${news.map(n => `<li><span class="sdot src-${esc(n.source)}"></span><a href="${esc(n.link)}">${esc(n.source === 'piazza' ? 'Piazza' : 'Uzak')}</a> · ${esc(n.text)} <span class="muted small">${whenTR(n.t)}</span></li>`).join('')}</ul></div>` : '';
  return back + header(`${c.code} · ${c.name}`) + newsBox + bar + body;
}

// Uzak: haftalar/konular. Dosyalar görüntüleyicide açılır ya da iner; diğer etkinliklerin sayfası açılınca yüklenir.
const KIND_ICON = { pdf: 'file-text', document: 'file-text', powerpoint: 'presentation', spreadsheet: 'table', archive: 'archive', image: 'image', text: 'file', mpeg: 'video', video: 'video' };
const MOD_ICON = { forum: 'megaphone', assign: 'pencil', quiz: 'help', folder: 'folder', page: 'file', url: 'link', resource: 'paperclip' };
const VIDEO = /^(mpeg|video|quicktime|avi|wmv|flash)$/;

// sub: Tümü sekmesinde başlıklar bir kademe küçük (h3), içeriği olmayan haftalar atlanır.
// site: 'uzak' ya da 'uzakydb' (ikisi de Moodle; aynı görünüm).
async function courseUzak(c, { sub = false, site = 'uzak' } = {}) {
  const u = await api(`${site}-course?id=` + c.uzak.id);
  const sections = sub ? u.sections.filter(s => s.items.length) : u.sections;
  if (!sections.length) return '<div class="card msg">Bu derste Uzak\'ta içerik yok.</div>';
  const h = sub ? 'h3' : 'h2';
  return sections.map(s => `<${h}>${esc(s.name)}</${h}>${s.summary ? `<p class="muted">${esc(s.summary)}</p>` : ''}
    <div class="card mitems">${s.items.map(i => uzakItem(i, site)).join('') || '<span class="muted">Bu bölüm boş.</span>'}</div>`).join('');
}

function uzakItem(i, site = 'uzak') {
  if (i.type === 'label') return `<div class="mi label">${esc(i.text)}</div>`;
  const desc = i.desc ? `<div class="muted small">${esc(i.desc)}</div>` : '';
  if (i.type === 'resource' && VIDEO.test(i.kind || ''))      // büyük video dosyaları okulun sitesinde oynatılır
    return `<div class="mi"><a class="mi-main" href="${esc(/^https?:\/\//.test(i.url) ? i.url : '#')}" target="_blank" rel="noopener">${icon(KIND_ICON[i.kind])}<span>${esc(i.name)} <span class="muted small">(Uzak'ta açılır)</span></span></a>${desc}</div>`;
  if (i.type === 'resource') return `<div class="mi"><button class="mi-main" data-file="/api/file/moodle?site=${site}&amp;cm=${i.cmid}"
    data-kind="${esc(i.kind || '')}" data-title="${esc(i.name)}">${icon(KIND_ICON[i.kind] || 'paperclip')}<span>${esc(i.name)}</span></button>${desc}</div>`;
  if (i.type === 'url') return `<div class="mi"><button class="mi-main" data-ulink="${i.cmid}" data-site="${site}">${icon('link')}<span>${esc(i.name)}</span></button>${desc}</div>`;
  return lazy(`mpage:${site}:/mod/${i.type}/view.php?id=${i.cmid}`,
    `${icon(MOD_ICON[i.type] || 'dot')}<span>${esc(i.name)}</span> <span class="pill gray">${esc(MOD[i.type] || i.type)}</span>`, 'mi', desc);
}

// Piazza: gönderiler (açılınca içerik ve yanıtlar) ve kaynaklar.
// Varsayılan (Piazza sekmesi): kaynaklar açılınca yüklenir, bütün gönderiler. Tümü sekmesi: en yeni `recent` gönderi ve
// kaynaklar doğrudan (resources: 'inline').
async function coursePiazza(c, { recent = 0, resources = 'lazy' } = {}) {
  const nid = c.piazza.id;
  const [f, res] = await Promise.all([api('piazza-feed?nid=' + nid), resources === 'inline' ? api('piazza-resources?nid=' + nid).catch(() => null) : null]);
  const list = recent ? [...f.posts].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)).slice(0, recent) : f.posts;
  const posts = list.map(p => lazy(`ppost:${nid}:${p.id}`, `<span class="ps"><b>${p.pinned ? icon('pin', 'pinned') : ''}${esc(p.subject)}</b>
      <span class="muted small">@${p.nr} · ${p.updated ? whenTR(p.updated) : ''}${p.role ? ` · ${rolePill(p.role)}` : ''}${p.isNew ? ' · <span class="pill info">yeni</span>' : ''}</span></span>`,
    'card post' + (p.isNew ? ' unread' : ''), p.snippet ? `<p class="muted snip">${esc(p.snippet)}</p>` : '')).join('');
  const h = recent ? 'h3' : 'h2';
  const postsHtml = `<${h}>${recent ? 'Son gönderiler' : 'Gönderiler'}</${h}><div class="list">${posts || '<div class="card msg">Gönderi yok.</div>'}</div>`;
  if (resources === 'inline') return postsHtml + `<h3>Kaynaklar</h3><div class="card res rich">${res ? resView(res) : '<p class="muted">Kaynaklar alınamadı.</p>'}</div>`;
  return lazy(`pres:${nid}`, `${icon('book')}<b>Kaynaklar</b> <span class="muted small">ders notları, dosyalar</span>`, 'card res') + postsHtml;
}

// Piazza yazar rolü: "Ders hocası" / "Ders asistanı" / "Öğrenci"; belirlenemezse (anonim) hiç gösterilmez.
const rolePill = role => (role ? `<span class="pill ${role === 'Öğrenci' ? 'gray' : role === 'Ders asistanı' ? 'info' : ''} role">${esc(role)}</span>` : '');
const postView = p => `${p.role ? `<div class="muted small">Yazan: ${rolePill(p.role)}</div>` : ''}<div class="rich">${p.html || ''}</div>${p.answers.map(a => `<div class="pans"><div class="muted small">${esc(a.kind)}${
  a.role ? ' · ' + rolePill(a.role) : ''}${a.created ? ' · ' + whenTR(a.created) : ''}</div><div class="rich">${a.html}</div>${a.replies.map(x => `<div class="prep"><div class="rich">${x.html}</div>${
  x.role || x.created ? `<div class="muted small">${x.role ? rolePill(x.role) + ' · ' : ''}${x.created ? whenTR(x.created) : ''}</div>` : ''}</div>`).join('')}</div>`).join('')}`;

const resView = r => (r.sections.length ? r.sections.map(s => `<h3>${esc(s.title)}</h3><div class="atts">${s.items.map(i => i.type === 'link'
  ? (/^https?:\/\//i.test(i.url || '') ? `<a class="att" href="${esc(i.url)}" target="_blank" rel="noopener">${icon('link')}${esc(i.name)}</a>` : '')
  : `<button class="att" data-file="/api/file/piazza?nid=${esc(r.nid)}&amp;rid=${esc(i.id)}" data-title="${esc(i.name)}">${icon(/\.pdf$/i.test(i.name) ? 'file-text' : 'paperclip')}${esc(i.name)}</button>`).join('')}</div>`).join('')
  : '<p class="muted">Bu sınıfta kaynak yok.</p>');

// ---------- Açılınca yüklenen bölümler ----------
// key: "tür:argüman". İçerik bu oturumda bir kez çekilir (yeniden çizimde açık kalan bölüm boş görünmesin).
const panels = {};
const lazy = (key, summary, cls = 'card', extra = '') => `<details class="${cls} lazy" data-lazy="${esc(key)}"><summary>${summary}</summary>${extra}
  <div class="lz rich">${panels[key] ?? '<p class="muted">Yükleniyor…</p>'}</div></details>`;
const LOADERS = {
  mpage: async arg => { const i = arg.indexOf(':'); return mpageView(await api(`${arg.slice(0, i)}-page?path=${encodeURIComponent(arg.slice(i + 1))}`)); },
  ppost: async arg => { const [nid, cid] = arg.split(':'); return postView(await api(`piazza-post?nid=${nid}&cid=${cid}`)); },
  pres: async nid => resView(await api('piazza-resources?nid=' + nid)),
};
// Sayfada okulun sitesinde yapılacak bir işlem (sınava başla, ödev yükle, gönder…) varsa üstte o siteye bağlantı çıkar.
// Safe Exam Browser isteyen sınavlarda: SEB indirme bağlantısı, yapılandırma dosyası (.seb) ve "SEB'i başlat" bağlantısı içerikte kalır.
const mpageView = p => (p.actions?.length && p.source ? `<div class="banner mp-act">${icon('external')}<span><b>${p.actions.map(esc).join(' · ')}</b>
    okulun sitesinde yapılır.</span><a class="btn" href="${esc(p.source)}" target="_blank" rel="noopener">Sitede aç</a></div>` : '') +
  (p.html || '<p class="muted">Bu sayfada gösterilecek içerik yok.</p>');

async function openLazy(el) {
  const key = el.dataset.lazy;
  if (panels[key]) return;
  const i = key.indexOf(':');
  const box = el.querySelector('.lz');
  try {
    panels[key] = await LOADERS[key.slice(0, i)](key.slice(i + 1));
    box.innerHTML = panels[key];
  } catch (e) {
    box.innerHTML = `<p class="msg err">${esc(e.message)}</p>${e.login ? loginButton(`${e.siteName} için giriş yap`, e.login) : ''}`;
  }
}

// Etkinlik sayfasının içindeki başka bir etkinlik bağlantısı (ör. duyuru konusu) aynı kutuda açılır; "← Geri" ile dönülür.
const mpageHistory = new WeakMap();
async function openMpage(link) {
  const box = link.closest('.lz');
  const stack = mpageHistory.get(box) ?? [];
  stack.push(box.innerHTML);
  mpageHistory.set(box, stack);
  box.innerHTML = '<p class="muted">Yükleniyor…</p>';
  try {
    box.innerHTML = '<button class="btn" data-mback>← Geri</button>' + mpageView(await api(`${link.dataset.site}-page?path=${encodeURIComponent(link.dataset.mpage)}`));
  } catch (e) {
    box.innerHTML = '<button class="btn" data-mback>← Geri</button>' + `<p class="msg err">${esc(e.message)}</p>`;
  }
}

// Dosya: PDF uygulamanın görüntüleyicisinde açılır, diğerleri indirilir.
async function showFile(src, title, kind) {
  if (kind === 'pdf' || /\.pdf$/i.test(title || '')) return showPdf(src, title);
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Dosya alınamadı');
    const name = decodeURIComponent(r.headers.get('X-File-Name') || '') || title || 'dosya';
    if (/pdf/i.test(r.headers.get('Content-Type') || '')) return showPdf(src, name);
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    toast(e.message);
  }
}

function toast(msg) {
  const t = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 4000);
}

// URL etkinliği: dış adres sunucuda çözülür. Pencere tıklama anında açılır (açılır pencere engelleyicisine takılmasın).
async function openUzakLink(cm, site = 'uzak') {
  const w = window.open('', '_blank');
  try {
    const { url } = await api(`${site === 'uzakydb' ? 'uzakydb' : 'uzak'}-link?cm=` + cm);
    if (w) { w.opener = null; w.location = url; } else location.href = url;
  } catch (e) {
    w?.close();
    toast(e.message);
  }
}

function courseBody(c) {
  const dist = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FF'];
  return `<p class="muted" style="margin:10px 0 4px">${esc(c.instructor)} · <a href="mailto:${esc(c.instructorEmail)}">${esc(c.instructorEmail)}</a></p>
    <p style="margin:4px 0"><span class="pill">${esc(c.credit)} kredi</span> <span class="pill">${esc(c.section)}. şube</span>
      <span class="pill">${esc(c.students)} öğrenci</span> <span class="pill">Sınıf GNO ${esc(c.avgGno)}</span></p>
    ${c.history.length ? `<h2 style="font-size:.9rem">Önceki dönemlerin not dağılımı</h2>` + table([
      ['Dönem', r => esc(r['Öğretim Yılı'] + ' ' + r['Öğretim Dönemi'])], ...dist.map(g => [g, r => esc(r[g])]),
      ['Kalma', r => esc(r['Başarısızlık'])], ['Ort.', r => esc(r['Geçme Ortalaması'])]], c.history) : ''}`;
}

// ---------- Sınav Takvimi ----------
// Sınav Takvimi ve Ana Sayfa ortak: sınavın başlangıç/bitiş anı ve "Yarın", "3 gün sonra" gibi etiketi
const examAt = (x, hm) => x.ts + (([h, m]) => (h * 60 + m) * 60000)(hm.split(':').map(Number));
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function examRel(x, now = Date.now()) {
  if (x.dateText === todayTR()) return examAt(x, x.end) < now ? 'Bitti' : examAt(x, x.start) <= now ? 'Şu an' : 'Bugün';
  const midnight = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) + 'T00:00:00+03:00');
  const d = Math.round((x.ts - midnight) / 864e5);
  return d < 0 ? `${-d} gün önce` : d === 1 ? 'Yarın' : `${d} gün sonra`;
}
const examDate = x => { const [dd, mm] = x.dateText.split('.'); return `<div class="date"><b>${dd}</b><span class="muted">${MONTHS[mm - 1] ?? ''}</span></div>`; };
// Kalan sürenin aciliyeti (renk için): bugün/yarın, 3 gün içinde, daha sonra, bitti
function examUrgency(x, now = Date.now()) {
  if (examAt(x, x.end) < now) return 'due-past';
  const midnight = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) + 'T00:00:00+03:00');
  const d = Math.round((x.ts - midnight) / 864e5);
  return d <= 1 ? 'due-now' : d <= 3 ? 'due-soon' : 'due-later';
}

// Başlık hangi sınav döneminde olunduğunu söyler: "Sınav Takvimi (Ara Sınav)"
async function viewSinav() {
  const e = await api('exams');
  if (!e.active) return header('Sınav Takvimi') + `<div class="card msg">${esc(e.message)}</div>`;
  const now = Date.now();
  const next = e.exams.find(x => examAt(x, x.end) > now);
  const left = e.exams.filter(x => examAt(x, x.end) > now).length;
  // Her sınav tek satır: tarih (gün adıyla), ders kodu, adı, saat, yer, kalan süre. Yüz yüze dışındaki sınav türü küçük etiketle.
  return header(`Sınav Takvimi (${e.active.label})`, `${e.exams.length} sınav · ${left ? `${left} sınav kaldı` : 'hepsi bitti'}`) + `<div class="list xlist">${e.exams.map(x => {
    const [dd, mm] = x.dateText.split('.');
    const wd = x.ts ? new Date(x.ts).toLocaleDateString('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' }) : '';
    const other = x.type && !/yüz\s*yüze/i.test(x.type);
    return `<div class="card exam xrow ${x === next ? 'next' : ''} ${examAt(x, x.end) < now ? 'past' : ''}">
      <div class="date"><b>${dd}</b><span>${MONTHS[mm - 1] ?? ''}${wd ? `<i class="wd">${esc(wd)}</i>` : ''}</span></div>
      <div class="x-code">${esc(x.code)}</div>
      <div class="x-name">${esc(x.name)}${other ? ` <span class="x-type">${esc(x.type)}</span>` : ''}</div>
      <div class="x-time">${icon('clock')}<span>${esc(x.start)}–${esc(x.end)}</span></div>
      <div class="x-room">${icon('pin')}<span>${esc(x.room || 'Yer belli değil')}</span></div>
      <span class="pill ${examUrgency(x, now)}">${examRel(x, now)}</span></div>`;
  }).join('')}</div>`;
}

// ---------- Profil ----------
async function viewBilgilerim() {
  const b = await api('bilgilerim');
  return header('Bilgilerim') + identityCard(b.identity) +
    `<h2>${esc(b.title || 'Ana Dal Bilgileri')}</h2><div class="card">${table([['', r => `<span class="muted">${esc(r[0])}</span>`], ['', r => `<b>${esc(r[1])}</b>`]], b.info)}</div>`;
}

async function viewNotlar() {
  const n = await api('notlar');
  const body = state.notTab === 'liste'
    ? n.liste.map(t => `<h2>${esc(t.term)}</h2><div class="card">${table([['Kod', r => `<b>${esc(r.code)}</b>`], ['Ders', r => esc(r.name)],
        ['Tür', r => esc(r.type)], ['Dal', r => esc(r.branch)], ['Tekrar', r => esc(r.repeat)], ['Not', r => gradeChip(r.grade)]], t.courses)}</div>`).join('')
    : `<div class="grid">${n.donemlik.map(t => `<div class="card"><h2 style="margin-top:0">${esc(t.term)}</h2>${
        table([['Kod', r => `<b>${esc(r.code)}</b>`], ['Not', r => gradeChip(r.grade)]], t.courses)}</div>`).join('')}</div>`;
  const survey = n.survey ? `<div class="banner mv-banner"><span><b>Anket gerekiyor.</b> ${esc(n.survey.text)}</span>
    <a class="btn" href="${esc(n.survey.link)}" target="_blank" rel="noopener">${icon('external')}Anketi Ortam'da doldur</a></div>` : '';
  return header('Not Görüntüleme') + survey + identityCard(n.identity) + tabs([['liste', 'Liste'], ['donemlik', 'Dönemlik']], state.notTab, 'notTab') + body;
}

async function viewMufredat() {
  const m = await api('mufredat');
  const status = s => /alıyor/i.test(s) ? '<span class="pill warn">Bu dönem alıyor</span>' : /^Başarılı/.test(s) ? '<span class="pill ok">Başarılı</span>'
    : /Alınmadı/.test(s) ? '<span class="muted">Alınmadı</span>' : esc(s);
  return header('Müfredat Görüntüleme') + identityCard(m.identity) + m.terms.map(t => `<h2>${esc(t.term)}</h2><div class="card">${table([
    ['Kod', r => `<b>${esc(r.code)}</b>`], ['Ders', r => esc(r.name)], ['Kredi / AKTS', r => `${esc(r.credit)} / ${esc(r.ects)}`],
    ['Not', r => gradeChip(r.grade)], ['Durum', r => status(r.status)], ['Seçmeli', r => esc(r.elective)]], t.courses)}</div>`).join('');
}

const simpleView = (endpoint, title) => async () => {
  const d = await api(endpoint);
  const cols = d.columns.map((c, i) => [c, r => /Harf Not/.test(c) ? gradeChip(r[i]) : esc(r[i])]);
  return header(title) + identityCard(d.identity) + `<h2>${esc(d.title || title)}</h2><div class="card">${
    d.rows.length ? table(cols, d.rows) : `<span class="muted">${esc(d.note || 'Kayıt bulunmamaktadır.')}</span>`}</div>`;
};

// ---------- Piazza (ana menü) ----------
// #/piazza → sınıflar (yeni gönderi sayılarıyla, tek istek: user.status); #/piazza/<sınıf> → gönderiler ve kaynaklar
// (Derslerim'deki Piazza sekmesiyle aynı görünüm).
// #/piazza/<sınıf>/<gönderi> → tek gönderi (gönderi kimliği ya da @numarası; e-postadaki Piazza bağlantıları buraya gelir)
async function viewPiazza(r) {
  const list = await api('piazza');
  if (r.param) {
    const [nid, postId] = r.param.split('/');
    const n = list.find(x => x.id === nid);
    if (postId) {
      const p = await api(`piazza-post?nid=${encodeURIComponent(nid)}&cid=${encodeURIComponent(postId)}`);
      return `<p><a href="#/piazza/${encodeURIComponent(nid)}">← ${n ? esc(n.code) : 'Piazza'}</a></p>` +
        header(p.subject || 'Gönderi', `${n ? `${n.code} · ` : ''}@${p.nr}${p.created ? ' · ' + whenTR(p.created) : ''}`) +
        `<div class="card post-single">${postView(p)}</div>`;
    }
    const head = n ? header(`${n.code} · ${n.name}`, `${n.term}${n.fresh ? ` · ${n.fresh} yeni gönderi` : ''}`) : header('Piazza');
    return '<p><a href="#/piazza">← Piazza</a></p>' + head + await coursePiazza({ piazza: { id: nid } });
  }
  const row = n => `<a class="card course-row" href="#/piazza/${encodeURIComponent(n.id)}">
    <span><b>${esc(n.code)}</b> · ${esc(n.name)} <span class="muted small">${esc(n.term)}</span></span>
    <span class="badges">${n.fresh ? `<span class="pill due-soon">${n.fresh} yeni</span>` : ''}</span></a>`;
  const act = list.filter(n => n.active), old = list.filter(n => !n.active);
  return header('Piazza', `${act.length} etkin sınıf`) + `<div class="list">${act.map(row).join('') || '<div class="card msg">Etkin Piazza sınıfı yok.</div>'}</div>` +
    (old.length ? `<h2>Geçmiş dönemler</h2><div class="list">${old.map(row).join('')}</div>` : '');
}
// E-postadaki Piazza bağlantısı (konudan ders anlaşılamadıysa): sınıfın dersinin Piazza sekmesine gider.
$view.addEventListener('click', async e => {
  const a = e.target.closest('a[data-pz-nid]');
  if (!a) return;
  e.preventDefault();
  const n = (await api('piazza').catch(() => [])).find(x => x.id === a.dataset.pzNid);
  const key = n && courseKey(n.code);
  location.hash = key && key !== n.code ? `#/donem/derslerim/${encodeURIComponent(key)}/piazza` : a.getAttribute('href');
});
// ---------- Piazza (ana menü) sonu ----------

// ---------- Ortalama ve Ders Planı ----------
// Veri /api/plan'dan (UBS transkripti + Ortam müfredatı); hesaplar burada, TOBB ETÜ Lisans Eğitim-Öğretim ve Sınav Yönetmeliği'ne göre:
//  - ağırlıklı puan = kredi × katsayı (md. 27, 30); dönem ortalaması o dönemde alınan bütün derslerden,
//  - GNO'da tekrar edilen dersin yalnızca SON notu sayılır, son not daha düşük olsa bile (md. 25/4); iki basamağa yuvarlanır (md. 30/3),
//  - kredi yükü: program kredisinin en az %9'u (aşağı), en çok %16'sı (yukarı yuvarlanır) (md. 16); tekrarlar da yüke dahil,
//  - CC–BA notlu dersin tekrarı lisans boyunca en fazla 5 ders (md. 25/3); FF tekrarı zorunlu (md. 25/1); DD/DC tekrarı serbest (md. 25/2).
// Seçilen dersler ve hedef notlar yalnızca bu cihazda saklanır.
const GP = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, DD: 1, FF: 0 };
const GRADE_LIST = Object.keys(GP);
const round2 = x => Math.round(x * 100 + 1e-9) / 100;
const fmt2 = x => (Number.isFinite(x) ? round2(x).toFixed(2).replace('.', ',') : '—');
const signed = x => (Math.abs(x) < 0.005 ? '±0,00' : (x > 0 ? '+' : '−') + fmt2(Math.abs(x)));
const PLAN_KEY = 'ders-plani';
let planState = (() => { try { return JSON.parse(localStorage.getItem(PLAN_KEY)) || {}; } catch { return {}; } })();
const savePlan = () => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(planState)); } catch {} };
let planData = null;

// Ders kodu -> geçerli (son) not. Sonraki listeler öncekilerin yerine geçer: transkript, bu dönem hedefleri, sonraki dönem hedefleri.
function gradeMap(attempts, ...layers) {
  const m = new Map();
  for (const a of attempts) m.set(a.code, { credit: a.credit, grade: a.grade });
  for (const list of layers) for (const o of list) if (o.grade in GP) m.set(o.code, { credit: o.credit, grade: o.grade });
  return m;
}
function average(list) {
  let c = 0, p = 0;
  for (const e of list) if (e.grade in GP && e.credit > 0) { c += e.credit; p += e.credit * GP[e.grade]; }
  return c ? p / c : NaN;
}
const gnoOf = (...layers) => average(gradeMap(planData.attempts, ...layers).values());

// Ders bilgisi: müfredat + transkript (kredi, ad, yarıyıl, son not)
function courseIndex(d) {
  const idx = new Map();
  for (const s of d.curriculum) for (const c of s.courses) idx.set(c.code, { ...c, sem: s.sem });
  for (const a of d.attempts) idx.set(a.code, { ...idx.get(a.code), code: a.code, name: a.name, credit: a.credit, last: a.grade });
  for (const c of d.current) idx.set(c.code, { ...idx.get(c.code), code: c.code, name: c.name, credit: c.credit, current: true });
  return idx;
}

async function viewPlan() {
  planData = await api('plan');
  return header('Ortalama ve Ders Planı', 'UBS transkriptinden ve Ortam müfredatından; hedef notlarını seç, ortalamanın nasıl değişeceğini gör') +
    `<div id="plan">${planBody()}</div>`;
}

const gradeSelect = (attr, value, prev) => `<select ${attr} aria-label="Hedef not"><option value="">—</option>${GRADE_LIST.map(g =>
  `<option value="${g}"${g === value ? ' selected' : ''}>${g}</option>`).join('')}</select>`;

function planBody() {
  const d = planData, idx = courseIndex(d);
  planState.cur ??= {};
  planState.next = (planState.next ?? []).filter(x => idx.has(x.code) && !idx.get(x.code).current);
  const curOps = d.current.map(c => ({ code: c.code, credit: c.credit, grade: planState.cur[c.code] || '' }));
  const nextOps = planState.next.map(x => ({ code: x.code, credit: idx.get(x.code).credit, grade: x.grade || '' }));
  const gnoNow = gnoOf();
  const gnoCur = gnoOf(curOps), gnoNext = gnoOf(curOps, nextOps);
  const curSet = curOps.filter(o => o.grade), nextSet = nextOps.filter(o => o.grade);

  // Krediler
  const done = Number(d.totals?.doneCredit) || 0;
  const program = d.programCredits || 0;
  const passedBefore = code => { const g = idx.get(code)?.last; return g && g !== 'FF'; };
  const curNew = d.current.filter(c => !passedBefore(c.code)).reduce((a, c) => a + c.credit, 0);
  const curLoad = d.current.reduce((a, c) => a + c.credit, 0);
  const nextLoad = nextOps.reduce((a, c) => a + c.credit, 0);
  const lim = d.limits;
  const nextSemCourses = d.curriculum.find(s => s.sem === d.nextSem)?.courses ?? [];
  const nextSemCredits = nextSemCourses.reduce((a, c) => a + c.credit, 0);

  const stat = (label, value, note = '') => `<div class="card plan-stat"><span class="muted">${label}</span><b>${value}</b>${note ? `<small class="muted">${note}</small>` : ''}</div>`;
  const pct = program ? Math.min(100, Math.round(done / program * 100)) : 0;
  const summary = `<div class="plan-stats">
    ${stat('GNO', fmt2(gnoNow), Math.abs(round2(gnoNow) - Number(String(d.gano).replace(',', '.'))) < 0.006 ? 'UBS ile aynı' : `UBS: ${esc(d.gano)}`)}
    ${stat('Tamamlanan kredi', `${done}${program ? ` / ${program}` : ''}`, program ? `<span class="plan-bar"><i style="width:${pct}%"></i></span>%${pct}` : '')}
    ${stat('Kalan kredi', program ? Math.max(0, program - done) : '—', program ? `bu dönem geçilirse ${Math.max(0, program - done - curNew)}` : '')}
    ${stat('Bu dönem', `${curLoad} kredi`, `${d.current.length} ders${d.currentTerm ? ` · ${esc(d.currentTerm)}` : ''}`)}
    ${stat(`Sonraki dönem (${d.nextSem}. yarıyıl)`, `${nextSemCredits} kredi`, `müfredata göre${lim ? ` · sınır ${lim.min}–${lim.max}` : ''}`)}
  </div>`;

  // Bu dönem: hedef notlar
  const impact = (layersWith, layersWithout) => gnoOf(...layersWith) - gnoOf(...layersWithout);
  const curRows = d.current.map(c => {
    const g = planState.cur[c.code] || '';
    const without = curOps.map(o => (o.code === c.code ? { ...o, grade: '' } : o));
    const delta = g ? impact([curOps], [without]) : NaN;
    const prev = c.prev ? `<span class="plan-prev" title="Tekrar: GNO'da son not geçerli">önceki ${gradeChip(c.prev.grade)}</span>` : '';
    return `<tr><td><b>${esc(c.code)}</b> ${prev}<div class="muted small">${esc(c.name)}</div></td><td class="n">${c.credit}</td>
      <td>${gradeSelect(`data-plan-cur="${esc(c.code)}"`, g)}</td><td class="n plan-delta ${delta > 0.004 ? 'up' : delta < -0.004 ? 'down' : ''}">${g ? signed(delta) : ''}</td></tr>`;
  }).join('');
  const curFoot = curSet.length ? `<div class="plan-result">Bu hedeflerle: dönem ortalaması <b>${fmt2(average(curSet))}</b> · GNO <b>${fmt2(gnoCur)}</b>
    <span class="plan-delta ${gnoCur - gnoNow > 0.004 ? 'up' : gnoCur - gnoNow < -0.004 ? 'down' : ''}">(${signed(gnoCur - gnoNow)})</span>
    ${curSet.length < d.current.length ? `<span class="muted small">· hedef seçilmeyen ${d.current.length - curSet.length} ders hesaba katılmadı</span>` : ''}</div>`
    : '<p class="muted small">Her dersin hedef notunu seç; GNO etkisi satırda, sonuç altta görünür.</p>';
  const curSection = d.current.length ? `<h2>Bu dönem${d.currentTerm ? ` · ${esc(d.currentTerm)}` : ''}</h2><div class="card">
    <div class="u-scroll"><table class="t plan-table"><thead><tr><th>Ders</th><th class="n">Kredi</th><th>Hedef</th><th class="n">GNO etkisi</th></tr></thead><tbody>${curRows}</tbody></table></div>${curFoot}</div>` : '';

  // Sonraki dönem planı
  const nextRows = planState.next.map(x => {
    const c = idx.get(x.code);
    const without = nextOps.map(o => (o.code === x.code ? { ...o, grade: '' } : o));
    const delta = x.grade ? impact([curOps, nextOps], [curOps, without]) : NaN;
    const prev = c.last ? `<span class="plan-prev">şu an ${gradeChip(c.last)}</span>` : '';
    return `<tr><td><b>${esc(c.code)}</b> ${prev}<div class="muted small">${esc(c.name)}</div></td><td class="n">${c.credit}</td>
      <td>${gradeSelect(`data-plan-next="${esc(x.code)}"`, x.grade || '')}</td>
      <td class="n plan-delta ${delta > 0.004 ? 'up' : delta < -0.004 ? 'down' : ''}">${x.grade ? signed(delta) : ''}</td>
      <td><button class="plan-x" data-plan-remove="${esc(x.code)}" title="Plandan çıkar" aria-label="Plandan çıkar">×</button></td></tr>`;
  }).join('');
  const meterMax = lim ? Math.max(lim.max, nextLoad) : Math.max(nextLoad, 1);
  const state = !lim ? '' : nextLoad > lim.max ? 'over' : nextLoad && nextLoad < lim.min ? 'under' : 'ok';
  const meter = `<div class="plan-meter ${state}"><div class="plan-meter-bar"><i style="width:${Math.round(nextLoad / meterMax * 100)}%"></i>${lim ? `<b style="left:${Math.round(lim.min / meterMax * 100)}%" title="En az ${lim.min}"></b>` : ''}</div>
    <span><b>${nextLoad}</b>${lim ? ` / ${lim.max} kredi` : ' kredi'}${state === 'over' ? ' · sınırı aşıyor' : state === 'under' ? ` · en az ${lim.min} kredi gerekir` : ''}</span></div>`;
  const nextFoot = nextSet.length ? `<div class="plan-result">Plan gerçekleşirse: dönem ortalaması <b>${fmt2(average(nextSet))}</b> · GNO <b>${fmt2(gnoNext)}</b>
    <span class="plan-delta ${gnoNext - gnoNow > 0.004 ? 'up' : gnoNext - gnoNow < -0.004 ? 'down' : ''}">(şu ana göre ${signed(gnoNext - gnoNow)})</span></div>` : '';
  const rule = d.curriculumError ? `<p class="banner">Ortam müfredatı alınamadı (${esc(d.curriculumError)}); yalnızca not yükseltme dersleri listelenebiliyor.</p>` : '';
  const nextSection = `<h2>Sonraki dönem planı${d.nextTerm ? ` · ${esc(d.nextTerm)}` : ''}</h2>${rule}<div class="card">${meter}
    ${planState.next.length ? `<div class="u-scroll"><table class="t plan-table"><thead><tr><th>Ders</th><th class="n">Kredi</th><th>Hedef</th><th class="n">GNO etkisi</th><th></th></tr></thead><tbody>${nextRows}</tbody></table></div>${nextFoot}`
      : '<p class="muted">Aşağıdan ders ekle.</p>'}</div>${candidates(d, idx)}`;

  return summary + curSection + nextSection + goalSection(d, idx, curOps, nextOps) + planNotes(d);
}

// Eklenebilecek dersler: müfredatın sonraki yarıyılı, AA altı notlar (tekrar/yükseltme), geride kalan ve ileri yarıyıl dersleri.
function candidates(d, idx) {
  const chosen = new Set(planState.next.map(x => x.code));
  const free = c => !chosen.has(c.code) && !idx.get(c.code)?.current;
  const passed = c => { const g = idx.get(c.code)?.last; return g && g !== 'FF'; };
  // Kalan yükseltme hakkı: kullanılanlar + bu planda CC–BA notlu dersi yeniden almak (md. 25/3)
  const planned = planState.next.filter(x => ['CC', 'CB', 'BB', 'BA'].includes(idx.get(x.code)?.last)).length;
  const left = Math.max(0, d.improveMax - d.improveUsed - planned);
  const chip = (c, note = '', disabled = false) => `<button class="plan-chip" data-plan-add="${esc(c.code)}"${disabled ? ' disabled' : ''}>
    <b>${esc(c.code)}</b> <span>${esc(c.name)}</span> <small>${c.credit} kr${note ? ` · ${note}` : ''}</small></button>`;
  const nextSem = (d.curriculum.find(s => s.sem === d.nextSem)?.courses ?? []).filter(c => c.credit > 0 && !passed(c) && free(c));
  const behind = d.curriculum.filter(s => s.sem < d.nextSem).flatMap(s => s.courses).filter(c => c.credit > 0 && !idx.get(c.code)?.last && free(c));
  // AA altı: FF zorunlu tekrar, DD/DC serbest, CC–BA yükseltme hakkıyla; olası GNO kazancına göre sıralı
  const latest = [...gradeMap(d.attempts).entries()].map(([code, v]) => ({ code, ...v, name: idx.get(code)?.name || '' }))
    .filter(c => c.grade !== 'AA' && free(c)).sort((a, b) => b.credit * (4 - GP[b.grade]) - a.credit * (4 - GP[a.grade]));
  const why = g => (g === 'FF' ? ' · tekrar zorunlu' : g === 'DD' || g === 'DC' ? ' · hak gerektirmez' : '');
  const improve = latest.map(c => chip(c, `${c.grade}${why(c.grade)}`, ['CC', 'CB', 'BB', 'BA'].includes(c.grade) && left <= 0)).join('');
  const later = d.curriculum.filter(s => s.sem > d.nextSem).flatMap(s => s.courses.map(c => ({ ...c, sem: s.sem }))).filter(c => c.credit > 0 && !passed(c) && free(c));
  const group = (title, html, open = true) => html ? `<details class="plan-group" ${open ? 'open' : ''}><summary>${title}</summary><div class="plan-chips">${html}</div></details>` : '';
  return `<div class="card plan-add"><h3>Ders ekle</h3>
    ${group(`Müfredatta ${d.nextSem}. yarıyıl`, nextSem.map(c => chip(c)).join(''))}
    ${group('Geride kalan dersler', behind.map(c => chip(c, `${c.sem}. yarıyıl`)).join(''))}
    ${group(`AA altı notlu dersler — tekrar / not yükseltme <span class="plan-left">CC–BA yükseltme hakkı: ${left}/${d.improveMax} kaldı</span>`, improve)}
    ${group('İleri yarıyıl dersleri (danışman onayıyla)', later.map(c => chip(c, `${c.sem}. yarıyıl`)).join(''), false)}</div>`;
}

// Hedef GNO: planlanan bütün derslerde (bu dönem + sonraki dönem) ortalama en az kaç olmalı?
function goalSection(d, idx, curOps, nextOps) {
  const goal = parseFloat(String(planState.goal ?? '').replace(',', '.'));
  const planned = [...curOps, ...nextOps];
  let out = '<span class="muted">Hedef bir GNO yaz; planlanan derslerde gereken ortalamayı hesaplayalım.</span>';
  if (Number.isFinite(goal) && planned.length) {
    const codes = new Set(planned.map(o => o.code));
    const base = [...gradeMap(d.attempts).entries()].filter(([code]) => !codes.has(code)).map(([, v]) => v);  // tekrar edilenlerin eski notu çıkar
    const c0 = base.reduce((a, e) => a + e.credit, 0), p0 = base.reduce((a, e) => a + e.credit * GP[e.grade], 0);
    const cs = planned.reduce((a, o) => a + o.credit, 0);
    const need = (goal * (c0 + cs) - p0) / cs;
    const letter = GRADE_LIST.slice().reverse().find(g => GP[g] >= need - 1e-9);
    out = need > 4 ? `<b class="bad">Bu planla ulaşılamıyor</b> — hepsinden AA alsan GNO ${fmt2((p0 + 4 * cs) / (c0 + cs))} olur.`
      : need <= 0 ? '<b>Zaten sağlanıyor</b> — planlanan derslerden FF bile alsan hedefin altına düşmüyorsun.'
      : `Planlanan ${planned.length} derste (${cs} kredi) ortalama en az <b>${fmt2(need)}</b> gerekiyor${letter ? ` — yaklaşık her dersten <b>${letter}</b>` : ''}.`;
  } else if (Number.isFinite(goal)) out = '<span class="muted">Önce bu dönem ya da sonraki dönem için ders seç.</span>';
  return `<h2>Hedef GNO</h2><div class="card plan-goal"><label>Hedef GNO <input type="text" inputmode="decimal" placeholder="3,00" value="${esc(planState.goal ?? '')}" data-plan-goal></label>
    <p>${out}</p></div>`;
}

function planNotes(d) {
  return `<details class="plan-notes"><summary>Hesap nasıl yapılıyor?</summary><ul>
    <li>Ağırlıklı puan = kredi × not katsayısı (AA 4 · BA 3,5 · BB 3 · CB 2,5 · CC 2 · DC 1,5 · DD 1 · FF 0). Ortalama = puanlar toplamı / krediler toplamı, iki basamağa yuvarlanır.</li>
    <li>Tekrar edilen derste GNO'ya yalnızca <b>son alınan not</b> girer; eski not çıkar. Son not daha düşükse GNO düşer (yönetmelik md. 25/4).</li>
    <li>CC, CB, BB, BA notlu derslerden lisans boyunca en fazla 5 ders tekrar edilebilir (md. 25/3); kullanılan: ${d.improveUsed}. FF alınan ders tekrar edilmek zorundadır, DD/DC ortalamayı yükseltmek için tekrar edilebilir.</li>
    <li>Dönem kredi yükü program kredisinin en az %9'u, en çok %16'sıdır${d.limits ? ` (${d.programCredits} kredilik program için ${d.limits.min}–${d.limits.max})` : ''}; tekrar edilen dersler de yüke dahildir (md. 16). GNO 2,00'ın altına düşerse yeni ders sınırları daralır (md. 32).</li>
    <li>"Sonraki dönem" dersleri müfredattaki yarıyıla göre önerilir; o dönem gerçekten açılan dersler ders kayıtlanmada kesinleşir.</li>
  </ul><p class="muted small">Kaynak: <a href="#/ekstra/mevzuat/belge/mg-8-15287">TOBB ETÜ Lisans Eğitim-Öğretim ve Sınav Yönetmeliği</a></p></details>`;
}

const drawPlan = () => { const el = document.getElementById('plan'); if (el && planData) el.innerHTML = planBody(); };
$view.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-plan-cur]')) { planState.cur ??= {}; planState.cur[t.dataset.planCur] = t.value; savePlan(); drawPlan(); }
  if (t.matches('[data-plan-next]')) { const x = planState.next.find(n => n.code === t.dataset.planNext); if (x) x.grade = t.value; savePlan(); drawPlan(); }
  if (t.matches('[data-plan-goal]')) { planState.goal = t.value.trim(); savePlan(); drawPlan(); }
});
$view.addEventListener('click', e => {
  const add = e.target.closest('[data-plan-add]');
  if (add) { planState.next = [...(planState.next ?? []), { code: add.dataset.planAdd, grade: '' }]; savePlan(); return drawPlan(); }
  const rm = e.target.closest('[data-plan-remove]');
  if (rm) { planState.next = planState.next.filter(x => x.code !== rm.dataset.planRemove); savePlan(); drawPlan(); }
});
// ---------- Ortalama ve Ders Planı sonu ----------

// ---------- Başvurular ----------
// ÇAP/YAP - Başvurular: ÇAP/YAP ile Dış İlişkiler hareketlilik formları (Staj, Öğrenim, Mezuniyet Sonrası Staj).
// Her hareketlilik sayfası iki bölüm: başvuru formu (gerçek alanlar) ve Başvurularım. Kapalıyken okulun mesajı görünür.
// Gönderim iki tıklama ister; form doğrulama (reCAPTCHA) ya da dosya istiyorsa gönderim okulun sitesinde yapılır.
const CAP_RULES = `<div class="card"><p style="margin:0">Başvuru şartları, hangi dönemlerde başvurulabildiği ve takvimdeki tarihler:
  <a href="#/ekstra/mevzuat">Mevzuat → Hızlı Yanıtlar</a></p></div>`;
async function viewCap() {
  const c = await api('cap');
  if (!c.active) return header('ÇAP / YAP Başvuru') + `<div class="card msg">${esc(c.message)}</div>` + CAP_RULES;
  return header('ÇAP / YAP Başvuru', 'Başvuru dönemi açık') +
    `<div class="card"><p>Başvuru formu bu arayüze henüz taşınmadı. Okulun sitesinde doldurabilirsiniz:</p>
     <p><a href="https://ortam.etu.edu.tr/CAP-YAP-Basvurusu" target="_blank" rel="noopener">ortam.etu.edu.tr/CAP-YAP-Basvurusu</a></p>
     <p class="muted">${esc(c.text.slice(0, 600))}</p></div>` + CAP_RULES;
}

const APPLY_PAGES = {
  staj: ['Staj Hareketliliği', '/dis-iliskiler/staj-hareketliligi-formu', '/basvurularim/staj-hareketliligi-basvurularim'],
  ogrenim: ['Öğrenim Hareketliliği', '/dis-iliskiler/ogrenim-hareketliligi-formu', '/basvurularim/ogrenim-hareketliligi-basvurularim'],
  mezun: ['Mezuniyet Sonrası Staj Hareketliliği', '/dis-iliskiler/mezuniyet-sonrasi-staj-hareketliligi-formu', '/basvurularim/mezuniyet-sonrasi-staj-hareketliligi-basvurularim'],
};
const viewApply = kind => async () => {
  const [title, formPath, listPath] = APPLY_PAGES[kind];
  const get = p => api('ortam-basvuru?path=' + encodeURIComponent(p)).catch(e => ({ error: e }));
  const [form, list] = await Promise.all([get(formPath), get(listPath)]);
  const part = (p, empty) => {
    if (p.error) return `<div class="card msg err">${esc(p.error.message)}${p.error.login ? `<br>${loginButton(`${p.error.siteName} için giriş yap`, p.error.login)}` : ''}</div>`;
    if (!p.active) return `<div class="card msg">${esc(p.message)}</div>`;
    const offsite = p.captcha || p.hasFile;
    const html = offsite ? p.html.replace(/data-o-submit=/g, 'disabled data-o-off=') : p.html;
    return `<div class="card o-form" data-o-path="${esc(p.path)}">${offsite ? `<p class="banner">Bu form okulun sitesinde gönderilir (${p.captcha ? 'doğrulama' : 'dosya'} gerekiyor).
      <a href="${esc(p.url)}" target="_blank" rel="noopener">Ortam'da aç</a></p>` : ''}${html || `<p class="muted">${empty}</p>`}</div>`;
  };
  return header(title, 'Dış İlişkiler başvurusu') + `<h2>Başvuru formu</h2>${part(form, 'Form bulunamadı.')}<h2>Başvurularım</h2>${part(list, 'Başvuru yok.')}`;
};

function oFields(box) {
  const f = {};
  box.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'checkbox') f[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) f[el.name] = el.value; }
    else if (el.multiple) f[el.name] = [...el.selectedOptions].map(o => o.value);
    else f[el.name] = el.value;
  });
  return f;
}

async function oSubmit(btn) {
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.dataset.label = btn.textContent;
    btn.textContent = `Okula gönderilecek. Onaylıyor musunuz? → ${btn.dataset.label}`;
    btn.classList.add('armed');
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; btn.classList.remove('armed'); } }, 10_000);
    return;
  }
  const box = btn.closest('[data-o-path]');
  btn.disabled = true;
  const r = await post('/api/ortam/basvuru', { path: box.dataset.oPath, fields: oFields(box) });
  const j = await r.json().catch(() => ({}));
  btn.disabled = false;
  toast(r.ok ? j.message : j.error || 'Gönderilemedi');
  if (r.ok) render();
}
// ---------- Başvurular sonu ----------

// ---------- Açılan Dersler ve haftalık ders planı ----------
// Ekstra > Açılan Dersler: dönemin açılan dersleri uygulamayla gelen veri dosyasından okunur (/api/program), okula istek gitmez.
// Ders ya da ders hocası aranır, dersler plana eklenir; haftalık takvimde şube seçilir (seçili şube yeşil), seçili şubelerin
// çakışan saatleri takvimde ve yan panelde gösterilir, istenen dersler için çakışmayan şube kombinasyonları üretilir.
// Plan bu cihazda 'program-taslak' anahtarında: { v: 2, term, courses: [kod], picks: { kod: şube }, off: { kod: [gizli şube] }, active: kod, last: son temizlenen set }.
let acilanQ = '';
let acilanNext = null;                 // Enter'ın plana ekleyeceği ders
let acilanCursor = 0;                  // eklenebilir dersler arasında ok tuşlarıyla seçilen sıra
let acilanMode = 'ders';               // 'ders' | 'hoca' (ders hocası araması)
let acilanData = null;                 // { term, updated, courses, byCode, hocas }
let plCombos = null;                   // son üretilen kombinasyonlar: { list, total, none }
let kadroIndex = null;                 // okulun sitesindeki akademik kadro dizini (ilk ders hocası aramasında yüklenir)
let taslak = (() => { try { return JSON.parse(localStorage.getItem('program-taslak')) || {}; } catch { return {}; } })();
const saveTaslak = () => { try { localStorage.setItem('program-taslak', JSON.stringify(taslak)); } catch {} };
const trLower = s => String(s ?? '').toLocaleLowerCase('tr');
const trFold = s => trLower(s).replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '');

// Planlayıcı için: yayımlanmış dönemde açılan derslerin normalleştirilmiş kodları (courseKey: "BİL 214" -> "BIL214").
let offeredCache = null;
function offeredCodes() {
  offeredCache ??= fetch('/api/ortam-acilan').then(r => (r.ok ? r.json() : Promise.reject(new Error('Açılan dersler alınamadı'))))
    .then(d => new Set(d.active ? d.courses.map(c => courseKey(c.code)) : []))
    .catch(e => { offeredCache = null; throw e; });
  return offeredCache;
}

// Eski adres (#/donem/acilan) yeni yere yönlenir
const acilanRedirect = () => { if (/^#\/donem\/acilan/.test(location.hash)) location.replace('#/ekstra/acilan'); };
acilanRedirect();
window.addEventListener('hashchange', acilanRedirect);

const PL_DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const PL_SHORT = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const tmin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dropZero = t => String(t).replace(/^0/, '');

function prepProgram(p) {
  const courses = p.courses.map(c => {
    const s = c.s.map(x => ({ id: x.s || 'tek', sec: x.s, hoca: x.h, code: c.c,
      meets: x.m.map(([d, from, to, r]) => ({ d, from, to, r, a: tmin(from), b: tmin(to) })) }));
    return { c: c.c, n: c.n, s, fold: trFold(`${c.c} ${c.n}`), compact: trFold(c.c).replace(/\s/g, '') };
  });
  const hocas = new Map();
  for (const c of courses) for (const x of c.s) for (const h of x.hoca.split(', ').filter(Boolean)) {
    if (!hocas.has(h)) hocas.set(h, new Set());
    hocas.get(h).add(c);
  }
  return { term: p.term, updated: p.updated, courses, byCode: new Map(courses.map(c => [c.c, c])), hocas };
}
const secLabel = x => (x.sec ? `Şube ${x.sec}` : 'Tek şube');
const secShort = x => (x.sec ? `Ş.${x.sec}` : '');
const meetText = m => `${PL_SHORT[m.d]} ${dropZero(m.from)}–${dropZero(m.to)} · ${m.r}`;
const plList = () => (taslak.courses || []).map(c => acilanData.byCode.get(c)).filter(Boolean);
const plPicked = c => c.s.find(x => x.id === taslak.picks?.[c.c]) ?? null;
const plHidden = x => !!taslak.off?.[x.code]?.includes(x.id);
const plEmpty = term => ({ v: 2, term, courses: [], picks: {}, off: {}, active: null });
const plSet = () => (taslak.courses?.length ? { courses: taslak.courses, picks: taslak.picks, off: taslak.off } : null);

async function viewAcilan() {
  acilanData ??= prepProgram(await api('program'));
  const d = acilanData;
  if (taslak.v !== 2 || taslak.term !== d.term) { taslak = plEmpty(d.term); saveTaslak(); }
  taslak.off ??= {};
  const modes = [['ders', 'Ders'], ['hoca', 'Ders hocası']];
  return header('Açılan Dersler', `${d.term} · ${d.courses.length} ders, ${d.hocas.size} ders hocası`) +
    `<p class="pl-note">${icon('clock')}<span>Ders verisi son güncelleme: <b>${fmtDay(d.updated)}</b>. Şube, saat ve derslikler sonradan değişmiş olabilir; kayıttan önce okulun güncel programından kontrol et.</span></p>
    <div class="card ac-search"><div class="tabs ac-modes">${modes.map(([id, label]) => `<button type="button" data-ac-mode="${id}" class="${id === acilanMode ? 'on' : ''}">${label}</button>`).join('')}</div>
      <input type="search" data-ac-q placeholder="${acilanMode === 'hoca' ? 'Ders hocası adı ara (ör. Yılmaz)' : 'Ders kodu ya da adı ara (ör. BİL 214, Olasılık)'}" value="${esc(acilanQ)}" autocomplete="off">
      <div id="ac-list">${acilanList()}</div></div>
    <div id="pl-area">${plArea()}</div>`;
}

function acilanList() {
  const q = trFold(acilanQ.trim());
  if (!q) return `<p class="muted small">${acilanMode === 'hoca' ? 'Ada göre ara: bu dönem ders veren ders hocaları ve dersleri listelenir.' : 'Ders ara ve plana ekle; dersler aşağıdaki haftalık takvimde görünür.'}</p>`;
  acilanNext = acTarget(q);
  return acilanMode === 'hoca' ? hocaList(q) : acilanResults(q);
}
const acToggle = c => {
  const on = (taslak.courses || []).includes(c.c);
  return `<button class="btn ${on ? '' : 'primary'}" data-ac-toggle="${esc(c.c)}">${on ? 'Plandan çıkar' : `Plana ekle${c === acilanNext ? ' ↵' : ''}`}</button>`;
};
const acRowCls = c => `ac-row pl-row${c === acilanNext ? ' next' : ''}`;
const acHits = q => {
  const qc = q.replace(/\s/g, '');
  const hits = acilanData.courses.filter(c => c.fold.includes(q) || c.compact.includes(qc));
  // Kodu aramayla başlayanlar önce: "FİZ" yazınca Enter adında "fiz" geçen başka bölümün dersini değil, FİZ dersini ekler
  return hits.sort((x, y) => y.compact.startsWith(qc) - x.compact.startsWith(qc));
};
const hocaHits = q => [...acilanData.hocas.keys()].filter(n => trFold(n).includes(q)).sort((a, b) => a.localeCompare(b, 'tr'));
const hocaCourses = n => [...acilanData.hocas.get(n)].sort((a, b) => a.c.localeCompare(b.c, 'tr'));
// Listede görünen, plana henüz eklenmemiş dersler; Enter'ın hedefi ok tuşlarıyla bunlar arasında değişir
const acAddable = q => [...new Set(acilanMode === 'hoca' ? hocaHits(q).slice(0, 30).flatMap(hocaCourses) : acHits(q).slice(0, 50))]
  .filter(c => !(taslak.courses || []).includes(c.c));
const acTarget = q => {
  const l = acAddable(q);
  acilanCursor = Math.min(acilanCursor, Math.max(0, l.length - 1));
  return l[acilanCursor] ?? null;
};
function acilanResults(q) {
  const hits = acHits(q);
  if (!hits.length) return '<p class="muted">Bu aramayla açılan ders yok.</p>';
  return `<div class="ac-rows">${hits.slice(0, 50).map(c => `<div class="${acRowCls(c)}"><span><b>${esc(c.c)}</b> <span class="muted">${esc(c.n)}</span></span>
    <span class="muted small">${c.s.length > 1 ? `${c.s.length} şube` : 'Tek şube'}</span>${acToggle(c)}</div>`).join('')}</div>
    ${hits.length > 50 ? `<p class="muted small">${hits.length - 50} sonuç daha; aramayı daralt.</p>` : ''}`;
}

// Ders hocası: ders verisinden; okulun sitesindeki kadroyla ad–soyadına göre eşleştirilir (bölüm, unvan, profil).
function hocaList(q) {
  const hits = hocaHits(q);
  if (!hits.length) return '<p class="muted">Bu adla bu dönem ders veren ders hocası yok.</p>';
  if (!kadroIndex) {
    kadroIndex = 'yükleniyor';
    api('etu-kadro').then(k => { kadroIndex = k; }, () => { kadroIndex = { people: [] }; })
      .finally(() => { const l = document.getElementById('ac-list'); if (l) l.innerHTML = acilanList(); });
  }
  const people = kadroIndex?.people ?? [];
  const tokens = n => trFold(n).split(/\s+/).filter(Boolean);
  const match = name => {
    const t = tokens(name);
    return people.filter(p => { const pt = tokens(p.name); return pt[0] === t[0] && pt.at(-1) === t.at(-1); });
  };
  return `<div class="ac-rows">${hits.slice(0, 30).map(n => {
    const m = match(n);
    const info = m.length ? [...new Set(m.map(p => `${p.title ? p.title + ' · ' : ''}${p.unit}`))].join(' / ') : '';
    const link = m[0] ? `<a class="btn" href="${esc(m[0].url)}" target="_blank" rel="noopener">${icon('external')}Akademik kadro</a>` : '';
    return `<div class="pl-hoca"><div class="pl-hoca-h"><span><b>${esc(n)}</b>${info ? ` <span class="muted">${esc(info)}</span>` : ''}</span>${link}</div>
      ${hocaCourses(n).map(c => `<div class="${acRowCls(c)}"><span><b>${esc(c.c)}</b> <span class="muted">${esc(c.n)}</span></span><span></span>${acToggle(c)}</div>`).join('')}</div>`;
  }).join('')}</div>
  ${kadroIndex === 'yükleniyor' ? '<p class="muted small">Bölüm ve unvan bilgileri yükleniyor…</p>' : ''}
  ${hits.length > 30 ? `<p class="muted small">${hits.length - 30} sonuç daha; aramayı daralt.</p>` : ''}`;
}

// ---------- Çakışma ve kombinasyon ----------
const meetsOverlap = (x, y) => x.meets.some(m => y.meets.some(n => m.d === n.d && m.a < n.b && n.a < m.b));
function plClashes() {
  const picked = plList().map(plPicked).filter(Boolean);
  const out = [];
  for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++)
    for (const m of picked[i].meets) for (const n of picked[j].meets)
      if (m.d === n.d && m.a < n.b && n.a < m.b) out.push({ x: picked[i], y: picked[j], d: m.d, a: Math.max(m.a, n.a), b: Math.min(m.b, n.b) });
  return out;
}
// Aynı saatlerdeki şubeler tek seçenek sayılır; arama en az seçenekli dersten başlar. Az gün, az boşluk ve erken başlamayan programlar öne çıkar.
function plScore(pick) {
  const byDay = new Map();
  for (const x of pick) for (const m of x.meets) { if (!byDay.has(m.d)) byDay.set(m.d, []); byDay.get(m.d).push(m); }
  let gap = 0, early = 0;
  for (const l of byDay.values()) {
    l.sort((p, q) => p.a - q.a);
    if (l[0].a < 570) early++;
    for (let i = 1; i < l.length; i++) gap += Math.max(0, l[i].a - l[i - 1].b);
  }
  return { days: byDay.size, gap, score: byDay.size * 120 + gap + early * 20 };
}
function plFindCombos() {
  const groups = plList().map(c => {
    const seen = new Map();
    for (const x of c.s) {
      const key = x.meets.map(m => `${m.d}|${m.from}|${m.to}`).sort().join(';');
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(x);
    }
    return { c, options: [...seen.values()] };
  }).sort((a, b) => a.options.length - b.options.length);
  const found = [];
  let steps = 0;
  const walk = (i, acc) => {
    if (found.length >= 20000 || steps++ > 400000) return;
    if (i === groups.length) { found.push([...acc]); return; }
    for (const opt of groups[i].options) {
      if (acc.some(x => meetsOverlap(x, opt[0]))) continue;
      // Seçili şube aynı saatlerdeyse o korunur
      acc.push(opt.find(x => x.id === taslak.picks?.[x.code]) ?? opt[0]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  const scored = found.map(pick => ({ pick, ...plScore(pick) })).sort((a, b) => a.score - b.score);
  const blocked = [];
  if (!scored.length) for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++)
    if (groups[i].c.s.every(x => groups[j].c.s.every(y => meetsOverlap(x, y)))) blocked.push([groups[i].c.c, groups[j].c.c]);
  return { list: scored.slice(0, 5), total: found.length, blocked };
}

// ---------- Takvim ----------
const PL_HOUR = 54;                     // bir saatin yüksekliği (piksel)
const PL_LANE = 34;                     // yan yana duran bir kutunun en az genişliği (piksel)
// Aynı günde üst üste binenler yan yana şeritlere dizilir
function plLanes(items) {
  items.sort((p, q) => p.a - q.a || q.b - p.b);
  let cluster = [], end = -1;
  const flush = () => {
    const lanes = [];
    for (const it of cluster) {
      let l = lanes.findIndex(e => e <= it.a);
      if (l < 0) { l = lanes.length; lanes.push(0); }
      lanes[l] = it.b;
      it.lane = l;
    }
    for (const it of cluster) it.lanes = lanes.length;
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.a >= end) { flush(); end = -1; }
    cluster.push(it);
    end = Math.max(end, it.b);
  }
  flush();
}
function plBlocks() {
  const list = plList(), items = [];
  for (const c of list) {
    const p = plPicked(c);
    if (p) for (const m of p.meets) items.push({ kind: 'sel', c, x: p, m, d: m.d, a: m.a, b: m.b });
    // Seçilmemiş şubeler hep görünür (gizlenenler hariç); şubesi seçili dersinkiler daha soluk. Aynı saattekiler tek kutuda.
    const groups = new Map();
    for (const x of c.s) if (x !== p && !plHidden(x)) for (const m of x.meets) {
      const k = `${m.d}|${m.a}|${m.b}`;
      if (!groups.has(k)) groups.set(k, { kind: 'alt', c, quiet: !!p && taslak.active !== c.c, secs: [], m, d: m.d, a: m.a, b: m.b });
      groups.get(k).secs.push(x);
    }
    items.push(...groups.values());
  }
  return items;
}
function plCalendar(clashes) {
  const items = plBlocks();
  const hits = (x, m) => clashes.filter(k => k.d === m.d && m.a < k.b && k.a < m.b && (k.x === x || k.y === x));
  const days = items.some(i => i.d === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const from = Math.min(510, ...items.map(i => i.a)), to = Math.max(1160, ...items.map(i => i.b));   // 18.30 dersi hep görünür
  const top = Math.floor((from - 30) / 60) * 60 + 30;
  const hours = Math.ceil((to - top) / 60);
  const y = m => (m - top) / 60 * PL_HOUR;
  const perDay = days.map(d => {
    const list = items.filter(i => i.d === d);
    plLanes(list);
    return { d, list, lanes: Math.max(1, ...list.map(i => i.lanes)) };
  });
  const col = ({ list: dayItems }) => {
    return `<div class="pl-day" style="height:${hours * PL_HOUR}px">${dayItems.map(i => {
      const pos = `top:${y(i.a)}px;height:${Math.max(30, y(i.b) - y(i.a) - 2)}px;left:calc(${i.lane * 100 / i.lanes}% + 2px);width:calc(${100 / i.lanes}% - 4px)`;
      if (i.kind === 'sel') {
        const bad = hits(i.x, i.m);
        return `<button type="button" class="pl-b sel${bad.length ? ' clash' : ''}" style="${pos}" data-pl-pick="${esc(i.c.c)}|${esc(i.x.id)}" data-sec="${esc(i.c.c)}|${esc(i.x.id)}" aria-pressed="true"
          title="${esc(`${i.c.c} ${i.c.n} · ${secLabel(i.x)}${i.x.hoca ? ` · ${i.x.hoca}` : ''}${bad.map(k => ` · Çakışma: ${dropZero(hhmm(k.a))}–${dropZero(hhmm(k.b))}`).join('')} · Seçimi kaldırmak için tıkla`)}">${
          // Yalnızca gerçekten çakışan saat dilimi çizgili
          bad.map(k => `<i class="pl-ov" style="top:${y(k.a) - y(i.a)}px;height:${y(k.b) - y(k.a)}px"></i>`).join('')}<b>${esc(i.c.c)}${i.x.sec ? ` <em>·</em> ${esc(secShort(i.x))}` : ''}</b><span>${esc(i.c.n)}</span><small>${esc(i.m.r)}</small></button>`;
      }
      return `<div class="pl-b alt${i.quiet ? ' quiet' : ''}" style="${pos}" title="${esc(`${i.c.c} ${i.c.n}`)}"><b>${esc(i.c.c)}</b><span class="pl-mini">${esc(i.c.n)}</span><span class="pl-pills">${i.secs.map(x =>
        `<button type="button" data-pl-pick="${esc(i.c.c)}|${esc(x.id)}" data-sec="${esc(i.c.c)}|${esc(x.id)}" title="${esc(`${secLabel(x)}${x.hoca ? ` · ${x.hoca}` : ''}`)}">${esc(x.sec || '✓')}</button>`).join('')}</span></div>`;
    }).join('')}</div>`;
  };
  // Şubesi çok olan güne daha çok yer düşer; yine sığmazsa takvim yana kayar
  const cols = perDay.map(x => `minmax(${Math.max(70, x.lanes * PL_LANE)}px, ${Math.max(2, x.lanes)}fr)`).join(' ');
  return `<div class="pl-scroll"><div class="pl-grid" style="grid-template-columns:42px ${cols};--pl-hour:${PL_HOUR}px">
    <div class="pl-corner"></div>${days.map(d => `<div class="pl-h">${PL_DAYS[d]}</div>`).join('')}
    <div class="pl-times" style="height:${hours * PL_HOUR}px">${Array.from({ length: hours }, (_, i) => `<span style="top:${i * PL_HOUR}px">${dropZero(hhmm(top + i * 60))}</span>`).join('')}</div>
    ${perDay.map(col).join('')}</div></div>`;
}

// ---------- Yan panel ----------
function plPanel(clashes) {
  const list = plList();
  const restore = taslak.last?.courses?.length
    ? `<button type="button" class="btn ghost" data-pl-restore title="Şu anki dersler varsa onların yerine geçer; şu anki set de bu düğmeyle geri getirilebilir">Son ders setini geri yükle (${taslak.last.courses.length} ders)</button>` : '';
  if (!list.length) return `<div class="card msg">Henüz ders yok. Yukarıdan ders ara ve plana ekle.${restore ? `<div class="pl-tools">${restore}</div>` : ''}</div>`;
  const courses = list.map(c => {
    const p = plPicked(c), open = taslak.active === c.c;
    const others = list.filter(o => o !== c).map(plPicked).filter(Boolean);
    const clashWith = x => others.filter(o => meetsOverlap(x, o)).map(o => `${o.code}${o.sec ? ` ${secShort(o)}` : ''}`);
    return `<div class="pl-c${open ? ' open' : ''}${p ? '' : ' wait'}">
      <div class="pl-c-h"><button type="button" class="pl-c-t" data-pl-active="${esc(c.c)}" aria-expanded="${open}"><b>${esc(c.c)}</b> <span class="muted">${esc(c.n)}</span>
        <span class="small ${p ? 'me-ok' : 'pl-need'}">${p ? esc(c.s.length > 1 ? secLabel(p) : 'Seçili') : 'Şube seç'}</span></button>
        <button type="button" class="x" data-ac-toggle="${esc(c.c)}" title="Plandan çıkar" aria-label="${esc(c.c)} dersini plandan çıkar">×</button></div>
      ${c.s.length > 1 ? `<div class="pl-cpick">${c.s.filter(x => x === p || !plHidden(x)).map(x => `<button type="button" class="${x === p ? 'on' : ''}" data-pl-pick="${esc(c.c)}|${esc(x.id)}" data-sec="${esc(c.c)}|${esc(x.id)}" aria-pressed="${x === p}" title="${esc(`${secLabel(x)}: ${x.meets.map(meetText).join(', ')}`)}">${esc(x.sec || '✓')}</button>`).join('')}</div>` : ''}
      ${open ? `<div class="pl-secs">${c.s.map(x => {
        const off = plHidden(x), key = `${esc(c.c)}|${esc(x.id)}`;
        return `<div class="pl-sec-row${off ? ' off' : ''}"><button type="button" class="pl-sec${x === p ? ' on' : ''}" data-pl-pick="${key}" data-sec="${key}" aria-pressed="${x === p}"${off && x !== p ? ' disabled' : ''}>
        <b>${esc(secLabel(x))}</b><span>${x.meets.map(m => `<i>${esc(meetText(m))}</i>`).join('')}</span>${x.hoca ? `<small class="muted">${esc(x.hoca)}</small>` : ''}${
        clashWith(x).length ? `<small class="pl-warn">${esc(clashWith(x).join(', '))} ile çakışıyor</small>` : ''}</button>${
        c.s.length > 1 ? `<button type="button" class="pl-off" data-pl-off="${key}" title="${off ? 'Takvimde yeniden göster' : 'Takvimde gösterme (otomatik programları etkilemez)'}">${off ? 'göster' : 'gizle'}</button>` : ''}</div>`;
      }).join('')}</div>` : ''}</div>`;
  }).join('');
  const seen = new Set();
  const clashList = clashes.length ? `<div class="card pl-clashes"><b>Çakışan saatler</b><ul>${clashes.filter(k => {
    const key = `${k.x.code}|${k.y.code}|${k.d}|${k.a}`;
    return !seen.has(key) && seen.add(key);
  }).map(k => `<li><b>${esc(k.x.code)}${k.x.sec ? ` ${esc(secShort(k.x))}` : ''}</b> ve <b>${esc(k.y.code)}${k.y.sec ? ` ${esc(secShort(k.y))}` : ''}</b>: ${PL_DAYS[k.d]} ${dropZero(hhmm(k.a))}–${dropZero(hhmm(k.b))}</li>`).join('')}</ul></div>`
    : list.every(plPicked) && list.length > 1 ? '<p class="pl-ok small">Seçili şubeler çakışmıyor.</p>' : '';
  return `${clashList}<div class="card pl-cs">${courses}<div class="pl-tools"><button type="button" class="btn primary" data-pl-combos>Çakışmayan programları bul</button>
    <button type="button" class="btn ghost" data-pl-unpick${list.some(c => c.s.length > 1 && plPicked(c)) ? '' : ' disabled'}>Şube seçimlerini sıfırla</button>
    <button type="button" class="btn ghost" data-pl-reset>Planı temizle</button>${restore}</div></div>${plComboBox()}`;
}
function plComboBox() {
  if (!plCombos) return '';
  const r = plCombos;
  if (!r.list.length) return `<div class="card pl-clashes"><b>Çakışmayan program yok</b><p class="small">${r.blocked.length
    ? `Bu derslerin bütün şubeleri birbiriyle çakışıyor: ${r.blocked.map(([a, b]) => `${esc(a)} ve ${esc(b)}`).join('; ')}.`
    : 'Bu derslerin hepsini çakışmadan alan bir şube kombinasyonu bulunamadı. Bir dersi çıkarıp yeniden dene.'}</p></div>`;
  const sameAs = o => o.pick.every(x => taslak.picks?.[x.code] === x.id);
  return `<div class="card pl-combos"><b>Çakışmayan programlar</b><span class="muted small"> ${r.total > 5 ? `${r.total >= 20000 ? '20.000+' : r.total} seçenekten en iyi 5'i` : `${r.list.length} seçenek`}: az gün ve az boşluk önce</span>
    ${r.list.map((o, i) => `<div class="pl-combo${sameAs(o) ? ' on' : ''}"><div><b>Program ${i + 1}</b> <span class="muted small">${o.gap ? `${dur(o.gap * 60_000)} boşluk` : 'boşluk yok'} · ${o.days} gün</span>
      <div class="pl-chips">${o.pick.map(x => `<span>${esc(x.code)}${x.sec ? ` ${esc(secShort(x))}` : ''}</span>`).join('')}</div></div>
      <button type="button" class="btn${sameAs(o) ? '' : ' primary'}" data-pl-apply="${i}"${sameAs(o) ? ' disabled' : ''}>${sameAs(o) ? 'Takvimde' : 'Takvime uygula'}</button></div>`).join('')}</div>`;
}
function plArea() {
  const clashes = plClashes();
  return `<div class="pl-wrap"><section class="card pl-cal"><div class="pl-cal-h"><h2>Haftalık takvim</h2>
      <span class="pl-legend"><i class="sel"></i>Seçili şube<i class="alt"></i>Seçilebilir şube<i class="clash"></i>Çakışma</span></div>${plCalendar(clashes)}</section>
    <aside class="pl-side">${plPanel(clashes)}</aside></div>`;
}
function plRender() {
  saveTaslak();
  const a = document.getElementById('pl-area');
  if (a) a.innerHTML = plArea();
}
const acRefresh = () => { const l = document.getElementById('ac-list'); if (l) l.innerHTML = acilanList(); };
// Ders eklenince arama sıfırlanır
function plAdd(code) {
  taslak.courses = [...(taslak.courses || []), code];
  const c = acilanData.byCode.get(code);
  if (c?.s.length === 1) taslak.picks[code] = c.s[0].id;      // tek şubeli ders kendiliğinden seçili
  taslak.active = code;
  plCombos = null;
  acilanQ = '';
  acilanCursor = 0;
  const q = $view.querySelector('[data-ac-q]');
  if (q) q.value = '';
  acRefresh();
  plRender();
}

$view.addEventListener('input', e => {
  if (e.target.matches('[data-ac-q]')) { acilanQ = e.target.value; acilanCursor = 0; acRefresh(); }
});
// Enter: listede işaretli dersi plana ekler; yukarı ve aşağı oklar işareti taşır
$view.addEventListener('keydown', e => {
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key) || e.isComposing || !e.target.matches('[data-ac-q]')) return;
  e.preventDefault();
  const q = trFold(acilanQ.trim());
  if (e.key === 'Enter') { const c = acTarget(q); if (c) plAdd(c.c); return; }
  const n = acAddable(q).length;
  if (!n) return;
  acilanCursor = (acilanCursor + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
  acRefresh();
  document.querySelector('#ac-list .ac-row.next')?.scrollIntoView({ block: 'nearest' });
});
// Bir şubenin üzerine gelince aynı şubenin bütün saatleri belirginleşir
$view.addEventListener('mouseover', e => {
  const s = e.target.closest?.('[data-sec]')?.dataset.sec;
  if (s === plHover) return;
  plHover = s;
  $view.querySelectorAll('.pl-hover').forEach(x => x.classList.remove('pl-hover'));
  if (s) $view.querySelectorAll(`[data-sec="${CSS.escape(s)}"]`).forEach(x => x.classList.add('pl-hover'));
});
let plHover = null;
$view.addEventListener('click', e => {
  const mode = e.target.closest('[data-ac-mode]');
  if (mode) { acilanMode = mode.dataset.acMode; acilanQ = ''; acilanCursor = 0; return render(); }
  const tog = e.target.closest('[data-ac-toggle]');
  if (tog) {
    const code = tog.dataset.acToggle;
    if (!(taslak.courses || []).includes(code)) return plAdd(code);
    taslak.courses = taslak.courses.filter(x => x !== code);
    delete taslak.picks[code];
    delete taslak.off[code];
    if (taslak.active === code) taslak.active = null;
    plCombos = null;
    acRefresh();
    return plRender();
  }
  const off = e.target.closest('[data-pl-off]');
  if (off) {
    const [code, id] = off.dataset.plOff.split('|');
    const l = taslak.off[code] ?? [];
    taslak.off[code] = l.includes(id) ? l.filter(x => x !== id) : [...l, id];
    return plRender();
  }
  const pick = e.target.closest('[data-pl-pick]');
  if (pick) {
    const [code, id] = pick.dataset.plPick.split('|');
    if (taslak.picks[code] === id) delete taslak.picks[code]; else taslak.picks[code] = id;
    taslak.active = code;
    return plRender();
  }
  const act = e.target.closest('[data-pl-active]');
  if (act) { const c = act.dataset.plActive; taslak.active = taslak.active === c ? null : c; return plRender(); }
  if (e.target.closest('[data-pl-combos]')) { plCombos = plFindCombos(); return plRender(); }
  const ap = e.target.closest('[data-pl-apply]');
  if (ap) {
    for (const x of plCombos.list[+ap.dataset.plApply].pick) taslak.picks[x.code] = x.id;
    taslak.active = null;
    return plRender();
  }
  if (e.target.closest('[data-pl-unpick]')) {
    taslak.picks = Object.fromEntries(plList().filter(c => c.s.length === 1).map(c => [c.c, c.s[0].id]));
    return plRender();
  }
  // Temizlenen set saklanır; geri yüklerken o anki setle yer değiştirir, ikisi de kaybolmaz
  const reset = e.target.closest('[data-pl-reset]'), restore = e.target.closest('[data-pl-restore]');
  if (reset || restore) {
    taslak = { ...plEmpty(acilanData.term), ...(restore ? taslak.last : null), active: null, last: plSet() };
    plCombos = null;
    acRefresh();
    return plRender();
  }
  const o = e.target.closest('button[data-o-submit]');
  if (o) return oSubmit(o);
});

// ---------- Ekstra: Akademik Takvim, Akademik Kadro, Yabancı Diller ----------
// Okulun herkese açık sitesinden (www.etu.edu.tr); giriş gerekmez, sunucuda bir gün önbellekte tutulur.
let takvimTab = 0;
async function viewTakvim() {
  const c = await api('etu-takvim');
  const now = Date.now();
  const tab = c.tabs[takvimTab] ?? c.tabs[0];
  const all = tab.terms.flatMap(t => t.items);
  const upcoming = all.filter(i => i.end && i.end >= now).sort((a, b) => a.start - b.start).slice(0, 4);
  const cls = i => (!i.end ? '' : i.end < now ? 'past' : i.start <= now ? 'now' : '');
  return header('Akademik Takvim', tab.title) +
    `<div class="tabs">${c.tabs.map((t, i) => `<button type="button" data-takvim="${i}" class="${t === tab ? 'on' : ''}">${esc(t.title.replace(/^\d{4}\s*[–-]\s*\d{4}\s*/, ''))}</button>`).join('')}</div>` +
    (upcoming.length ? `<div class="card tk-next"><b>Sıradaki</b><ul>${upcoming.map(i => `<li class="${cls(i)}"><span class="tk-when">${esc(i.when)}</span> ${esc(i.what)}</li>`).join('')}</ul></div>` : '') +
    tab.terms.map(t => `<h2>${esc(t.title)}</h2><div class="card"><ul class="tk-list">${t.items.map(i =>
      `<li class="${cls(i)}"><span class="tk-when">${esc(i.when)}</span><span>${esc(i.what)}</span></li>`).join('')}</ul></div>`).join('') +
    `<p class="muted small">Kaynak: <a href="${esc(c.source)}" target="_blank" rel="noopener">etu.edu.tr akademik takvim</a></p>`;
}

let kadroQ = '';
async function viewKadro() {
  const f = await api('etu-fakulteler');
  return header('Akademik Kadro', 'Bölümü seç; okulun sitesindeki akademik kadro sayfası açılır') +
    `<div class="card ac-search"><input type="search" data-kadro-q placeholder="İsimle ara (ör. Eravcı)" value="${esc(kadroQ)}" autocomplete="off"><div id="kadro-hits">${kadroHits()}</div></div>` +
    f.faculties.map(fa => `<h2>${esc(fa.title)}</h2><div class="card mitems">${fa.units.map(u =>
      `<div class="mi"><a class="mi-main" href="${esc(u.staffUrl)}" target="_blank" rel="noopener">${icon('external')}<span>${esc(u.name)}</span></a></div>`).join('')}</div>`).join('');
}
function kadroHits() {
  const q = trFold(kadroQ.trim());
  if (!q) return '';
  if (!kadroIndex || kadroIndex === 'yükleniyor') {
    if (!kadroIndex) {
      kadroIndex = 'yükleniyor';
      api('etu-kadro').then(k => { kadroIndex = k; }, () => { kadroIndex = { people: [] }; })
        .finally(() => { const h = document.getElementById('kadro-hits'); if (h) h.innerHTML = kadroHits(); });
    }
    return '<p class="muted small">Kadro listesi yükleniyor…</p>';
  }
  const hits = kadroIndex.people.filter(p => trFold(p.name).includes(q));
  if (!hits.length) return '<p class="muted">Bu adla kimse bulunamadı.</p>';
  return `<div class="ac-rows">${hits.slice(0, 30).map(p => `<div class="ac-row"><span><b>${esc(p.name)}</b> <span class="muted">${esc([p.title, p.unit].filter(Boolean).join(' · '))}</span></span>
    <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${icon('external')}Profil</a></div>`).join('')}</div>`;
}

const YABANCI_DILLER = 'https://www.etu.edu.tr/tr/bolum/yabanci-diller-bolumu';
async function viewYabanciDiller() {
  return header('Yabancı Diller', 'TOBB ETÜ Yabancı Diller Bölümü') +
    `<div class="card"><p style="margin-top:0">Hazırlık programı, ikinci yabancı dil dersleri ve duyurular okulun Yabancı Diller sitesinde.</p>
      <a class="btn primary" href="${YABANCI_DILLER}" target="_blank" rel="noopener">${icon('external')}Yabancı Diller sitesini aç</a></div>`;
}

$view.addEventListener('click', e => {
  const t = e.target.closest('[data-takvim]');
  if (t) { takvimTab = Number(t.dataset.takvim); render(); }
});
$view.addEventListener('input', e => {
  if (e.target.matches('[data-kadro-q]')) { kadroQ = e.target.value; const h = document.getElementById('kadro-hits'); if (h) h.innerHTML = kadroHits(); }
});
// ---------- Açılan Dersler sonu ----------

// ---------- UBS ----------
// #/ubs → ana sayfa; #/ubs/<kodlanmış yol> → menüdeki sayfanın okunur hali (sunucu "Etiket : değer" satırlarını bilgi
// listesine, ızgaraları tablolara, sekmeli sayfaları sekmelere çevirir). Sekme değiştirmek yeni istek atmaz.
// Formlardaki düğmeler sayfanın kendi geri gönderimini yapar; okula bir şey gönderen düğmeler iki tıklamayla onaylanır.
// Her sayfanın "PDF olarak aç" düğmesi sunucuda kendi şablonumuzla üretilen PDF'i açar.
const ubsNames = {};             // menü yolu -> adı (dış siteye yönlenen sayfaların başlığı için)
const ubsLive = {};              // yol -> son geri gönderimin döndürdüğü sayfa (başka sayfaya geçince silinir)
const ubsTab = {};               // yol -> seçili sekme
let ubsMsg = null;               // { path, list } geri gönderimden sonra okulun gösterdiği uyarılar

async function viewUbs(r, ctx) {
  if (r.param) return viewUbsPage(r.param, ctx);
  const u = await api('ubs');
  u.menu.forEach(g => g.items.forEach(i => { ubsNames[i.path] = i.name; }));
  // Tek sütunlu liste: "Öğrenci" grubu en üstte ve belirgin; diğer gruplar altta, katlanabilir. Duyuru/mesaj tek satırda.
  const ubsIcon = n => (/transkript|başarı/i.test(n) ? 'file-text' : /program/i.test(n) ? 'calendar' : /kayıt|seçme/i.test(n) ? 'pencil'
    : /müfredat/i.test(n) ? 'book' : /duyuru|ödev/i.test(n) ? 'megaphone' : /bilgi/i.test(n) ? 'user' : /belge|başvuru/i.test(n) ? 'clipboard'
    : /konuk|yurt/i.test(n) ? 'home' : /ortak eğitim/i.test(n) ? 'landmark' : 'file');
  const item = i => `<a class="ubs-item" href="#/ubs/${encodeURIComponent(i.path)}">${icon(ubsIcon(i.name))}<span>${esc(i.name)}</span>${icon('chevron-right', 'go')}</a>`;
  const [main, ...rest] = u.menu;
  const status = `<div class="ubs-status"><span class="pill ${u.unread ? 'info' : 'gray'}">${icon('mail')}${u.unread} okunmamış mesaj</span>
    <span class="pill ${u.announcements.length ? 'info' : 'gray'}">${icon('megaphone')}${u.announcements.length ? `${u.announcements.length} duyuru` : 'Duyuru yok'}</span></div>` +
    (u.announcements.length ? `<div class="card ubs-ann">${u.announcements.map(a => `<p>${esc(a)}</p>`).join('')}</div>` : '');
  return header('UBS', u.name) + status +
    (main ? `<section class="ubs-group main"><h2>${esc(main.group)} <span class="muted small">en çok kullanılanlar</span></h2><div class="ubs-list card">${main.items.map(item).join('')}</div></section>` : '') +
    rest.map(g => `<details class="ubs-group"><summary><h2>${esc(g.group)}</h2><span class="muted small">${g.items.length} işlem</span></summary>
      <div class="ubs-list card">${g.items.map(item).join('')}</div></details>`).join('');
}

async function viewUbsPage(path, ctx) {
  for (const k of Object.keys(ubsLive)) if (k !== path) delete ubsLive[k];
  if (ubsMsg && ubsMsg.path !== path) ubsMsg = null;
  const p = ubsLive[path] ?? await api('ubs-page?path=' + encodeURIComponent(path));
  const back = '<p><a href="#/ubs">← UBS</a></p>';
  const title = p.title || ubsNames[path] || 'UBS';
  if (p.kind === 'external') return back + header(ubsNames[path] || 'UBS') + `<div class="card msg">Bu sayfa okulun başka bir sitesinde (${esc(p.host)}) açılıyor.<br>
    <a class="btn" href="${esc(p.external)}" target="_blank" rel="noopener">Yeni sekmede aç</a></div>`;
  if (p.kind === 'notice') return back + header(ubsNames[path] || title) + `<div class="card notice ${p.open ? 'open' : ''}">
    <b>${p.open ? 'Ders kayıtlanma açık' : 'Ders kayıtlanma kapalı'}</b><p>${esc(p.message)}</p>
    ${p.url ? `<a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">Ders kayıtlanmayı UBS'de aç</a>` : ''}</div>`;
  const tools = `<div class="u-tools"><button class="pdfb" data-ubs-doc="${esc(path)}" data-title="${esc(title)}">PDF olarak aç</button></div>`;
  // Okulun doğrudan PDF verdiği sayfalar (ör. Müfredat): görüntüleyici sayfa açılınca kendiliğinden açılır
  if (p.kind === 'pdf') {
    ctx.after = () => showPdf('/api/file/ubs-doc?path=' + encodeURIComponent(path), ubsNames[path] || p.title);
    return back + header(ubsNames[path] || p.title) + `<div class="card msg">Bu bölüm okulun sisteminden PDF olarak geliyor.<br>
      <button class="pdfb" data-ubs-doc="${esc(path)}" data-title="${esc(ubsNames[path] || p.title)}">PDF'i aç</button></div>`;
  }
  if (p.kind === 'transcript') return back + header('Transkript', p.date ? `Başarı Durum Belgesi · ${p.date}` : 'Başarı Durum Belgesi') + tools + transcriptView(p);
  const msgs = ubsMsg?.list.length ? `<div class="banner">${ubsMsg.list.map(esc).join('<br>')}</div>` : '';
  const tab = p.tabs.length ? (p.tabs.find(t => t.title === ubsTab[path]) ?? p.tabs[0]) : null;
  const bar = tab ? `<div class="tabs">${p.tabs.map(t => `<button data-utab="${esc(t.title)}" class="${t === tab ? 'on' : ''}">${esc(t.title)}</button>`).join('')}</div>` : '';
  return back + header(title) + tools + msgs + `<div class="u-page" data-u-path="${esc(path)}">${p.html ? `<div class="card">${p.html}</div>` : ''}${bar}${
    tab ? `<div class="card">${tab.html}</div>` : ''}</div>`;
}

// Transkript: özet, öğrenci bilgileri, en yeni dönem üstte olacak şekilde dönemler.
function transcriptView(t) {
  const stat = (label, value) => `<div class="card"><span class="muted">${label}</span><b>${esc(value)}</b></div>`;
  const sum = `<div class="t-sum">${stat('GANO', t.gano || '—')}${t.totals ? stat('Alınan kredi / AKTS', `${t.totals.credit} / ${t.totals.ects}`) +
    stat('Tamamlanan kredi / AKTS', `${t.totals.doneCredit} / ${t.totals.doneEcts}`) : ''}</div>`;
  const info = `<div class="card"><dl class="u-kv">${t.info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl></div>`;
  const terms = [...t.terms].reverse().map(s => {
    const graded = s.courses.some(c => c.grade);
    const foot = s.term ? `<div class="t-foot"><span>Dönem: <b>${graded ? `YANO ${esc(s.term.yano)}` : 'notlar henüz girilmedi'}</b> · ${esc(s.term.credit)} kredi / ${esc(s.term.ects)} AKTS</span>
      ${s.total ? `<span>Birikimli: <b>GANO ${esc(s.total.gano)}</b> · tamamlanan ${esc(s.total.doneCredit)} kredi / ${esc(s.total.doneEcts)} AKTS</span>` : ''}</div>` : '';
    return `<h2>${esc(s.name)}</h2><div class="card">${table([['Kod', c => `<b>${esc(c.code)}</b>`], ['Ders', c => esc(c.name)],
      ['Kredi', c => esc(c.credit)], ['AKTS', c => esc(c.ects)], ['Not', c => gradeChip(c.grade)], ['', c => `<span class="muted small">${esc(c.note)}</span>`]], s.courses)}${foot}</div>`;
  }).join('');
  const prep = t.prep.length ? `<h2>Hazırlık</h2><div class="card">${table([['Kod', c => `<b>${esc(c.code)}</b>`], ['Ders', c => esc(c.name)],
    ['Puan', c => esc(c.score)], ['Not', c => gradeChip(c.grade)], ['Durum', c => esc(c.status)]], t.prep)}</div>` : '';
  return sum + info + terms + prep;
}

// Formdaki denetimlerin değerleri (görünen sekme dahil); onay kutusu true/false, seçenek düğmesi seçili değer.
function ubsFields(box) {
  const f = {};
  box.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'checkbox') f[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) f[el.name] = el.value; }
    else f[el.name] = el.value;
  });
  return f;
}

// Düğme (auto=false): ilk tıklama onay sorar, ikincisi gönderir. Otomatik gönderilen seçim/onay kutusu (auto=true): hemen.
async function ubsAction(el, auto = false) {
  const box = el.closest('[data-u-path]');
  if (!box) return;
  if (!auto && !el.dataset.armed) {
    el.dataset.armed = '1';
    el.dataset.label = el.textContent;
    el.textContent = `${el.dataset.uConfirm || 'Okula gönderilecek. Onaylıyor musunuz?'} → ${el.dataset.label}`;
    el.classList.add('armed');
    setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.textContent = el.dataset.label; el.classList.remove('armed'); } }, 10_000);
    return;
  }
  const path = box.dataset.uPath;
  el.disabled = true;
  const how = el.dataset.uSubmit ? { submit: el.dataset.uSubmit } : { target: el.dataset.uTarget || el.dataset.uAuto, argument: el.dataset.uArg || '' };
  const r = await post('/api/ubs/postback', { path, fields: ubsFields(box), ...how });
  const j = await r.json().catch(() => ({}));
  el.disabled = false;
  if (!r.ok) return toast(j.error || 'İşlem yapılamadı');
  if (j.kind === 'file') return showFile(`/api/file/ubs-temp?id=${encodeURIComponent(j.file.id)}`, j.file.name, /pdf/i.test(j.file.type) ? 'pdf' : '');
  ubsLive[path] = j;
  ubsMsg = { path, list: j.messages || [] };
  render();
}

// ---------- UZAKYDB ----------
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`; };
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const MOD = { assign: 'Ödev', resource: 'Dosya', quiz: 'Sınav', forum: 'Forum', url: 'Bağlantı', page: 'Sayfa', folder: 'Klasör', attendance: 'Yoklama' };

// #/uzakydb → dersler, yaklaşan etkinlikler, son erişilenler; #/uzakydb/<ders> → dersin içeriği (Uzak'taki gibi).
// Hiçbir öğe okulun sitesine götürmez: dosyalar görüntüleyicide, etkinlik sayfaları (ödev, forum…) yerinde açılır.
const moodlePath = url => { try { const u = new URL(url); return /^\/mod\/\w+\/view\.php$/.test(u.pathname) && u.searchParams.get('id') ? `${u.pathname}?id=${u.searchParams.get('id')}` : null; } catch { return null; } };
function ydbItem(x, label, extra = '') {
  const p = moodlePath(x.url);
  if (x.module === 'resource' && p) return `<div class="mi"><button class="mi-main" data-file="/api/file/moodle?site=uzakydb&amp;cm=${esc(p.split('=')[1])}" data-title="${esc(x.name)}">${icon('paperclip')}<span>${esc(x.name)}</span></button>${extra}</div>`;
  if (p) return lazy(`mpage:uzakydb:${p}`, `${icon(MOD_ICON[x.module] || 'dot')}<span>${esc(x.name)}</span> ${label}`, 'mi', extra);
  return `<div class="mi"><span>${esc(x.name)}</span>${extra}</div>`;
}

async function viewUzakydb(r, ctx) {
  const y = await api('uzakydb');
  if (!r?.param && ctx) ctx.after = loadYdbExtra;
  if (r?.param) {
    const c = y.courses.find(x => String(x.id) === r.param) ?? { id: r.param, name: 'Ders' };
    return '<p><a href="#/uzakydb">← UZAKYDB</a></p>' + header(c.name, c.category || '') + await courseUzak({ uzak: { id: c.id } }, { site: 'uzakydb' });
  }
  return header('UZAKYDB', 'Yabancı Diller') + `<div id="ydb-extra"></div>` +
    `<h2>Derslerim</h2><div class="list">${y.courses.map(c => `<a class="card course-row" href="#/uzakydb/${c.id}"><span><b>${esc(c.name)}</b>
      <span class="muted small">${esc(c.category)}</span></span><span class="badges">${c.progress !== null ? `<span class="pill gray">%${c.progress} tamamlandı</span>` : ''}</span></a>`).join('')
      || '<div class="card msg">Ders yok.</div>'}</div>` +
    `<h2>Son erişilenler</h2><div class="card mitems">${y.recent.length ? y.recent.map(x => ydbItem(x,
      `<span class="pill gray">${esc(MOD[x.module] || x.module)}</span>`, `<div class="muted small">${esc(x.course)} · ${ago(x.time)}</div>`)).join('')
      : '<span class="muted">Kayıt yok.</span>'}</div>`;
}

// ---------- Webmail ----------
// Okundu/okunmadı durumu okulun sunucusuyla eşzamanlıdır: açılan e-posta orada da okundu olur, işaretler oraya yazılır,
// başka yerden (okulun Webmail'i, telefon) yapılan değişiklikler liste her açıldığında gelir.
// #/webmail → klasör; #/webmail/yeni, #/webmail/<yanit|tumu|ilet>/<uid>/<klasör> → posta yazma.
const mailBody = {};             // "kutu:uid" -> e-posta (bu oturumda bir kez çekilir)
const TRASH = 'Trash';

// ---------- Webmail: yıldızlar, Yıldızlılar görünümü, otomatik silme düğmeleri (fork D) ----------
// state.mbox '__starred' iken Yıldızlılar (bütün klasörlerdeki yıldızlı e-postalar) gösterilir; her e-posta kendi klasörüyle
// işlenir (mboxOf). Otomatik silme açıksa Gelen kutusundaki okunmuş e-postaların yanında "otomatik silme" düğmesi çıkar (basılı = korunur).
const STARRED = '__starred';
const mailMbox = {};             // uid -> e-postanın klasörü (son listeden)
const mboxOf = uid => mailMbox[uid] || (state.mbox === STARRED ? 'INBOX' : state.mbox);
const hoursLeft = t => { const h = Math.max(0, Math.ceil((t - Date.now()) / 3600e3)); return h ? `${h} sa sonra` : 'bir sonraki turda'; };

async function viewWebmail(r) {
  if (r.param) return viewCompose(r);
  const starredView = state.mbox === STARRED;
  const m = await api(starredView ? 'webmail-starred' : 'webmail?mbox=' + encodeURIComponent(state.mbox));
  for (const x of m.messages) mailMbox[x.uid] = x.mbox || state.mbox;
  const tab = (id, label, ic = '') => `<button data-tab="mbox:${esc(id)}" class="${id === state.mbox ? 'on' : ''}">${ic}${esc(label)}</button>`;
  const folders = `<div class="tabs">${m.folders.map((f, i) => tab(f.id, f.name) + (i === 0 ? tab(STARRED, 'Yıldızlılar', icon('star', 'sm')) : '')).join('')}</div>`;
  const total = (m.rowcount.match(/Toplam:\s*(\d+)/) || [])[1];
  const fname = id => m.folders.find(f => f.id === id)?.name || id;
  const auto = m.auto?.enabled ? m.auto.items : null;
  const autoBox = x => {
    const a = auto?.[x.uid];
    if (!a) return auto ? '<span class="ad-none"></span>' : '';   // hizalama: sütun her satırda var
    if (a.starred) return '<span class="ad-tog on fixed" title="Yıldızlı e-postalar otomatik silinmez">otomatik silme</span>';
    // Basılı (mavi) = "otomatik silme": bu e-posta korunur. Soluk = okunduktan 12 saat sonra Çöp'e taşınır.
    return `<button type="button" class="ad-tog${a.exempt ? ' on' : ''}" data-autodel="${esc(x.uid)}" aria-pressed="${a.exempt}"
      title="${a.exempt ? 'Korunuyor: otomatik silinmez. Kaldırmak için bas.' : `Okunduktan 12 saat sonra Çöp'e taşınır${a.dueAt ? ` (${hoursLeft(a.dueAt)})` : ''}. Korumak için bas.`}">otomatik silme</button>`;
  };
  const sub = starredView ? `${m.messages.length} yıldızlı e-posta` : `${m.unread} okunmamış${total ? ` · ${total} ileti` : ''}`;
  return `<div class="row"><div>${header('Webmail', sub)}</div><span class="wm-head-actions"><a class="btn ghost" href="#/hesap" title="Webmail ayarları" data-goto-wmset>${icon('settings')}<span class="full">Ayarlar</span></a>
    <a class="btn primary newmail" href="#/webmail/yeni">${icon('pencil')}Yeni posta</a></span></div>` +
    folders + (auto ? '<p class="muted small ad-info">Otomatik silme açık: okunmuş e-postalar okunduktan 12 saat sonra Çöp kutusuna taşınır. Korumak istediğin e-postanın yanındaki "otomatik silme" yazısına bas, mavi olur (yıldızlılar zaten silinmez).</p>' : '') +
    `<div class="list${auto ? ' auto-on' : ''}">${m.messages.map(x =>
    `<details class="card mail ${x.seen ? '' : 'unread'} ${x.flagged ? 'starred' : ''}" data-mail="${esc(x.uid)}">
      <summary><button class="dot" data-mact="${x.seen ? 'unread' : 'read'}" data-uid="${esc(x.uid)}" title="${x.seen ? 'Okunmadı yap' : 'Okundu yap'}"></button>
        <span class="from">${esc(x.from)}</span><span class="subj">${x.attachment ? icon('paperclip', 'sm') : ''}${esc(x.subject)}${starredView && x.mbox !== 'INBOX' ? ` <span class="pill gray">${esc(fname(x.mbox))}</span>` : ''}</span>
        <span class="muted when">${esc(x.date)}</span>
        <button class="star ${x.flagged ? 'on' : ''}" data-mact="${x.flagged ? 'unflag' : 'flag'}" data-uid="${esc(x.uid)}" title="${x.flagged ? 'Yıldızı kaldır' : 'Yıldızla'}" aria-label="${x.flagged ? 'Yıldızı kaldır' : 'Yıldızla'}">${icon('star')}</button>
        ${autoBox(x)}</summary>
      <div class="mb">${mailBody[mboxOf(x.uid) + ':' + x.uid] ? mailView(mailBody[mboxOf(x.uid) + ':' + x.uid]) : '<p class="muted">Yükleniyor…</p>'}</div></details>`).join('') ||
    `<div class="card msg">${starredView ? 'Yıldızlı e-posta yok. Bir e-postayı yıldızlamak için satırdaki yıldıza dokun.' : 'Bu klasör boş.'}</div>`}</div>`;
}
// ---------- Webmail: yıldızlar … sonu ----------

const mailTools = e => {
  const at = `${encodeURIComponent(e.uid)}/${encodeURIComponent(mboxOf(e.uid))}`;
  const flagged = !!document.querySelector(`details[data-mail="${CSS.escape(String(e.uid))}"].starred`);
  return `<div class="mtools">
    <a class="btn" href="#/webmail/yanit/${at}">${icon('reply')}Yanıtla</a><a class="btn" href="#/webmail/tumu/${at}">${icon('reply-all')}Tümünü yanıtla</a>
    <a class="btn" href="#/webmail/ilet/${at}">${icon('forward')}İlet</a><button class="btn ghost" data-mact="unread" data-uid="${esc(e.uid)}">${icon('mail')}Okunmadı yap</button>
    <button class="btn ghost" data-mact="${flagged ? 'unflag' : 'flag'}" data-uid="${esc(e.uid)}">${icon('star')}${flagged ? 'Yıldızı kaldır' : 'Yıldızla'}</button>
    ${mboxOf(e.uid) === TRASH ? `<button class="btn" data-mact="restore" data-uid="${esc(e.uid)}">Gelen kutusuna taşı</button>
      <button class="btn danger" data-mact="purge" data-uid="${esc(e.uid)}">${icon('trash')}Kalıcı sil</button>`
      : `<button class="btn danger" data-mact="delete" data-uid="${esc(e.uid)}">${icon('trash')}Sil</button>`}</div>`;
};

// Satırdaki ve açık e-postadaki işlemler. Kalıcı silme iki tıklama ister.
const MAIL_ACTIONS = {
  read: m => ['mark', { flag: 'read' }, 'Okundu olarak işaretlendi'],
  unread: m => ['mark', { flag: 'unread' }, 'Okunmadı olarak işaretlendi'],
  delete: m => ['delete', {}, 'Çöp kutusuna taşındı'],
  purge: m => ['delete', {}, 'Kalıcı olarak silindi'],
  restore: m => ['move', { target: 'INBOX' }, 'Gelen kutusuna taşındı'],
  flag: m => ['mark', { flag: 'flagged' }, 'Yıldızlandı'],
  unflag: m => ['mark', { flag: 'unflagged' }, 'Yıldız kaldırıldı'],
};
async function mailAction(btn) {
  const { mact, uid } = btn.dataset;
  if (mact === 'purge' && !btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'Emin misiniz? Kalıcı olarak silinecek'; return; }
  const [endpoint, extra, msg] = MAIL_ACTIONS[mact]();
  btn.disabled = true;
  const r = await post('/api/webmail/' + endpoint, { uids: [uid], mbox: mboxOf(uid), ...extra });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; return toast(j.error || 'İşlem yapılamadı'); }
  toast(msg);
  if (mact === 'flag' || mact === 'unflag') return render(true);   // yıldız: e-posta açık kalır
  if (mact !== 'read') {                                   // kapanan e-posta yeniden açılınca güncel hali gelsin
    delete mailBody[mboxOf(uid) + ':' + uid];
    const d = btn.closest('details');
    if (d) d.open = false;
  }
  render(true);
}

// ---------- Posta yazma ----------
let draft = null;                // { key, data, values } — yazılanlar yeniden çizimde kaybolmasın
const COMPOSE = { yeni: ['new', 'Yeni posta'], yanit: ['reply', 'Yanıtla'], tumu: ['replyall', 'Tümünü yanıtla'], ilet: ['forward', 'İlet'] };

async function viewCompose(r) {
  const [kind, uid, ...rest] = r.param.split('/');
  const [mode, title] = COMPOSE[kind] ?? COMPOSE.yeni;
  const back = '<p><a href="#/webmail">← Webmail</a></p>';
  if (draft?.key !== r.param) {
    const res = await post('/api/webmail/compose', { mode, uid, mbox: rest.join('/') || 'INBOX' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(j.error || 'Yazma sayfası açılamadı'), res.status === 401 ? { login: j.site, siteName: j.siteName } : {});
    draft = { key: r.param, data: j, values: { to: j.to, cc: j.cc, bcc: j.bcc, subject: j.subject, text: '' }, files: j.attachments };
  }
  const d = draft.data, v = draft.values;
  const from = d.from.length > 1 ? `<label>Gönderen<select name="from">${d.from.map(f => `<option value="${esc(f.id)}" ${f.selected ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>`
    : `<input type="hidden" name="from" value="${esc(d.from[0]?.id ?? '')}">`;
  const quote = d.quote ? `<label class="check"><input type="checkbox" name="includeQuote" checked> ${mode === 'forward' ? 'İletilen e-postayı ekle' : 'Önceki e-postayı alıntıla'}</label>
    <details class="quote"><summary class="muted">Alıntıyı göster</summary><div class="rich">${d.quoteIsHtml ? d.quote : `<pre>${esc(d.quote)}</pre>`}</div></details>` : '';
  return back + header(title) + `<form id="compose" class="card acct compose">${from}
    <label>Kime<input name="to" value="${esc(v.to)}" placeholder="isim@etu.edu.tr, …" autocomplete="off"></label>
    <details class="ccbcc" ${v.cc || v.bcc ? 'open' : ''}><summary class="muted">Bilgi / Gizli alıcı</summary>
      <label>Bilgi (Cc)<input name="cc" value="${esc(v.cc)}" autocomplete="off"></label><label>Gizli (Bcc)<input name="bcc" value="${esc(v.bcc)}" autocomplete="off"></label></details>
    <label>Konu<input name="subject" value="${esc(v.subject)}"></label>
    <label>Mesaj<textarea name="text" rows="10">${esc(v.text)}</textarea></label>
    <div class="atts" id="catts">${draft.files.map(attChip).join('')}</div>
    <label class="btn filebtn">${icon('paperclip')}Dosya ekle<input type="file" name="files" multiple hidden></label>
    ${quote}
    <div class="row"><button type="submit">Gönder</button><a class="muted" href="#/webmail">Vazgeç</a></div></form>`;
}
const attChip = f => `<span class="att" data-ratt="${esc(f.id)}">${icon('paperclip')}${esc(f.name)} <button type="button" class="x" title="Kaldır" aria-label="Kaldır">×</button></span>`;

async function uploadFiles(input) {
  const box = document.getElementById('catts');
  for (const file of input.files) {
    const chip = Object.assign(document.createElement('span'), { className: 'att muted', textContent: `Yükleniyor… ${file.name}` });
    box.append(chip);
    const r = await fetch(`/api/webmail/upload?id=${encodeURIComponent(draft.data.id)}&name=${encodeURIComponent(file.name)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { chip.remove(); toast(`${file.name}: ${j.error || 'yüklenemedi'}`); continue; }
    draft.files.push(j);
    chip.outerHTML = attChip(j);
  }
  input.value = '';
}

async function removeDraftFile(chip) {
  const r = await post('/api/webmail/remove-attachment', { id: draft.data.id, file: chip.dataset.ratt });
  if (!r.ok) return toast((await r.json().catch(() => ({}))).error || 'Ek kaldırılamadı');
  draft.files = draft.files.filter(f => f.id !== chip.dataset.ratt);
  chip.remove();
}

async function sendMail(f) {
  const btn = f.querySelector('button[type=submit]');
  const d = new FormData(f);
  if (!String(d.get('to') || '').trim()) return toast('Alıcı (Kime) gerekli');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor…';
  const r = await post('/api/webmail/send', { id: draft.data.id, from: d.get('from'), to: d.get('to'), cc: d.get('cc') || '', bcc: d.get('bcc') || '',
    subject: d.get('subject') || '', text: d.get('text') || '', includeQuote: d.get('includeQuote') === 'on' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; btn.textContent = 'Gönder'; return toast(j.error || 'Posta gönderilemedi'); }
  draft = null;
  toast('Posta gönderildi');
  location.hash = '#/webmail';
}

// Ekler: PDF'ler uygulamanın içinde açılır, diğerleri indirilir.
const attachUrl = (uid, a) => `/api/file/webmail?uid=${encodeURIComponent(uid)}&mbox=${encodeURIComponent(mboxOf(uid))}&part=${encodeURIComponent(a.part)}`;
const isPdf = a => a.mime === 'application/pdf' || /\.pdf$/i.test(a.name);
const mailView = e => `<p class="muted" style="margin:10px 0">${esc(e.from)}<br>Alıcı: ${esc(e.to)}${e.cc ? '<br>Bilgi: ' + esc(e.cc) : ''}<br>${esc(e.date)}</p>
  ${e.attachments.length ? `<div class="atts">${e.attachments.map(a => isPdf(a)
    ? `<button class="att" data-pdf="${esc(attachUrl(e.uid, a))}" data-title="${esc(a.name)}">${icon('file-text')}${esc(a.name)} <span class="muted">${esc(a.size)}</span></button>`
    : `<a class="att" href="${esc(attachUrl(e.uid, a))}&download=1" download="${esc(a.name)}">${icon('paperclip')}${esc(a.name)} <span class="muted">${esc(a.size)}</span></a>`).join('')}</div>` : ''}
  ${mailTools(e)}<div class="mailbody">${e.html}</div>`;

// Açılan e-posta okulun sunucusunda da okundu olur (önizleme bunu yapar; önbellekten açılsa bile ayrıca işaretlenir).
async function openMail(el) {
  const uid = el.dataset.mail;
  const key = mboxOf(uid) + ':' + uid;
  const wasUnread = el.classList.contains('unread');
  if (wasUnread) {
    el.classList.remove('unread');
    post('/api/webmail/mark', { uids: [uid], flag: 'read', mbox: mboxOf(uid) }).then(r => r.ok && render(true));
  }
  if (mailBody[key]) return;
  try {
    mailBody[key] = await api(`webmail-message?uid=${uid}&mbox=${encodeURIComponent(mboxOf(uid))}`);
    el.querySelector('.mb').innerHTML = mailView(mailBody[key]);
  } catch (e) {
    el.querySelector('.mb').innerHTML = `<p class="msg err">${esc(e.message)}</p>`;
  }
}

// ---------- Ana Sayfa ----------
// Sayfa hemen çizilir; kartlar birbirini beklemeden kendi uçlarından (sunucuda önbellekli) dolar.
// Oturumu kapalı sitenin kartında giriş düğmesi çıkar.
let flash = null;                // Hesap'tan gelince bir kez gösterilecek uyarı (güvenli HTML)
const homeData = {};             // kart -> son veri (Ana Sayfa'ya dönünce kartlar boş görünmesin)
const minutes = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const whenTR = t => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Kart iki uçtan beslenir (ders programı + sınav takvimi); bugün sınav varsa derslerle birlikte, kırmızı etiketle görünür.
function homeToday(res) {
  const s = Array.isArray(res) ? res.find(x => x.site === 'schedule')?.data : res;
  const e = Array.isArray(res) ? res.find(x => x.site === 'exams')?.data : null;
  if (!s) {
    const lg = Array.isArray(res) && res.find(x => x.site === 'schedule' && x.login);
    return `<p class="muted">${lg ? `${esc(lg.siteName)} oturumu kapalı.` : 'Ders programı alınamadı.'}</p>${lg ? loginButton('Giriş yap', lg.login) : ''}`;
  }
  const per = blocks(s);
  const t = todayIdx();
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  // Satırlar nötr; yalnızca şu anki ders öne çıkar (mavi kenar + "Şimdi"), biten dersler soluk, sıradaki ders etiketli.
  const row = (b, cls = '', tag = '') => `<div class="hl ${cls}"><span class="hl-t">${b.start}<span class="muted">–${b.end}</span></span>
    <span class="hl-c"><b>${esc(b.code)}</b><span class="muted">${esc(b.room)}${b.inPerson ? '' : ' · çevrimiçi'}</span></span>${tag}</div>`;
  const exams = (e?.active ? e.exams : []).filter(x => x.dateText === todayTR() && minutes(x.end || x.start) > now);
  const examRow = x => `<a class="hl exam-today" href="#/donem/program"><span class="hl-t">${esc(x.start)}<span class="muted">–${esc(x.end)}</span></span>
    <span class="hl-c"><b>${esc(x.code)}</b><span>${icon('pin')}${esc(x.room || 'derslik belli değil')}</span></span><span class="tag exam">Sınav</span></a>`;
  const list = per[t] || [];
  if (list.some(b => minutes(b.end) > now) || exams.length) {
    const cur = list.find(b => minutes(b.start) <= now && minutes(b.end) > now);
    const next = list.find(b => minutes(b.start) > now);
    return [...list.map(b => ({ m: minutes(b.start), html: row(b, minutes(b.end) <= now ? 'past' : b === cur ? 'now' : b === next ? 'next' : '',
      b === cur ? '<span class="tag now">Şimdi</span>' : b === next ? '<span class="tag">Sıradaki</span>' : '') })),
      ...exams.map(x => ({ m: minutes(x.start), html: examRow(x) }))].sort((a, b) => a.m - b.m).map(x => x.html).join('');
  }
  for (let i = 1; i < 7; i++) {               // bugün ders yok ya da bitti: sonraki ders günü
    const d = (t + i) % 7;
    if (per[d]?.length) return `<p class="muted">${list.length ? 'Bugünkü dersler bitti.' : 'Bugün ders yok.'} ${i === 1 ? 'Yarın' : esc(s.days[d])}:</p>` + per[d].map(b => row(b)).join('');
  }
  return '<p class="muted">Programda ders yok.</p>';
}

function homeExams(e) {
  if (!e.active) return `<p class="muted">${esc(e.message)}</p>`;
  const now = Date.now();
  const up = e.exams.filter(x => examAt(x, x.end) > now).slice(0, 3);
  if (!up.length) return `<p class="muted">${esc(e.active.label)} sınavlarınız bitti.</p>`;
  return `<p class="muted">${esc(e.active.label)} dönemi</p>` + up.map(x => `<div class="exam mini">${examDate(x)}
    <div style="flex:1"><b>${esc(x.code)}</b> · ${esc(x.start)}<br><span class="muted">${esc(x.room || '—')}</span></div><span class="pill ${examUrgency(x, now)}">${examRel(x, now)}</span></div>`).join('');
}

function homeMail(m) {
  const unread = m.messages.filter(x => !x.seen).slice(0, 4);
  return `<p><span class="pill ${m.unread ? '' : 'ok'}">${m.unread} okunmamış</span></p>` + (unread.length
    ? unread.map(x => `<a class="hm" href="#/webmail"><b>${esc(x.from)}</b><span>${esc(x.subject)}</span></a>`).join('')
    : '<p class="muted">Okunmamış e-posta yok.</p>');
}

// Piazza: sınıflar ve yeni gönderi sayıları; ders sayfasının Piazza sekmesine gider.
const courseKey = s => (String(s ?? '').toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
  .replace(/Ö/g, 'O').replace(/Ç/g, 'C').match(/\b([A-Z]{2,4})\s*(\d{3})\b/) || []).slice(1).join('') || s;
function homePiazza(list) {
  const act = list.filter(n => n.active);
  return act.length ? act.map(n => `<a class="hm" href="#/donem/derslerim/${encodeURIComponent(courseKey(n.code))}/piazza"><b>${esc(n.code)} · ${esc(n.name)}</b>
    <span>${n.fresh ? `<span class="pill info">${n.fresh} yeni gönderi</span>` : 'Yeni gönderi yok'}</span></a>`).join('') : '<p class="muted">Etkin Piazza sınıfı yok.</p>';
}

const HOME_CARDS = [
  { id: 'today', title: 'Bugünkü dersler', link: '#/donem/program', api: ['schedule', 'exams'], body: homeToday },
  { id: 'exams', title: 'Sınav Takvimi', link: '#/sinav', api: 'exams', body: homeExams },
  { id: 'mail', title: 'Posta', link: '#/webmail', api: 'webmail?mbox=INBOX', body: homeMail },
  { id: 'piazza', title: 'Piazza', link: '#/donem/derslerim', api: 'piazza', body: homePiazza },
];
const SHORTCUTS = [['#/profil/notlar', 'Not Görüntüleme'], ['#/donem/derslerim', 'Derslerim'],
  ['#/ubs/' + encodeURIComponent('/Ogrenci/Ogr0204/Default.aspx?lang=tr-TR'), 'Transkript'], ['#/cap', 'ÇAP/YAP - Başvurular'],
  ['#/ekstra/acilan', 'Açılan Dersler'], ['#/ekstra/takvim', 'Akademik Takvim']];

// Kısayollar = en son kullanılan 6 sayfa (bu cihazda saklanır). Her çizimde adres ve sayfa başlığı kaydedilir;
// az sayfa kullanılmışsa boşluk yukarıdaki varsayılanlarla dolar.
const RECENT_KEY = 'sonYollar';
function recentGet() {
  try { const l = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(l) ? l.filter(x => x && x.h && x.l) : []; } catch { return []; }
}
function recentAdd(hash, label) {
  if (!hash || !label || /^#?\/?(anasayfa)?$/.test(hash)) return;
  const list = [{ h: hash, l: label.slice(0, 48) }, ...recentGet().filter(x => x.h !== hash)].slice(0, 12);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}
function shortcuts() {
  const out = recentGet().slice(0, 6).map(x => [x.h, x.l]);
  for (const s of SHORTCUTS) if (out.length < 6 && !out.some(x => x[0] === s[0] || x[1] === s[1])) out.push(s);
  return out;
}

// Ana Sayfanın üstü: Ortam ana sayfasındaki anket/duyurular, UZAKYDB'deki ek içerik ve Akademik Takvimde yaklaşan
// son tarihler. Hepsi arka planda gelir; bir şey yoksa alan boş kalır.
async function loadHomeNotices() {
  const get = name => fetch('/api/' + name).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [o, y, d] = await Promise.all([get('ortam-duyuru'), get('uzakydb-ek'), get('hatirlatmalar')]);
  const box = document.getElementById('home-notices');
  if (!box) return;
  const parts = [];
  for (const x of o?.items ?? []) parts.push(`<div class="banner hn"><span>${icon(x.kind === 'anket' ? 'clipboard' : 'megaphone')}<span><b>Ortam'da seni bekleyen ${x.kind === 'anket' ? 'anket' : 'duyuru'}:</b>
    ${esc(x.title)}</span></span><a class="btn" href="${esc(o.url)}" target="_blank" rel="noopener">${icon('external')}Ortam'da aç</a></div>`);
  if (y?.items?.length) parts.push(`<div class="banner hn"><span>${icon('globe')}<span><b>UZAKYDB'de ek içerik:</b> ${y.items.map(b => esc(b.title)).join(', ')}</span></span>
    <a class="btn" href="#/uzakydb">Göster</a></div>`);
  if (d?.items?.length) parts.push(`<section class="card hn-dates"><div class="hc-h"><a href="#/ekstra/takvim">Yaklaşan son tarihler</a><a class="muted" href="#/ekstra/takvim">Takvim →</a></div>
    <ul>${d.items.map(i => `<li class="${i.live ? 'live' : ''}">${icon('calendar')}<span><b>${esc(i.when)}</b> · ${esc(i.what)}${
      i.last ? ' <span class="pill due-now">bugün son gün</span>' : i.live ? ' <span class="pill due-soon">sürüyor</span>' : ''}</span></li>`).join('')}</ul></section>`);
  box.innerHTML = parts.join('');
}
async function loadYdbExtra() {
  const box = document.getElementById('ydb-extra');
  if (!box) return;
  const y = await fetch('/api/uzakydb-ek').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!y?.items?.length || !document.getElementById('ydb-extra')) return;
  box.innerHTML = `<h2>Sitede ek içerik</h2>${y.items.map(b => `<div class="card ydb-x"><b>${esc(b.title)}</b><p>${esc(b.text)}</p>${
    b.links.length ? `<p>${b.links.map(l => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${icon('external')}${esc(l.text)}</a>`).join(' ')}</p>` : ''}</div>`).join('')}`;
}

async function viewHome(r, ctx) {
  const now = new Date();
  const h = now.getHours();
  const greet = h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const note = flash ? `<div class="banner">${flash} <a href="#/hesap">Hesap</a></div>` : '';
  flash = null;
  ctx.after = () => { HOME_CARDS.forEach(c => loadCard(c)); loadHomeNotices(); };
  return header(greet, now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })) + note + '<div id="home-notices"></div>' +
    `<div class="home">${HOME_CARDS.map(c => `<section class="card hc" data-card="${c.id}">
      <div class="hc-h"><a href="${c.link}">${esc(c.title)}</a><a class="muted" href="${c.link}">Tümü →</a></div>
      <div class="hc-b">${homeData[c.id] ? c.body(homeData[c.id]) : '<p class="muted">Yükleniyor…</p>'}</div></section>`).join('')}</div>` +
    `<h2>Son kullanılanlar</h2><div class="chips">${shortcuts().map(([href, label]) => `<a class="chip" href="${esc(href)}">${esc(label)}</a>`).join('')}</div>` +
    `<p class="muted small home-more">Diğer bölümler: <a href="#/ekstra/acilan">Ekstra</a> · <a href="#/ekstra/mevzuat">Mevzuat</a> · <a href="#/cap/capyap">ÇAP/YAP - Başvurular</a> · <a href="#/hakkinda/hakkimizda">Hakkında ve SSS</a></p>`;
}

// Kart birden çok uçtan besleniyorsa (api dizi) gövde her ucun sonucunu alır: { site, data | login, siteName }.
async function loadCard(c, again = false) {
  const box = () => $view.querySelector(`[data-card="${c.id}"] .hc-b`);
  const multi = Array.isArray(c.api);
  try {
    const res = await Promise.all([].concat(c.api).map(async name => {
      const r = await fetch('/api/' + name);
      return { name, r, j: await r.json().catch(() => ({})) };
    }));
    if (!box()) return;
    if (!multi && !res[0].r.ok) {
      const { r, j } = res[0];
      box().innerHTML = r.status === 401 ? `<p class="muted">${esc(j.siteName)} oturumu kapalı.</p>${loginButton('Giriş yap', j.site)}`
        : `<p class="muted">${esc(j.error || 'Veri alınamadı')}</p>`;
      return;
    }
    const data = multi ? res.map(({ name, r, j }) => (r.ok ? { site: name, data: j } : { site: name, login: j.site, siteName: j.siteName, error: j.error })) : res[0].j;
    homeData[c.id] = data;
    const stale = res.map(x => x.r.headers.get('X-Login-Required')).find(Boolean);
    box().innerHTML = c.body(data) + (stale ? `<p class="muted small">Oturum kapalı, son kaydedilen veri. ${loginButton('Giriş yap', stale)}</p>` : '');
    if (res.some(x => x.r.headers.get('X-Refreshing')) && !again) setTimeout(() => loadCard(c, true), 3000);
  } catch {
    if (box() && !homeData[c.id]) box().innerHTML = '<p class="muted">Uygulama sunucusuna ulaşılamadı.</p>';
  }
}

// ---------- Hesap (tek giriş) ----------
const post = (url, body = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const SITE_NAMES = { ortam: 'Ortam', ubs: 'UBS', uzakydb: 'UZAKYDB', webmail: 'Webmail', uzak: 'Uzak', piazza: 'Piazza' };
const SITE_ORDER = ['ortam', 'ubs', 'uzak', 'uzakydb', 'webmail', 'piazza'];
let lastLogin = null;            // son giriş denemesinin site sonuçları (ekranda göstermek için)

// ---------- Bildirimler ----------
// Sunucu Piazza'yı 30, Uzak'ı 60 dakikada bir kontrol eder; yeni içerik Windows bildirimi ve (açıksa) e-postayla gelir.
// Burada: menüdeki ve derslerin üzerindeki işaretler için okunmamış sayıları, Hesap'taki ayarlar.
let notif = { items: [], unread: 0, byCourse: {}, bySource: {}, byCourseSrc: {}, settings: { toast: true, mail: true, takvim: true }, last: {} };
// Kaynağa göre renkli bildirim noktaları (Uzak: kırmızımsı turuncu, Piazza: mavi); ikisi de varsa iki nokta
const SRC_LABEL = { uzak: 'Uzak', piazza: 'Piazza' };
// plain: menüde sayısız renkli nokta; derslerin üzerinde sayılı rozet
const srcDots = (counts, plain = false) => {
  const html = ['uzak', 'piazza'].filter(s => counts?.[s]).map(s => plain
    ? `<span class="ndot src-${s}" title="${counts[s]} yeni ${SRC_LABEL[s]} bildirimi"></span>`
    : `<span class="nbadge src-${s}" title="${counts[s]} yeni ${SRC_LABEL[s]} bildirimi">${counts[s]}</span>`).join('');
  return html ? `<span class="ndots${plain ? ' plain' : ''}">${html}</span>` : '';
};
async function loadNotif() {
  try {
    const r = await fetch('/api/notifications');
    if (!r.ok) return;
    const j = await r.json();
    const changed = j.unread !== notif.unread || JSON.stringify(j.byCourse) !== JSON.stringify(notif.byCourse);
    notif = j;
    if (changed) { renderNav(route()); if (route().key === 'donem/derslerim' && !route().param) render(true); }
  } catch {}
}
loadNotif();
setInterval(loadNotif, 60_000);

function notifSection() {
  const ago2 = t => (t ? whenTR(t) : 'henüz yok');
  const recent = notif.items.slice(0, 8);
  return `<h2>Bildirimler</h2><div class="card notif-set">
    <p class="muted" style="margin-top:0">Piazza'ya (30 dakikada bir) ve Uzak'a (saatte bir) eklenen yeni gönderi ve içerikler için haber verilir.
      Kontroller uygulama (sunucu) açıkken yapılır. Yeni içerik menüde ve Derslerim'de dersin üzerinde renkli noktayla işaretlenir:
      <span class="sdot src-uzak"></span>Uzak, <span class="sdot src-piazza"></span>Piazza.</p>
    <label class="check"><input type="checkbox" data-notif="takvim"${notif.settings.takvim !== false ? ' checked' : ''}> <span>Akademik takvim hatırlatmaları
      <span class="muted">(ders kaydı, ekle-sil, dersten vazgeçme, ÇAP/YAP başvurusu, sınavlar: 3 gün kala, başladığı gün ve son gün)</span></span></label>
    <label class="check"><input type="checkbox" data-notif="toast"${notif.settings.toast ? ' checked' : ''}> Windows bildirimi</label>
    <label class="check"><input type="checkbox" data-notif="mail"${notif.settings.mail ? ' checked' : ''}> E-posta <span class="muted">(kendi adresinize, her kontrolde tek özet)</span></label>
    <div class="row" style="justify-content:flex-start;gap:8px;margin-top:10px"><button type="button" class="btn" data-notif-check>Şimdi kontrol et</button>
      <button type="button" class="btn ghost" data-notif-test>Deneme bildirimi</button></div>
    <p class="muted small">Son kontrol — Piazza: ${ago2(notif.last.piazza)} · Uzak: ${ago2(notif.last.uzak)}</p>
    ${recent.length ? `<ul class="notif-list">${recent.map(n => `<li class="${n.read ? 'read' : ''}"><span class="sdot src-${esc(n.source)}"></span><a href="${esc(n.link)}"><b>${esc(n.title)}</b> ${esc(n.text)}</a> <span class="muted small">${whenTR(n.t)}</span></li>`).join('')}</ul>`
      : '<p class="muted small">Henüz bildirim yok.</p>'}</div>`;
}

$view.addEventListener('change', e => {
  const t = e.target.closest('[data-notif]');
  if (t) post('/api/notifications/settings', { [t.dataset.notif]: t.checked }).then(r => r.json()).then(s => { notif.settings = s; }).catch(() => toast('Ayar kaydedilemedi'));
});
$view.addEventListener('click', async e => {
  if (e.target.closest('[data-notif-test]')) { await post('/api/notifications/test'); return toast('Deneme bildirimi gönderildi'); }
  const chk = e.target.closest('[data-notif-check]');
  if (chk) {
    chk.disabled = true;
    chk.textContent = 'Kontrol ediliyor…';
    const r = await post('/api/notifications/check').catch(() => null);
    if (r?.ok) notif = await r.json();
    toast(r?.ok ? (notif.unread ? `${notif.unread} okunmamış bildirim` : 'Yeni içerik yok') : 'Kontrol yapılamadı');
    render();
  }
});

// ---------- Webmail ayarları (fork D) ----------
// Hesap'ta "Webmail" bölümü: okunan e-postaları 12 saat sonra Çöp'e taşıma (varsayılan kapalı), son/sonraki tur, deneme.
// Durum çizimden sonra sunucudan doldurulur. Webmail başlığındaki "Ayarlar" bu bölüme getirir.
let wmScroll = false;
function webmailSettingsSection() {
  setTimeout(fillWmSettings, 0);
  return '<h2 id="wm-settings-h">Webmail</h2><div class="card wm-set" id="wm-settings"><p class="muted">Yükleniyor…</p></div>';
}
async function fillWmSettings() {
  const box = document.getElementById('wm-settings');
  if (!box) return;
  const r = await post('/api/webmail/auto-status').catch(() => null);
  const s = r?.ok ? await r.json() : null;
  if (!s) { box.innerHTML = '<p class="muted">Webmail ayarları alınamadı (Webmail oturumu kapalı olabilir).</p>'; return; }
  const when = t => (t ? whenTR(t) : '—');
  box.innerHTML = `<label class="check"><input type="checkbox" data-wm-auto${s.enabled ? ' checked' : ''}> Okunan e-postaları ${s.afterHours} saat sonra sil</label>
    <p class="muted small" style="margin:4px 0 8px">Gelen kutusundaki okunmuş e-postalar okunduktan ${s.afterHours} saat sonra <b>Çöp kutusuna taşınır</b> (kalıcı silinmez, Çöp'ten geri alınabilir).
      Yıldızlı e-postalar hiç taşınmaz; açıkken listede her okunmuş e-postanın yanında çıkan "otomatik silme" yazısına basıp maviye çevirerek tek tek de koruyabilirsiniz.
      Kontrol saatte bir, uygulama açıkken yapılır.</p>
    ${s.enabled ? `<p class="small">Son tur: ${when(s.lastRun)}${s.lastRun ? ` · ${s.lastMoved} e-posta taşındı` : ''} · Sonraki tur: ${when(s.nextRun)} · Toplam taşınan: ${s.totalMoved}</p>` : ''}
    ${s.lastError ? `<p class="small bad">Son hata: ${esc(s.lastError)}</p>` : ''}
    <div class="row" style="justify-content:flex-start;gap:8px"><button type="button" class="btn ghost" data-wm-dry>Şimdi taşınacakları göster</button></div>
    <div class="wm-dry"></div>`;
  if (wmScroll) { wmScroll = false; document.getElementById('wm-settings-h')?.scrollIntoView({ block: 'start' }); }
}
$view.addEventListener('change', async e => {
  const t = e.target;
  if (t.matches('[data-wm-auto]')) {
    const r = await post('/api/webmail/auto-settings', { enabled: t.checked });
    toast(r.ok ? (t.checked ? 'Otomatik silme açıldı' : 'Otomatik silme kapatıldı') : 'Ayar kaydedilemedi');
    fillWmSettings();
  }
});
$view.addEventListener('click', async e => {
  // Satır başlığındaki "otomatik silme" düğmesi: basılı (mavi) = korunur, soluk = 12 saat sonra Çöp'e. E-postayı açıp kapatmaz.
  if (e.target.closest('.ad-tog.fixed')) { e.preventDefault(); return; }
  const tog = e.target.closest('button.ad-tog[data-autodel]');
  if (tog) {
    e.preventDefault();
    const on = !tog.classList.contains('on');
    tog.classList.toggle('on', on);
    tog.setAttribute('aria-pressed', String(on));
    const r = await post('/api/webmail/auto-exempt', { uid: tog.dataset.autodel, exempt: on });
    if (!r.ok) { tog.classList.toggle('on', !on); tog.setAttribute('aria-pressed', String(!on)); return toast('Kaydedilemedi'); }
    toast(on ? 'Bu e-posta otomatik silinmeyecek' : 'Bu e-posta otomatik silinecek');
    return render(true);
  }
  if (e.target.closest('[data-goto-wmset]')) wmScroll = true;
  const dry = e.target.closest('[data-wm-dry]');
  if (dry) {
    dry.disabled = true;
    const r = await post('/api/webmail/auto-dryrun').catch(() => null);
    const j = r?.ok ? await r.json() : null;
    dry.disabled = false;
    const out = document.querySelector('.wm-dry');
    if (!out) return;
    out.innerHTML = !j ? '<p class="muted small">Denetlenemedi.</p>'
      : `<p class="small">${j.checked} e-posta denetlendi${j.enabled ? '' : ' (otomatik silme kapalı; yalnızca önizleme)'} — şu an taşınacak: <b>${j.wouldMove.length}</b></p>${
        j.wouldMove.length ? `<ul class="small">${j.wouldMove.map(m => `<li>${esc(m.from)} · ${esc(m.subject)}</li>`).join('')}</ul>` : ''}`;
  }
}, true);
// ---------- Webmail ayarları sonu ----------

async function viewHesap() {
  const [a, st] = await Promise.all([api('account'), api('status')]);
  const resultText = site => {
    const x = lastLogin?.results?.[site];
    if (!x) return '';
    return x.ok ? '<span class="pill ok">giriş yapıldı</span>' : x.rejected ? '<span class="pill bad">şifre kabul edilmedi</span>' : `<span class="pill warn">${esc(x.error)}</span>`;
  };
  const rows = Object.keys(a.sessions).map(site => ({ site, alive: a.sessions[site], direct: a.direct.includes(site), blocked: a.blocked.includes(site) }));
  return header('Hesap', 'Tek giriş: e-posta ve şifreyi bir kez girin, uygulama sitelere kendisi girsin') +
    `<div class="card"><form id="acct" class="acct">
      <label>E-posta<input name="email" type="email" autocomplete="username" placeholder="isim@etu.edu.tr" value="${esc(a.email || '')}" required></label>
      <label>Şifre<input name="password" type="password" autocomplete="current-password" ${a.email ? 'placeholder="Boş bırakırsanız kayıtlı şifre kullanılır"' : 'required'}></label>
      <details class="site-pw"${a.custom?.length ? ' open' : ''}><summary>Siteye özel şifreler <span class="muted">(şifreleriniz her sitede ortak değilse)</span></summary>
        ${SITE_ORDER.map(s => `<label><span>${esc(SITE_NAMES[s])}</span><input name="site-${s}" type="password" autocomplete="off"
          placeholder="${a.custom?.includes(s) ? 'Özel şifre kayıtlı — değiştirmek için yazın' : 'Ana şifre kullanılır'}"></label>`).join('')}
      </details>
      <label class="check"><input name="remember" type="checkbox" checked><span>Beni hatırla <span class="muted">(Windows'un şifreli kasasında saklanır)</span></span></label>
      <div class="row"><button type="submit">Giriş yap</button>${a.email ? '<button type="button" class="ghost" data-forget>Kayıtlı bilgileri sil</button>' : ''}</div>
    </form></div>` +
    `<h2>Oturumlar</h2><div class="card">${table([
      ['Site', r => `<b>${esc(SITE_NAMES[r.site] || r.site)}</b>`],
      ['Durum', r => r.alive ? '<span class="pill ok">açık</span>' : '<span class="pill warn">kapalı</span>'],
      ['Giriş', r => r.direct ? (r.blocked ? '<span class="pill bad">otomatik giriş durdu</span>' : 'otomatik')
        : '<span class="muted">tek tıkla: pencere açılır, bilgileriniz doldurulur (doğrulama sorusu çıkarsa siz yanıtlarsınız)</span>'],
      ['', r => resultText(r.site)]], rows)}</div>` +
    `<p class="muted">${a.email ? (a.remembered ? 'Bilgileriniz bu bilgisayarda şifreli olarak saklanıyor.' : 'Bilgileriniz yalnızca uygulama açıkken bellekte tutuluyor.') : 'Henüz kayıtlı bilgi yok.'}</p>` +
    securitySection(st) + notifSection() + webmailSettingsSection() +
    `<h2>Görünüm</h2><div class="card">${themePicker()}<p class="muted small" style="margin:10px 0 0">Otomatik: cihazın açık/koyu ayarını izler. Seçim bu cihazda saklanır.</p></div>`;
}

async function submitAccount(f) {
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Giriş yapılıyor…';
  const d = new FormData(f);
  const sites = Object.fromEntries(SITE_ORDER.map(s => [s, d.get('site-' + s) || '']).filter(([, v]) => v));
  const r = await post('/api/account/login', { email: d.get('email'), password: d.get('password') || '', sites, remember: d.get('remember') === 'on' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    btn.disabled = false;
    btn.textContent = 'Giriş yap';
    return btn.insertAdjacentHTML('afterend', `<span class="muted">${esc(j.error || 'Giriş başarısız')}</span>`);
  }
  lastLogin = j;
  // En az bir site kabul ettiyse Ana Sayfa'ya geç; kabul etmeyen site varsa orada bir kez uyar.
  const results = Object.entries(j.results || {});
  if (!results.some(([, x]) => x.ok)) return render();
  const failed = results.filter(([, x]) => !x.ok);
  flash = failed.length ? failed.map(([s, x]) => `${esc(SITE_NAMES[s] || s)}: ${x.rejected ? 'şifre kabul edilmedi' : esc(x.error)}`).join(' · ') : null;
  location.hash = '#/anasayfa';
}

// ---------- Hakkında: Hakkımızda, Sık Sorulan Sorular, Sorumluluk Reddi ----------
const aboutCard = (title, html) => `<section class="card about"><h3>${esc(title)}</h3>${html}</section>`;
async function viewHakkimizda() {
  updateInfo ??= await fetch('/api/update').then(r => r.json()).catch(() => null);
  return header('Hakkımızda', 'Ortam Sade nedir, nasıl çalışır') +
    aboutCard('Ortam Sade', `<p>TOBB ETÜ öğrencilerinin her gün açtığı okul sitelerini — Ortam, UBS, Uzak, UZAKYDB, Webmail ve Piazza — tek, sade bir
      arayüzde toplayan bağımsız bir öğrenci projesidir. Amaç aynı bilgiye daha az tıklamayla, daha rahat okunur biçimde ulaşmaktır:
      derslerin Piazza ve Uzak içerikleri tek sayfada, sınavlar ders programında, notlar ortalama hesaplayıcıyla birlikte.</p>`) +
    aboutCard('Nasıl çalışır?', `<ul>
      <li>Uygulama <b>senin bilgisayarında</b> çalışır. Okulun sitelerine senin oturumunla, senin adına bağlanır; araya başka bir sunucu girmez.</li>
      <li>Yalnızca <b>açtığın ekranın</b> sayfası okulun sitesinden alınır, kısa süre önbellekte tutulur; aynı ekranı tekrar açınca okula yeniden gidilmez.</li>
      <li>Okulun menüleri ve sayfaları korunur, yalnızca görünüşü sadeleştirilir. Gönderdiğin formlar ve yaptığın işlemler okulun kendi sistemine iletilir.</li>
      <li>Doğrulama (CAPTCHA) gerektiren işlemler aşılmaz; bunlar için okulun sayfasına bağlantı verilir.</li></ul>`) +
    aboutCard('Verilerin', `<ul>
      <li>Şifren yalnızca "Beni hatırla" seçiliyse, Windows'un şifreli kasasında (DPAPI) saklanır ve yalnızca bu bilgisayardaki Windows hesabın açabilir.</li>
      <li>Okuldan alınan sayfalar ve ayarların bu bilgisayarda kalır; hiçbir yere gönderilmez, toplanmaz, analiz edilmez.</li>
      <li>Bildirim e-postaları senin okul adresinden yine sana gönderilir.</li></ul>`) +
    aboutCard('Açık kaynak', `<p>Kodun tamamı herkese açıktır; ne yaptığını kendin inceleyebilir, sorun bildirebilir ya da katkıda bulunabilirsin:
      <a href="https://github.com/Soft-Coder-183/ortam-sade" target="_blank" rel="noopener">github.com/Soft-Coder-183/ortam-sade</a> (MIT lisansı).</p>`) +
    aboutCard('Sürüm', `<div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><p style="margin:0">Ortam Sade <b id="app-ver">${esc(updateInfo?.current || '…')}</b>.
      Yeni sürüm çıkınca uygulama sorar; onaylamadan hiçbir şey indirilmez ya da kurulmaz.</p>
      <button type="button" class="btn" data-upd-check>${icon('download')}Güncellemeleri denetle</button></div>`) +
    `<p class="muted small">Sorular için: <a href="#/hakkinda/sss">Sık Sorulan Sorular</a> · Önemli: <a href="#/hakkinda/sorumluluk">Sorumluluk Reddi</a></p>`;
}
const SSS = [
  ['Bu, okulun resmî uygulaması mı?', 'Hayır. Ortam Sade bağımsız bir öğrenci projesidir; TOBB ETÜ tarafından geliştirilmemiş, onaylanmamış ya da desteklenmemektedir. Ayrıntılar Sorumluluk Reddi sayfasında.'],
  ['Şifrem nerede duruyor, güvende mi?', '"Beni hatırla" seçiliyse yalnızca bu bilgisayarda, Windows\'un şifreli kasasında saklanır; başka bir yere gönderilmez. Seçili değilse yalnızca uygulama açıkken bellekte tutulur. Hesap sayfasındaki "Kayıtlı bilgileri sil" ile istediğin an silebilirsin.'],
  ['Şifrelerim her sitede aynı değil, ne yapmalıyım?', 'Hesap sayfasında "Siteye özel şifreler" bölümünü aç; farklı olan sitenin şifresini oraya yaz. Boş bıraktığın siteler ana şifreni kullanır.'],
  ['Okulun sunucularını yorar mı?', 'Hayır, normal kullanıma yakındır. Yalnızca açtığın ekran okuldan istenir ve kısa süre önbellekte tutulur. Arka planda oturumu açık tutmak için seyrek kontroller yapılır; siteye zaten bir istek gittiyse o kontrol atlanır. Bildirimler için Piazza yarım saatte, Uzak saatte bir sorulur.'],
  ['Bildirimler nasıl geliyor?', 'Uygulama açıkken Piazza ve Uzak\'taki yeni içerikleri ve Akademik Takvimde yaklaşan önemli tarihleri kontrol eder (Uzak turuncu, Piazza mavi noktayla gösterilir); yenilik varsa Windows bildirimi gösterir ve (açıksa) okul adresine "[Ortam Sade · Bildirim]" konulu bir özet e-posta yollar. Uygulama kapalıyken kontrol yapılmaz. Hesap > Bildirimler\'den kapatabilirsin.'],
  ['Otomatik silme e-postalarımı kalıcı olarak siler mi?', 'Hayır. Ayar açıksa okunmuş e-postalar 12 saat sonra Çöp kutusuna taşınır, oradan geri alınabilir. Yıldızlı e-postalar ve yanındaki "otomatik silme" yazısına basıp maviye çevirdiğin e-postalar hiç taşınmaz. Ayar varsayılan olarak kapalıdır.'],
  ['Bazı bilgiler neden yok (ör. açılan derslerin şube ve saatleri)?', 'Ortam bu bilgileri yalnızca doğrulamalı (reCAPTCHA) aramayla veriyor. Uygulama doğrulamaları aşmadığı için bu bilgiler için okulun sayfasına bağlantı verilir.'],
  ['Uzak\'ta sınav, ödev yükleme ya da Safe Exam Browser isteyen içerik olursa?', 'İçeriğin kendisi (açıklama, dosyalar, bağlantılar, Safe Exam Browser indirme bağlantısı ve yapılandırma dosyası) uygulamada görünür. Sınava başlama, ödev yükleme, foruma yazma gibi işlemler okulun sitesinde yapılır; sayfanın üstünde "Sitede aç" bağlantısı çıkar.'],
  ['Uygulama nasıl güncellenir?', 'Yeni sürüm çıkınca uygulama sağ altta sorar; "Güncelle"ye basmadan hiçbir şey indirilmez. Basınca sürüm yalnızca GitHub sayfamızdan indirilir, SHA-256 özetiyle doğrulanır, kurulur ve uygulama kendini yeniden başlatır. Şifren, oturumların ve ayarların korunur. Hakkımızda sayfasından elle de denetleyebilirsin.'],
  ['Mevzuat bölümündeki yanıtlar ne kadar güvenilir?', 'Her hızlı yanıtın altında dayandığı madde yazar ve tıklayınca o madde açılır. Uygulama her açılışta o maddenin metninin hâlâ aynı olduğunu denetler; metin değişmişse yanıtın yanında uyarı çıkar. Belgeler okulun Mevzuat sayfasındaki kaynaklardan (mevzuat.gov.tr ve okulun dosyaları) alınır. Bir yönerge, dayandığı yönetmelik ondan sonra değişmişse işaretlenir; çelişki varsa üst mevzuat geçerlidir. Yine de resmî işlemlerde Öğrenci İşleri esastır.'],
  ['Açılan Dersler\'deki şube ve saatler ne kadar güncel?', 'Ders verisi uygulamayla birlikte gelir; sayfanın üstünde son güncelleme tarihi yazar. Şube, saat ve derslikler o tarihten sonra değişmiş olabilir, bu yüzden kayıttan önce okulun güncel programından kontrol et. Yeni veri uygulama güncellemesiyle gelir.'],
  ['Uygulama ne zaman çalışıyor, arka planda açık mı kalıyor?', 'Yalnızca "Ortam Sade" siyah penceresi açıkken. Pencereyi kapatınca ya da Hesap > Güvenlik ve Oturumlar > "Uygulamayı kapat" deyince durur ve okul sitelerine hiçbir istek gitmez. Bilgisayar açılınca kendiliğinden başlamaz. Menünün altındaki yeşil nokta uygulamanın açık olduğunu gösterir; kapanırsa sayfanın üstünde kırmızı uyarı çıkar. Açıkken arka planda neyin ne sıklıkta yapıldığı da aynı sayfada yazar.'],
  ['Oturumların açık tutulması güvenli mi?', 'Oturum çerezleri yalnızca bu bilgisayarda, AES-256 ile şifreli ve Windows hesabına bağlı bir anahtarla saklanır; uygulamaya yalnızca bu bilgisayardan erişilebilir. Yine de istersen Hesap > Güvenlik ve Oturumlar\'dan oturumları açık tutmayı ve kendiliğinden yeniden girmeyi kapatabilir, sitelerden çıkış yapabilir ve uygulamaya PIN koyabilirsin. Bilgisayarı başkalarıyla paylaşıyorsan PIN önerilir.'],
  ['Okulun sitelerine doğrudan nasıl giderim?', 'Bütün sitelerin ve sık kullanılan sayfaların orijinal adresleri Hakkında ve SSS > Okulun Siteleri sayfasında. Uygulamadaki her bölümde ayrıca "Sitede aç" ya da benzeri bir bağlantı bulunur.'],
  ['Neden bazen eski bilgi görüyorum?', 'Hız için son alınan veri önce gösterilir, arka planda yenilenir ve birkaç saniye içinde güncellenir. Oturum kapanmışsa üstte bir uyarıyla son kaydedilen veri gösterilir.'],
  ['Bir sorun buldum, ne yapmalıyım?', 'Önemli bir işlemde (kayıt, başvuru, not, sınav yeri) her zaman okulun kendi sitesini esas al. Sorunu GitHub sayfasındaki Issues bölümünden (github.com/Soft-Coder-183/ortam-sade) bildirebilirsin.'],
];
// Uygulamanın bağlandığı okul sitelerinin ve sık kullanılan sayfaların orijinal adresleri: her zaman doğrudan okulun sitesine gidilebilsin.
const SITE_LINKS = [
  ['Uygulamanın bağlandığı siteler', [
    ['Ortam', 'https://ortam.etu.edu.tr/', 'Profil, dersler, ders programı, sınav takvimi, başvurular'],
    ['UBS (Üniversite Bilgi Sistemi)', 'https://ubs.etu.edu.tr/', 'Transkript, ders kaydı, belgeler'],
    ['Uzak', 'https://uzak.etu.edu.tr/', 'Ders içerikleri, ödevler, duyurular (Moodle)'],
    ['UZAKYDB', 'https://uzakydb.etu.edu.tr/', 'Yabancı Diller dersleri (Moodle)'],
    ['Webmail', 'https://webmail.etu.edu.tr/roundcube/', 'Okul e-postası'],
    ['Piazza', 'https://piazza.com/class', 'Ders soru-cevap'],
  ]],
  ['Ortam\'daki sayfalar', [
    ['Ders programı (açılan dersler)', 'https://ortam.etu.edu.tr/Guz-Donemi-Ders-Programi', 'Şube, gün/saat ve derslik araması'],
    ['Ara sınav takvimim', 'https://ortam.etu.edu.tr/ara-sinav-takvimim', ''],
    ['Final takvimim', 'https://ortam.etu.edu.tr/final-takvimim', ''],
    ['Bütünleme takvimim', 'https://ortam.etu.edu.tr/butunleme-takvimim', ''],
    ['Not görüntüleme', 'https://ortam.etu.edu.tr/bilgilerim/not-goruntuleme', ''],
    ['ÇAP / YAP başvurusu', 'https://ortam.etu.edu.tr/CAP-YAP-Basvurusu', ''],
  ]],
  ['Okulun web sitesi', [
    ['TOBB ETÜ', 'https://www.etu.edu.tr/', ''],
    ['Akademik Takvim', 'https://www.etu.edu.tr/tr/akademik-takvim', ''],
    ['Öğrenci İşleri', 'https://www.etu.edu.tr/tr/ogrenci-isleri', 'Duyurular ve sık sorulan sorular'],
    ['Mevzuat', 'https://www.etu.edu.tr/tr/sayfa/mevzuat', 'Yönetmelik ve yönergeler'],
    ['Akademik kadro', 'https://www.etu.edu.tr/tr/akademik', 'Fakülte ve bölümler'],
    ['Yabancı Diller Bölümü', 'https://www.etu.edu.tr/tr/bolum/yabanci-diller-bolumu', ''],
    ['Bilişim Portalı', 'https://bilisim.etu.edu.tr/linkler', 'Okulun bilişim hizmetleri'],
  ]],
  ['Bu proje', [
    ['Ortam Sade (GitHub)', 'https://github.com/Soft-Coder-183/ortam-sade', 'Kaynak kod'],
    ['Sürümler', 'https://github.com/Soft-Coder-183/ortam-sade/releases', 'İndirme ve sürüm notları'],
    ['Sorun bildir', 'https://github.com/Soft-Coder-183/ortam-sade/issues', ''],
  ]],
];
const viewSiteler = () => header('Okulun Siteleri', 'Uygulamanın bağlandığı sitelerin ve sık kullanılan sayfaların orijinal adresleri') +
  SITE_LINKS.map(([title, list]) => `<h2>${esc(title)}</h2><div class="card mitems">${list.map(([name, url, note]) =>
    `<div class="mi"><a class="mi-main" href="${esc(url)}" target="_blank" rel="noopener">${icon('external')}<span>${esc(name)}</span></a>
      <div class="muted small">${esc(url.replace(/^https:\/\//, '').replace(/\/$/, ''))}${note ? ` · ${esc(note)}` : ''}</div></div>`).join('')}</div>`).join('');

const viewSss = () => header('Sık Sorulan Sorular') +
  `<div class="list">${SSS.map(([q, a]) => `<details class="card faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
const viewSorumluluk = () => header('Sorumluluk Reddi') + aboutCard('Lütfen okuyun', `<ul>
  <li><b>Resmî değildir.</b> Ortam Sade, TOBB Ekonomi ve Teknoloji Üniversitesi'nin resmî bir uygulaması değildir; üniversite tarafından geliştirilmemiş, onaylanmamış ve desteklenmemektedir. Okulun adları ve sistemleri yalnızca hangi siteye bağlanıldığını belirtmek için anılır.</li>
  <li><b>Bilgiler okulun sitelerinden anlık alınır.</b> Gösterim sırasında hata, eksik ya da gecikme olabilir. Ders kaydı, not, sınav tarihi ve yeri, başvuru ve ödeme gibi resmî konularda <b>okulun kendi sistemleri esastır</b>.</li>
  <li><b>Hesaplamalar tahmindir.</b> Ortalama ve ders planı hesapları yönetmeliğe göre yapılır ama resmî sonuç yerine geçmez.</li>
  <li><b>İşlemler senin onayınla yapılır.</b> Form gönderme, e-posta gönderme/silme gibi işlemler yalnızca senin tıklamanla ya da açtığın bir ayarla okulun sistemine iletilir ve oradaki işlemle aynı sonucu doğurur.</li>
  <li><b>Kullanım sorumluluğu kullanıcıdadır.</b> Uygulamayı okulun bilgi işlem kurallarına uygun kullanmak kullanıcının sorumluluğundadır. Uygulama doğrulama (CAPTCHA) ve güvenlik önlemlerini aşmaz.</li>
  <li><b>Garanti verilmez.</b> Uygulama "olduğu gibi" sunulur; kullanımından doğabilecek veri kaybı, gecikme ya da kaçırılan işlemlerden geliştirici sorumlu tutulamaz.</li></ul>`);

// ---------- Mevzuat ----------
// Okulun Mevzuat sayfasındaki kanun, yönetmelik ve yönergeler uygulamanın içinde madde madde okunur ve aranır.
// Ekstra altında: #/ekstra/mevzuat[/ara/<arama> | /tumu | /belge/<belge>[/<madde | p<paragraf>>]] · #/ekstra/duyurular[/<duyuru>]
// (Eski #/mevzuat/… bağlantıları yönlendirmede yenisine çevrilir.)
const fmtDay = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const mdBold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const artLabel = a => !a ? '' : a.startsWith('ek') ? `Ek madde ${a.slice(2)}` : a.startsWith('g') ? `Geçici madde ${a.slice(1)}` : `Madde ${a}`;
const mvHref = (id, at) => `#/ekstra/mevzuat/belge/${encodeURIComponent(id)}${at ? '/' + encodeURIComponent(at) : ''}`;
const MV_KIND = { mg: 'mevzuat.gov.tr', rg: 'Resmî Gazete', pdf: 'PDF', docx: 'Word', doc: 'Word', link: 'Okulun sitesi' };
// Aranan sözleri metinde işaretler (şapka/nokta ve büyük-küçük harf farkı gözetmeden)
const FOLDS = { a: 'aâAÂ', c: 'cçCÇ', g: 'gğGĞ', i: 'iıİIîÎ', o: 'oöOÖ', s: 'sşSŞ', u: 'uüûUÜÛ' };
function markTerms(text, terms) {
  const parts = (terms || []).filter(t => t.length > 1).map(t => [...t].map(ch => FOLDS[ch] ? `[${FOLDS[ch]}]` : ch === ' ' ? '\\s*' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''));
  if (!parts.length) return esc(text);
  return esc(String(text).replace(new RegExp(parts.join('|'), 'gi'), m => `\u0001${m}\u0002`)).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
}
const mvSearchBox = (q = '') => `<form class="card ac-search mv-search" data-mv-search><input type="search" name="q" value="${esc(q)}" autocomplete="off"
  placeholder="Mevzuatta ara: yandal başvuru, kayıt dondurma, dersten vazgeçme…" aria-label="Mevzuatta ara"><button class="btn primary" type="submit">Ara</button></form>`;

function mvAnswerCard(x, open, plan) {
  const cites = x.cites.map(c => {
    const label = `${esc(c.title)}, ${artLabel(c.a).toLocaleLowerCase('tr')}${c.t ? ` <span class="muted">(${esc(c.t)})</span>` : ''}`;
    const warn = c.ok === false ? ' <span class="mv-warn">Bu maddenin metni değişmiş görünüyor; yanıtı maddeden kontrol et.</span>'
      : c.ok === null ? ' <span class="mv-warn">Kaynak şu an açılamadı.</span>' : '';
    return `<li>${c.id ? `<a href="${mvHref(c.id, c.a)}">${label}</a>` : label}${warn}</li>`;
  }).join('');
  const now = Date.now();
  const cal = x.calendar.map(c => {
    const live = c.start && c.end && c.start <= now && now <= c.end, next = c.start > now;
    return `<li class="${live ? 'live' : ''}">${icon('calendar')}<span><b>${esc(c.when)}</b> · ${esc(c.what)} <span class="muted">(${esc(c.term)}${live ? ', şu an açık' : next ? '' : ', geçti'})</span></span></li>`;
  }).join('');
  const news = x.news.map(n => `<li>${icon('megaphone')}<span><a href="#/ekstra/duyurular/${encodeURIComponent(n.path.split('/').pop())}">${esc(n.title)}</a> <span class="muted">${esc(n.ago)}</span></span></li>`).join('');
  return `<details class="card mv-ans" data-keep="mv-${esc(x.id)}"${open ? ' open' : ''}><summary>${esc(x.q)}</summary>
    <p>${mdBold(x.a)}</p>
    ${cal ? `<div class="mv-sub">Akademik Takvim</div><ul class="mv-list">${cal}</ul>` : ''}
    ${news ? `<div class="mv-sub">Öğrenci İşleri duyurusu</div><ul class="mv-list">${news}</ul>` : ''}
    ${mvMine(x.id, plan)}
    <div class="mv-sub">Kaynak</div><ul class="mv-cites">${cites}</ul></details>`;
}

async function viewMvYanitlar(r, bar = '') {
  const q = (r.param || '').trim();
  // Transkript (UBS) varsa yanıtların altında "senin durumun" gösterilir; UBS yavaşsa ya da kapalıysa beklenmez
  const planP = Promise.race([api('plan').catch(() => null), new Promise(ok => setTimeout(() => ok(null), 4000))]);
  const [ans, res, plan] = await Promise.all([api('mevzuat-yanitlar'), q ? api('mevzuat-ara?q=' + encodeURIComponent(q)) : null, planP]);
  if (!q) fetch('/api/mevzuat-ara?q=').catch(() => {});      // arama dizinini arka planda hazırla (ilk aramada beklenmesin)
  // Hızlı yanıt eşleşmesi: sözlerin kökü (son ekleri kırpılmış hâli) soruda, etiketlerde ya da yanıtta geçmeli.
  // Eş anlamlı karşılık ("kayıt dondurma" → "izin") yalnızca soru ve etiketlerde aranır; yoksa her yanıt eşleşir.
  const stem = w => w.slice(0, Math.max(4, w.length - 3));
  const words = trFold(q).split(/\s+/).filter(w => w.length > 1).map(stem);
  const alt = (res?.also ?? []).map(a => a.split(' ').map(stem));
  const hit = x => {
    const head = trFold([x.q, ...x.tags].join(' ')), all = head + ' ' + trFold(x.a);
    return words.length && words.every(w => all.includes(w)) ? 2 + words.filter(w => head.includes(w)).length
      : alt.some(ws => ws.length && ws.every(w => head.includes(w))) ? 1 : 0;
  };
  const list = q ? ans.answers.map(x => [x, hit(x)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1]).map(([x]) => x) : ans.answers;
  let html = header('Mevzuat', 'Sık sorulan kurallar, dayandıkları maddeyle; ya da bütün mevzuatta ara') + bar + mvSearchBox(q);
  if (q) {
    html += list.length ? `<h2>Hızlı yanıtlar</h2>${list.map(x => mvAnswerCard(x, true, plan)).join('')}` : '';
    html += `<h2>Mevzuatta “${esc(q)}”</h2>`;
    html += res.results.length
      ? `<p class="muted small">${res.total > res.results.length ? `En ilgili ${res.results.length} sonuç (toplam ${res.total})` : `${res.total} sonuç`}, ${res.docs} belgede${res.also?.length ? ` · “${esc(res.also.join('”, “'))}” olarak da arandı` : ''}</p>
         <div class="card mitems mv-hits">${res.results.map(h => `<a class="mv-hit" href="${mvHref(h.id, h.a ?? (h.b != null ? 'p' + h.b : ''))}">
           <span class="mv-hit-h"><b>${esc(h.doc)}</b>${h.a ? ` · ${artLabel(h.a)}${h.t ? ` — ${esc(h.t)}` : ''}` : ''}</span>
           <span class="mv-snip">${markTerms(h.snippet, res.terms)}</span></a>`).join('')}</div>`
      : `<div class="card msg">Bu sözlerle bir madde bulunamadı. Daha kısa ya da farklı bir söz dene (ör. “izin” yerine “dönem izni”).</div>`;
    return html;
  }
  html += `<h2>Hızlı yanıtlar</h2><p class="muted small">Her yanıt, altında yazan maddeye dayanır. Uygulama her açılışta maddenin hâlâ aynı olduğunu denetler; değişmişse uyarır.</p>` +
    list.map(x => mvAnswerCard(x, false, plan)).join('') +
    `<p class="muted small">Yanıtlar bilgi amaçlıdır. Resmî işlemlerde güncel mevzuat ve Öğrenci İşleri esastır.</p>`;
  return html;
}

async function viewMvTumu(bar = '') {
  const ix = await api('mevzuat');
  const row = i => {
    const d = i.dates;
    const when = d ? [d.rg ? `Resmî Gazete ${fmtDay(d.rg.date)}` : '', d.lastAmend ? `son değişiklik ${fmtDay(d.lastAmend)}` : '',
      d.senato?.length ? `son Senato kararı ${fmtDay(d.senato.at(-1))}` : ''].filter(Boolean).join(' · ') : '';
    const main = i.id
      ? `<a class="mi-main" href="${mvHref(i.id)}">${icon('file-text')}<span>${esc(i.title)}</span></a>`
      : `<a class="mi-main" href="${esc(i.url)}" target="_blank" rel="noopener">${icon('external')}<span>${esc(i.title)}</span></a>`;
    return `<div class="mi">${main}<div class="muted small">${esc([MV_KIND[i.kind], when].filter(Boolean).join(' · '))}</div></div>`;
  };
  return header('Mevzuat', 'Okulun Mevzuat sayfasındaki bütün belgeler; uygulamanın içinde madde madde açılır') + bar + mvSearchBox() +
    ix.sections.map(s => {
      const main = s.items.filter(i => !i.other), other = s.items.filter(i => i.other);
      return `<h2>${esc(s.title)}</h2>` + (main.length ? `<div class="card mitems">${main.map(row).join('')}</div>` : '') +
        (other.length ? `<details class="card mitems mv-other" data-keep="mv-other-${esc(s.title)}"><summary>Diğer: araştırma merkezleri, personel, idari (${other.length})</summary>${other.map(row).join('')}</details>` : '');
    }).join('') +
    `<p class="muted small">Kaynak: <a href="${esc(ix.source)}" target="_blank" rel="noopener">okulun Mevzuat sayfası</a>. Tarihler, belge bir kez açıldıktan ya da arandıktan sonra görünür.</p>`;
}

const mvNotes = s => s.replace(/\(((?:Değişik|Ek|Mülga|İptal)[^()]*(?:\([^()]*\)[^()]*)*)\)/g, '<span class="mv-note">($1)</span>');
async function viewMvDoc(id, at) {
  const d = await api('mevzuat-doc?id=' + encodeURIComponent(id));
  const dt = d.dates;
  const own = [...(dt.senato || [])].concat(dt.lastAmend || [], dt.rg?.date || []).sort().at(-1) || null;
  const meta = [dt.rg ? `Resmî Gazete: ${fmtDay(dt.rg.date)} (sayı ${esc(dt.rg.no)})` : '', dt.lastAmend ? `Son işlenmiş değişiklik: ${fmtDay(dt.lastAmend)}` : '',
    dt.senato?.length ? `Senato kararları: ${dt.senato.map(fmtDay).join(', ')}` : '', dt.uploaded ? `Okulun sitesine yüklenme: ${fmtDay(dt.uploaded)}` : ''].filter(Boolean);
  const warns = [];
  for (const x of d.related) if (x.lastAmend && own && x.lastAmend > own)
    warns.push(`Bu belgenin bilinen son tarihi ${fmtDay(own)}. Dayandığı <a href="${mvHref(x.id)}">${esc(x.title)}</a> ondan sonra, <b>${fmtDay(x.lastAmend)}</b> tarihinde değişti. Çelişen bir hüküm varsa üst mevzuat geçerlidir.`);
  if (d.kind === 'mg' && !dt.lastAmend && dt.rg && /yönetmeli/i.test(d.title))
    warns.push(`mevzuat.gov.tr'deki bu metinde işlenmiş bir değişiklik notu yok; metin ${fmtDay(dt.rg.date)} tarihli yayımdaki hâli. Sonraki Senato kararları ve yönergeler bazı konuları ayrıca düzenliyor olabilir.`);
  const firstOf = new Set();
  const body = d.blocks.map((b, i) => {
    let idAttr = `id="mv-p${i}"`;
    if (b.a && !firstOf.has(b.a)) { firstOf.add(b.a); idAttr += ` data-art="${esc(b.a)}"`; }
    const x = mvNotes(esc(b.x));
    if (b.k === 'title') return `<h2 class="mv-title" ${idAttr}>${x}</h2>`;
    if (b.k === 'part') return `<h3 class="mv-part" ${idAttr}>${x}</h3>`;
    if (b.k === 'h') return `<h4 class="mv-h" ${idAttr}>${x}</h4>`;
    const cls = b.start ? 'mv-start' : /^\(\d+\)/.test(b.x) ? 'mv-f' : /^([a-zçğıöşü]{1,2}|\d+)\)\s/.test(b.x) ? 'mv-bent' : '';
    return `<p class="${cls}" ${idAttr}>${b.start ? x.replace(/^((?:EK |GEÇİCİ |Ek |Geçici )?MADDE\s*\d+\s*[-–—]?)/i, '<b>$1</b>') : x}</p>`;
  }).join('');
  const toc = d.arts.length ? `<details class="card mv-toc"><summary>Maddeler (${d.arts.length})</summary><div class="mv-toc-list">${d.arts.map(a =>
    `<a href="${mvHref(d.id, a.a)}"><b>${esc(artLabel(a.a).replace('Madde ', ''))}</b> ${esc(a.t || '')}</a>`).join('')}</div></details>` : '';
  mvTarget = at || null;
  return `<p class="mv-back"><a href="#/ekstra/mevzuat/tumu">← Tüm mevzuat</a></p>` + header(d.title, [d.section, MV_KIND[d.kind]].filter(Boolean).join(' · ')) +
    `<div class="card mv-meta">${meta.length ? `<ul>${meta.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}
      <a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">${icon('external')}Kaynağında aç</a></div>` +
    warns.map(w => `<div class="banner mv-banner">${w}</div>`).join('') + toc +
    `<article class="card mv-doc">${body}</article>` +
    (d.notes?.length ? `<details class="card mv-notes"><summary>Yayım ve değişiklik çizelgesi</summary>${d.notes.map(n => `<p>${esc(n)}</p>`).join('')}</details>` : '');
}
// Belge açılınca istenen maddeye kaydır ve kısa süre vurgula
let mvTarget = null;
function mvScroll() {
  if (!mvTarget) return;
  const el = /^p\d+$/.test(mvTarget) ? document.getElementById('mv-' + mvTarget) : $view.querySelector(`[data-art="${CSS.escape(mvTarget)}"]`);
  mvTarget = null;
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  el.classList.add('mv-flash');
  setTimeout(() => el.classList.remove('mv-flash'), 2400);
}

async function viewMvDuyurular(r) {
  if (r.param) return viewMvDuyuru(r.param);
  const n = await api('mevzuat-duyurular');
  return header('Öğrenci İşleri Duyuruları', 'Okulun Öğrenci İşleri sayfasındaki son duyurular') +
    `<div class="card mitems">${n.items.map(x => `<div class="mi"><a class="mi-main" href="#/ekstra/duyurular/${encodeURIComponent(x.path.split('/').pop())}">${icon('megaphone')}<span>${esc(x.title)}</span></a>
      <div class="muted small">${esc(x.ago)}</div></div>`).join('')}</div>
     <p class="muted small">Kaynak: <a href="${esc(n.source)}" target="_blank" rel="noopener">Öğrenci İşleri</a></p>`;
}
async function viewMvDuyuru(slug) {
  const d = await api('mevzuat-duyuru?path=' + encodeURIComponent('/tr/ogrenci-isleri/duyuru/' + slug));
  const links = d.links.filter(l => l.text && !/^(paylaş|linkedin|twitle)$/i.test(l.text)).map(l => {
    const read = l.docId ? `<a class="btn" href="${mvHref(l.docId)}">${icon('file-text')}Uygulamada oku</a>` : '';
    const old = l.newer?.older ? `<div class="banner mv-banner">Bu bağlantı belgenin <b>eski bir sürümüne</b> gidiyor (${fmtDay(l.uploaded)} tarihli dosya). Mevzuat sayfasındaki daha yeni sürüm: <a href="${mvHref(l.newer.id)}">${esc(l.newer.title)}</a>${l.newer.uploaded ? ` (${fmtDay(l.newer.uploaded)})` : ''}.</div>` : '';
    return `<div class="mi"><a class="mi-main" href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.kind === 'pdf' ? 'file' : 'external')}<span>${esc(l.text)}</span></a> ${read}${old}</div>`;
  }).join('');
  return `<p class="mv-back"><a href="#/ekstra/duyurular">← Duyurular</a></p>` + header(d.title, 'Öğrenci İşleri duyurusu') +
    `<div class="card mv-news">${d.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>` +
    (links ? `<h2>Bağlantılar</h2><div class="card mitems">${links}</div>` : '') +
    `<p><a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">${icon('external')}Okulun sitesinde aç</a></p>`;
}

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-mv-search]');
  if (!f) return;
  e.preventDefault();
  const q = f.q.value.trim();
  location.hash = '#/ekstra/mevzuat' + (q ? '/ara/' + encodeURIComponent(q) : '');
});

// Mevzuat sayfası: üstte iki sekme (Hızlı Yanıtlar / Tüm Mevzuat); belge açıkken okuyucu
const MV_TABS = [['', 'Hızlı Yanıtlar'], ['tumu', 'Tüm Mevzuat']];
async function viewMevzuat(r) {
  const p = r.param || '';
  if (p.startsWith('belge/')) { const [, id, at] = p.split('/'); return viewMvDoc(id, at); }
  const tab = p === 'tumu' ? 'tumu' : '';
  const bar = `<div class="tabs">${MV_TABS.map(([id, label]) => `<a href="#/ekstra/mevzuat${id ? '/' + id : ''}" class="${id === tab ? 'on' : ''}">${label}</a>`).join('')}</div>`;
  return tab === 'tumu' ? viewMvTumu(bar) : viewMvYanitlar({ param: p.startsWith('ara/') ? p.slice(4) : '' }, bar);
}

// "Senin durumun": hızlı yanıtın transkriptine (UBS) göre sana uygulanışı. Tahmindir; Öğrenci İşleri'nin hesabı esastır.
function mvMine(id, p) {
  if (!p || p.gano == null) return '';
  const gno = parseFloat(String(p.gano).replace(',', '.'));
  if (!Number.isFinite(gno)) return '';
  const g = fmt2(gno);
  const n = p.courseTerms?.length || 0;            // şimdiye kadarki ders dönemleri (içinde bulunulan dahil)
  const nextN = n + 1;                               // başvurular dönemin başında: sıradaki dönem
  const open = p.failedOpen ?? [];
  const yes = s => `<span class="me-ok">${s}</span>`, no = s => `<span class="me-no">${s}</span>`;
  const lines = [];
  if (id === 'yap-basvuru' || id === 'cap-basvuru') {
    const [lo, hi, min] = id === 'yap-basvuru' ? [3, 6, 3.0] : [3, 5, 3.3];
    lines.push(`${esc(p.nextTerm || 'Gelecek dönem')} <b>${nextN}. ders dönemin</b> olacak: ` + (nextN >= lo && nextN <= hi
      ? yes(`başvuru aralığındasın (${lo}.–${hi}.)${nextN === hi ? ', son hakkın' : ''}.`) : nextN < lo ? no(`henüz erken (en erken ${lo}. ders dönemi).`) : no(`başvuru dönemi geçmiş (en geç ${hi}.).`)));
    lines.push(`GNO ${g}: ` + (gno >= min ? yes(`${fmt2(min)} şartını sağlıyorsun.`) : no(`${fmt2(min)} şartını şu an sağlamıyorsun.`)));
    if (open.length) lines.push(`Henüz geçmediğin ders: ${open.map(f => esc(f.code) + (f.retaking ? ' (bu dönem alıyorsun)' : '')).join(', ')}. "Alman gereken bütün dersleri geçmiş olma" şartı için önemli.`);
    if (id === 'cap-basvuru') lines.push('Sınıfındaki ilk %20 sıralaması transkriptte görünmüyor; Öğrenci İşleri belirler.');
  }
  if (id === 'cap-yap-ilisik') lines.push(`GNO ${g}: yandal sınırı 2,30 → ${gno >= 2.3 ? yes('üstündesin') : no('altındasın')}; ÇAP sınırı 2,75 → ${gno >= 2.75 ? yes('üstündesin') : no('altındasın')}.`);
  if (id === 'vazgecme') {
    const w = p.withdrawals?.length ?? 0, now = (p.withdrawals ?? []).some(x => x.term === p.currentTerm);
    lines.push(`Transkriptine göre <b>${w}/6</b> vazgeçme hakkı kullanılmış` + (p.currentTerm ? (now ? '; bu dönemki hakkını kullandın.' : `; bu dönem (${esc(p.currentTerm)}) hakkın duruyor.`) : '.') +
      (n < 3 ? ' 3. ders döneminden önce vazgeçilemez.' : ''));
  }
  if (id === 'tekrar') lines.push(`CC–BA notlu derslerden tekrar hakkı: <b>${p.improveUsed ?? 0}/${p.improveMax ?? 5}</b> kullanılmış.` +
    (open.length ? ` Tekrar etmen gereken: ${open.map(f => esc(f.code)).join(', ')}.` : ''));
  if (id === 'sinamali') lines.push(n <= 2 ? `İlk iki ders döneminde sınamalı/başarısız sayılmazsın (GNO ${g}).`
    : `GNO ${g}: ${gno >= 2 ? yes('başarılı') : gno >= 1.5 ? no('sınamalı') : no('başarısız')} sayılıyorsun.`);
  if (id === 'kredi' && p.limits) lines.push(`Programın ${p.programCredits} kredi: dönemde <b>en az ${p.limits.min}, en çok ${p.limits.max}</b> kredi alabilirsin.`);
  if (id === 'azami-sure' && p.firstTerm) {
    const y = parseInt(p.firstTerm, 10);
    if (y) lines.push(`İlk lisans dönemin ${esc(p.firstTerm)}. Dört yıllık programdaysan azami süre <b>${y + 6}-${y + 7}</b> eğitim yılının sonunda doluyor (süreye sayılmayan izinler eklenir).`);
  }
  if (!lines.length) return '';
  return `<div class="mv-me"><div class="mv-sub">Senin durumun <span class="muted">· transkriptine göre, tahmini</span></div><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
}
// ---------- Mevzuat sonu ----------

// ---------- Güvenlik: kilit (PIN), uygulama durumu, oturumlar ----------
// Kilit: PIN açıksa sunucu kilit açılmadan veri vermez (423). Kilit ekranı tüm sayfanın üstünde durur; hareketsizlik süresi
// dolunca (Hesap > Güvenlik) arayüz kendini kilitler. PIN yalnızca sunucuda tuzlu özet olarak saklanır.
let lockInfo = { enabled: false, unlocked: true, idle: 15 };
let lastInput = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
function showLock(msg = '') {
  if (document.getElementById('lock')) { if (msg) document.querySelector('#lock .lock-msg').textContent = msg; return; }
  const d = document.createElement('div');
  d.id = 'lock';
  d.innerHTML = `<form class="lock-box" data-lock-form><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><h2>Ortam Sade kilitli</h2>
    <p class="muted">Devam etmek için PIN'ini gir.</p>
    <input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]*" aria-label="PIN" autofocus>
    <button type="submit">Kilidi aç</button><p class="lock-msg">${esc(msg)}</p></form>`;
  document.body.appendChild(d);
  document.body.classList.add('locked');
  setTimeout(() => d.querySelector('input')?.focus(), 50);
}
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-lock-form]');
  if (!f) return;
  e.preventDefault();
  const r = await post('/api/lock/unlock', { pin: f.pin.value }).catch(() => null);
  const j = await r?.json().catch(() => ({}));
  if (!r?.ok) { f.pin.value = ''; f.querySelector('.lock-msg').textContent = j?.error || 'Uygulamaya ulaşılamadı'; return; }
  document.getElementById('lock')?.remove();
  document.body.classList.remove('locked');
  lastInput = Date.now();
  lockInfo.unlocked = true;
  render();
});
async function checkLock() {
  const r = await fetch('/api/lock').catch(() => null);
  if (!r?.ok) return;
  lockInfo = await r.json();
  if (lockInfo.enabled && !lockInfo.unlocked) showLock();
}
// Hareketsizlikte kendiliğinden kilitlenme
setInterval(() => {
  if (!lockInfo.enabled || !lockInfo.idle || document.getElementById('lock')) return;
  if (Date.now() - lastInput > lockInfo.idle * 60_000) { post('/api/lock/lock').catch(() => {}); showLock(); }
}, 15_000);

// Uygulama (sunucu) açık mı: menünün altında küçük gösterge; kapalıysa sayfanın üstünde uyarı
let serverUp = true;
async function checkServer() {
  const ok = await fetch('/api/lock', { cache: 'no-store' }).then(r => r.ok).catch(() => false);
  if (ok === serverUp) return;
  serverUp = ok;
  const el = document.querySelector('.srv-state');
  if (el) el.outerHTML = srvStateHtml();
  let b = document.getElementById('srv-down');
  if (!ok && !b) {
    b = document.createElement('div');
    b.id = 'srv-down';
    b.innerHTML = `<b>Uygulama kapalı.</b> Ortam Sade'nin siyah penceresi kapatılmış ya da bilgisayar yeniden başlatılmış olabilir.
      Yeniden açmak için klasördeki <b>Ortam Sade.cmd</b> dosyasına çift tıkla. Bu sayfa kendiliğinden yenilenecek.`;
    document.body.prepend(b);
  } else if (ok && b) { b.remove(); render(); }
}
setInterval(checkServer, 20_000);
const srvStateHtml = () => `<a class="theme-quick srv-state${serverUp ? '' : ' down'}" href="#/hesap" title="Uygulamanın durumu: Hesap > Güvenlik ve Oturumlar"><i></i>Durum: ${serverUp ? 'Açık' : 'Kapalı'}</a>`;

const dur = ms => { const m = Math.round(ms / 60_000); return m < 60 ? `${m} dk` : m < 1440 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${Math.floor(m / 1440)} gün ${Math.floor((m % 1440) / 60)} sa`; };
const clock = t => (t ? new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const everyText = m => (m < 60 ? `${m} dakikada bir` : m % 60 === 0 ? `${m / 60} saatte bir` : `${(m / 60).toLocaleString('tr-TR')} saatte bir`);
function securitySection(st) {
  const on = (k, label, note) => `<label class="check"><input type="checkbox" data-sec="${k}"${st[k] ? ' checked' : ''}><span>${label}<span class="muted"> ${note}</span></span></label>`;
  const rows = Object.entries(st.sessions).map(([site, x]) => `<div class="sec-row"><b>${esc(SITE_NAMES[site] || site)}</b>
    <span>${x.loggedOut ? '<span class="pill gray">çıkış yapıldı</span>' : x.cookies ? '<span class="pill ok">oturum kayıtlı</span>' : '<span class="pill gray">oturum yok</span>'}</span>
    ${x.cookies && !x.loggedOut ? `<button type="button" class="btn" data-logout="${esc(site)}">Oturumu kapat</button>` : '<span></span>'}</div>`).join('');
  const jobs = st.jobs.map(j => `<tr class="${j.on ? '' : 'off'}"><td>${esc(j.label)}</td><td>${j.on ? everyText(j.every) : 'kapalı'}</td><td>${clock(j.last)}</td><td>${j.on ? clock(j.next) : '—'}</td></tr>`).join('');
  return `<h2>Güvenlik ve Oturumlar</h2>
  <div class="card sec">
    <div class="sec-app"><div><b>Uygulama açık</b> <span class="muted">· ${clock(st.startedAt)}'den beri (${dur(st.now - st.startedAt)}) · sürüm ${esc(st.version)}</span>
      <p class="muted small">Uygulama yalnızca "Ortam Sade" siyah penceresi açıkken çalışır; pencere kapanınca okul sitelerine hiçbir istek gitmez,
        bildirim ve hatırlatma da gelmez. Bilgisayar açılınca kendiliğinden başlamaz. Menünün altındaki gösterge her zaman uygulamanın açık olup olmadığını gösterir.</p></div>
      <button type="button" class="btn danger" data-shutdown>Uygulamayı kapat</button></div>
    <details class="sec-jobs" data-keep="sec-jobs"><summary>Uygulama açıkken arka planda yapılanlar</summary>
      <table class="t"><thead><tr><th>İş</th><th>Sıklık</th><th>Son</th><th>Sonraki</th></tr></thead><tbody>${jobs}</tbody></table>
      <p class="muted small">Oturum kontrolü atlanabilir: o aralıkta siteye zaten bir istek gittiyse ayrıca sorulmaz.</p></details>
  </div>
  <div class="card sec">
    <b>Oturumlar</b>
    ${on('keepAlive', 'Oturumları açık tut', '(arka planda düzenli kontrol; kapalıysa oturumlar okulun belirlediği sürede kendiliğinden düşer)')}
    ${on('autoRelogin', 'Oturum düşünce kendiliğinden yeniden gir', '(kayıtlı bilgilerle ya da kayıtlı tarayıcı profiliyle; kapalıysa "Giriş yap" düğmesine sen basarsın)')}
    <div class="sec-sites">${rows}</div>
    <div class="row" style="justify-content:flex-start;gap:8px"><button type="button" class="btn danger" data-logout="all">Bütün sitelerden çıkış yap</button></div>
    <p class="muted small">Oturumu kapat: sitenin kendisinde de çıkış yapılır (UBS hariç; UBS'de yalnızca uygulamadaki oturum silinir, okulun tarafında kısa sürede kendiliğinden düşer),
      uygulamadaki çerezler ve o sitenin önbelleğe alınmış verileri silinir. Sen yeniden giriş yapana kadar uygulama o siteye girmez.</p>
  </div>
  <div class="card sec">
    <b>Giriş PIN'i</b> ${st.lock ? '<span class="pill ok">açık</span>' : '<span class="pill gray">kapalı</span>'}
    <p class="muted small">PIN açıkken uygulama her açılışta ve hareketsiz kalınca kilitlenir; kilit açılmadan hiçbir bilgi gösterilmez. Bilgisayarı başkalarıyla paylaşıyorsan işe yarar.</p>
    <form class="sec-pin" data-pin-form><input name="pin" type="password" inputmode="numeric" maxlength="8" placeholder="${st.lock ? 'Yeni PIN (4–8 rakam)' : 'PIN (4–8 rakam)'}" autocomplete="new-password">
      <button type="submit" class="btn primary">${st.lock ? 'PIN\'i değiştir' : 'PIN koy'}</button>
      ${st.lock ? '<button type="button" class="btn" data-pin-clear>PIN\'i kaldır</button><button type="button" class="btn" data-pin-lock>Şimdi kilitle</button>' : ''}</form>
    ${st.lock ? `<label class="sec-idle">Hareketsizlikte kilitle: <select data-lock-idle>${[[5, '5 dakika'], [15, '15 dakika'], [30, '30 dakika'], [60, '1 saat'], [0, 'Kilitleme']].map(([v, l]) =>
      `<option value="${v}"${v === st.lockIdle ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
  </div>
  <div class="card sec">
    <b>Bu bilgisayarda saklananlar</b>
    <ul class="small sec-list">
      <li>Okul sitelerinin oturum çerezleri, okuldan alınan kişisel veriler (notlar, e-postalar, ders bilgileri; hız için tutulan önbellek) ve bildirimler
        <b>AES-256 ile şifreli</b>. Şifreleme anahtarı Windows hesabına bağlı (DPAPI): dosyalar kopyalanırsa başka bir hesapta ya da bilgisayarda açılamaz.</li>
      <li>Şifren yalnızca "Beni hatırla" seçiliyse Windows'un şifreli kasasında (DPAPI) durur.</li>
      <li>Ortam ve UBS'ye pencereyle girişte kullanılan tarayıcı profili Chrome'un kendi şifrelemesini kullanır.</li>
      <li>Uygulama yalnızca bu bilgisayardan (127.0.0.1) erişilebilir; ağdaki başka cihazlar bağlanamaz.</li>
    </ul>
  </div>`;
}
$view.addEventListener('change', async e => {
  const c = e.target.closest('[data-sec]');
  if (c) { await post('/api/security', { [c.dataset.sec]: c.checked }).catch(() => toast('Ayar kaydedilemedi')); return toast('Kaydedildi'); }
  const i = e.target.closest('[data-lock-idle]');
  if (i) { await post('/api/security', { lockIdle: +i.value }); lockInfo.idle = +i.value; toast('Kaydedildi'); }
});
$view.addEventListener('submit', async e => {
  const f = e.target.closest('[data-pin-form]');
  if (!f) return;
  e.preventDefault();
  const r = await post('/api/lock/set', { pin: f.pin.value }).catch(() => null);
  const j = await r?.json().catch(() => ({}));
  if (!r?.ok) return toast(j?.error || 'PIN kaydedilemedi');
  lockInfo = { ...lockInfo, enabled: true, unlocked: true };
  toast('PIN kaydedildi');
  render();
});
$view.addEventListener('click', async e => {
  const lo = e.target.closest('[data-logout]');
  if (lo) {
    if (!lo.classList.contains('armed')) { lo.classList.add('armed'); lo.textContent = 'Emin misin? Tekrar bas'; return; }
    lo.disabled = true;
    const r = await post('/api/logout', { site: lo.dataset.logout }).catch(() => null);
    toast(r?.ok ? 'Oturum kapatıldı' : 'Oturum kapatılamadı');
    return render();
  }
  if (e.target.closest('[data-shutdown]')) {
    const b = e.target.closest('[data-shutdown]');
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Kapatılsın mı? Tekrar bas'; return; }
    await post('/api/shutdown').catch(() => {});
    serverUp = true;
    setTimeout(checkServer, 1500);
    return;
  }
  if (e.target.closest('[data-pin-clear]')) {
    const f = e.target.closest('.sec').querySelector('[data-pin-form] input');
    if (!f.value) { f.placeholder = 'Kaldırmak için şimdiki PIN\'i yaz'; f.focus(); return toast('Kaldırmak için şimdiki PIN\'i yazıp tekrar bas'); }
    const r = await post('/api/lock/clear', { pin: f.value }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    if (!r?.ok) return toast(j?.error || 'PIN kaldırılamadı');
    lockInfo = { ...lockInfo, enabled: false };
    toast('PIN kaldırıldı');
    return render();
  }
  if (e.target.closest('[data-pin-lock]')) { await post('/api/lock/lock').catch(() => {}); showLock(); }
});

// ---------- yönlendirme ----------
const views = {
  anasayfa: viewHome, 'donem/derslerim': viewDerslerim, 'donem/program': viewProgram, sinav: viewSinav,
  'profil/bilgilerim': viewBilgilerim, 'profil/notlar': viewNotlar, 'profil/ortalama': viewPlan, 'profil/mufredat': viewMufredat,
  'profil/ortak': simpleView('ortak', 'Ortak Eğitim Bilgilerim'), 'profil/yabanci-dil': simpleView('yabanci-dil', 'İkinci Yabancı Dil Bilgilerim'),
  'profil/odeme': simpleView('odeme', 'Ödeme Bilgilerim'), 'ekstra/acilan': viewAcilan, 'ekstra/takvim': viewTakvim,
  'ekstra/kadro': viewKadro, 'ekstra/yabanci-diller': viewYabanciDiller,
  'cap/capyap': viewCap, 'cap/staj': viewApply('staj'), 'cap/ogrenim': viewApply('ogrenim'), 'cap/mezun': viewApply('mezun'),
  ubs: viewUbs, uzakydb: viewUzakydb, webmail: viewWebmail, piazza: viewPiazza, hesap: viewHesap,
  'ekstra/mevzuat': viewMevzuat, 'ekstra/duyurular': viewMvDuyurular,
  'hakkinda/hakkimizda': viewHakkimizda, 'hakkinda/siteler': viewSiteler, 'hakkinda/sss': viewSss, 'hakkinda/sorumluluk': viewSorumluluk,
};

// #/grup[/alt][/parametre…]: alt menüsü olan gruplarda alt sayfadan sonrası (ör. #/donem/derslerim/BIL214/uzak),
// olmayanlarda gruptan sonrası (ör. #/ubs/<kodlanmış yol>) görünüme parametre olarak gider.
function route() {
  // Mevzuat menüsü Ekstra'nın altına taşındı: eski bağlantılar (son kullanılanlar, yer imleri) yenisine çevrilir
  const old = location.hash.match(/^#\/mevzuat(?:\/(yanitlar|tumu|duyurular))?(?:\/(.*))?$/);
  if (old) {
    const [, s, rest] = old;
    location.replace(s === 'duyurular' ? `#/ekstra/duyurular${rest ? '/' + rest : ''}` : s === 'tumu' ? `#/ekstra/mevzuat/${rest ? 'belge/' + rest : 'tumu'}`
      : `#/ekstra/mevzuat${rest ? '/ara/' + rest : ''}`);
  }
  const [g, s, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const group = NAV.find(n => n.id === g) || NAV.find(n => n.id === 'anasayfa');
  const item = group.items && (group.items.find(i => i[0] === s) || group.items[0]);
  const segs = group.items ? (item[0] === s ? rest : []) : (s ? [s, ...rest] : []);
  let param = null;
  try { param = segs.length ? decodeURIComponent(segs.join('/')) : null; } catch {}
  return { group, sub: item?.[0] ?? null, param, key: item ? `${group.id}/${item[0]}` : group.id };
}

function renderNav({ group, sub }) {
  const firstBottom = NAV.find(n => n.bottom);
  // Marka: TOBB ETÜ logosundaki üç renk (mavi, kırmızı, turuncu) küçük bir işaret olarak
  $nav.innerHTML = `<a class="brand" href="#/anasayfa"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>Ortam</a>` + NAV.map(n => {
    const href = '#/' + n.id + (n.items ? '/' + n.items[0][0] : '');
    const subs = n === group && n.items ? `<div class="subs">${n.items.map(([id, label]) =>
      `<a href="#/${n.id}/${id}" class="${id === sub ? 'on' : ''}">${esc(label)}${n.id === 'donem' && id === 'derslerim' ? srcDots(notif.bySource, true) : ''}</a>`).join('')}</div>` : '';
    const cls = ['grp', n === firstBottom && 'push', n.extra && 'extra', n.rare && 'rare', n === group && 'on'].filter(Boolean).join(' ');
    return `<a href="${href}" class="${cls}"${n === group ? ' aria-current="page"' : ''}>${icon(n.icon)}<span class="full">${esc(n.label)}</span><span class="short">${esc(n.short)}</span>${n.id === 'donem' ? srcDots(notif.bySource, true) : ''}</a>${subs}`;
  }).join('') + srvStateHtml() + themeQuick();
}

// ---------- Tema ----------
// Görünüm tercihi bu cihazda saklanır: 'auto' (cihazın ayarı), 'light', 'dark'. index.html tercihi ilk çizimden önce
// <html data-theme> olarak uygular; burada seçici, menüdeki hızlı düğme ve tarayıcı çubuğu rengi güncellenir.
const THEMES = [['auto', 'Otomatik', 'contrast'], ['light', 'Aydınlık', 'sun'], ['dark', 'Karanlık', 'moon']];
function getTheme() {
  try { const t = localStorage.getItem('tema'); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; }
}
function setTheme(t) {
  try { if (t === 'auto') localStorage.removeItem('tema'); else localStorage.setItem('tema', t); } catch {}
  applyTheme(t);
}
function applyTheme(t = getTheme()) {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--card').trim() || '#ffffff';
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === t)));
  const q = document.querySelector('[data-theme-cycle]');
  if (q) q.outerHTML = themeQuick();
}
const themePicker = () => `<div class="theme-pick" role="radiogroup" aria-label="Görünüm">${THEMES.map(([id, label, ic]) =>
  `<button type="button" role="radio" aria-checked="${id === getTheme()}" data-theme-set="${id}">${icon(ic)}${label}</button>`).join('')}</div>`;
// Masaüstünde menünün en altında: tıkladıkça Otomatik → Aydınlık → Karanlık
function themeQuick() {
  const [, label, ic] = THEMES.find(x => x[0] === getTheme());
  return `<button type="button" class="theme-quick" data-theme-cycle title="Görünüm değiştir">${icon(ic)}<span>Görünüm: ${label}</span></button>`;
}
document.addEventListener('click', e => {
  const set = e.target.closest('[data-theme-set]');
  if (set) return setTheme(set.dataset.themeSet);
  if (e.target.closest('[data-theme-cycle]')) {
    const i = THEMES.findIndex(x => x[0] === getTheme());
    setTheme(THEMES[(i + 1) % THEMES.length][0]);
  }
});
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch {}
applyTheme();

const subnav = ({ group, sub }) => group.items ? `<div class="tabs subnav">${group.items.map(([id, label]) =>
  `<a href="#/${group.id}/${id}" class="${id === sub ? 'on' : ''}">${esc(label)}</a>`).join('')}</div>` : '';

let seq = 0;
let lastHtml = '';
async function render(quiet = false) {
  const r = route();
  const my = ++seq;
  if (!quiet) renderNav(r);
  const loading = quiet ? null : setTimeout(() => { if (my === seq) $view.innerHTML = subnav(r) + '<div class="msg">Yükleniyor…</div>'; }, 200);
  needsRefresh = false;
  loginStale = null;
  try {
    const ctx = { after: null };   // görünüm, çizildikten sonra çalışacak işi buraya koyabilir (Ana Sayfa kartları)
    const body = await views[r.key](r, ctx);
    const html = subnav(r) + (loginStale ? `<div class="banner">Oturum kapalı, son kaydedilen veri gösteriliyor. ${loginButton('Giriş yap', loginStale)}</div>` : '') + body;
    clearTimeout(loading);
    if (my !== seq || (quiet && html === lastHtml)) return;
    // Sessiz yenilemede açık bölümler açık kalsın
    const open = [...$view.querySelectorAll('details[open]')].map(d => d.dataset.lazy || d.dataset.mail || d.dataset.keep).filter(Boolean);
    $view.innerHTML = lastHtml = html;
    open.forEach(id => [...$view.querySelectorAll('details[data-lazy], details[data-mail], details[data-keep]')]
      .find(d => (d.dataset.lazy || d.dataset.mail || d.dataset.keep) === id)?.setAttribute('open', ''));
    ctx.after?.();
    if (!quiet) mvScroll();
    if (!quiet) recentAdd(location.hash, $view.querySelector('h1')?.textContent.trim());
    $view.querySelector('.subnav .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    // Sunucu eski veriyi verip arka planda yeniliyorsa, bir kez sessizce tekrar sor.
    if (needsRefresh && !quiet) setTimeout(() => my === seq && render(true), 3000);
  } catch (e) {
    clearTimeout(loading);
    if (my !== seq || quiet) return;
    $view.innerHTML = subnav(r) + `<div class="card msg err">${esc(e.message)}<br>${e.login ? loginButton(`${e.siteName} için giriş yap`, e.login) : '<button id="retry">Tekrar dene</button>'}</div>`;
    document.getElementById('retry')?.addEventListener('click', () => render());
  }
}

const loginButton = (label, site) => `<button class="login" data-login="${esc(site)}">${esc(label)}</button>`;

// Kayıtlı bilgiyle doğrudan girilebilen sitelerde sunucu arka planda girer; diğerlerinde (Ortam, UBS) okulun
// giriş sayfasını ayrı bir pencerede açar. Giriş bitince ekran yenilenir.
const DIRECT_LOGIN = new Set(['webmail', 'uzakydb', 'uzak', 'piazza', 'ubs']);
async function doLogin(btn) {
  btn.disabled = true;
  btn.textContent = DIRECT_LOGIN.has(btn.dataset.login) ? 'Giriş yapılıyor…' : 'Giriş penceresi açıldı; bilgiler dolduruluyor…';
  const r = await post('/api/login?site=' + encodeURIComponent(btn.dataset.login));
  if (r.ok) return render();
  const j = await r.json().catch(() => ({}));
  btn.disabled = false;
  btn.textContent = 'Tekrar dene';
  btn.insertAdjacentHTML('afterend', `<div class="muted">${esc(j.error || 'Giriş tamamlanmadı')}${j.rejected || j.account ? ' <a href="#/hesap">Hesap</a>' : ''}</div>`);
}

// PDF'ler uygulamanın içindeki görüntüleyicide açılır (görüntüleyici ilk kullanımda yüklenir).
async function showPdf(src, title) {
  const { openPdf } = await import('./pdfview.js');
  openPdf(src, title);
}

$view.addEventListener('submit', e => {
  if (e.target.id === 'acct') { e.preventDefault(); submitAccount(e.target); }
  if (e.target.id === 'compose') { e.preventDefault(); sendMail(e.target); }
});
// Posta yazma: yazılanlar taslakta tutulur, seçilen dosyalar hemen yazma oturumuna yüklenir.
$view.addEventListener('input', e => {
  const f = e.target.closest('#compose');
  if (f && draft && e.target.name in draft.values) draft.values[e.target.name] = e.target.value;
});
$view.addEventListener('change', e => {
  if (e.target.matches('#compose input[type=file]')) uploadFiles(e.target);
  if (e.target.matches('[data-u-auto]')) ubsAction(e.target, true);      // UBS: seçince sayfayı yenileyen denetimler
});
$view.addEventListener('click', e => {
  const lb = e.target.closest('[data-login]');
  if (lb) return doLogin(lb);
  if (e.target.closest('[data-forget]')) { lastLogin = null; return post('/api/account/forget').then(() => render()); }
  const pdf = e.target.closest('[data-pdf]');
  if (pdf) return showPdf(pdf.dataset.pdf, pdf.dataset.title);
  // UBS: sayfanın PDF'i, sekmeler, form düğmeleri
  const doc = e.target.closest('[data-ubs-doc]');
  if (doc) return showPdf('/api/file/ubs-doc?path=' + encodeURIComponent(doc.dataset.ubsDoc), doc.dataset.title);
  const utab = e.target.closest('[data-utab]');
  if (utab) { ubsTab[route().param] = utab.dataset.utab; return render(); }
  const ubtn = e.target.closest('button[data-u-submit], button[data-u-target]');
  if (ubtn) return ubsAction(ubtn);
  // Webmail: okundu/okunmadı, sil, geri yükle (satırdaki nokta e-postayı açmadan değiştirir); taslaktaki eki kaldır
  const mact = e.target.closest('[data-mact]');
  if (mact) { e.preventDefault(); return mailAction(mact); }
  const ratt = e.target.closest('[data-ratt] .x');
  if (ratt) return removeDraftFile(ratt.closest('[data-ratt]'));
  // Uzak/Piazza dosyaları ve bağlantıları
  const file = e.target.closest('[data-file]');
  if (file) return showFile(file.dataset.file, file.dataset.title, file.dataset.kind);
  const mfile = e.target.closest('[data-mfile]');
  if (mfile) return showFile(`/api/file/moodle?site=${encodeURIComponent(mfile.dataset.site)}&path=${encodeURIComponent(mfile.dataset.mfile)}`, mfile.textContent.trim());
  const pfile = e.target.closest('[data-pfile]');
  if (pfile) return showFile('/api/file/piazza?path=' + encodeURIComponent(pfile.dataset.pfile), pfile.textContent.trim());
  const ulink = e.target.closest('[data-ulink]');
  if (ulink) return openUzakLink(ulink.dataset.ulink, ulink.dataset.site);
  const mlink = e.target.closest('a[data-mpage]');
  if (mlink) { e.preventDefault(); return openMpage(mlink); }
  const mback = e.target.closest('[data-mback]');
  if (mback) { const box = mback.closest('.lz'); box.innerHTML = mpageHistory.get(box)?.pop() ?? box.innerHTML; return; }
  const tab = e.target.closest('[data-tab]');
  if (tab) { const [k, v] = tab.dataset.tab.split(':'); state[k] = v; render(); }
  const day = e.target.closest('[data-day]');
  if (day) { state.day = Number(day.dataset.day); render(); }
});
$view.addEventListener('toggle', e => {
  if (!e.target.open) return;
  if (e.target.dataset.lazy) openLazy(e.target);
  if (e.target.dataset.mail) openMail(e.target);
}, true);
// ---------- Güncelleme ----------
// Yeni sürüm varsa sağ altta bir kart sorar; "Güncelle"ye basılmadan hiçbir şey indirilmez (görünmez güncelleme yok).
// "Sonra": bu oturumda bir daha sorulmaz (uygulama yeniden açılınca tekrar sorar).
let updateInfo = null;
const plainNotes = s => String(s || '').replace(/\*\*|`/g, '').replace(/^#+\s*/gm, '').trim();
function updateCard(u, { manual = false } = {}) {
  document.getElementById('upd')?.remove();
  if (!u?.newer) { if (manual) toast(u?.error || `En güncel sürümü kullanıyorsun (${u?.current ?? ''}).`); return; }
  try { if (!manual && sessionStorage.getItem('guncellemeSonra') === u.latest) return; } catch {}
  const size = u.size ? ` · ${(u.size / 1048576).toFixed(0)} MB` : '';
  const card = document.createElement('section');
  card.id = 'upd';
  card.className = 'card upd';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Yeni sürüm');
  card.innerHTML = `<div class="upd-h">${icon('download')}<b>Ortam Sade ${esc(u.latest)} yayınlandı</b></div>
    <p class="muted small">Şu an ${esc(u.current)} kullanıyorsun. Güncellemek ister misin?${size}</p>
    ${u.notes ? `<details><summary class="small">Neler yeni?</summary><div class="upd-notes small">${esc(plainNotes(u.notes))}</div></details>` : ''}
    <div class="upd-act"><button type="button" class="btn ghost" data-upd-later>Sonra</button>
      <button type="button" class="btn primary" data-upd-go>Güncelle</button></div>
    <p class="upd-msg small muted" aria-live="polite"></p>`;
  document.body.append(card);
}
async function checkUpdate(manual = false) {
  try { updateInfo = await fetch('/api/update' + (manual ? '?force=1' : '')).then(r => r.json()); } catch { if (manual) toast('Güncelleme denetlenemedi'); return; }
  updateCard(updateInfo, { manual });
}
document.addEventListener('click', async e => {
  if (e.target.closest('[data-upd-check]')) return checkUpdate(true);
  if (e.target.closest('[data-upd-later]')) {
    try { sessionStorage.setItem('guncellemeSonra', updateInfo?.latest || ''); } catch {}
    return document.getElementById('upd')?.remove();
  }
  const go = e.target.closest('[data-upd-go]');
  if (!go) return;
  const card = document.getElementById('upd'), msg = card.querySelector('.upd-msg');
  card.querySelectorAll('button').forEach(b => { b.disabled = true; });
  msg.textContent = 'İndiriliyor ve doğrulanıyor… (bir iki dakika sürebilir)';
  const r = await fetch('/api/update/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok) {
    msg.textContent = j.error || 'Güncelleme yapılamadı.';
    card.querySelectorAll('button').forEach(b => { b.disabled = false; });
    return;
  }
  msg.textContent = `${j.version} kuruldu. Uygulama yeniden başlatılıyor…`;
  // Sunucu yeni sürümle açılınca sayfa yenilenir
  const t0 = Date.now();
  const poll = async () => {
    const u = await fetch('/api/update').then(x => x.json()).catch(() => null);
    if (u?.current === j.version) return location.reload();
    if (Date.now() - t0 > 120_000) { msg.textContent = 'Yeniden başlatma uzun sürdü. "Ortam Sade.cmd" ile uygulamayı yeniden açın.'; return; }
    setTimeout(poll, 1500);
  };
  setTimeout(poll, 2500);
});
setTimeout(() => checkUpdate(false), 3000);

window.addEventListener('hashchange', () => render());
checkLock();
render();
