const axios = require('axios');
const config = require('../config');

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const { clientId, clientSecret, sandbox } = config.ebay;
  if (!clientId || !clientSecret) {
    throw new Error('eBay CLIENT_ID ve CLIENT_SECRET ayarlanmamış');
  }

  const tokenUrl = sandbox
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
  return cachedToken;
}

function getApiBase() {
  return config.ebay.sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

function normalizeEbayItem(item) {
  const price = parseFloat(item.price?.value || 0);
  return {
    id: item.itemId || '',
    title: item.title || '',
    price,
    currency: item.price?.currency || 'USD',
    imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
    itemUrl: item.itemWebUrl || item.itemHref || '',
    condition: item.condition || '',
    seller: item.seller?.username || '',
    shippingCost: parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 0),
    buyingOptions: item.buyingOptions || [],
  };
}

async function searchItems({ query, limit = 20, minPrice, maxPrice }) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  const filters = [];
  if (minPrice || maxPrice) {
    const low = minPrice || 0;
    const high = maxPrice || 9999;
    filters.push(`price:[${low}..${high}]`);
    filters.push('priceCurrency:USD');
  }
  if (filters.length) {
    params.set('filter', filters.join(','));
  }

  const response = await axios.get(`${getApiBase()}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': config.ebay.marketplaceId,
    },
    timeout: 30000,
  });

  const items = response.data.itemSummaries || [];
  return {
    total: response.data.total || items.length,
    items: items.map(normalizeEbayItem),
  };
}

function buildSearchQueryFromTitle(title) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'new', 'free', 'shipping',
    'stainless', 'steel', 'ring', 'necklace', 'bracelet', 'earring', 'jewelry', 'custom',
  ]);

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);

  if (words.length < 2) {
    return title.split(/\s+/).slice(0, 4).join(' ');
  }
  return words.join(' ');
}

function calculateEbayStats(items) {
  if (!items.length) {
    return { avgPrice: 0, minPrice: 0, maxPrice: 0, count: 0, medianPrice: 0 };
  }

  const prices = items.map((i) => i.price + i.shippingCost).sort((a, b) => a - b);
  const sum = prices.reduce((a, b) => a + b, 0);
  const mid = Math.floor(prices.length / 2);

  return {
    avgPrice: Math.round((sum / prices.length) * 100) / 100,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    medianPrice: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2,
    count: prices.length,
  };
}

module.exports = {
  searchItems,
  buildSearchQueryFromTitle,
  calculateEbayStats,
  normalizeEbayItem,
};
