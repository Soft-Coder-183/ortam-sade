// Hızlı yanıtlar: sık sorulan kurallar ve dayandıkları madde. Her kaynakta "quote", o maddeden birebir alınmış bir
// parçadır (birden çok parça " … " ile ayrılır). Uygulama her açılışta parçanın güncel metinde hâlâ geçtiğini denetler;
// belge değişmişse yanıt "kaynak değişmiş olabilir" uyarısıyla gösterilir. Yeni yanıt eklerken metni maddeden kopyala.
// doc: belge kimliği (mevzuat.mjs classify: mevzuat.gov.tr için mg-<tür>-<no>, okulun dosyaları için f-<ad>).
const LISANS = 'mg-8-15287', YANDAL = 'f-ab1a55e4a6eb', CAP = 'f-eb43dcd9a0d8', YOK_GECIS = 'mg-7-13948', BURS = 'f-ac4c0f9f48d7', KANUN = 'mg-1-2547';

export const ANSWERS = [
  {
    id: 'yap-basvuru', tags: ['YAP', 'yandal', 'başvuru'],
    q: 'Yandala (YAP) ne zaman başvurabilirim, son hakkım hangi dönem?',
    a: 'Anadalının **en erken 3., en geç 6. ders döneminin başında**, Akademik Takvimdeki başvuru süresi içinde. Başvuru anında **GNO en az 3,00** olmalı ve o döneme kadar alman gereken bütün kredili dersleri geçmiş olmalısın. Yani 6. ders döneminin başı son fırsat; 7. dönemde başvurulamaz.',
    calendar: /yan ?dal/i, news: /yan ?dal/i,
    cites: [
      { doc: YANDAL, a: '5', quote: 'en erken üçüncü ve en geç altıncı ders döneminin başında … genel not ortalaması en az 3,00' },
      { doc: YOK_GECIS, a: '19', quote: 'en erken üçüncü, en geç altıncı yarıyılın başında başvurabilir' },
    ],
  },
  {
    id: 'cap-basvuru', tags: ['ÇAP', 'çift anadal', 'başvuru'],
    q: 'Çift anadala (ÇAP) ne zaman ve hangi şartla başvurabilirim?',
    a: 'Anadalının **en erken 3., en geç 5. ders döneminin başında**. Şartlar: o döneme kadar alman gereken bütün kredili dersleri geçmiş olmak, **GNO en az 3,30** ve sınıfında **ilk %20**. İlk %20\'de değilsen, GNO 3,30 ve puanın başvurduğun programın o yılki taban puanından az değilse yine başvurabilirsin. Vazgeçilen (V) dersler alınmamış sayılır.',
    calendar: /çift ana ?dal/i, news: /çift ana ?dal/i,
    cites: [
      { doc: CAP, a: '5', quote: 'en erken 3 üncü ve en geç 5 inci ders döneminin başında … en az 3,30 olması' },
      { doc: CAP, a: '4', quote: 'en üst yüzde 20’sinde yer almayan öğrencilerden' },
    ],
  },
  {
    id: 'cap-yap-ilisik', tags: ['ÇAP', 'YAP', 'ilişik'],
    q: 'ÇAP veya yandaldan hangi durumda çıkarılırım?',
    a: '**Yandal:** anadal GNO\'n **2,30\'un altına** düşerse ya da dersler açıldığı hâlde **iki ders dönemi üst üste** yandaldan ders almazsan. **ÇAP:** izinli olmadan iki ders dönemi üst üste ders almazsan; ayrıca anadal GNO\'n bir kez 2,50\'ye kadar düşebilir, **ikinci kez 2,75\'in altına** düşerse kaydın silinir.',
    cites: [
      { doc: YANDAL, a: '8', quote: 'genel not ortalaması 2,30’un altına düşen öğrencinin yandal programından ilişiği kesilir' },
      { doc: CAP, a: '10', quote: 'ikinci kez 4 üzerinden 2,75’in altına düşen öğrencinin' },
    ],
  },
  {
    id: 'vazgecme', tags: ['dersten vazgeçme', 'V notu', 'withdraw'],
    q: 'Dersten vazgeçme (V) kuralları neler?',
    a: '**3. ders döneminden itibaren**, her dönemde **en fazla 1**, öğrenim boyunca **en fazla 6** dersten, danışman onayıyla vazgeçebilirsin. İşlem **dönemin 8. haftası içinde** yapılır, asgari kredi yükünün altına düşülemez, aynı dersten bir kez vazgeçilir ve yerine o dönem ders eklenemez.',
    cites: [{ doc: LISANS, a: '20', quote: 'üçüncü ders döneminden itibaren her ders döneminde en fazla bir dersten ve öğrenim süresince en fazla altı dersten … dönemin sekizinci haftası içinde' }],
  },
  {
    id: 'tekrar', tags: ['ders tekrarı', 'not yükseltme', 'GNO'],
    q: 'Not yükseltmek için ders tekrar edebilir miyim?',
    a: '**DD ve DC** aldığın dersleri danışman onayıyla tekrarlayabilirsin. **CC, CB, BB veya BA** aldığın derslerden ise öğrenim boyunca **en fazla 5** tanesini tekrarlayabilirsin. GNO\'ya **son alınan not** girer (daha düşük olsa bile); eski not transkriptte kalır ve o dönemin DNO\'suna girer. FF/K aldığın dersleri ise sonraki 3 ders dönemi içinde tekrar almak zorundasın.',
    cites: [{ doc: LISANS, a: '25', quote: 'daha önce DD veya DC notu aldıkları dersleri … en fazla beşini danışmanın onayıyla tekrarlayabilir … son alınan dersin notu GNO hesaplanmasında dikkate alınır' }],
  },
  {
    id: 'mazeret', tags: ['mazeret', 'rapor', 'sınava giremedim'],
    q: 'Sınava giremedim (hastalık vb.), ne yapmalıyım?',
    a: 'Mazeretin bittiği günden sonraki **5 iş günü** (Cumartesi hariç) içinde bölümüne **yazılı** bildir. Öğretim elemanı mazeretini kabul edip sınavı kendi belirlediği şekilde telafi edebilir ya da konuyu fakülte yönetim kuruluna iletir. Raporluyken girdiğin sınav geçersiz sayılır. Rapor devamsızlık için mazeret sayılmaz.',
    cites: [
      { doc: LISANS, a: '23', quote: 'mazeretinin bitimini izleyen beş iş günü, Cumartesi hariç, içinde mazeretini bölümüne yazılı olarak bildirir' },
      { doc: LISANS, a: '22', quote: 'Raporlu olunan süre içinde girilen sınavlar geçersiz sayılır' },
      { doc: LISANS, a: '10', quote: 'Rapor, disiplin cezası ve benzeri gerekçeler derse devamsızlığın mazereti olarak kabul edilmez' },
    ],
  },
  {
    id: 'itiraz', tags: ['not itirazı', 'maddi hata'],
    q: 'Notuma itiraz edebilir miyim, süresi ne kadar?',
    a: 'Yalnızca **maddi hata** (toplama hatası, okunmamış soru gibi) gerekçesiyle. Notların elektronik ortamda ilan edildiği günden sonraki **7 iş günü** (Cumartesi hariç) içinde bölümüne **yazılı** başvurursun. Notlandırılmış kâğıdını öğretim elemanının belirlediği gün ve saatte inceleyebilirsin.',
    cites: [
      { doc: LISANS, a: '22', quote: 'sadece maddi hata gerekçesiyle itiraz edebilirler … yedi iş günü (Cumartesi hariç) içinde' },
      { doc: LISANS, a: '29', quote: 'notların ilanını takip eden yedi iş günü, Cumartesi hariç, içinde Bölüm Başkanlığına yazılı itirazı' },
    ],
  },
  {
    id: 'ayni-gun', tags: ['final', 'aynı gün', 'telafi'],
    q: 'Aynı gün ikiden fazla finalim var, ne olur?',
    a: 'Aynı günde ikiden fazla dönem sonu sınavına girmeye zorlanamazsın (ÇAP ve yandal dersleri hariç). Sınav gününden **önceki iş gününün mesai bitimine kadar** bölüm başkanlığına yazılı başvurursan giremediğin sınav için telafi hakkı verilir.',
    cites: [{ doc: LISANS, a: '22', quote: 'aynı günde ikiden fazla dönem sonu sınavına girmeye zorlanamaz … sınav gününden önceki iş gününün, Cumartesi hariç, mesai bitimine kadar' }],
  },
  {
    id: 'butunleme-mes', tags: ['bütünleme', 'MES', 'mezuniyet ek sınavı'],
    q: 'Bütünleme var mı? Mezuniyet ek sınavı (MES) nedir?',
    a: 'Lisansta **bütünleme sınavı yoktur**; dönem sonu sınavı son sınavdır. Mezuniyete **tek dersin** kaldıysa (son Ortak Eğitim hariç), harf notlarının ilanından sonraki **3 iş günü** içinde bölümüne yazılı başvurup o dersten bir kereye mahsus **MES** hakkı alabilirsin. MES ile alınabilecek en yüksek not **CC**\'dir. Uygulamalı, laboratuvar ve proje derslerinde MES yoktur.',
    cites: [
      { doc: LISANS, a: '22', quote: 'ayrıca bütünleme sınavı niteliğinde bir sınav hakkı verilmez' },
      { doc: LISANS, a: '33', quote: 'kaldıkları tek ders eksiği ile … dönem sonu harf notlarının ilanını takip eden üç iş günü … Bu not en yüksek CC harf notu olabilir' },
    ],
  },
  {
    id: 'onur', tags: ['onur', 'yüksek onur', 'DNO'],
    q: 'Onur ve yüksek onur öğrencisi olmanın şartı ne?',
    a: 'O dönem alman gereken derslerden **en az asgari kredi yükü kadar** ders alıp geçmen ve **GNO\'nun en az 2,00** olması gerekir. Bu şartla **DNO 3,00–3,49** olursa onur, **3,50 ve üstü** olursa yüksek onur öğrencisi sayılırsın.',
    cites: [{ doc: LISANS, a: '31', quote: 'DNO’su 3.00-3.49 arasında olan öğrenciler dönem onur öğrencisi, 3.50 ve daha yüksek olan öğrenciler ise dönem yüksek onur öğrencisi' }],
  },
  {
    id: 'sinamali', tags: ['sınamalı', 'başarısız', 'GNO'],
    q: 'Sınamalı ve başarısız öğrenci ne demek?',
    a: 'İlk iki ders döneminden sonra, bir dönem sonunda GNO\'n **1,50–1,99** arasındaysa **sınamalı**, **1,50\'nin altındaysa başarısız** sayılırsın. Sınamalıyken alabileceğin yeni ders kredisi en fazla asgari kredi yükü kadardır. 4. ders döneminden sonra GNO **1,00\'ın altına** düşerse sonraki dönem yeni ders alamazsın. Önce tekrar etmen gereken dersleri almak zorundasın.',
    cites: [{ doc: LISANS, a: '32', quote: 'GNO’su 1.50-1.99 arasında olan öğrenciler sınamalı, 1.50\'nin altında olan öğrenciler başarısız sayılır' }],
  },
  {
    id: 'kredi', tags: ['kredi yükü', 'asgari', 'azami'],
    q: 'Bir dönemde en az ve en çok kaç kredi alabilirim?',
    a: '**Asgari:** programının toplam ders kredisinin **%9\'u** (küsurat aşağı yuvarlanır). **Azami:** **%16\'sı** (küsurat yukarı yuvarlanır). Danışman onayıyla bir dersi krediye sayılmadan dinleyici olarak da alabilirsin. Ortalama ve Ders Planı sayfası bu sınırları senin programına göre hesaplar.',
    cites: [{ doc: LISANS, a: '16', quote: 'eğitim-öğretim programı ders kredi yükünün %9’udur … ders kredi yükünün %16’sıdır' }],
  },
  {
    id: 'izin', tags: ['kayıt dondurma', 'dönem izni', 'izin'],
    q: 'Kayıt dondurabilir miyim (dönem izni)?',
    a: 'Öğrenim süresine **sayılmadan en fazla 3 dönem** (sağlık, yakın kaybı, afet gibi haklı gerekçeyle) ve ayrıca süreye **sayılarak 3 döneme kadar** (gerekçe aranmaz) izin alabilirsin. Bir seferde en fazla 3 dönem kullanılır. Başvuru, izin istenen dönemden önce ya da **en geç o dönemin ekle-sil süresinin son gününe** kadar bölüm başkanlığına yapılır. Süreye sayılan izinde ücretin yarısı ödenir (burslularda izin süresinin yarısı burs süresinden düşer).',
    cites: [{ doc: LISANS, a: '11', quote: 'eğitim-öğretim süresine sayılmadan en fazla üç dönem; ayrıca eğitim-öğretim süresine sayılarak üç döneme kadar … en geç ders ekle-sil süresinin son gününe kadar' }],
  },
  {
    id: 'azami-sure', tags: ['azami süre', 'öğrenim süresi'],
    q: 'Okulu en fazla kaç yılda bitirmem gerekiyor?',
    a: 'Dört yıllık programlarda **en çok 7 yıl**, beş yıllık programlarda **en çok 8 yıl**. Hazırlık sınıfında geçen süre buna dâhil değildir. Süreye sayılmayan dönem izinleri de sayılmaz.',
    cites: [{ doc: LISANS, a: '9', quote: 'dört yıllık lisans programları için en çok yedi, beş yıllık lisans programları için ise en çok sekiz yıldır' }],
  },
  {
    id: 'burs-sure', tags: ['burs', 'bursluluk süresi'],
    q: 'Bursum ne kadar sürer, hangi durumda kesilir?',
    a: 'Tam/kısmi burs, kayıttan itibaren **5 yıl ve bir dönem** sürer (Tıp\'ta 8 yıl), **hazırlık dâhil**. İzinli olduğun süre burs süresine sayılmaz. İzinli olmadan hazırlıkta üst üste 2 yarıyıl ya da lisansta toplam **3 dönem kayıt yaptırmazsan** burslu statün iptal edilir. En az bir dönem uzaklaştırma cezasında destek bursları o süre için kesilir.',
    cites: [{ doc: BURS, a: '18', quote: 'diğer programlar için beş yıl ve ilave bir dönemdir … lisans programına eğitim süresinde toplam üç dönem kayıt yaptırmayan öğrencilerin burslu statüleri iptal edilir' }],
  },
  {
    id: 'ekle-sil', tags: ['ekle-sil', 'ders kaydı'],
    q: 'Ekle-sil bittikten sonra ders değiştirebilir miyim?',
    a: 'Ekle-sil süresinden sonra yalnızca **dersten vazgeçme** (8. hafta) yapılabilir. Başka her değişiklik ancak fakülte yönetim kurulu mazeretini kabul ederse yapılır. Dönem kaydını kaçırırsan ekle-sil süresinde **geç kayıt ücreti** ödeyerek kayıt yaptırabilirsin.',
    cites: [
      { doc: LISANS, a: '19', quote: 'ancak ilgili fakülte yönetim kurulunun öğrencinin mazeretini kabul etmesi halinde yapılabilir' },
      { doc: LISANS, a: '18', quote: 'ders ekle-sil süresi içinde geç kayıt ücreti ödeyerek kayıtlarını yaptırabilir' },
    ],
  },
  {
    id: 'disiplin', tags: ['disiplin', 'kopya', 'intihal'],
    q: 'Kopya ve disiplin cezaları nereden bakılır?',
    a: 'Lisans Yönetmeliği hâlâ 1985 tarihli "Öğrenci Disiplin Yönetmeliği"ne atıf yapıyor. Ancak disiplin suçları ve cezaları **2023\'ten beri doğrudan 2547 sayılı Kanunun 54. maddesinde** düzenleniyor. Örneğin **kopyaya teşebbüs kınama**, **kopya çekmek veya çektirmek bir yarıyıl uzaklaştırma** gerektirir. Kopya yapılan sınav ayrıca geçersiz sayılır.',
    cites: [
      { doc: KANUN, a: '54', quote: 'Sınavlarda kopyaya teşebbüs etmek … Sınavlarda kopya çekmek veya çektirmek' },
      { doc: LISANS, a: '22', quote: 'kopya veren veya sınav düzenini bozacak davranışlarda bulunan öğrencinin sınavı geçersiz sayılır' },
    ],
  },
];
