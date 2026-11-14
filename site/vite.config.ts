import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs/promises';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  return { root: 'site', envDir: '..', base: './', build: { outDir: '../dist/site', emptyOutDir: true, sourcemap: false }, server: { host: '127.0.0.1' }, plugins: [{ name: 'local-index', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url !== '/data/index.json' && req.url !== '/data/config.json') return next();
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/data/config.json') {
      res.end(JSON.stringify({ voting: !!env.VITE_CONVEX_URL, entryOrigins: {} }));
      return;
    }
    try { res.end(await fs.readFile('dist/site' + req.url)); }
    catch { res.end(JSON.stringify(req.url.endsWith('index.json') ? {entries:[]} : {voting:false})); }
  });
} }] };
});
