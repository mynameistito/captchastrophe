# Maintainer notes

## Actual status (2026-11-14)

- Public repo: https://github.com/pc-style/captchastrophe
- Local: design C gallery, TS/JS mount runtime, fixtures, validation/build, contributor docs/skills, Convex auth/voting code and tests.
- Convex project created under `pc-style`: https://dashboard.convex.dev/t/pc-style/captchastrophe
- Dev provisioned: `little-dachshund-797`; production provisioned: `posh-blackbird-302`.
- Backend deployment attempted, **blocked** by missing GitHub OAuth client ID/secret. Provisioned does not mean functions deployed.
- Cloudflare login expired. **No public site or fork preview is deployed.** `HOSTING_ENABLED=false` until setup and verification finish.
- Private vulnerability reporting enabled. Default Actions token is read-only; Actions cannot approve PRs.
- GitHub settings applied and read back: active main ruleset requiring `checks`, one approving review and CODEOWNERS; no force pushes/deletion. Admin bypass retained for bootstrap/emergencies. `preview` requires pc-style approval; preview/production only deploy from main. Ten labels created. Setup is reproducible through `.github/scripts/setup-repo.ts`.

## Shape

Static Vite/TypeScript gallery. Framework-independent TS/JS entries bundled with esbuild. Each published entry gets its **own static Worker origin**; a separate Worker holds the trusted gallery. A single shared play origin would not isolate entries from one another.

The iframe allows scripts and same-origin only on its distinct origin, plus declared capabilities. The parent validates message source/origin/shapes and offers no voting message. Auth lives in the gallery's sessionStorage. Exit removes the frame; mute is cooperative. Headers restrict direct visits too. Local browser checks are not a substitute for checking the deployed HTTPS boundary.

Production uses `scripts/publish.ts`: static-only Wrangler configs generated from trusted code, not contestant config. Names and per-entry origins are deterministic; deployment writes `data/config.json`. Fork previews use main's gallery, one validated CI artifact, no Convex URL, and a protected maintainer-triggered workflow. CI never gets deployment secrets. No shared Actions caches.

## Hosting choice and limits

Primary: Cloudflare Workers Static Assets. No Worker server code is shipped. A small contest fits the free plan; capacity is not infinite.

- Free static deploys: 20,000 files and 25 MiB/file. Our submission caps are stricter: 200 files, 5 MiB total, 2 MiB/file.
- Free account Worker count: 100. This design spends one Worker per accepted entry, plus the gallery and two per open one-entry preview. Check existing account usage before enabling hosting. Closed-PR previews are removed nightly by `cleanup-previews.yml`.
- Static asset requests have no request charge under current billing. Worker-script execution has separate quotas; this design has no Worker script.
- Pre-review metadata refresh: twice hourly, GitHub API pagination, metadata only. It rebuilds the gallery, not every captcha. Rankings do not rebuild anything.
- Fallback, documented only: Pages Direct Upload with separate projects/origins, keeping the same trust split. Pages has 500 builds/month on Free and native Git integration does not build fork PR previews.
- GitHub Pages: 1 GB site, soft 100 GB/month traffic, no native fork preview path or response-header control. Not selected for the untrusted runtime.

Official sources checked 2026-11-14: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Actions security](https://docs.github.com/en/actions/reference/security/secure-use).

## Ranking

Convex holds stable submission IDs, one vote per verified GitHub account, counters and daily aggregate buckets. Identity comes from Auth v2's live session lookup, not client arguments. Account creation time is fetched server-side from GitHub's numeric user endpoint and cached; failure leaves voting pending.

Top = 95% Wilson lower bound on upvotes/(upvotes+downvotes), z=1.96. Recent = original addedAt. Unrated = no active votes. Negative scores never hide entries.

Trending = the same Wilson bound over active votes from accounts whose **first** vote was during today or the previous six UTC calendar days, requiring three active voters. This is deliberately calendar-based, not an exact rolling 168-hour window. Switching or removing/re-adding keeps that first day. Totals/buckets update atomically, including moderation. The gallery fetches scores in pages of 50 and refreshes every ten minutes; no per-vote subscriptions. Cold pages can be up to ten minutes stale. A GitHub account is not proof of a unique human.

Accepted rankings and pre-review lists stay separate. Editing metadata preserves votes and original addedAt. A substantial replacement needs human review and a documented predecessor, not an automatic reputation reset.

## Finish setup

1. Cloudflare: authenticate with `pnpm exec wrangler login`, or configure an API token with account **Workers Scripts: Edit** on the intended account. Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub environment secrets. Set repository variable `CLOUDFLARE_WORKERS_SUBDOMAIN`. Check free-plan Worker capacity first.
2. GitHub OAuth: follow [exact fields](convex-setup.md). Set secrets in Convex, never Git or chat. Then `pnpm exec convex dev --once` and, after testing, `pnpm exec convex deploy`.
3. Set production `ALLOWED_REDIRECT_ORIGINS` to the exact gallery origin returned by deployment. No wildcard, no preview origins. Set a random >=32-character `SYNC_TOKEN` in Convex production and the GitHub production environment. The sync HTTP route has no browser CORS policy.
4. Repo variables `VITE_CONVEX_URL` and `CONVEX_SITE_URL` already point to the provisioned production deployment. Enable `HOSTING_ENABLED=true` only once credentials, environment protection and quotas are checked.
5. Run Deploy production. Inspect real headers, light/dark/mobile, permission opt-in/denial, session isolation and GitHub login. Trigger Publish authorized fork preview for a real fork PR with green CI. Validate its source commit and confirm it cannot use production votes. **These deployed checks are still outstanding.**
6. Scheduled metadata publishing lists valid PR metadata. A PR's authorized playable preview is linked from its sticky PR comment; opening a PR alone never runs code. Existing accepted IDs take precedence over pre-review revisions of that same ID.

Maintainer controls: call `maintainer:bursts`, `maintainer:suspend`, and paginated `maintainer:invalidate` with an authenticated maintainer session. Authorization uses `MAINTAINER_GITHUB_IDS` (set to `134572227` on dev/prod). Suspension and invalidation are separate. Audit records are private. Administrative CLI calls must also carry a valid user identity; deployment admin access alone is not accepted as a voting identity.

## Agent instruction sources

Read 2026-11-14 before writing contributor instructions:

- [Claude Fable 5.2](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2): dedicated guide, name verified.
- [Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5): dedicated guide, name verified. Neither Anthropic guide displayed an update date.
- [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model): verifies GPT-6 Astra and GPT-6.1 Sol. Family guidance is Astra-focused; no separate Sol guide was found, so family guidance was used.

Applied: clear goals and done conditions, bounded scope, short instruction files, conditional skills, focused checks, explicit permission boundaries. No hidden reasoning demands, giant ideation lists, endless self-review or maximum effort everywhere. Harness effort belongs in the harness, not contestant instructions.
