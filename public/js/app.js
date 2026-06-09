const $ = (sel) => document.querySelector(sel);

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API hatası');
  return data;
}

function formatMoney(n, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);
}

function renderStatus(config, aliStatus) {
  const pills = [];
  pills.push(`<span class="pill ${config.aliexpressConfigured ? 'ok' : 'err'}">AliExpress ${config.aliexpressConfigured ? '✓' : '✗'}</span>`);
  pills.push(`<span class="pill ${config.ebayConfigured ? 'ok' : 'warn'}">eBay ${config.ebayConfigured ? '✓' : '?'}</span>`);
  if (aliStatus?.connected) {
    pills.push('<span class="pill ok">OAuth Bağlı</span>');
  }
  $('#statusPills').innerHTML = pills.join('');
  $('#callbackUrl').textContent = config.callbackUrl;
}

function renderPresets(presets) {
  $('#presetGrid').innerHTML = presets.map((p) =>
    `<button class="preset-chip" data-keywords="${p.keywords}" data-label="${p.label}">${p.label}</button>`
  ).join('');

  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      $('#searchInput').value = chip.dataset.keywords;
      runScan(chip.dataset.keywords, chip.dataset.label);
    });
  });
}

function renderProductCard(item) {
  if (item.error) {
    return `<div class="product-card"><div class="card-top"><div class="card-info"><div class="card-title">${item.aliexpress?.title || 'Hata'}</div><p style="color:var(--red);font-size:0.8rem">${item.error}</p></div></div></div>`;
  }

  const p = item.aliexpress;
  const rec = item.recommendation;
  const profit = item.profit;
  const ebay = item.ebay?.stats || {};

  return `
    <article class="product-card">
      <div class="card-top">
        ${p.imageUrl ? `<img class="card-img" src="${p.imageUrl}" alt="" loading="lazy">` : '<div class="card-img"></div>'}
        <div class="card-info">
          <div class="card-title">
            ${p.title}
            ${p.isCustomizable ? '<span class="custom-tag">Özelleştirilebilir</span>' : ''}
          </div>
          <div class="card-meta">
            <span>Ali: ${formatMoney(p.price)}</span>
            <span>${p.orders.toLocaleString()} sipariş</span>
            ${p.rating ? `<span>%${p.rating} puan</span>` : ''}
          </div>
          <span class="score-badge" style="background:${rec.color}22;color:${rec.color}">${rec.label} · ${item.score}/100</span>
        </div>
      </div>
      <div class="card-compare">
        <div class="compare-row"><span class="label">eBay ort. fiyat</span><span>${formatMoney(ebay.avgPrice)}</span></div>
        <div class="compare-row"><span class="label">eBay ilan sayısı</span><span>${ebay.count || 0}</span></div>
        <div class="compare-row"><span class="label">Tahmini kâr</span><span class="${profit.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatMoney(profit.netProfit)} (${profit.marginPercent}%)</span></div>
        <div class="compare-row"><span class="label">eBay + PayPal ücreti</span><span>${formatMoney(profit.totalFees)}</span></div>
      </div>
      <div class="card-links">
        ${p.productUrl ? `<a href="${p.productUrl}" target="_blank" rel="noopener">AliExpress</a>` : ''}
        <a href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.ebay?.searchQuery || p.title)}" target="_blank" rel="noopener">eBay Ara</a>
      </div>
    </article>
  `;
}

function showLoading(show) {
  $('#loading').classList.toggle('hidden', !show);
  $('#resultsGrid').style.opacity = show ? '0.4' : '1';
}

async function runScan(keywords, title) {
  showLoading(true);
  $('#resultsTitle').textContent = title || 'Sonuçlar';
  $('#resultsCount').textContent = '';

  try {
    const minOrders = $('#minOrders').value;
    const limit = $('#limitInput').value;
    const hot = $('#hotOnly').checked;

    const data = await api(`/api/compare/scan?keywords=${encodeURIComponent(keywords)}&limit=${limit}&minOrders=${minOrders}&hot=${hot}`);
    $('#resultsCount').textContent = `${data.count} ürün`;
    $('#resultsGrid').innerHTML = data.results.map(renderProductCard).join('') || '<p style="color:var(--muted)">Sonuç bulunamadı.</p>';
  } catch (err) {
    $('#resultsGrid').innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  } finally {
    showLoading(false);
  }
}

async function runScanAll() {
  showLoading(true);
  $('#resultsTitle').textContent = 'Tüm Kategoriler — En İyi Fırsatlar';
  $('#resultsCount').textContent = '';

  try {
    const minOrders = $('#minOrders').value;
    const limit = $('#limitInput').value;
    const hot = $('#hotOnly').checked;

    const data = await api(`/api/compare/scan-all?limit=${limit}&minOrders=${minOrders}&hot=${hot}`);
    $('#resultsCount').textContent = `${data.totalProducts} ürün · ${data.categories} kategori`;
    $('#resultsGrid').innerHTML = data.topOpportunities.map(renderProductCard).join('') || '<p style="color:var(--muted)">Sonuç bulunamadı.</p>';
  } catch (err) {
    $('#resultsGrid').innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  } finally {
    showLoading(false);
  }
}

async function calcProfit() {
  const selling = $('#sellPrice').value;
  const cost = $('#costPrice').value;
  if (!selling || !cost) return;

  try {
    const data = await api(`/api/compare/profit?selling=${selling}&cost=${cost}`);
    $('#calcResult').innerHTML = `
      Net kâr: <strong>${formatMoney(data.netProfit)}</strong> ·
      Marj: <strong>${data.marginPercent}%</strong> ·
      Ücretler: ${formatMoney(data.totalFees)}
    `;
  } catch (err) {
    $('#calcResult').textContent = err.message;
  }
}

async function init() {
  try {
    const [config, aliStatus] = await Promise.all([
      api('/api/config'),
      api('/api/aliexpress/status').catch(() => ({})),
    ]);
    renderStatus(config, aliStatus);
    renderPresets(config.presets);
  } catch (err) {
    console.error(err);
  }

  $('#searchBtn').addEventListener('click', () => {
    const q = $('#searchInput').value.trim();
    if (q) runScan(q);
  });

  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#searchBtn').click();
  });

  $('#scanAllBtn').addEventListener('click', runScanAll);
  $('#calcBtn').addEventListener('click', calcProfit);
}

init();
