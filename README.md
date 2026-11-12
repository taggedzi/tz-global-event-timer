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
Deploy the contents of `dist/` to a static host over HTTPS. Node is only needed
for development and builds.

The built HTML sets a Content Security Policy and a no-referrer policy. Configure
the production host to send the same headers as the preview server. The CSP
header adds frame protection, which browsers require in an HTTP response header.
See the [CSP `frame-ancestors` specification](https://www.w3.org/TR/CSP3/#directive-frame-ancestors).

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

Serve JavaScript and SVG with the correct MIME types. On the deployed site,
verify the response headers and try creating, copying, opening, and printing an
event link's QR code.

## Event link format

**Compress event link** is checked by default. The app uses the compressed link
when it is shorter. Clear the checkbox to generate an uncompressed link.
Both formats carry the full event in the URL and work on a static host.
Both accept descriptions up to 4,096 UTF-8 bytes and organizer timezones up to
128 characters. The full encoded query is capped at 13 KiB. Existing links over
these limits need to be recreated with shorter values. Hosts and sharing tools
can impose smaller URL limits.

Compressed links use a `v1` query parameter containing unpadded base64url of raw
DEFLATE data. The data is a UTF-8 JSON array of the UTC epoch time in
milliseconds, the description, and the organizer's timezone (or `null`).

Uncompressed links encode a UTC ISO 8601 instant in `date` (with seconds and optional
three-digit milliseconds) and optional text in `desc`. Valid legacy UTC-string
links remain readable. Local-time strings, impossible dates, and repeated date
parameters are rejected with an explanation. Tracking-only links open creation.
Links are snapshots: changing an event requires sharing a newly generated link.

The event form adds these query values to the generated link automatically. To
build a link by hand, add them to your site URL as query parameters:

```text
https://your-site.example/?date=2026-06-15T19%3A30%3A00.000Z&desc=Game+night&zone=America%2FNew_York
```

- `date` is required and must be a UTC instant in ISO 8601 format, ending in
  `Z`. It represents the event's exact moment, regardless of the organizer's
  timezone.
- `desc` is optional event text. URL-encode spaces and special characters; for
  example, a space can be written as `+`.
- `zone` is an optional named IANA timezone such as `America/New_York`. It lets
  visitors see the organizer's event time as well as their own. It does not
  control viewer-time conversion; that uses each visitor's browser timezone.

You can omit `desc` or `zone`. When creating links in code, use
`URLSearchParams` (or an equivalent URL encoder) so values are encoded safely.

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
