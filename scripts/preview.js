#!/usr/bin/env node
// Preview the static site locally: node scripts/preview.js  ->  http://localhost:5178
const http = require('http');
const fs = require('fs');
const path = require('path');
const DOCS = path.join(__dirname, '..', 'docs');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = +process.env.PORT || 5178;
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(DOCS, p.endsWith('/') ? p + 'index.html' : p));
  if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Xem trước: http://localhost:${port}`));
