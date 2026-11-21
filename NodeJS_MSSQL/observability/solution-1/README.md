# Solution 1 — Minimal APM and CDN Async RUM

This independent branch starts from upstream main `c047495`. It adds Guance APM and browser RUM to the existing MSSQL deployment. Business JavaScript under `src/`, SQL statements and the customer's custom `rum.js` / `telemetry.js` are unchanged.

![Solution 1 observation points](architecture/solution.png)

[Editable draw.io](architecture/solution.drawio) · [SVG](architecture/solution.svg) · [Before integration](architecture/baseline.png)

## Exact change surface

| File | Change | Reason |
| --- | --- | --- |
| `package.json` | Add `@beacon-observability/nodejs` 2.0.2 | Install the automatic backend agent |
| `package-lock.json` | Resolve and pin the agent dependency tree | Reproducible installation |
| `public/index.html`, `sales.html`, `property.html`, `document.html` | Add the same two lines before `</head>` | Load a shared RUM bootstrap |
| `public/js/guance-rum.js` | One new bootstrap file | Download the official SDK asynchronously and initialize it |
| `observability/solution-1/*` | Deployment templates, diagrams and evidence | Host-side configuration and customer instructions |

There are **no edits to application routes, SQL queries, the custom logging function or backend business files**. This is a dependency/startup change plus four HTML entry-point additions, not hand-written backend Span instrumentation.

## Annotated integration code

### A. HTML entry points: immediately before `</head>`

```html
<!-- Solution 1: shared bootstrap downloads the Guance SDK asynchronously. -->
<script src="/js/guance-rum.js"></script>
```

This small same-origin bootstrap is loaded normally. The **Guance SDK itself** is dynamically downloaded from the official CDN with `async=true`, as shown next. Each HTML document initializes one SDK instance. The legacy dynamically generated `/legacy` page is not changed in this minimal option.

### B. New `public/js/guance-rum.js`

```javascript
/* Solution 1: Guance RUM via the official CDN, loaded asynchronously.
 * This file is separate from the customer's custom /js/rum.js.
 */
(function (window, document) {
  'use strict';
  // Queue configuration until the CDN SDK has finished loading.
  window.DATAFLUX_RUM = window.DATAFLUX_RUM || {
    q: [], onReady: function (callback) { this.q.push(callback); }
  };
  var sdk = document.createElement('script');
  sdk.async = true; // Do not block HTML parsing while downloading the RUM SDK.
  sdk.src = 'https://static.guance.com/browser-sdk/v3/dataflux-rum.js';
  document.head.appendChild(sdk);
  window.DATAFLUX_RUM.onReady(function () {
    window.DATAFLUX_RUM.init({
      applicationId: 'CCG_S1_APM_RUM', // Created in the Hong Kong workspace.
      datakitOrigin: window.location.origin, // Same-origin receiver; no token in HTML.
      service: 'ccg-s1-web', env: 'poc', version: 's1-1.0.0',
      sessionSampleRate: 100, // PoC only; choose a production sampling policy later.
      sessionReplaySampleRate: 0, // Basic RUM only in Solution 1.
      trackUserInteractions: true,
      allowedTracingUrls: [window.location.origin + '/'], // Match this application only.
      traceType: 'w3c_traceparent', tracingSampleRate: 100 // Propagate to Beacon.
    });
  });
})(window, document);
```

The queue avoids calling `init` before the CDN download completes. `allowedTracingUrls` and `traceType` cause matching Fetch/XHR requests to carry W3C Trace Context; Beacon continues the same Trace. The async SDK may miss requests/errors that occur before initialization, especially the first Fetch on a freshly opened page. Interact after initialization or use the existing reload button to verify association. Ordinary full-document navigation does not inject custom `traceparent` headers.

This SDK is separate from the customer's existing `window.RUM` helper. Its random application-local IDs are not used as Guance trace IDs. Session Replay is intentionally disabled in this basic option.

### C. New systemd drop-in from `beacon.conf`

```ini
# systemd drop-in: /etc/systemd/system/ccg-poc.service.d/observability.conf
[Service]
# Preload before Express and mssql are imported; no manual request/SQL spans.
Environment="NODE_OPTIONS=--require @beacon-observability/nodejs/register"
Environment="OTEL_SERVICE_NAME=ccg-s1-api"
Environment="OTEL_RESOURCE_ATTRIBUTES=env=poc,version=s1-1.0.0,service.version=s1-1.0.0,host.name=CCG-Mock-APM,solution=s1"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317"
Environment="OTEL_EXPORTER_OTLP_PROTOCOL=grpc"
Environment="OTEL_PROPAGATORS=tracecontext,baggage"
Environment="OTEL_TRACES_EXPORTER=otlp"
Environment="OTEL_TRACES_SAMPLER=always_on"
Environment="OTEL_NODE_ENABLED_INSTRUMENTATIONS=http,express,tedious"
# Explicitly disable metrics, logs and profiling for this APM/RUM-only baseline.
Environment="OTEL_METRICS_EXPORTER=none"
Environment="OTEL_LOGS_EXPORTER=none"
Environment="OTEL_PROFILING_ENABLED=false"
Environment="OTEL_LOG_LEVEL=warn"
```

The agent loads **before** Express and the mssql/tedious modules. HTTP, Express and tedious are automatically instrumented. No new code surrounds an HTTP handler or a database query. Startup/environment changes require a service restart.

### D. Nginx RUM receiver: add one exact location

```nginx
# Same-origin browser reporting; the full DataKit HTTP API stays private.
location = /v1/write/rum {
    proxy_pass http://127.0.0.1:9529;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 10m;
}
```

Nginx is a reverse proxy in this option, **without its own Trace Span**. No browser reporting token or management API key is embedded in the HTML because RUM is forwarded to the local DataKit receiver.

## Deployment and parameter sources

| Parameter | This deployment | Where a customer gets it |
| --- | --- | --- |
| Workspace | Hong Kong `chinachemgroup_poc` | Workspace selector in the Hong Kong console |
| Workspace UUID | `wksp_faa5a204057f423a978e63942e3dc442` | Console URL / workspace settings |
| DataWay URL | `https://cn6-openway.guance.one?token=<WORKSPACE_TOKEN>` | Integrations → DataKit → select gateway and Token → Copy installation command |
| `applicationId` | `CCG_S1_APM_RUM` | RUM → Create Web App → App ID |
| App display name | `CCG S1 - APM and RUM` | Assigned during app creation |
| Browser service | `ccg-s1-web` | Operator-chosen, set in the bootstrap |
| Backend service | `ccg-s1-api` | Operator-chosen, set by `OTEL_SERVICE_NAME` |
| `env`, `version` | `poc`, `s1-1.0.0` | Deployment identity; keep RUM and APM consistent |
| Public origin | `http://150.5.141.233` | Actual URL visited by users; bootstrap reads `window.location.origin` |
| OTLP endpoint | `http://127.0.0.1:4317` | Local DataKit OpenTelemetry receiver |
| MSSQL configuration | `/etc/ccg-mssql/app.env` | Existing baseline database credentials; not changed by this solution |

On the already deployed Ubuntu/Node/MSSQL baseline, place the target DataWay URL into `/etc/ccg-observability/dataway.url` (root only, mode 600). It is a **reporting URL**, not the Owl/API query credential. Deploy the branch under `/opt/ccg-poc/NodeJS_MSSQL`, then run:

```bash
sudo bash /opt/ccg-poc/NodeJS_MSSQL/observability/solution-1/deploy.sh
```

`configure-datakit.py` stops DataKit, preserves prior workspace WAL and configurations under `/root/ccg-observability-backups`, changes the reporting destination, disables default inputs, and installs only OpenTelemetry/RUM inputs. It must be run on the dedicated PoC host, not a shared collector without reviewing its impact. Existing data is not replayed into a different workspace. APM-derived metrics, OTel metrics/log exporters and profiling are disabled. Application and Nginx local logs may still exist, but they are **not collected or reported** in this option. The customer's `/api/metrics` remains a business endpoint; tracing this URL does not enable metric collection.

Verify `systemctl is-active ccg-poc datakit nginx`, `/api/health` (`data_mode=mssql`, `db.up=true`), and a sales-page reload after the CDN SDK initializes. SQL Server remains localhost-only. The baseline uses a self-signed SQL Server certificate trusted by the local test application; use the customer's certificate policy outside this PoC.

## Verified results in the target workspace

Requested query window: **2026-11-21T09:24:48.481000+08:00 to 2026-11-21T09:34:48.481000+08:00**. Domain/source discovery and each DQL were validated before execution. These are bounded samples, not a long-term reliability conclusion.

- Fifteen functional HTTP checks passed, including MSSQL health, the sales/document pages, both data lists and all eight document-detail APIs. See [function-check.json](evidence/function-check.json).
- App `CCG_S1_APM_RUM`: View, Resource, Action, Session and Long Task records were returned.
- Both `ccg-s1-web` and `ccg-s1-api` are present in APM; `execSql properties` is independently visible.
- Example correlated Trace: `472f3fc6e7a4d6f25411f51994fea04d`; the backend HTTP parent is the browser Span `5411f51994fea04d`. The same Trace includes tedious SQL spans.
- Browser session: `29f5e49a-2620-4da7-aca9-e821ce054fb4`.
- Query for logs under the two solution services returned count 0. CPU data under `solution=s1` returned no samples; host input files and default inputs are disabled. This is a scoped negative check, not a claim that this shared workspace has no other customers' metrics.
- DataKit has only `datakit.conf`, `opentelemetry.conf` and `rum.conf` active at the top-level input directory.

Machine-readable evidence is in [evidence](evidence). Observation-point architecture is editable, and the pre-integration architecture is retained for comparison.

## References

- [Beacon Node.js automatic instrumentation](https://docs.guance.com/en/beacon/nodejs/)
- [Web RUM integration: CDN async](https://docs.guance.com/real-user-monitoring/web/app-access/)
- [DataKit OpenTelemetry receiver](https://docs.guance.com/integrations/opentelemetry/)
