"""Generate local credentials and Rumable runtime configuration; never print tokens."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import json
p=Path('/etc/ccg-observability')
u=urlsplit((p/'dataway.url').read_text().strip())
assert u.scheme=='https' and u.netloc=='cn6-openway.guance.one'
token=parse_qs(u.query)['token'][0]
f=p/'s2-otlp.env';f.write_text('OTEL_EXPORTER_OTLP_HEADERS=X-Token='+token+'\n');f.chmod(0o600)
client=(p/'s2-rum-client-token').read_text().strip()
assert client and not client.startswith('tkn_')
s=Path(__file__).with_name('rumable.toml').read_text().replace('"__RUM_CLIENT_TOKEN__"',json.dumps(client))
d=Path('/etc/rumable');d.mkdir(exist_ok=True)
f=d/'ccg-s2.toml';f.write_text(s);f.chmod(0o600)
print('Backend environment and browser reporting config generated; tokens omitted.')
