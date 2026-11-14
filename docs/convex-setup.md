# GitHub sign-in setup

Pinned and inspected: `convex` 1.50.0, `@convex-dev/auth` 2.0.0. This is Auth **v2**, not the old Auth.js-based v1. [Official GitHub integration](https://docs.convex.dev/auth/convex-auth/methods/oauth), checked 2026-11-14. The vanilla client uses the package's framework-independent `AuthClient`; React isn't required by the gallery.

## OAuth apps owned by pc-style

Create separate GitHub OAuth apps for dev and production at GitHub Settings → Developer settings → OAuth Apps. Do not enable device flow or repository permissions.

| Field | Production | Development |
| --- | --- | --- |
| Application name | captchastrophe | captchastrophe dev |
| Homepage URL | https://github.com/pc-style/captchastrophe (replace with the live gallery after deploy) | http://127.0.0.1:5173 |
| Authorization callback URL | https://posh-blackbird-302.convex.site/oauth/github/callback | https://little-dachshund-797.convex.site/oauth/github/callback |

The official v2 provider requests `read:user` and `user:email`, hardcoded in 2.0.0. No repo scope. Email isn't stored by our application. Removing email scope would require a custom integration; that is not silently substituted here.

Put the Client ID and generated Client Secret into the respective Convex dashboard's environment variables:

- `AUTH_GITHUB_CLIENT_ID`
- `AUTH_GITHUB_CLIENT_SECRET`

Never paste secrets into chat, Git or browser code. Use the dashboard or stdin to the installed CLI, not a literal secret saved in shell history.

## Deployment configuration

The project and both deployments exist; auth functions have **not** deployed because those credentials are missing.

- Dev dashboard: https://dashboard.convex.dev/d/little-dachshund-797
- Production dashboard: https://dashboard.convex.dev/d/posh-blackbird-302
- Dev `ALLOWED_REDIRECT_ORIGINS` is set to `http://127.0.0.1:5173,http://localhost:5173`.
- Production must use only the exact trusted gallery origin after hosting. No previews.
- `MAINTAINER_GITHUB_IDS=134572227` is set on both deployments.
- `VOTE_MIN_ACCOUNT_AGE_DAYS` defaults to 7, `VOTE_MAX_CHANGES_PER_MINUTE` to 10.
- Optional `GITHUB_API_TOKEN` improves public account-lookup rate limits; give it no repository permissions. Without it, GitHub shared-egress limits may leave account age pending. A later sign-in retries the lookup.
- `SYNC_TOKEN`: random, at least 32 characters, server-side only. Match the GitHub production environment's secret of the same name.

After credentials are present:

```sh
pnpm exec convex dev --once
# After testing dev login and voting:
pnpm exec convex deploy
```

The production GitHub variables already contain the public cloud/site URLs. Keep deploy keys out of fork jobs. Preview galleries have voting disabled and no production auth client configuration.

## Verification still requiring credentials

Real GitHub redirect, return to the same entry without casting a vote, server-side live-session lookup, GitHub account-age fetch, refresh/sign-out, deployed moderation authorization, and a real HTTPS iframe with a signed-in parent. Tests substitute the session lookup; they don't pretend to prove OAuth.

Convex free-plan quotas are finite. Check the dashboard before launch and set spending controls; the app pages rankings and uses per-entry daily aggregates rather than subscribing to every vote.
