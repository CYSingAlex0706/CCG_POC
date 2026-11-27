# 华懋 Kubernetes 测试环境验收

[English](validation.en.md) · [部署说明](../README.zh-CN.md)

2026-11-27 北京时间 14:30–14:31。部署提交为 6ecd7fd，集群为 测试环境的单节点 K3s，命名空间为 ccg-test，目标为香港 chinachemgroup_poc 工作空间。

| 项目 | 验收证据 |
| --- | --- |
| 应用与数据库 | Web Pod 1/1、SQL Server Pod 1/1。Service 转发至 Node.js 8080。公网健康检查确认 MSSQL 模式且数据库在线。浏览器文档查询返回 HTTP 200 和 8 条记录。 |
| 页面覆盖 | 首页、销售页、物业页、文档页、动态 /legacy 页的源文件各有一个指向官方 CDN 的 async script 标签，五个公网入口均已检查。Kustomize 直接挂载仓库内的页面及模板，Pod 的唯一初始化容器用于 Beacon。 |
| 会话重放 | 采样 100%。Chrome 中 isRecording() 为 true，重放上报 HTTP 200。Owl 在 CCG_K8S_MSSQL 中查到同一会话的重放分片及 session_has_replay=1 的 View。 |
| 输入脱敏 | 在该测试会话中键入合成字符串，检查解压后的实际重放分片。测试 input 节点的 value 为三个星号，分片中未出现测试字符串明文。 |
| 前后端关联 | RUM 文档 Resource 的 trace_id 与 Beacon HTTP、Express 和 SQL Server 的一致。HTTP span 的 parent_id 等于浏览器 span_id。Express 文档处理器下有两个 execSql properties span。 |

云端验收会话为 `e8e8fe2c-8118-4c8e-a43b-32a043cc5767`，Trace ID 为 `4df002a0b1c80aed2afd2b92cccd7ae2`，浏览器 Span 为 `2afd2b92cccd7ae2`。

使用香港华懋 Owl 配置，对 RUM 会话、View、Resource、session_replay 及 APM Trace 做校验后的只读查询。自动化浏览器通过 SSH 转发访问该集群，所以这条 Resource 的 URL 显示 127.0.0.1；公网 HTTP 另行核验。
