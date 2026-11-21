#!/usr/bin/env bash
set -euo pipefail
# Prerequisites: running upstream application, Node 24, Nginx and DataKit 2.x.
# Store the target workspace DataWay URL in this root-only file first.
APP_DIR=${APP_DIR:-/opt/ccg-poc/NodeJS_MSSQL}
CONFIG_DIR="$APP_DIR/observability/solution-1"
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund
python3 "$CONFIG_DIR/configure-datakit.py"
mkdir -p /etc/systemd/system/ccg-poc.service.d
cp "$CONFIG_DIR/beacon.conf" /etc/systemd/system/ccg-poc.service.d/observability.conf
cp "$CONFIG_DIR/nginx-site.conf" /etc/nginx/sites-available/guance-poc
nginx -t
systemctl daemon-reload
systemctl restart datakit ccg-poc
systemctl reload nginx
curl -fsS --retry 15 --retry-connrefused --retry-delay 1 http://127.0.0.1:8080/api/health
