// Tanıtım videosu kayıt düzeneği: depodaki uygulamayı 3100'de açar, görünmez Chrome'da sahte veriyle (veri.mjs) gezer ve
// ekranı kare kare ffmpeg'e aktarır. Gerçek okul hesabı kullanılmaz; kişisel uçların hepsi sahte yanıt döner.
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yanitla, yeniDurum, SIMDI } from './veri.mjs';

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = 3100;
export const TABAN = `http://localhost:${PORT}`;
export const FPS = 30;
export const bekle = ms => new Promise(r => setTimeout(r, ms));

// Uygulama penceresi: 1440×786 CSS pikseli, 4/3 ölçekle 1920×1048; üstüne 32 piksellik başlık çubuğu eklenince 1920×1080.
export const PENCERE = { w: 1440, h: 786, olcek: 4 / 3 };
// Tam ekran kartlar (açılış, kapanış, ara başlıklar): 1920×1080, ölçeksiz.
export const TAM = { w: 1920, h: 1080, olcek: 1 };

export async function sunucuAc() {
  const ayakta = async () => { try { return (await fetch(TABAN + '/api/lock')).ok; } catch { return false; } };
  if (await ayakta()) throw new Error(`${PORT} portu dolu; önce onu kapat.`);
  const srv = spawn(process.execPath, ['server/server.mjs'], { cwd: KOK, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; !(await ayakta()); i++) { if (i > 80) throw new Error('sunucu açılmadı'); await bekle(250); }
  return () => { try { execFileSync('taskkill', ['/PID', String(srv.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} };
}

// Sayfaya eklenen betik: saat sabitlenir (veri.mjs'teki SIMDI), imleç ve tıklama halkası çizilir.
const SAYFA_BETIGI = `(() => {
  const fark = ${SIMDI} - Date.now();
  const Asil = Date;
  class Sahte extends Asil { constructor(...a) { if (a.length) super(...a); else super(Asil.now() + fark); } static now() { return Asil.now() + fark; } }
  window.Date = Sahte;
  if (window.top !== window) return;
  const kur = () => {
    if (document.getElementById('tn-imlec')) return;
    const st = document.createElement('style');
    st.textContent = '#tn-imlec{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:26px;height:26px;transform:translate(-60px,-60px);will-change:transform;filter:drop-shadow(0 2px 3px rgb(0 0 0/.35))}' +
      '.tn-halka{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f08921;background:rgb(240 137 33/.25);animation:tn-h .55s ease-out forwards}' +
      '@keyframes tn-h{from{transform:scale(.25);opacity:1}to{transform:scale(1.35);opacity:0}}' +
      '.tn-vurgu{outline:3px solid #f08921!important;outline-offset:4px!important;border-radius:10px;transition:outline-color .2s}' +
      'html{scroll-behavior:auto!important}::-webkit-scrollbar{width:0;height:0}';
    document.documentElement.append(st);
    const c = document.createElement('div');
    c.id = 'tn-imlec';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5v17l4.6-4.3 3 6.6 2.9-1.3-3-6.5h6.3z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.append(c);
  };
  if (document.documentElement) kur();
  document.addEventListener('DOMContentLoaded', kur);
  window.__tn = {
    git(x, y, ms) { kur(); const c = document.getElementById('tn-imlec'); c.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,.05,.2,1)'; c.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 2) + 'px)'; },
    halka(x, y) { const h = document.createElement('div'); h.className = 'tn-halka'; h.style.left = x + 'px'; h.style.top = y + 'px'; document.documentElement.append(h); setTimeout(() => h.remove(), 700); },
    kaydir(el, dy, ms) { return new Promise(ok => { const s = el || document.scrollingElement; const a = s.scrollTop, t0 = performance.now();
      const adim = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; s.scrollTop = a + dy * e; k < 1 ? requestAnimationFrame(adim) : ok(); };
      requestAnimationFrame(adim); }); },
  };
})();`;

export class Kayit {
  static async ac({ boyut = PENCERE, tema = 'light', cikti, durum = {} }) {
    const k = new Kayit();
    k.boyut = boyut;
    k.cikti = cikti;
    k.tarayici = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'] });
    k.baglam = await k.tarayici.newContext({ viewport: { width: boyut.w, height: boyut.h }, deviceScaleFactor: boyut.olcek, locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul', colorScheme: tema });
    await k.baglam.addInitScript(SAYFA_BETIGI);
    k.durum = yeniDurum(durum);                              // sahte sunucunun durumu (giriş yapıldı mı vb.)
    await k.baglam.route('**/api/**', route => yanitla(route, k.durum));
    await k.baglam.route('**/tn/**', route => {             // kartlar ve yardımcı dosyalar tanitim/ klasöründen
      const f = path.join(KOK, 'tanitim', decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/tn\//, '')));
      const tur = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream';
      return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: tur, body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: 'yok' });
    });
    k.sayfa = await k.baglam.newPage();
    k.hatalar = [];
    k.sayfa.on('pageerror', e => k.hatalar.push(e.message));
    k.cdp = await k.baglam.newCDPSession(k.sayfa);
    k.imlecXY = { x: boyut.w / 2, y: boyut.h / 2 };
    return k;
  }

  // ---- kayıt ----
  async basla() {
    const W = Math.round(this.boyut.w * this.boyut.olcek), H = Math.round(this.boyut.h * this.boyut.olcek);
    fs.mkdirSync(path.dirname(this.cikti), { recursive: true });
    this.ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-r', String(FPS), this.cikti], { stdio: ['pipe', 'ignore', 'inherit'] });
    this.ffBitti = new Promise(ok => this.ff.on('close', ok));
    this.son = null; this.yazilan = 0; this.gelen = 0;
    this.cdp.on('Page.screencastFrame', f => {
      this.son = Buffer.from(f.data, 'base64'); this.gelen++;
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 96, everyNthFrame: 1 });
    for (let i = 0; !this.son && i < 100; i++) await bekle(20);
    this.t0 = performance.now();
    this.zamanlayici = setInterval(() => {
      const hedef = Math.floor((performance.now() - this.t0) * FPS / 1000);
      while (this.yazilan < hedef && this.son) { this.ff.stdin.write(this.son); this.yazilan++; }
    }, 8);
  }
  t() { return (performance.now() - this.t0) / 1000; }
  async bitir() {
    clearInterval(this.zamanlayici);
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    this.ff.stdin.end();
    await this.ffBitti;
    const sure = this.yazilan / FPS;
    await this.tarayici.close();
    return { sure, kare: this.yazilan, gelen: this.gelen, hatalar: this.hatalar };
  }

  // ---- hareketler ----
  async git(adres, { bekle: sec } = {}) {
    await this.sayfa.goto(adres.startsWith('http') ? adres : TABAN + '/' + adres);
    if (sec) await this.sayfa.waitForSelector(sec);
  }
  async hash(h, sec, ms = 350) {
    await this.sayfa.evaluate(x => { location.hash = x; }, h);
    if (sec) await this.sayfa.waitForSelector(sec, { timeout: 15000 });
    await bekle(ms);
  }
  async imlec(x, y, ms) {
    const d = Math.hypot(x - this.imlecXY.x, y - this.imlecXY.y);
    ms ??= Math.round(Math.min(900, 260 + d * 0.75));
    await this.sayfa.evaluate(([a, b, c]) => window.__tn.git(a, b, c), [x, y, ms]);
    await bekle(ms + 40);
    await this.sayfa.mouse.move(x, y);
    this.imlecXY = { x, y };
  }
  bul(sec) { return typeof sec === 'string' ? this.sayfa.locator(sec).first() : sec; }
  // Öğe görünür alanda değilse yumuşak kaydırılır; kutusu (görünüm koordinatlarında) döner.
  async kutu(sec, { ust = 150, alt = 110, oran = 0.42 } = {}) {
    const el = this.bul(sec);
    await el.waitFor({ state: 'visible', timeout: 15000 });
    let b = await el.boundingBox();
    const orta = b.y + b.height / 2;
    if (!this.sabit && (orta < ust || orta > this.boyut.h - alt)) {       // kartlarda (sabit) sayfa kaydırılmaz
      await this.kaydir(orta - this.boyut.h * oran, 700);
      b = await el.boundingBox();
    }
    return b;
  }
  async uzerine(sec, { dx = 0.5, dy = 0.5, ms } = {}) {
    const b = await this.kutu(sec);
    const x = b.x + b.width * dx, y = b.y + b.height * dy;
    await this.imlec(x, y, ms);
    return { x, y };
  }
  async tikla(sec, { sonra = 450, ...o } = {}) {
    const { x, y } = await this.uzerine(sec, o);
    await bekle(120);
    await this.sayfa.evaluate(([a, b]) => window.__tn.halka(a, b), [x, y]);
    await this.sayfa.mouse.click(x, y);
    await bekle(sonra);
  }
  async yaz(sec, metin, { hiz = 70, sonra = 300 } = {}) {
    await this.tikla(sec, { sonra: 150 });
    await this.sayfa.keyboard.type(metin, { delay: hiz });
    await bekle(sonra);
  }
  async tus(t, sonra = 300) { await this.sayfa.keyboard.press(t); await bekle(sonra); }
  async kaydir(dy, ms = 900, sec = null) {
    await this.sayfa.evaluate(([s, a, b]) => window.__tn.kaydir(s ? document.querySelector(s) : null, a, b), [sec, dy, ms]);
    await bekle(120);
  }
  async basa(ms = 600) { const y = await this.sayfa.evaluate(() => document.scrollingElement.scrollTop); if (y > 0) await this.kaydir(-y, ms); }
  async vurgula(sec, ms = 1400) {
    const el = this.bul(sec);
    await this.kutu(el);
    await el.evaluate(e => e.classList.add('tn-vurgu'));
    await bekle(ms);
    await el.evaluate(e => e.classList.remove('tn-vurgu')).catch(() => {});
  }
  adim(n) { return this.sayfa.evaluate(x => window.adim(x), n); }
  async foto(ad) { if (!this.fotoKlasor) return; fs.mkdirSync(this.fotoKlasor, { recursive: true }); await this.sayfa.screenshot({ path: path.join(this.fotoKlasor, ad + '.jpg'), type: 'jpeg', quality: 70 }).catch(() => {}); }
  async sec(secici, deger, sonra = 500) {            // <select>: imleç üzerine gider, değer seçilir
    await this.uzerine(secici);
    await this.sayfa.evaluate(([a, b]) => window.__tn.halka(a, b), [this.imlecXY.x, this.imlecXY.y]);
    await this.bul(secici).selectOption(deger);
    await bekle(sonra);
  }
}
