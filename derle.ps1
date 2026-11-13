# Ortam Sade / ETÜ Cep: Windows kurulum dosyası, Windows zip'i ve Android APK'yı tek seferde üretir. Çıktılar dist\ altına gelir.
# Kullanım (proje kökünde): powershell -ExecutionPolicy Bypass -File .\derle.ps1          (hepsi)
#                           powershell -ExecutionPolicy Bypass -File .\derle.ps1 -AndroidYok  (APK'sız)
# Ayrıntı ve gerekenler: DERLE.md
param([switch]$AndroidYok)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Adim($ad, [scriptblock]$is) {
  Write-Host "`n== $ad" -ForegroundColor Cyan
  & $is
  if ($LASTEXITCODE) { throw "$ad başarısız (çıkış kodu $LASTEXITCODE)" }
}

$v = node -p "require('./package.json').version"
Write-Host "Ortam Sade $v derleniyor" -ForegroundColor Green

Adim 'Bağımlılıklar (npm install)' { npm install --no-audit --no-fund }
Adim 'Windows paketi (zip + OrtamSade.exe)' { npm run paketle }

$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 bulunamadı. Kur: winget install JRSoftware.InnoSetup' }
Adim 'Windows kurulum dosyası (Inno Setup)' { & $iscc /Q "/DSurum=$v" kurulum\OrtamSade.iss }

if (-not $AndroidYok) {
  Adim 'Android web içeriği' { npm run mobil }
  if (-not $env:JAVA_HOME) { $env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr" }
  if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw "Java bulunamadı ($env:JAVA_HOME). Android Studio kur ya da JAVA_HOME ayarla." }
  Push-Location mobile\android
  try { Adim 'Android APK (imzalı)' { .\gradlew.bat :app:assembleRelease -q } } finally { Pop-Location }
  Copy-Item mobile\android\app\build\outputs\apk\release\app-release.apk "dist\EtuCep-$v.apk" -Force
}

Write-Host "`nHazır:" -ForegroundColor Green
Get-ChildItem dist -File | Where-Object { $_.Name -like "*$v*" } | ForEach-Object { "  {0,-34} {1,6:N1} MB" -f $_.Name, ($_.Length / 1MB) }
