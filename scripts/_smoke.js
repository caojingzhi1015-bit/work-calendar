// 冒烟测试：起本地静态服务，检查关键资源可访问
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const paths = ['/index.html', '/app.js', '/style.css', '/data/daily.json', '/manifest.webmanifest', '/sw.js', '/icon.svg'];

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(8123, async () => {
  let ok = 0, bad = 0;
  for (const p of paths) {
    try {
      const r = await fetch('http://127.0.0.1:8123' + p);
      const t = await r.text();
      if (r.status === 200 && t.length > 0) { ok++; console.log('OK  ', p, t.length + 'B'); }
      else { bad++; console.log('FAIL', p, r.status); }
    } catch (e) { bad++; console.log('ERR ', p, e.message); }
  }
  // 检查 index.html 关键节点
  const html = await (await fetch('http://127.0.0.1:8123/index.html')).text();
  const need = ['id="monthPick"', 'id="btnAI"', 'id="dropzone"', 'app.js', 'style.css'];
  need.forEach((n) => { if (!html.includes(n)) { bad++; console.log('MISSING in html:', n); } else ok++; });
  console.log(`--- ${ok} ok / ${bad} bad ---`);
  server.close();
  process.exit(bad ? 1 : 0);
});
