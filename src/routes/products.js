const express = require('express');
const productIntel = require('../services/productIntel');
const { parseFilters } = require('../services/filterEngine');
const usStateWeights = require('../data/usStateWeights');

const router = express.Router();

router.get('/filters/schema', (req, res) => {
  res.json({
    filters: [
      { key: 'keywords', type: 'text', label: 'Anahtar kelime' },
      { key: 'minOrders', type: 'number', label: 'Min. sipariş' },
      { key: 'maxOrders', type: 'number', label: 'Max. sipariş' },
      { key: 'minDailySales', type: 'number', label: 'Min. günlük satış' },
      { key: 'maxDailySales', type: 'number', label: 'Max. günlük satış' },
      { key: 'minPrice', type: 'number', label: 'Min. fiyat ($)' },
      { key: 'maxPrice', type: 'number', label: 'Max. fiyat ($)' },
      { key: 'minRating', type: 'number', label: 'Min. puan (%)' },
      { key: 'minMargin', type: 'number', label: 'Min. kar marjı (%)' },
      { key: 'maxMargin', type: 'number', label: 'Max. kar marjı (%)' },
      { key: 'maxShipping', type: 'number', label: 'Max. kargo ($)' },
      { key: 'maxDeliveryDays', type: 'number', label: 'Max. teslimat (gün)' },
      { key: 'customizableOnly', type: 'boolean', label: 'Sadece özelleştirilebilir' },
      { key: 'usStates', type: 'multiselect', label: 'ABD eyaletleri', options: usStateWeights.map((s) => ({ code: s.code, name: s.name })) },
      { key: 'shipToCountry', type: 'select', label: 'Kargo ülkesi', options: ['US', 'CA', 'GB', 'DE', 'AU'] },
      { key: 'hotOnly', type: 'boolean', label: 'Sadece çok satanlar' },
    ],
    regionDisclaimer: 'ABD eyalet dağılımı AliExpress API verisi değil; talep modeli tahminidir.',
  });
});

router.get('/scan', async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    if (!filters.keywords) {
      filters.keywords = 'stainless steel jewelry';
    }
    const result = await productIntel.scanAndFilter(filters);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analyze/:productId', async (req, res) => {
  try {
    const aliexpress = require('../services/aliexpress');
    const { shipToCountry = 'US' } = req.query;

    let products = await aliexpress.getProductDetail(req.params.productId, shipToCountry);
    if (!products.length) {
      const search = await aliexpress.searchProducts({ keywords: req.params.productId, pageSize: 1 });
      products = search.products;
    }
    if (!products.length) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }

    const intel = await productIntel.enrichProduct(products[0], { shipToCountry });
    res.json(intel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/match', async (req, res) => {
  try {
    const { productIds = [], filters: filterBody = {} } = req.body;
    const filters = parseFilters({ ...filterBody, limit: productIds.length || 10 });
    const aliexpress = require('../services/aliexpress');
    const results = [];

    for (const id of productIds.slice(0, 10)) {
      const products = await aliexpress.getProductDetail(id);
      if (products[0]) {
        const intel = await productIntel.enrichProduct(products[0]);
        const { matchProduct } = require('../services/filterEngine');
        results.push({ ...intel, filterMatch: matchProduct(intel, filters) });
      }
    }

    res.json({ products: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
