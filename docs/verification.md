# Verification record

2026-11-14. Tests are evidence for these paths, not a blanket safety certificate.

- `pnpm run typecheck`: gallery/tooling and Convex pass.
- `pnpm test`: 14 passing tests across manifest/boundary policy, artifact validation, gallery filtering/ranking, frame messages and Convex voting/moderation.
- Convex tests exercise concurrent duplicates, switching/removing, immutable first activity, default/configured rate limits, account age, unknown entries, forged arguments, unauthenticated writes and maintainer authorization/invalidation. **Auth v2 session lookup is mocked in these tests.**
- `pnpm run build`: passes; public library contains zero fixture/placeholder entries.
- `node scripts/build-play.ts --include-fixtures` + `node scripts/browser-check.ts`: real Chrome passes TS/JS mount, Continue, success, abort, cleanup/reset, explicit camera denial, light/dark, 390px/1280px render/no overflow, deliberate launch, voting UI timing, cross-origin storage/DOM and top-navigation blocking, and outer Exit.
- `pnpm exec wrangler deploy --dry-run --config wrangler.site.jsonc`: static assets accepted; no upload performed.
- Metadata reader checked against GitHub's actual API with zero open PRs. YAML files parse. `actionlint` is not installed.
- GitHub CI passed on `1edaa8d`: https://github.com/pc-style/captchastrophe/actions/runs/43569536866 (includes real Linux Chrome checks and artifact upload).

The first CI run exposed a missing-device-versus-denial difference on Linux. Tests now provide a synthetic camera and explicitly deny it; the denial assertion remains strict.

Still unverified: real GitHub OAuth/refresh/sign-out; deployed backend/session checks; deployed HTTPS capability delegation; actual fork PR through publishing and cleanup; Cloudflare response headers in production; load behavior near service quotas. Hosting credentials and OAuth app registration are the current blockers. Provisioned Convex deployments are not deployed functions.
