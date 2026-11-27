"""Configure full-stack inputs on this dedicated PoC host, preserving secrets."""
from pathlib import Path
import re, shutil, datetime, subprocess
source = Path(__file__).resolve().parent
conf = Path('/usr/local/datakit/conf.d')
backup = Path('/root/ccg-observability-backups') / ('s2-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
subprocess.run(['systemctl', 'stop', 'datakit'], check=True)
for f in conf.glob('*.conf'):
    if f.name != 'datakit.conf': shutil.move(str(f), str(backup / f.name))
f=conf/'datakit.conf';shutil.copy2(f,backup/f.name);s=f.read_text()
inputs=['cpu','mem','disk','diskio','net','system','host_processes','hostobject','container']
import json
s=re.sub(r'^default_enabled_inputs = .*$', 'default_enabled_inputs = '+json.dumps(inputs),s,flags=re.M)
url=Path('/etc/ccg-observability/dataway.url').read_text().strip()
s=re.sub(r'(?m)^(\s*urls\s*=).*$',lambda _: '  urls = ["'+url+'"]',s)
s=re.sub(r'(?m)^  solution = .*\n','',s)
s=s.replace('[global_host_tags]','[global_host_tags]\n  solution = "s2"')
f.write_text(s);f.chmod(0o600)
for name in inputs:
    if name != 'container':shutil.copy2(conf/'samples'/(name+'.conf.sample'),conf/(name+'.conf'))
for name in ['opentelemetry.conf','logging.conf','container.conf']:
    shutil.copy2(source/name,conf/name)
shutil.copy2(source/'nginx-metrics.conf',conf/'ccg-s2-nginx.conf')
print('Full-stack inputs installed for the target workspace; database credentials are configured separately.')
