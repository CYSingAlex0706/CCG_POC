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

module.exports = {
  app: {
    env:  optEnv('APP_ENV', 'local'),
    port: parseInt(optEnv('PORT', '8080'), 10),
  },
  db: {
    host: requireEnv('DB_HOST'),
    port: parseInt(optEnv('DB_PORT', '1433'), 10),
    name: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    pass: requireEnv('DB_PASSWORD'),
    encrypt: optEnv('DB_ENCRYPT', '1') === '1',
    trustServerCertificate: optEnv('DB_TRUST_SERVER_CERT', '0') === '1',
    loginTimeout: parseInt(optEnv('DB_LOGIN_TIMEOUT', '5'), 10),
    appName: optEnv('DB_APP_NAME', 'sale-docs'),
  },
};