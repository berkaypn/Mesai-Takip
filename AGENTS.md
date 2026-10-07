# AGENTS.md

Mesai Takip: giriş, çıkış, dış görev ve mola takibi yapan, telefona kurulabilen tek sayfalık bir PWA. Arayüz dili Türkçe.

## Proje yapısı

Build adımı, paket yöneticisi, bağımlılık ve test altyapısı yok. Dosyalar olduğu gibi statik olarak servis edilir.

- `index.html`: uygulamanın tamamı. CSS `<style>` içinde, JS tek bir IIFE olarak `<script>` içinde.
- `sw.js`: service worker. Sayfa için network-first, diğer aynı origin dosyaları ve Google Fonts için cache-first.
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`: PWA kurulum dosyaları.

`index.html` içindeki JS bölümleri `// ---------- storage ----------` gibi başlıklarla ayrılmış: storage, time helpers, interval helpers, day model, html pieces, render, actions, export / import.

## Yerelde çalıştırma

```sh
python3 -m http.server 8000
```

Service worker sadece `https:` üzerinde kaydedilir (`index.html` içindeki `location.protocol === "https:"` kontrolü), bu yüzden yerelde offline/cache davranışı test edilemez. Manifest ve service worker sadece sayfa tek başına açıldığında eklenir (`STANDALONE`), claude.ai artifact içinde açıldığında eklenmez.

Otomatik test yok. Değişikliği tarayıcıda elle doğrula: giriş/çıkış, dış görev, mola, geçmiş gün düzenleme, izin işaretleme, CSV dışa/içe aktarma. Mevcut veriyle test etmek için önce gerçek bir CSV yedeği alıp geri yükle.

## Kurallar

### Git: main'e doğrudan push yok

- `main` branch'ine asla doğrudan commit atma veya push etme.
- Her iş için güncel `main`'den ayrı bir branch aç (`feat/...`, `fix/...`, `chore/...`).
- Değişiklik `gh pr create` ile PR açılarak `main`'e alınır. Merge'i kullanıcı yapar.

### Her değişiklikte service worker cache versiyonunu artır

- `sw.js` başındaki `const CACHE = "mesai-takip-vN";` değerini her PR'da bir artır (ör. `v3` → `v4`). Sadece doküman değişen PR'lar hariç.
- Bunu yapmazsan kurulu uygulamalar eski ikonları, manifesti ve fontları cache'ten sunmaya devam eder; eski cache'ler sadece versiyon değişince silinir.
- Yeni bir statik dosya eklersen `sw.js` içindeki `CORE` listesine de ekle.

### localStorage veri yapısını bozma, kullanıcı verisi silinmesin

Kullanıcıların tüm geçmişi tarayıcıdaki tek bir anahtarda duruyor. Bu veri kaybolursa geri getirilemez.

- Anahtar `molaTakip:v1`. Adını değiştirme. Demo modu ayrı anahtar kullanır (`mesaiTakip:demo`); `DEMO` sabiti `false` kalmalı.
- `localStorage.clear()`, `removeItem` veya mevcut veriyi boş state ile ezen kod ekleme.
- Mevcut alanları yeniden adlandırma, tipini değiştirme veya silme. Yeni alan gerekiyorsa isteğe bağlı ekle ve `norm()` / `normSet()` içinde varsayılan değer ver, böylece eski kayıtlar da okunur.
- `norm()` içindeki eski format dönüşümlerini (gün olarak sadece mola dizisi, `in`/`out` alanları) ve `normSet(p.set || p)` geri uyumluluğunu kaldırma.
- Format değişikliği şartsa önce eski veriyi okuyup yeni formata çeviren bir geçiş yaz. Yükleme sırasında oluşan hata kullanıcının verisini sıfırlamamalı.

Mevcut yapı:

```js
{
  days: {
    "YYYY-MM-DD": {                 // yerel saat diliminde gün anahtarı
      segs:   [{ t: "o" | "g", s: ms, e: ms | null }],  // o = ofis, g = dış görev, e null = devam ediyor
      breaks: [{ s: ms, e: ms }],
      izin:   boolean,              // çekirdek saat ihlali için mazeret izni girildi
      type:   "normal" | "yillik" | "rapor" | "tatil"
    }
  },
  open: ms | null,                  // açık molanın başlangıcı
  set: { mesaiS, mesaiE, coreS, coreE, lunchS, lunchE }  // gece yarısından itibaren dakika; lunchS/lunchE null olabilir
}
```

Zamanlar epoch milisaniye. Boş günler (`isEmpty`) kaydedilmeden silinir.

Aynı yapı claude.ai bulut modunda (`connect()`) `data/users/<uid>/` altına yazılır: her gün `d-YYYY-MM-DD`, açık mola `state`, ayarlar `settings` dokümanı. Bu yol ve alanlar da aynı kurala tabi.

CSV yedeği kullanıcının tek dışa aktarma yoludur. İçe aktarma sütunları Türkçe başlık adına göre bulur (`Tarih`, `Ofis`, `Dış görev`, `Gün türü`, `Mazeret izni`, eski `Giriş`/`Çıkış`, `Molalar` bölümü). Bu başlıkları değiştirirsen eski yedekler geri yüklenemez; değiştirmen gerekirse içe aktarmada eski adları da tanımaya devam et.

## Kod stili

- Mevcut stile uy: kısa yardımcı fonksiyonlar, `$` ile `getElementById`, HTML string birleştirme ile render, harici kütüphane yok.
- Renkler `:root` üzerindeki CSS değişkenlerinden gelir; açık ve koyu tema bloklarının ikisini de güncelle.
- Kullanıcıya görünen tüm metinler Türkçe. Tarihler `tr-TR` ile biçimlendirilir.
- Hesaplama kuralları arayüzdeki açıklama metinleriyle (ör. Özet altındaki not, Ayarlar altındaki hedef metni) tutarlı olmalı; birini değiştirirsen diğerini de güncelle.

## Proje bağlamı

> **Repo durumu (2026-10-07):** Repodaki `index.html`, aşağıda anlatılan v3 arayüzü değil, ondan önceki tek sayfalık sürüm (hafta sonu, dış görev, çekirdek saat ihlali ve izin/rapor/tatil türleri var). v3'e ait şu şeyler repo kodunda **yok**: alt sekmeler, takvim, alt düzenleme paneli, "Günün akışı", zaman damgalarının dakikaya yuvarlanması, 1 dakika içindeki ofis/dış görev geçişinin tür düzeltmesi, geçmiş günde boş bitiş saatinin engellenmesi, çıkışı eksik günlerin uyarı/Özet'te gösterilmesi, 6 haftalık demo verisi ve `window.__mt` test kancaları. Bunlarla ilgili bir iş yapmadan önce kullanıcıdan v3 kodunu iste; repodaki kodda var sayma.

> Bu bölüm, uygulamanın claude.ai sohbetinde geliştirildiği dönemin özetidir. Kesin olmayan noktalar "(emin değilim)" ile işaretlidir.

### 1. Amaç ve kullanıcılar

- **Mesai Takip**, kişisel bir giriş/çıkış, mola ve dış görev takip uygulaması. Telefondan, elle basılarak kullanılır.
- Amaç: Çalışma süresi, mola ve çekirdek saat ihlalleri için kişinin kendi bağımsız kaydını tutmak.
- Birkaç kişi aynı linki kullanır ama **herkesin verisi sadece kendi cihazında** tutulur. Kimse başkasının verisini göremez, ortak bir sunucu ya da veritabanı yoktur.
- Arayüz dili Türkçe, hedef cihaz telefon (dar ekran, tek elle kullanım).

### 2. Mesai kuralları ve hesaplama

**Kurallar:**
- Asıl mesai: **08:00–17:30**
- Çekirdek saat: **08:30–16:30**. Bu aralıkta iş başında olmak zorunlu. Dışarıda kalınan süreler ihlal sayılır ve ihlal için **mazeret izni** girilmesi gerekir.
- Çekirdek saat dışındaki eksikler başka bir gün tamamlanabilir.
- Yemek arası: **12:00–13:00**. Mola verilsin ya da verilmesin çalışma sayılmaz.
- Günlük süre yemek dahil 9,5 saat, yani **net hedef 8,5 saat** (hafta içi).
- Not: Daha önce "08:30'da başlayan mesaiye 09:00'a kadar gelinebilir" şeklinde farklı bir tarif de verilmişti. Bu iki tarif arasındaki ilişki (eski kural mı, aynı kuralın farklı anlatımı mı) belirsiz (emin değilim). Uygulama yukarıdaki tarifi kullanıyor.
- Hafta sonu (cumartesi/pazar): Hedef yok, çalışılan sürenin tamamı artı yazılır, **yemek arası düşülmez**, çekirdek saat kontrolü yok.
- Yıllık izin, rapor, resmi tatil: Hedef yok, çekirdek saat kontrolü yok, fark 0. O gün çalışılırsa tamamı artı yazılır.

**Uygulamanın hesaplama mantığı:**
- Gün, parçalardan (`segs`) oluşur: her parça ya **ofis** (`o`) ya da **dış görev** (`g`), başlangıç ve bitiş saatiyle. Aynı gün içinde birden fazla parça olabilir (ör. 08:30–12:00 dış görev, 13:00–17:30 ofis).
- **Net çalışma** = tüm parçaların birleşimi (çakışan parçalar çift sayılmaz) eksi yemek arasıyla örtüşen süre.
- **Molalar çalışma süresinden düşülmez.** Bu bilinçli bir karar. Molalar sadece ayrıca takip edilir ve toplanır.
- Mola sayımı: Yemek arasına ya da dış görev parçasına denk gelen kısım sayılmaz (ör. 12:40–13:25 molası 25 dk sayılır). Dış görevdeyken mola başlatılamaz.
- **Fark** = net çalışma − günlük hedef. Sadece tamamlanmış günler (açık parçası olmayan günler) farka dahil edilir.
- **Çekirdek saat ihlali** = çekirdek saat aralığı (yemek arası hariç) içinde ofiste ya da dış görevde olunmayan boşluklar. Türleri: "Geç giriş", "Erken çıkış", "Çekirdek saatte yok". Bugün için ihlal canlı hesaplanır.
- Hiç kaydı olmayan hafta içi günler ihlal sayılmaz (izin/rapor günleri boşuna ihlal yazmasın diye).
- Mazeret izni gün bazında bir işarettir (`izin: true`). İhlali sayımdan çıkarmaz, sadece "izin bekleyen" uyarısını kaldırır.
- Mesai, çekirdek saat ve yemek saatleri Ayarlar'dan değiştirilebilir. Hedef, mesai süresi eksi yemek arası olarak türetilir.

### 3. Önemli kararlar ve nedenleri

**Teknik yapı**
- Tek bir bağımsız `index.html` (HTML + CSS + vanilla JS), derleme adımı yok. Ek dosyalar: `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
- Yayın: **GitHub Pages**, repo adı `Mesai-Takip` (büyük/küçük harf önemli, Pages yolu da böyle), dosyalar repo kökünde. Kullanıcılar linki açıp "Ana ekrana ekle" ile PWA olarak kuruyor.
- Service worker: Sayfa için önce ağ, sonra önbellek (güncellemeler gelsin diye); diğer dosyalar önbellekten. **Her sürümde `sw.js` içindeki `CACHE` adı artırılmalı** (şu an `mesai-takip-v3`).
- Veri: `localStorage` anahtarı **`molaTakip:v1`** (tarihsel nedenle ismi "mola" kaldı, değiştirilmemeli). Uygulama `navigator.storage.persist()` istiyor.
- Kod hem claude.ai artifact'ı hem bağımsız site olarak çalışacak şekilde yazıldı: `window.claude` varsa ve kullanıcı sayfanın sahibiyse veriler hesaba senkronize ediliyor. Yoksa sadece localStorage. Bağımsız mod tespiti: `!window.claude && window.top === window`. Claude Code'da geliştirmeye devam ederken artifact tarafındaki `window.claude` kodu kaldırılabilir (emin değilim, kullanıcıyla netleştirilmeli).

**Veri modeli**
- `state = { days, open, set }`
- `days["YYYY-MM-DD"] = { segs:[{ t:"o"|"g", s:ms, e:ms|null }], breaks:[{ s, e }], izin:bool, type:"normal"|"yillik"|"rapor"|"tatil" }`
- `open` = devam eden molanın başlangıcı (ms) ya da `null`.
- `set = { mesaiS, mesaiE, coreS, coreE, lunchS, lunchE }`, gece yarısından itibaren dakika cinsinden. Yemek arası `null` olabilir (kaldırılmış).
- Eski formatlar okunurken otomatik çevriliyor: sadece mola dizisi, `{ in, out, breaks }` ve üst seviyedeki `target`/`lunchS`/`lunchE`. Eski `target` (570 dk) ayarı artık kullanılmıyor, hedef mesai saatlerinden türetiliyor.
- Zaman damgaları **dakikaya yuvarlanarak** saklanıyor. Saniye hassasiyeti CSV yedeğinden geri yüklemede 1 dakikalık sapmalara yol açıyordu.
- Bir günde en fazla bir açık parça olabilir. Geçmiş günlerde bitiş saati boş bırakılamaz.

**Davranış kararları**
- Onay gerektiren işlemler (silme, erken çıkış, mola iptali) **iki dokunuşla** onaylanıyor: ilk dokunuşta buton kırmızıya dönüp metni değişiyor, 3,5 sn içinde ikinci dokunuş işlemi yapıyor. Neden: `confirm()`/`alert()` artifact iframe'inde engelliydi. Ayrıca mesajlar `alert` yerine alt kısımda kısa "toast" olarak gösteriliyor.
- Çekirdek saat bitmeden çıkış yapılırsa onay isteniyor ("Erken çıkış, onayla").
- **Gün kapatıldıktan sonra ana butonlar gizleniyor** (aynı güne tekrar "İşe geldim / Dış görevdeyim" yok). Düzeltme sadece günün kayıt panelinden yapılıyor. Yanlışlıkla kapatılan gün, son parçanın bitiş saati silinerek yeniden açılabiliyor.
- 1 dakika içinde ofis/dış görev arasında geçiş yapılırsa yeni parça açılmıyor, açık parçanın türü düzeltiliyor (0 dakikalık kayıt oluşmasın diye).
- İzin/rapor/tatil tarih aralığıyla işaretlendiğinde hafta sonları atlanıyor. En fazla 60 gün.
- Yedekleme: CSV dışa aktarma (`;` ayraçlı, UTF-8 BOM, Türkçe başlıklar, Excel uyumlu) ve geri yükleme. Geri yükleme birleştirme yapıyor; aynı dosyayı iki kez yüklemek kaydı çoğaltmıyor.

**Arayüz (v3)**
- Altta 4 sekme: **Bugün, Kayıtlar, Özet, Ayarlar**.
- Bugün: Duruma göre değişen tek bir ana kart (en fazla 2 buton + 1 link), aynı anda tek uyarı, altında "Günün akışı" listesi.
- Kayıtlar: Aylık takvim (renk kodlu), aylık özet kutuları, haftalık tablo. Bir güne dokununca alttan düzenleme paneli açılıyor; düzenleme sadece burada.
- Takvim renkleri: artıda yeşil, eksikte kırmızı, çıkışı eksik turuncu kesikli, yıllık izin mavi, rapor mor, resmi tatil turuncu; altta mavi çizgi = dış görev; dolu kırmızı nokta = izin girilmemiş ihlal; boş kırmızı halka = izin girilmiş ihlal.
- Özet: Hafta / ay / tümü; fark, net çalışma, mola, ihlal, dış görev günleri, fark grafiği, çıkışı eksik günler ve mazeret izni bekleyen günler. Bekleyen sayısı menüde rozet olarak görünüyor.
- Görsel: Archivo fontu, açık/koyu tema renk değişkenleri, 320 px genişliğe kadar test edildi.

**Demo modu**
- `const DEMO = true` ile demo sürümü üretiliyor. Ayrı localStorage anahtarı (`mesaiTakip:demo`), sayfa yenilenince sıfırlanıyor, senkronizasyon kapalı.
- 6 haftalık, 30'dan fazla senaryolu örnek veri üretiliyor. Her günün panelinde "Demo senaryosu: …" notu var.
- Test kancaları (`window.__mt`) sadece demo modunda açık.
- Sohbet sırasında Playwright ile 25 hesaplama + 36 arayüz testi çalıştırıldı (hepsi geçti). **Bu test betikleri repoda yok**, yeniden yazılması gerekiyor (emin değilim, kullanıcıyla netleştirilmeli).

### 4. Denenip vazgeçilen ya da sorun çıkaranlar

- **claude.ai artifact linkiyle paylaşım:** Hesabı olmayan ya da sahibi olmayan kullanıcılar için veriler iframe içindeki tarayıcı depolamasında tutuluyordu ve tarayıcı kapanınca siliniyordu (özellikle iPhone Safari). Bu yüzden GitHub Pages'te bağımsız PWA'ya geçildi.
- **`confirm()` / `alert()`:** Artifact iframe'inde çalışmadı, "yanlışlıkla bastım, iptal et" butonu tepkisiz kaldı. İki dokunuşla onay ve toast'a geçildi.
- **Onay butonu hatası:** İkinci dokunuş onay yerine yok sayılıyordu ("Yine de çık" basılmıyordu). Düzeltildi.
- **`hidden` özelliği** buton CSS'i tarafından eziliyordu, gizli butonlar görünüyordu. `[hidden]{display:none !important}` eklendi.
- **320 px'de yatay taşma:** Grid sütunları `minmax(0,1fr)` yapılarak düzeltildi.
- **CSV geri yükleme:** 1 dakikadan kısa parçalar geri yüklenince "çıkışı eksik" kayda dönüşüyordu; saniye hassasiyeti 1 dk sapma yaratıyordu. İkisi de düzeltildi.
- **Çıkışı eksik günler** sessizce hesap dışında kalıyordu. Artık takvimde, üst uyarıda ve Özet'te gösteriliyor.
- **GitHub'a yükleme:** Klasörün kendisi yüklenince `index.html` bir alt klasörde kaldı. Dosyalar klasörün içinden seçilip repo köküne yüklenmeli.
- **Android APK (Capacitor) / iOS uygulaması:** Konuşuldu, yapılmadı. iOS için yıllık 99$ geliştirici hesabı gerekiyor. PWA yeterli görüldü.

### 5. Yapılmamış, aklımızdaki özellikler ve açık sorular

**Kullanıcı onayını bekleyen kararlar**
- Resmi tatil / izin / rapor günlerinde çalışılırsa yemek arası şu an **düşülüyor**. Hafta sonu gibi düşülmemeli mi?
- Molalar çekirdek saat içinde olsa bile ihlal sayılmıyor. Bu doğru mu?
- Bugün erken çıkılırsa ihlal süresi çekirdek saat bitene kadar canlı artıyor ve gün sonunda kesinleşiyor. Bu davranış uygun mu?

**Yayın durumu**
- GitHub Pages'te en son yüklenmesi önerilen sürüm: hafta sonu, dış görev, çekirdek saat ihlali ve izin/rapor/tatil türlerini içeren sürüm (eski tek sayfalık arayüz). Repodaki `index.html` bu sürüm; Pages'te yayında olup olmadığı doğrulanmadı (emin değilim).
- **v3 arayüzü (sekmeler, takvim, alt panel) henüz GitHub'a yüklenmedi.** Yukarıdaki üç soru onaylanınca yayınlanacak.
- Yayın öncesi kullanıcılara CSV yedeği aldırılması öneriliyor.

**Önerilmiş ama yapılmamış**
- Gün türü olarak **yarım gün izin** ve **arife** (13:00'ten sonrası tatil).
- Uygulama kapalıyken bildirim (çekirdek saat yaklaşınca, çıkış unutulunca). Basit PWA'da yapılmadı; push bildirim altyapısı gerekir.
- Cihazlar arası senkronizasyon: Bağımsız sürümde veri tek cihazda. Telefon değişiminde CSV yedeği ile taşınıyor.
- Harici bir giriş/çıkış sisteminin (PDKS) raporunu içe aktarıp gün gün fark gösterme. Özellik olarak istenmedi (emin değilim).
- Hafta sonu ve fazla çalışma kayıtları için ayrı bir rapor (emin değilim).
- Otomatik test betiklerinin repoya eklenmesi.
