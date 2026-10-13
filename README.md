# Juno2 — public synthetic frontend demo

This is an independently published design demo, not production JUNO. It reuses
the validated Fluent Practice frontend and Juno2 branding. Every conversation,
recap, level, statistic and progress chart is synthetic. Typing gives a fixed,
clearly labeled mock response. Refresh or Reset Demo clears browser-memory state.

There is no Python backend, authentication, student database, AI provider,
microphone capture, speech service, telemetry, API proxy or browser persistence.
Do not enter personal information. All source in this repository is public.
Fonts are bundled locally; no Google Fonts request is made.

## Build and test

Use Node 24 and npm 11.9 (Node >=22.12 is supported):

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run test
npm run preview
```

The browser suite requires Python Playwright and `/usr/bin/chromium` on Linux.
It exercises built assets, all five screens, refresh, mobile navigation, typing,
pause/end/reset, literal text safety, and absence of external/API/storage/audio
activity. Missing browser tools fail rather than skip checks.

## GitHub Pages

Only `srspain-english/juno2-preview` is eligible for the workflow. Main pushes
build static `dist` and publish it using GitHub Pages. Settings → Pages → Source
must be **GitHub Actions**. No custom domains or paid hosting are required.
No credentials or custom secrets are needed. The Pages workflow has only the
read/build and narrowly scoped Pages publishing permissions it needs.

Vite assets use `/juno2-preview/`. Screens use `#/`, `#/practice`, `#/session`,
`#/notes` and `#/progress`, so direct links and refreshes always request the same
static index instead of an unavailable server route. The optional synthetic
drill remains available. Neither a backend rewrite nor a 404 fallback is needed.

Development CORS exceptions are excluded and `embedded-preview` is refused.
Inherited provider/backend environment settings are refused and `.env` is not
loaded. This repository must never be connected to production APIs or records.

The original Juno repository and the separate voice lab are not modified by this
demo. See PROVENANCE.md and licenses for source and third-party attribution.
