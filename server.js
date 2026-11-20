import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './src/index.js';
import { api as mockApi } from './web/src/mockapi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const distDir = path.join(__dirname, 'dist');
const useSupabase = !!(
  process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes('YOUR-PROJECT') &&
  process.env.SUPABASE_SERVICE_KEY
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const urlPath = (req.url || '/').split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const candidate = path.resolve(distDir, '.' + decoded);
  if (candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(candidate).pipe(res);
    return;
  }

  const indexFile = path.join(distDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexFile).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

async function start() {
  let vite = null;
  if (!isProd) {
    const { createServer } = await import('vite');
    vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
  }

  const server = http.createServer(async (req, res) => {
    const reqUrl = req.url || '/';
    const pathname = reqUrl.split('?')[0];

    if (pathname.startsWith('/api/')) {
      try {
        const raw = req.method === 'POST' ? await readRawBody(req) : undefined;
        if (useSupabase) {
          const proto = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || `${HOST}:${PORT}`;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
          }
          const wReq = new Request(`${proto}://${host}${reqUrl}`, {
            method: req.method,
            headers,
            body: req.method === 'POST' ? raw : undefined,
          });
          const wRes = await worker.fetch(wReq, process.env);
          const outHeaders = {};
          wRes.headers.forEach((v, k) => { outHeaders[k] = v; });
          res.writeHead(wRes.status, outHeaders);
          res.end(Buffer.from(await wRes.arrayBuffer()));
          return;
        }
        const body = req.method === 'POST' ? (raw ? JSON.parse(raw) : {}) : undefined;
        const result = await mockApi(reqUrl, body);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.status || 400, { error: err.message || 'Something went wrong' });
      }
      return;
    }

    if (vite) {
      vite.middlewares(req, res, (err) => {
        if (err) {
          res.writeHead(500);
          res.end(err.message);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
    } else {
      serveStatic(req, res);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
