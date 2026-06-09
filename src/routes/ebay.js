const express = require('express');
const ebay = require('../services/ebay');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20, minPrice, maxPrice } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Arama kelimesi gerekli (q)' });
    }

    const result = await ebay.searchItems({
      query: q,
      limit: parseInt(limit, 10),
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    });

    res.json({
      ...result,
      stats: ebay.calculateEbayStats(result.items),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
