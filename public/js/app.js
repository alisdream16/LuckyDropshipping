const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const VIEWS = {
  dashboard: { title: 'Dashboard', subtitle: 'Çelik takı satış metrikleri ve fırsat analizi' },
  scanner: { title: 'Akıllı Filtre', subtitle: 'Satış, marj, kargo ve bölge eşleştirmesi' },
  calculator: { title: 'Marj Hesaplayıcı', subtitle: 'Net kâr ve ücret hesabı' },
};

const TOP_US_STATES = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA'];
let selectedStates = new Set();
let cachedTop10 = [];

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
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

function renderStateChips() {
  $('#stateChips').innerHTML = TOP_US_STATES.map((code) =>
    `<button type="button" class="state-chip ${selectedStates.has(code) ? 'active' : ''}" data-code="${code}">${code}</button>`
  ).join('');

  $$('.state-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const code = chip.dataset.code;
      if (selectedStates.has(code)) selectedStates.delete(code);
      else selectedStates.add(code);
      chip.classList.toggle('active');
    });
  });
}

function getFilterParams() {
  const params = new URLSearchParams();
  const q = $('#searchInput').value.trim() || 'stainless steel jewelry';
  params.set('keywords', q);
  params.set('minOrders', $('#minOrders').value || '0');
  params.set('limit', $('#limitInput').value || '10');
  params.set('hotOnly', $('#hotOnly').checked);
  params.set('customizableOnly', $('#customizableOnly').checked);
  params.set('shipToCountry', $('#shipToCountry').value);

  ['maxOrders', 'minDailySales', 'maxDailySales', 'minPrice', 'maxPrice',
    'minRating', 'minMargin', 'maxShipping', 'maxDeliveryDays'].forEach((id) => {
    const val = $(`#${id}`)?.value;
    if (val) params.set(id, val);
  });

  if (selectedStates.size) params.set('usStates', [...selectedStates].join(','));
  return params;
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
  cachedTop10 = products || [];
  const tbody = $('#top10Body');
  if (!products?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Ürün bulunamadı</td></tr>';
    return;
  }

  tbody.innerHTML = products.map((p) => `
    <tr class="clickable" data-id="${p.id}">
      <td><span class="rank-badge ${rankClass(p.rank)}">${p.rank}</span></td>
      <td>
        <div class="product-cell">
          ${p.imageUrl ? `<img class="product-thumb" src="${p.imageUrl}" alt="">` : '<div class="product-thumb"></div>'}
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

  $$('#top10Body tr.clickable').forEach((row) => {
    row.addEventListener('click', () => openProductDetail(row.dataset.id));
  });
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
      <div class="chart-bar" style="height:${Math.max(8, (t.value / max) * 160)}px"></div>
      <span class="chart-bar-label">${t.label}</span>
    </div>
  `).join('');
  legend.textContent = `Top 10 toplam günlük tahmini: ${formatNumber(trend.reduce((s, t) => s + t.value, 0))} adet`;
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
    showToast(`${data.top10.length} ürün çekildi`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function renderIntelCard(intel) {
  const p = intel.product;
  const regions = intel.regions?.topStates?.slice(0, 3) || [];

  return `
    <article class="intel-card" data-id="${p.id}">
      <div class="intel-card-top">
        ${p.imageUrl ? `<img class="card-img" src="${p.imageUrl}" alt="">` : '<div class="card-img"></div>'}
        <div class="card-info">
          <div class="card-title">${p.title}${p.isCustomizable ? '<span class="custom-tag">Özel</span>' : ''}</div>
          <div class="card-meta">
            <span>${formatMoney(p.price)}</span>
            <span style="color:var(--emerald)">${formatNumber(intel.sales.dailyEstimate)}/gün</span>
            <span>Marj %${intel.profit.marginPercent}</span>
          </div>
          <span class="match-badge">Eşleşme %${intel.filterMatch?.score || 100}</span>
          <div class="region-mini">
            ${regions.map((r) => `<span class="region-tag">${r.code} ~${r.estimatedDaily}/gün</span>`).join('')}
          </div>
        </div>
      </div>
      <ul class="intel-insights">
        ${(intel.insight || []).slice(0, 3).map((line) => `<li>${line}</li>`).join('')}
      </ul>
    </article>
  `;
}

function renderModalContent(intel) {
  const p = intel.product;
  const maxRegion = Math.max(...(intel.regions?.topStates?.map((r) => r.estimatedDaily) || [1]));

  return `
    <div class="disclaimer">${intel.regions?.disclaimer || ''}</div>
    <div class="modal-hero">
      ${p.imageUrl ? `<img class="modal-img" src="${p.imageUrl}" alt="">` : '<div class="modal-img"></div>'}
      <div>
        <div class="modal-title">${p.title}</div>
        <div class="card-meta">
          <span>${formatMoney(p.price)}</span>
          <span>${formatNumber(p.orders)} sipariş</span>
          ${p.rating ? `<span>%${p.rating} puan</span>` : ''}
        </div>
        <span class="score-badge" style="background:${intel.sales.velocity.color}22;color:${intel.sales.velocity.color};margin-top:0.5rem;display:inline-block">
          ${intel.sales.velocity.label} Satış Hızı
        </span>
      </div>
    </div>

    <div class="modal-stats">
      <div class="modal-stat"><span class="val">${formatNumber(intel.sales.dailyEstimate)}</span><span class="lbl">Günlük Satış (Tahmini)</span></div>
      <div class="modal-stat"><span class="val">%${intel.profit.marginPercent}</span><span class="lbl">Kar Marjı</span></div>
      <div class="modal-stat"><span class="val">${formatMoney(intel.shipping.cost)}</span><span class="lbl">ABD Kargo</span></div>
      <div class="modal-stat"><span class="val">${formatMoney(intel.profit.netProfit)}</span><span class="lbl">Net Kâr</span></div>
      <div class="modal-stat"><span class="val">${intel.shipping.estimatedDays} gün</span><span class="lbl">Teslimat</span></div>
      <div class="modal-stat"><span class="val">${intel.regions?.primaryMarket?.code || '—'}</span><span class="lbl">Ana Pazar</span></div>
    </div>

    <div class="modal-section">
      <h4>Özet Analiz</h4>
      <ul class="insight-list">
        ${(intel.insight || []).map((line) => `<li>${line}</li>`).join('')}
      </ul>
    </div>

    <div class="modal-section">
      <h4>ABD Eyalet Dağılımı (Tahmini)</h4>
      <div class="region-bars">
        ${(intel.regions?.topStates || []).slice(0, 8).map((r) => `
          <div class="region-bar-row">
            <span class="region-bar-label">${r.name}</span>
            <div class="region-bar-track"><div class="region-bar-fill" style="width:${(r.estimatedDaily / maxRegion) * 100}%"></div></div>
            <span class="region-bar-val">${r.estimatedDaily}/gün</span>
          </div>
        `).join('')}
      </div>
    </div>

    ${intel.boughtTogether?.length ? `
    <div class="modal-section">
      <h4>Bunu Alanlar Bunu Da Aldı</h4>
      <div class="bought-together">
        ${intel.boughtTogether.map((b) => `
          <div class="bought-item" data-id="${b.id}">
            ${b.imageUrl ? `<img src="${b.imageUrl}" alt="">` : ''}
            <div>${b.title?.slice(0, 40)}...</div>
            <div style="color:var(--amber);margin-top:0.2rem">${formatMoney(b.price)}</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${intel.filterMatch?.checks?.length ? `
    <div class="modal-section">
      <h4>Filtre Eşleşme Detayı</h4>
      <div class="filter-checks">
        ${intel.filterMatch.checks.map((c) =>
          `<span class="filter-check ${c.pass ? 'pass' : 'fail'}">${c.field}: ${c.actual}</span>`
        ).join('')}
      </div>
    </div>` : ''}

    <div style="display:flex;gap:0.5rem;margin-top:1rem">
      ${p.productUrl ? `<a href="${p.productUrl}" target="_blank" class="btn-primary" style="text-decoration:none;flex:1;text-align:center">AliExpress</a>` : ''}
      <a href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(intel.ebay?.searchQuery || p.title)}" target="_blank" class="btn-connect" style="flex:1">eBay Ara</a>
    </div>
  `;
}

async function openProductDetail(productId) {
  const modal = $('#productModal');
  const body = $('#modalBody');
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analiz ediliyor...</p></div>';

  try {
    const intel = await api(`/api/products/analyze/${productId}?shipToCountry=${$('#shipToCountry')?.value || 'US'}`);
    body.innerHTML = renderModalContent(intel);

    $$('.bought-item').forEach((item) => {
      item.addEventListener('click', () => openProductDetail(item.dataset.id));
    });
  } catch (err) {
    body.innerHTML = `<p style="color:var(--rose)">${err.message}</p>`;
  }
}

function closeModal() {
  $('#productModal').classList.add('hidden');
}

function showLoading(show) {
  $('#loading').classList.toggle('hidden', !show);
}

async function runSmartFilter() {
  switchView('scanner');
  showLoading(true);
  $('#resultsTitle').textContent = 'Filtrelenmiş Sonuçlar';
  $('#resultsCount').textContent = '';

  try {
    const params = getFilterParams();
    const data = await api(`/api/products/scan?${params}`);
    $('#resultsCount').textContent = `${data.matched} eşleşme / ${data.scanned} taranan`;
    $('#resultsGrid').innerHTML = data.products.length
      ? data.products.map(renderIntelCard).join('')
      : '<p style="color:var(--text-dim);padding:2rem">Filtrelere uyan ürün bulunamadı. Kriterleri gevşetin.</p>';

    $$('.intel-card').forEach((card) => {
      card.addEventListener('click', () => openProductDetail(card.dataset.id));
    });

    showToast(`${data.matched} ürün eşleşti`);
  } catch (err) {
    $('#resultsGrid').innerHTML = `<p style="color:var(--rose)">${err.message}</p>`;
    showToast(err.message, 'error');
  } finally {
    showLoading(false);
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
      runSmartFilter();
    });
  });
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
  renderStateChips();

  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  $('#fetchBtn').addEventListener('click', fetchDashboard);
  $('#smartFilterBtn').addEventListener('click', runSmartFilter);
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSmartFilter();
  });
  $('#calcBtn').addEventListener('click', calcProfit);
  $('#modalClose').addEventListener('click', closeModal);
  $('#productModal').addEventListener('click', (e) => {
    if (e.target.id === 'productModal') closeModal();
  });

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
