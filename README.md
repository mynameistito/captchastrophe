# captchastrophe

The worst captchas, on purpose. The website should be lovely. The captcha is where everything goes to shit.

[Contribute](CONTRIBUTING.md) · [Rules](docs/rules.md) · [Agent workflow](AGENTS.md)

## Run it

Node 24, pnpm. No npx.

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run dev
```

The gallery starts empty. No fake contestants, no fake popularity. Voting being unavailable doesn't stop browsing.

Design C is implemented in `site/`. The original three mocks and their switcher are in `design/mocks/index.html`.

## Status

Local build and neutral TS/JS wiring checks work. GitHub CI, protected publishing workflows, labels and review rules are configured. Convex dev/prod are provisioned, but auth deployment needs OAuth credentials. Production hosting, fork previews and voting are not live yet. See [setup status](docs/maintainers.md) for what's implemented versus what still needs work or access.
