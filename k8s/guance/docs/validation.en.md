# Kubernetes test deployment validation

[中文驗收記錄](validation.zh-CN.md) · [Deployment guide](../README.md)

Verified on 27 November 2026, 14:30–14:31 Hong Kong time, on a single-node K3s cluster running application integration commit `6ecd7fd` in namespace `ccg-test`. The destination was the Hong Kong Guance workspace `chinachemgroup_poc`.

| Check | Observed result |
| --- | --- |
| Application and SQL Server | Web and SQL Pods each reported 1/1 ready. The Service routed to Node.js on 8080. Public HTTP health reported MSSQL mode with a healthy database. The browser retrieved eight documents with HTTP 200. |
| HTML coverage | The home, sales, property, document and dynamic legacy pages each contained one asynchronous CDN SDK tag. The sole application init container installed Beacon. |
| Session replay | Chrome reported active recording. Replay uploads returned HTTP 200. Workspace queries found replay segments and a View with session_has_replay=1. |
| Input privacy | A synthetic value was typed into a test input. In the decoded replay payload, the field contained three asterisks and the test value was absent. |
| Trace correlation | The RUM document Resource, the Beacon HTTP span, the Express handler and two SQL client spans shared the trace ID below. The HTTP span's parent ID matched the browser span ID. |

- RUM application: `CCG_K8S_MSSQL`
- Session: `e8e8fe2c-8118-4c8e-a43b-32a043cc5767`
- Trace: `4df002a0b1c80aed2afd2b92cccd7ae2`
- Browser span: `2afd2b92cccd7ae2`

The browser used an SSH tunnel to the test Service, so its Resource URL shows 127.0.0.1. The public HTTP entry was tested separately. Read-only workspace queries verified the recorded session, View, Resource, replay and APM data. To reproduce the checks after this data ages out, open a fresh browser session and follow the deployment guide.
