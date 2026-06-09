const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const VIEWS = {
  dashboard: { title: 'Dashboard', subtitle: 'Çelik takı satış metrikleri ve fırsat analizi' },
  scanner: { title: 'Ürün Tarayıcı', subtitle: 'AliExpress ürünlerini eBay ile karşılaştır' },
  calculator: { title: 'Marj Hesaplayıcı', subtitle: 'Net kâr ve ücret hesabı' },
};

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API hatası');
  return data;
}

function formatMoney(n, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);
}

function formatNumber(n) {
  return (n || 0).toLocaleString('tr-TR');
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function showToast(msg, type = 'success') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3500);
  setTimeout(() => { toast.className = 'toast hidden'; }, 4000);
}

function switchView(viewId) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
  $(`#view-${viewId}`)?.classList.add('active');
  $(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
  const meta = VIEWS[viewId];
  if (meta) {
    $('#pageTitle').textContent = meta.title;
    $('#pageSubtitle').textContent = meta.subtitle;
  }
}

function renderConnection(config, aliStatus) {
  $('#aliDot').className = `dot ${config.aliexpressConfigured ? (aliStatus?.connected ? 'ok' : 'warn') : 'err'}`;
  $('#ebayDot').className = `dot ${config.ebayConfigured ? 'ok' : 'warn'}`;
}

function renderMetrics(data) {
  $('#metricDaily').textContent = formatNumber(data.totalDailySales);
  $('#metricOrders').textContent = formatNumber(data.totalOrders);
  $('#metricPrice').textContent = formatMoney(data.avgPrice);
  $('#metricRating').textContent = data.avgRating ? `%${data.avgRating}` : '—';
  $('#metricCustom').textContent = `${data.customizableCount || 0} özelleştirilebilir`;
  $('#lastUpdate').textContent = `Güncellendi: ${formatTime(data.updatedAt)}`;
}

function rankClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-n';
}

function renderTop10(products) {
  const tbody = $('#top10Body');
  if (!products?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Ürün bulunamadı</td></tr>';
    return;
  }

  tbody.innerHTML = products.map((p) => `
    <tr>
      <td><span class="rank-badge ${rankClass(p.rank)}">${p.rank}</span></td>
      <td>
        <div class="product-cell">
          ${p.imageUrl ? `<img class="product-thumb" src="${p.imageUrl}" alt="" loading="lazy">` : '<div class="product-thumb"></div>'}
          <div>
            <div class="product-name">${p.title}</div>
            ${p.isCustomizable ? '<span class="custom-pill">Özelleştirilebilir</span>' : ''}
          </div>
        </div>
      </td>
      <td class="price-cell">${formatMoney(p.price)}</td>
      <td class="orders-cell">${formatNumber(p.orders)}</td>
      <td><span class="daily-badge">${formatNumber(p.dailySalesEstimate)}/gün</span></td>
      <td>${p.rating ? `%${p.rating}` : '—'}</td>
    </tr>
  `).join('');
}

function renderChart(trend) {
  const chart = $('#salesChart');
  const legend = $('#chartLegend');
  if (!trend?.length) {
    chart.innerHTML = '<p style="color:var(--text-dim);text-align:center;width:100%">Veri yok</p>';
    legend.textContent = '';
    return;
  }

  const max = Math.max(...trend.map((t) => t.value), 1);

  chart.innerHTML = trend.map((t) => `
    <div class="chart-bar-col">
      <span class="chart-bar-value">${t.value}</span>
      <div class="chart-bar" style="height:${Math.max(8, (t.value / max) * 160)}px" title="${t.orders} sipariş"></div>
      <span class="chart-bar-label">${t.label}</span>
    </div>
  `).join('');

  const total = trend.reduce((s, t) => s + t.value, 0);
  legend.textContent = `Top 10 toplam günlük tahmini: ${formatNumber(total)} adet`;
}

async function fetchDashboard() {
  const btn = $('#fetchBtn');
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    const data = await api('/api/dashboard/metrics');
    renderMetrics(data);
    renderTop10(data.top10);
    renderChart(data.salesTrend);
    showToast(`${data.top10.length} ürün başarıyla çekildi`);
  } catch (err) {
    showToast(err.message, 'error');
    $('#top10Body').innerHTML = `<tr><td colspan="6" class="empty-row" style="color:var(--rose)">${err.message}</td></tr>`;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function renderPresets(presets) {
  $('#presetGrid').innerHTML = presets.map((p) =>
    `<button class="preset-chip" data-keywords="${p.keywords}" data-label="${p.label}">${p.label}</button>`
  ).join('');

  $$('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      $('#searchInput').value = chip.dataset.keywords;
      switchView('scanner');
      runScan(chip.dataset.keywords, chip.dataset.label);
    });
  });
}

function renderProductCard(item) {
  if (item.error) {
    return `<div class="product-card"><div class="card-top"><div class="card-info"><div class="card-title">${item.aliexpress?.title || 'Hata'}</div><p style="color:var(--rose);font-size:0.8rem">${item.error}</p></div></div></div>`;
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
          <div class="card-title">${p.title}${p.isCustomizable ? '<span class="custom-tag">Özel</span>' : ''}</div>
          <div class="card-meta">
            <span>${formatMoney(p.price)}</span>
            <span>${formatNumber(p.orders)} sipariş</span>
            ${p.rating ? `<span>%${p.rating}</span>` : ''}
          </div>
          <span class="score-badge" style="background:${rec.color}22;color:${rec.color}">${rec.label} · ${item.score}/100</span>
        </div>
      </div>
      <div class="card-compare">
        <div class="compare-row"><span class="label">eBay ort.</span><span>${formatMoney(ebay.avgPrice)}</span></div>
        <div class="compare-row"><span class="label">Tahmini kâr</span><span class="${profit.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatMoney(profit.netProfit)} (${profit.marginPercent}%)</span></div>
      </div>
      <div class="card-links">
        ${p.productUrl ? `<a href="${p.productUrl}" target="_blank" rel="noopener">AliExpress</a>` : ''}
        <a href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.ebay?.searchQuery || p.title)}" target="_blank" rel="noopener">eBay</a>
      </div>
    </article>
  `;
}

function showLoading(show) {
  $('#loading').classList.toggle('hidden', !show);
}

async function runScan(keywords, title) {
  showLoading(true);
  $('#resultsTitle').textContent = title || 'Sonuçlar';
  $('#resultsCount').textContent = '';

  try {
    const data = await api(`/api/compare/scan?keywords=${encodeURIComponent(keywords)}&limit=${$('#limitInput').value}&minOrders=${$('#minOrders').value}&hot=${$('#hotOnly').checked}`);
    $('#resultsCount').textContent = `${data.count} ürün`;
    $('#resultsGrid').innerHTML = data.results.map(renderProductCard).join('') || '<p style="color:var(--text-dim)">Sonuç bulunamadı.</p>';
  } catch (err) {
    $('#resultsGrid').innerHTML = `<p style="color:var(--rose)">${err.message}</p>`;
  } finally {
    showLoading(false);
  }
}

async function runScanAll() {
  switchView('scanner');
  showLoading(true);
  $('#resultsTitle').textContent = 'Tüm Kategoriler';
  $('#resultsCount').textContent = '';

  try {
    const data = await api(`/api/compare/scan-all?limit=${$('#limitInput').value}&minOrders=${$('#minOrders').value}&hot=${$('#hotOnly').checked}`);
    $('#resultsCount').textContent = `${data.totalProducts} ürün · ${data.categories} kategori`;
    $('#resultsGrid').innerHTML = data.topOpportunities.map(renderProductCard).join('') || '<p style="color:var(--text-dim)">Sonuç bulunamadı.</p>';
  } catch (err) {
    $('#resultsGrid').innerHTML = `<p style="color:var(--rose)">${err.message}</p>`;
  } finally {
    showLoading(false);
  }
}

async function calcProfit() {
  const selling = $('#sellPrice').value;
  const cost = $('#costPrice').value;
  if (!selling || !cost) return showToast('Fiyatları girin', 'error');

  try {
    const data = await api(`/api/compare/profit?selling=${selling}&cost=${cost}`);
    $('#calcResult').innerHTML = `
      <div style="display:grid;gap:0.5rem">
        <div>Net Kâr: <strong>${formatMoney(data.netProfit)}</strong></div>
        <div>Marj: <strong>${data.marginPercent}%</strong></div>
        <div style="color:var(--text-dim)">eBay + PayPal: ${formatMoney(data.totalFees)}</div>
      </div>
    `;
  } catch (err) {
    $('#calcResult').textContent = err.message;
  }
}

async function init() {
  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  $('#fetchBtn').addEventListener('click', fetchDashboard);
  $('#searchBtn').addEventListener('click', () => {
    const q = $('#searchInput').value.trim();
    if (q) { switchView('scanner'); runScan(q); }
  });
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#searchBtn').click();
  });
  $('#scanAllBtn').addEventListener('click', runScanAll);
  $('#calcBtn').addEventListener('click', calcProfit);

  try {
    const [config, aliStatus] = await Promise.all([
      api('/api/config'),
      api('/api/aliexpress/status').catch(() => ({})),
    ]);
    renderConnection(config, aliStatus);
    renderPresets(config.presets);
  } catch (err) {
    console.error(err);
  }
}

init();
