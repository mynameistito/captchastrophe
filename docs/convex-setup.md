# GitHub sign-in

Pinned: `convex` 1.50.0, `@convex-dev/auth` 2.0.0. [Official Auth v2 OAuth integration](https://docs.convex.dev/auth/convex-auth/methods/oauth), checked 2026-11-14. The gallery uses the framework-independent `AuthClient`.

## Configured

[OAuth app](https://github.com/settings/applications/4019916), owned by `pc-style`:

- Name: captchastrophe
- Homepage: https://captchastrophe-site.pcstyle.workers.dev
- Production callback: `https://posh-blackbird-302.convex.site/oauth/github/callback`
- Development callback: `https://little-dachshund-797.convex.site/oauth/github/callback`
- Exact callbacks, no wildcard or device flow. One app currently serves both environments; they have separate databases and auth sessions.

Auth v2 requests `read:user` and `user:email`, not repository permissions. The application doesn't store email. Both deployments have `AUTH_GITHUB_CLIENT_ID` and `AUTH_GITHUB_CLIENT_SECRET`, and their functions are deployed.

## Local development

The ignored `.env.local` holds the dev `CONVEX_DEPLOYMENT`, dev `VITE_CONVEX_URL`, client ID and secret. Vite loads this root file but exposes only `VITE_` values to browser code. Never prefix a secret with `VITE_`. Never commit or print credentials.

```sh
bunx --no-install convex dev --once
bun run dev
```

The local gallery uses the dev backend, not the last production build's config. Environment variables used by hosted Convex functions must also be set on the dev deployment; editing `.env.local` does not automatically synchronize them. Credentials were synchronized during setup. For rotations, use the dashboard or CLI stdin, not literal secrets in shell history.

## Server configuration

- [Dev dashboard](https://dashboard.convex.dev/d/little-dachshund-797): `ALLOWED_REDIRECT_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`.
- [Production dashboard](https://dashboard.convex.dev/d/posh-blackbird-302): only `https://captchastrophe-site.pcstyle.workers.dev` is allowed. No previews.
- `MAINTAINER_GITHUB_IDS=134572227` on both deployments.
- `VOTE_MIN_ACCOUNT_AGE_DAYS` defaults to 7; `VOTE_MAX_CHANGES_PER_MINUTE` to 10.
- Account-age lookup uses OAuth app credentials server-side for public GitHub data. This avoids the shared unauthenticated IP quota without requesting more user permissions. An optional `GITHUB_API_TOKEN` overrides this. [Official rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): 5,000 requests/hour per OAuth app; failures leave eligibility pending and a later sign-in retries.
- Random `SYNC_TOKEN` configured in production Convex and the protected GitHub production environment. Never passed to the browser.

Deploy backend updates with `bunx --no-install convex deploy`. Preview galleries have no production auth client configuration. Keep deploy keys out of fork jobs.

## Evidence and remaining checks

Real Helium login on production passed: GitHub consent, callback redemption, session restoration after reload, sign-out. Numeric GitHub identity and account age are stored server-side. A regression test covers Auth v2's `convexAuthCode` parameter and preserving the entry hash without casting a vote.

Still to verify: full dev browser login, actual votes and moderation against a live test entry, time-based token refresh, and an HTTPS captcha frame beside a signed-in parent. Unit tests cover voting concurrency and moderation but mock session lookup. No fake contest entry was added for testing.

Convex quotas are finite. Check the dashboard and spending controls before launch. Rankings use paginated aggregates, not subscriptions to every vote.
