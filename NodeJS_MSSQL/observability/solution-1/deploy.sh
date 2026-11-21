#!/usr/bin/env bash
set -euo pipefail
# Prerequisites: running upstream application, Node 24, Nginx and a DataWay with OTLP HTTP support.
# Store the target workspace DataWay URL in this root-only file first.
APP_DIR=${APP_DIR:-/opt/ccg-poc/NodeJS_MSSQL}
CONFIG_DIR="$APP_DIR/observability/solution-1"
# Preserve the currently running option before replacing runtime configuration.
BACKUP=/root/ccg-observability-backups/s1-dataway-$(date +%Y%m%d%H%M%S)
mkdir -p "$BACKUP"
cp /etc/nginx/sites-available/guance-poc "$BACKUP/nginx-site"
cp /etc/systemd/system/ccg-poc.service.d/observability.conf "$BACKUP/systemd.conf" 2>/dev/null || true
if test -f /etc/nginx/conf.d/ccg-s2-tracing.conf; then
  mv /etc/nginx/conf.d/ccg-s2-tracing.conf "$BACKUP/"
fi
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund
python3 "$CONFIG_DIR/prepare-dataway.py"
# This dedicated host must not collect S2 logs/metrics during S1 review.
systemctl disable --now datakit
mkdir -p /etc/systemd/system/ccg-poc.service.d
cp "$CONFIG_DIR/beacon.conf" /etc/systemd/system/ccg-poc.service.d/observability.conf
cp "$CONFIG_DIR/nginx-site.conf" /etc/nginx/sites-available/guance-poc
nginx -t
systemctl daemon-reload
systemctl restart ccg-poc
systemctl reload nginx
curl -fsS --retry 15 --retry-connrefused --retry-delay 1 http://127.0.0.1:8080/api/health
