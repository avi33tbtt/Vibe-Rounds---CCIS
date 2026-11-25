import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_FILE = join(ROOT, 'index.html');
const VIEWER_FILE = join(ROOT, 'ccis-viewer.html');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

const ROUTES = new Map([
  ['/', APP_FILE],
  ['/index.html', APP_FILE],
  ['/ccis-viewer.html', VIEWER_FILE],
]);

const server = createServer(async (req, res) => {
  let pathname;

  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  if (pathname === '/healthz') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({
      status: 'ok',
      service: 'ccis-web',
    }));
  }

  const file = ROUTES.get(pathname);
  if (!file) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end('Not Found');
  }

  try {
    const html = await readFile(file);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    return res.end(req.method === 'HEAD' ? undefined : html);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error(`Required page is missing: ${file}`);
      res.writeHead(503, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      return res.end(
        pathname === '/' || pathname === '/index.html'
          ? 'CCIS app has not been built. Run: npm run build:app'
          : 'Viewer temporarily unavailable'
      );
    }

    console.error(error);
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    return res.end('Page temporarily unavailable');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CCIS server listening on port ${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
