require('dotenv').config();

const PORT = process.env.PORT || 3000;

function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return `http://localhost:${PORT}`;
}

const BASE_URL = resolveBaseUrl();

module.exports = {
  port: PORT,
  baseUrl: BASE_URL.replace(/\/$/, ''),
  aliexpress: {
    appKey: process.env.ALIEXPRESS_APP_KEY || '',
    appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
    redirectUri: process.env.ALIEXPRESS_REDIRECT_URI || `${BASE_URL.replace(/\/$/, '')}/api/aliexpress/callback`,
    apiUrl: 'https://api-sg.aliexpress.com/sync',
    oauthAuthorizeUrl: 'https://oauth.aliexpress.com/authorize',
    oauthTokenUrl: 'https://oauth.aliexpress.com/token',
  },
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID || '',
    clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
    sandbox: process.env.EBAY_SANDBOX === 'true',
  },
  jewelryPresets: [
    { id: 'steel-ring', label: 'Çelik Yüzük', keywords: 'stainless steel ring customizable', tr: 'paslanmaz çelik yüzük' },
    { id: 'steel-necklace', label: 'Çelik Kolye', keywords: 'stainless steel necklace personalized', tr: 'paslanmaz çelik kolye' },
    { id: 'steel-bracelet', label: 'Çelik Bileklik', keywords: 'stainless steel bracelet engraved', tr: 'paslanmaz çelik bileklik' },
    { id: 'steel-earring', label: 'Çelik Küpe', keywords: 'stainless steel earrings hypoallergenic', tr: 'paslanmaz çelik küpe' },
    { id: 'custom-jewelry', label: 'Özelleştirilebilir Takı', keywords: 'custom name necklace stainless steel', tr: 'isim kolye çelik özelleştirilebilir' },
    { id: 'couple-ring', label: 'Çift Yüzüğü', keywords: 'couple ring stainless steel engraved', tr: 'çift yüzüğü çelik' },
    { id: 'mens-chain', label: 'Erkek Çelik Zincir', keywords: 'mens stainless steel chain necklace', tr: 'erkek çelik zincir kolye' },
    { id: 'charm-bracelet', label: 'Charm Bileklik', keywords: 'stainless steel charm bracelet', tr: 'charm bileklik çelik' },
  ],
};
