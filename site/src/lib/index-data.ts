import { CAPABILITIES, type Capability, type Entry, type SiteIndex } from './types.ts';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** The contract says `author`; accept a plain login or `{ github }` so a small schema drift does not blank the page. */
function authorLogin(value: unknown): string | null {
  const raw = typeof value === 'string' ? value : value && typeof value === 'object' ? (value as { github?: unknown }).github : null;
  const login = typeof raw === 'string' ? raw.replace(/^@/, '') : null;
  return login && LOGIN_RE.test(login) ? login : null;
}

export function parseEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 40);
  if (!id || id.length < 3 || !ID_RE.test(id)) return null;
  const title = str(r.title, 200);
  if (!title) return null;
  const author = authorLogin(r.author);
  if (!author) return null;
  if (r.status !== 'accepted' && r.status !== 'pre-review') return null;
  const addedAt = str(r.addedAt, 64);
  if (!addedAt) return null;
  const caps = Array.isArray(r.capabilities) ? r.capabilities : [];
  const capabilities = CAPABILITIES.filter((c): c is Capability => caps.includes(c));
  const entry: Entry = {
    id,
    title,
    description: str(r.description, 1000) ?? '',
    author,
    capabilities,
    status: r.status,
    addedAt,
  };
  if (typeof r.prNumber === 'number' && Number.isInteger(r.prNumber) && r.prNumber > 0) entry.prNumber = r.prNumber;
  const sourceUrl = httpsUrl(r.sourceUrl);
  if (sourceUrl) entry.sourceUrl = sourceUrl;
  return entry;
}

/** Throws when the document is not an index at all. Individual bad rows are skipped and counted. */
export function parseIndex(json: unknown): SiteIndex {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { entries?: unknown }).entries)) {
    throw new Error('index.json has no entries array');
  }
  const seen = new Set<string>();
  const entries: Entry[] = [];
  let skipped = 0;
  for (const raw of (json as { entries: unknown[] }).entries) {
    const entry = parseEntry(raw);
    if (!entry || seen.has(entry.id)) {
      skipped += 1;
      continue;
    }
    seen.add(entry.id);
    entries.push(entry);
  }
  const generatedAt = str((json as { generatedAt?: unknown }).generatedAt, 64) ?? undefined;
  return { generatedAt, entries, skipped };
}

export async function loadIndex(url = './data/index.json', fetcher: typeof fetch = fetch): Promise<SiteIndex> {
  const response = await fetcher(url, { headers: { accept: 'application/json' }, cache: 'no-cache' });
  if (!response.ok) throw new Error(`index.json responded ${response.status}`);
  return parseIndex(await response.json());
}
