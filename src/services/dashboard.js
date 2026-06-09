const aliexpress = require('./aliexpress');
const config = require('../config');

const JEWELRY_SEARCH_TERMS = [
  'stainless steel jewelry',
  'stainless steel ring',
  'custom name necklace steel',
  'stainless steel bracelet',
  'steel earrings hypoallergenic',
];

function estimateDailySales(orders) {
  return Math.max(1, Math.round(orders / 30));
}

function dedupeById(products) {
  const seen = new Set();
  return products.filter((p) => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

async function fetchHotProductsForTerm(term, pageSize = 20) {
  try {
    const result = await aliexpress.getHotProducts({ keywords: term, pageSize });
    return result.products;
  } catch {
    return [];
  }
}

async function getTop10() {
  const batches = await Promise.all(
    JEWELRY_SEARCH_TERMS.map((term) => fetchHotProductsForTerm(term, 15))
  );

  const merged = dedupeById(batches.flat())
    .filter((p) => p.orders > 0 && p.price > 0)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10)
    .map((p, index) => ({
      rank: index + 1,
      ...p,
      dailySalesEstimate: estimateDailySales(p.orders),
      weeklySalesEstimate: estimateDailySales(p.orders) * 7,
    }));

  return merged;
}

async function getMetrics() {
  const top10 = await getTop10();

  const totalOrders = top10.reduce((sum, p) => sum + p.orders, 0);
  const totalDailySales = top10.reduce((sum, p) => sum + p.dailySalesEstimate, 0);
  const avgPrice = top10.length
    ? top10.reduce((sum, p) => sum + p.price, 0) / top10.length
    : 0;
  const avgRating = top10.length
    ? top10.reduce((sum, p) => sum + (p.rating || 0), 0) / top10.length
    : 0;
  const customizableCount = top10.filter((p) => p.isCustomizable).length;

  const categoryBreakdown = top10.reduce((acc, p) => {
    const cat = p.isCustomizable ? 'Özelleştirilebilir' : 'Standart';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const salesTrend = top10.map((p) => ({
    label: `#${p.rank}`,
    value: p.dailySalesEstimate,
    orders: p.orders,
  }));

  return {
    updatedAt: new Date().toISOString(),
    totalOrders,
    totalDailySales,
    avgPrice: Math.round(avgPrice * 100) / 100,
    avgRating: Math.round(avgRating * 10) / 10,
    topProductCount: top10.length,
    customizableCount,
    categoryBreakdown,
    salesTrend,
    top10,
  };
}

module.exports = { getTop10, getMetrics, estimateDailySales };
