; Ortam Sade Windows kurulumu (Inno Setup 6). GitHub Actions'ta derlenir: iscc /DSurum=X.Y.Z kurulum\OrtamSade.iss
; Yönetici izni istemez: kullanıcının kendi klasörüne (%LOCALAPPDATA%\Programs\Ortam Sade) kurar. Uygulamanın "Güncelle" düğmesi
; bu klasörde de çalışır. Kişisel veriler (.cache, .profile) kaldırırken yalnızca kullanıcı onaylarsa silinir.
#ifndef Surum
  #define Surum "0.0.0"
#endif

[Setup]
AppId={{6F0B8A0E-3C7E-4F59-9E1B-2C5D8B7A4E11}
AppName=Ortam Sade
AppVersion={#Surum}
AppVerName=Ortam Sade {#Surum}
AppPublisher=Ortam Sade (bağımsız öğrenci projesi)
AppPublisherURL=https://github.com/Soft-Coder-183/ortam-sade
AppSupportURL=https://github.com/Soft-Coder-183/ortam-sade/issues
AppUpdatesURL=https://github.com/Soft-Coder-183/ortam-sade/releases
DefaultDirName={localappdata}\Programs\Ortam Sade
DisableProgramGroupPage=yes
DefaultGroupName=Ortam Sade
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\dist
OutputBaseFilename=OrtamSade-{#Surum}-kurulum
SetupIconFile=simge.ico
UninstallDisplayIcon={app}\simge.ico
UninstallDisplayName=Ortam Sade
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
LicenseFile=..\LICENSE

[Languages]
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "masaustu"; Description: "Masaüstüne kısayol koy"; GroupDescription: "Kısayollar:"
Name: "acilis"; Description: "Bilgisayar açılınca arka planda başlat (bildirimler için; pencere açılmaz, sistem tepsisinde durur)"; GroupDescription: "Başlatma:"

[Files]
Source: "..\dist\OrtamSade\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "simge.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Tek pencereli uygulama (OrtamSade.exe): siyah konsol yok, kapatınca sistem tepsisine iner
Name: "{group}\Ortam Sade"; Filename: "{app}\OrtamSade.exe"; WorkingDir: "{app}"
Name: "{group}\Ortam Sade'yi kaldır"; Filename: "{uninstallexe}"
Name: "{userdesktop}\Ortam Sade"; Filename: "{app}\OrtamSade.exe"; WorkingDir: "{app}"; Tasks: masaustu
Name: "{userstartup}\Ortam Sade"; Filename: "{app}\OrtamSade.exe"; Parameters: "--arka"; WorkingDir: "{app}"; Tasks: acilis

[Registry]
; Windows bildirimine tıklanınca uygulama penceresinde ilgili sayfa açılır (ortamsade: bağlantıları; uygulama da kendisi yazar)
Root: HKCU; Subkey: "Software\Classes\ortamsade"; ValueType: string; ValueName: ""; ValueData: "URL:Ortam Sade"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\ortamsade"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\ortamsade\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\OrtamSade.exe"" ""%1"""

[Run]
Filename: "{app}\OrtamSade.exe"; WorkingDir: "{app}"; Description: "Ortam Sade'yi şimdi aç"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Kaldırmadan önce açık uygulama (ve sunucusu) kapatılır
Filename: "{sys}\taskkill.exe"; Parameters: "/IM OrtamSade.exe /T /F"; Flags: runhidden; RunOnceId: "UygulamayiKapat"

[UninstallDelete]
; Uygulamanın kendi güncellemesiyle eklenen dosyalar da kaldırılsın (kişisel veriler aşağıda, ayrıca sorulur)
Type: filesandordirs; Name: "{app}\server"
Type: filesandordirs; Name: "{app}\public"
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\runtime"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and (DirExists(ExpandConstant('{app}\.cache')) or DirExists(ExpandConstant('{app}\.profile'))) then
    if MsgBox('Kişisel veriler de silinsin mi?' + #13#10 + '(kayıtlı şifre, oturumlar, önbellek, ayarlar ve bildirimler)' + #13#10#13#10 +
              'Hayır dersen yeniden kurduğunda kaldığın yerden devam edersin.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
    begin
      DelTree(ExpandConstant('{app}\.cache'), True, True, True);
      DelTree(ExpandConstant('{app}\.profile'), True, True, True);
      RemoveDir(ExpandConstant('{app}'));
    end;
end;
