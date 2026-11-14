# Dependencies

`scripts/approved-deps.json` is the exact-version allow-list for contestant imports. The small starter set is seedrandom 3.0.5 (repeatable randomness for testing) and howler 2.2.4 (local audio playback and cleanup). Both are MIT-licensed and have no runtime dependencies. Versions checked on npm on 2026-11-14. Use neither unless you need it; original browser code and local assets work without packages.

Shared build dependencies live in the root lockfile. They are not automatically approved contestant dependencies.

Need a package? Open a dependency request issue with the exact version, license, shipped size, install scripts and why you need it. Or contact the maintainer privately if you already know how. Don't invent a contact address.

No per-submission package.json, lockfile or install script. No remote imports. Don't vendor an entire unapproved library to dodge the policy. Ordinary original code and local assets are fine.

The source scanner is a useful early check, not a security proof. The build enforces filesystem boundaries too; runtime isolation and human review do the rest.
