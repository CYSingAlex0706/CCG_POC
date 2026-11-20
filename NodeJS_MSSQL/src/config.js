'use strict';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optEnv(name, def = null) {
  const v = process.env[name];
  return v && v !== '' ? v : def;
}

const mode = optEnv('DATA_MODE', 'memory'); // memory | mssql

module.exports = {
  app: {
    env: optEnv('APP_ENV', 'local'),
    port: parseInt(optEnv('PORT', '8080'), 10),
    name: 'Chinachem Property Sales — APM Demo',
  },
  data: {
    mode,
  },
  db: {
    host: mode === 'mssql' ? requireEnv('DB_HOST') : optEnv('DB_HOST', ''),
    port: parseInt(optEnv('DB_PORT', '1433'), 10),
    name: mode === 'mssql' ? requireEnv('DB_NAME') : optEnv('DB_NAME', ''),
    user: mode === 'mssql' ? requireEnv('DB_USER') : optEnv('DB_USER', ''),
    pass: mode === 'mssql' ? requireEnv('DB_PASSWORD') : optEnv('DB_PASSWORD', ''),
    encrypt: optEnv('DB_ENCRYPT', '1') === '1',
    trustServerCertificate: optEnv('DB_TRUST_SERVER_CERT', '0') === '1',
    loginTimeout: parseInt(optEnv('DB_LOGIN_TIMEOUT', '5'), 10),
    appName: optEnv('DB_APP_NAME', 'sale-docs'),
  },
};
