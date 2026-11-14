import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build, loadEnv } from 'vite';
import { z } from 'zod';
import { manifestSchema } from './manifest.ts';
import { listSubmissionDirs, validateDirectory } from './validate.ts';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
await build({ configFile: 'site/vite.config.ts' });
const entries = [];
for (const dir of listSubmissionDirs().dirs) {
  const { manifest: m, errors } = validateDirectory(dir);
  if (!m || errors.length) throw new Error(errors.join('\n'));
  let addedAt: string;
  try { addedAt = execFileSync('git', ['--no-pager', 'log', '--diff-filter=A', '--format=%aI', '-1', '--', dir + '/manifest.json'], { encoding: 'utf8' }).trim(); } catch { addedAt = ''; }
  if (!addedAt) addedAt = (await fs.stat(dir + '/manifest.json')).mtime.toISOString();
  entries.push({ ...m, status: 'accepted', addedAt, sourceUrl: `https://github.com/pc-style/captchastrophe/tree/main/submissions/${m.id}` });
}
const flag = process.argv.indexOf('--pre-review');
if (flag !== -1) {
  const file = process.argv[flag + 1]; if (!file) throw new Error('Missing pre-review file');
  const schema = manifestSchema.extend({status:z.literal('pre-review'),prNumber:z.number().int().positive(),addedAt:z.string().datetime(),sourceUrl:z.string().regex(/^https:\/\/github\.com\//)});
  const input = z.object({entries:z.array(schema).max(10000)}).parse(JSON.parse(await fs.readFile(file,'utf8')));
  const seen = new Set(entries.map(e=>e.id));
  for(const e of input.entries) { if(seen.has(e.id))continue; seen.add(e.id); entries.push(e); }
}
await fs.mkdir('dist/site/data', { recursive: true });
await fs.writeFile('dist/site/data/index.json', JSON.stringify({ generatedAt: new Date().toISOString(), entries }));
await fs.writeFile('dist/site/data/config.json', JSON.stringify({ playOrigin: env.VITE_PLAY_ORIGIN ?? null, voting: !!env.VITE_CONVEX_URL }));
console.log(`Built gallery: ${entries.length} accepted entries`);
