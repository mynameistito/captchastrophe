export type Direction = 'up' | 'down';
export type VotingStatus = 'unavailable' | 'signed-out' | 'signed-in';
export interface Ranking { id: string; up: number; down: number; top: number; trending: number; addedAt: string }
export type VoteResult =
  | { ok: true; vote: Direction | null }
  | { ok: false; reason: 'signed-out' | 'account-too-new' | 'rate-limited' | 'suspended' | 'unknown-submission' | 'unavailable' | 'eligibility-pending'; retryAfterMs?: number; eligibleAt?: string };
export interface Voting {
  status(): VotingStatus;
  subscribeStatus(cb: () => void): () => void;
  user(): { login: string; avatarUrl?: string } | null;
  signIn(returnHash: string): Promise<void>;   // redirects to GitHub, comes back to the same hash
  signOut(): Promise<void>;
  rankings(): Promise<Ranking[] | null>;       // one batched query; null when unavailable
  myVote(id: string): Promise<Direction | null>;
  vote(id: string, direction: Direction | null): Promise<VoteResult>;
}

const unavailable: Voting = {
  status: () => 'unavailable',
  subscribeStatus: () => () => {},
  user: () => null,
  signIn: () => Promise.reject(new Error('Voting is unavailable')),
  signOut: () => Promise.resolve(),
  rankings: () => Promise.resolve(null),
  myVote: () => Promise.resolve(null),
  vote: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
};

function isVoting(value: unknown): value is Voting {
  return !!value && typeof (value as Voting).status === 'function' && typeof (value as Voting).vote === 'function';
}

/** Loads the Convex-backed implementation lazily. Any failure leaves the page on the 'unavailable' stub. */
function lazyConvexVoting(convexUrl: string): Voting {
  let impl: Voting | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());

  const loading: Promise<void> = (async () => {
    const mod = (await import('./voting-convex.ts')) as Record<string, unknown>;
    const factory = mod.createConvexVoting ?? mod.createVoting ?? mod.default;
    const made = typeof factory === 'function' ? await (factory as (url: string) => unknown)(convexUrl) : factory;
    if (!isVoting(made)) throw new Error('voting-convex did not provide a Voting');
    impl = made;
    made.subscribeStatus(notify);
    notify();
  })().catch(() => {
    impl = null;
  });

  return {
    status: () => impl?.status() ?? 'unavailable',
    subscribeStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    user: () => impl?.user() ?? null,
    async signIn(returnHash) {
      await loading;
      if (!impl) throw new Error('Voting is unavailable');
      return impl.signIn(returnHash);
    },
    async signOut() {
      await loading;
      if (impl) await impl.signOut();
    },
    async rankings() {
      await loading;
      if (!impl) return null;
      try {
        return await impl.rankings();
      } catch {
        return null;
      }
    },
    async myVote(id) {
      await loading;
      if (!impl) return null;
      try {
        return await impl.myVote(id);
      } catch {
        return null;
      }
    },
    async vote(id, direction) {
      await loading;
      if (!impl) return { ok: false, reason: 'unavailable' };
      try {
        return await impl.vote(id, direction);
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
}

export default function createVoting(enabled = true): Voting {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  return enabled && convexUrl ? lazyConvexVoting(convexUrl) : unavailable;
}
