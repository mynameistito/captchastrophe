import { afterEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ mutation: vi.fn(), setSession: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexClient: class { setAuth() {} onUpdate() {} },
  ConvexHttpClient: class { mutation = mocks.mutation; },
}));
vi.mock('@convex-dev/auth/browser', () => ({ AuthClient: class {
  subscribe() {} fetchAccessToken = async () => null;
  init = async () => {}; setSession = mocks.setSession;
  getSnapshot() { return { isAuthenticated: false }; }
} }));
import { createConvexVoting } from './voting-convex.ts';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
test('redeems the Auth v2 callback parameter, removes it and preserves the entry', async () => {
  const url = 'https://example.convex.cloud';
  const stored = new Map([['captchastrophe-oauth:' + url, 'saved-state']]);
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => stored.get(k), removeItem: (k: string) => stored.delete(k) });
  vi.stubGlobal('location', { href: 'https://gallery.example/?convexAuthCode=one-time-ticket#/e/example' });
  const replaceState = vi.fn(); vi.stubGlobal('history', { replaceState });
  mocks.mutation.mockResolvedValue({ status: 'complete', tokens: { test: true } });
  const voting = createConvexVoting(url);
  await voting.myVote('example'); // Wait for callback handling, without casting a vote.
  expect(mocks.mutation).toHaveBeenCalledExactlyOnceWith(expect.anything(), { code: 'one-time-ticket', state: 'saved-state' });
  expect(mocks.setSession).toHaveBeenCalledWith({ test: true });
  expect(String(replaceState.mock.calls[0]?.[2])).toBe('https://gallery.example/#/e/example');
  expect(stored.size).toBe(0);
});
