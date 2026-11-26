// Dış sitelere giden isteklerin ortak kuralları: uygulamanın kendini tanıtması ve hata freni.
//
// Kimlik (User-Agent): Chrome'un tarayıcı dizgesi korunur (okulun siteleri sayfayı tarayıcıya göre biçimliyor; ör. ASP.NET
// tanımadığı istemciye eksik sayfa verebilir), sonuna uygulamanın adı, sürümü ve depo adresi eklenir. Böylece okulun sistem
// yöneticisi isteklerin ETÜ Ortam / ETÜ Cep'ten geldiğini ve kodun nerede olduğunu görebilir.
//
// Fren (siteye göre): üst üste ikinci hatadan (ağ hatası, 5xx, 429) sonra o siteye bir süre istek gönderilmez; süre her yeni
// hatada ikiye katlanır (15 sn, 30 sn, 1 dk … en çok 30 dk), ilk başarılı yanıtta sıfırlanır. Ayrıca bir siteye dakikada
// 120'den çok istek gönderilmez: bir hata döngüye girse de okulun sunucusu sürekli istek almaz.
import { current } from './update.mjs';

const BRAND = globalThis.Native ? 'EtuCep' : 'OrtamSade';
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 ' +
  `${BRAND}/${current} (+https://github.com/Soft-Coder-183/ortam-sade)`;

const BASE_WAIT = 15_000, MAX_WAIT = 30 * 60_000;
const PER_MINUTE = 120;
const hosts = new Map();            // host -> { fails, until, times: [] }

export class Braked extends Error {
  constructor(host, ms, why = 'şu an yanıt vermiyor') {
    super(`${host} ${why}; uygulama ${Math.ceil(ms / 1000)} sn sonra yeniden deneyecek.`);
    this.braked = true;
  }
}

const stateOf = host => { let s = hosts.get(host); if (!s) hosts.set(host, s = { fails: 0, until: 0, times: [] }); return s; };

// İstekten önce: fren açıksa ya da dakikalık sınır dolduysa istek gönderilmez.
export function before(host, now = Date.now()) {
  const s = stateOf(host);
  if (s.until > now) throw new Braked(host, s.until - now);
  s.times = s.times.filter(t => now - t < 60_000);
  if (s.times.length >= PER_MINUTE) throw new Braked(host, 60_000 - (now - s.times[0]), 'için son bir dakikada çok fazla istek gönderildi');
  s.times.push(now);
}

// Yanıttan sonra: ok=false ise hata sayılır.
export function after(host, ok, now = Date.now()) {
  const s = stateOf(host);
  if (ok) { s.fails = 0; s.until = 0; return; }
  s.fails++;
  if (s.fails >= 2) {
    const wait = Math.min(MAX_WAIT, BASE_WAIT * 2 ** (s.fails - 2));
    s.until = now + wait;
    console.error(`${host}: üst üste ${s.fails}. hata, ${Math.round(wait / 1000)} sn ara verildi`);
  }
}

const bad = status => status >= 500 || status === 429;

// fetch + fren + kimlik. Başlıklardaki User-Agent'ı (verilmemişse) UA yapar.
export async function guardedFetch(url, opts = {}) {
  const host = new URL(url).host;
  before(host);
  try {
    const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...opts.headers } });
    after(host, !bad(res.status));
    return res;
  } catch (e) {
    after(host, false);
    throw e;
  }
}

