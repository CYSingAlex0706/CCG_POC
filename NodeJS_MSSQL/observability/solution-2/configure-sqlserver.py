"""Create a dedicated read-only monitoring login without exposing its password."""
from pathlib import Path
import secrets,subprocess
p=Path('/etc/ccg-mssql');f=p/'monitor-s2.password'
if not f.exists():f.write_text('CcG!'+secrets.token_hex(18));f.chmod(0o600)
pwd=f.read_text()
sql=f"""IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name=N'guance_monitor_s2')
CREATE LOGIN guance_monitor_s2 WITH PASSWORD=N'{pwd}';
GRANT VIEW SERVER STATE TO guance_monitor_s2;
GRANT VIEW SERVER PERFORMANCE STATE TO guance_monitor_s2;
GRANT VIEW ANY DEFINITION TO guance_monitor_s2;
GO
USE properties;
IF USER_ID(N'guance_monitor_s2') IS NULL CREATE USER guance_monitor_s2 FOR LOGIN guance_monitor_s2;
GRANT VIEW DATABASE STATE TO guance_monitor_s2;
GO
"""
# Send SQL through stdin, not a command argument or a world-readable file.
command='SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b'
subprocess.run(['docker','exec','-i','-u','0','ccg-mssql-db','sh','-c',command],input=sql,text=True,check=True,stdout=subprocess.DEVNULL)
conf=Path('/usr/local/datakit/conf.d/ccg-s2-sqlserver.conf')
conf.write_text(f'''[[inputs.sqlserver]]
  host = "127.0.0.1:1433"
  user = "guance_monitor_s2"
  password = "{pwd}"
  database = "properties"
  connection_parameters = "encrypt=true&TrustServerCertificate=true"
  interval = "15s"
  election = false
  measurement_version = "v2"
  [inputs.sqlserver.object]
    enabled = false
  [inputs.sqlserver.dbm]
    enabled = false
  [inputs.sqlserver.tags]
    service = "ccg-s2-sqlserver"
    solution = "s2"
    env = "poc"
    version = "s2-1.0.0"
''');conf.chmod(0o600)
print('Dedicated SQL Server metrics login configured; password omitted.')
