/**
 * Runtime configuration. Everything comes from Convex environment variables
 * (`convex env set NAME value`) with safe defaults. Values are read at call
 * time so a changed variable applies without a redeploy.
 *
 * Invalid values fall back to the default rather than disabling a protection.
 */

export const DEFAULT_VOTE_MIN_ACCOUNT_AGE_DAYS = 7;
export const DEFAULT_VOTE_MAX_CHANGES_PER_MINUTE = 10;
export const VOTE_RATE_WINDOW_MS = 60_000;
export const DAY_MS = 24 * 60 * 60 * 1000;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function parseNonNegativeNumber(raw: string | undefined, fallback: number) {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

export type VoteConfig = {
  minAccountAgeDays: number;
  maxChangesPerMinute: number;
};

export function getVoteConfig(): VoteConfig {
  return {
    minAccountAgeDays: parseNonNegativeNumber(
      readEnv("VOTE_MIN_ACCOUNT_AGE_DAYS"),
      DEFAULT_VOTE_MIN_ACCOUNT_AGE_DAYS,
    ),
    maxChangesPerMinute: parsePositiveInt(
      readEnv("VOTE_MAX_CHANGES_PER_MINUTE"),
      DEFAULT_VOTE_MAX_CHANGES_PER_MINUTE,
    ),
  };
}

const GITHUB_ID = /^[1-9][0-9]{0,15}$/;

export function isGithubId(value: string): boolean {
  return GITHUB_ID.test(value);
}

/** Numeric GitHub ids from MAINTAINER_GITHUB_IDS. Malformed entries are dropped. */
export function getMaintainerGithubIds(): Set<string> {
  const raw = readEnv("MAINTAINER_GITHUB_IDS");
  if (raw === undefined) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => isGithubId(s)),
  );
}

/**
 * Parse ALLOWED_REDIRECT_ORIGINS into bare origins. Throws on anything that
 * looks like a wildcard, a path, a non-https origin that is not localhost, or
 * garbage, so a bad value fails the deploy instead of widening the allow-list.
 * Unset means "no origin is allowed" (sign-in refuses to start).
 */
export function parseAllowedRedirectOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (entry === "") continue;
    if (entry.includes("*")) {
      throw new Error(`ALLOWED_REDIRECT_ORIGINS must not contain wildcards: "${entry}"`);
    }
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(`ALLOWED_REDIRECT_ORIGINS entry is not a URL: "${entry}"`);
    }
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
      throw new Error(
        `ALLOWED_REDIRECT_ORIGINS entry must be https (http only for localhost): "${entry}"`,
      );
    }
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
      throw new Error(
        `ALLOWED_REDIRECT_ORIGINS entry must be a bare origin: "${entry}" (use "${url.origin}")`,
      );
    }
    out.push(url.origin);
  }
  return out;
}

export function getAllowedRedirectOrigins(): string[] {
  return parseAllowedRedirectOrigins(process.env.ALLOWED_REDIRECT_ORIGINS);
}

/** SYNC_TOKEN must be at least 32 chars, otherwise the sync endpoint is off. */
export const SYNC_TOKEN_MIN_LENGTH = 32;

export function getSyncToken(): string | undefined {
  const token = readEnv("SYNC_TOKEN");
  return token !== undefined && token.length >= SYNC_TOKEN_MIN_LENGTH
    ? token
    : undefined;
}

export function getGithubApiToken(): string | undefined {
  return readEnv("GITHUB_API_TOKEN");
}
