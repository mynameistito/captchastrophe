import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const SUBMISSIONS_DIR = path.join(ROOT, 'submissions');
export const FIXTURES_DIR = path.join(ROOT, 'fixtures');
export const PLAY_SRC_DIR = path.join(ROOT, 'play');
export const DIST_DIR = path.join(ROOT, 'dist');
