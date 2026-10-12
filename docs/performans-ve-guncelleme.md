# Performans ve güvenli sürüm güncelleme

- Ana ekranın çalışma, ihlal ve zaman çizgisi hesapları her saniye yerine dakika değişince yenilenir. Saniyelik yenilemede yalnız açık mola sayacı değişir. Ekran gizlenince zamanlayıcı durur; dönüşte öğleye taşan mola mevcut kurala göre kapanır.
- Gerçek inline uygulama kodunun DOM taklitleriyle yapılan karşılaştırmasında aynı dakikadaki 59 sayaç yenilemesinde açıklama/zaman çizgisi alanına 118 HTML yazımı yerine 0 yazım ölçüldü. Fiziksel telefon açılış süresi ölçümü değildir.
- Bildirim özeti bir kayıt grubundaki her işlemde tekrar hesaplanmaz; birleştirilen gönderimde, güncel cihaz verisinden bir kez hazırlanır. Çevrimdışı işlem ve eski sıra koruması devam eder.
- Bildirim ve güncelleme scriptleri `defer` ile yüklenir; uygulamanın ilk görünümü ağdaki bu dosyaları beklemez. Font stil dosyası ilk görünümü engellemez. Service worker, hazır çevrimdışı sayfa varken 1,5 saniyeden uzun ağ beklemesinde o sayfayı açar.

## Kullanıcının göreceği güncelleme

Yeni worker indirildiğinde üstte **Uygulamanın yeni bir sürümü var — Güncelle** görünür. Güncelle kullanıcının dokunuşuyla etkinleşir; sayfa bir kez yenilenir. Açık kayıt düzenleme paneli veya tamamlanmamış saat değişikliği varsa güncelleme bekler. Başka sekme sürümü etkinleştirirse bu sekme kendiliğinden yenilenmez, aynı düğmeyi gösterir.

Ayarlar'da sürüm bilgisi ve **Güncellemeleri kontrol et** vardır. İlk açılış, ekrana dönüş, bağlantının gelmesi ve görünürken yaklaşık beş dakikada bir kontrol edilir. Kapalı uygulamada bu düğme gösterilemez; uygulamayı açınca kontrol devam eder. Çok eski, güncelleme modülü olmayan sürümü kullananların ilk geçişte uygulamayı internet bağlıyken kapatıp yeniden açması gerekir; sonraki sürümlerde düğme çalışır.

`molaTakip:v1`, veri biçimi, kurulu uygulamanın adresi ve kapsamı değişmez. Güncelleme modülü mesai kaydını yazmaz, silmez veya sıfırlamaz; yalnız uygulama dosyalarının önbelleği yenilenir. CSV ve bildirim abonelikleri korunur. Her yeni yayında `sw.js` cache sürümü ve script sürümü artırılmalı; `app-updates.js` içindeki görünen sürüm de güncellenmelidir. GitHub Pages main'e merge edildiğinde bu dosyaları yayınladıktan sonra kullanıcılar uygulamada yeni sürümü görebilir.

## Doğrulama

```sh
node tests/lunch.cjs
node tests/stress.cjs
node tests/notifications-client.cjs
node tests/notifications-sw.cjs
node tests/performance.cjs
node tests/app-updates.cjs
```

Testler hesaplama/CSV geri uyumu, öğle kapanışı, görünürlük, tek yeniden yükleme, ilk kurulum, açık form, diğer sekme, çevrimdışı güncelleme hatası, worker mesajı yetkisi ve veri korumayı denetler. Gerçek telefon bildirim teslimi telefonla ayrıca denenir.
