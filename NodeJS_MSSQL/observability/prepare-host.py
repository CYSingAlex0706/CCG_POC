from pathlib import Path
import secrets
p=Path('/etc/ccg-mssql');p.mkdir(mode=0o700,exist_ok=True)
for name in ['sa','app','monitor']:
 f=p/(name+'.password')
 if not f.exists():f.write_text('CcG!'+secrets.token_hex(18));f.chmod(0o600)
sa=(p/'sa.password').read_text();app=(p/'app.password').read_text();monitor=(p/'monitor.password').read_text()
(p/'docker.env').write_text(f'ACCEPT_EULA=Y\nMSSQL_PID=Developer\nMSSQL_SA_PASSWORD={sa}\nMSSQL_MEMORY_LIMIT_MB=2048\n');(p/'docker.env').chmod(0o600)
(p/'app.env').write_text(f'APP_ENV=poc\nPORT=8080\nDB_HOST=127.0.0.1\nDB_PORT=1433\nDB_NAME=properties\nDB_USER=ccg_app\nDB_PASSWORD={app}\nDB_ENCRYPT=1\nDB_TRUST_SERVER_CERT=1\n');(p/'app.env').chmod(0o600)
(p/'init.sql').write_text(f"IF DB_ID(N'properties') IS NULL CREATE DATABASE properties;\nGO\nIF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name=N'ccg_app') CREATE LOGIN ccg_app WITH PASSWORD=N'{app}';\nIF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name=N'guance_monitor') CREATE LOGIN guance_monitor WITH PASSWORD=N'{monitor}';\nGRANT VIEW SERVER STATE TO guance_monitor;\nGRANT VIEW SERVER PERFORMANCE STATE TO guance_monitor;\nGRANT VIEW ANY DEFINITION TO guance_monitor;\nGO\nUSE properties;\nIF DATABASE_PRINCIPAL_ID(N'ccg_app') IS NULL CREATE USER ccg_app FOR LOGIN ccg_app;\nALTER ROLE db_datareader ADD MEMBER ccg_app;\nIF DATABASE_PRINCIPAL_ID(N'guance_monitor') IS NULL CREATE USER guance_monitor FOR LOGIN guance_monitor;\nGRANT VIEW DATABASE STATE TO guance_monitor;\nGO\n");(p/'init.sql').chmod(0o600)
Path('/usr/local/datakit/conf.d/ccg-sqlserver.conf').write_text(f'''[[inputs.sqlserver]]
  host = "127.0.0.1:1433"
  user = "guance_monitor"
  password = "{monitor}"
  database = "properties"
  connection_parameters = "encrypt=true&TrustServerCertificate=true"
  interval = "15s"
  election = false
  measurement_version = "v2"
  [inputs.sqlserver.tags]
    service = "ccg-mssql-db"
    env = "poc"
    project = "CCG_POC"
''');Path('/usr/local/datakit/conf.d/ccg-sqlserver.conf').chmod(0o600)
