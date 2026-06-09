function parseNum(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function parseFilters(query = {}) {
  return {
    keywords: query.keywords || query.q || '',
    hotOnly: query.hotOnly !== 'false' && query.hot !== 'false',
    minOrders: parseNum(query.minOrders) ?? 0,
    maxOrders: parseNum(query.maxOrders),
    minDailySales: parseNum(query.minDailySales),
    maxDailySales: parseNum(query.maxDailySales),
    minPrice: parseNum(query.minPrice),
    maxPrice: parseNum(query.maxPrice),
    minRating: parseNum(query.minRating),
    minMargin: parseNum(query.minMargin),
    maxMargin: parseNum(query.maxMargin),
    maxShipping: parseNum(query.maxShipping),
    maxDeliveryDays: parseNum(query.maxDeliveryDays),
    customizableOnly: query.customizableOnly === 'true' || query.customizable === 'true',
    shipToCountry: query.shipToCountry || query.country || 'US',
    usStates: query.usStates ? String(query.usStates).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [],
    limit: Math.min(parseInt(query.limit, 10) || 20, 50),
    pageSize: Math.min(parseInt(query.pageSize, 10) || 40, 50),
  };
}

function estimateDailySales(orders) {
  return Math.max(1, Math.round(orders / 30));
}

function matchProduct(intel, filters) {
  const checks = [];
  const p = intel.product;
  const sales = intel.sales;
  const profit = intel.profit;
  const shipping = intel.shipping;

  const add = (field, pass, expected, actual) => {
    checks.push({ field, pass, expected, actual });
  };

  if (filters.minOrders > 0) {
    add('minOrders', p.orders >= filters.minOrders, `≥${filters.minOrders}`, p.orders);
  }
  if (filters.maxOrders != null) {
    add('maxOrders', p.orders <= filters.maxOrders, `≤${filters.maxOrders}`, p.orders);
  }
  if (filters.minDailySales != null) {
    add('minDailySales', sales.dailyEstimate >= filters.minDailySales, `≥${filters.minDailySales}/gün`, sales.dailyEstimate);
  }
  if (filters.maxDailySales != null) {
    add('maxDailySales', sales.dailyEstimate <= filters.maxDailySales, `≤${filters.maxDailySales}/gün`, sales.dailyEstimate);
  }
  if (filters.minPrice != null) {
    add('minPrice', p.price >= filters.minPrice, `≥$${filters.minPrice}`, p.price);
  }
  if (filters.maxPrice != null) {
    add('maxPrice', p.price <= filters.maxPrice, `≤$${filters.maxPrice}`, p.price);
  }
  if (filters.minRating != null) {
    add('minRating', p.rating >= filters.minRating, `≥%${filters.minRating}`, p.rating);
  }
  if (filters.minMargin != null) {
    add('minMargin', profit.marginPercent >= filters.minMargin, `≥%${filters.minMargin}`, profit.marginPercent);
  }
  if (filters.maxMargin != null) {
    add('maxMargin', profit.marginPercent <= filters.maxMargin, `≤%${filters.maxMargin}`, profit.marginPercent);
  }
  if (filters.maxShipping != null) {
    add('maxShipping', shipping.cost <= filters.maxShipping, `≤$${filters.maxShipping}`, shipping.cost);
  }
  if (filters.maxDeliveryDays != null) {
    const days = shipping.estimatedDays || 99;
    add('maxDeliveryDays', days <= filters.maxDeliveryDays, `≤${filters.maxDeliveryDays} gün`, days);
  }
  if (filters.customizableOnly) {
    add('customizable', p.isCustomizable, 'özelleştirilebilir', p.isCustomizable);
  }
  if (filters.usStates.length > 0) {
    const topStates = intel.regions.topStates.map((r) => r.code);
    const overlap = filters.usStates.filter((s) => topStates.includes(s));
    add('usStates', overlap.length > 0, filters.usStates.join(', '), overlap.join(', ') || 'eşleşme yok');
  }

  const passed = checks.filter((c) => c.pass);
  const failed = checks.filter((c) => !c.pass);
  const score = checks.length ? Math.round((passed.length / checks.length) * 100) : 100;

  return {
    matched: failed.length === 0,
    score,
    checks,
    passed,
    failed,
  };
}

function applyFilters(intelList, filters) {
  return intelList
    .map((intel) => ({
      ...intel,
      filterMatch: matchProduct(intel, filters),
    }))
    .filter((intel) => intel.filterMatch.matched)
    .sort((a, b) => b.filterMatch.score - a.filterMatch.score || b.sales.dailyEstimate - a.sales.dailyEstimate);
}

module.exports = { parseFilters, matchProduct, applyFilters, estimateDailySales };
