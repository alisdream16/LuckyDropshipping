const express = require('express');
const config = require('../config');
const aliexpress = require('../services/aliexpress');
const { setAliExpressToken, getAliExpressToken } = require('../utils/tokenStore');

const router = express.Router();

router.get('/auth', (req, res) => {
  if (!config.aliexpress.appKey) {
    return res.status(400).json({ error: 'ALIEXPRESS_APP_KEY ayarlanmamış' });
  }
  const url = aliexpress.getAuthorizeUrl();
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#fff">
        <h2>AliExpress Yetkilendirme Hatası</h2>
        <p>${error}: ${errorDescription || 'Bilinmeyen hata'}</p>
        <a href="/" style="color:#60a5fa">Ana sayfaya dön</a>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).json({ error: 'Authorization code bulunamadı' });
  }

  try {
    const tokenData = await aliexpress.exchangeCodeForToken(code);
    setAliExpressToken(tokenData);

    res.send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#fff;text-align:center">
        <h2 style="color:#22c55e">✓ AliExpress Bağlantısı Başarılı</h2>
        <p>Access token kaydedildi. Artık ürün araması yapabilirsiniz.</p>
        <a href="/" style="display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px">
          Dashboard'a Git
        </a>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#fff">
        <h2>Token Alma Hatası</h2>
        <p>${err.message}</p>
        <a href="/" style="color:#60a5fa">Ana sayfaya dön</a>
      </body></html>
    `);
  }
});

router.get('/status', (req, res) => {
  const token = getAliExpressToken();
  res.json({
    connected: !!token?.access_token,
    redirectUri: config.aliexpress.redirectUri,
    hasAppKey: !!config.aliexpress.appKey,
    expiresAt: token?.expires_at || null,
  });
});

router.get('/search', async (req, res) => {
  try {
    const { q, keywords, page = 1, limit = 20, minPrice, maxPrice, hot } = req.query;
    const searchKeywords = q || keywords;
    if (!searchKeywords) {
      return res.status(400).json({ error: 'Arama kelimesi gerekli (q veya keywords)' });
    }

    const params = {
      keywords: searchKeywords,
      pageNo: parseInt(page, 10),
      pageSize: parseInt(limit, 10),
      minPrice,
      maxPrice,
    };

    const result = hot === 'true'
      ? await aliexpress.getHotProducts(params)
      : await aliexpress.searchProducts(params);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
