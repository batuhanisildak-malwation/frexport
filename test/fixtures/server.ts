import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'framer-site');

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.png': 'image/png',
};

export interface Fixture {
  base: string;
  close: () => Promise<void>;
}

function portOf(server: Server): number {
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('no port');
  return addr.port;
}

export async function startFixture(): Promise<Fixture> {
  const server: Server = createServer(async (req, res) => {
    try {
      let path = (req.url ?? '/').split('?')[0]!;
      if (path === '/') path = '/index.html';
      if (path === '/about') path = '/about.html';
      const ext = extname(path) || '.html';
      let body = await readFile(join(ROOT, path.replace(/^\//, '')));
      const base = `http://127.0.0.1:${portOf(server)}`;
      if (path.endsWith('.xml')) {
        body = Buffer.from(body.toString('utf8').replaceAll('__BASE__', base));
      }
      res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${portOf(server)}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}
