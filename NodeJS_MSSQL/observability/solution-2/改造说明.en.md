# Solution 2 — full-stack observability: application integration guide

This guide compares the current solution with the original MSSQL application at main `c0474954a0f99882d0a468ec6557daedcfa76a25`. Deployment version: `s2-dataway-1.1.0`.

## Integration effort: three steps

1. **Enable external backend instrumentation.** Install Beacon outside the application and preload it through startup configuration. HTTP, Express and tedious calls are traced automatically. An external adapter adds active Trace/Span IDs to the existing custom JSON logger.
2. **Inject browser monitoring at the gateway.** Rumable/Nginx inserts a shared initializer into HTML responses. The official SDK downloads asynchronously from its CDN. Session and replay sampling are 100%; the default `mask-user-input` policy masks form inputs.
3. **Configure full-stack collection and reporting.** Enable native Nginx tracing, log collection and host/component metrics, then supply the target workspace's reporting configuration.

**No edits to application business source, HTML files, package.json or its lockfile.** All delivered additions are in `observability/solution-2`. This does involve infrastructure configuration and external integration code: the custom log adapter is code, although it does not modify business modules. Original APIs, SQL queries, schema, credentials and the built-in custom telemetry module stay in place.

## Architecture and full-stack observation points

![Full-stack architecture](architecture/solution.png)

[Editable draw.io](architecture/solution.drawio) · [SVG](architecture/solution.svg)

The diagram preserves browser/client OS, Nginx, Node.js/Express, SQL Server 2022, Docker/container OS and Ubuntu host OS. Solid arrows show business requests; colored dashed arrows show telemetry.

- Browser RUM/replay → Hong Kong RUM public DataWay → workspace.
- Beacon Node.js traces and runtime metrics → HTTPS OTLP HTTP/protobuf DataWay → workspace.
- Nginx Spans → local DataKit gRPC receiver → DataWay → workspace. The native Nginx module supports OTLP/gRPC, so this gateway path requires the protocol bridge.
- Application/Nginx/SQL log files and native host/container/Nginx/SQL metrics → DataKit → DataWay → workspace.

DataKit here is the host/component collector and Nginx protocol bridge. It is not in the browser or Node.js trace-reporting path. SQL calls are child Spans from tedious instrumentation; SQL Server metrics/error logs are separate component signals. Bundled property reference data remains in data.js; document queries and DB health use MSSQL.

## Annotated implementation details

### Backend: external agent and startup settings

`agent/package.json` pins Beacon 2.0.2 and the OTel API in `/opt/ccg-observability/agent`; application dependencies remain unchanged. `agent/register.cjs` is loaded by systemd before business modules:

```javascript
// External startup adapter: no import is added to the application entry point.
require('@beacon-observability/nodejs/register');
require('./correlate-logs.cjs');
```

`beacon.conf` is installed at `/etc/systemd/system/ccg-poc.service.d/observability.conf`. The external preload enables automatic instrumentation; the public `/otel` endpoint uses HTTP/protobuf. Runtime metrics are exported; profiling is disabled. Logs are collected from the existing output file, not an OTel log exporter:

```ini
# systemd drop-in: /etc/systemd/system/ccg-poc.service.d/observability.conf
[Service]
# Preload before Express and mssql are imported; no manual request/SQL spans.
Environment="NODE_OPTIONS=--require /opt/ccg-observability/agent/register.cjs"
Environment="OTEL_SERVICE_NAME=ccg-s2-api"
Environment="OTEL_RESOURCE_ATTRIBUTES=env=poc,version=s2-dataway-1.1.0,service.version=s2-dataway-1.1.0,host.name=CCG-Mock-APM,solution=s2"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=https://cn6-openway.guance.one/otel"
Environment="OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf"
Environment="OTEL_PROPAGATORS=tracecontext,baggage"
Environment="OTEL_TRACES_EXPORTER=otlp"
Environment="OTEL_TRACES_SAMPLER=always_on"
Environment="OTEL_NODE_ENABLED_INSTRUMENTATIONS=http,express,tedious,runtime-node"
# Export runtime metrics; JSON application logs are tailed by DataKit.
Environment="OTEL_METRICS_EXPORTER=otlp"
Environment="OTEL_LOGS_EXPORTER=none"
Environment="OTEL_PROFILING_ENABLED=false"
Environment="OTEL_LOG_LEVEL=warn"
Environment="OTEL_METRIC_EXPORT_INTERVAL=15000"
StandardOutput=append:/var/log/ccg-s2/application.log
StandardError=append:/var/log/ccg-s2/application.log

# Backend-only DataWay authentication.
EnvironmentFile=/etc/ccg-observability/s2-otlp.env
```

`prepare-dataway.py` writes a root-only `/etc/ccg-observability/s2-otlp.env` with `OTEL_EXPORTER_OTLP_HEADERS=X-Token=<workspace-token>`. The exporter appends `/v1/traces` or `/v1/metrics` to the `/otel` base URL. Do not serve this backend credential to browsers.

### Browser: Rumable CDN asynchronous injection

`rumable.toml` is a deployment template. `prepare-dataway.py` substitutes the existing RUM application's browser Client Token into the root-only `/etc/rumable/ccg-s2.toml`; the actual token is not committed. Rumable attaches the initializer to the public Nginx server, transforming HTML responses while source HTML stays intact:

```toml
schemaVersion = 1
[[sites]]
id = "ccg-s2-dataway"
publicURL = "http://150.5.141.233/"
includePaths = ["/"]
probePaths = ["/", "/sales.html", "/document.html"]
[sites.nginx]
binary = "/usr/sbin/nginx"
args = ["-c", "/etc/nginx/nginx.conf"]
attachmentReviewed = false
[sites.sdk]
source = "cdn"
url = "https://static.guance.com/browser-sdk/v3/dataflux-rum.js"
loading = "async"
integrity = false
[sites.rum]
applicationId = "CCG_S2_FULLSTACK"
site = "https://cn6-rum-openway.guance.one"
clientToken = "__RUM_CLIENT_TOKEN__"
service = "ccg-s2-web"
env = "poc"
version = "s2-dataway-1.1.0"
sessionSampleRate = 100
sessionReplayEnabled = true
sessionReplaySampleRate = 100
defaultPrivacyLevel = "mask-user-input"
trackUserInteractions = true
allowedTracingUrls = ["http://150.5.141.233/"]
traceType = "w3c_traceparent"
tracingSampleRate = 100
```

`sessionReplayEnabled=true` instructs Rumable to start recording after SDK initialization. With both sampling rates at 100, all eligible sessions are selected. Explicit `mask-user-input` retains the default input-masking policy and keeps ordinary page text visible. Browser restrictions, failed downloads/network requests and unsupported content can still produce gaps; pre-initialization activity is not recovered. Use a fresh browser session when validating a changed sampling policy. The CDN v3 URL is rolling; record the resolved SDK version when deploying.

### Gateway tracing and log association

`nginx-tracing.conf` configures the Nginx OTel module and a JSON access-log format containing `$otel_trace_id` and `$otel_span_id`. The key business location in `nginx-site.conf` is:

```nginx
location / {
    otel_trace on;                    # Create a gateway Span.
    otel_trace_context propagate;     # Continue browser context and send context to Node.js.
    otel_span_name "$request_method $ccg_s2_route";
    proxy_pass http://127.0.0.1:8080;  # Original application backend.
    # The full file also preserves forwarded request headers.
}
```

`otel_exporter` sends gRPC to `127.0.0.1:4317`. `opentelemetry.conf` enables this local receiver. `127.0.0.1:8088/basic_status` supplies Nginx metrics and is not publicly proxied. No application code is needed to add the gateway Span.

### Existing custom logs: one external adapter

The customer's logger writes complete JSON lines to stderr rather than using a standard instrumented logger. `agent/correlate-logs.cjs` adds the active Trace/Span IDs at that output boundary, preserving non-JSON writes. Startup/background messages legitimately may have no active request Span:

```javascript
/* External adapter for the customer's existing JSON stderr logger.
 * Beacon handles traces; this adapter only enriches complete JSON log lines.
 * It does not modify src/server.js or introduce a new business logging API.
 */
'use strict';
const { context, trace, isSpanContextValid } = require('@opentelemetry/api');
const originalWrite = process.stderr.write;
process.stderr.write = function (chunk, encoding, callback) {
  let output = chunk;
  try {
    // The existing logLine writes one complete JSON string ending in a newline.
    if (typeof chunk === 'string' && chunk.endsWith('\n')) {
      const record = JSON.parse(chunk);
      if (record && record.ts && record.level && record.msg) {
        record.service = process.env.OTEL_SERVICE_NAME;
        record.status = record.level;
        record.message = record.msg;
        const span = trace.getSpan(context.active());
        const sc = span && span.spanContext();
        // Startup/background logs may have no request Span; never invent IDs.
        if (sc && isSpanContextValid(sc)) {
          record.trace_id = sc.traceId;
          record.span_id = sc.spanId;
        }
        output = JSON.stringify(record) + '\n';
      }
    }
  } catch (_) { /* Preserve non-JSON writes, buffers and partially written lines. */ }
  return originalWrite.call(this, output, encoding, callback);
};
```

Systemd writes stdout/stderr to `/var/log/ccg-s2/application.log`; the first collector in `logging.conf` is:

```toml
[[inputs.logging]]
  logfiles = ["/var/log/ccg-s2/application.log"] # Existing process output.
  source = "ccg-s2-app"
  service = "ccg-s2-api"                      # Matches backend trace service.
  json_as_fields = true                     # Search trace_id and span_id as fields.
  enable_multiline = false
  from_beginning = true
```

The same file configures Nginx access/error logs and SQL Server errorlog; `logrotate.conf` manages rotation. SQL error logs and unstructured gateway errors generally lack a request Trace ID and correlate through component/host/time. Review this small adapter if the customer's logging format changes; it is not a universal logger replacement.

### Metrics and correlation dimensions

DataKit reads CPU/memory/disk/disk I/O/network/system/process/host inventory and Docker metrics. The Nginx collector polls local stub_status. `configure-sqlserver.py` creates a dedicated monitoring login and writes its password only to root-only files. It grants monitoring-state access, not business-data write permissions. Beacon exports Node.js runtime/HTTP metrics directly through OTLP.

| Signal | Identity / association |
| --- | --- |
| Browser | app CCG_S2_FULLSTACK, service ccg-s2-web |
| Backend Spans / request logs | service ccg-s2-api; exact trace_id/span_id |
| Gateway Spans / access logs / metrics | service ccg-s2-nginx |
| SQL metrics/error logs | service ccg-s2-sqlserver |
| Host/container | CCG-Mock-APM / ccg-mssql-db; solution=s2 where supported |
| Version/environment | s2-dataway-1.1.0 / poc |

Metrics associate by service/host/time; no per-request metric exemplars are configured. OTLP metric dimensions can differ from native metric tags, so inspect the returned keys (for example service_name versus service). SQL exit Spans retain the API service name; they do not represent a separately instrumented SQL Server process. Gateway-derived request metrics cover the gateway's received Span stream.

## Parameters: where customers obtain them

| Parameter | Tested value / source |
| --- | --- |
| Workspace | Hong Kong console selector → chinachemgroup_poc |
| RUM applicationId | RUM → Web application settings → CCG_S2_FULLSTACK |
| RUM site / Client Token | Same application's public DataWay integration → https://cn6-rum-openway.guance.one; save browser token to /etc/ccg-observability/s2-rum-client-token (600) |
| Backend / collector DataWay URL | Target workspace Integrations → installation/reporting configuration; full DK_DATAWAY URL in /etc/ccg-observability/dataway.url (600) |
| OTLP endpoint/protocol | https://cn6-openway.guance.one/otel / http/protobuf; backend token extracted into s2-otlp.env |
| SDK URL | Official Web RUM CDN guide; supplied rolling v3 URL |
| Services/env/version | Customer-defined ccg-s2-*, poc, s2-dataway-1.1.0; set consistently in provided configuration |
| Origin/allowlist | Actual browser origin; update publicURL and allowedTracingUrls together |
| Sampling/privacy | Customer policy: session/replay/trace 100; mask-user-input |
| host.name | Actual host identity; CCG-Mock-APM in this PoC |
| APP_DIR/unit/user | Existing /opt/ccg-poc/NodeJS_MSSQL / ccg-poc / guance-poc |
| Nginx attachment | Rumable-discovered public server target; tested /etc/nginx/sites-available/guance-poc:1 |
| Local receiver/status | Loopback 4317 / 8088; internal configuration, not public endpoints |
| SQL connection | Original SQL Server 127.0.0.1:1433, database properties |
| SQL monitor password | Generated by configure-sqlserver.py; /etc/ccg-mssql/monitor-s2.password (600) |
| SQL bootstrap credential | Existing SQL container admin environment, consumed inside Docker |
| SQL log path / Docker socket | Existing ccg-mssql-data volume log/errorlog / /var/run/docker.sock; adapt for customer mounts |
| Read-only query API key | Workspace Management → API Keys; used separately for verification, not ingestion |

## Deploy on the original MSSQL application

1. Prerequisites: original app in MSSQL mode; Node 24.22.3, Nginx 1.30.7 with matching official ngx_otel_module 0.1.2 and sub_filter support, DataKit 2.19.1, Rumable 0.1.11, systemd and SQL Server 2022 Docker available. Use official vendor packages matching the customer's OS/build. This is an observability overlay, not a base-system/database installer.
2. Review the configuration paths, hostname checks, services and public origin. Supply root-only DataWay and browser token files (directory 700, files 600). Backend and browser credentials have different scopes.
3. Back up the existing Nginx site and systemd drop-in. For a repeated installation on an already attached site, first run `rumable uninstall --config /etc/rumable/ccg-s2.toml --state-dir /var/lib/rumable --site ccg-s2-dataway --yes` to remove the managed attachment before replacing its Nginx file. Start from the original application baseline, not an already modified application package. Then run as root:

```bash
cd /opt/ccg-poc/NodeJS_MSSQL
bash observability/solution-2/deploy.sh
```

The script installs the agent separately, backs up/reconfigures this dedicated collector, configures SQL monitoring, generates runtime credentials, applies systemd/Nginx configuration, starts services, then attaches Rumable with site ID ccg-s2-dataway. On a shared collector, merge reviewed inputs rather than replacing its active configuration set. When changing workspace, quarantine old queued data before changing the destination.

4. Verify health says data_mode=mssql and DB up; Nginx configuration passes; local metrics endpoint works; public HTML contains exactly the intended Rumable injection. Open a fresh browser session, wait for the CDN SDK, reload sales documents and open a detail page. Confirm replay and the associated browser → Nginx → Node → SQL trace, request logs and matching-time metrics in the target workspace.
5. Rollback: preserve current runtime configuration, detach this Rumable attachment and restore reviewed Nginx/systemd/collector backups; reload and restart affected services. Keep SQL volumes and credentials. External Node instrumentation unloads only after process restart.

## Verification evidence

Current-version evidence is saved separately under `evidence-current`. Check exact timestamps and version tags. A 100% policy is not proof of zero browser/network loss. Direct OTLP backend records may have null Guance-specific span_type while IDs and parent relationships remain present; preserve this limitation when assessing UI rendering.

Official references: [Nginx OTel gRPC support](https://nginx.org/en/docs/ngx_otel_module.html), [Rumable CDN/async configuration](https://docs.guance.com/en/real-user-monitoring/web/rumable/configuration/), [replay default privacy](https://docs.guance.com/en/real-user-monitoring/session-replay/web/data-integrity/), [DataWay OTLP](https://docs.guance.com/en/deployment/dataway/).

### Recorded acceptance sample — 21 November 2026

- Trace `556f1229bf568c7d27f7831f7c58ae1c`: 10 Spans linking browser → Nginx → Node/Express → two SQL calls.
- The same Trace ID retrieves three request records: gateway access, application http_request and application db_query.
- Replay session `94f45fae-e24b-4631-b638-ab5244eff662` was received under version s2-dataway-1.1.0; the served initializer was checked for 100% sampling, mask-user-input and recording startup.
- Host, container, Nginx, SQL and Node runtime metrics were queried. One explicitly labeled informational SQL verification record confirms SQL errorlog collection; it is a deliberate test message, not a database incident.
- Passed 12 HTTP status checks, four public HTML injection checks and the original application-source/dependency diff check.

See evidence-current for raw queries, validated syntax and exact time windows. Metric values are point-in-time samples; per-request metric exemplars are not configured.

### Existing-session replay verification — 21 November 2026

The 21:43 session initially produced RUM without replay, despite 100% sampling. In that same browser session, `isRecording()` was false. The official `startSessionReplayRecording({force:true})` API restored recording; recording remained active after reload. The workspace then received 33 replay records for the same session and a related view had `session_has_replay=1`. No application code or server configuration was changed for this recovery. Earlier unrecorded actions cannot be recovered. Retained session eligibility is a suspected cause, not a proven internal cause. Validate new deployments using a fresh session, actual recording state and workspace replay data.
