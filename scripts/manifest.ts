import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CAPABILITIES, LAYOUT_MAX_HEIGHT, LAYOUT_MIN_HEIGHT } from '../play/protocol.ts';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const ENTRY_EXTENSIONS = ['.ts', '.js', '.mjs'] as const;

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const idSchema = z
  .string()
  .min(3, 'id must be at least 3 characters')
  .max(40, 'id must be at most 40 characters')
  .regex(ID_PATTERN, 'id must be kebab-case: lowercase letters, digits and single hyphens');

export const githubLoginSchema = z.string().regex(GITHUB_LOGIN_PATTERN, 'not a valid GitHub login');

const sentence = z.string().trim().min(1, 'must not be empty').max(240, 'must be at most 240 characters');

export const conceptSchema = z.strictObject({
  action: sentence,
  sequence: sentence,
  difficulty: sentence,
  success: sentence,
});

const height = z.number().int().min(LAYOUT_MIN_HEIGHT).max(LAYOUT_MAX_HEIGHT);

const entrySchema = z
  .string()
  .min(1)
  .max(200)
  .superRefine((entry, ctx) => {
    const problem = entryPathProblem(entry);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export const manifestSchema = z.strictObject({
  id: idSchema,
  title: z.string().trim().min(1).max(60, 'title must be at most 60 characters'),
  description: z.string().trim().min(1).max(200, 'description must be at most 200 characters'),
  author: z.strictObject({ github: githubLoginSchema }),
  entry: entrySchema,
  capabilities: z
    .array(z.enum(CAPABILITIES))
    .refine((list) => new Set(list).size === list.length, 'capabilities must not repeat'),
  layout: z
    .strictObject({ minHeight: height.optional(), maxHeight: height.optional(), fullBleed: z.boolean().optional() })
    .refine(
      (layout) => layout.minHeight === undefined || layout.maxHeight === undefined || layout.minHeight <= layout.maxHeight,
      'layout.minHeight must not exceed layout.maxHeight',
    )
    .optional(),
  concept: conceptSchema,
});

export type Manifest = z.infer<typeof manifestSchema>;
export type Concept = z.infer<typeof conceptSchema>;

/** Pure string checks for `entry`. Filesystem checks happen in validateManifest. */
function entryPathProblem(entry: string): string | undefined {
  if (SCHEME.test(entry) || entry.startsWith('//')) return 'entry must be a relative path, not a URL';
  if (entry.startsWith('/') || path.win32.isAbsolute(entry)) return 'entry must not be an absolute path';
  if (entry.includes('\\') || entry.includes('\0')) return 'entry must use forward slashes only';
  if (entry.split('/').includes('..')) return 'entry must stay inside the submission directory (no "..")';
  if (!ENTRY_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
    return `entry must end in ${ENTRY_EXTENSIONS.join(', ')}`;
  }
  return undefined;
}

export type ManifestResult = { ok: true; manifest: Manifest } | { ok: false; errors: string[] };

export interface ManifestOptions {
  /** Require `id` to equal the directory name. Off for templates, which are not submissions. */
  requireDirName?: boolean;
}

function insideDir(dir: string, target: string): boolean {
  const relative = path.relative(dir, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Validate an already-parsed manifest against its directory. */
export function validateManifest(raw: unknown, dir: string, options: ManifestOptions = {}): ManifestResult {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `manifest.json: ${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }
  const manifest = parsed.data;
  const errors: string[] = [];

  if (options.requireDirName !== false && manifest.id !== path.basename(path.resolve(dir))) {
    errors.push(`manifest.json: id "${manifest.id}" must equal the directory name "${path.basename(path.resolve(dir))}"`);
  }

  const entryPath = path.resolve(dir, manifest.entry);
  if (!insideDir(path.resolve(dir), entryPath)) {
    errors.push(`manifest.json: entry "${manifest.entry}" resolves outside the directory`);
  } else {
    const stat = fs.lstatSync(entryPath, { throwIfNoEntry: false });
    if (!stat) errors.push(`manifest.json: entry "${manifest.entry}" does not exist`);
    else if (stat.isSymbolicLink()) errors.push(`manifest.json: entry "${manifest.entry}" is a symlink`);
    else if (!stat.isFile()) errors.push(`manifest.json: entry "${manifest.entry}" is not a file`);
    else if (!insideDir(fs.realpathSync(dir), fs.realpathSync(entryPath))) {
      errors.push(`manifest.json: entry "${manifest.entry}" resolves outside the directory through a symlink`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, manifest };
}

/** Read and validate `<dir>/manifest.json`. */
export function readManifest(dir: string, options: ManifestOptions = {}): ManifestResult {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`manifest.json: cannot read or parse (${reason})`] };
  }
  return validateManifest(raw, dir, options);
}
