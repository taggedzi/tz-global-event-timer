# Tz Global Event Timer

This project was created to help manage events in multiple timezones. I play games with people around the world and co-ordinating when things will start is always difficult.  I created this project to make this process easier.

## Usage

Select the event timezone, then enter a date and time in that zone. Optionally add a description and click Create Event Link. Share the generated link; visitors see the same event instant in their device timezone with a countdown.

If the clock moves forward and the selected time does not exist, choose another time. If a time occurs twice when the clock moves back, explicitly choose its first or second occurrence using the displayed UTC offsets. The preview confirms the chosen date, time, zone, and offset.

## License

Licensed under the [MIT License](LICENSE).

## Development

Use Node.js 24 LTS. Run `npm ci` and `npx playwright install chromium`, then
`npm run check` to run unit tests, build, and the Chromium smoke test. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the lightweight TDD workflow.

## Building and hosting

`npm run build` creates a production site in `dist/` and exits; `npm run prod`
is retained as an alias for compatibility. `npm run build:dev` makes a one-shot
development build. `npm run dev` watches source files; stop it with Ctrl+C.
Use `npm run serve` in another terminal to serve the built files locally.
Deploy the contents of `dist/` to a static HTTP(S) host; Node is build tooling,
not a required production server. Node 24 LTS is the documented development/CI
target; direct build dependencies are declared in package.json and locked.

## Event link format

New links encode a UTC ISO 8601 instant in `date` (with seconds and optional
three-digit milliseconds) and optional text in `desc`. Valid legacy UTC-string
links remain readable. Local-time strings, impossible dates, and repeated date
parameters are rejected with an explanation. Tracking-only links open creation.
Links are snapshots: changing an event requires sharing a newly generated link.

## Viewer timezone

The event page labels the detected browser timezone. Change Display timezone
to view another zone without changing the event or countdown. Organizer time
appears when the link includes valid origin-zone metadata. If browser timezone
detection/formatting is unavailable, the page falls back to labeled UTC.
No geolocation permission, IP lookup, or saved preference is required.

The countdown rounds remaining seconds up and changes to started at the exact
event instant. It refreshes when the tab regains focus or visibility. Countdown
accuracy depends on the viewer device clock; the event instant remains fixed.

Copy link reports success only after the browser confirms the copy. If copying
is unavailable or denied, the link field is selected for manual copying.
Changing event details clears the generated link, so create a new link before
copying again.

## Manual GitHub releases

After the Release workflow is merged into main, open GitHub **Actions ? Release ?
Run workflow**. Select **main** (or another branch you intend to release), then
click **Run workflow**. No local release command or personal access token is needed.

The workflow tests the exact selected commit, builds a ZIP, extracts it, and runs
the Chromium smoke flow against the extracted site before publishing. The release
contains `tz-global-event-timer-vYYYY.MM.DD.RUN.zip`, its SHA-256 checksum, change
notes, source commit, UTC build time, and a link to the workflow run.

The date comes from the workflow run creation time in UTC. The run number makes
same-day releases unique; rerunning the same run keeps the same version even
after midnight. A successful rerun keeps the existing published release intact.
A failed upload leaves a draft that the same run can safely retry. Releases are
serialized; normal CI, pushes, and tags never publish automatically.

Download the attached deployable ZIP, rather than GitHub?s source-code archives.
Verify with `sha256sum -c <filename>.zip.sha256`, or compare PowerShell?s
`Get-FileHash <filename>.zip -Algorithm SHA256` with the checksum file. Extract
the whole ZIP into a static HTTP(S) web root. Keep all assets and license notices
together. HTTPS enables clipboard support; no application server is required.

The release script uses GitHub?s built-in token. If repository tag/release rules
reject it, the workflow fails visibly and keeps a draft rather than publishing an
incomplete release. No production release is created by the test suite.
