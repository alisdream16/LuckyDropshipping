const express = require('express');
const compare = require('../services/compare');
const aliexpress = require('../services/aliexpress');
const config = require('../config');

const router = express.Router();

router.get('/presets', (req, res) => {
  res.json(config.jewelryPresets);
});

router.get('/scan', async (req, res) => {
  try {
    const { keywords, hot = 'true', limit = 10, minOrders = 50 } = req.query;
    if (!keywords) {
      return res.status(400).json({ error: 'keywords parametresi gerekli' });
    }

    const results = await compare.scanCategory({
      keywords,
      hotOnly: hot !== 'false',
      limit: parseInt(limit, 10),
      minOrders: parseInt(minOrders, 10),
    });

    res.json({ keywords, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scan-all', async (req, res) => {
  try {
    const { limit = 5, minOrders = 50, hot = 'true' } = req.query;

    const results = await compare.scanAllPresets({
      hotOnly: hot !== 'false',
      limitPerCategory: parseInt(limit, 10),
      minOrders: parseInt(minOrders, 10),
    });

    const allItems = results
      .flatMap((r) => r.items || [])
      .filter((item) => item.score)
      .sort((a, b) => b.score - a.score);

    res.json({
      categories: results.length,
      totalProducts: allItems.length,
      topOpportunities: allItems.slice(0, 20),
      byCategory: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/product', async (req, res) => {
  try {
    const { productId, title, price, orders, rating, imageUrl, productUrl } = req.body;

    let product;
    if (productId) {
      const search = await aliexpress.searchProducts({ keywords: productId, pageSize: 1 });
      product = search.products[0];
    }

    if (!product) {
      product = aliexpress.normalizeProduct({
        product_id: productId,
        product_title: title,
        target_sale_price: price,
        lastest_volume: orders,
        evaluate_rate: rating,
        product_main_image_url: imageUrl,
        promotion_link: productUrl,
      });
    }

    const result = await compare.compareProduct(product);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profit', (req, res) => {
  const sellingPrice = parseFloat(req.query.selling || req.query.sell);
  const costPrice = parseFloat(req.query.cost);
  if (!sellingPrice || !costPrice) {
    return res.status(400).json({ error: 'selling ve cost parametreleri gerekli' });
  }
  res.json(compare.calculateProfit(sellingPrice, costPrice));
});

module.exports = router;
