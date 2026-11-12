const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { securityHeaders } = require('./security-headers.cjs');
const root = path.resolve(process.env.SITE_DIR || 'dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
http.createServer((req, res) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.includes('\0')) throw new Error('Null byte in path');
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('Outside site');
    fs.readFile(file, (error, data) => {
      const contentType = error ? 'text/plain; charset=utf-8' : types[path.extname(file)] || 'application/octet-stream';
      res.writeHead(error ? 404 : 200, { 'Content-Type': contentType });
      res.end(error ? 'Not found' : data);
    });
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid path');
  }
}).listen(4173, '127.0.0.1', () => console.log('Site available at http://127.0.0.1:4173'));
