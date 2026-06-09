const aliexpress = require('./aliexpress');
const ebay = require('./ebay');
const config = require('../config');

const EBAY_FEE_RATE = 0.1325;
const PAYPAL_FEE_RATE = 0.0349;
const PAYPAL_FIXED_FEE = 0.49;

function calculateProfit(sellingPrice, costPrice) {
  const ebayFee = sellingPrice * EBAY_FEE_RATE;
  const paypalFee = sellingPrice * PAYPAL_FEE_RATE + PAYPAL_FIXED_FEE;
  const totalFees = ebayFee + paypalFee;
  const netProfit = sellingPrice - costPrice - totalFees;
  const marginPercent = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

  return {
    sellingPrice,
    costPrice,
    ebayFee: Math.round(ebayFee * 100) / 100,
    paypalFee: Math.round(paypalFee * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

function scoreProduct(aliProduct, ebayStats) {
  let score = 0;

  if (aliProduct.orders >= 1000) score += 30;
  else if (aliProduct.orders >= 500) score += 25;
  else if (aliProduct.orders >= 100) score += 20;
  else if (aliProduct.orders >= 50) score += 10;

  if (aliProduct.rating >= 96) score += 20;
  else if (aliProduct.rating >= 90) score += 15;
  else if (aliProduct.rating >= 80) score += 10;

  const profit = calculateProfit(ebayStats.avgPrice, aliProduct.price);
  if (profit.marginPercent >= 40) score += 30;
  else if (profit.marginPercent >= 25) score += 20;
  else if (profit.marginPercent >= 15) score += 10;
  else if (profit.marginPercent < 5) score -= 10;

  if (aliProduct.isCustomizable) score += 10;
  if (ebayStats.count >= 10) score += 10;

  return Math.max(0, Math.min(100, score));
}

function getRecommendation(score, marginPercent) {
  if (score >= 70 && marginPercent >= 25) return { level: 'excellent', label: 'Çok İyi Fırsat', color: '#22c55e' };
  if (score >= 50 && marginPercent >= 15) return { level: 'good', label: 'İyi Fırsat', color: '#84cc16' };
  if (score >= 35 && marginPercent >= 10) return { level: 'moderate', label: 'Orta', color: '#eab308' };
  if (marginPercent < 5) return { level: 'poor', label: 'Düşük Marj', color: '#ef4444' };
  return { level: 'low', label: 'Düşük Potansiyel', color: '#f97316' };
}

async function compareProduct(aliProduct) {
  const searchQuery = ebay.buildSearchQueryFromTitle(aliProduct.title);
  const ebayResult = await ebay.searchItems({ query: searchQuery, limit: 15 });
  const ebayStats = ebay.calculateEbayStats(ebayResult.items);
  const profit = calculateProfit(ebayStats.avgPrice || aliProduct.price * 2, aliProduct.price);
  const score = scoreProduct(aliProduct, ebayStats);
  const recommendation = getRecommendation(score, profit.marginPercent);

  return {
    aliexpress: aliProduct,
    ebay: {
      searchQuery,
      stats: ebayStats,
      sampleListings: ebayResult.items.slice(0, 5),
    },
    profit,
    score,
    recommendation,
  };
}

async function scanCategory({ keywords, hotOnly = true, limit = 15, minOrders = 50 }) {
  const searchFn = hotOnly ? aliexpress.getHotProducts : aliexpress.searchProducts;
  const aliResult = await searchFn({ keywords, pageSize: Math.min(limit * 2, 50) });

  const filtered = aliResult.products
    .filter((p) => p.orders >= minOrders && p.price > 0 && p.price < 50)
    .slice(0, limit);

  const comparisons = [];
  for (const product of filtered) {
    try {
      const comparison = await compareProduct(product);
      comparisons.push(comparison);
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      comparisons.push({
        aliexpress: product,
        error: err.message,
        score: 0,
        recommendation: { level: 'error', label: 'Hata', color: '#6b7280' },
      });
    }
  }

  comparisons.sort((a, b) => (b.score || 0) - (a.score || 0));
  return comparisons;
}

async function scanAllPresets({ hotOnly = true, limitPerCategory = 5, minOrders = 50 }) {
  const results = [];

  for (const preset of config.jewelryPresets) {
    try {
      const items = await scanCategory({
        keywords: preset.keywords,
        hotOnly,
        limit: limitPerCategory,
        minOrders,
      });

      results.push({
        preset,
        items,
        topPick: items[0] || null,
      });
    } catch (err) {
      results.push({
        preset,
        items: [],
        error: err.message,
      });
    }
  }

  return results;
}

module.exports = {
  compareProduct,
  scanCategory,
  scanAllPresets,
  calculateProfit,
  scoreProduct,
};
