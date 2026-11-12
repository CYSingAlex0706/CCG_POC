'use strict';

const express = require('express');
const sql = require('mssql');
const { logLine, db, config, shutdown } = require('./lib');

const app = express();

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
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}

// ============ chaos toggle ============

let chaosDb = false;

app.post('/chaos/db/:state', (req, res) => {
  chaosDb = req.params.state === 'on';
  logLine('info', 'chaos_toggled', { chaosDb });
  res.json({ chaosDb });
});

// ============ GET / — list ============

app.get('/', async (req, res) => {
  const t0 = Date.now();

  const failDb = (req.query.faildb !== undefined || chaosDb) && config.app.env !== 'prod';

  let docs = null;
  const dbStart = Date.now();
  try {
    // [DEMO] real connection failure: port 1 => ECONNREFUSED
    if (failDb) {
      const badPool = new sql.ConnectionPool({
        server: '127.0.0.1',
        port: 1,
        database: 'nope',
        user: 'nope',
        password: 'nope',
        connectionTimeout: 1000,
        options: { encrypt: false, trustServerCertificate: true },
      });
      try {
        await badPool.connect();
        await badPool.request().query('SELECT 1');
      } finally {
        try { await badPool.close(); } catch (_) {}
      }
    }

    const p = await db();
    const result = await p.request().query(`
      SELECT id, reference, property_address, city, property_type, price,
             sale_date, status, document_type, updated_at
        FROM sale_documents
    ORDER BY sale_date DESC
    `);
    docs = result.recordset;
  } catch (e) {
    logLine('error', 'db_query_failed', { query: 'list_sale_documents', error: e.message });
    res.status(500).send('Database error');
    return;
  }

  logLine('info', 'db_query', {
    query: 'list_sale_documents',
    rows: docs.length,
    duration_ms: Date.now() - dbStart,
  });

  const elapsed = Date.now() - t0;
  logLine('info', 'http_request', {
    path: '/', status: 200, rows: docs.length, duration_ms: elapsed,
  });

  const rowsHtml = docs.map(d => `
    <tr>
      <td><a href="/document/${esc(d.id)}">${esc(d.reference)}</a></td>
      <td>${esc(d.property_address)}</td>
      <td>${esc(d.city)}</td>
      <td>${esc(d.property_type)}</td>
      <td>${fmtPrice(d.price)}</td>
      <td>${esc(fmtDate(d.sale_date))}</td>
      <td><span class="badge ${esc(d.status)}">${esc(d.status)}</span></td>
      <td>${esc(d.document_type)}</td>
    </tr>`).join('');

  res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Properties — Sale documents</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#f7f7f9}
h1{margin-bottom:.25rem}
.meta{color:#666;font-size:.85rem;margin-bottom:1.5rem}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{padding:.55rem .75rem;border-bottom:1px solid #e5e5ea;text-align:left;font-size:.9rem}
th{background:#f0f0f4}
tr:hover td{background:#fafafc}
.badge{padding:.15rem .5rem;border-radius:999px;font-size:.75rem;color:#fff}
.completed{background:#2e7d32}.signed{background:#1565c0}
.pending{background:#ef6c00}.draft{background:#757575}
.cancelled{background:#c62828}
a{color:#1565c0;text-decoration:none}
</style></head><body>
<h1>Sale documents</h1>
<p class="meta">
  ${docs.length} documents ·
  render: ${elapsed} ms ·
  <a href="/?faildb=1">simulate DB failure</a>
</p>
<table><thead><tr>
<th>Reference</th><th>Property</th><th>City</th><th>Type</th>
<th>Price</th><th>Sale date</th><th>Status</th><th>Document</th>
</tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`);
});

// ============ GET /document/:id — detail ============

app.get('/document/:id', async (req, res) => {
  const t0 = Date.now();
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) {
    res.status(400).send('Missing or invalid id');
    return;
  }

  let doc = null;
  const dbStart = Date.now();
  try {
    const p = await db();
    const result = await p.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT id, reference, property_address, city, property_type, price,
               sale_date, status, document_type, updated_at
          FROM sale_documents WHERE id = @id
      `);
    doc = result.recordset[0] || null;
  } catch (e) {
    logLine('error', 'db_query_failed', { query: 'get_sale_document', error: e.message });
    res.status(500).send('Database error');
    return;
  }

  logLine('info', 'db_query', {
    query: 'get_sale_document', id, found: !!doc, duration_ms: Date.now() - dbStart,
  });

  if (!doc) {
    logLine('info', 'http_request', { path: `/document/${id}`, status: 404, id });
    res.status(404).send('Document not found');
    return;
  }

  const elapsed = Date.now() - t0;
  logLine('info', 'http_request', {
    path: `/document/${id}`, status: 200, id, duration_ms: elapsed,
  });

  res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(doc.reference)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#f7f7f9}
.card{background:#fff;padding:1.5rem 2rem;border-radius:8px;max-width:640px}
dt{color:#666;font-size:.8rem;margin-top:1rem}
dd{margin:.2rem 0 0;font-size:1rem}
.meta{color:#666;font-size:.85rem;margin-top:1.5rem}
</style></head><body>
<div class="card">
<h1>${esc(doc.reference)}</h1>
<dl>
<dt>Property</dt><dd>${esc(doc.property_address)}</dd>
<dt>City</dt><dd>${esc(doc.city)}</dd>
<dt>Type</dt><dd>${esc(doc.property_type)}</dd>
<dt>Price</dt><dd>${fmtPrice(doc.price)}</dd>
<dt>Sale date</dt><dd>${esc(fmtDate(doc.sale_date))}</dd>
<dt>Status</dt><dd>${esc(doc.status)}</dd>
<dt>Document type</dt><dd>${esc(doc.document_type)}</dd>
<dt>Last update</dt><dd>${esc(fmtDateTime(doc.updated_at))}</dd>
</dl>
<p class="meta">
  render: ${elapsed} ms ·
  <a href="/">&larr; back to list</a>
</p>
</div></body></html>`);
});

// ============ GET /health — only DB now ============

app.get('/health', async (req, res) => {
  const result = {
    status: 'ok',
    checks: {
      db: { up: false, latency_ms: null, error: null },
    },
  };

  const start = Date.now();
  try {
    const p = await db();
    await p.request().query('SELECT 1 AS ok');
    result.checks.db.up = true;
  } catch (e) {
    result.checks.db.error = e.message;
  }
  result.checks.db.latency_ms = Date.now() - start;

  if (!result.checks.db.up) {
    result.status = 'degraded';
    res.status(503);
    logLine('error', 'healthcheck_failed', result.checks);
  }
  res.json(result);
});

// ============ boot ============

const server = app.listen(config.app.port, () => {
  logLine('info', 'server_started', { port: config.app.port, env: config.app.env });
});

process.on('SIGTERM', () => {
  logLine('info', 'shutting_down', {});
  server.close(async () => {
    await shutdown();
    process.exit(0);
  });
});