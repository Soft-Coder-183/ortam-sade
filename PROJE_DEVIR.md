# Ortam Sade: Proje Devir Belgesi

Ortam Sade, TOBB ETÜ'nün okul sitelerini (Ortam, UBS, Uzak, UZAKYDB, Webmail, Piazza) tek ve sade bir arayüzde toplayan açık kaynaklı bir uygulamadır. Windows'ta öğrencinin bilgisayarında, Android'de "ETÜ Cep" adıyla telefonunda çalışır. Bu belge, projeyi devralan bir agent'ın önceki konuşmaları görmeden işe başlayabilmesi için yazıldı.

- **Sahibi:** TOBB ETÜ öğrencisi Eren Akyurt. Türkçe konuşur, uygulamayı arkadaşlarıyla paylaşır.
- **Depo:** https://github.com/Soft-Coder-183/ortam-sade (herkese açık, MIT lisansı).
- **Durum:** Yayımlanmış sürüm 1.6.4. Depoda 1.7.0 hazır, gerçek cihaz denemesinden sonra etiketlenecek. GitHub hesabı `gh` ile bağlı.
- **Devam eden iş:** Android uygulaması "ETÜ Cep". Önce APK çıkacak; Play yayını ve geliştirici hesabı sonraya kaldı. Yalnızca Android hedefleniyor, Windows sürümü kalıyor.
- **Kapsam notu:** Bu belge uygulamanın her parçasını saymaz. Kodda burada anlatılmayan bir bölüm görürsen değiştirmeden önce kullanıcıya sor.

## Mimari

Tarayıcıdaki arayüz yalnızca bilgisayardaki yerel Node sunucusuyla konuşur. Sunucu okulun sitelerine kullanıcının oturumuyla bağlanır, sayfayı ayrıştırır ve sadeleştirilmiş JSON döndürür. Arada başka bir sunucu yoktur.

```
Tarayıcı (public/app.js)
   │  /api/*  (yalnızca 127.0.0.1)
Node sunucusu (server/server.mjs) → çekirdek (server/api.mjs)
   │  site modülleri: ortam, ubs, moodle, webmail, piazza, etu, mevzuat
   │  oturum katmanı: session.mjs + autologin.mjs
Okulun siteleri ve mevzuat.gov.tr
```

- **Çalışma biçimi:** Node ESM. Sayfa ayrıştırma `cheerio`, görünür tarayıcı ve PDF üretimi `playwright-core` ile yapılır. PDF görüntüleme tarayıcıda `pdfjs-dist` ile çalışır.
- **Tarayıcı:** Kurulu Chrome kullanılır, yoksa Edge'e düşülür (`session.mjs` içindeki `CHANNEL`).
- **Akıllı maskeleme:** Her ekran yalnızca kendi `/api/*` ucunu, o uç da okulun tek sayfasını çağırır. Özgün alt menüler korunur.
- **Önbellek:** Yanıtlar önce önbellekten gelir, süresi geçmişse arka planda yenilenir (SWR). Dosyalar `.cache/api/v{CACHE_VER}-*` altında durur. `STALE_MIN` uç başına tazelik süresini belirler.
- **`CACHE_VER`:** Şu an 13. Bir ayrıştırıcının çıktısı değişince artırılır; eski kayıtlar açılışta silinir.
- **Port:** Varsayılan 3000, `PORT` ortam değişkeniyle değişir.
- **Başlatma:** `OrtamSade.exe` (masaüstü penceresi, aşağıda) ya da yedek olarak `Ortam Sade.cmd`, `server/start.mjs` başlatıcısını çalıştırır; o da `server/server.mjs` sürecini açar. Sunucu 75 koduyla çıkarsa başlatıcı yeniden açar. İkinci kopya portu dolu bulursa yalnızca tarayıcıyı açıp çıkar.

## Dosya haritası

| Yol | Görev |
|---|---|
| `server/server.mjs` | Windows HTTP sunucusu, statik dosyalar, istek denetimleri |
| `server/api.mjs` | Çekirdek: API uçları (`handleApi`), önbellek, kilit, durum, arka plan işleri. HTTP bilmez |
| `server/browser.mjs` | Masaüstü tarayıcısı: görünür giriş penceresi, kayıtlı profil |
| `server/start.mjs` | Başlatıcı: sunucuyu gözetir, güncelleme sonrası yeniden açar |
| `server/session.mjs` | Site tanımları (`SITES`), çerez kutuları, görünür giriş penceresi, oturum canlı tutma, oturum kapatma |
| `server/autologin.mjs` | Kayıtlı bilgiyle doğrudan giriş |
| `server/credentials.mjs` | E-posta ve şifrenin DPAPI ile saklanması |
| `server/vault.mjs` | AES-256-GCM yerel şifreleme, anahtar DPAPI ile korunur |
| `server/settings.mjs` | Güvenlik ve oturum ayarları, PIN özeti |
| `server/ortam.mjs` | Ortam ayrıştırıcıları (profil, notlar, sınavlar, başvurular, ana sayfa kartları) |
| `server/ubs.mjs` | UBS sayfaları, formlar, belgeler |
| `server/moodle.mjs` | Uzak ve UZAKYDB (ortak Moodle kodu) |
| `server/piazza.mjs` | Piazza API |
| `server/webmail.mjs` | Roundcube üzerinden e-posta, yıldızlar, otomatik silme |
| `server/courses.mjs` | Ortam, Uzak ve Piazza derslerini birleştirir (`courseKey`) |
| `server/plan.mjs` | Ortalama ve ders planı verisi (transkript + müfredat) |
| `server/rezervasyon.mjs` | Kütüphane grup çalışma odası ve müzik stüdyosu rezervasyonu (www.etu.edu.tr/tr/rezervasyon) |
| `server/etu.mjs` | Okulun herkese açık sitesi (akademik takvim, kadro) |
| `server/program.mjs` | Açılan Dersler ekranının ders ve şube verisi (`/api/program`) |
| `server/mevzuat.mjs`, `server/mevzuat-yanitlar.mjs` | Mevzuat dizini, belge ayrıştırma, arama, duyurular, hızlı yanıtlar |
| `server/notify.mjs` | Bildirimler, hatırlatmalar, e-posta giden kutusu |
| `server/update.mjs` | Onaylı güncelleme |
| `server/pdf.mjs`, `server/pdf-sablon.mjs` | PDF üretimi ve ortak şablon |
| `server/program.mjs` | Açılan Dersler ekranının ders ve şube verisi (`/api/program`) |
| `mobile/core.mjs` | Android çekirdeği: `fetch` yönlendirmesi, indirme, geri tuşu, arka plan girişi |
| `mobile/shim/` | Node modüllerinin ve platforma bağlı dosyaların Android karşılıkları |
| `mobile/metinler.mjs` | Windows'a özgü arayüz metinlerinin telefon karşılıkları |
| `mobile/android/` | Kotlin kabuğu (Gradle projesi) |
| `scripts/mobil.mjs` | Android web içeriğini üretir (`npm run mobil`) |
| `public/app.js` | Tek sayfalık arayüzün tamamı (menü, görünümler, yönlendirme) |
| `public/style.css` | Stiller; açık ve koyu tema token'ları |
| `public/pdfview.js` | Uygulama içi PDF görüntüleyici |
| `scripts/paketle.mjs` | Windows paketi üretir (`npm run paketle`) |
| `.github/workflows/surum.yml` | Etiketle tetiklenen sürüm üretimi |
| `notlar/vX.Y.Z.md` | Sürüm notları |
| `masaustu/` | Masaüstü penceresi `OrtamSade.exe` (C#, .NET Framework 4.8, WinForms + WebView2) |
| `Ortam Sade.cmd` | Yedek başlatıcı: siyah pencere, tarayıcıda açar (CRLF olmalı) |

## Özellikler

| Menü | İçerik |
|---|---|
| Profil | Bilgilerim, Not Görüntüleme, Ortalama ve Ders Planı, Müfredat, Ortak Eğitim, İkinci Yabancı Dil, Ödeme |
| Ana Sayfa | Bugünkü dersler ve sınavlar, yaklaşan sınavlar, posta, Piazza, son kullanılan 6 sayfa; üstte Ortam'da bekleyen anket ve duyurular ("Ankete git"), UZAKYDB ek içerik, yaklaşan son tarihler |
| Dönem Bilgilerim | Derslerim (Ortam, Uzak, Piazza tek sayfada), Ders Programım |
| Sınav Takvimi | Ara Sınav, Final ya da Bütünleme; her sınav tek satırda |
| Webmail | Anında silme (Yabancı Diller "New sign in to your … account" e-postaları gelir gelmez Çöp'e; varsayılan açık), okundu senkronizasyonu, yazma, yanıtlama, yıldızlar, tarihe göre sıralı klasörler, satırda Sil, Çöp'te Geri getir; otomatik silme (okunanlar seçilen sürede Çöp'e, varsayılan kapalı; uygulamanın bildirim e-postaları varsayılan 12 saatte Gelen ve Gönderilmiş'ten Çöp'e; açık e-postanın altında "Otomatik silinmesin") |
| Piazza, UBS, UZAKYDB | Kendi sade arayüzleri; PDF'ler uygulama içinde açılır |
| Ekstra | Açılan Dersler ve haftalık plan, Rezervasyon, Akademik Takvim, Akademik Kadro (uygulamanın içinde), Yabancı Diller, Mevzuat, Öğrenci İşleri Duyuruları, ÇAP/YAP - Başvurular |
| Hakkında ve SSS | Hakkımızda, Okulun Siteleri, SSS, Sorumluluk Reddi |
| Hesap | Tek giriş, siteye özel şifreler, Güvenlik ve Oturumlar, Bildirimler, Webmail ayarları, görünüm (aydınlık/karanlık) |

**Mevzuat:** Belgeler okulun Mevzuat sayfasından keşfedilir, mevzuat.gov.tr, Resmî Gazete, PDF ve Word kaynaklarından madde madde ayrıştırılır, `.cache/mevzuat` altında tutulur. Hızlı yanıtlar `server/mevzuat-yanitlar.mjs` içindedir. Her yanıt kaynak maddeden birebir alıntı taşır; uygulama alıntının güncel metinde geçtiğini denetler, geçmiyorsa uyarır. Transkript varsa yanıtların altında "Senin durumun" çıkar.

**Açılan Dersler ve haftalık plan:** Öğrenci ders ya da ders hocası arar, dersleri plana ekler ve şubelerini haftalık takvimden seçer. Kod `public/app.js` içinde `plArea`, `plCalendar`, `plPanel` ve `plFindCombos` çevresindedir.

- **Arama:** Enter, listede işaretli dersi ekler; işaret yukarı ve aşağı oklarla plana eklenebilir dersler arasında gezer. Kodu aramayla başlayan dersler önce gelir. Ders eklenince arama sıfırlanır.
- **Takvim:** Seçili şube yeşil görünür, seçilmemiş şubeler hep kesik çizgili kutularda durur. Seçili kutuya ya da paneldeki aynı şubeye basmak seçimi kaldırır. Takvim en az 18.30 satırına kadar uzanır. Eklenen dersler paneli geniş ekranda hep takvimin sağındadır; dar kutular yalnızca ders kodunu gösterir.
- **Gizleme:** Paneldeki "gizle" şubeyi yalnızca takvimden kaldırır. Otomatik program bulmayı etkilemez.
- **Şube değiştirme:** Paneldeki her dersin altında şube düğmeleri vardır, dersi açmadan şube değişir. Şube satırındaki uyarı, çakışılan dersin seçili şubesini yazar.
- **Çakışma:** Çakışan seçili şubeler takvimde açık zemin, kalın kırmızı sol kenar, kesikli ince kırmızı çerçeve ve ders kodunun yanında kırmızı noktayla görünür. Panelde de liste vardır.
- **Otomatik program:** Çakışmayan en iyi 5 kombinasyon üretilir. Etikette önce boşluk süresi, sonra gün sayısı yazar.
- **Sıfırlama:** "Şube seçimlerini sıfırla" dersleri korur. "Planı temizle" seti saklar, "Son ders setini geri yükle" o anki setle yer değiştirir.
- **Saklama:** Plan tarayıcıda `program-taslak` anahtarındadır (`courses`, `picks`, `off`, `active`, `last`).

**Ortam'daki anket ve duyurular:** "Ankete git" / "Ortam'da aç" (ve Not Görüntüleme'deki anket uyarısı) `POST /api/open-page?site=ortam&path=…` çağırır: sayfa görünür pencerede uygulamanın oturum çerezleriyle açılır (`session.openPage` → `browser.openPage`; Android'de `LoginActivity` `stay` modu). Oturum düşmüşse giriş formu kayıtlı bilgilerle doldurulup gönderilir. Kullanıcı sekmeyi/pencereyi kapatınca istek döner, `ortam-duyuru` ve `notlar` önbelleği silinir ve uyarılar yeniden alınır (anket doldurulduysa kalkar). Anket uygulamada doldurulmaz.

**Masaüstü uygulaması (`masaustu/`, `OrtamSade.exe`):** Kurulumdaki bütün kısayollar bunu açar.
- `server\start.mjs`'i görünmez başlatır (`ORTAM_MASAUSTU=1`); çıktısı `.cache\sunucu.log`'a yazılır. Port 3000 zaten açıksa (ör. geliştirme sunucusu) yalnızca ona bağlanır.
- Arayüz tek pencerede, WebView2'de açılır; WebView2 verisi `.cache\webview2`'de durur. Pencere her açılışta ekranı kaplar (büyütülmüş); "önceki boyut"a dönünce kullanılan konum `.cache\pencere.txt`'de saklanır. Uygulamanın adresi dışındaki bağlantılar varsayılan tarayıcıda açılır.
- Pencereyi kapatmak (X) tepsiye indirir; ilk seferde balon bilgisi çıkar. Tepsi menüsündeki "Kapat" önce `/api/shutdown` ile düzgün kapatır, olmazsa süreç ağacını sonlandırır. Sunucu kendisi kapanırsa (Hesap > "Uygulamayı kapat") pencere de kapanır.
- `--arka`: yalnızca tepside başlar (açılış kısayolu). Tek kopya çalışır (mutex); ikinci açılış adlandırılmış boruyla ilk kopyaya "göster" ya da bağlantı gönderir.
- `ortamsade:` bağlantı türünü HKCU'ya kendisi yazar (kurulum da yazar). Windows bildirimleri `ORTAM_MASAUSTU` varken `ortamsade:#/...` açar, böylece tıklayınca pencerede o sayfa açılır.
- Beklenmeyen hatalar `.cache\pencere-hata.log`'a yazılır.
- Derleme: `npm run paketle` içinde `dotnet publish masaustu` çalışır (.NET SDK gerekir; GitHub'ın Windows makinesinde vardır). Pakete yalnızca exe, config, `Microsoft.Web.WebView2.Core.dll`, `...WinForms.dll` ve `WebView2Loader.dll` girer; hepsi kökte durur, çünkü güncelleme kökteki her öğeyi yeniden adlandırarak değiştirir ve çalışan exe/DLL yeniden adlandırılabilir.
- Not: Başka bir süreçten `CloseMainWindow` (WM_CLOSE) göndermek Windows'ta "Görev Yöneticisi kapatması" sayılır ve uygulamayı tamamen kapatır; X düğmesini denemek için `WM_SYSCOMMAND/SC_CLOSE` gönder.

**Tarayıcıda açma (`Ortam Sade.cmd`, yedek):** `server.mjs` `openBrowser()` varsayılan tarayıcıyı kayıt defterinden bulur; Chromium tabanlıysa (Chrome, Edge, Brave, Vivaldi) `--app=http://localhost:3000/` ile, değilse Edge ile açar. `ORTAM_PENCERE=tarayici` normal sekmeye döndürür.

**Hesap ve giriş:** Hesap'tan giriş yapınca sonuçlar Hesap'ta görünür ve hemen 3 saniyelik sayaç başlar, sonra Ana Sayfa açılır ("Hesap'ta kal" sayacı durdurur). Ortam penceresi aynı anda açılır ve arka planda tamamlanır; bu sırada başka sayfaya geçildiyse sayfa yeniden çizilmez. Ortam doğrudan girişi desteklemez (görünmez reCAPTCHA); bilgiler bir sitede kabul edilince görünür pencere kendiliğinden açılır, Oturumlar tablosunda da giriş düğmesi vardır.

- **Giriş düğmeleri:** Herhangi bir ekrandaki "Giriş yap", kayıtlı bilgi yoksa ya da şifre reddedildiyse `#/hesap/<site>` adresine gider. Orada bant çıkar; e-posta alanına ya da o sitenin özel şifre alanına odaklanılır.
- **Pencereden giriş:** Kullanıcı giriş penceresinde (Ortam, ya da doğrulama isteyen UBS) bilgilerini kendisi yazarsa, `browser.mjs` ve `LoginActivity` yazılanları döndürür (`typed`). Kayıtlı bilgi yoksa `api.mjs`'teki `adoptTyped` bunlarla bütün sitelere girer ve bilgileri kaydeder. Aynı e-postayla farklı şifre yazıldıysa yalnızca o sitenin özel şifresi olur.

**Rezervasyon:** Okulun sistemi giriş istemez. Boş ve dolu saatler her açılışta alınır. Gönderimde öğrenci numarası, şifre ve katılımcı numaraları gider. Kayıtlı Ortam şifresi varsa şifre alanı dolu görünür: içindeki değer şifrenin kendisi değil, sabit bir yer tutucudur (`REZ_KAYITLI`); değiştirilmezse sunucu kayıtlı şifreyi ekler, şifre arayüze gelmez. Okulun sistemi `form-check` yanıtında `captcha|` derse güvenlik kodu görseli gösterilir, kodu kullanıcı yazar. Sonra önizleme gelir, kesinleştirme iki tıklama ister. Önizleme ve sonuç sayfalarından yalnızca `.container.rezervasyon` bölümü alınır (yan menü, sayfa yolu, adım çubuğu, düğmeler atılır) ve başlık / etiket-değer / metin satırlarına çevrilir (`lines()`); seçili kutular "✓ seçili" olur, seçilmemiş saat satırları atlanır. Kesinleştirme adımı gerçek bir rezervasyonla henüz denenmedi.

**Bilinen veri sorunu:** mevzuat.gov.tr'deki Lisans Yönetmeliği metni 2011 hâlidir ve "bütünleme yok" der. Kullanıcı bütünlemenin yapıldığını doğruladı; hızlı yanıt bunu açıkça söyler.

## Arka plan işleri ve bildirimler

Uygulama açıkken (penceresi kapalı olsa da tepside) çalışır; tepsideki "Kapat" ya da "Uygulamayı kapat" tamamen durdurur. Kurulum dosyasıyla kurulduysa bilgisayar açılınca tepside kendiliğinden başlar (`OrtamSade.exe --arka`) (kurulumdaki seçenek varsayılan olarak işaretli); zip sürümü kendiliğinden başlamaz.

| İş | Sıklık |
|---|---|
| Ortam oturumunu açık tutma | 10 dk |
| UBS oturumunu açık tutma | 15 dk |
| Webmail oturumu | 150 dk |
| Uzak ve UZAKYDB oturumu | 180 dk |
| Piazza oturumu | 240 dk |
| Piazza yeni gönderi kontrolü | 30 dk |
| Uzak yeni içerik kontrolü | 60 dk |
| Akademik takvim ve sınav hatırlatmaları | 180 dk |
| Webmail otomatik silme kontrolü (ayar açıksa) | 60 dk |
| Yeni sürüm denetimi | 6 saat |

- O aralıkta siteye gerçek istek gittiyse oturum kontrolü atlanır (`usedAt`). Kullanıcı Hesap'tan açık tutmayı ve kendiliğinden yeniden girmeyi kapatabilir.
- Bildirimler Windows bildirimi ve isteğe bağlı özet e-posta olarak gider. E-posta kullanıcının kendi adresinedir ve konusu `[Ortam Sade · Bildirim]` ile başlar.
- Gönderilemeyen e-postalar giden kutusunda en fazla 2 gün bekler ve yeniden denenir.
- Renkler: Uzak kırmızımsı turuncu, Piazza mavi. Derslerim'deki Uzak etiketi Ortam işaretinin üç rengiyle (mavi, kırmızı, turuncu) sert geçişli, sabit (dönmeyen) çerçevedir; eski yumuşak geçişli dönen görünüm `.pill.src-uzak.yumusak` olarak saklıdır. Menüde sade nokta, derslerin üzerinde sayılı rozet görünür. Rozete (ve "Piazza · N yeni" etiketine) basınca o dersin en yeni bildirimi açılır.
- Ders sayfasında sıra: Tümü, Uzak, Piazza, Derse Bakış (Tümü'nde de Uzak önce gelir).
- Piazza kaynakları (`resView`/`resItem`): bölüm başına sayılı başlık ve dosya blokları (ızgara). Ad okunur yapılır (alt çizgi boşluk, uzantı ayrı renkli etiket: pdf, slayt, belge, tablo, arşiv, kod, bağlantı), uzun ad satıra sığar, asıl ad ipucundadır. Blok `div[role=button][data-file]`: ad seçilip kopyalanabilir (seçim varken tıklama dosyayı açmaz), Enter/Boşluk ile açılır.
- Webmail'deki Piazza e-postaları (`webmail.mjs` `cleanHtml`/`piazzaRoute`): ders konudan bilinir; gönderi bağlantısı (`cid=` ya da `/post/<numara|kimlik>`) `#/donem/derslerim/<ders>/piazza/<gönderi>` olur, gönderi açık gelir (numara `focusCourseItem`'da kimliğe çevrilir). İlk "resources…/kaynaklar…" sözcüğü (`linkResourcesWord`) dersin kaynaklarına bağlanır.
- Piazza gönderisi açılınca (`openLazy` → `linkResources`) ilk geçen "resources…" / "kaynaklar…" sözcüğü `#/donem/derslerim/<ders>/piazza/kaynaklar`'a bağlanır (Kaynaklar bölümü açılır). Sözcük piazza.com'a giden bir bağlantının içindeyse o bağlantı çevrilir; başka siteye giden bağlantıya dokunulmaz, sonraki geçişe bakılır.
- Bildirim bağlantıları içeriğin kendisini açar: Piazza `#/donem/derslerim/<ders>/piazza/<gönderi kimliği>` (gönderi yanıtlarıyla açık gelir), Uzak `.../uzak/<cmid>` (etkinlik vurgulanır; `focusCourseItem`). E-postadaki "Aç:" bağlantısı Windows'ta bu sayfaya, uygulama bağlantısı olmayan telefonda Piazza'daki gönderiye (`piazza.com/class/<nid>/post/<nr>`) gider.
- Hatırlatmalar: Akademik Takvim satırları 3 gün kala, başladığı gün ve son gün gelir. Sınavlar Ortam'daki sınav takviminden, sınavdan önceki 24 saat içinde bir kez gelir.

## Android (ETÜ Cep)

`server/` kodunun aynısı WebView içinde çalışır, telefonda yerel sunucu yoktur. `scripts/mobil.mjs` esbuild ile `mobile/core.mjs` paketini (`core.js`) üretir ve `public/` ile birlikte APK'ya koyar.

- **Yönlendirme:** `mobile/core.mjs` `fetch`'i üçe ayırır: `/api/*` doğrudan `handleApi`, okul siteleri `Native.http`, uygulama dosyaları WebView.
- **Gezinme:** Telefonda alt çubukta Ana Sayfa, Dönem, Sınav, Posta, Piazza ve "Menü" vardır. `side: true` olan bölümler (Profil, UBS, UZAKYDB, Ekstra, Hakkında, Hesap) Menü'nün açtığı yan çekmecededir. Alt sayfası olan bölüm çekmecede masaüstündeki gibi açılır, sayfaya alt sayfa seçilince gidilir. Bu düzen web arayüzünün telefon görünümünde de aynıdır.
- **Karşılıklar:** `browser`, `pdf`, `vault`, `credentials`, `update` dosyaları derlemede `mobile/shim/` sürümleriyle değişir. `node:fs`, `crypto`, `path`, `zlib` da orada.
- **Köprü:** `Native.kt` dosya, şifreleme, ağ, bildirim, giriş penceresi, indirme ve APK kurulumunu sağlar. `Native` varlığı arayüzde `window.Native` ile anlaşılır.
- **İçerik güvenliği:** `Native` dosyalara eriştiği için telefonda sıkı CSP vardır (`scripts/mobil.mjs`): satır içi betik ve olay özniteliği çalışmaz. `public/` içine `onclick=` gibi satır içi kod ekleme.
- **Şifreleme:** AES-256-GCM veri anahtarı Android Keystore ile sarılır (`Vault.kt`). Yedekleme kapalıdır.
- **Giriş:** Doğrudan girişler Windows'la aynıdır. Ortam ve doğrulama isteyen durumlar `LoginActivity`'deki gerçek site sayfasında yapılır, doğrulamayı kullanıcı yanıtlar.
- **Bildirim:** `Background.kt` görünmez WebView'de `arka-plan.html` açar ve `notify.runDue()` çalıştırır. WorkManager 15 dakikada bir, ayrıca Doze'da da uyanan 30 dakikalık alarm vardır. Uzak aralığı Android'de 30 dakikadır. Gerçek zamanı Android belirler; pil kısıtlaması kapatılırsa gecikme azalır.
- **Ağ:** Okulun alan adları (`etu.edu.tr` ve alt alan adları) için okulun ara sertifikası (SSL.com TLS Issuing RSA CA R1) da güvenilir sayılır (`res/xml/ag_guvenligi.xml`, `res/raw/uzak_ara.pem`): Uzak ara sertifikayı göndermiyor, diğer siteler de bazı Android sürümlerinde bulunmayan SSL.com 2022 köküne dayanıyor. Sertifikanın süresi dolunca dosya yenilenmelidir.
- **Hata günlüğü:** WebView'deki uyarı/hatalar ve başarısız ağ işlemleri telefonun sistem günlüğüne `EtuCep` etiketiyle yazılır: `adb logcat -s EtuCep`. Şifre ya da içerik yazılmaz.
- **Telefonda gezinme:** Yan çekmecedeki bölümlerin (Profil, Ekstra, Hakkında…) alt sayfaları çekmecede açılır; bu bölümlerde sayfanın üstünde ayrıca sekme çubuğu gösterilmez (`.tabs.subnav.side`). Alt çubuktaki bölümlerin (Dönem vb.) sekmeleri durur.
- **Güncelleme:** `mobile/shim/update.mjs` GitHub'daki `.apk` dosyasını bulur. Yalnızca kullanıcı "Güncelle"ye basınca indirilir, SHA-256 doğrulanır ve Android kurulum ekranı açılır.
- **İmza:** Anahtar `mobile/android/imza/` içindedir ve gitignore'dadır. GitHub'da `ETUCEP_KEY_B64` ve `ETUCEP_KEY_PASSWORD` gizli değişkenleridir. Anahtar kaybolursa kurulu uygulamalar güncellenemez.
- **Derleme:** `npm run mobil`, sonra `mobile/android` içinde `sh ./gradlew :app:assembleRelease`. Java olarak Android Studio'nun `jbr` klasörü kullanılır (`JAVA_HOME`). Yerelde `local.properties` içinde `sdk.dir` gerekir.
- **Masaüstünde deneme:** Telefon paketi sahte `Native` ile başsız Chrome'da çalıştırılabilir. Gerçek davranış için cihazda `adb install` ile dene.

## Güvenlik modeli

- Sunucu yalnızca `127.0.0.1` dinler. `Host` başlığı denetlenir. POST isteklerinde `Origin` ve içerik türü doğrulanır.
- Şifre yalnızca "Beni hatırla" seçiliyse `.cache/credentials.dpapi` içinde DPAPI ile saklanır. Seçili değilse bellekte kalır ve yeniden başlatınca kaybolur.
- Çerezler (`.cache/jars.enc`), kişisel önbellek (`.cache/api`) ve `.cache/notify.json` AES-256-GCM ile şifrelidir. Anahtar `.cache/key.dpapi` içinde DPAPI ile korunur.
- Bu şifreleme, aynı Windows hesabında çalışan başka bir programa karşı koruma sağlamaz. Bunu kullanıcıya söylerken abartma.
- Oturumu kapatma sitenin kendisinde de çıkış yapar (UBS hariç), çerezleri ve o sitenin önbelleğini siler. Site, kullanıcı yeniden girene kadar `loggedOut` kalır.
- İsteğe bağlı PIN 4–8 rakamdır, scrypt özeti saklanır. Kilit açılmadan veri uçları 423 döner.
- `.cache`, `.profile`, `dump`, `tools` ve `local.txt` kişisel ya da yereldir, `.gitignore` içindedir. Asla yayımlanmaz.

## Sürüm, paketleme ve güncelleme

Sürüm paketi GitHub Actions'ta üretilir. Yerelde üretilen zip asla yüklenmez.

1. `package.json` sürümünü artır.
2. `notlar/vX.Y.Z.md` dosyasını yaz.
3. Commit'le ve `main`'e gönder.
4. `git tag -a vX.Y.Z -m "Ortam Sade X.Y.Z"` ve `git push origin vX.Y.Z`.
5. `.github/workflows/surum.yml` Windows üzerinde kurulum dosyası, zip ve APK üretir, ikisine imzalı kaynak kanıtı ekler ve sürümü yayımlar. Sürüm notuna doğrulama komutu kendiliğinden eklenir.

**Kurulum dosyası:** `kurulum/OrtamSade.iss` (Inno Setup) `dist/OrtamSade` klasöründen `OrtamSade-X.Y.Z-kurulum.exe` üretir. Kurulum yönetici izni istemez, `%LOCALAPPDATA%\Programs\Ortam Sade` klasörüne kurar. Başlat menüsüne kısayol koyar; isteğe bağlı olarak masaüstü kısayolu ve açılışta başlatma (`OrtamSade.exe --arka`: yalnızca tepsi; varsayılan olarak işaretli) ekler. Kısayollar `OrtamSade.exe`'yi açar; `ortamsade:` bağlantı türü HKCU'ya yazılır ve kaldırınca silinir; kaldırmadan önce açık uygulama `taskkill` ile kapatılır. Güncellemede (`PrepareToInstall`) açık uygulama önce `/api/shutdown` ile düzgün kapatılır, kalan olursa `taskkill` ile; uygulama X'te tepsiye indiği için Windows'un yeniden başlatma yöneticisi onu kapatamaz (sessiz kurulum 5 koduyla vazgeçiyordu). Kaldırırken `.cache` ve `.profile` yalnızca kullanıcı onaylarsa silinir. Uygulamanın kendi güncellemesi kurulum klasöründe de çalışır. Simge `kurulum/simge.ico`'dur. Paket yalnızca üretimde kullanılan bağımlılıkları içerir (package-lock'ta `dev` olanlar girmez). Yerelde derlemek için: `npm run paketle`, sonra PowerShell'de `& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" /Q "/DSurum=X.Y.Z" kurulum\OrtamSade.iss` (Git Bash `/Q` gibi seçenekleri yola çevirdiği için PowerShell kullan).

`npm run paketle` yalnızca yerel deneme içindir. Paket `dist/OrtamSade-X.Y.Z-win-x64.zip` adıyla çıkar ve `runtime/node.exe` içerir. Yeni bir kök klasör pakete girecekse `scripts/paketle.mjs` listesine eklenmelidir.

**Güncelleme (`server/update.mjs`):** Uygulama GitHub'daki son sürümü açılıştan 1 dakika sonra ve 6 saatte bir denetler, yeni sürüm varsa sorar. Kurulum yalnızca kullanıcı "Güncelle"ye basınca yapılır.

- Paketli ya da git'siz kurulum: zip indirilir, GitHub'ın SHA-256 özetiyle doğrulanır, dosyalar yedekli değiştirilir.
- Git klasörü: sürüm etiketine ileri sarılır, gerekirse bağımlılıklar kurulur.
- Sonra uygulama yeniden açılır ve `.cache` korunur.

## Değişmez kurallar

**Güvenlik**

- `local.txt` dosyasını asla okuma. Kullanıcı oraya kimlik bilgisi yazdı.
- Şifreyi hiçbir forma kendin yazma. Şifreyi kullanıcı Hesap ekranında girer.
- CAPTCHA ve güvenlik doğrulamalarını çözme, aşma, atlatma. Doğrulama sorusunu kullanıcı yanıtlar.
- Testte form gönderme, e-posta gönderme, e-posta silme ya da geri alınamaz düğmeye basma; açık izin olmadan yapma.
- Her push'tan önce kişisel veri olmadığını kontrol et.
- TC kimlik, adres, iletişim ve telefon bilgilerini arayüzde gizle.
- Kalıcı silme yapma (yayımlanmış sürüm silme, geçmişi zorla yeniden yazma dahil). Gerekirse kullanıcının çalıştıracağı komutu ya da betiği hazırla.

**Çalışma biçimi**

- Her istek bitince mutlaka commit at. Sık push serbest.
- Her işten sonra bu belgeyi güncelle.
- Sürüm artırma, paketleme ve sürüm etiketi kullanıcı tarafından önceden onaylı.
- "Görünmez güncelleme yok": hiçbir şey kullanıcı onayı olmadan kurulmaz.
- Kullanıcıyla Türkçe konuş, kısa ve net yaz.
- Yalnızca açılan ekranın verisini çek, okulun sunucularını yorma.
- Özellik eklerken yeni tarayıcı penceresi açma; görünür pencere yalnızca giriş için gerekir.
- 3000 portundaki süreci yalnızca komut satırı `server/server.mjs` ise durdur.
- Sayısal ya da hukuki bir bilgiyi kaynaksız yazma; Mevzuat yanıtları maddeye dayanmalı.
- Dersliklerin boş ya da dolu durumunu hiçbir yerde gösterme.

## Geliştirme ortamı ve tuzaklar

- **Kurulum:** `npm install`, sonra `npm run dev` (dosya değişince yeniden başlar) ya da `npm start`. `dev` modu yalnızca `server/` klasörünü izler.
- **Bash ters eğik çizgileri yer:** Heredoc ve `sed` içinde `\b`, `\s` gibi ifadeler bozulur. Ters eğik çizgili kodu Edit ya da Write aracıyla yaz.
- **Git Bash yol dönüştürmesi:** `/tr/...` gibi argümanlar Windows yoluna çevrilir. `MSYS_NO_PATHCONV=1` kullan.
- **Git Bash `tar`:** Zip açamaz. `C:/Windows/System32/tar.exe` kullan.
- **`fs.cpSync`:** Node 24'te Türkçe karakterli yollarda çöker (`0xC0000409`). Paketleme bu yüzden elle kopyalar.
- **`Ortam Sade.cmd`:** CRLF olmalı, `.gitattributes` bunu sağlar. `sed -i` satır sonlarını bozabilir. `if (...)` bloklarında parantezli metin kullanma.
- **Bash heredoc:** Tırnak ya da ters eğik çizgi içeren uzun heredoc'lar bu ortamda bozulabilir. Dosyaları Write aracıyla yaz.
- **JS `/i` ve Türkçe:** `İ` ile `i` kendiliğinden eşleşmez. Türkçe karşılaştırmada `trFold` (arayüz) ya da `norm` (mevzuat) kullan.
- **Uzak TLS:** `uzak.etu.edu.tr` ara sertifikayı göndermez. Windows sertifika deposu `session.mjs` içinde güvenilenlere eklenir.
- **`public/app.js`:** Tek dosyadır ve üst düzey adlar çakışabilir. Yeni `const` eklemeden önce arat. Hızlı denetim: `node --check public/app.js`.
- **`details` ve `data-lazy`:** `data-lazy` tembel yükleme işleyicisini tetikler. Yalnızca açık durumu korumak için `data-keep` kullan.
- **Windows bildirimi:** Otomatik testte gerçek bildirim üretme. `/api/notifications` yanıtını Playwright ile sahte veriyle değiştir.
- **Güncelleme testi:** `ORTAM_UPDATE_FEED=http://127.0.0.1:<port>/...` ile sahte sürüm kaynağı verilebilir. Paketi temiz klasörde, ayrı `PORT` ile dene.
- **Arayüz testi:** Başsız Chrome ile `playwright-core` kullan, masaüstü (1280) ve telefon (390) ekran görüntüsü alıp bak. `tools/` klasörü gitignore'dadır, yardımcı betikler orada durabilir.
- **Test sonrası:** Başlattığın sunucuyu kapat. Kullanıcı uygulamanın ne zaman açık olduğunu bilmek ister.
