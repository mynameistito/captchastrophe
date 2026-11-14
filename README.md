# captchastrophe

The worst captchas, on purpose. The website should be lovely. The captcha is where everything goes to shit.

[Live site](https://captchastrophe-site.pcstyle.workers.dev) · [Contribute](CONTRIBUTING.md) · [Rules](docs/rules.md) · [Agent workflow](AGENTS.md)

## Run it

Node 24, bun. No npx.

```sh
bun install --frozen-lockfile
bun run build
bun run dev
```

The gallery starts empty. No fake contestants, no fake popularity. Voting being unavailable doesn't stop browsing.

Design C is implemented in `site/`. The original three mocks and their switcher are in `design/mocks/index.html`.

## Status

The gallery is live on Cloudflare, with light/dark and mobile checks passing. No fake contestants are seeded. Convex dev/prod are deployed. Real GitHub login, session restoration and sign-out pass on production; voting integration is enabled, but there are no accepted entries to vote on yet. Bun CI and production publishing through GitHub Actions are verified and enabled. Fork previews are not verified yet. See [setup status](docs/maintainers.md) for remaining work.
