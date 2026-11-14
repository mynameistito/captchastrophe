import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { loadApprovedDeps } from './validate.ts';
const require = createRequire(import.meta.url);
import { listSubmissionDirs, validateDirectory } from './validate.ts';

export async function buildEntry(dir: string, output: string, fixture = false) {
  const result = validateDirectory(dir, { requireDirName: !fixture });
  if (result.errors.length || !result.manifest) throw new Error(result.errors.join('\n'));
  const m = result.manifest;
  const approvedRoots: string[] = [];
  for (const [name, version] of Object.entries(loadApprovedDeps())) {
    const file = require.resolve(name + '/package.json');
    if (JSON.parse(await fs.readFile(file, 'utf8')).version !== version) throw new Error('Approved dependency version mismatch: ' + name);
    approvedRoots.push(await fs.realpath(path.dirname(file)));
  }
  await fs.mkdir(output, { recursive: true });
  await build({ entryPoints: [path.join(dir, m.entry)], outfile: path.join(output, 'entry.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true, plugins: [{ name: 'boundary', setup(b) {
    b.onLoad({ filter: /./ }, async args => {
      const real = await fs.realpath(args.path);
      const root = await fs.realpath(dir);
      if (!real.startsWith(root + path.sep) && !approvedRoots.some(p => real.startsWith(p + path.sep))) throw new Error('Bundled input escapes submission: ' + args.path);
      return undefined;
    });
  }}] });
  await build({ entryPoints: ['play/main.ts'], outfile: path.join(output, 'runtime.js'), bundle: true, format: 'esm', target: 'es2022', minify: true });
  await fs.copyFile('play/runtime.css', path.join(output, 'runtime.css'));
  try { await fs.cp(path.join(dir, 'assets'), path.join(output, 'assets'), { recursive: true }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const config = JSON.stringify({ entry: './entry.js', capabilities: m.capabilities, layout: m.layout ?? {} }).replaceAll('<', '\\u003c');
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Captcha</title><link rel="stylesheet" href="./runtime.css"></head><body><div id="app"></div><script id="cx-config" type="application/json">${config}</script><script type="module" src="./runtime.js"></script></body></html>`);
  return m;
}

if (import.meta.main) {
  await fs.rm('dist/play', { recursive: true, force: true });
  await fs.mkdir('dist/play', { recursive: true });
  const { dirs, errors } = listSubmissionDirs();
  if (errors.length) throw new Error(errors.join('\n'));
  if (process.argv.includes('--include-fixtures')) for (const d of await fs.readdir('fixtures', { withFileTypes: true })) if (d.isDirectory()) dirs.push(path.resolve('fixtures', d.name));
  const ids: string[] = [];
  for (const dir of dirs) { const id = path.basename(dir); await buildEntry(dir, path.join('dist/play', id), dir.includes('/fixtures/')); ids.push(id); }
  await fs.writeFile('dist/play/index.json', JSON.stringify({ ids }));
  console.log(`Built ${ids.length} play bundles`);
}
