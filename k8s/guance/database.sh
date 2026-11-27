#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ns=${NAMESPACE:-ccg-test}
k=(kubectl -n "$ns")

# Reuse both passwords across releases. Losing the admin Secret breaks access
# to an existing volume, so never generate a replacement in that situation.
for secret in properties-sql-admin properties-sql-reader; do
  if [[ -z "$("${k[@]}" get secret "$secret" --ignore-not-found -o name)" ]]; then
    if [[ -n "$("${k[@]}" get pvc properties-sql --ignore-not-found -o name)" ]]; then
      echo "Restore $secret from backup before deploying to the existing volume." >&2
      exit 1
    fi
    { printf 'Cc9!'; openssl rand -hex 24 | tr -d '\n'; } |
      "${k[@]}" create secret generic "$secret" --from-file=password=/dev/stdin
  fi
done
"${k[@]}" apply -f database.yaml
"${k[@]}" rollout status deploy/properties-sql --timeout=30m
sqlcmd() {
  "${k[@]}" exec -i deploy/properties-sql -- bash -ec '
    export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
    exec /opt/mssql-tools18/bin/sqlcmd -C -b -S localhost -U sa "$@"
  ' -- "$@"
}
for ((i=0; i<60; i++)); do
  if sqlcmd -Q 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 3
done
sqlcmd -Q "IF DB_ID('properties') IS NULL CREATE DATABASE properties"
sqlcmd -d properties < ../../NodeJS_MSSQL/db/MMSQL.sql
password=$("${k[@]}" get secret properties-sql-reader -o 'go-template={{index .data "password" | base64decode}}')
# Escape a SQL string literal for credentials restored from backup.
escaped=${password//\'/\'\'}
sqlcmd <<SQL
IF SUSER_ID('properties_reader') IS NULL CREATE LOGIN properties_reader WITH PASSWORD = '$escaped';
GO
USE properties;
IF USER_ID('properties_reader') IS NULL CREATE USER properties_reader FOR LOGIN properties_reader;
GRANT SELECT ON dbo.sale_documents TO properties_reader;
GO
SQL
