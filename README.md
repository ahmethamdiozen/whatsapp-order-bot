[🇬🇧 English](README.EN.md)

# WhatsApp AI Sipariş Botu

WhatsApp Cloud API üzerine inşa edilmiş, yapay zeka destekli restoran sipariş sistemi. Müşteriler doğal dilde WhatsApp'tan sipariş verir — bot niyeti anlar, Redis ile sepeti yönetir, Stripe üzerinden ödeme alır ve siparişleri veritabanına kaydeder.

Mesajlaşma API'leri, yapay zeka, ödeme sistemleri ve dağıtık backend entegrasyonunu gösteren bir portföy projesidir.

---

## Özellikler

- **Doğal dil siparişi** — müşteriler serbest yazar, Claude niyeti ayrıştırıp ürünleri çıkarır
- **Çok dilli destek** — İngilizce ve Türkçe; ilk mesajda dil seçimi yapılır
- **Çok şubeli destek** — müşteri sipariş öncesi şube seçer; menü şube bazında ayrılır
- **Etkileşimli menü** — kategori gruplandırmalı ve sepet özetiyle WhatsApp list arayüzü
- **Sepet yönetimi** — ürün ekle, çıkar, temizle; miktar takibi; ürün başına özel not
- **Oturum yönetimi** — Redis'te 1 saatlik TTL ile konuşma durumu takibi
- **Sipariş kalıcılığı** — onaylanan siparişler tüm kalem detaylarıyla PostgreSQL'e kaydedilir
- **Stripe ödemeleri** — sipariş onayından sonra ödeme linki gönderilir; webhook ödeme durumunu günceller
- **Sipariş durum bildirimleri** — mutfak sipariş durumunu güncellediğinde WhatsApp'tan bildirim
- **Promosyon kodları** — yüzde indirimli kodlar; son kullanma tarihi, kullanım limiti, admin yönetimi
- **Sadakat puanları** — harcanan her $1 için 1 puan; 100 puan = $5 indirim; sohbet içinde kullanılır
- **Hız sınırlama** — dakikada 30 mesaj (numara başına)
- **Hata kaydı** — Winston yapısal loglama + Sentry hata takibi
- **Admin API** — token korumalı REST API; siparişler, menü kalemleri, promosyon kodları ve sadakat yönetimi
- **Admin paneli** — sipariş yönetimi, menü düzenleyici, istatistikler ve grafiklerle React dashboard
- **Sipariş geçmişi** — müşteriler son 5 siparişlerini zaman damgasıyla görebilir
- **Hızlı yeniden sipariş** — önceki siparişi tek dokunuşla sepete yükle

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Çalışma ortamı | Node.js + TypeScript |
| Web framework | Express |
| Mesajlaşma | WhatsApp Cloud API (Meta Graph API v19.0) |
| Yapay Zeka | Anthropic Claude API (`claude-sonnet-4-5`) |
| Veritabanı | PostgreSQL + Prisma 7 |
| Oturum deposu | Redis (ioredis) |
| Ödeme | Stripe Checkout |
| Loglama | Winston + Sentry |
| Hız sınırlama | express-rate-limit |
| Altyapı | Docker Compose |
| Test | Jest + ts-jest + Supertest (86 test) |
| Admin paneli | React + Vite + Tailwind CSS + TanStack Query + Recharts |

---

## Mimari

```
Müşteri (WhatsApp)
       │
       ▼
Meta Webhook  POST /webhook
       │
       ▼
Hız Sınırlayıcı (dakikada 30 istek/numara)
       │
       ▼
Oturum Kontrolü (Redis)
       │
       ├── selecting_language    → TR / EN seçimi
       ├── selecting_location    → şube listesi
       ├── browsing_menu         → etkileşimli menü, sepet yönetimi
       ├── awaiting_confirmation → EVET/HAYIR, promo kodu, puan kullanımı
       └── post_order            → Yeni Sipariş / Tekrarla / Siparişlerim

       Sipariş onayında:
              │
              ├── Sipariş PostgreSQL'e kaydedilir
              ├── Sadakat puanı kazanılır
              ├── Stripe Checkout oturumu oluşturulur
              └── Ödeme linki WhatsApp'tan gönderilir

Mutfak (Admin API / Admin Paneli)
       │
       ▼
PATCH /admin/orders/:id/status
       │
       └── WhatsApp bildirimi → Müşteri
```

---

## Örnek Konuşma

```
Kullanıcı: Merhaba
Bot:       Hoş geldiniz! Dil seçin:
           1️⃣ English  2️⃣ Türkçe

Kullanıcı: 2
Bot:       Şube seçin:
           1. Merkez — 123 Ana Cad.
           2. Havalimanı — 456 Airport Rd

Kullanıcı: 1
Bot:       Merkez seçildi. İşte menümüz:
           [Kategorili etkileşimli menü]
           [Sipariş Ver | Sepeti Temizle | Menü düğmeleri]

Kullanıcı: [Burger'a dokunur]
Bot:       1x Burger eklendi! Sepet toplamı: $9.99

Kullanıcı: PROMO DEMO20
Bot:       ✅ Promosyon uygulandı! İndirim: -$2.00. Yeni toplam: $7.99

Kullanıcı: [Sipariş Ver'e dokunur] → EVET
Bot:       🎉 Sipariş #42 onaylandı!
           💳 Ödeme linki: https://checkout.stripe.com/...
```

---

## Bot Komutları

| Komut | Dil | Açıklama |
|---|---|---|
| `KALDIR [ürün]` / `REMOVE [item]` | TR / EN | Sepetten ürün çıkar |
| `NOT [ürün]: [metin]` / `NOTE [item]: [text]` | TR / EN | Özel talimat ekle |
| `SEPET` / `CART` | TR / EN | Sepet içeriğini göster |
| `MENÜ` / `MENU` | TR / EN | Menüyü göster |
| `TEMİZLE` / `CLEAR` | TR / EN | Sepeti boşalt |
| `PROMO [kod]` | — | Promosyon kodu uygula |
| `PUAN` / `POINTS` | TR / EN | Sadakat puan bakiyesi |
| `KULLAN` / `REDEEM` | TR / EN | Puan kullanarak indirim al |

---

## Kurulum

```bash
git clone https://github.com/ahmethamdiozen/whatsapp-order-bot
cd whatsapp-order-bot
npm install
cp .env.example .env   # değerleri doldurun
docker compose up -d   # Postgres + Redis başlatır
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Ortam değişkenleri ve harici servis kurulumu (Meta, Stripe, Sentry) için [README.EN.md](README.EN.md) dosyasına bakın.

---

## Testler

```bash
npm test              # 8 test paketinde 86 test
npm run test:coverage
```

---

## Yazar

**Ahmet Hamdi Özen** · [@ahmethamdiozen](https://github.com/ahmethamdiozen)
