'use strict';

const sql = require('mssql');
const config = require('./config');
const { PROPERTIES, DOCUMENTS, DOCUMENT_COLUMNS } = require('./data');

/**
 * Data access with two modes:
 *  - memory (default): zero-dependency demo, no MSSQL needed
 *  - mssql: uses the original SQL Server / Azure SQL connection
 */
let pool = null;
const useMssql = config.data.mode === 'mssql';

function getPool() {
  if (pool) return pool;
  pool = new sql.ConnectionPool({
    server: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.pass,
    connectionTimeout: config.db.loginTimeout * 1000,
    requestTimeout: config.db.loginTimeout * 1000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
      appName: config.db.appName,
      enableArithAbort: true,
    },
  });
  pool.on('error', () => {});
  return pool;
}

async function db() {
  const p = getPool();
  if (!p.connected) await p.connect();
  return p;
}

async function listDocuments() {
  if (!useMssql) return DOCUMENTS.map(d => pick(d, DOCUMENT_COLUMNS));
  const p = await db();
  const result = await p.request().query(`
    SELECT id, reference, property_address, city, property_type, price,
           sale_date, status, document_type, updated_at
      FROM sale_documents
    ORDER BY sale_date DESC
  `);
  return result.recordset;
}

async function getDocument(id) {
  if (!useMssql) {
    const doc = DOCUMENTS.find(d => d.id === id);
    return doc ? pick(doc, DOCUMENT_COLUMNS) : null;
  }
  const p = await db();
  const result = await p.request().input('id', sql.Int, id).query(`
    SELECT id, reference, property_address, city, property_type, price,
           sale_date, status, document_type, updated_at
      FROM sale_documents WHERE id = @id
  `);
  return result.recordset[0] || null;
}

async function listProperties() {
  return PROPERTIES.slice();
}

async function getProperty(id) {
  return PROPERTIES.find(p => p.id === id) || null;
}

async function pingDb() {
  if (!useMssql) return { up: true, latency_ms: 0, mode: 'memory' };
  const start = Date.now();
  const p = await db();
  await p.request().query('SELECT 1 AS ok');
  return { up: true, latency_ms: Date.now() - start, mode: 'mssql' };
}

async function shutdown() {
  try { if (pool) await pool.close(); } catch (_) {}
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

module.exports = { listDocuments, getDocument, listProperties, getProperty, pingDb, shutdown };
