// @vitest-environment edge-runtime
import { test, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from './schema';
const modules = { ...import.meta.glob('./{users,bindings,schema}.ts'), './_generated/marker.js': async () => ({}) };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
test('uses server-side OAuth app authentication to verify the numeric GitHub account age', async () => {
  vi.stubEnv('GITHUB_API_TOKEN', '');
  vi.stubEnv('AUTH_GITHUB_CLIENT_ID', 'test-client');
  vi.stubEnv('AUTH_GITHUB_CLIENT_SECRET', 'test-secret');
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 123, created_at: '2020-01-01T00:00:00Z' })));
  vi.stubGlobal('fetch', fetcher);
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert('users', { githubId: '123', login: 'test', suspended: false, changes: [] }));
  await t.action(anyApi.users.fetchAccountAge, { userId, githubId: '123' });
  expect(fetcher).toHaveBeenCalledWith('https://api.github.com/user/123', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Basic ' + btoa('test-client:test-secret') }) }));
  expect(await t.run(ctx => ctx.db.get(userId))).toMatchObject({ githubCreatedAt: Date.parse('2020-01-01T00:00:00Z') });
});
