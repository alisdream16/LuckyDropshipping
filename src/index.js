const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const aliexpressRoutes = require('./routes/aliexpress');
const ebayRoutes = require('./routes/ebay');
const compareRoutes = require('./routes/compare');
const dashboardRoutes = require('./routes/dashboard');
const productsRoutes = require('./routes/products');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'LuckyDropshipping',
    callbackUrl: `${config.baseUrl}/api/aliexpress/callback`,
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    callbackUrl: `${config.baseUrl}/api/aliexpress/callback`,
    presets: config.jewelryPresets,
    aliexpressConfigured: !!config.aliexpress.appKey,
    ebayConfigured: !!config.ebay.clientId,
  });
});

app.use('/api/aliexpress', aliexpressRoutes);
app.use('/api/ebay', ebayRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(config.port, () => {
  console.log(`LuckyDropshipping çalışıyor: ${config.baseUrl}`);
  console.log(`AliExpress Callback URL: ${config.baseUrl}/api/aliexpress/callback`);
});
