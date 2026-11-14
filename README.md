# captchastrophe

The worst captchas, on purpose. The website should be lovely. The captcha is where everything goes to shit.

[Live site](https://captchastrophe.pcstyle.dev) · [Contribute](CONTRIBUTING.md) · [Rules](docs/rules.md) · [Agent workflow](AGENTS.md)

## Run it

Node 24, bun. No npx.

```sh
bun install --frozen-lockfile
bun run build
bun run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). No secrets or backend are needed to browse and play locally. Without a Convex URL, voting is unavailable. The dev library reads metadata from the last build; run `bun run build:site` again after changing manifests. To launch a local entry, also run `node scripts/dev-play.ts <id>` in another terminal, then use Launch in the gallery. This builds that entry once: restart it after editing the entry.

Design C is implemented in `site/`. The original three mocks and their switcher are in `design/mocks/index.html`.

## Validate a change

```sh
bun run validate
bun run typecheck
bun run test
bun run build
```

For a quick loop, `bun run validate --dir submissions/<id>` checks one entry, and `bun run test scripts/site-discovery.test.ts` runs just the static discovery tests. Build output is in `dist/site` and `dist/play`. Use `bunx --no-install vite preview --config site/vite.config.ts` to inspect the built static library and entry pages; `bun run dev` runs the interactive development app.

## Read or automate the gallery

The production homepage exposes entry links without JavaScript. `/entries/<id>/` provides entry information; `/#/e/<id>` is the interactive challenge. `/data/index.json` is the existing public, read-only metadata catalogue. See the [automation guide](site/public/docs/agent-access.md) for its fields, browser controls, error states and authentication boundaries. No account is needed to read or play; voting still requires GitHub sign-in.

## Status

The gallery is live on Cloudflare with real accepted entries, not seeded contestants. Light/dark and mobile checks pass. Convex dev/prod are deployed. Real GitHub login, session restoration and sign-out were checked on production before the custom-domain migration; sign-in initiation is checked on the new domain. Voting integration, Bun CI and production publishing are enabled. Fork previews are not verified yet. See [setup status](docs/maintainers.md) for remaining work.
