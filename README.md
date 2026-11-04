# Ortam Sade

TOBB ETÜ'nün her gün açılan okul sitelerini — **Ortam, UBS, Uzak, UZAKYDB, Webmail ve Piazza** — tek, sade bir arayüzde
toplayan, **senin bilgisayarında çalışan** açık kaynaklı bir öğrenci projesi.

> **Resmî değildir.** TOBB ETÜ tarafından geliştirilmemiş, onaylanmamış ve desteklenmemektedir. Ders kaydı, not, sınav yeri,
> başvuru gibi resmî konularda her zaman okulun kendi sistemleri esastır.

## Neler var?

- **Ana Sayfa:** bugünkü dersler (ve varsa sınavlar), yaklaşan sınavlar, posta, Piazza; en son kullandığın 6 sayfa.
  Üstte: Ortam'da seni bekleyen anket ve duyurular, UZAKYDB'deki dönemsel ek içerik ve Akademik Takvimde yaklaşan son tarihler.
- **Derslerim:** her dersin Piazza gönderileri ve kaynakları, Uzak içeriği ve Ortam'daki "Derse Bakış" tek sayfada.
- **Ders Programım:** şu anki saat çizgisi; sınavlar kendi haftasında, yeriyle birlikte.
- **Sınav Takvimi:** hangi sınav dönemindeysen (Ara Sınav / Final / Bütünleme); her sınav tek satırda: tarih ve gün, ders,
  saat, yer ve kalan süre.
- **Ortalama ve Ders Planı:** GNO, kredi durumu, dönemlik kredi sınırı, hedef not ve yükseltme hesabı (yönetmeliğe göre).
- **Webmail:** okundu/okunmadı senkronizasyonu, yazma/yanıtlama/silme, yıldızlar, isteğe bağlı otomatik silme (Çöp'e taşır).
- **UBS, UZAKYDB, Piazza** kendi sade arayüzleriyle; PDF'ler uygulamanın içinde açılır.
- **Bildirimler:** Piazza ve Uzak'a yeni içerik gelince Windows bildirimi ve isteğe bağlı özet e-posta; menüde ve derslerin
  üzerinde kaynağın renginde nokta (Uzak turuncu, Piazza mavi). Akademik Takvimdeki önemli tarihler (ders kaydı, ekle-sil,
  dersten vazgeçme, ÇAP/YAP başvurusu, sınavlar) için 3 gün kala, başladığı gün ve son gün hatırlatma.
- **Senin durumun:** Mevzuat yanıtlarında transkriptine göre kişisel değerlendirme (ör. YAP'a hangi dönem başvurabileceğin,
  GNO şartı, kalan dersten vazgeçme ve not yükseltme hakların).
- **Mevzuat:** okulun Mevzuat sayfasındaki kanun, yönetmelik ve yönergeler uygulamanın içinde madde madde okunur ve aranır
  ("kayıt dondurma", "YAP" gibi gündelik sözlerle de). Sık sorulan kurallar (ÇAP/YAP başvurusu, dersten vazgeçme, ders tekrarı,
  mazeret, not itirazı, MES, dönem izni…) dayandıkları maddeyle kısa yanıt olarak verilir. Uygulama, alıntılanan maddenin hâlâ
  aynı olduğunu her açılışta denetler. Dayandığı yönetmelik sonradan değişmiş yönergeler ve duyurulardaki eski sürüm bağlantıları
  işaretlenir. Öğrenci İşleri duyuruları da burada.
- **Ekstra:** Açılan Dersler, Akademik Takvim, Akademik Kadro, Yabancı Diller; ÇAP/YAP ve hareketlilik başvuruları.
- Açık/koyu tema, telefona uygun düzen.

## İndir ve çalıştır (Windows 10/11)

1. [Releases](https://github.com/Soft-Coder-183/ortam-sade/releases/latest) sayfasından `OrtamSade-…-win-x64.zip` dosyasını indir.
2. Zip'i bir klasöre **çıkar** (zip'in içinden çalıştırma).
3. **`Ortam Sade.cmd`** dosyasına çift tıkla. Uygulama tarayıcında `http://localhost:3000` adresinde açılır.
4. **Hesap** ekranında okul e-postanı ve şifreni gir. Şifren sitelerde farklıysa "Siteye özel şifreler" bölümünü kullan.

- Açılan siyah pencere açık kaldıkça uygulama çalışır; kapatınca durur.
- Windows "bilinmeyen yayımcı" uyarısı verirse: *Ek bilgi → Yine de çalıştır*. (Dosya imzasız bir betik; içeriğini bu depoda görebilirsin.)
- Gerekenler: Google Chrome **veya** Microsoft Edge (Ortam girişi ve PDF oluşturma için). Node.js kurmana gerek yok, pakette var.

## Güncelleme

Yeni sürüm çıkınca uygulama sağ altta **"Ortam Sade x.y.z yayınlandı — güncellemek ister misin?"** diye sorar (bir kez de Windows bildirimi gelir).
**Görünmez güncelleme yoktur:** "Güncelle"ye basmadan hiçbir şey indirilmez. Basınca:

1. Sürüm dosyası yalnızca bu deponun GitHub Releases sayfasından indirilir ve GitHub'ın yayımladığı **SHA-256 özetiyle doğrulanır**; uyuşmazsa kurulmaz.
2. Uygulama dosyaları değiştirilir (eski sürüm kurulum bitene kadar yedekte durur, hata olursa geri konur). Şifren, oturumların ve ayarların (`.cache`) korunur.
3. Uygulama kendini yeniden başlatır, açık sayfa yenilenir.

Sürümü ve "Güncellemeleri denetle" düğmesini **Hakkında ve SSS → Hakkımızda** sayfasında bulabilirsin.
> 1.0.0 kullanıyorsan bu özellik sende yok: 1.1.0'ı bir kez elle indirip eski klasörün üzerine çıkarman yeterli (`.cache` klasörün korunur).

## Güvenlik ve gizlilik

- Uygulama yalnızca **senin bilgisayarında** çalışır ve yalnızca `127.0.0.1`'den erişilebilir; okulun sitelerine doğrudan, senin oturumunla bağlanır. Arada başka bir sunucu yoktur.
- Şifren yalnızca "Beni hatırla" seçiliyse, **Windows'un şifreli kasasında (DPAPI)** saklanır; yalnızca o bilgisayardaki Windows hesabın açabilir.
- Okuldan alınan sayfalar, çerezler ve ayarlar uygulama klasöründeki `.cache` içinde kalır; hiçbir yere gönderilmez, toplanmaz.
- Bildirim e-postaları senin okul adresinden yine sana gönderilir.
- Uygulama **CAPTCHA ve güvenlik doğrulamalarını aşmaz**; doğrulama isteyen işlemler için okulun sayfasına bağlantı verir.
- Okula bir şey gönderen işlemler (form, e-posta gönderme/silme) yalnızca senin tıklamanla ya da açtığın bir ayarla yapılır.

## Okulun sunucularına yük

Yalnızca açtığın ekranın sayfası okuldan istenir ve kısa süre önbellekte tutulur. Arka planda yapılanlar:

| İş | Sıklık |
|---|---|
| Ortam oturumunu açık tutma | 10 dakikada bir |
| UBS oturumunu açık tutma | 15 dakikada bir |
| Webmail / Uzak / UZAKYDB / Piazza oturumu | 2,5–4 saatte bir |
| Piazza yeni gönderi kontrolü | 30 dakikada bir |
| Akademik Takvim hatırlatmaları (okulun herkese açık sitesi) | 6 saatte bir |
| Ortam ana sayfa anket/duyuruları, UZAKYDB ek içerik | yalnızca Ana Sayfa / UZAKYDB açılınca (30 dk / 6 sa önbellek) |
| Uzak yeni içerik kontrolü | saatte bir |
| Yeni sürüm denetimi (GitHub) | 6 saatte bir |
| Mevzuat metinleri (mevzuat.gov.tr, okulun sitesi) | yalnızca Mevzuat açılınca; her belge haftada en fazla bir kez |

O aralıkta siteye zaten bir istek gittiyse oturum kontrolü atlanır. Uygulama kapalıyken hiçbir istek yapılmaz.

## Geliştirme

```bash
npm install
npm run dev        # sunucu dosyaları değişince kendini yeniden başlatır
npm start          # normal çalıştırma
npm run paketle    # dist/ altına paylaşılabilir Windows paketi (Node.js dahil)
```

Yapı: `server/` (Node, her site için bir modül: `ortam`, `ubs`, `moodle` (Uzak/UZAKYDB), `webmail`, `piazza`, `mevzuat` …),
`public/` (tek sayfalık arayüz). Sunucu her ekran için okulun tek sayfasını açıp sadeleştirilmiş JSON döndürür.
Hızlı yanıt eklemek için `server/mevzuat-yanitlar.mjs` dosyasına soru, yanıt ve kaynak maddeden birebir bir alıntı yazman yeterli.

## Lisans

[MIT](LICENSE). Pakette Node.js çalışma ortamı ve bağımlılıklar (cheerio, pdf.js, playwright-core) kendi lisanslarıyla gelir.
