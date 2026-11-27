#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ns=${NAMESPACE:-ccg-test}
kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
# First install only. CI may mount the two input files from its secret store.
provision() {
  local secret=$1 key=$2 file=$3 prompt=$4 value
  if [[ -n "$(kubectl -n "$ns" get secret "$secret" --ignore-not-found -o name)" ]]; then return; fi
  if [[ -n "$file" ]]; then
    value=$(cat "$file")
  elif [[ -t 0 ]]; then
    read -r -s -p "$prompt: " value
    echo >&2
  else
    echo "Missing $secret. Supply its credential file (see README.md)." >&2
    return 1
  fi
  if [[ "$key" == otlp-headers ]]; then
    [[ "$value" =~ ^tkn_[[:alnum:]]+$ ]] || { echo "Invalid workspace token" >&2; return 1; }
    value="X-Token=$value"
  else
    [[ "$value" =~ ^[[:xdigit:]]{32}$ ]] || { echo "Invalid RUM client token" >&2; return 1; }
  fi
  printf %s "$value" | kubectl -n "$ns" create secret generic "$secret" --from-file="$key=/dev/stdin"
}
provision guance-browser client-token "${RUM_TOKEN_FILE:-}" "CCG_K8S_MSSQL browser Client Token"
provision guance-intake otlp-headers "${WORKSPACE_TOKEN_FILE:-}" "Hong Kong chinachemgroup_poc workspace token"
./database.sh
kubectl -n "$ns" apply -k .
kubectl -n "$ns" rollout status deployment/properties-web-node --timeout=30m
kubectl -n "$ns" exec deployment/properties-web-node -c web -- env NODE_OPTIONS= node -e '
(async () => {
  const origin = "http://127.0.0.1:8080";
  const page = await fetch(origin + "/sales.html");
  if (!page.ok || !(await page.text()).includes("/_guance/rum.js")) throw Error("RUM loader missing");
  const get = async path => {
    const res = await fetch(origin + "/api/" + path);
    if (!res.ok) throw Error(path + " returned HTTP " + res.status);
    return res.json();
  };
  const health = await get("health");
  if (health.data_mode !== "mssql" || !health.checks.db.up) throw Error("MSSQL unavailable");
  const documents = await get("documents");
  if (!Array.isArray(documents) || !documents.some(d => d.reference === "SD-2026-0001")) throw Error("Seed document missing");
  console.log("MSSQL connection and document query succeeded");
})().catch(err => { console.error(err.message); process.exitCode = 1; });'
