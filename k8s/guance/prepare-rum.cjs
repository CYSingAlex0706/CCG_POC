// Prepare files from this release's application image for read-only mounts.
const fs = require('node:fs');
const path = require('node:path');
const output = '/prepared';
const assets = path.join(output, 'public');
fs.cpSync('/app/public', assets, { recursive: true });

const token = fs.readFileSync('/browser/client-token', 'utf8').trim();
if (!/^[0-9a-f]{32}$/i.test(token)) throw Error('Invalid RUM client token');
fs.mkdirSync(path.join(assets, '_guance'), { recursive: true });
const loader = fs.readFileSync('/config/rum.js', 'utf8').replace('__CLIENT_TOKEN__', token);
fs.writeFileSync(path.join(assets, '_guance/rum.js'), loader);

function addLoader(source, destination, marker) {
  const body = fs.readFileSync(source, 'utf8');
  if (body.split(marker).length !== 2) throw Error('Expected one HTML head in ' + source);
  fs.writeFileSync(destination, body.replace(marker, marker + '<script src="/_guance/rum.js"></script>'));
}
for (const name of fs.readdirSync(assets).filter(name => name.endsWith('.html'))) {
  const file = path.join(assets, name);
  addLoader(file, file, '<head>');
}
// Express renders /legacy from this inline template. Preserve its relative imports.
addLoader('/app/src/server.js', path.join(output, 'server.js'), '<html lang="en"><head>');
