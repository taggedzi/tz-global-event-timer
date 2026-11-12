# Contributing

Use the Node.js 26 LTS version in [`.nvmrc`](.nvmrc). Install with `npm ci`, then
`npx playwright install --with-deps chromium`. On Windows, omit --with-deps.

## Small TDD loop

1. Pick one issue and start a branch from updated main.
2. Write an observable behavior test and run it. Confirm it fails for the intended reason.
3. Make the smallest implementation change, then refactor with tests green.
4. Run `npm run check`. Open a focused PR with `Closes #N`, a short explanation, and check results.

Separate test-only commits are optional. Configuration changes can start with a
failing install/build check. No coverage percentage is required. Add meaningful
success, error, boundary, and relevant rare-case tests for each feature; do not
assert internal implementation details or preserve known bugs as desired behavior.

## Commands

- `npm test` / `npm run test:unit`: fast Node test-runner tests with jsdom.
- `npm run prod`: one-shot production build.
- `npm run test:browser`: full Chromium suite against the existing production build.
- `npm run check`: unit tests, production build, then the full Chromium suite.
- `node scripts/serve.cjs`: serve dist at http://127.0.0.1:4173.
  Set SITE_DIR to serve another extracted build; no rebuild happens implicitly.

CI runs the same check on PRs and main pushes. The browser server has a bounded
startup and the CI job has a timeout. Failed browser runs retain traces,
screenshots, and a report. Unit tests explicitly set UTC and inject a clock/timer
scheduler. Browser tests set the clock and timezone where needed. Avoid sleeps
and external services. Regression tests cover invalid links, DST transitions,
viewer overrides, countdown boundaries, clipboard failures, and event exports.

For cross-browser link compatibility, install Firefox and WebKit with
`npx playwright install firefox webkit`, then run `npm run test:compat` after
a production build. The link suite checks QR download and printing, public link
formats, and protected links with correct passwords, wrong passwords, and
tampered payloads. The preview server's loopback origin supports Web Crypto.

## Accessibility verification

Automated checks cover 320px, 375px, and desktop layouts with long descriptions
and URLs, accessible names, inline error focus, Enter submission, visible keyboard
focus, and native occurrence selection. Axe checks detect common accessibility
violations, and mobile/desktop screenshots are inspected for layout problems.

Physical keyboard and screen-reader spot checks were unavailable in this agent
environment. Native date/time and datalist popovers vary by browser and OS; their
screen-reader behavior still needs a human spot check. Passing automated checks
is not a claim of complete accessibility.

## Release verification

The release helpers have deterministic unit tests for calendar versions, archive
contents and hashes, API failures, tag mismatches, draft recovery, and reruns.
`npm run test:smoke` runs just the shared Chromium smoke flow; set SITE_DIR to
an extracted ZIP to test the real package without publishing. Validate workflow
syntax with actionlint when changing `.github/workflows/` files. A live manual
release is a separate check performed by the owner.
