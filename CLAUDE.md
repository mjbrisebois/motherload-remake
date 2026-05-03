# Claude instructions

Read [`README.md`](./README.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md) before starting work in this project. Architecture, conventions, mechanics, tuning, and roadmap all live there.

This file only adds notes that don't belong in human-readable docs.

## Working style

- Treat questions as questions. "What about X?" or "Could we Y?" is the user asking, not requesting implementation. Answer first, propose, wait for direction.
- Be collaborative: explain what you'd do and confirm before multi-file changes.
- The user iterates fast and often just says "continue" or "proceed" — commit at logical boundaries (each milestone, each tuning pass) rather than batching.

## Dev server

The user keeps `npm run dev` running themselves. Do **not** start a second one. To smoke-test that files serve, curl them:

```
curl -sf http://localhost:5173/src/scenes/GameScene.ts -o /dev/null && echo OK
```

Real verification is the user refreshing their browser.

## Commits and GPG

GPG signing is enabled. If the passphrase prompt times out mid-session, hand the prepared commit message back as a fenced code block so the user can paste it into `git commit -m '...'` themselves. Never bypass with `--no-gpg-sign`.

When the user says "give me the commit message", they want it as a fenced code block — single quotes inside, no AI footer or co-author trailer.
