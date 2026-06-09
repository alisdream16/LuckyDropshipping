# LuckyDropshipping

AliExpress ve eBay üzerinde **çelik takı** ve benzeri dropshipping ürünlerini karşılaştıran araştırma aracı. Yüksek siparişli AliExpress ürünlerini eBay aktif ilanlarıyla eşleştirir, kâr marjını hesaplar.

## Özellikler

- AliExpress OAuth callback (Railway uyumlu)
- Çok satan ürün taraması (`hotproduct.query`)
- eBay Browse API ile fiyat karşılaştırması
- 8 hazır çelik takı kategorisi (yüzük, kolye, bileklik, özelleştirilebilir vb.)
- Marj hesaplayıcı (eBay %13.25 + PayPal ücretleri dahil)
- Ürün skorlama (sipariş, puan, marj)

## AliExpress Callback URL

Railway'e deploy ettikten sonra AliExpress konsolunda şu URL'yi girin:

```
https://SIZIN-RAILWAY-DOMAIN.up.railway.app/api/aliexpress/callback
```

Bu URL dashboard'da da görünür. AliExpress App Management → Basic Settings → Callback URL alanına **birebir aynı** adresi yazın.

### OAuth Akışı

1. Dashboard'da **AliExpress Bağlan** butonuna tıklayın
2. AliExpress hesabınızla giriş yapıp uygulamayı yetkilendirin
3. Callback sayfası token'ı kaydeder
4. Ürün araması yapabilirsiniz

> Dropshipping API kullanıyorsanız önce [dropshipping programına](https://home.aliexpress.com/dropshipper/join_drop_shipper.htm) katılmanız gerekir.

## Railway Kurulumu

1. GitHub repo'yu Railway'e bağlayın (zaten bağlı)
2. **Variables** sekmesinde şunları ekleyin:

| Değişken | Açıklama |
|----------|----------|
| `BASE_URL` | Railway public URL (ör. `https://luckydropshipping-production.up.railway.app`) |
| `ALIEXPRESS_APP_KEY` | AliExpress App Key |
| `ALIEXPRESS_APP_SECRET` | AliExpress App Secret |
| `ALIEXPRESS_REDIRECT_URI` | `{BASE_URL}/api/aliexpress/callback` |
| `EBAY_CLIENT_ID` | eBay Production Client ID |
| `EBAY_CLIENT_SECRET` | eBay Production Client Secret |
| `EBAY_MARKETPLACE_ID` | `EBAY_US` (varsayılan) |

3. Deploy tamamlandığında `/api/health` endpoint'i `ok` döner.

## Yerel Geliştirme

```bash
npm install
cp .env.example .env
# .env dosyasını düzenleyin
npm run dev
```

http://localhost:3000 adresinde açılır.

## API Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/health` | Sağlık kontrolü + callback URL |
| `GET /api/aliexpress/auth` | OAuth yetkilendirme başlat |
| `GET /api/aliexpress/callback` | OAuth callback (AliExpress buraya yönlendirir) |
| `GET /api/aliexpress/search?q=...` | AliExpress ürün arama |
| `GET /api/ebay/search?q=...` | eBay ilan arama |
| `GET /api/compare/scan?keywords=...` | Tek kategori tarama + karşılaştırma |
| `GET /api/compare/scan-all` | Tüm kategorileri tara |
| `GET /api/compare/profit?selling=19.99&cost=4.50` | Marj hesapla |

## API Anahtarları Nereden Alınır?

### AliExpress
1. [console.aliexpress.com](https://console.aliexpress.com) → App Management
2. Web App oluşturun
3. Callback URL: Railway domain'iniz + `/api/aliexpress/callback`
4. Affiliate API veya Dropshipping API izinlerini isteyin

### eBay
1. [developer.ebay.com](https://developer.ebay.com) → Application Keys
2. Production key set oluşturun
3. OAuth scope: `https://api.ebay.com/oauth/api_scope`
4. Browse API erişimi otomatik gelir

## Notlar

- eBay satış geçmişi (sold items) Marketplace Insights API ile sınırlıdır; bu araç **aktif ilan fiyatlarını** karşılaştırır.
- AliExpress sipariş sayısı (`lastest_volume`) iyi satış göstergesi olarak kullanılır.
- Railway'de token dosyası ephemeral olabilir; production'da Redis/DB kullanımı önerilir.
