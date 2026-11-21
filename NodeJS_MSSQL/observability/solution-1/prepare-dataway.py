from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import json
p=Path('/etc/ccg-observability')
u=urlsplit((p/'dataway.url').read_text().strip())
assert u.scheme=='https' and u.netloc=='cn6-openway.guance.one'
token=parse_qs(u.query)['token'][0]
f=p/'s1-otlp.env';f.write_text('OTEL_EXPORTER_OTLP_HEADERS=X-Token='+token+'\n');f.chmod(0o600)
client=(p/'s1-rum-client-token').read_text().strip()
assert client and not client.startswith('tkn_')
app=Path('/opt/ccg-poc/NodeJS_MSSQL')
(app/'public/js/guance-rum-config.js').write_text('window.CCG_RUM_CLIENT_TOKEN = '+json.dumps(client)+';\n')
print('Backend secret and browser-scoped configuration generated; values omitted.')
