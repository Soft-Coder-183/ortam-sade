// Tanıtım videosunun senaryosu. Her sahne: seslendirme cümleleri (s) ve o cümle okunurken ekranda yapılanlar (is).
// oku: seslendirmenin doğru okuması için yazım (kısaltmalar); altyazıda s görünür. Sahne sırası videonun sırasıdır.
// tur 'kart': tanitim/kartlar.html'deki tam ekran kart; yoksa uygulamanın kendisi (sahte veriyle).
import { bekle, TABAN } from './kayit.mjs';
import { OGRENCI } from './veri.mjs';

const GIRISLI = { email: OGRENCI.eposta, ortam: true };
const alt = h => `#nav .subs a[href="${h}"]`;
const menu = id => `#nav a.grp[href^="#/${id}"]`;

export const SAHNELER = [
  { ad: '01-acilis', tur: 'kart', kart: 'acilis', adimlar: [
    { s: 'Ortam, UBS, Uzak, UZAKYDB, Webmail, Piazza… Altı ayrı site, altı ayrı giriş, altı ayrı arayüz.',
      oku: 'Ortam, U B S, Uzak, Uzak Y D B, Webmail, Piazza. Altı ayrı site, altı ayrı giriş, altı ayrı arayüz.', is: k => k.adim(0) },
    { s: 'Ortam Sade hepsini tek ve sade bir uygulamada topluyor.', is: k => k.adim(1), sonra: 700 },
  ] },

  { ad: '02-giris', durum: {}, hazirla: k => k.git('', { bekle: '.lg-form' }), adimlar: [
    { s: 'Uygulamayı açtığında seni giriş ekranı karşılar. Okul e-postanı ve şifreni bir kez yazman yeterli.', is: async k => {
      await bekle(500);
      await k.yaz('input[name=email]', OGRENCI.eposta, { hiz: 55 });
      await k.yaz('input[name=password]', 'ornek-sifre-2026', { hiz: 60 });
    } },
    { s: 'Uygulama altı siteye senin yerine girer; her sitenin sonucunu satır satır görürsün.', is: async k => {
      await k.tikla('#ilk-giris button[type=submit]', { sonra: 200 });
      await k.sayfa.waitForSelector('.ig-note');
      await k.uzerine('.ig-res', { dx: 0.7, dy: 0.5 });
      await k.sayfa.waitForSelector('.home', { timeout: 20000 });
    }, sonra: 1200 },
  ] },

  { ad: '03-anasayfa', hazirla: k => k.git('#/anasayfa', { bekle: '[data-card="piazza"] .hm' }), adimlar: [
    { s: 'Ana sayfa gününü tek bakışta gösterir: şu anki dersin, yaklaşan sınavların, okunmamış e-postaların ve Piazza\'daki yeni gönderiler.', is: async k => {
      for (const c of ['today', 'exams', 'mail', 'piazza']) { await k.uzerine(`[data-card="${c}"]`, { dy: 0.45 }); await k.vurgula(`[data-card="${c}"]`, 1050); }
    } },
    { s: 'Ortam\'da seni bekleyen bir anket ya da duyuru varsa en üstte haber verir.', is: async k => { await k.uzerine('.banner.hn', { dx: 0.3 }); await k.vurgula('.banner.hn', 1600); } },
  ] },

  { ad: '04-dersler', hazirla: k => k.git('#/anasayfa', { bekle: '[data-card="piazza"] .hm' }), adimlar: [
    { s: 'Derslerim\'de Ortam, Uzak ve Piazza tek listede. Yeni içerik olan dersler renkli rozetle işaretlenir.', is: async k => {
      await k.tikla(menu('donem'));
      await k.sayfa.waitForSelector('a.course-row');
      await k.uzerine('a.course-row[href$="BIL214"] .badges', { dx: 0.3 });
      await k.vurgula('a.course-row[href$="BIL214"]', 1300);
      await k.vurgula('a.course-row[href$="MAT202"]', 1100);
    } },
    { s: 'Bir derse girdiğinde Uzak\'taki haftalar, Piazza gönderileri ve kaynaklar aynı sayfada.', is: async k => {
      await k.tikla('a.course-row[href$="BIL214"]', { dx: 0.25 });
      await k.sayfa.waitForSelector('.course-part');
      await bekle(900);
      await k.kaydir(620, 1700); await bekle(500);
      await k.kaydir(900, 1900); await bekle(400);
    } },
    { s: 'Gönderiler yanıtlarıyla birlikte yerinde açılır.', is: async k => {
      await k.basa(500);
      await k.tikla('.tabs a[href$="BIL214/piazza"]');
      await k.sayfa.waitForSelector('details[data-lazy="ppost:pz214:p214b"]');
      await k.tikla('details[data-lazy="ppost:pz214:p214b"] summary', { dx: 0.3 });
      await k.sayfa.waitForSelector('details[data-lazy="ppost:pz214:p214b"] .pans');
      await k.kaydir(240, 900);
    }, sonra: 900 },
    { s: 'Ders notları ve PDF\'ler de uygulamanın içindeki görüntüleyicide.', oku: 'Ders notları ve P D F\'ler de uygulamanın içindeki görüntüleyicide.', is: async k => {
      await k.basa(400);
      await k.tikla('.tabs a[href$="BIL214/uzak"]');
      await k.tikla('button.mi-main[data-title="Hafta 8 - Ders Notları"]', { dx: 0.2 });
      await k.sayfa.waitForSelector('#pdfv .pv-page canvas', { timeout: 20000 });
      await bekle(1700);
      await k.tikla('#pdfv [data-pv="close"]');
    } },
  ] },

  { ad: '05-program', hazirla: k => k.git('#/donem/program', { bekle: '.week .nowlabel' }), adimlar: [
    { s: 'Ders Programım haftanı gösterir. Kırmızı çizgi şu anki saati işaretler; sınavlar da kendi gününde ve saatinde görünür.', is: async k => {
      await bekle(700);
      await k.uzerine('.week .nowlabel', { dx: 1.6 });
      await bekle(1500);
      await k.tikla('.week .bl.exam[data-exam="1"]');
      await bekle(2000);
      await k.tus('Escape', 200);
    } },
    { s: 'Sınav Takvimi\'nde her sınav tek satırda: tarih, saat, derslik ve kalan gün.', is: async k => {
      await k.tikla(menu('sinav'));
      await k.sayfa.waitForSelector('.xlist .xrow');
      await k.uzerine('.xlist .xrow.next', { dx: 0.3 });
      await k.vurgula('.xlist .xrow.next', 1200);
      await k.uzerine('.xlist .xrow >> nth=4', { dx: 0.85 });
    } },
  ] },

  { ad: '06-webmail', hazirla: k => k.git('#/webmail', { bekle: 'details.mail' }), adimlar: [
    { s: 'Okul e-postan da burada. Okuduğun e-posta okulun sunucusunda da okundu olur; ekler uygulamanın içinde açılır.', is: async k => {
      await bekle(500);
      await k.tikla('details[data-mail="2040"] summary .subj', { dx: 0.3 });
      await k.sayfa.waitForSelector('details[data-mail="2040"] .mailbody');
      await bekle(1100);
      await k.tikla('details[data-mail="2040"] .att[data-pdf]');
      await k.sayfa.waitForSelector('#pdfv .pv-page canvas', { timeout: 20000 });
      await bekle(1500);
      await k.tikla('#pdfv [data-pv="close"]');
    } },
    { s: 'Önemlileri yıldızla, gereksizleri tek tıkla sil.', is: async k => {
      await k.tikla('button.star[data-uid="2040"]', { sonra: 700 });
      await k.tikla('button.mdel[data-uid="2019"]', { sonra: 600 });
    } },
    { s: 'Yeni e-posta yazmak ya da yanıtlamak için başka bir sekmeye gerek yok.', is: async k => {
      await k.tikla('a.newmail');
      await k.sayfa.waitForSelector('#compose');
      await k.yaz('#compose input[name=to]', 'ornek.danisman@etu.edu.tr', { hiz: 18, sonra: 150 });
      await k.yaz('#compose input[name=subject]', 'Proje toplantısı', { hiz: 26, sonra: 150 });
      await k.yaz('#compose textarea[name=text]', 'Merhaba hocam,\nperşembe 15.30 benim için de uygun.', { hiz: 20 });
    }, sonra: 500 },
  ] },

  { ad: '07-profil', hazirla: k => k.git('#/profil/notlar', { bekle: 'table.t' }), adimlar: [
    { s: 'Profil bölümünde notların, müfredatın ve transkriptin hazır.', is: async k => {
      await k.kaydir(560, 1500);
      await k.tikla(alt('#/profil/mufredat'));
      await k.sayfa.waitForSelector('table.t');
      await k.kaydir(700, 1600);
    } },
    { s: 'Ortalama ve Ders Planı ile bu dönem için hedef notlarını seç; genel ortalamanın nasıl değişeceğini anında gör.', is: async k => {
      await k.tikla(alt('#/profil/ortalama'));
      await k.sayfa.waitForSelector('#plan .plan-table');
      await bekle(500);
      for (const [kod, not] of [['BİL 212', 'AA'], ['BİL 214', 'BA'], ['BİL 245', 'BB'], ['BİL 265', 'BA'], ['MAT 202', 'BB'], ['TAR 101', 'AA']]) await k.sec(`select[data-plan-cur="${kod}"]`, not, 380);
      await k.vurgula('.plan-result', 1500);
    } },
    { s: 'Sonraki dönemi planla, notunu yükseltmek istediğin dersi ekle ve hedef ortalaman için hangi notların gerektiğini öğren. Hesaplar okulun yönetmeliğine göre yapılır.', is: async k => {
      await k.tikla('[data-plan-add="BİL 331"]', { sonra: 350 });
      await k.tikla('[data-plan-add="BİL 361"]', { sonra: 350 });
      await k.tikla('[data-plan-add="FİZ 102"]', { sonra: 500 });
      await k.sec('select[data-plan-next="FİZ 102"]', 'BA', 600);
      await k.yaz('[data-plan-goal]', '3,50', { hiz: 110 });
      await k.tus('Tab', 400);
      await k.vurgula('.plan-goal', 1800);
    } },
  ] },

  { ad: '08-ubs', hazirla: k => k.git('#/ubs', { bekle: '.ubs-list' }), adimlar: [
    { s: 'UBS\'nin kalabalık menüleri sade bir listeye dönüşür; transkriptin tek tıkla karşında.', oku: 'U B S\'nin kalabalık menüleri sade bir listeye dönüşür; transkriptin tek tıkla karşında.', is: async k => {
      await bekle(900);
      await k.tikla('.ubs-item >> nth=0', { dx: 0.2 });
      await k.sayfa.waitForSelector('.t-sum');
      await bekle(700);
      await k.kaydir(620, 1700);
    } },
    { s: 'Yabancı Diller\'in sitesi UZAKYDB de uygulamanın içinde.', oku: 'Yabancı Diller\'in sitesi Uzak Y D B de uygulamanın içinde.', is: async k => {
      await k.tikla(menu('uzakydb'));
      await k.sayfa.waitForSelector('a.course-row');
      await bekle(600);
      await k.tikla('a.course-row', { dx: 0.2 });
      await k.sayfa.waitForSelector('.mitems');
    }, sonra: 900 },
  ] },

  { ad: '09-acilan', hazirla: k => k.git('#/ekstra/acilan', { bekle: '.ac-search' }), adimlar: [
    { s: 'Ekstra bölümündeki Açılan Dersler ile kayıttan önce haftanı planla. Dersi ara, Enter\'a bas, plana eklensin.', is: async k => {
      await bekle(500);
      for (const d of ['BİL 331', 'MAT 202', 'BİL 214', 'ELE 224']) { await k.yaz('[data-ac-q]', d, { hiz: 60, sonra: 420 }); await k.tus('Enter', 380); }
    } },
    { s: 'Şubeler haftalık takvimde görünür. Seçtiklerin yeşile döner, çakışanlar kırmızıyla işaretlenir.', is: async k => {
      await k.kaydir(455, 1300);
      await k.tikla('.pl-cal [data-pl-pick="MAT 202|2"]', { sonra: 900 });
      await k.tikla('.pl-cal [data-pl-pick="BİL 214|2"]', { sonra: 1100 });
      await k.uzerine('.pl-b.clash', { dy: 0.3 }).catch(() => {});
    }, sonra: 700 },
    { s: 'İstersen çakışmayan en iyi programları senin için bulur; tek tıkla takvime uygularsın.', is: async k => {
      await k.tikla('[data-pl-combos]');
      await k.sayfa.waitForSelector('.pl-combos');
      await bekle(900);
      await k.tikla('[data-pl-apply="0"]', { sonra: 700 });
      await k.kutu('.pl-cal .pl-cal-h', { ust: 40, alt: 700, oran: 0.07 });
    }, sonra: 1200 },
  ] },

  { ad: '10-ekstra', hazirla: k => k.git('#/ekstra/takvim', { bekle: 'main h1' }), adimlar: [
    { s: 'Akademik takvim, akademik kadro ve kütüphane çalışma odası rezervasyonu da burada.', is: async k => {
      await bekle(1300);
      await k.tikla(alt('#/ekstra/kadro'));
      await bekle(1500);
      await k.tikla(alt('#/ekstra/rezervasyon'));
      await k.sayfa.waitForSelector('.rz-form', { timeout: 20000 }).catch(() => {});
      await bekle(600);
    } },
    { s: 'Mevzuat bölümünde yönetmelikler madde madde aranır; sık sorulan sorulara, dayandığı maddeden alıntıyla hızlı yanıt verir.', is: async k => {
      await k.tikla(alt('#/ekstra/mevzuat'));
      await k.sayfa.waitForSelector('.mv-search', { timeout: 60000 });
      await bekle(500);
      await k.yaz('.mv-search input[name=q]', 'dersten çekilme', { hiz: 60 });
      await k.tus('Enter', 300);
      await k.sayfa.waitForSelector('.mv-hits, .card.msg', { timeout: 60000 });
      await bekle(900);
      await k.kaydir(420, 1500);
    }, sonra: 700 },
    { s: 'Öğrenci İşleri\'nin duyuruları da aynı menüde; okulun sitesini ayrıca açmana gerek kalmaz.', is: async k => {
      await k.tikla(alt('#/ekstra/duyurular'));
      await k.sayfa.waitForSelector('.mitems .mi', { timeout: 60000 });
      await k.basa(300);
      await k.uzerine('.mitems .mi >> nth=1', { dx: 0.3 });
      await k.vurgula('.mitems .mi >> nth=1', 1300);
    }, sonra: 500 },
  ] },

  { ad: '11-bildirim', tur: 'kart', kart: 'bildirim', adimlar: [
    { s: 'Ortam Sade arka planda Piazza\'yı ve Uzak\'ı senin yerine kontrol eder. Yeni bir gönderi, yeni bir dosya ya da yaklaşan bir sınav olduğunda Windows bildirimi gelir; istersen özet e-posta da.', is: k => k.adim(0) },
    { s: 'Pencereyi kapatsan bile sistem tepsisinde çalışmaya devam eder.', is: k => k.adim(1), sonra: 500 },
  ] },

  { ad: '12-hesap', hazirla: k => k.git('#/hesap', { bekle: '#wm-settings .wm-opt' }), adimlar: [
    { s: 'Hesap sayfasından oturumlarını, bildirimleri ve Webmail\'in otomatik temizliğini yönetirsin; istersen uygulamaya giriş PIN\'i koyarsın.', is: async k => {
      await bekle(600);
      await k.kutu('#acct-sessions', { ust: 300, alt: 300 }); await bekle(900);
      await k.kutu('.sec-sites', { ust: 300, alt: 300 }); await bekle(900);
      await k.kutu('[data-pin-form]', { ust: 300, alt: 300 }); await k.uzerine('[data-pin-form] input'); await bekle(600);
      await k.kutu('.notif-set', { ust: 300, alt: 300 }); await bekle(700);
    } },
    { s: 'Şifren ve verilerin yalnızca kendi bilgisayarında, şifreli olarak durur. Arada başka hiçbir sunucu yok.', is: async k => {
      await k.kutu('.sec-list', { ust: 300, alt: 300 });
      await k.vurgula('.card.sec:has(.sec-list)', 2600);
    } },
    { s: 'Göz yormayan karanlık tema da var; bütün ekranlar ona uyar.', is: async k => {
      await k.tikla('[data-theme-set="dark"]', { sonra: 900 });
      await k.tikla(menu('anasayfa'));
      await k.sayfa.waitForSelector('[data-card="piazza"] .hm');
      await bekle(1000);
      await k.tikla(menu('donem'), { sonra: 250 });
      await k.tikla(alt('#/donem/program'));
      await k.sayfa.waitForSelector('.week');
    }, sonra: 1500 },
  ] },

  { ad: '13-guncelleme', durum: { ...GIRISLI, guncelleme: true }, hazirla: async k => { await k.git('#/anasayfa', { bekle: '[data-card="piazza"] .hm' }); }, adimlar: [
    { s: 'Yeni sürüm çıktığında uygulama sana sorar. Sen Güncelle demeden hiçbir şey indirilmez, hiçbir şey kurulmaz.', is: async k => {
      await k.sayfa.waitForSelector('#upd', { timeout: 15000 });
      await bekle(900);
      await k.tikla('#upd summary', { sonra: 1500 });
      await k.uzerine('#upd [data-upd-go]');
    }, sonra: 700 },
  ] },

  { ad: '14-telefon', tur: 'kart', kart: 'telefon', durum: GIRISLI, hazirla: async k => {
      await k.sayfa.evaluate(u => window.telefonAc(u), TABAN + '/#/anasayfa');
      await k.sayfa.frameLocator('#tel').locator('[data-card="piazza"] .hm').first().waitFor({ timeout: 20000 });
    }, adimlar: [
    { s: 'Aynı uygulama Android\'de, ETÜ Cep adıyla cebinde. Uygulama kapalıyken bile bildirimler gelir.', oku: 'Aynı uygulama Android\'de, Etü Cep adıyla cebinde. Uygulama kapalıyken bile bildirimler gelir.', is: async k => {
      const f = k.sayfa.frameLocator('#tel');
      await bekle(1200);
      await k.tikla(f.locator('#nav a.grp[href^="#/donem"]').first(), { sonra: 1500 });
      await k.tikla(f.locator('#nav a.grp[href^="#/sinav"]').first(), { sonra: 1500 });
      await k.tikla(f.locator('#nav a.grp[href^="#/webmail"]').first(), { sonra: 1300 });
    }, sonra: 600 },
  ] },

  { ad: '15-kapanis', tur: 'kart', kart: 'kapanis', adimlar: [
    { s: 'Ortam Sade ücretsiz ve açık kaynaklı; bağımsız bir öğrenci projesi. Kurulum dosyaları GitHub\'da, herkesin görebildiği koddan derlenir.', is: k => k.adim(0) },
    { s: 'Hemen indir, bir kez giriş yap, gerisini Ortam Sade\'ye bırak.', is: k => k.adim(1), sonra: 2600 },
  ] },
];
for (const s of SAHNELER) if (!s.tur && !s.durum) s.durum = GIRISLI;
