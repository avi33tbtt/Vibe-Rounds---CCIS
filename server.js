import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VIEWER_FILE = join(ROOT, 'ccis-viewer.html');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'ccis-web' }));
  }

  if (!['/', '/index.html', '/ccis-viewer.html'].includes(pathname)) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  try {
    const html = await readFile(VIEWER_FILE);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end('Viewer temporarily unavailable');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CCIS server listening on port ${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());