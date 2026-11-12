# Tz Global Event Timer

[![CI status on main](https://github.com/taggedzi/tz-global-event-timer/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/taggedzi/tz-global-event-timer/actions/workflows/ci.yml?query=branch%3Amain)
[![Stack: JavaScript, HTML, and CSS](https://img.shields.io/badge/stack-JavaScript%20%2F%20HTML%20%2F%20CSS-F7DF1E)](src/)
[![Development: Node.js 24 or later](https://img.shields.io/badge/development-Node.js%2024%2B-339933)](#development)
[![Hosting: static site over HTTPS](https://img.shields.io/badge/hosting-static%20HTTPS-2563EB)](#building-and-hosting)
[![Sharing: QR codes and optional passwords](https://img.shields.io/badge/sharing-QR%20%2B%20optional%20passwords-6D28D9)](#usage)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

This project was created to help manage events in multiple timezones. I play games with people around the world and co-ordinating when things will start is always difficult.  I created this project to make this process easier.

## Usage

1. Choose an **Event time zone** and enter the **Event date and time** in that zone. Add a description if you like.
2. Click **Create event link**, then **Copy link** or **Generate QR code**. Visitors see the event in their local time with a countdown.

If the clock moves forward and the selected time does not exist, choose another time. If a time occurs twice when the clock moves back, explicitly choose its first or second occurrence using the displayed UTC offsets. The preview confirms the chosen date, time, zone, and offset.

### Password protection

Fill in **Protect with a password** before creating the link. The browser encrypts
the event time, description, and organizer time zone. Recipients enter the
password to unlock the event. Leave the field blank to create a public link.

Share the password separately. Anyone with the link can try guesses offline.
Password protection cannot guarantee privacy, and the site owner assumes no
responsibility if someone guesses the password. Creating and unlocking protected
links uses built-in Web Crypto and requires HTTPS on a hosted site. Local preview
on `127.0.0.1` also works. The protected link flow is tested in Chromium,
Firefox, and WebKit.

### QR codes

**Generate QR code** encodes the full event link. You can download it as a PNG
or print it. Scanning a protected link opens the same password prompt.

For a typical event URL, about 2,300 characters is a rough capacity estimate.
The exact limit depends on how the URL is encoded. If the app reports that the
link is too long, keep **Compress event link** checked or shorten the description
and generate a new link. You can still share the link directly.
[QR capacity table](https://www.qrcode.com/en/about/version.html)

## License

Licensed under the [MIT License](LICENSE).

## Development

Use Node.js 24 LTS. Run `npm ci` and `npx playwright install chromium`, then
`npm run check` to run unit tests, build the site, and run the full Chromium suite. See
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
verify the response headers, create and unlock a protected link, and try copying
the link and printing its QR code.

## Event link format

**Compress event link** is checked by default. The app uses the compressed event
query when it is shorter. Clear the checkbox to use the uncompressed query.
All formats carry the full event in the URL and work on a static host. They
accept descriptions up to 4,096 UTF-8 bytes and organizer time zones up to 128
characters. The encoded event query is capped at 13 KiB before encryption.
Existing links over these limits need to be recreated with shorter values.
Hosts and sharing tools can impose smaller URL limits.

Compressed links use a `v1` query parameter containing unpadded base64url of raw
DEFLATE data. The data is a UTF-8 JSON array of the UTC epoch time in
milliseconds, the description, and the organizer's timezone (or `null`).

Uncompressed links encode a UTC ISO 8601 instant in `date` (with seconds and optional
three-digit milliseconds) and optional text in `desc`. Valid legacy UTC-string
links remain readable. Local-time strings, impossible dates, and repeated date
parameters are rejected with an explanation. Tracking-only links open creation.
Links are snapshots. Changing an event requires sharing a newly generated link.

Protected links store the encrypted event query in a `#p1=` URL fragment.
The unpadded base64url payload contains a 16-byte random salt, a 12-byte random
IV, and the AES-256-GCM ciphertext with a 16-byte authentication tag. The browser
derives the key from the password with PBKDF2-HMAC-SHA-256 and 600,000 iterations.
The fragment stays out of the HTTP request to the host. Public links carry the
event data in the query string.

To build a public uncompressed link by hand, add the query parameters to your
site URL.

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

## Viewing and exporting an event

The event page labels the detected browser timezone. Change **Display time zone**
to view another zone without changing the event or countdown. Organizer time
appears when the link includes valid origin-zone metadata. If browser timezone
detection/formatting is unavailable, the page falls back to labeled UTC.
No geolocation permission, IP lookup, or saved preference is required.

The countdown rounds remaining seconds up and changes to started at the exact
event instant. It refreshes when the tab regains focus or visibility. Countdown
accuracy depends on the viewer device clock; the event instant remains fixed.

Use **Download text**, **Copy text**, or **Print event** to export the displayed
time and description as plain text. If copying is unavailable, the app selects
the text for manual copying.

**Copy link** reports success only after the browser confirms the copy. If
copying is unavailable or denied, the link field is selected for manual copying.
Changing event details or link options clears the generated link. Create a new
link before copying again.

## Manual GitHub releases

In GitHub Actions, open **Release** and select **Run workflow**.
Select **main** (or another branch you intend to release), then
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

Download the attached deployable ZIP. Verify with
`sha256sum -c <filename>.zip.sha256`, or compare PowerShell's
`Get-FileHash <filename>.zip -Algorithm SHA256` with the checksum file. Extract
the whole ZIP into the web root of a static HTTPS host. Keep all assets and
license notices together. HTTPS enables password protection and clipboard
support.

The release script uses GitHub's built-in token. If repository rules reject
a tag or release operation, the workflow reports the error.
