# Verification record

2026-11-14. Tests are evidence for these paths, not a blanket safety certificate.

- Bun migration: `bun install --frozen-lockfile`, `bun run validate`, `bun run typecheck`, `bun run test` and `bun run build` pass locally with Bun 1.4.0. Updated GitHub workflows have not yet run.
- `bun run typecheck`: gallery/tooling and Convex pass.
- `bun run test`: 14 passing tests across manifest/boundary policy, artifact validation, gallery filtering/ranking, frame messages and Convex voting/moderation.
- Convex tests exercise concurrent duplicates, switching/removing, immutable first activity, default/configured rate limits, account age, unknown entries, forged arguments, unauthenticated writes and maintainer authorization/invalidation. **Auth v2 session lookup is mocked in these tests.**
- `bun run build`: passes; public library contains zero fixture/placeholder entries.
- `node scripts/build-play.ts --include-fixtures` + `node scripts/browser-check.ts`: real Chrome passes TS/JS mount, Continue, success, abort, cleanup/reset, explicit camera denial, light/dark, 390px/1280px render/no overflow, deliberate launch, voting UI timing, cross-origin storage/DOM and top-navigation blocking, and outer Exit.
- Prior static Wrangler deployment dry run: static assets accepted; no upload performed.
- Metadata reader checked against GitHub's actual API with zero open PRs. YAML files parse. `actionlint` is not installed.
- GitHub CI passed on `1edaa8d`: https://github.com/pc-style/captchastrophe/actions/runs/43569536866 (includes real Linux Chrome checks and artifact upload).

The first CI run exposed a missing-device-versus-denial difference on Linux. Tests now provide a synthetic camera and explicitly deny it; the denial assertion remains strict.

Live deployment verified: https://captchastrophe-site.pcstyle.workers.dev returns HTTP 200 with CSP, nosniff and no-referrer headers. The initial deployment had voting disabled; the current deployment enables the Convex integration. There are no entry origins and the index has zero entries. Real Chrome checks pass at 1280px and 390px with no horizontal overflow, empty state and both themes (screenshots in ignored `design/evidence/live-gallery-*.png`). The pinned `cf` static publishing dry run and real upload passed. Typecheck and all 14 tests pass after the publishing change.

OAuth follow-up: both Convex backends deployed. Real Helium GitHub consent, production callback redemption, reload/session restoration and sign-out pass. Server-side numeric GitHub ID and account age are populated. Live testing caught and fixed the wrong callback parameter (`code` instead of Auth v2's `convexAuthCode`) and an HTTP 403 on unauthenticated account-age lookup. The lookup now uses the OAuth app's public-data quota. Both regressions have tests; all 16 tests and typecheck pass. A bounded Vite check confirms local development loads the dev URL from `.env.local`, not production, and exposes no server credential.

Still unverified: time-based token refresh; full dev browser OAuth; live voting/moderation against a test entry; deployed HTTPS capability delegation and signed-in frame isolation; actual fork PR through publishing and cleanup; load behavior near service quotas. Scoped publishing credentials are configured in GitHub, but updated Bun/cf workflows have not run remotely.
