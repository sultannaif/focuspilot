import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
createServer(async (request, response) => {
  const target = normalize(join(root, request.url === '/' ? 'index.html' : request.url));
  if (!target.startsWith(root)) { response.writeHead(403); response.end(); return; }
  try { const body = await readFile(target); response.writeHead(200, { 'Content-Type': types[extname(target)] || 'text/plain; charset=utf-8' }); response.end(body); }
  catch { response.writeHead(404); response.end('Not found'); }
}).listen(4173, () => console.log('FocusPilot running at http://localhost:4173'));
