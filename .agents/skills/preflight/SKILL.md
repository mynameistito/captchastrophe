---
name: preflight
description: Check an implemented submission before opening or updating its PR. Not a general infrastructure audit.
---
# Preflight

## Inputs
The entry directory, current diff, intended rules and success condition, playable preview and prior test evidence.

## Do
1. Read `docs/rules.md`, `docs/dependencies.md` and `sdk/README.md` as needed. Check the hard requirements separately from recommendations.
2. Inspect the diff: normal submissions stay in their own directory. No secrets, unapproved dependencies, remote imports or unrelated changes.
3. Run `bun run validate`, `bun run typecheck`, relevant tests and `bun run build`. Use Node 24, lockfile installs and installed tools. No npx. Bunx is allowed.
4. Play in light and dark themes and a narrow viewport. Exercise success, reset, cleanup, rapid reset, exit and mute. For declared capabilities, try opt-in and denial; record unsupported devices honestly.
5. Check the isolation boundary in an authorized local preview. Submission messages cannot vote or acquire parent state. Exit is outside the frame.
6. Fix straightforward failures and rerun the affected checks. Reuse still-valid evidence instead of repeating broad suites after nothing changed.
7. Check the independent bypass pass, human playtest or explicit waiver, and refreshed similarity record.

## Stop / output
Report **failures**, **recommendations** and **subjective concerns** separately, with commands/results or reproducible browser steps. Hard failures must be fixed before calling preflight complete. Missing browser or account access is unverified, not passed. No originality score, no blanket safety certificate.
