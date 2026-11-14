import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { readManifest, type Manifest } from './manifest.ts';
import { ROOT, SUBMISSIONS_DIR } from './paths.ts';

export const MAX_FILES = 200;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

/** Files and directories that must never ship inside a submission. */
const FORBIDDEN_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'node_modules',
  '_headers',
  '_redirects',
  '_worker.js',
  'wrangler.toml',
  'wrangler.json',
  'wrangler.jsonc',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.js', '.mjs']);
const MARKUP_EXTENSIONS = new Set(['.html', '.htm']);
const SCANNED_EXTENSIONS = new Set([...CODE_EXTENSIONS, ...MARKUP_EXTENSIONS, '.css']);

const approvedDepsSchema = z.strictObject({
  packages: z.record(z.string(), z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'must be an exact version')),
});
export type ApprovedDeps = z.infer<typeof approvedDepsSchema>['packages'];

export function loadApprovedDeps(file = path.join(ROOT, 'scripts', 'approved-deps.json')): ApprovedDeps {
  return approvedDepsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).packages;
}

// import x from 'a' | import 'a' | export * from 'a' | export { x } from 'a'
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[\w*${}\s,]*?\s*from\s*)?(['"])([^'"\n]+)\1/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/g;
const MARKUP_REMOTE = /<(?:script|link|iframe|img|source|audio|video)\b[^>]*?\b(?:src|href)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]+)/gi;
const CSS_REMOTE = /@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\/[^"')\s;]+|url\(\s*["']?\s*(?:https?:)?\/\/[^"')\s]+/gi;
const REMOTE = /^(?:https?:)?\/\//i;

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

function checkSpecifier(specifier: string, file: string, dir: string, approved: ApprovedDeps): string | undefined {
  if (REMOTE.test(specifier)) return `${file}: remote import "${specifier}" is not allowed. Bundle local files only`;
  if (/^(?:data|blob|node):/.test(specifier)) return `${file}: import "${specifier}" is not allowed`;
  if (specifier.startsWith('/')) return `${file}: absolute import "${specifier}" is not allowed`;
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(dir, path.dirname(file), specifier);
    return path.relative(dir, resolved).startsWith('..')
      ? `${file}: import "${specifier}" reaches outside the submission directory`
      : undefined;
  }
  const name = packageName(specifier);
  return name in approved
    ? undefined
    : `${file}: package "${name}" is not on the approved list (scripts/approved-deps.json). Open a maintainer issue to request it`;
}

function scanSource(text: string, file: string, dir: string, approved: ApprovedDeps): string[] {
  const errors: string[] = [];
  const ext = path.extname(file);
  if (CODE_EXTENSIONS.has(ext)) {
    for (const pattern of [STATIC_IMPORT, DYNAMIC_IMPORT]) {
      for (const match of text.matchAll(pattern)) {
        const problem = checkSpecifier(match[2] ?? '', file, dir, approved);
        if (problem) errors.push(problem);
      }
    }
  } else if (MARKUP_EXTENSIONS.has(ext)) {
    for (const match of text.matchAll(MARKUP_REMOTE)) errors.push(`${file}: remote URL "${match[1]}" in markup is not allowed`);
  } else {
    for (const match of text.matchAll(CSS_REMOTE)) errors.push(`${file}: remote URL in CSS is not allowed (${match[0].trim()})`);
  }
  return errors;
}

interface Walk {
  files: { rel: string; size: number }[];
  errors: string[];
}

function walk(dir: string, rel = '', out: Walk = { files: [], errors: [] }): Walk {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const full = path.join(dir, relPath);
    if (entry.isSymbolicLink()) out.errors.push(`${relPath}: symlinks are not allowed`);
    else if (FORBIDDEN_NAMES.has(entry.name)) out.errors.push(`${relPath}: not allowed in a submission (dependencies and hosting config are managed by maintainers)`);
    else if (entry.isDirectory()) walk(dir, relPath, out);
    else if (entry.isFile()) out.files.push({ rel: relPath, size: fs.statSync(full).size });
    else out.errors.push(`${relPath}: unsupported file type`);
  }
  return out;
}

export interface ValidationResult {
  manifest?: Manifest;
  errors: string[];
}

export interface ValidateOptions {
  approved?: ApprovedDeps;
  /** Require manifest id to equal the directory name. Disabled for `--dir` on templates. */
  requireDirName?: boolean;
}

export function validateDirectory(dir: string, options: ValidateOptions = {}): ValidationResult {
  const approved = options.approved ?? loadApprovedDeps();
  const errors: string[] = [];
  const { files, errors: walkErrors } = walk(dir);
  errors.push(...walkErrors);

  if (files.length > MAX_FILES) errors.push(`too many files: ${files.length} (max ${MAX_FILES})`);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) errors.push(`directory is ${mib(total)} MiB (max ${mib(MAX_TOTAL_BYTES)} MiB)`);

  const manifest = readManifest(dir, { requireDirName: options.requireDirName });
  if (!manifest.ok) errors.push(...manifest.errors);

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.rel}: ${mib(file.size)} MiB exceeds the ${mib(MAX_FILE_BYTES)} MiB per-file limit`);
    } else if (SCANNED_EXTENSIONS.has(path.extname(file.rel))) {
      errors.push(...scanSource(fs.readFileSync(path.join(dir, file.rel), 'utf8'), file.rel, dir, approved));
    }
  }
  return { manifest: manifest.ok ? manifest.manifest : undefined, errors };
}

function mib(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/** Subdirectories of `submissions/`. Stray files and symlinks are reported as errors. */
export function listSubmissionDirs(root = SUBMISSIONS_DIR): { dirs: string[]; errors: string[] } {
  const dirs: string[] = [];
  const errors: string[] = [];
  if (!fs.existsSync(root)) return { dirs, errors };
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) dirs.push(path.join(root, entry.name));
    else if (entry.name !== '.gitkeep' && entry.name !== 'README.md') {
      errors.push(`${entry.name}: only submission directories belong in submissions/`);
    }
  }
  return { dirs, errors };
}

function main(argv: string[]): number {
  const flag = argv.indexOf('--dir');
  const single = flag === -1 ? undefined : argv[flag + 1];
  if (flag !== -1 && !single) {
    console.error('usage: node scripts/validate.ts [--dir <path>]');
    return 2;
  }

  const listed = single ? { dirs: [path.resolve(single)], errors: [] } : listSubmissionDirs();
  const approved = loadApprovedDeps();
  let failed = 0;
  let errorCount = listed.errors.length;
  for (const error of listed.errors) console.error(`✗ submissions/${error}`);
  if (listed.errors.length) failed += 1;

  for (const dir of listed.dirs) {
    const label = path.relative(ROOT, dir) || dir;
    const { errors } = validateDirectory(dir, { approved, requireDirName: !single });
    if (errors.length === 0) {
      console.log(`✓ ${label}`);
      continue;
    }
    failed += 1;
    errorCount += errors.length;
    console.error(`✗ ${label}`);
    for (const error of errors) console.error(`    ${error}`);
  }

  console.log(`SUMMARY ${JSON.stringify({ checked: listed.dirs.length, failed, errors: errorCount })}`);
  return failed ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
