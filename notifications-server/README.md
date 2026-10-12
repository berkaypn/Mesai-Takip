# Mesai Takip — bildirim servisi

Uygulama mevcut GitHub Pages adresinde ve mevcut Ana Ekran simgesinde kalır. Bu Worker yalnızca Web Push gönderir. `molaTakip:v1` okunmaz/yazılmaz; ham mesai geçmişi sunucuya gönderilmez. Her cihaz ayrı, rastgele 256-bit anahtarla doğrulanır. D1 yalnızca bildirim aboneliği, seçenekler, sınırlı durum özeti ve tekrar-gönderim kayıtlarını saklar.

## Bir kez kurulum

Cloudflare hesabına yetkili erişim gerekir. Anahtarları sohbet, GitHub kaynak kodu veya `notifications-config.js` içine koymayın.

```sh
cd notifications-server
npm ci
npx wrangler login
npx wrangler d1 create mesai-notifications
```

Dönen gerçek database ID’sini `wrangler.jsonc` içindeki `SET_AFTER_D1_CREATE` yerine yazın. `ALLOWED_ORIGIN` ve `APP_URL` mevcut Pages adresini göstermeli; uygulamayı yeni adrese taşımayın.

```sh
npx wrangler d1 migrations apply mesai-notifications --remote
npm run setup
npm run deploy
```

`setup` anahtarları stdin üzerinden secret olarak yükler ve özel anahtarı yazdırmaz. Anahtarlar varsa yeniden üretmez; aksi halde telefonlardaki abonelikler bozulurdu. Anahtarların yönetimi Cloudflare hesabında kalır. Dağıtımın verdiği gerçek Worker URL’sini kökteki `notifications-config.js` içindeki `api` alanına ekleyin. Bu URL gizli değildir. Ardından frontend PR’ı telefon testinden sonra merge edilir. Worker kurulmadan API alanı boş kalır ve ayarlardaki etkinleştirme düğmesi devre dışıdır.

Cron her dakika çalışır; Türkiye saatine göre mola 15 dk, çıkış 18:30, hafta içi giriş 08:30, Canias **cuma 14:00**, haftalık özet cumartesi 10:00 kontrol edilir. Cron yapılandırması Cloudflare’da etkin olmalıdır; yeni tetikleyicinin yayılması zaman alabilir. Push teslimi işletim sistemi, internet ve Odak ayarları nedeniyle gecikebilir; saniyesi saniyesine garanti verilmez.

## Kurallar

- Öğleden önce açılan mola için öğle başlangıcı bitiş sınırıdır; 11:50 molası 12:00’da otomatik kapandığından 12:05 bildirimi gönderilmez.
- Kapatılan mola ve çıkış, işaretlenen Canias görevleri bir sonraki durum gönderiminde hatırlatmayı kaldırır. Gönderilmek üzere olan kayıt gönderimden hemen önce yeniden kontrol edilir.
- Daha eski istek yeni durumu ezemez. Her cihazda artan sıra numarası kullanılır.
- Bildirim kapatma aboneliği iptal eder; kapalı tercih servise iletilir. Aynı hatırlatma tek sefer gönderilir; hata durumunda en çok üç deneme yapılır.
- Haftalık özet yalnızca o haftanın pazartesi–cuma tamamlanmış kayıtlarının farkını kullanır; açık günleri ayrıca söyler. O haftaya ait özet yoksa eski haftanın sayıları gönderilmez. Canias uyarısı tüm bekleyen görev günlerinin sayısını belirtir.
- Sabah hatırlatması yalnızca hafta içi; kayıtlı izin, rapor ve tatil tarihlerinde ve o gün giriş kaydı varsa gönderilmez. Sistem kaydedilmemiş bir izni bilemez.
- Tam geçmiş ve çalışan adı iletilmez. Sayılar ve açık mola/mesai zamanları, bildirim izni açılırken açıklanan sınırlı verilerdir.
- İnternet yokken ana kayıt cihazda kalır. Bekleyen bildirim durumu ayrı anahtarda tutulup bağlantı/açılışta tekrar gönderilir. Servis son iletilen bilgiyi kullanır: çevrimdışı kapatılmış mola/çıkış için eski hatırlatma gelmesi mümkün. Gönderilmiş push tamamen geri alınamaz; TTL 60 saniyedir. Bildirim asla otomatik giriş/çıkış yapmaz.
- iPhone’da iOS 16.4+ ve mevcut Ana Ekran PWA’sından kullanıcı dokunuşuyla izin gerekir. Uygulamayı silip tekrar kurmak, tarayıcı verisini temizlemek veya adres değiştirmek gerekmez.
- Bildirim veritabanı mesai yedeği değildir. Güncellemeden önce cihazdan CSV yedeği alınmalı; bildirim ayarları yedek mesai dosyasının formatını değiştirmez.

## Test

```sh
node ../tests/lunch.cjs
node ../tests/stress.cjs
node ../tests/notifications-client.cjs
npm test
npx wrangler deploy --dry-run
node tests/runtime-smoke.mjs
```

Gerçek telefon kabul testi: önce bir cihaz, sonra 8–9 kullanıcının tamamı. İzin ver/reddet, uygulama kapalıyken test bildirimi, 15 dk mola, öğle kapanışı, 18:30 çıkış, çevrimdışı kapatma/açılma, cuma Canias, cumartesi özet ve bildirime dokununca doğru Ana Ekran kaydı kontrol edilmelidir. Otomatik kontroller gerçek iPhone teslimini kanıtlamaz.
