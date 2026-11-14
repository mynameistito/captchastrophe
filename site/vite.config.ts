import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
export default defineConfig({ root: 'site', base: './', build: { outDir: '../dist/site', emptyOutDir: true, sourcemap: false }, server: { host: '127.0.0.1' }, plugins: [{ name: 'local-index', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url !== '/data/index.json' && req.url !== '/data/config.json') return next();
    res.setHeader('Content-Type', 'application/json');
    try { res.end(await fs.readFile('dist/site' + req.url)); }
    catch { res.end(JSON.stringify(req.url.endsWith('index.json') ? {entries:[]} : {voting:false})); }
  });
} }] });
