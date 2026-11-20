(function () {
  'use strict';
  const { apiFetch, renderHealthInto, clockInto, events: clientEvents } = window.RUM;

  renderHealthInto(document.getElementById('healthText'));
  clockInto(document.getElementById('clock'));
  setInterval(() => renderHealthInto(document.getElementById('healthText')), 5000);

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function timeOf(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-HK', { hour12: false });
  }

  // ---------- traffic chart (SVG, no external library) ----------
  function drawChart(timeline) {
    const svg = $('trafficChart');
    const W = 760, H = 210, padL = 34, padR = 44, padT = 12, padB = 22;
    const data = timeline.length ? timeline : Array.from({ length: 30 }, () => ({ requests: 0, errors: 0, avg_ms: 0 }));
    const maxReq = Math.max(1, ...data.map(d => d.requests));
    const maxMs = Math.max(1, ...data.map(d => d.avg_ms));
    const iw = W - padL - padR, ih = H - padT - padB;
    const x = i => padL + (i / Math.max(1, data.length - 1)) * iw;
    const yReq = v => padT + ih - (v / maxReq) * ih;
    const yMs = v => padT + ih - (v / maxMs) * ih;

    let parts = '';
    // grid
    for (let i = 0; i <= 4; i++) {
      const gy = padT + (ih / 4) * i;
      parts += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#edf1ef" stroke-width="1"/>`;
      parts += `<text x="${padL - 7}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#96a49e">${Math.round(maxReq * (1 - i / 4))}</text>`;
      parts += `<text x="${W - padR + 7}" y="${gy + 4}" font-size="10" fill="#89c6cc">${Math.round(maxMs * (1 - i / 4))}</text>`;
    }
    // request area + line
    const pts = data.map((d, i) => `${x(i)},${yReq(d.requests)}`).join(' ');
    parts += `<polygon points="${padL},${padT + ih} ${pts} ${x(data.length - 1)},${padT + ih}" fill="#135a4b" opacity="0.09"/>`;
    parts += `<polyline points="${pts}" fill="none" stroke="#135a4b" stroke-width="1.8"/>`;
    // latency line
    parts += `<polyline points="${data.map((d, i) => `${x(i)},${yMs(d.avg_ms)}`).join(' ')}" fill="none" stroke="#89c6cc" stroke-width="1.6"/>`;
    // errors as bars
    data.forEach((d, i) => {
      if (d.errors > 0) {
        const bw = Math.max(2, iw / data.length - 3);
        parts += `<rect x="${x(i) - bw / 2}" y="${yReq(d.errors)}" width="${bw}" height="${padT + ih - yReq(d.errors)}" fill="#c0392b" opacity="0.75"/>`;
      }
    });
    parts += `<text x="${padL}" y="${H - 5}" font-size="10" fill="#96a49e">60 秒前</text>`;
    parts += `<text x="${W - padR}" y="${H - 5}" text-anchor="end" font-size="10" fill="#96a49e">現在</text>`;
    svg.innerHTML = parts;
  }

  // ---------- feeds ----------
  function renderServerFeed(reqs) {
    const el = $('serverFeed');
    if (!reqs.length) { el.innerHTML = '<div class="empty">尚無請求 · 瀏覽一下銷售頁</div>'; return; }
    el.innerHTML = reqs.map(r => `
      <div class="feed-item">
        <span class="feed-time">${timeOf(r.ts)}</span>
        <span><div class="feed-path">${esc(r.method)} ${esc(r.path)}</div>
        <div class="feed-detail">${esc(r.component)} · ${r.duration_ms}ms · trace ${esc(String(r.trace_id).slice(0, 12))}</div></span>
        <span class="feed-status ${r.status >= 400 ? 'bad' : 'ok'}">${r.status}</span>
      </div>`).join('');
  }

  function renderErrorFeed(errs) {
    const el = $('errorFeed');
    $('errCount').textContent = errs.length + ' 筆';
    if (!errs.length) { el.innerHTML = '<div class="empty">尚無錯誤 · 系統運作正常</div>'; return; }
    el.innerHTML = errs.map(e => `
      <div class="feed-item">
        <span class="feed-time">${timeOf(e.ts)}</span>
        <span><div class="feed-path">${esc(e.msg)}</div>
        <div class="feed-detail">${esc(e.path)} · ${esc(e.component)}</div></span>
        <span class="feed-status ${e.level === 'error' ? 'bad' : ''}">${e.status || '!'}</span>
      </div>`).join('');
  }

  function renderClientFeed() {
    const el = $('clientFeed');
    const evs = clientEvents.slice().reverse();
    const beaconed = window.__remoteClientEvents || [];
    const all = evs.concat(beaconed).slice(0, 20);
    if (!all.length) { el.innerHTML = '<div class="empty">本頁面尚未發出請求</div>'; return; }
    el.innerHTML = all.map(e => `
      <div class="feed-item">
        <span class="feed-time">${new Date(e.ts).toLocaleTimeString('zh-HK', { hour12: false })}</span>
        <span><div class="feed-path">${esc(e.path)}</div>
        <div class="feed-detail">${e.ok ? '成功' : '失敗'} · ${e.duration_ms}ms${e.detail ? ' · ' + esc(e.detail) : ''}</div></span>
        <span class="feed-status ${e.ok ? 'ok' : 'bad'}">${e.status || 'ERR'}</span>
      </div>`).join('');
  }

  // ---------- chaos console ----------
  function loadChaos() {
    apiFetch('/api/chaos').then(r => r.json()).then(c => {
      $('swDb').classList.toggle('on', !!c.db);
      $('sw500').classList.toggle('on', !!c.http500);
      if (c.latency) $('latencyMs').value = c.latency;
    }).catch(() => {});
  }
  function toggle(key, state) {
    apiFetch('/api/chaos/' + key, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: state ? 'on' : 'off' }),
    }).then(refresh).catch(() => {});
  }
  $('swDb').addEventListener('click', function () {
    const next = !this.classList.contains('on');
    this.classList.toggle('on', next);
    toggle('db', next);
  });
  $('sw500').addEventListener('click', function () {
    const next = !this.classList.contains('on');
    this.classList.toggle('on', next);
    toggle('http500', next);
  });
  $('btnLatency').addEventListener('click', () => {
    const ms = Math.max(0, Math.min(10000, parseInt($('latencyMs').value, 10) || 0));
    apiFetch('/api/chaos/latency', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: ms }),
    }).then(refresh).catch(() => {});
  });
  $('btnReset').addEventListener('click', () => {
    Promise.all(['db', 'http500'].map(k => apiFetch('/api/chaos/' + k, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'off' }),
    }))).concat([apiFetch('/api/chaos/latency', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 0 }),
    })]).then(() => { $('latencyMs').value = 0; loadChaos(); refresh(); }).catch(() => {});
  });

  // ---------- main refresh ----------
  async function refresh() {
    try {
      const res = await apiFetch('/api/metrics');
      const m = await res.json();
      const t = m.totals;
      $('rpsNum').textContent = t.rps_1m.toFixed(1);
      $('errorNum').textContent = t.errors;
      $('mAvail').textContent = (100 - t.error_rate_pct).toFixed(1) + '%';
      $('mErr').innerHTML = t.error_rate_pct.toFixed(1) + '<span class="kpi-unit">%</span>';
      $('mP95').innerHTML = t.p95_ms + '<span class="kpi-unit">ms</span>';
      $('fP95').textContent = '平均 ' + t.avg_latency_ms + 'ms · P99 ' + t.p99_ms + 'ms';
      $('fErr').textContent = t.errors + ' / ' + t.requests + ' 筆請求';
      $('fAvail').textContent = t.errors ? t.errors + ' 筆失敗請求' : '所有請求成功';
      $('kpiErr').className = 'kpi ' + (t.error_rate_pct > 10 ? 'bad' : t.error_rate_pct > 0 ? 'warn' : 'ok');
      $('kpiP95').className = 'kpi ' + (t.p95_ms > 1500 ? 'bad' : t.p95_ms > 500 ? 'warn' : 'ok');

      try {
        const hres = await apiFetch('/api/health');
        const h = await hres.json();
        const db = h.checks.db;
        $('mDb').textContent = db.up ? (db.mode === 'memory' ? '記憶體演示' : '連線正常') : '離線';
        $('fDb').textContent = db.up ? (db.mode === 'memory' ? 'Demo 模式 · 無需 MSSQL' : db.latency_ms + 'ms · ' + h.data_mode) : (db.error || '連線失敗');
        $('kpiDb').className = 'kpi ' + (db.up ? 'ok' : 'bad');
        $('envChip').textContent = (h.data_mode || 'demo').toUpperCase();
      } catch (_) {
        $('mDb').textContent = '離線';
        $('fDb').textContent = 'Health API 無法連線';
        $('kpiDb').className = 'kpi bad';
      }

      drawChart(m.timeline);
      $('endpointRows').innerHTML = m.endpoints.length ? m.endpoints.map(e => `
        <tr><td class="mono">${esc(e.endpoint)}</td><td class="num">${e.count}</td>
        <td class="num">${e.avg_ms}ms</td>
        <td class="num"><span class="badge ${e.error_rate_pct > 0 ? 'bad' : 'ok'}">${e.error_rate_pct}%</span></td></tr>`).join('')
        : '<tr><td colspan="4" class="empty">尚無資料</td></tr>';

      renderServerFeed(m.recent_requests);
      renderErrorFeed(m.recent_errors);
    } catch (_) {
      $('healthText').textContent = 'APM API 無法連線';
      $('statusDot').classList.add('bad');
    }
    renderClientFeed();
  }

  window.addEventListener('rum:event', renderClientFeed);
  loadChaos();
  refresh();
  setInterval(refresh, 2000);
})();
