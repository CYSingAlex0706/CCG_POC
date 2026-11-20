'use strict';

/**
 * In-process APM store. This is intentionally small and dependency-free:
 * it gives the demo real request/error/latency data instead of hard-coded charts.
 * In a production deployment these records would go to an OTel collector.
 */

const MAX_RECORDS = 300;
const MAX_BUCKETS = 60;

const state = {
  requests: [],   // { ts, method, path, status, duration_ms, source, trace_id, component, detail }
  errors: [],     // { ts, level, msg, path, error, trace_id, component }
  clientEvents: [], // browser RUM: { ts, type, path, duration_ms, ok, status, detail }
  buckets: [],    // { ts, count, errors, total_ms }
};

function now() { return Date.now(); }
function traceId() {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

function push(list, item) {
  list.push(item);
  if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
}

function currentBucket() {
  const ts = Math.floor(now() / 1000) * 1000;
  let b = state.buckets[state.buckets.length - 1];
  if (!b || b.ts !== ts) {
    b = { ts, count: 0, errors: 0, total_ms: 0 };
    state.buckets.push(b);
    if (state.buckets.length > MAX_BUCKETS) state.buckets.splice(0, state.buckets.length - MAX_BUCKETS);
  }
  return b;
}

function recordRequest(req, status, durationMs, extra = {}) {
  const rec = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl || req.path,
    status,
    duration_ms: Math.round(durationMs),
    source: extra.source || 'server',
    trace_id: extra.trace_id || traceId(),
    component: extra.component || 'api',
    detail: extra.detail || null,
  };
  push(state.requests, rec);
  const b = currentBucket();
  b.count += 1;
  b.total_ms += rec.duration_ms;
  if (status >= 400) {
    b.errors += 1;
    push(state.errors, {
      ts: rec.ts,
      level: status >= 500 ? 'error' : 'warning',
      msg: extra.error || (status >= 500 ? 'Upstream failure' : 'Client error'),
      path: rec.path,
      status,
      trace_id: rec.trace_id,
      component: rec.component,
    });
  }
  return rec.trace_id;
}

function recordClientEvent(body) {
  const rec = {
    ts: new Date(body.ts) && body.ts ? new Date(body.ts).toISOString() : new Date().toISOString(),
    type: body.type || 'fetch',
    path: String(body.path || '').slice(0, 200),
    duration_ms: Number(body.duration_ms) || 0,
    ok: !!body.ok,
    status: Number(body.status) || 0,
    detail: body.detail ? String(body.detail).slice(0, 300) : null,
    trace_id: String(body.trace_id || '').slice(0, 40),
  };
  push(state.clientEvents, rec);
  return rec;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return Math.round(s[idx]);
}

function summary() {
  const requests = state.requests.slice();
  const errors = state.errors.slice();
  const durations = requests.map(r => r.duration_ms);
  const total = requests.length;
  const failed = requests.filter(r => r.status >= 400).length;
  const recent = requests.filter(r => Date.now() - new Date(r.ts).getTime() < 60000);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      requests: total,
      errors: failed,
      error_rate_pct: total ? +((failed / total) * 100).toFixed(2) : 0,
      avg_latency_ms: total ? Math.round(durations.reduce((a, b) => a + b, 0) / total) : 0,
      p50_ms: percentile(durations, 50),
      p95_ms: percentile(durations, 95),
      p99_ms: percentile(durations, 99),
      rps_1m: +(recent.length / 60).toFixed(2),
    },
    endpoints: Object.values(requests.reduce((acc, r) => {
      const key = `${r.method} ${r.path.split('?')[0]}`;
      if (!acc[key]) acc[key] = { endpoint: key, count: 0, errors: 0, total_ms: 0 };
      acc[key].count += 1;
      acc[key].total_ms += r.duration_ms;
      if (r.status >= 400) acc[key].errors += 1;
      return acc;
    }, {})).map(e => ({
      ...e,
      avg_ms: Math.round(e.total_ms / e.count),
      error_rate_pct: +((e.errors / e.count) * 100).toFixed(1),
    })).sort((a, b) => b.count - a.count),
    timeline: state.buckets.map(b => ({
      ts: new Date(b.ts).toISOString(),
      requests: b.count,
      errors: b.errors,
      avg_ms: b.count ? Math.round(b.total_ms / b.count) : 0,
    })),
    recent_requests: requests.slice(-20).reverse(),
    recent_errors: errors.slice(-20).reverse(),
    client_events: state.clientEvents.slice(-30).reverse(),
  };
}

module.exports = {
  recordRequest,
  recordClientEvent,
  summary,
  traceId,
  get state() { return state; },
};
