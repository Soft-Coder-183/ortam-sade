// PDF görüntüleyici: pdf.js ile sayfaları tuvale çizer, üstüne seçilebilir metin katmanı koyar (kopyalama ve
// tarayıcının Ctrl+F araması çalışır). Tarayıcının kendi PDF eklentisine bağlı değildir; telefonda ve APK'nın
// WebView'inde de çalışır. Sayfalar ekrana yaklaştıkça çizilir, uzaklaşan sayfalar bellekten atılır (uzun ders notları için).
const BASE = '/vendor/pdfjs/';
let lib = null;
async function pdfjs() {
  if (!lib) {
    lib = await import(BASE + 'legacy/build/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = BASE + 'legacy/build/pdf.worker.min.mjs';
  }
  return lib;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];   // genişliğe sığdırmaya göre
const FIT = 2;
const MAX_FIT = 1000;                            // geniş ekranda sayfa bundan geniş açılmaz (okunabilirlik)
const KEEP = 12;                                 // aynı anda çizili tutulan en çok sayfa

let cur = null;              // { el, pages, task, doc, blobUrl, zoom, observer, drawn: Map<n, renderTask|null>, width }
let ignorePop = false;       // kendi history.back() çağrımızın popstate'i

// Sunucudaki dosyayı (/api/file/…) indirip görüntüler.
export async function openPdf(src, title) {
  const reopen = !!cur;
  teardown();
  const el = document.createElement('div');
  el.id = 'pdfv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title || 'PDF');
  el.innerHTML = `<div class="pv-bar">
      <b class="pv-title" title="${esc(title)}">${esc(title || 'PDF')}</b>
      <span class="pv-nav"><input class="pv-num" type="number" min="1" value="1" disabled aria-label="Sayfa numarası"><span class="pv-total">/ –</span></span>
      <span class="pv-tools"><button data-pv="out" title="Uzaklaştır" disabled>−</button><button data-pv="fit" class="pv-fit" title="Genişliğe sığdır" disabled>↔</button><button data-pv="in" title="Yakınlaştır" disabled>+</button>
      <a class="pv-dl" aria-disabled="true">İndir</a><button data-pv="close" title="Kapat (Esc)" aria-label="Kapat">✕</button></span></div>
    <div class="pv-pages" tabindex="-1"><div class="msg">PDF hazırlanıyor…</div></div>`;
  document.body.append(el);
  document.body.classList.add('pv-open');
  const pages = el.querySelector('.pv-pages');
  const me = cur = { el, pages, task: null, doc: null, blobUrl: null, zoom: FIT, observer: null, drawn: new Map(), width: 0 };
  // Telefonda geri hareketi görüntüleyiciyi kapatsın: geçmişe bir kayıt eklenir (açıkken yeni PDF açılırsa ikincisi eklenmez).
  if (!(reopen && history.state?.pdfv)) history.pushState({ pdfv: true }, '');
  pages.focus({ preventScroll: true });
  pages.addEventListener('scroll', () => trackPage(me), { passive: true });
  try {
    const res = await fetch(src);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (cur === me) pages.innerHTML = `<div class="msg err">${esc(j.error || 'PDF alınamadı')}</div>`;
      return;
    }
    const name = decodeURIComponent(res.headers.get('X-File-Name') || '') || `${title || 'belge'}.pdf`;
    const buf = await res.arrayBuffer();
    if (cur !== me) return;
    me.blobUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
    const dl = el.querySelector('.pv-dl');
    dl.href = me.blobUrl;
    dl.download = name;
    dl.removeAttribute('aria-disabled');
    const { getDocument } = await pdfjs();
    if (cur !== me) return;
    me.task = getDocument({ data: new Uint8Array(buf), cMapUrl: BASE + 'cmaps/', cMapPacked: true,
      standardFontDataUrl: BASE + 'standard_fonts/', wasmUrl: BASE + 'wasm/', iccUrl: BASE + 'iccs/' });
    me.doc = await me.task.promise;
    if (cur !== me) return;
    const first = (await me.doc.getPage(1)).getViewport({ scale: 1 });
    if (cur !== me) return;
    me.ratio = first.height / first.width;
    const num = el.querySelector('.pv-num');
    num.max = me.doc.numPages;
    num.disabled = false;
    el.querySelector('.pv-total').textContent = `/ ${me.doc.numPages}`;
    el.querySelectorAll('[data-pv]').forEach(b => { b.disabled = false; });
    layout(me);
  } catch (e) {
    if (cur === me) pages.innerHTML = `<div class="msg err">PDF açılamadı: ${esc(e.message)}</div>`;
  }
}

// Sayfa yer tutucularını oluşturur; ekrana yaklaşan sayfa çizilir. Yakınlaştırmada baştan kurulur, okunan yer korunur.
function layout(me, keep = null) {
  const { pages } = me;
  me.observer?.disconnect();
  cancelAll(me);
  const fit = Math.max(200, Math.min(pages.clientWidth - 24, MAX_FIT));
  const width = me.width = Math.round(fit * ZOOMS[me.zoom]);
  pages.innerHTML = Array.from({ length: me.doc.numPages }, (_, i) =>
    `<div class="pv-page" data-n="${i + 1}" style="width:${width}px;height:${Math.round(width * me.ratio)}px"></div>`).join('');
  me.observer = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting && !me.drawn.has(Number(e.target.dataset.n))) draw(me, e.target);
  }, { root: pages, rootMargin: '100% 0px' });
  pages.querySelectorAll('.pv-page').forEach(p => me.observer.observe(p));
  if (keep) {
    const box = pages.children[keep.n - 1];
    if (box) pages.scrollTop = box.offsetTop - 12 + keep.frac * box.offsetHeight;
  }
  trackPage(me);
}

async function draw(me, box) {
  const n = Number(box.dataset.n);
  me.drawn.set(n, null);
  try {
    const page = await me.doc.getPage(n);
    if (cur !== me || box.dataset.w !== undefined && Number(box.dataset.w) === me.width) return;
    const base = page.getViewport({ scale: 1 });
    const scale = me.width / base.width;                       // CSS pikseli başına ölçek
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const vp = page.getViewport({ scale: scale * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    box.style.height = `${Math.round(vp.height / dpr)}px`;
    const task = page.render({ canvas, viewport: vp });
    me.drawn.set(n, task);
    await task.promise;
    if (cur !== me || !me.drawn.has(n)) return;
    // Seçilebilir metin katmanı (görünmez metin; seçme, kopyalama ve Ctrl+F için)
    const text = document.createElement('div');
    text.className = 'textLayer';
    box.style.setProperty('--total-scale-factor', String(scale));
    box.replaceChildren(canvas, text);
    box.dataset.w = me.width;
    me.drawn.set(n, null);
    evict(me, n);
    await new lib.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: page.getViewport({ scale }) }).render();
  } catch (e) {
    if (cur === me && e?.name !== 'RenderingCancelledException') box.textContent = 'Sayfa çizilemedi';
  }
}

// En çok KEEP sayfa çizili kalır; yeni çizilene en uzak olanlar boşaltılır ve yeniden izlenir.
function evict(me, near) {
  if (me.drawn.size <= KEEP) return;
  const far = [...me.drawn.keys()].sort((a, b) => Math.abs(b - near) - Math.abs(a - near)).slice(0, me.drawn.size - KEEP);
  for (const n of far) {
    me.drawn.get(n)?.cancel();
    me.drawn.delete(n);
    const box = me.pages.children[n - 1];
    if (!box) continue;
    box.replaceChildren();
    delete box.dataset.w;
    me.observer.unobserve(box);
    me.observer.observe(box);
  }
}

function cancelAll(me) {
  for (const t of me.drawn.values()) t?.cancel();
  me.drawn.clear();
}

// Okunan sayfa (üst kenara en yakın) sayfa kutusunda gösterilir.
function currentPage(me) {
  const { pages } = me;
  const y = pages.scrollTop + pages.clientHeight / 3;
  let lo = 0, hi = pages.children.length - 1;
  while (lo < hi) {                                            // offsetTop'u y'yi geçmeyen son sayfa
    const mid = (lo + hi + 1) >> 1;
    if (pages.children[mid].offsetTop <= y) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}
function trackPage(me) {
  if (me.raf || !me.doc) return;
  me.raf = requestAnimationFrame(() => {
    me.raf = 0;
    if (cur !== me) return;
    const num = me.el.querySelector('.pv-num');
    if (document.activeElement !== num) num.value = currentPage(me);
  });
}
function goTo(me, n) {
  const box = me.pages.children[Math.max(1, Math.min(me.doc.numPages, n)) - 1];
  if (box) me.pages.scrollTop = box.offsetTop - 12;
}

function setZoom(me, z) {
  z = Math.max(0, Math.min(ZOOMS.length - 1, z));
  if (z === me.zoom || !me.doc) return;
  const n = currentPage(me);
  const box = me.pages.children[n - 1];
  const frac = box ? Math.max(0, (me.pages.scrollTop + 12 - box.offsetTop) / box.offsetHeight) : 0;
  me.zoom = z;
  layout(me, { n, frac });
}

// Her durumda kapatır: önce görüntüleyici kaldırılır, temizlik hataları kapanmayı engellemez.
function teardown() {
  const c = cur;
  if (!c) return;
  cur = null;
  c.el.remove();
  document.body.classList.remove('pv-open');
  try { c.observer?.disconnect(); cancelAll(c); } catch {}
  if (c.raf) cancelAnimationFrame(c.raf);
  Promise.resolve().then(() => c.task?.destroy()).catch(() => {});      // pdf.js çalışanını ve belleği bırakır
  if (c.blobUrl) setTimeout(() => URL.revokeObjectURL(c.blobUrl), 60_000);   // indirme sürüyor olabilir
}

// Kapatma (✕, Esc): görüntüleyici hemen kalkar; geçmişteki kendi kaydımız da geri alınır.
function close() {
  if (!cur) return;
  teardown();
  if (history.state?.pdfv) {
    ignorePop = true;
    setTimeout(() => { ignorePop = false; }, 1000);
    history.back();
  }
}
// Tarayıcının/telefonun geri tuşu
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  teardown();
});
document.addEventListener('keydown', e => {
  if (!cur) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('#pdfv [data-pv]');
  if (!b || !cur) return;
  const a = b.dataset.pv;
  if (a === 'close') return close();
  if (a === 'fit') return setZoom(cur, FIT);
  setZoom(cur, cur.zoom + (a === 'in' ? 1 : -1));
});
document.addEventListener('change', e => {
  if (cur?.doc && e.target.matches('#pdfv .pv-num')) goTo(cur, Number(e.target.value) || 1);
});
document.addEventListener('keydown', e => {
  if (cur?.doc && e.key === 'Enter' && e.target.matches('#pdfv .pv-num')) { goTo(cur, Number(e.target.value) || 1); e.target.blur(); }
});
// Pencere boyutu değişince (telefonu çevirme) sayfalar yeniden sığdırılır.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!cur?.doc) return;
    const fit = Math.max(200, Math.min(cur.pages.clientWidth - 24, MAX_FIT));
    if (Math.round(fit * ZOOMS[cur.zoom]) === cur.width) return;
    const n = currentPage(cur);
    layout(cur, { n, frac: 0 });
  }, 200);
});
