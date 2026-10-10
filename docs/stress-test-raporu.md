# Mesai Takip — karma gün ve hata testi raporu

10 Ekim 2026 · İncelenen sürüm: `fix/dis-gorev-ogle-mola` · İlk temel commit: `4b11631b942a41448b8bfc8db2e0957727b3dea4`

**2,169 kontrol geçti.** 2.080 farklı iki parçalı karma gün hesabı, 30 günlük canlı işlem akışı, hata senaryoları ve önceki 31 öğle/mola kontrolü çalıştırıldı. Bunlar 2,169 ayrı insan denemesi değildir; otomatik kod kontrolleridir.

## Ne test edildi?

- Her karma günde bir ofis, bir dış görev kaydı; hem ofis → dış görev hem dış görev → ofis sırası.
- Girişler 06:30, 07:30, 08:00, 08:30 ve 09:00. Geçişler özellikle 11:59, 12:00, 12:01, 12:29, 12:30, 12:31, 12:59 ve 13:00 çevresinde.
- İki kayıt arasına 0, 1, 15 ve 60 dakika boşluk eklenmesi; çıkışların 16:30–18:00 arasında değişmesi.
- Normal/WC molaları, üst üste binen molalar, aktif mola sırasında eski yedek yükleme, dış göreve geçerken mola kapanışı.
- Geçmiş gün düzenleme, boş çıkış, aynı anda iki açık kayıt, çakışan ofis/dış görev girişleri.
- Hatalı saat/tarih, ters saat, çelişen yedek, aynı CSV’yi yeniden yükleme ve 30 günlük CSV gidiş-dönüşü.
- Canias onaylarının geçerli düzeltmede yeniden beklemeye dönmesi, reddedilen düzeltmede korunması; eski veri formatlarının okunması.

Hesap beklentileri uygulamanın aralık fonksiyonlarından üretilmedi. Ayrı bir dakika dakika kontrol, her dakikada konumu ve yemek aralığını değerlendirerek sonucu hesapladı. Net günlük hedef hafta içi 510 dakika, hafta sonu 0; ofiste yemek 12:00–13:00, dış görevde 12:00–12:30. Molalar net çalışmadan düşülmez. Çekirdek saat ihlali ayrı izlenir.

## Bulunan ve düzeltilen 8 hata grubu

İlk 2.097 kontrolün 14’ü başarısızdı. Sonraki aktif mola/CSV çakışması örneğinde de 45 dakika yerine 60 dakika gösterildi. Hepsi aşağıdaki düzeltmelere dahil edildi.

| Hata | Somut örnek ve eski davranış | Yeni davranış | Öncelik |
|---|---|---|---|
| Geçmiş çıkış saati bozuluyordu | Geçmiş günün 08:00–10:00 ofis kaydında çıkışı boşaltmak, uyarı gösterirken kaydı 08:00–08:01’e çeviriyordu. | Geçersiz işlem reddedilir; eski saat aynen korunur. | Yüksek |
| Aynı anda iki konum kabul ediliyordu | 08:00–10:00 ofisin üstüne 09:00–11:00 dış görev eklenebiliyor; düzenleme ve tüm gün kısayolu da çakışma yaratabiliyordu. İki açık kayıt CSV’den alınabiliyordu. | Yeni ekleme/düzeltmede çakışma ve birden fazla açık kayıt reddedilir. Kayıt bulunan günde tüm gün kısayolu yeni kayıt eklemez. | Yüksek |
| Geçersiz CSV saatleri ve tarihleri kabul ediliyordu | `09:75` sonraki saate dönüştürülüyor, 31 Eylül saklanıyor, 17:30–08:00 sıfır süreye çevriliyordu. | Hata açıklanır; dosya tamamıyla doğrulanmadan hiçbir günü kaydetmez. | Yüksek |
| Çelişen yedek sessizce yok sayılıyordu | Mevcut 07:30–16:30 görevin üstüne aynı başlangıçlı 07:30–17:00 yedeği yüklenince farklı çıkış sessizce atlanıyordu. | Kullanıcıya çelişki bildirilir. Mevcut kayıt korunur; önce gün uygulamadan düzeltilir. | Yüksek |
| Mola çakışmaları iki kez sayılıyordu | 10:00–10:30 ve 10:15–10:45 molaları 60 dakika sayılıyordu. WC ve aktif mola/yedek çakışmasında da aynı sorun vardı. | Birleşik süre 45 dakika sayılır. WC süresi de tekrar sayılmaz; Bugün ve Özet aktif mola hesabı tutarlıdır. | Orta |
| İşte olunmayan boşluk mola sayılıyordu | Ofis 08:00–10:00, görev 11:00’den sonra; 09:50–11:10 molası 70 dakika gösteriliyordu. | Sadece ofiste geçen 09:50–10:00 bölümü, 10 dakika sayılır. Konum kaydı olmayan eski mola formatının geçmiş toplamı korunur. | Orta |
| Elle dönüş saati öğle kapanışını aşıyordu | 11:50’de açık mola için 13:10 dönüşü elle girilince bitiş 13:10 saklanıyordu. | Önceki öğle kuralıyla uyumlu olarak bitiş 12:00 saklanır. WC türü korunur. | Orta |
| Zaman çizelgesinin hedef işareti boşluğu atlıyordu | Ofis 08:00–10:00, boşluk 10:00–11:00, dış görev 11:00–17:30. Hedef işareti 17:00 gösteriyordu. | Boşluk hesaba katılır; hedef 18:00 gösterilir. Net süre ve çekirdek ihlali ayrı kalır. | Orta |

## 30 günlük sentetik veri

Eylül 2026’nın her günü bir ofis ve bir dış görev ziyareti içerir. Hafta sonu da bilinçli olarak çalışılmıştır; gerçek mesai veya resmi tatil kaydı değildir. Aşağıdaki farklar hafta içi 510 dk hedefe, hafta sonu 0 hedefe göre hesaplanır. Molalar net çalışmadan düşülmez.

| Gün | Ofis | Dış görev | Kaydedilen mola | Net çalışma | Fark |
|---|---|---|---|---:|---:|
| 2026-09-01 | 08:00–12:00 | 12:00–17:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-02 | 12:29–17:30 | 08:30–12:29 | 13:10–13:25 | 480 dk | −30 dk |
| 2026-09-03 | 09:00–12:30 | 12:30–18:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-04 | 13:00–16:30 | 07:30–13:00 | 13:10–13:25 | 510 dk | 0 dk |
| 2026-09-05 | 08:00–14:00 | 14:00–17:00 | 11:50–14:00 | 540 dk | +540 dk |
| 2026-09-06 | 11:50–17:30 | 08:30–11:50 | 13:10–13:25 | 540 dk | +540 dk |
| 2026-09-07 | 09:00–12:00 | 12:00–18:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-08 | 12:29–16:30 | 07:30–12:29 | 13:10–13:25 | 480 dk | −30 dk |
| 2026-09-09 | 08:00–12:30 | 12:30–17:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-10 | 13:00–17:30 | 08:30–13:00 | 13:10–13:25 | 510 dk | 0 dk |
| 2026-09-11 | 09:00–14:00 | 14:00–18:00 | 11:50–12:00 | 480 dk | −30 dk |
| 2026-09-12 | 11:50–16:30 | 07:30–11:50 | 13:10–13:25 | 540 dk | +540 dk |
| 2026-09-13 | 08:00–12:00 | 12:00–17:00 | 11:50–12:00 | 540 dk | +540 dk |
| 2026-09-14 | 12:29–17:30 | 08:30–12:29 | 13:10–13:25 | 480 dk | −30 dk |
| 2026-09-15 | 09:00–12:30 | 12:30–18:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-16 | 13:00–16:30 | 07:30–13:00 | 13:10–13:25 | 510 dk | 0 dk |
| 2026-09-17 | 08:00–14:00 | 14:00–17:00 | 11:50–12:00 | 480 dk | −30 dk |
| 2026-09-18 | 11:50–17:30 | 08:30–11:50 | 13:10–13:25 | 480 dk | −30 dk |
| 2026-09-19 | 09:00–12:00 | 12:00–18:00 | 11:50–12:00 | 540 dk | +540 dk |
| 2026-09-20 | 12:29–16:30 | 07:30–12:29 | 13:10–13:25 | 540 dk | +540 dk |
| 2026-09-21 | 08:00–12:30 | 12:30–17:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-22 | 13:00–17:30 | 08:30–13:00 | 13:10–13:25 | 510 dk | 0 dk |
| 2026-09-23 | 09:00–14:00 | 14:00–18:00 | 11:50–12:00 | 480 dk | −30 dk |
| 2026-09-24 | 11:50–16:30 | 07:30–11:50 | 13:10–13:25 | 480 dk | −30 dk |
| 2026-09-25 | 08:00–12:00 | 12:00–17:00 | 11:50–12:00 | 510 dk | 0 dk |
| 2026-09-26 | 12:29–17:30 | 08:30–12:29 | 13:10–13:25 | 540 dk | +540 dk |
| 2026-09-27 | 09:00–12:30 | 12:30–18:00 | 11:50–12:30 | 540 dk | +540 dk |
| 2026-09-28 | 13:00–16:30 | 07:30–13:00 | 13:10–13:25 | 510 dk | 0 dk |
| 2026-09-29 | 08:00–14:00 | 14:00–17:00 | 11:50–12:00 | 480 dk | −30 dk |
| 2026-09-30 | 11:50–17:30 | 08:30–11:50 | 13:10–13:25 | 480 dk | −30 dk |

30 günlük toplam net çalışma: **15240 dk**. Toplam fark: **+4020 dk**. CSV’ye aktarılıp boş test durumuna geri yüklendiğinde tüm günlerin konum ve mola kayıtları aynı kaldı. Aynı dosyanın ikinci yüklemesi kayıt çoğaltmadı.

## Sonuç ve sınır

- Karma gün/stres paketi: **2138/2138 geçti**.
- Önceki öğle/mola paketi: **31/31 geçti**.
- `git diff --check`: temiz.
- Test verileri kontrollü test ortamında üretildi; gerçek kullanıcı depolamasına bağlanılmadı.
- Veri anahtarı ve mevcut kayıt formatı korunur. Eski hatalı/çakışan sürelerin hesaplanan toplamları düzeltmeyle değişebilir; ham kayıtlar toplu olarak silinmez veya değiştirilmez.
- Çelişen veya geçersiz bir CSV reddedilir. Bu dosyalar otomatik üzerine yazılmaz; uyarıda belirtilen gün/saat kontrol edilmelidir.
- Gerçek JavaScript, Node VM içinde kontrollü saatler ve DOM olay taklitleriyle çalıştırıldı. Gerçek tarayıcı, iPhone arka plan davranışı ve ekran yerleşimi bu testin kapsamında doğrulanmadı. Bu nedenle PR taslak olarak kalır; telefonda gerçek kullanım kontrolü merge öncesi yapılmalıdır.

## Tekrar çalıştırma

Repo kökünde Node.js ile; paket kurulumu gerekmez:

```sh
node tests/stress.cjs
node tests/lunch.cjs
```

Telefon kontrolü için üç somut örnek: 07:30–16:30 dış görevde sıfır fark; 11:50 molasının 12:00’da 10 dakika olarak kaydı; 08:00–10:00 ofis ile 11:00–17:30 görevde hedefin 18:00 gösterilmesi.
