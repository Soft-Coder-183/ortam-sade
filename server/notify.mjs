// Bildirimler: Piazza'ya ve Uzak'a yeni bir şey eklendiğinde haber verir.
// - Piazza: etkin sınıfların gönderi akışı (sınıf başına tek istek) 30 dakikada bir.
// - Uzak: kayıtlı derslerin sayfasındaki etkinlikler (dosya, ödev, duyuru forumu…) 60 dakikada bir.
// İlk kontrolde mevcut durum yalnızca kaydedilir (eski içerik için bildirim gelmez). Sonra yeni gönderi/etkinlik çıkınca:
// uygulamada kayıt (derslerin üzerinde işaret), Windows bildirimi ve — ayar açıksa — kullanıcının kendi adresine özet e-posta.
// Durum .cache/notify.json'da; sunucu kapalıyken kontrol yapılmaz, açılınca kaldığı yerden devam eder.
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import * as piazza from './piazza.mjs';
import { moodle } from './moodle.mjs';
import { courseKey } from './courses.mjs';
import * as webmail from './webmail.mjs';
import * as credentials from './credentials.mjs';

const FILE = '.cache/notify.json';
const EVERY = { piazza: 30, uzak: 60 };            // dakika (okul sunucularını yormamak için seyrek)
const KEEP = 200;                                  // saklanan en fazla bildirim

let db = { seen: {}, items: [], settings: { toast: true, mail: true }, last: {} };
let loaded = false;
async function load() {
  if (loaded) return;
  try { db = { ...db, ...JSON.parse(await fs.readFile(FILE, 'utf8')) }; } catch {}
  loaded = true;
}
const save = () => fs.writeFile(FILE, JSON.stringify(db)).catch(() => {});

// Kaynaktaki kimlikleri öncekilerle karşılaştırır (görülenler birikir; listeden düşüp geri gelen eski öğe yeni sayılmaz).
// İlk kez görülen kaynakta yalnızca kaydeder.
function diff(key, items) {
  const before = db.seen[key];
  const old = new Set(before ?? []);
  db.seen[key] = [...new Set([...items.map(x => x.id), ...old])].slice(0, 1000);
  return before ? items.filter(x => !old.has(x.id)) : [];
}

async function checkPiazza() {
  const out = [];
  for (const n of (await piazza.classes()).filter(c => c.active)) {
    const f = await piazza.feed(n.id);
    const key = courseKey(n.code) || n.code;
    // Akış "son güncellenen"e göre sıralı: eski gönderiye yorum gelince başa döner. Yeni gönderi = numarası (@nr) en büyük görülenden büyük.
    const maxKey = `piazza-nr:${n.id}`;
    const max = db.seen[maxKey];
    const top = Math.max(0, ...f.posts.map(p => p.nr || 0));
    db.seen[maxKey] = Math.max(max ?? 0, top);
    const fresh = max === undefined ? [] : f.posts.filter(p => p.nr > max).map(p => ({ p }));
    for (const p of fresh) out.push({
      source: 'piazza', course: key, courseName: `${n.code}`, title: `${n.code} · Piazza`,
      text: p.p.subject + (p.p.role ? ` (${p.p.role})` : ''), link: `#/donem/derslerim/${encodeURIComponent(key)}/piazza`,
    });
  }
  return out;
}

async function checkUzak() {
  const out = [];
  const m = moodle('uzak');
  for (const c of await m.courses()) {
    const u = await m.course(c.id);
    const items = u.sections.flatMap(s => s.items).filter(i => i.cmid && i.type !== 'label').map(i => ({ id: i.cmid, i }));
    const code = (c.name.match(/^\[([^\]]+)\]/) || [])[1] || c.short;
    const key = courseKey(c.name) || courseKey(c.short) || code;
    for (const x of diff(`uzak:${c.id}`, items)) out.push({
      source: 'uzak', course: key, courseName: code.replace(/\.\d+$/, ''), title: `${code.replace(/\.\d+$/, '')} · Uzak`,
      text: `${x.i.name} eklendi`, link: `#/donem/derslerim/${encodeURIComponent(key)}/uzak`,
    });
  }
  return out;
}

// ---------- iletim ----------

// Windows bildirimi (PowerShell ile; metin standart girdiden base64 gelir). Tıklayınca uygulamanın ilgili sayfası açılır.
function toast(title, body, link) {
  if (process.platform !== 'win32') return;
  const payload = Buffer.from(JSON.stringify({ title: `Ortam Sade · ${title}`, body, link: `http://localhost:${process.env.PORT || 3000}/${link || ''}` }), 'utf8').toString('base64');
  const script = `
    $d = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())) | ConvertFrom-Json
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $x = New-Object Windows.Data.Xml.Dom.XmlDocument
    $x.LoadXml('<toast activationType="protocol"><visual><binding template="ToastGeneric"><text></text><text></text></binding></visual></toast>')
    $x.DocumentElement.SetAttribute('launch', $d.link)
    $t = $x.GetElementsByTagName('text')
    $t.Item(0).AppendChild($x.CreateTextNode($d.title)) | Out-Null
    $t.Item(1).AppendChild($x.CreateTextNode($d.body)) | Out-Null
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
  const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, () => {});
  child.stdin.end(payload);
}

// Özet e-posta: kullanıcının kendi adresine, okulun Webmail'i üzerinden (bir kontrol turunda tek e-posta).
async function mail(items) {
  const to = credentials.get()?.email;
  if (!to) return;
  const c = await webmail.compose({ mode: 'new' });
  // Konu ve metin, e-postanın okuldan değil Ortam Sade'den geldiğini açıkça söyler.
  const app = `http://localhost:${process.env.PORT || 3000}/`;
  const lines = items.map(n => `• ${n.title}: ${n.text}\n  Aç: ${app}${n.link || ''}`).join('\n');
  const rule = '-'.repeat(40);
  await webmail.send({ id: c.id, from: c.from.find(f => f.selected)?.id ?? c.from[0]?.id, to,
    subject: `[Ortam Sade · Bildirim] ${items.length === 1 ? `${items[0].title}: ${items[0].text}` : `${items.length} yeni içerik`}`.slice(0, 180),
    text: `ORTAM SADE BİLDİRİMİ\n${rule}\n${lines}\n${rule}\n\n` +
      `Bu e-postayı okul değil, bilgisayarınızda çalışan Ortam Sade uygulaması gönderdi: Piazza ya da Uzak'ta yeni içerik ` +
      `görünce kendi okul adresinizden size kısa bir özet yollar. Okulun resmî bir duyurusu değildir.\n` +
      `Kapatmak için: Ortam Sade > Hesap > Bildirimler > e-posta seçeneği.` });
}

// Gönderilemeyen bildirim e-postaları kaybolmaz: giden kutusunda (outbox) bekler, her kontrol turunda ve girişten sonra
// yeniden denenir. 2 günden eski bekleyenler artık haber değeri taşımadığı için atılır.
const OUTBOX_MAX_AGE = 2 * 24 * 3600_000;
let flushing = null;
export function flushMail() {
  flushing ??= (async () => {
    await load();
    db.outbox = (db.outbox ?? []).filter(n => Date.now() - n.t < OUTBOX_MAX_AGE);
    if (!db.settings.mail) db.outbox = [];
    if (!db.outbox.length) return save();
    if (!credentials.get()?.email) { console.error(`bildirim e-postası bekliyor (${db.outbox.length}): kayıtlı hesap yok`); return save(); }
    const items = db.outbox;
    try {
      await mail(items);
      db.outbox = db.outbox.filter(n => !items.includes(n));
      db.lastMail = Date.now();
      console.log(`bildirim e-postası gönderildi (${items.length})`);
    } catch (e) {
      console.error(`bildirim e-postası gönderilemedi, sonra yeniden denenecek (${items.length}):`, e.message);
    }
    await save();
  })().finally(() => { flushing = null; });
  return flushing;
}

async function deliver(found) {
  if (!found.length) return;
  const t = Date.now();
  const items = found.map((n, i) => ({ id: `${t}-${i}`, t, read: false, ...n }));
  db.items = [...items, ...db.items].slice(0, KEEP);
  if (db.settings.mail) db.outbox = [...(db.outbox ?? []), ...items];
  await save();
  if (db.settings.toast) {
    if (items.length <= 3) items.forEach(n => toast(n.title, n.text, n.link));
    else toast(`${items.length} yeni içerik`, [...new Set(items.map(n => n.courseName))].join(', '), '#/donem/derslerim');
  }
}

// ---------- zamanlama ve uç noktalar ----------

async function run(source) {
  await load();
  try {
    const found = source === 'piazza' ? await checkPiazza() : await checkUzak();
    db.last[source] = Date.now();
    await save();
    await deliver(found);
  } catch (e) {
    console.error('bildirim kontrolü', source, e.message);           // oturum kapalı vb.: sonraki turda yeniden
  }
  await flushMail();                                                  // yeni ya da önceden bekleyen e-postalar
}

export async function start() {
  await load();
  for (const source of Object.keys(EVERY)) {
    const ms = EVERY[source] * 60_000;
    // Uygulama sık yeniden başlatılsa da kontrol aralığı korunur
    const wait = Math.max(30_000, (db.last[source] ?? 0) + ms - Date.now());
    setTimeout(() => { run(source); setInterval(() => run(source), ms); }, Math.min(wait, ms));
  }
}

export async function list() {
  await load();
  const unread = db.items.filter(n => !n.read);
  const byCourse = {};
  for (const n of unread) byCourse[n.course] = (byCourse[n.course] ?? 0) + 1;
  return { items: db.items.slice(0, 50), unread: unread.length, byCourse, settings: db.settings, last: db.last,
    outbox: (db.outbox ?? []).length, lastMail: db.lastMail ?? null };
}

// Bir dersin (ya da hepsinin) bildirimlerini okundu yapar.
export async function markRead(course) {
  await load();
  for (const n of db.items) if (!course || n.course === course) n.read = true;
  await save();
  return list();
}

export async function setSettings(s) {
  await load();
  for (const k of ['toast', 'mail']) if (typeof s[k] === 'boolean') db.settings[k] = s[k];
  await save();
  return db.settings;
}

// "Şimdi kontrol et": iki kaynağı hemen kontrol eder (aynı kurallarla; yeni bir şey varsa bildirir).
let checking = null;
export function checkNow() {
  checking ??= (async () => { await run('piazza'); await run('uzak'); return list(); })().finally(() => { checking = null; });
  return checking;
}

// Hesap ekranındaki "deneme bildirimi": yalnızca Windows bildirimi gösterir (e-posta göndermez).
export function testToast() {
  toast('Bildirim denemesi', 'Bildirimler bu bilgisayarda böyle görünecek.', '#/hesap');
  return { ok: true };
}
