# Node.js MSSQL 全栈可观测部署

本目录提供 CCG NodeJS_MSSQL Demo 的主机部署配置。应用运行在 Node.js 24，SQL Server 2022 Developer 运行在 Docker，Nginx 代理至 8080。Beacon 2.0.2 采集 HTTP、Express、tedious 数据库调用和 Node.js 运行时指标，Rumable 0.1.11 注入 Web RUM，DataKit 2.19.1 统一上报。

## 参数获取

| 参数 | 获取位置 |
| --- | --- |
| DataKit DataWay URL | 目标工作空间「集成 → DataKit」安装命令，沿用服务器已有配置 |
| RUM applicationId | 目标空间 Web 应用的接入代码，本次为 CCG |
| 网站 origin | 访客实际访问地址，本次 http://150.5.141.233 |
| DB_HOST 与 DB_PORT | 本次同机数据库映射 127.0.0.1:1433 |
| DB_NAME | 本次初始化创建 properties |
| DB_USER 与 DB_PASSWORD | prepare-host.py 创建 ccg_app 登录与随机密码，写入 /etc/ccg-mssql/app.env |
| 监控数据库账号 | prepare-host.py 创建 guance_monitor，仅授予查询监控所需的查看权限 |
| SQL Server SA 密码 | 首次运行 prepare-host.py 随机生成，写入 /etc/ccg-mssql/sa.password，后续运行沿用 |
| 服务名 | Beacon 使用 ccg-mssql，数据库指标使用 ccg-mssql-db，网关使用 guance-poc-nginx |
| env、version、host.name | 部署环境、发布版本和 hostname，编辑 beacon.conf 时替换 |
| Owl 查询凭据 | 目标空间或个人账号授权，本次使用杭州 haiming测试空间的本机 Owl 配置 |

## 从空白主机准备基础组件

建议使用 Ubuntu x86_64、至少 8 GB 内存；本次部署为应用与数据库同机 PoC。使用 Node.js 官方发行版安装 Node.js 24，确认 `node --version` 和 `npm --version`；服务单元使用 `/usr/local/bin/node`，若安装路径不同须修改 `ccg-mssql.service` 的 ExecStart。服务账号需要对应用目录有读取权限。

1. 在**目标空间**「集成 → DataKit」复制 Linux 安装命令执行，核对命令中的 DataWay 对应目标空间。安装流程见 [DataKit 官方文档](https://docs.guance.com/datakit/datakit-install/)。凭据保留在主机配置中，不提交 Git。
2. 由官方 Nginx 软件源安装 Nginx 与匹配版本的 `nginx-module-otel`，在 `nginx.conf` 的 main 上下文加载模块。本次版本为 Nginx 1.30.7、ngx_otel_module 0.1.2；不要混用 Ubuntu 自带二进制与其他版本模块。参照 [Nginx 官方 OpenTelemetry 模块](https://nginx.org/en/docs/ngx_otel_module.html)。确认 `nginx -V` 含 http_sub_module。
3. 从 [Rumable 官方文档](https://docs.guance.com/beacon/rumable/) 的 Releases 安装 0.1.11；本文命令假设可执行文件为 `/opt/rumable/0.1.11/rumable`。在目标空间创建 Web RUM 应用，复制 applicationId。
4. DataKit 启用 cpu、mem、disk、net、host_processes、container 采集器：从安装目录 `conf.d/samples` 复制相应模板到 `conf.d`，按实际主机调整后重启。container 需要读取 Docker socket。主机名与 `beacon.conf`、Nginx 的 host.name 应一致。

## 首次部署

以下步骤适用于已有 Nginx、DataKit、Rumable、Node.js 24 的 Ubuntu 主机。完整的采集器模板与服务配置位于本目录。客户按实际应用路径、账号、域名调整。

```bash
sudo -i
apt-get update
apt-get install -y docker.io
systemctl enable --now docker
mkdir -p /opt/ccg-poc
# 将仓库的 NodeJS_MSSQL 目录部署到 /opt/ccg-poc/NodeJS_MSSQL
cd /opt/ccg-poc/NodeJS_MSSQL
npm ci --omit=dev
python3 observability/prepare-host.py

docker pull mcr.microsoft.com/mssql/server:2022-latest
docker run -d --name ccg-mssql-db --restart unless-stopped \
  --env-file /etc/ccg-mssql/docker.env --memory 3g \
  -p 127.0.0.1:1433:1433 \
  -v ccg-mssql-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest
```

本次使用 Developer 版本，用于演示测试。客户生产环境应使用相应授权版本。部署报告记录实际镜像摘要，复现时可按摘要固定镜像。

等待 SQL Server 日志显示可接受客户端连接，再执行初始化。SQLCMDPASSWORD 从容器已有环境读取，命令输出不包含密码。

```bash
docker logs --tail 30 ccg-mssql-db
docker cp /etc/ccg-mssql/init.sql ccg-mssql-db:/tmp/init.sql
docker cp db/MMSQL.sql ccg-mssql-db:/tmp/schema.sql
docker exec -u 0 ccg-mssql-db sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -i /tmp/init.sql'
docker exec -u 0 ccg-mssql-db sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -d properties -i /tmp/schema.sql'
```

脚本保留已生成密码，数据库和表的初始化支持重复执行。数据库存储在具名卷 ccg-mssql-data，容器重启后保留。

## 启用链路 指标与日志

复制本目录 `opentelemetry.conf`、`rum.conf` 到 `/usr/local/datakit/conf.d/`。不要同时保留另一个启用的同类采集配置。OTLP gRPC 仅监听 127.0.0.1:4317，DataKit HTTP 9529 保持本机访问，由 Nginx 仅转发 RUM 路由。`tracing_metric_enable=true` 生成链路统计指标，`split_service_name=false` 保持数据库出口 Span 的服务名为应用服务。

Rumable 使用本目录 rumable.toml，替换 publicURL、datakitOrigin、allowedTracingUrls 为客户浏览器实际可达的站点 origin；HTTPS 站点应使用 HTTPS 同源接收地址。隐私级别 mask-user-input 保留普通内容、遮盖表单输入。100% 采样是本次 PoC 参数，客户可按采样目标调整。

```bash
id guance-poc || useradd --system --shell /usr/sbin/nologin guance-poc
mkdir -p /var/log/ccg-mssql /etc/systemd/system/ccg-mssql.service.d
chown guance-poc:guance-poc /var/log/ccg-mssql
cp observability/ccg-mssql.service /etc/systemd/system/
cp observability/beacon.conf /etc/systemd/system/ccg-mssql.service.d/
cp observability/logging.conf /usr/local/datakit/conf.d/ccg-logging.conf
cp observability/logrotate.conf /etc/logrotate.d/ccg-mssql
systemctl daemon-reload
systemctl restart datakit
systemctl enable --now ccg-mssql
curl -f http://127.0.0.1:8080/health
```

prepare-host.py 同时写入 DataKit sqlserver 采集器，数据库监控密码文件权限为 600。本次应用日志输出至 /var/log/ccg-mssql/application.log，SQL Server 错误日志来自具名卷 log/errorlog。DataKit container 采集器可采集数据库容器的资源和标准输出。

配置 Nginx：将 `nginx-tracing.conf` 放入 `/etc/nginx/conf.d/`，将 `nginx-tracing-location.conf` 放入 `/etc/nginx/guance-poc-tracing-location.conf`。以 `nginx-site.conf` 为站点模板，在 http 上下文 include；已有站点应合并对应路由，避免重复 server/location。应用上游为 127.0.0.1:8080。

将修改后的 rumable.toml 保存为 `/etc/rumable/guance-poc.toml`，先运行 `rumable attach --help`/官方文档核对版本参数，再运行以下配置流程。Rumable 会生成 SDK 资源与 Nginx 注入片段，无需修改 HTML 源文件。

```bash
/opt/rumable/0.1.11/rumable setup --config /etc/rumable/guance-poc.toml --state-dir /var/lib/rumable --yes
/opt/rumable/0.1.11/rumable status --state-dir /var/lib/rumable --site guance-poc
/opt/rumable/0.1.11/rumable probe --config /etc/rumable/guance-poc.toml --state-dir /var/lib/rumable --site guance-poc
```

`setup` 仅配置 RUM。Nginx Trace 采用本目录模板配置；请在执行前备份现有站点，并检查生成片段的挂载位置。

```bash
nginx -t
systemctl reload nginx
```

## 验收

- `/` 返回 8 条文档，全部 `/document/1` 至 `/document/8` 可访问。
- `/health` 返回数据库 up=true。
- `/?faildb=1` 返回 500，下一次正常请求恢复。
- POST `/chaos/db/on` 开启持续故障，POST `/chaos/db/off` 恢复。此功能仅用于授权的演示环境。
- 观测云 APM 筛选 service=ccg-mssql，查看 tedious 数据库 Span，按同一 Trace ID 检查 Nginx 与 RUM。
- 指标查询查看 otel_service、tracing_metrics、sqlserver_metric 和主机、容器指标，具体字段以当前采集版本为准。
- 日志查看 source=ccg-mssql-app 和 ccg-mssql-db，应用日志包含 trace_id 与 span_id。
- 浏览器新会话验证 CCG 的 View、Resource 和会话重放入库。

## 运维

```bash
systemctl status ccg-mssql
tail -n 30 /var/log/ccg-mssql/application.log
docker logs --tail 30 ccg-mssql-db
systemctl restart ccg-mssql
```

回滚网站入口可恢复 Nginx 备份中的原 proxy_pass 并 reload。本次旧 SQLite Demo 服务保留作为回退入口。保留 SQL Server 数据卷和 /etc/ccg-mssql 密钥文件，配置变更后重新验证健康检查与数据库链路。

## 前后端关联复现步骤

原项目详情链接采用整页跳转。RUM 自动注入 Trace Context 的验证入口为 Fetch/XHR，并非宣称所有整页导航都能发送自定义 traceparent。

1. 浏览器打开站点，等待 RUM SDK 加载。在开发者工具 Console 执行 `fetch('/document/2').then(r => r.text())`，再执行 `fetch('/?faildb=1').then(r => r.text())`；这两条是验收操作，不需要写进业务源码。
2. Network 中确认这些请求有 traceparent。观测云 CCG 的 Resource 详情可跳转关联链路；链路应包含 guance-poc-web、guance-poc-nginx、ccg-mssql、execSql properties。
3. 点击 Node.js Span 的关联日志，检查 trace_id 一致；无活动 Span 的启动日志可以没有 trace_id。
4. 同一时间范围按 host=CCG-Mock-APM 查看主机、SQL Server、容器指标。Node OTLP 指标使用 service_name=ccg-mssql，APM/日志使用 service=ccg-mssql。数据库指标 service=ccg-mssql-db；这是服务维度映射，不是逐条指标附带 Trace ID。
5. 在 CCG 会话重放中打开刚生成的会话并播放，确认普通页面内容可见。原页面没有可输入表单，输入遮盖依据 SDK 的 mask-user-input 策略；若客户要验收其自有表单，应在测试表单输入非敏感标记后回放核对。

详细结果与真实控制台截图见 [部署验收报告](部署验收报告.md)，源码改动见 [代码改动说明](代码改动说明.md)。
