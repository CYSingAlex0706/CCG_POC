#!/usr/bin/env bash
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/ccg-poc/NodeJS_MSSQL}
CONFIG_DIR="$APP_DIR/observability/solution-2"
AGENT_DIR=/opt/ccg-observability/agent
# Application files must be the upstream main baseline, not Solution 1's HTML/dependencies.
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund
mkdir -p "$AGENT_DIR" /var/log/ccg-s2 /etc/rumable /etc/systemd/system/ccg-poc.service.d
cp "$CONFIG_DIR"/agent/*.json "$CONFIG_DIR"/agent/*.cjs "$AGENT_DIR/"
npm ci --prefix "$AGENT_DIR" --omit=dev --no-audit --no-fund
chown guance-poc:guance-poc /var/log/ccg-s2
python3 "$CONFIG_DIR/configure-datakit.py"
python3 "$CONFIG_DIR/configure-sqlserver.py"
cp "$CONFIG_DIR/beacon.conf" /etc/systemd/system/ccg-poc.service.d/observability.conf
cp "$CONFIG_DIR/nginx-tracing.conf" /etc/nginx/conf.d/ccg-s2-tracing.conf
cp "$CONFIG_DIR/nginx-site.conf" /etc/nginx/sites-available/guance-poc
cp "$CONFIG_DIR/rumable.toml" /etc/rumable/ccg-s2.toml
cp "$CONFIG_DIR/logrotate.conf" /etc/logrotate.d/ccg-s2
nginx -t
systemctl daemon-reload
systemctl restart datakit ccg-poc
systemctl reload nginx
# Runtime HTML injection, CDN source and asynchronous SDK download; no HTML edits.
/opt/rumable/0.1.11/rumable setup --config /etc/rumable/ccg-s2.toml --state-dir /var/lib/rumable --site ccg-s2 --target /etc/nginx/sites-available/guance-poc:1 --yes --non-interactive
curl -fsS --retry 15 --retry-connrefused --retry-delay 1 http://127.0.0.1:8080/api/health
