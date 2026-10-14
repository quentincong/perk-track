'use strict';
// Development only. Serve the public app assets, never the repository or ledger files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assets = new Map([
  ['/index.html', 'text/html; charset=utf-8'],
  ['/styles.css', 'text/css; charset=utf-8'],
  ...['core.js', 'reports.js', 'github.js', 'app.js'].map(f => [`/${f}`, 'text/javascript; charset=utf-8'])
]);
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://127.0.0.1').pathname.replace(/^\/$/, '/index.html');
  if (!['GET', 'HEAD'].includes(req.method) || !assets.has(file)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const content = fs.readFileSync(path.join(__dirname, '..', file));
  res.writeHead(200, { 'Content-Type': assets.get(file), 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : content);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(8765, '127.0.0.1', () => console.log('Perk Track: http://127.0.0.1:8765 (Ctrl+C to stop)'));
