const axios = require('axios');
const config = require('../config');
const { signAliExpressParams, getAliExpressTimestamp } = require('../utils/signature');
const { getAliExpressToken } = require('../utils/tokenStore');

async function callAliExpressApi(method, businessParams = {}) {
  const { appKey, appSecret, apiUrl } = config.aliexpress;
  if (!appKey || !appSecret) {
    throw new Error('AliExpress APP_KEY ve APP_SECRET ayarlanmamış');
  }

  const params = {
    method,
    app_key: appKey,
    timestamp: getAliExpressTimestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    ...businessParams,
  };

  const token = getAliExpressToken();
  if (token?.access_token) {
    params.session = token.access_token;
  }

  params.sign = signAliExpressParams(params, appSecret);

  const response = await axios.post(apiUrl, new URLSearchParams(params), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    timeout: 30000,
  });

  const resultKey = method.replace(/\./g, '_') + '_response';
  const data = response.data[resultKey] || response.data;

  if (data?.resp_result?.resp_code && data.resp_result.resp_code !== '200') {
    throw new Error(data.resp_result.resp_msg || 'AliExpress API hatası');
  }

  return data;
}

function normalizeProduct(product) {
  const price = parseFloat(product.target_sale_price || product.sale_price || product.app_sale_price || 0);
  const originalPrice = parseFloat(product.target_original_price || product.original_price || price);
  const orders = parseInt(product.lastest_volume || product.orders || product.volume || 0, 10);
  const deliveryDays = parseInt(product.estimated_delivery_days || product.delivery_days || 0, 10);

  return {
    id: String(product.product_id || product.productId || ''),
    title: product.product_title || product.title || '',
    price,
    originalPrice,
    currency: product.target_sale_price_currency || product.sale_price_currency || 'USD',
    imageUrl: product.product_main_image_url || product.product_small_image_urls?.string?.[0] || '',
    productUrl: product.promotion_link || product.product_detail_url || product.product_url || '',
    rating: parseFloat(product.evaluate_rate || product.avg_evaluation_rating || 0),
    orders,
    shopName: product.shop_name || product.shop_title || '',
    commissionRate: parseFloat(product.commission_rate || 0),
    deliveryDays: deliveryDays || null,
    shipToCountry: product.ship_to_country || 'US',
    isCustomizable: /custom|personaliz|engrav|name|letter/i.test(product.product_title || product.title || ''),
  };
}

async function searchProducts({
  keywords, pageNo = 1, pageSize = 20, minPrice, maxPrice,
  sort = 'LAST_VOLUME_DESC', shipToCountry = 'US', deliveryDays,
}) {
  const businessParams = {
    keywords,
    page_no: pageNo,
    page_size: pageSize,
    target_currency: 'USD',
    target_language: 'EN',
    ship_to_country: shipToCountry,
    sort,
  };

  if (minPrice) businessParams.min_sale_price = minPrice;
  if (maxPrice) businessParams.max_sale_price = maxPrice;
  if (deliveryDays) businessParams.delivery_days = deliveryDays;

  const data = await callAliExpressApi('aliexpress.affiliate.product.query', businessParams);
  const result = data?.resp_result?.result || data?.result || {};
  const products = result.products?.product || [];

  return {
    total: parseInt(result.total_record_count || products.length, 10),
    products: (Array.isArray(products) ? products : [products]).filter(Boolean).map(normalizeProduct),
  };
}

async function getHotProducts({ keywords, pageNo = 1, pageSize = 20 }) {
  const data = await callAliExpressApi('aliexpress.affiliate.hotproduct.query', {
    keywords,
    page_no: pageNo,
    page_size: pageSize,
    target_currency: 'USD',
    target_language: 'EN',
    ship_to_country: 'US',
  });

  const result = data?.resp_result?.result || data?.result || {};
  const products = result.products?.product || [];

  return {
    total: parseInt(result.total_record_count || products.length, 10),
    products: (Array.isArray(products) ? products : [products]).filter(Boolean).map(normalizeProduct),
  };
}

function getAuthorizeUrl(state = 'luckydrop') {
  const { appKey, redirectUri, oauthAuthorizeUrl } = config.aliexpress;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appKey,
    redirect_uri: redirectUri,
    state,
    view: 'web',
    sp: 'ae',
  });
  return `${oauthAuthorizeUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { appKey, appSecret, redirectUri, oauthTokenUrl } = config.aliexpress;

  const response = await axios.post(
    oauthTokenUrl,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
}

async function getProductDetail(productIds, country = 'US') {
  const ids = Array.isArray(productIds) ? productIds.join(',') : String(productIds);
  const data = await callAliExpressApi('aliexpress.affiliate.productdetail.get', {
    product_ids: ids,
    target_currency: 'USD',
    target_language: 'EN',
    country,
    fields: 'commission_rate,sale_price,original_price,product_title,product_main_image_url,shop_name,evaluate_rate,lastest_volume,promotion_link',
  });

  const result = data?.resp_result?.result || data?.result || {};
  const products = result.products?.product || [];
  return (Array.isArray(products) ? products : [products]).filter(Boolean).map(normalizeProduct);
}

async function getFreight(productId, shipToCountry = 'US', quantity = 1) {
  try {
    const data = await callAliExpressApi('aliexpress.social.product.freight.query', {
      product_id: productId,
      ship_to_country: shipToCountry,
      ship_from_country: 'CN',
      quantity,
      currency: 'USD',
    });
    const result = data?.result || data;
    if (!result) return null;
    return {
      cost: parseFloat(result.freight_amount ?? result.freightAmount ?? 0),
      currency: result.currency || 'USD',
      company: result.company || 'AliExpress Standard Shipping',
      shipFrom: result.send_goods_country_full_name || 'China',
      deliveryDate: result.delivery_date || null,
      tracking: result.tracking_code === true || result.tracking_code === 'true',
    };
  } catch {
    return estimateFreight(shipToCountry);
  }
}

function estimateFreight(shipToCountry = 'US') {
  const defaults = { US: 2.99, CA: 3.49, GB: 2.49, DE: 2.79, AU: 3.99 };
  return {
    cost: defaults[shipToCountry] || 3.49,
    currency: 'USD',
    company: 'Tahmini Kargo (AliExpress Standard)',
    shipFrom: 'China',
    deliveryDate: null,
    tracking: true,
    estimated: true,
  };
}

async function getSmartMatch(productId, pageSize = 6) {
  try {
    const data = await callAliExpressApi('aliexpress.affiliate.product.smartmatch', {
      product_id: productId,
      page_no: 1,
      page_size: pageSize,
      target_currency: 'USD',
      target_language: 'EN',
      ship_to_country: 'US',
    });
    const result = data?.resp_result?.result || data?.result || {};
    const products = result.products?.product || [];
    return (Array.isArray(products) ? products : [products]).filter(Boolean).map(normalizeProduct);
  } catch {
    return [];
  }
}

module.exports = {
  searchProducts,
  getHotProducts,
  getProductDetail,
  getFreight,
  getSmartMatch,
  getAuthorizeUrl,
  exchangeCodeForToken,
  normalizeProduct,
  estimateFreight,
};
