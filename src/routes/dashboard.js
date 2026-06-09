const express = require('express');
const dashboard = require('../services/dashboard');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    const metrics = await dashboard.getMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top10', async (req, res) => {
  try {
    const top10 = await dashboard.getTop10();
    res.json({ updatedAt: new Date().toISOString(), products: top10 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
