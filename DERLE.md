# Derleme

Tek komut, proje kökünde PowerShell'de:

```powershell
powershell -ExecutionPolicy Bypass -File .\derle.ps1
```

Android SDK'sı olmayan bir bilgisayarda yalnızca Windows için: `powershell -ExecutionPolicy Bypass -File .\derle.ps1 -AndroidYok`

## Ne üretir

Hepsi `dist\` altına, sürüm numarası `package.json`'dan:

| Dosya | Ne |
|---|---|
| `OrtamSade-X.Y.Z-kurulum.exe` | Windows kurulum dosyası (tek tıkla kurulur, yönetici izni istemez) |
| `OrtamSade-X.Y.Z-win-x64.zip` | Kurulumsuz Windows sürümü (açıp `OrtamSade.exe`'ye çift tıkla) |
| `EtuCep-X.Y.Z.apk` | Android uygulaması (imzalı) |

Betik sırayla şunları yapar:
1. Bağımlılıklar: `npm install`.
2. Windows paketi: `npm run paketle`. `OrtamSade.exe` de `dotnet publish` ile burada derlenir.
3. Kurulum dosyası: Inno Setup.
4. Android web içeriği: `npm run mobil`.
5. İmzalı APK: Gradle.

Bir adım hata verirse durur ve hangi adımın başarısız olduğunu yazar.

## Gerekenler

- Node.js 24 (`node -v`), .NET SDK (`dotnet --version`), Inno Setup 6 (`winget install JRSoftware.InnoSetup`)
- Android için: Android Studio (Java'yı `Android Studio\jbr` içinden alır), Android SDK (`mobile/android/local.properties` içinde
  `sdk.dir`), imza anahtarı `mobile/android/imza/etucep.keystore` + `parola.txt` (depoda yok, yalnızca bu bilgisayarda)

## Nasıl denenir

- **Windows:** `dist\OrtamSade-X.Y.Z-kurulum.exe`'yi çalıştır (var olan kurulumu günceller, açık uygulamayı önce kapatır).
  Kurmadan denemek için: `npm start` ve tarayıcıda `http://localhost:3000`; kurulu kopya 3000'i tutuyorsa `$env:PORT=3100; npm start`.
- **Android:** Telefonu USB hata ayıklamayla bağla, `C:\Android\Sdk\platform-tools\adb.exe install -r dist\EtuCep-X.Y.Z.apk`.
  Hata günlüğü: `adb logcat -s EtuCep`.
- **Yayın** (herkese dağıtılan sürüm GitHub'da derlenir, yerel çıktı yüklenmez): `CLAUDE.md` → Commit ve sürüm.
