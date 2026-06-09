const aliexpress = require('./aliexpress');
const ebay = require('./ebay');
const compare = require('./compare');
const usStateWeights = require('../data/usStateWeights');
const { estimateDailySales } = require('./filterEngine');

function estimateRegions(dailySales, topN = 10) {
  const regions = usStateWeights.map((s) => ({
    code: s.code,
    name: s.name,
    share: s.weight,
    estimatedDaily: Math.max(0, Math.round(dailySales * s.weight)),
  }));

  const topStates = [...regions].sort((a, b) => b.estimatedDaily - a.estimatedDaily).slice(0, topN);
  const primaryMarket = topStates[0] || null;

  return {
    model: 'tahmini',
    disclaimer: 'AliExpress bölge satış verisi sunmaz; ABD e-ticaret talep modeline dayalı tahmindir.',
    primaryMarket,
    topStates,
    allStates: regions,
  };
}

function getSalesVelocity(daily) {
  if (daily >= 100) return { level: 'viral', label: 'Çok Yüksek', color: '#ef4444' };
  if (daily >= 50) return { level: 'hot', label: 'Yüksek', color: '#f59e0b' };
  if (daily >= 20) return { level: 'good', label: 'İyi', color: '#10b981' };
  if (daily >= 5) return { level: 'moderate', label: 'Orta', color: '#6366f1' };
  return { level: 'low', label: 'Düşük', color: '#8b9cb8' };
}

function calculateProfitWithShipping(sellingPrice, costPrice, shippingCost) {
  const base = compare.calculateProfit(sellingPrice, costPrice);
  const totalCost = costPrice + shippingCost;
  const netWithShipping = base.sellingPrice - totalCost - base.totalFees;
  const marginWithShipping = base.sellingPrice > 0 ? (netWithShipping / base.sellingPrice) * 100 : 0;

  return {
    ...base,
    shippingCost,
    totalCost: Math.round(totalCost * 100) / 100,
    netProfit: Math.round(netWithShipping * 100) / 100,
    marginPercent: Math.round(marginWithShipping * 10) / 10,
  };
}

async function enrichProduct(product, options = {}) {
  const { shipToCountry = 'US', includeEbay = true, includeRelated = true } = options;

  const dailyEstimate = estimateDailySales(product.orders);
  const freight = await aliexpress.getFreight(product.id, shipToCountry);
  const shippingCost = freight?.cost ?? 2.99;

  let ebayData = { stats: { avgPrice: product.price * 2.5, count: 0 }, searchQuery: '', sampleListings: [] };
  if (includeEbay && product.title) {
    try {
      const searchQuery = ebay.buildSearchQueryFromTitle(product.title);
      const ebayResult = await ebay.searchItems({ query: searchQuery, limit: 10 });
      ebayData = {
        searchQuery,
        stats: ebay.calculateEbayStats(ebayResult.items),
        sampleListings: ebayResult.items.slice(0, 3),
      };
    } catch {
      /* eBay optional */
    }
  }

  const sellingPrice = ebayData.stats.avgPrice || product.price * 2.5;
  const profit = calculateProfitWithShipping(sellingPrice, product.price, shippingCost);
  const regions = estimateRegions(dailyEstimate);

  let boughtTogether = [];
  if (includeRelated && product.id) {
    boughtTogether = await aliexpress.getSmartMatch(product.id, 5);
  }

  const velocity = getSalesVelocity(dailyEstimate);

  return {
    product,
    sales: {
      totalOrders: product.orders,
      dailyEstimate,
      weeklyEstimate: dailyEstimate * 7,
      monthlyEstimate: dailyEstimate * 30,
      velocity,
      summary: `Bu ürün tahmini günlük ${dailyEstimate} adet satıyor (son dönem ${product.orders.toLocaleString()} sipariş)`,
    },
    shipping: {
      cost: shippingCost,
      currency: freight?.currency || 'USD',
      method: freight?.company || 'AliExpress Standard',
      shipFrom: freight?.shipFrom || 'China',
      shipTo: shipToCountry,
      estimatedDays: product.deliveryDays || (shipToCountry === 'US' ? 15 : 20),
      tracking: freight?.tracking ?? true,
      estimated: freight?.estimated || false,
      summary: `ABD kargo maliyeti: $${shippingCost.toFixed(2)} (${freight?.company || 'Standard'})`,
    },
    profit: {
      ...profit,
      summary: `Kar marjı: %${profit.marginPercent} — net kâr $${profit.netProfit.toFixed(2)} (kargo dahil)`,
    },
    regions,
    ebay: ebayData,
    boughtTogether: boughtTogether.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      orders: p.orders,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      matchReason: 'Bu ürünü alanlar bunu da aldı (AliExpress öneri)',
    })),
    insight: buildInsight(product, dailyEstimate, profit, regions, shippingCost),
  };
}

function buildInsight(product, daily, profit, regions, shipping) {
  const top = regions.primaryMarket;
  const lines = [
    `📦 Bugün tahmini ${daily} adet satıyor`,
    `💰 Kar marjı %${profit.marginPercent} (net $${profit.netProfit}, kargo $${shipping.toFixed(2)} dahil)`,
    `🚚 ABD kargo: $${shipping.toFixed(2)} — tahmini teslimat`,
  ];
  if (top) {
    lines.push(`🇺🇸 En çok talep: ${top.name} (${top.code}) — günde ~${top.estimatedDaily} adet`);
    if (regions.topStates[1]) {
      lines.push(`📍 Ayrıca güçlü: ${regions.topStates[1].name}, ${regions.topStates[2]?.name || ''}`);
    }
  }
  if (product.isCustomizable) lines.push('✨ Özelleştirilebilir ürün — yüksek dönüşüm potansiyeli');
  return lines;
}

async function scanAndFilter(filters) {
  const searchFn = filters.hotOnly ? aliexpress.getHotProducts : aliexpress.searchProducts;
  const keywords = filters.keywords || 'stainless steel jewelry';

  const aliResult = await searchFn({
    keywords,
    pageSize: filters.pageSize,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    shipToCountry: filters.shipToCountry,
    deliveryDays: filters.maxDeliveryDays,
  });

  const candidates = aliResult.products.filter((p) => p.price > 0);
  const enriched = [];

  for (const product of candidates) {
    try {
      const intel = await enrichProduct(product, { shipToCountry: filters.shipToCountry });
      enriched.push(intel);
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      enriched.push({
        product,
        error: err.message,
        filterMatch: { matched: false, score: 0 },
      });
    }
    if (enriched.length >= filters.limit * 3) break;
  }

  const { applyFilters } = require('./filterEngine');
  const matched = applyFilters(enriched.filter((i) => !i.error), filters);

  return {
    keywords,
    filters,
    scanned: enriched.length,
    matched: matched.length,
    products: matched.slice(0, filters.limit),
  };
}

module.exports = { enrichProduct, scanAndFilter, estimateRegions, calculateProfitWithShipping };
