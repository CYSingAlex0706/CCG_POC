'use strict';

const sql = require('mssql');
const config = require('./config');

function logLine(level, msg, ctx = {}) {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ctx,
  }) + '\n');
}

// ---- MSSQL pool (long-lived, reconnect-on-demand) ----
let pool = null;

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
  pool.on('error', (err) => logLine('warning', 'db_pool_error', { error: err.message }));
  return pool;
}

async function db() {
  const p = getPool();
  if (!p.connected) await p.connect();
  return p;
}

async function shutdown() {
  try { if (pool) await pool.close(); } catch (_) {}
}

module.exports = { logLine, db, config, shutdown };