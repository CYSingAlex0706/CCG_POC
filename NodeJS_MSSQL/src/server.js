'use strict';

const express = require('express');
const path = require('path');
const config = require('./config');
const store = require('./store');
const telemetry = require('./telemetry');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// ============ structured logging (compatible with the original) ============
function logLine(level, msg, ctx = {}) {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(), level, msg, ctx,
  }) + '\n');
}

// ============ request timing middleware ============
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - t0;
    const status = res.statusCode;
    const isApi = req.path.startsWith('/api/');
    telemetry.recordRequest(req, status, duration, {
      source: isApi ? 'api' : 'page',
      component: req.path.includes('db') ? 'mssql' : 'web',
      detail: isApi ? undefined : undefined,
    });
    if (isApi || status >= 400) {
      logLine(status >= 500 ? 'error' : 'info', 'http_request', {
        path: req.originalUrl, status, duration_ms: duration,
      });
    }
  });
  next();
});

// ============ helpers ============
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function fmtDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v == null ? '' : v).slice(0, 10);
}
function fmtDateTime(v) {
  if (v instanceof Date) return v.toISOString();
  return String(v == null ? '' : v);
}
function fmtPrice(v) {
  const n = Math.round(Number(v) || 0);
  return 'HK$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============ chaos controls (for APM demo) ============
const chaos = {
  db: false,
  latency: 0,       // ms of artificial delay
  http500: false,   // force 500 on data endpoints
};

app.get('/api/chaos', (req, res) => res.json({ ...chaos }));

app.post('/api/chaos/:key', (req, res) => {
  const { key } = req.params;
  if (!(key in chaos)) return res.status(400).json({ error: 'unknown chaos key' });
  if (key === 'latency') {
    const ms = parseInt(req.body && req.body.value, 10);
    chaos.latency = Number.isFinite(ms) ? Math.max(0, Math.min(10000, ms)) : 0;
  } else {
    const state = String((req.body && req.body.state) || '').toLowerCase();
    chaos[key] = state === 'on' || state === 'true' || state === '1';
  }
  logLine('info', 'chaos_toggled', { key, value: chaos[key] });
  res.json({ ...chaos });
});

// Backwards-compatible legacy route from the original project
app.post('/chaos/db/:state', (req, res) => {
  chaos.db = req.params.state === 'on';
  res.json({ chaosDb: chaos.db });
});

function applyChaos(req, res) {
  if (chaos.latency > 0) {
    // deliberately block the event loop briefly to simulate a slow dependency
    const until = Date.now() + chaos.latency;
    while (Date.now() < until) { /* busy wait, demo only */ }
  }
  if (chaos.http500) {
    const err = new Error('Injected HTTP 500 (chaos)');
    logLine('error', 'chaos_http500', { path: req.path });
    res.status(500).json({ error: err.message, chaos: true });
    return true;
  }
  return false;
}

async function failDbIfNeeded() {
  if (!chaos.db || config.app.env === 'prod') return;
  const sql = require('mssql');
  const badPool = new sql.ConnectionPool({
    server: '127.0.0.1', port: 1, database: 'nope', user: 'nope', password: 'nope',
    connectionTimeout: 800,
    options: { encrypt: false, trustServerCertificate: true },
  });
  try {
    await badPool.connect();
    await badPool.request().query('SELECT 1');
  } finally {
    try { await badPool.close(); } catch (_) {}
  }
}

// ============ API: properties ============
app.get('/api/properties', async (req, res) => {
  if (applyChaos(req, res)) return;
  try {
    res.json(await store.listProperties());
  } catch (e) {
    logLine('error', 'properties_failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  if (applyChaos(req, res)) return;
  const item = await store.getProperty(req.params.id);
  if (!item) return res.status(404).json({ error: 'Property not found' });
  res.json(item);
});

// ============ API: sale documents ============
app.get('/api/documents', async (req, res) => {
  if (applyChaos(req, res)) return;
  const t0 = Date.now();
  try {
    if (req.query.faildb !== undefined) chaos.db = true;
    await failDbIfNeeded();
    const docs = await store.listDocuments();
    logLine('info', 'db_query', { query: 'list_sale_documents', rows: docs.length, duration_ms: Date.now() - t0 });
    res.json(docs);
  } catch (e) {
    logLine('error', 'db_query_failed', { query: 'list_sale_documents', error: e.message });
    res.status(500).json({ error: 'Database error', detail: e.message });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  if (applyChaos(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ error: 'Missing or invalid id' });
  try {
    const doc = await store.getDocument(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (e) {
    logLine('error', 'db_query_failed', { query: 'get_sale_document', error: e.message });
    res.status(500).json({ error: 'Database error', detail: e.message });
  }
});

// ============ API: health (enhanced) ============
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  let dbCheck;
  try {
    await failDbIfNeeded();
    dbCheck = { up: true, ...(await store.pingDb()) };
  } catch (e) {
    dbCheck = { up: false, latency_ms: Date.now() - start, error: e.message };
  }
  const healthy = dbCheck.up && !chaos.http500;
  const payload = {
    status: healthy ? 'ok' : 'degraded',
    service: config.app.name,
    env: config.app.env,
    data_mode: config.data.mode,
    uptime_s: Math.round(process.uptime()),
    checks: {
      db: dbCheck,
      api: { up: !chaos.http500 },
    },
    chaos: { ...chaos },
  };
  if (!healthy) res.status(503);
  res.json(payload);
});

// ============ API: APM telemetry ============
app.get('/api/metrics', (req, res) => res.json(telemetry.summary()));
app.get('/api/errors', (req, res) => res.json(telemetry.summary().recent_errors));
app.get('/api/traces', (req, res) => res.json(telemetry.summary().recent_requests));

app.post('/api/rum', (req, res) => {
  const rec = telemetry.recordClientEvent(req.body || {});
  res.status(201).json({ ok: true, id: rec.trace_id });
});

// ============ legacy HTML routes (kept for compatibility) ============
app.get('/legacy', async (req, res) => {
  let docs = [];
  try { docs = await store.listDocuments(); } catch (_) {}
  const rowsHtml = docs.map(d => `<tr>
    <td><a href="/document/${esc(d.id)}">${esc(d.reference)}</a></td>
    <td>${esc(d.property_address)}</td><td>${esc(d.city)}</td>
    <td>${esc(d.property_type)}</td><td>${fmtPrice(d.price)}</td>
    <td>${esc(fmtDate(d.sale_date))}</td><td>${esc(d.status)}</td>
    <td>${esc(d.document_type)}</td></tr>`).join('');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<script async src="https://static.guance.com/browser-sdk/v3/dataflux-rum.js"></script>
<script defer src="/js/guance-rum.js"></script>
  <title>Properties — Sale documents (legacy)</title><style>
  body{font-family:system-ui,sans-serif;margin:2rem;background:#f7f7f9}
  table{border-collapse:collapse;width:100%;background:#fff}
  th,td{padding:.55rem .75rem;border-bottom:1px solid #e5e5ea;text-align:left;font-size:.9rem}
  th{background:#f0f0f4}a{color:#1565c0}
  </style></head><body><h1>Sale documents (legacy view)</h1>
  <p><a href="/sales.html">← New view</a></p>
  <table><thead><tr><th>Reference</th><th>Property</th><th>City</th><th>Type</th>
  <th>Price</th><th>Sale date</th><th>Status</th><th>Document</th></tr></thead>
  <tbody>${rowsHtml}</tbody></table></body></html>`);
});

app.get('/document/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const doc = !isNaN(id) ? await store.getDocument(id) : null;
  if (!doc) return res.status(404).send('Document not found');
  res.redirect(302, `/document.html?id=${doc.id}`);
});

app.get('/health', (req, res) => res.redirect(302, '/api/health'));

// ============ static frontend ============
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: 'index.html',
  etag: false,
}));

// ============ boot ============
const server = app.listen(config.app.port, () => {
  logLine('info', 'server_started', {
    port: config.app.port,
    env: config.app.env,
    data_mode: config.data.mode,
  });
  console.log(`\n  CCG Property Sales — APM Demo`);
  console.log(`  APM Dashboard : http://localhost:${config.app.port}/`);
  console.log(`  Sales Portal  : http://localhost:${config.app.port}/sales.html`);
  console.log(`  Data mode     : ${config.data.mode}\n`);
});

process.on('SIGTERM', () => {
  logLine('info', 'shutting_down', {});
  server.close(async () => { await store.shutdown(); process.exit(0); });
});
