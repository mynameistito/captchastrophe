/**
 * Pure ranking math. No Convex imports, so it is trivially unit-testable.
 *
 * Top      = Wilson lower bound (95%) of up / (up + down).
 * Trending = Wilson lower bound over the voters whose FIRST vote on the entry
 *            is within the last 7 days, minimum 3 such voters. Only their
 *            current directions count, tombstones (removed votes) are skipped.
 */

export const WILSON_Z = 1.96;
export const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const TRENDING_MIN_VOTERS = 3;

export type Direction = "up" | "down";

export function wilsonLowerBound(up: number, down: number, z = WILSON_Z): number {
  const n = up + down;
  if (n <= 0) return 0;
  const p = up / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const lower = (centre - margin) / (1 + z2 / n);
  return Math.max(0, Math.min(1, lower));
}

export function topScore(up: number, down: number): number {
  return wilsonLowerBound(up, down);
}

/** Trending score from already-filtered window counts. */
export function trendingFromCounts(up: number, down: number): number {
  if (up + down < TRENDING_MIN_VOTERS) return 0;
  return wilsonLowerBound(up, down);
}

export type TrendingVote = {
  direction: Direction | null;
  firstVotedAt: number;
};

export function isInTrendingWindow(firstVotedAt: number, now: number): boolean {
  return firstVotedAt >= now - TRENDING_WINDOW_MS && firstVotedAt <= now;
}

/** Reference implementation over a list of votes. */
export function trendingScore(votes: readonly TrendingVote[], now: number): number {
  let up = 0;
  let down = 0;
  for (const vote of votes) {
    if (vote.direction === null) continue;
    if (!isInTrendingWindow(vote.firstVotedAt, now)) continue;
    if (vote.direction === "up") up++;
    else down++;
  }
  return trendingFromCounts(up, down);
}
