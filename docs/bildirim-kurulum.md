# Hesap açmadan Mesai Takip bildirimleri

## Durum — 12 Ekim 2026

- Bildirim servisi mevcut ChatGPT hesabındaki ayrı Sites projesinde yayınlandı: https://mesai-takip-bildirimler.ozicirit9.chatgpt.site
- Site henüz yalnız sahibine açık. Otomatik onay denetimi, hesabı olmayan 8–9 kişinin API'ye erişebilmesi için `public` erişim değişikliğini açık kullanıcı onayı olmadan reddetti. Bu engel dolanılmadı.
- `notifications-config.js` içindeki `available:false` bu nedenle bildirim açma ve test düğmelerini kapalı tutar. Kullanıcı public servis erişimini onayladıktan ve anonim sağlık/CORS denetimi geçtikten sonra `true` yapılır.
- Bu PR taslak. Mesai Takip'in `main` dalı ve mevcut GitHub Pages yayını değiştirilmedi. PR #11 kapalı kalır.

## Uygulama ve veriler

Mevcut uygulama: https://berkaypn.github.io/Mesai-Takip/

`molaTakip:v1`, CSV biçimi, DEMO=false, manifest ve ana ekran adresi korunur. Bildirim modülü yalnız `mesaiTakip:notifications:v1` alanına yazar. Ana uygulama `days`/`segs` geçmişini servise göndermez. Servis yalnız bildirim aboneliği, tercihler, açık mola/mesai durumu, kayıtlı izin tarihleri ve Canias/hafta özeti için gereken sınırlı toplamları tutar. Bildirim giriş, çıkış veya Canias onayı oluşturmaz.

Her telefon bir kez mevcut Ana Ekran simgesinden Ayarlar → Bildirimleri etkinleştir → İzin ver adımlarını izler. Yeni hesap veya ikinci uygulama kurulumu gerekmez. iPhone iOS 16.4+ gerekir. Ana Ekran uygulamasını silip tekrar kurmayın; adresi değiştirmeyin. Gerçek mevcut verilerle ilk denemeden önce aynı uygulamadan CSV yedeği alın.

## Sunucu ve zamanlayıcı

HowMuchSpend ile aynı Web Push şifreleme, VAPID imzası ve Sites D1 yaklaşımı kullanılır. Bu ayrı serviste tüm kullanıcılar cihaz başına rastgele 256-bit anahtarla ayrılır. Sunucuda anahtarın SHA-256 özeti tutulur; abonelik veya diğer cihazın durumunu okuyan bir API yoktur. VAPID özel anahtarı yalnız Sites secret'tır; GitHub'a ve tarayıcıya girmez. Sunucu kaynaklarının inceleme kopyası `notifications-site/` içinde; tam derleme kaynağı ayrı Sites kaynak deposundadır. Sunucu değişikliği ayrıca Sites'e yayınlanmalıdır; GitHub PR merge'i yalnız Pages istemcisini ve zamanlayıcıyı günceller.

HowMuchSpend'in sahibine özel Sites gönderici kapısı kullanılmaz: 8–9 kişinin erişeceği serviste `/dispatch`, `berkaypn/Mesai-Takip` deposunun `main` dalındaki `.github/workflows/mesai-notifications.yml` dosyasına ait imzalı ve kısa süreli GitHub OIDC kimliğini doğrular. Uzun süreli GitHub veya Sites servis token'ı depoya eklenmez. Görev yalnız upstream `main`e merge edildikten sonra çalışır; fork görevi kimlik denetiminden geçemez.

GitHub Actions yaklaşık beş dakikada bir kontrol eder. Yoğunlukta daha fazla gecikme veya atlanan çalıştırma olabilir. 15 dakika mola, hafta içi 08:30 giriş, 18:30 çıkış, cuma 14:00 Canias, cumartesi 10:00 özet Türkiye saatindedir; tam dakika teslim garantisi verilmez. Public depoda 60 gün GitHub etkinliği olmazsa zamanlanmış workflow GitHub tarafından durdurulabilir. Uygulamayı kullanmak GitHub depo etkinliği değildir; Actions sekmesinden yeniden etkinleştirmek gerekir. Workflow `main`e otomatik bakım commit'i atmaz.

Çevrimdışı kapanan mola/mesai, eşitlenene kadar fazladan hatırlatma üretebilir (kullanıcı bu sınırlamayı kabul etti). Eski eşitleme isteği yeni durumu geri çeviremez. Gönderilmekte olan kayıt tekrar kontrol edilir; daha önce teslim edilmiş push tamamen geri alınamaz. Geçici gönderim hatasında en çok üç deneme, abonelik bitişinde silme, 90 gün kullanılmayan bildirim cihazında temizlik vardır. 32 cihaz sınırı kaynak kullanımını sınırlar; kimliği olmayan yeni kayıt istekleri kapasiteyi tüketebilir, diğer kullanıcıların verisini okuyamaz. Aynı CORS kökeni birden fazla Pages projesi içerebilir; asıl cihaz yetkisi rastgele anahtardır.

## Doğrulama ve yayın adımları

Geçen kontroller: 31 öğle testi, 2.145 stres kontrolü, 17 bildirim istemcisi testi, 4 service worker kontrolü, 5 SQLite/D1 servis testi, 4 şifreleme/OIDC testi. Dokuz cihazın mesai verisi bayt düzeyinde korundu; dokuz cihazın ayrı Canias bildirimi, eski sıra, mola kapatma, tekrar gönderim, iptal, sınır ve aşırı büyük istek denetlendi. RFC 8291 şifreleme vektörü, VAPID imzası ve tam repo/workflow/main/audience kontrolü geçti. Sites derlemesi ve TypeScript kontrolü geçti. Canlı özel servis sağlık/config/CORS ve yetkisiz gönderim denetimleri geçti; gerçek telefon teslimi henüz yapılmadı.

```sh
node tests/lunch.cjs
node tests/stress.cjs
node tests/notifications-client.cjs
node tests/notifications-sw.cjs
node notifications-site/tests/service.test.mjs
node notifications-site/tests/crypto.test.mjs
```

1. Kullanıcı yalnız bu bildirim servisinin public erişimini açıkça onaylar. DebTracker özel kalır.
2. Servisin anonim sağlık/config/CORS denetimi yapılır; `available:true` ile taslak PR güncellenir.
3. Berkay/Claude kaynakları, zaman kurallarını ve veri korumayı inceler. Kullanıcı merge eder.
4. Mevcut PWA'da CSV yedeği alınır; önce tek cihaz bildirim izni ve test bildirimiyle doğrulanır. Uygulama kapalıyken ve bildirime dokununca doğru sekme/aynı mesai geçmişi kontrol edilir.
5. Mola 15 dakika, öğle kapanışı, erken mola kapatma, çıkış, çevrimdışı kapanış, Canias girildi işareti ve hafta özeti denendikten sonra diğer kullanıcılar tek tek bildirim açar.

Telefon testi yapılmadan özellik yayın için doğrulanmış sayılmaz. Servis veritabanı mesai yedeği değildir.
