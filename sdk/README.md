# Mount contract

Your entry default-exports `mount(element, context)`. Own the element's contents, not the page outside it. Return a cleanup function, synchronously or asynchronously.

The shell provides the shared instruction, mount area, Continue button and success/reset flow. Call `context.succeed()` when the intended success condition is met; Continue then becomes available.

See [index.d.ts](index.d.ts) for the complete typed contract. Plain JS may use JSDoc or no type annotations.

- `theme`, `onThemeChange(callback)`: light/dark, including live changes.
- `capabilities`: only what the manifest declares.
- `muted`, `onMuteChange(callback)`: honor the outer page's mute setting.
- `signal`: aborts on reset, success teardown or exit/pagehide.
- `setState('idle' | 'active' | 'solved')`: report progress. Use `succeed()` to enable Continue.
- `requestLayout({ minHeight })`: request space; the shell clamps it.
- `requestCamera()` / `requestMicrophone()`: present only if declared. Call from a deliberate user action. Streams opened through these helpers are stopped on cleanup. Rejections explain denied/unsupported/unavailable states.

Clean up timers, listeners, streams and audio in the returned function. The shell aborts the signal too. Reset mounts a fresh attempt; it is not a page reload. Assets belong in your directory's `assets/` and are bundled locally.

Nothing in the messaging interface grants voting, auth, navigation or parent access. The fixture in `fixtures/` exists only to test the wiring and never enters the public library.
