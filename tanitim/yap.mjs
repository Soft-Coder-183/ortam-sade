// Tanıtım videosunu üretir: seslendirme (edge-tts) → sahne kayıtları (görünmez Chrome, sahte veri) → birleştirme (ffmpeg).
// Kullanım (proje kökünde):
//   node tanitim/yap.mjs                 hepsi; çıktı dist/tanitim/OrtamSade-tanitim.mp4
//   node tanitim/yap.mjs ses             yalnızca seslendirme dosyaları
//   node tanitim/yap.mjs kayit [sahne…]  yalnızca kayıt (ad verilirse o sahneler, ör. 04-dersler)
//   node tanitim/yap.mjs birlestir       var olan kayıtlardan videoyu yeniden kur
// Gerekenler: Google Chrome, ffmpeg, uv (uvx edge-tts). Ayrıntı: PROJE_DEVIR.md → Tanıtım videosu
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { Kayit, sunucuAc, KOK, TABAN, PENCERE, TAM, FPS, bekle } from './kayit.mjs';
import { SAHNELER } from './sahneler.mjs';

const CIKTI = path.join(KOK, 'dist', 'tanitim');
const D = { ses: path.join(CIKTI, 'ses'), sahne: path.join(CIKTI, 'sahne'), norm: path.join(CIKTI, 'norm'), foto: path.join(CIKTI, 'foto') };
for (const d of Object.values(D)) fs.mkdirSync(d, { recursive: true });
const SES = { ad: process.env.TANITIM_SES || 'tr-TR-AhmetNeural', hiz: process.env.TANITIM_HIZ || '+8%' };
const MUZIK = { dosya: path.join(CIKTI, 'muzik.mp3'), url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/EDM%20Detection%20Mode.mp3',
  kunye: '"EDM Detection Mode" — Kevin MacLeod (incompetech.com), CC BY 4.0' };
const ff = (...a) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status) throw new Error('ffmpeg başarısız: ' + a.slice(-1)); };
const sureOf = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const uvx = () => { for (const c of ['uvx', path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe/uvx.exe')]) {
  if (!spawnSync(c, ['--version'], { stdio: 'ignore' }).status) return c; } throw new Error('uvx bulunamadı: winget install astral-sh.uv'); };
const sesDosyasi = a => path.join(D.ses, crypto.createHash('sha1').update(`${SES.ad}|${SES.hiz}|${a.oku || a.s}`).digest('hex').slice(0, 16) + '.mp3');

// ---------- 1) seslendirme ----------
function sesler() {
  const u = uvx();
  let yeni = 0;
  for (const s of SAHNELER) for (const a of s.adimlar) {
    if (!a.s) continue;
    const f = sesDosyasi(a);
    if (fs.existsSync(f) && fs.statSync(f).size > 2000) continue;
    for (let dene = 1; ; dene++) {
      const r = spawnSync(u, ['edge-tts', '--voice', SES.ad, `--rate=${SES.hiz}`, '--text', a.oku || a.s, '--write-media', f], { stdio: ['ignore', 'ignore', 'pipe'] });
      if (!r.status && fs.existsSync(f) && fs.statSync(f).size > 2000) break;
      if (dene >= 4) throw new Error('Seslendirme alınamadı: ' + a.s.slice(0, 40) + '\n' + r.stderr);
    }
    yeni++;
  }
  const toplam = SAHNELER.flatMap(s => s.adimlar).filter(a => a.s).reduce((t, a) => t + sureOf(sesDosyasi(a)), 0);
  console.log(`seslendirme: ${yeni} yeni dosya, toplam konuşma ${toplam.toFixed(1)} sn (${SES.ad} ${SES.hiz})`);
}

// ---------- 2) kayıt ----------
async function isit() {          // herkese açık sayfalar ilk istekte yavaş olabilir: kayıttan önce bir kez istenir
  const al = n => fetch(`${TABAN}/api/${n}`, { signal: AbortSignal.timeout(120_000) }).then(r => r.status).catch(e => e.name);
  const ad = ['program', 'etu-takvim', 'etu-fakulteler', 'etu-kadro', 'mevzuat-yanitlar', 'mevzuat', 'mevzuat-ara?q=dersten', 'mevzuat-duyurular', 'hatirlatmalar', 'rezervasyon?kind=kutuphane&date='];
  console.log('ısıtma:', (await Promise.all(ad.map(al))).map((s, i) => `${ad[i].split('?')[0]}=${s}`).join(' '));
}
async function sahneKaydet(s) {
  const kart = s.tur === 'kart';
  const k = await Kayit.ac({ boyut: kart ? TAM : PENCERE, cikti: path.join(D.sahne, s.ad + '.mp4'), durum: s.durum ?? {} });
  k.fotoKlasor = D.foto;
  k.sabit = kart;
  if (kart) await k.git(`${TABAN}/tn/kartlar.html#${s.kart}?muzik=${encodeURIComponent(MUZIK.kunye)}`);
  await s.hazirla?.(k);
  await bekle(kart ? 300 : 700);
  await k.basla();
  await bekle(kart ? 150 : 400);
  const vurus = [];
  for (const [i, a] of s.adimlar.entries()) {
    const t = k.t();
    const sure = a.s ? sureOf(sesDosyasi(a)) : 0;
    if (a.s) vurus.push({ t, dosya: sesDosyasi(a), sure, metin: a.s });
    await a.is?.(k);
    const gec = k.t() - t - sure;
    while (k.t() < t + sure + (a.ara ?? 0.3)) await bekle(25);
    if (a.sonra) await bekle(a.sonra);
    await k.foto(`${s.ad}-${i + 1}`);
    console.log(`  ${s.ad} #${i + 1}: konuşma ${sure.toFixed(1)} sn, hareket ${(gec + sure).toFixed(1)} sn${gec > 1.2 ? '  (hareket uzun: +' + gec.toFixed(1) + ')' : ''}`);
  }
  await bekle(kart ? 500 : 250);
  const r = await k.bitir();
  fs.writeFileSync(path.join(D.sahne, s.ad + '.json'), JSON.stringify({ ad: s.ad, kart, sure: r.sure, vurus }, null, 1));
  console.log(`${s.ad}: ${r.sure.toFixed(1)} sn, ${r.gelen} kare geldi${r.hatalar.length ? '  SAYFA HATASI: ' + r.hatalar.join(' | ') : ''}`);
}
async function kayit(adlar) {
  const liste = adlar.length ? SAHNELER.filter(s => adlar.some(a => s.ad.startsWith(a))) : SAHNELER;
  await ornekPdfler();
  const kapat = await sunucuAc();
  try {
    await isit();
    for (const s of liste) await sahneKaydet(s);
  } finally { kapat(); }
}
async function ornekPdfler() {     // uygulamanın PDF görüntüleyicisinde açılan örnek belgeler: ders notu ve e-posta eki
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage();
  const sinavlar = [['19 Kasım Perşembe', '18:30–20:00', 'MAT 202', 'Diferansiyel Denklemler'], ['21 Kasım Cumartesi', '10:00–11:30', 'BİL 212', 'Veri Yapıları'], ['24 Kasım Salı', '13:00–14:30', 'BİL 245', 'Doğrusal Cebir ve Uygulamaları'],
    ['26 Kasım Perşembe', '18:30–20:30', 'BİL 214', 'Sistem Programlama'], ['28 Kasım Cumartesi', '10:00–12:00', 'BİL 265', 'Mantık Devresi Tasarımı ve Uygulamaları']];
  await p.setContent(`<body style="font:16px 'Segoe UI';margin:44px;color:#1c2230"><h1 style="color:#1b449c;margin-bottom:4px">2026-2027 Güz · Ara Sınav Programı</h1>
    <p style="color:#5d6470">Bu belge tanıtım videosu için üretilmiş örnek bir sınav programıdır.</p>
    <table style="border-collapse:collapse;width:100%;margin-top:18px">${[['Tarih', 'Saat', 'Kod', 'Ders'], ...sinavlar].map((r, i) => `<tr>${r.map(x => `<t${i ? 'd' : 'h'} style="text-align:left;padding:11px 12px;border-bottom:1px solid #d9dde5;${i ? '' : 'background:#eef2fb;color:#1b449c'}">${x}</t${i ? 'd' : 'h'}>`).join('')}</tr>`).join('')}</table>
    <p style="margin-top:22px">Sınav derslikleri sınavdan bir gün önce duyurulur.</p></body>`);
  await p.pdf({ path: path.join(CIKTI, 'sinav.pdf'), format: 'A4' });
  const f = path.join(CIKTI, 'ornek.pdf');
  await p.setContent(`<body style="font:16px 'Segoe UI';margin:44px;color:#1c2230"><h1 style="color:#1b449c;margin-bottom:4px">BİL 214 · Sistem Programlama</h1>
    <h2 style="margin-top:0;color:#5d6470;font-weight:500">Hafta 8: Borular ve süreçler arası iletişim</h2>
    <p>Bu belge tanıtım videosu için üretilmiş örnek bir ders notudur.</p><ul><li>pipe() ve dup2()</li><li>Adlandırılmış borular (FIFO)</li><li>Üretici–tüketici örneği</li></ul>
    <pre style="background:#f4f5f7;padding:18px;border-radius:10px;font-size:15px">int fd[2];\npipe(fd);\nif (fork() == 0) {\n  dup2(fd[1], STDOUT_FILENO);\n  execlp("ls", "ls", NULL);\n}</pre>
    <h2>Alıştırmalar</h2><ol><li>İki komutu boruyla bağlayan bir kabuk yazın.</li><li>Borunun kapatılmayan ucu neye yol açar?</li><li>FIFO ile iki süreci haberleştirin.</li></ol>
    <div style="page-break-before:always"></div><h2>Ek okuma</h2><p>pipe(2), dup(2), mkfifo(3) kılavuz sayfaları.</p></body>`);
  await p.pdf({ path: f, format: 'A4' });
  await b.close();
}

// ---------- 3) birleştirme ----------
const srtZaman = t => { const ms = Math.round(t * 1000), p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
function altyaziParcalari(metin, bas, sure) {     // uzun cümle ~70 karakterlik parçalara bölünür, süre harf sayısına göre paylaştırılır
  const soz = metin.split(/\s+/), parca = [];
  let s = '';
  for (const w of soz) { if (s && (s + ' ' + w).length > 72) { parca.push(s); s = w; } else s = s ? s + ' ' + w : w; }
  if (s) parca.push(s);
  const top = parca.reduce((a, x) => a + x.length, 0);
  let t = bas;
  return parca.map(x => { const d = sure * x.length / top, o = { bas: t, son: t + d, metin: x }; t += d; return o; });
}
async function birlestir() {
  // pencere başlık çubuğu (1920×32)
  const baslik = path.join(CIKTI, 'baslik.png');
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1920, height: 32 } });
  await p.goto('file:///' + path.join(KOK, 'tanitim', 'kartlar.html').replace(/\\/g, '/') + '#baslik');
  await p.screenshot({ path: baslik });
  await b.close();

  const sahneler = SAHNELER.map(s => JSON.parse(fs.readFileSync(path.join(D.sahne, s.ad + '.json'), 'utf8')));
  let t = 0;
  const vuruslar = [], liste = [];
  for (const s of sahneler) {
    const giris = path.join(D.sahne, s.ad + '.mp4'), cikis = path.join(D.norm, s.ad + '.mp4');
    const sure = sureOf(giris);
    const kodla = ['-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', '-an', cikis];
    if (s.kart) ff('-i', giris, '-vf', `fade=t=in:st=0:d=0.35,fade=t=out:st=${(sure - 0.35).toFixed(2)}:d=0.35`, ...kodla);
    else ff('-loop', '1', '-framerate', String(FPS), '-i', baslik, '-i', giris, '-filter_complex', `[0:v][1:v]vstack=inputs=2:shortest=1,fade=t=in:st=0:d=0.2[v]`, '-map', '[v]', ...kodla);
    const gercek = sureOf(cikis);
    for (const v of s.vurus) vuruslar.push({ ...v, t: t + v.t });
    liste.push(`file '${cikis.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    t += gercek;
  }
  const toplam = t;
  const listeDosyasi = path.join(CIKTI, 'liste.txt');
  fs.writeFileSync(listeDosyasi, liste.join('\n'));
  const goruntu = path.join(CIKTI, 'goruntu.mp4');
  ff('-f', 'concat', '-safe', '0', '-i', listeDosyasi, '-c', 'copy', goruntu);

  // altyazı
  const srt = path.join(CIKTI, 'OrtamSade-tanitim.srt');
  fs.writeFileSync(srt, vuruslar.flatMap(v => altyaziParcalari(v.metin, v.t + 0.05, v.sure - 0.1)).map((x, i) => `${i + 1}\n${srtZaman(x.bas)} --> ${srtZaman(x.son)}\n${x.metin}\n`).join('\n'), 'utf8');

  // ses: seslendirme parçaları yerlerine konur; müzik konuşma sırasında kısılır
  if (!fs.existsSync(MUZIK.dosya)) fs.writeFileSync(MUZIK.dosya, Buffer.from(await (await fetch(MUZIK.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).arrayBuffer()));
  const girdiler = vuruslar.flatMap(v => ['-i', v.dosya]);
  const n = vuruslar.length;
  const sure = toplam.toFixed(2);
  const f = vuruslar.map((v, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(v.t * 1000)}:all=1[v${i}]`).join(';') +
    `;${vuruslar.map((_, i) => `[v${i}]`).join('')}amix=inputs=${n}:normalize=0:dropout_transition=0,volume=1.9,alimiter=limit=0.95,apad,atrim=0:${sure},asplit=2[kon][anahtar]` +
    `;[${n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${sure},volume=0.34,afade=t=in:st=0:d=1.2,afade=t=out:st=${(toplam - 3).toFixed(2)}:d=3[muz]` +
    `;[muz][anahtar]sidechaincompress=threshold=0.02:ratio=9:attack=30:release=600[kisik]` +
    `;[kisik][kon]amix=inputs=2:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
  const ses = path.join(CIKTI, 'ses.m4a');
  ff(...girdiler, '-stream_loop', '-1', '-i', MUZIK.dosya, '-filter_complex', f, '-map', '[a]', '-t', sure, '-c:a', 'aac', '-b:a', '192k', ses);

  const son = path.join(CIKTI, 'OrtamSade-tanitim.mp4');
  ff('-i', goruntu, '-i', ses, '-i', srt, '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=tur', '-metadata', 'title=Ortam Sade tanıtım', '-metadata', `comment=Müzik: ${MUZIK.kunye}`, '-movflags', '+faststart', son);      // -shortest yok: altyazı akışı son cümlede biter, videoyu erken keserdi
  console.log(`\nHazır: ${son}\n  süre ${Math.floor(toplam / 60)} dk ${Math.round(toplam % 60)} sn · ${(fs.statSync(son).size / 1048576).toFixed(1)} MB · ${n} seslendirme parçası\n  altyazı: ${srt}\n  müzik: ${MUZIK.kunye}`);
}

const [is, ...adlar] = process.argv.slice(2);
if (!is || is === 'ses') sesler();
if (!is || is === 'kayit') { if (is) sesler(); await kayit(adlar); }
if (!is || is === 'birlestir') await birlestir();
