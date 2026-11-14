import type { Ranking } from '../voting.ts';
import { parseTime } from './format.ts';
import type { Entry, SortKey } from './types.ts';

export type RankingMap = ReadonlyMap<string, Ranking>;

export interface LibraryQuery {
  query: string;
  sort: SortKey;
  unratedOnly: boolean;
}

export function indexRankings(rankings: readonly Ranking[] | null): RankingMap | null {
  if (!rankings) return null;
  return new Map(rankings.map((r) => [r.id, r]));
}

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

export function votesOf(ranking: Ranking | undefined): number {
  return ranking ? num(ranking.up) + num(ranking.down) : 0;
}

/** Case-insensitive; every whitespace-separated term must appear in the title, id, author or description. A leading @ is ignored. */
export function matchesQuery(entry: Entry, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).map((t) => t.replace(/^@/, '')).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${entry.title}\n${entry.id}\n${entry.author}\n${entry.description}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

const byRecent = (a: Entry, b: Entry): number => parseTime(b.addedAt) - parseTime(a.addedAt) || (a.id < b.id ? -1 : 1);

export interface SortResult {
  entries: Entry[];
  /** The order actually applied. Differs from the request when rankings are unavailable. */
  effective: SortKey;
  fellBack: boolean;
}

/** Top and Trending need rankings. Without them the list is Recent and `fellBack` says so. Missing rows count as zero. */
export function sortEntries(entries: readonly Entry[], sort: SortKey, rankings: RankingMap | null): SortResult {
  const list = [...entries];
  if (sort === 'recent' || !rankings) {
    return { entries: list.sort(byRecent), effective: 'recent', fellBack: sort !== 'recent' };
  }
  const score = (e: Entry, key: 'top' | 'trending') => num(rankings.get(e.id)?.[key]);
  const votes = (e: Entry) => votesOf(rankings.get(e.id));
  if (sort === 'top') {
    list.sort((a, b) => score(b, 'top') - score(a, 'top') || votes(b) - votes(a) || byRecent(a, b));
  } else {
    list.sort((a, b) => score(b, 'trending') - score(a, 'trending') || score(b, 'top') - score(a, 'top') || byRecent(a, b));
  }
  return { entries: list, effective: sort, fellBack: false };
}

/** Unrated = zero active votes. Unknowable without rankings, so the filter is not applied then (callers disable it). */
export function filterEntries(entries: readonly Entry[], q: Pick<LibraryQuery, 'query' | 'unratedOnly'>, rankings: RankingMap | null): Entry[] {
  return entries.filter((e) => {
    if (!matchesQuery(e, q.query)) return false;
    if (q.unratedOnly && rankings && votesOf(rankings.get(e.id)) > 0) return false;
    return true;
  });
}

export function splitByStatus(entries: readonly Entry[]): { accepted: Entry[]; preReview: Entry[] } {
  return {
    accepted: entries.filter((e) => e.status === 'accepted'),
    preReview: entries.filter((e) => e.status === 'pre-review'),
  };
}

export interface LibraryView {
  accepted: Entry[];
  preReview: Entry[];
  effectiveSort: SortKey;
  fellBack: boolean;
  unratedAvailable: boolean;
  matches: number;
}

/** Accepted entries follow the chosen sort. Pre-review is its own list and is always newest first. */
export function buildLibrary(all: readonly Entry[], q: LibraryQuery, rankings: RankingMap | null): LibraryView {
  const filtered = filterEntries(all, q, rankings);
  const { accepted, preReview } = splitByStatus(filtered);
  const sorted = sortEntries(accepted, q.sort, rankings);
  return {
    accepted: sorted.entries,
    preReview: sortEntries(preReview, 'recent', rankings).entries,
    effectiveSort: sorted.effective,
    fellBack: sorted.fellBack,
    unratedAvailable: rankings !== null,
    matches: filtered.length,
  };
}
