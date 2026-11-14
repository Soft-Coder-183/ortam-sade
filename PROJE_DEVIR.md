# Ortam Sade: Proje Devir Belgesi

Ortam Sade, TOBB ETÜ'nün okul sitelerini (Ortam, UBS, Uzak, UZAKYDB, Webmail, Piazza) tek ve sade bir arayüzde toplayan açık kaynaklı bir uygulamadır. Windows'ta öğrencinin bilgisayarında, Android'de "ETÜ Cep" adıyla telefonunda çalışır. Bu belge, projeyi devralan bir agent'ın önceki konuşmaları görmeden işe başlayabilmesi için yazıldı. Her oturumda gereken özet, komutlar ve kurallar `CLAUDE.md`'dedir (kendiliğinden yüklenir); bu belge gerektiğinde okunan ayrıntıdır.

- **Sahibi:** TOBB ETÜ öğrencisi Eren Akyurt. Türkçe konuşur, uygulamayı arkadaşlarıyla paylaşır.
- **Depo:** https://github.com/Soft-Coder-183/ortam-sade (herkese açık, MIT lisansı).
- **Durum:** Yayımlanmış sürüm 1.7.0 (Windows kurulum dosyası, zip ve Android APK; 11 Kasım 2026). İmza anahtarı GitHub gizli değişkenlerinde (`ETUCEP_KEY_B64`, `ETUCEP_KEY_PASSWORD`). Telefonda girişin gerçek cihazda doğrulanması bekliyor. GitHub hesabı `gh` ile bağlı. Yayımlanmamış (13 Kasım 2026, `notlar/v1.8.0.md`): Windows/web giriş ekranı, tek tip "Giriş yap" düğmeleri ve "oturum kapalı" kutusu; `package.json` hâlâ 1.7.0. Tanıtım videosu (14 Kasım 2026): `npm run tanitim` ile üretilir, çıktı `dist/tanitim/OrtamSade-tanitim.mp4` (depoda değil); seslendirmenin okunuşu kulakla dinlenmedi, video henüz bir yere yüklenmedi.
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
| `CLAUDE.md` | Her oturumda yüklenen özet, komutlar, kurallar (devret sistemi, katman 1) |
| `DERLE.md`, `derle.ps1` | Tek komutla kurulum exe'si, zip ve APK üretimi |
| `tanitim/` | Tanıtım videosu üretimi: `yap.mjs` (seslendirme → kayıt → birleştirme), `sahneler.mjs` (senaryo), `kayit.mjs` (ekran kaydı), `veri.mjs` (sahte öğrenci verisi), `kartlar.html` (tam ekran kartlar). Pakete ve APK'ya girmez |
| `masaustu/` | Masaüstü penceresi `OrtamSade.exe` (C#, .NET Framework 4.8, WinForms + WebView2) |
| `Ortam Sade.cmd` | Yedek başlatıcı: siyah pencere, tarayıcıda açar (CRLF olmalı) |

## Özellikler

| Menü | İçerik |
|---|---|
| Profil | Bilgilerim, Not Görüntüleme, Ortalama ve Ders Planı, Müfredat (programlar sekmeli), Ortak Eğitim, İkinci Yabancı Dil, Ödeme, Adres ve İletişim |
| Ana Sayfa | Bugünkü dersler ve sınavlar, yaklaşan sınavlar, posta, Piazza, son kullanılan 6 sayfa; üstte Ortam'da bekleyen anket ve duyurular ("Ankete git"), UZAKYDB ek içerik, yaklaşan son tarihler |
| Dönem Bilgilerim | Derslerim (Ortam, Uzak, Piazza tek sayfada), Ders Programım |
| Sınav Takvimi | Ara Sınav, Final ya da Bütünleme; her sınav tek satırda |
| Webmail | Anında silme (Yabancı Diller "New sign in to your … account" e-postaları ve okulun rezervasyon e-postasının aynı gönderen/konu/tarihli ikinci kopyası (`rezDuplicates`, eskisi kalır) gelir gelmez Çöp'e; varsayılan açık), bildirim e-postaları okunduktan `notif.readHours` (6 sa) ya da gelişinden `notif.afterHours` (12 sa) sonra Çöp'e, süre seçenekleri 6/12/24/72 saat, Çöp kutusunu boşaltma (Çöp'te 30 gün, bildirim ve anında silinenler 3 gün sonra kalıcı silinir; süre Çöp'te ilk görülmeden sayılır, `trashAt`; saatlik turda; yıldızlılar silinmez; varsayılan açık), okundu senkronizasyonu, yazma, yanıtlama, yıldızlar, tarihe göre sıralı klasörler, satırda Sil, Çöp'te Geri getir; otomatik silme (okunanlar seçilen sürede Çöp'e, varsayılan kapalı; uygulamanın bildirim e-postaları varsayılan 12 saatte Gelen ve Gönderilmiş'ten Çöp'e; açık e-postanın altında "Otomatik silinmesin") |
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
- **Arama kutusu:** Plandaki dersler kutunun içinde blok (`.ac-chip`): koda basınca ders yan panelde açılır, × plandan çıkarır, boş kutuda geri silme son dersi çıkarır. Tek şubeli dersin bloğu mor.
- **Müfredattan getir:** Ortam'daki Müfredat sayfası (`/api/mufredat`) planlayıcının her dönemi için bir kez okunur, `localStorage` `mufredat-plan` (v2)'de saklanır. Müfredat sayfasındaki her sekme bir programdır (`programs`; çift anadal/yandal öğrencisinde ikinci sekme), kutuda program ve dönem seçilir. Bulunduğun dönem, bu dönem kayıtlı olduğun derslerle en çok örtüşen dönemdir. Bütün dönemler görünür (tamamlananlar ✓), derslerin yanında harf notu yazar. Eklenenler: o dönemin alınmamış zorunlu dersleri (açılan derslerde olanlar) ve "İYD n" yerleri; diğer seçmeli yer tutucuları ("ASD-1") eklenmez.
- **İYD grupları:** `taslak.groups["İYD 1"] = { choice }`. Seçenekler o düzeydeki açılan dil dersleri (ad "Almanca I" … düzeyi Roma rakamından). Seçilen ders `taslak.courses`'a normal ders olarak girer; dil değişince eskisinin yerini alır, ders çıkarılınca grup da çıkar. Ortam'daki İkinci Yabancı Dil sayfasında "Seçmeli Ders Kodu" doluysa o dil önceden seçilir.
- **Hoca adı blokta:** `hocaForms()` "Çınla ERÇOKLU" → tam ("Çınla Erçoklu"), kısa ("Ç. Erçoklu"), baş harf ("ÇE"); kapsayıcı sorgusu blok genişliğine göre birini gösterir (`small.pl-hc`). `pl-h` sınıfı gün başlıklarına ait, kullanma.
- **Tek şubeli dersler:** Takvimde leylak zemin, ince mor çerçeve, solda koyu mor çizgi ve sağ üstte küçük kilit (`.pl-b.sel.tek`, `--pl-tek-*`); çakışma görünümü bunun önüne geçer. Yan panelde "Tek şube" yazar.
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

**İlk açılış ve giriş ekranı (`#/giris`):** Kayıtlı giriş bilgisi yoksa (`/api/account` → `email: null`) uygulama giriş ekranıyla açılır; menü gizlidir (`body.welcome`). Kod `public/app.js` sonunda (`renderWelcome`, `loginScreen`, `firstRun`), stiller `style.css`'te `.lg-*`.
- **Bilgisayar ve web arayüzü:** Solda marka paneli (`.lg-brand`: logo, altı site, üç madde), sağda form (`#ilk-giris.lg-form`: e-posta, şifre + göster/gizle, "Beni hatırla"). 860 pikselin altında panel üstte kısa bir bant olur. `body.lgs` sayfa boşluklarını kaldırır.
- **Telefon:** Bir kez `#/hos-geldin` karşılama ekranı (açıklama → "Tamam"), sonra aynı form (`.wc`). Gösterildiği `localStorage` `ilk-giris` ile tutulur; "Şimdilik geç" de bunu işaretler.
- **Akış (ikisinde de aynı işleyici):** `/api/account/login` (bütün doğrudan siteler; her sitenin sonucu satır satır görünür) → Ortam'ın giriş penceresi/sayfası (`/api/login?site=ortam`) → gelinen sayfa, yoksa Ana Sayfa. Bilgisayarda Ortam penceresi beklenirken "Beklemeden devam et" bağlantısı çıkar; o zaman Ortam girişi bitince açık ekran yenilenir. Hiçbir sitede kabul edilmeyen şifrede ekranda kalınır.
- **`hasAccount`:** Kayıtlı bilgi olup olmadığını arayüzde tutar (`firstRun` öğrenir; giriş ve "Kayıtlı bilgileri sil" günceller). `false` iken her "Giriş yap" düğmesi giriş ekranına götürür (`openLoginScreen(from)`), giriş bitince `loginReturn` sayfasına dönülür.
- Gerçek şifreyle giriş (bütün siteler + Ortam penceresi) yeni ekranda henüz denenmedi; sahte yanıtlarla denendi (`tools/giristest.mjs`).

**Durum göstergesi:** `checkServer` 20 saniyede bir `/api/lock`'a sorar. Ayrıca uygulamanın bir `/api/` isteği bağlantı hatasıyla düşerse (ya da kapalıyken biri başarılı olursa) ve sekmeye dönülünce hemen bakar (`window.fetch` sarmalı). Telefonda gösterge gizlidir.

**Hesap ve giriş:** Hesap'tan giriş yapınca sonuçlar Hesap'ta görünür ve hemen 3 saniyelik sayaç başlar, sonra Ana Sayfa açılır ("Hesap'ta kal" sayacı durdurur). Ortam penceresi aynı anda açılır ve arka planda tamamlanır; bu sırada başka sayfaya geçildiyse sayfa yeniden çizilmez. Ortam doğrudan girişi desteklemez (görünmez reCAPTCHA); bilgiler bir sitede kabul edilince görünür pencere kendiliğinden açılır, Oturumlar tablosunda da giriş düğmesi vardır.

- **Giriş düğmeleri:** Hepsi `loginButton(etiket, site, küçük)` ile üretilir (`.btn.primary.login`, giriş simgeli; `sm` tablo ve küçük notlar için). Oturumu kapalı bir sitenin içeriği yerine `loginGate(site, ad, mini)` çıkar: kilit simgesi, "X oturumu kapalı", düğme (`.gate`; `mini` Ana Sayfa kartları ve açılır bölümler için). Yeni bir "oturum kapalı" durumu eklerken düz `<button>` yazma, bunları kullan. Düğmeye basınca kayıtlı bilgi yoksa giriş ekranına (`#/giris`), şifre reddedildiyse `#/hesap/<site>` adresine gidilir; orada bant çıkar ve o sitenin özel şifre alanına odaklanılır.
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

Sürüm paketi GitHub Actions'ta üretilir; yerelde üretilen dosyalar yüklenmez. Yayın adımları `CLAUDE.md`'de, yerel derleme `DERLE.md`'de (`derle.ps1`). `surum.yml` kurulum dosyası, zip ve APK'ya imzalı kaynak kanıtı ekler; sürüm notuna doğrulama komutları kendiliğinden eklenir.

**Kurulum dosyası:** `kurulum/OrtamSade.iss` (Inno Setup) `dist/OrtamSade` klasöründen `OrtamSade-X.Y.Z-kurulum.exe` üretir. Kurulum yönetici izni istemez, `%LOCALAPPDATA%\Programs\Ortam Sade` klasörüne kurar. Başlat menüsüne kısayol koyar; isteğe bağlı olarak masaüstü kısayolu ve açılışta başlatma (`OrtamSade.exe --arka`: yalnızca tepsi; varsayılan olarak işaretli) ekler. Kısayollar `OrtamSade.exe`'yi açar; `ortamsade:` bağlantı türü HKCU'ya yazılır ve kaldırınca silinir; kaldırmadan önce açık uygulama `taskkill` ile kapatılır. Güncellemede (`PrepareToInstall`) açık uygulama önce `/api/shutdown` ile düzgün kapatılır, kalan olursa `taskkill` ile; uygulama X'te tepsiye indiği için Windows'un yeniden başlatma yöneticisi onu kapatamaz (sessiz kurulum 5 koduyla vazgeçiyordu). Kaldırırken `.cache` ve `.profile` yalnızca kullanıcı onaylarsa silinir. Uygulamanın kendi güncellemesi kurulum klasöründe de çalışır. Simge `kurulum/simge.ico`'dur. Paket yalnızca üretimde kullanılan bağımlılıkları içerir (package-lock'ta `dev` olanlar girmez). Inno Setup'ı Git Bash'ten çağırma: `/Q` gibi seçenekleri yola çevirir; PowerShell kullan (`derle.ps1` öyle yapar).

`npm run paketle` yalnızca yerel deneme içindir. Paket `dist/OrtamSade-X.Y.Z-win-x64.zip` adıyla çıkar ve `runtime/node.exe` içerir. Yeni bir kök klasör pakete girecekse `scripts/paketle.mjs` listesine eklenmelidir.

**Güncelleme (`server/update.mjs`):** Uygulama GitHub'daki son sürümü açılıştan 1 dakika sonra ve 6 saatte bir denetler, yeni sürüm varsa sorar. Kurulum yalnızca kullanıcı "Güncelle"ye basınca yapılır.

- Paketli ya da git'siz kurulum: zip indirilir, GitHub'ın SHA-256 özetiyle doğrulanır, dosyalar yedekli değiştirilir.
- Git klasörü: sürüm etiketine ileri sarılır, gerekirse bağımlılıklar kurulur.
- Sonra uygulama yeniden açılır ve `.cache` korunur.

## Tanıtım videosu (`tanitim/`)

`npm run tanitim` yaklaşık 5 dakikalık, 1920×1080, Türkçe seslendirmeli ve müzikli videoyu baştan üretir (10 dakika kadar sürer). Çıktılar `dist/tanitim/` altındadır (gitignore): `OrtamSade-tanitim.mp4` (içinde açılıp kapatılabilen altyazı), `OrtamSade-tanitim.srt`, ara dosyalar (`ses/`, `sahne/`, `norm/`, `foto/`).

- **Veri tamamen uydurmadır.** Depodaki sunucu 3100'de açılır, görünmez Chrome'da gezilir; kişisel bütün `/api/*` uçlarını `veri.mjs` yanıtlar (öğrenci "Ada Örnek"), okula giriş yapılmaz. Yalnızca herkese açık uçlar (`program`, `etu-*`, `mevzuat*`, `hatirlatmalar`, `rezervasyon` GET) gerçek sunucuya geçer; bu yüzden Açılan Dersler, Akademik Kadro ve Duyurular'da gerçek (herkese açık) adlar görünür. Saat `veri.mjs`'teki `SIMDI`'ye sabitlenir (17 Kasım 2026 Salı 10:42); sınav ve ders verisi o güne göre yazıldı.
- **Senaryo `sahneler.mjs`'te:** her sahnede adımlar; `s` altyazı ve seslendirme metni, `oku` seslendirmenin okuyacağı yazım (kısaltmalar: "U B S", "P D F"), `is` o cümle okunurken ekranda yapılanlar. Kayıt seslendirmeye göre ilerler: adım, kendi cümlesinin süresi dolmadan bitmez. Uygulamada bir seçici ya da metin değişirse ilgili sahne zaman aşımıyla durur; `node tanitim/yap.mjs kayit 04-dersler` ile yalnızca o sahne yeniden kaydedilir, sonra `node tanitim/yap.mjs birlestir`.
- **Kayıt (`kayit.mjs`):** Chrome'un ekran akışı (CDP `Page.startScreencast`) sabit 30 kare/sn ile ffmpeg'e verilir. Uygulama 1440×786 CSS pikselinde 4/3 ölçekle çekilir (1920×1048); üstüne `kartlar.html#baslik`'tan alınan 32 piksellik pencere başlığı eklenir. İmleç ve tıklama halkası sayfaya eklenen betikle çizilir. Kartlarda (`k.sabit`) sayfa kaydırılmaz.
- **Ses:** Seslendirme Microsoft Edge'in ücretsiz sinir ağı sesi (`uvx edge-tts`, `tr-TR-AhmetNeural`, `+8%`; `TANITIM_SES`/`TANITIM_HIZ` ortam değişkenleriyle değişir), cümle başına bir dosya, metnin özetiyle önbelleklenir. Müzik ilk çalıştırmada indirilir: "EDM Detection Mode", Kevin MacLeod (incompetech.com), **CC BY 4.0: künye videoda (kapanış kartı) ve paylaşılan her yerde yazılmalıdır.** Konuşma sırasında müzik kendiliğinden kısılır; toplam ses -16 LUFS'a ayarlanır.
- **Tuzaklar:** Birleştirmede `-shortest` kullanma (altyazı akışı son cümlede biter, videoyu erken keser). 3100 portu doluysa betik durur. `rezervasyon` ısıtma isteği girişsiz 502 döner, sayfa yine de açılır. Telefon kartı uygulamayı 390 piksellik bir `iframe`'de gösterir (gerçek APK değil).
- **Denenmedi:** Seslendirme kulakla dinlenmedi (okunuş hataları olabilir; düzeltmek için adıma `oku` yaz). CapCut kullanılmadı.

## Kurallar

Kurallar, komutlar, iş döngüsü ve commit/sürüm uygulaması `CLAUDE.md`'dedir (her oturumda kendiliğinden yüklenir); burada tekrarlanmaz.

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
