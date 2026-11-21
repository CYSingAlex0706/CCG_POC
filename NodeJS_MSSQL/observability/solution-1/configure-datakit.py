"""Select the target workspace and APM/RUM-only inputs; do not embed secrets."""
from pathlib import Path
import re, shutil, datetime, subprocess
from urllib.parse import urlparse
source = Path(__file__).resolve().parent
conf = Path('/usr/local/datakit/conf.d')
url = Path('/etc/ccg-observability/dataway.url').read_text().strip()
assert urlparse(url).scheme == 'https' and 'token=' in url
backup = Path('/root/ccg-observability-backups') / ('s1-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
subprocess.run(['systemctl', 'stop', 'datakit'], check=True)
# Preserve previous queued data instead of delivering it to a different workspace.
wal = Path('/usr/local/datakit/cache/dw-wal')
if wal.exists(): shutil.move(str(wal), str(backup / 'previous-workspace-wal'))
for f in conf.glob('*.conf'):
    if f.name != 'datakit.conf': shutil.move(str(f), str(backup / f.name))
f = conf / 'datakit.conf'; shutil.copy2(f, backup / f.name)
s = f.read_text()
s = re.sub(r'^default_enabled_inputs = .*$', 'default_enabled_inputs = []', s, flags=re.M)
s = re.sub(r'(?m)^(\s*urls\s*=).*$', lambda _: '  urls = ["' + url + '"]', s)
s = re.sub(r'(?m)^  project = .*$', '  project = "ccg-poc"', s)
s = re.sub(r'(?m)^  solution = .*\n', '', s)
s = s.replace('[global_host_tags]', '[global_host_tags]\n  solution = "s1"')
f.write_text(s); f.chmod(0o600)
for n in ['opentelemetry.conf', 'rum.conf']: shutil.copy2(source / n, conf / n)
print('Target DataWay configured; only OpenTelemetry and RUM inputs are enabled.')
