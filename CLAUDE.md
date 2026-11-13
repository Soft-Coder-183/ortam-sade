# Ortam Sade / ETÜ Cep

TOBB ETÜ'nün okul sitelerini (Ortam, UBS, Uzak, UZAKYDB, Webmail, Piazza) tek sade arayüzde toplayan açık kaynak uygulama.
Windows'ta **Ortam Sade** (yerel Node sunucusu + `OrtamSade.exe` WebView2 penceresi), Android'de **ETÜ Cep** (aynı `server/` kodu
WebView içinde). Sahibi Eren Akyurt; Türkçe konuşulur. Depo herkese açık (MIT): https://github.com/Soft-Coder-183/ortam-sade
Ayrıntılar `PROJE_DEVIR.md`'de; bir alana dokunmadan önce ilgili bölümünü oku (en altta liste).

## Komutlar
- Kurulum: `npm install` · Geliştirme: `npm run dev` (server/ değişince yeniden başlar) · `npm start`
- **Derleme (hepsi):** `powershell -ExecutionPolicy Bypass -File .\derle.ps1` → `dist\` (kurulum exe, zip, APK). Ayrıntı: `DERLE.md`
- Parça parça: `npm run paketle` (zip + exe) · Inno Setup için PowerShell'de
  `& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" /Q "/DSurum=X.Y.Z" kurulum\OrtamSade.iss` ·
  `npm run mobil` + `mobile/android` içinde `gradlew :app:assembleRelease` (JAVA_HOME = Android Studio `jbr`)
- Sözdizimi: `node --check public/app.js` (ve değişen `.mjs`)
- **Deneme:** Kullanıcının kurulu kopyası (`%LOCALAPPDATA%\Programs\Ortam Sade`) 3000 portunu tutar ve depodaki kodu göstermez;
  onu durdurma. Depodaki sürümü `PORT=3100 node server/server.mjs` ile aç, başsız Chrome (`playwright-core`, `channel: 'chrome'`)
  ile `tools/` altındaki betiklerle dene (tools/ gitignore'da). Okula giden geri alınamaz istekleri `page.route` ile sahte yanıtla
  kes. Bitince 3100'ü kapat (sahibinin `server/server.mjs` olduğunu denetleyerek).
- **Kurulu kopyayı güncelleme:** `dist\OrtamSade-X.Y.Z-kurulum.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`, sonra exe'yi
  `Invoke-CimMethod Win32_Process -MethodName Create` ile aç (araç kabuğundan açılan süreç onunla ölebilir).

## Düzen
- `server/`: çekirdek (`api.mjs` = bütün `/api/*`), site modülleri (`ortam`, `ubs`, `moodle`, `webmail`, `piazza`, `etu`, `mevzuat`,
  `rezervasyon`), oturum (`session.mjs`, `autologin.mjs`, `browser.mjs`), `notify.mjs`, `update.mjs`; `server.mjs` Windows HTTP sarmalı
- `public/`: tek sayfalık arayüz; `app.js` tek dosyadır (üst düzey adlar çakışabilir, yeni ad eklemeden önce arat), `style.css`
- `mobile/`: Android (`core.mjs`, `shim/`, `metinler.mjs` = telefona özgü metin değişimleri, `android/` Kotlin projesi)
- `masaustu/`: `OrtamSade.exe` (C#, .NET Framework 4.8, WinForms + WebView2) · `kurulum/`: Inno Setup betiği ve simge
- `notlar/vX.Y.Z.md`: sürüm notları · `data/`: uygulamayla gelen veri · `.github/workflows/surum.yml`: yayın

## Kod kuralları
- Arayüz metni Türkçe. Türkçe karşılaştırmada `trFold` (arayüz) / `norm` (mevzuat); JS `/i` `İ`/`i`'yi eşlemez.
- `app.js`'teki bir metni değiştirirsen `mobile/metinler.mjs`'te aynı metni arayan satırı da değiştir (yoksa `npm run mobil` durur).
- Tembel yüklenen bölüm `details[data-lazy]`; yalnızca açık kalması için `data-keep`. Yeni ekran yalnızca kendi `/api/*` ucunu çağırır.
- Bir ayrıştırıcının çıktısı değişince `server/api.mjs` içindeki `CACHE_VER`'i artır.
- Büyük düzenlemelerde satır sonunu koruyan küçük yama betikleri; ters eğik çizgili kodu Bash heredoc'una değil Write aracına yaz.

## Kurallar
- `local.txt` asla okunmaz. Şifre hiçbir forma yazılmaz; CAPTCHA/doğrulama çözülmez ya da atlatılmaz (kodu kullanıcı yazar).
- Testte gerçek giriş, e-posta gönderme/silme, form/başvuru, rezervasyon yok; gerekiyorsa önce sor.
- Kişisel bilgiler (TC, adres, telefon) uygulamada gösterilir; testte değerleri yazdırma, ekran görüntüsüne ve commit'e koyma.
- Okul sunucularını yorma: yalnızca açılan ekranın verisini çek. Derslik boş/dolu durumu hiçbir yerde gösterilmez.
- Sayısal ya da hukuki bilgi kaynaksız yazılmaz; Mevzuat yanıtları maddeden alıntıya dayanır.
- Görünmez güncelleme yok: uygulamada hiçbir şey kullanıcı onayı olmadan kurulmaz.
- Görünür tarayıcı penceresi yalnızca giriş ve okulun sitesinde yapılması gereken işler (ör. Ortam anketi) için açılır.
- `.cache`, `.profile`, `dump`, `tools`, `yeni`, `arsiv`, `mobile/android/imza/` yayımlanmaz (gitignore).

## Commit ve sürüm (global G2, G6, G7)
- Her istek commit'le biter; yalnızca değişen dosyalar adıyla eklenir; push serbest; `main`'de çalışılır.
- Sürüm numarasının tek kaynağı `package.json` (Android `versionCode` ondan türer). Yayımlanmamış değişiklikler sıradaki
  `notlar/vX.Y.Z.md`'de birikir; notlar kullanıcıya dönük, başta özet tablo, bölümlü ve sayılı.
- **Yayın** (sürüm artırma, etiket ve yayın kullanıcı tarafından önceden onaylı): `package.json` sürümü → not tamam → commit →
  `git tag -a vX.Y.Z -m "Ortam Sade X.Y.Z"` → `git push origin vX.Y.Z`. `surum.yml` GitHub'ın Windows makinesinde kurulum exe'si,
  zip ve imzalı APK üretir (imza: `ETUCEP_KEY_B64`, `ETUCEP_KEY_PASSWORD` gizli değişkenleri), kaynak kanıtı ekler, yayımlar.
- Yayımlanmış etiket taşınmaz; hata çıkarsa yeni PATCH. Zorla gönderme ve kalıcı silme izin denetimine takılır: komutu hazırla,
  kullanıcı `!` ile çalıştırır.
- Her işten sonra bu dosya ve `PROJE_DEVIR.md` güncellenir (`devret` skill'i). Kullanıcıya Türkçe, kısa rapor: ne yapıldı,
  neyin gerçekten denendiği, neyin denenmediği.

## PROJE_DEVIR.md'de
- **Mimari, Dosya haritası:** yeni modül ya da uç eklerken
- **Özellikler:** bir ekranı değiştirmeden önce o ekranın paragrafı (planlayıcı, rezervasyon, webmail, masaüstü, ilk açılış…)
- **Arka plan işleri ve bildirimler:** zamanlayıcı, bildirim, otomatik silme işlerinde
- **Android (ETÜ Cep):** telefon tarafında, imza ve derlemede
- **Güvenlik modeli:** şifre, çerez, şifreleme, PIN işlerinde
- **Sürüm, paketleme ve güncelleme:** kurulum dosyası, paket ve uygulama içi güncellemede
- **Geliştirme ortamı ve tuzaklar:** Windows/Git Bash tuzakları, test düzeni
