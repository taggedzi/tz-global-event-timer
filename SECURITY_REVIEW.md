# Security review

Reviewed November 11–12, 2026 (America/New_York).
Source commit: `22d3a38f3c20811b1a267c76fb240f7bd81b4d35`.

## Conclusion

No exploitable cross-site scripting (XSS: attacker-controlled JavaScript running
in a visitor's page) or server code-execution path was found in the reviewed
event-link and QR flows. Both compressed and plain event descriptions reach
`textContent`, rather than an HTML parser. Compression changes the representation
of the data, not how it is rendered.

One reproducible availability bug exists in the bundled local preview server:
a null byte encoded in a request path terminates the process. There are also
hardening opportunities around browser security policy and input-size limits.

This is a source review and local test result, not a guarantee against every
possible payload or future change. No deployed URL or production server
configuration was supplied; production TLS, headers, permissions, host patches,
and request limits were not verified.

## Confirmed finding: malformed paths crash the preview server

**Severity: low in the documented loopback-only configuration; greater
availability impact if exposed through a proxy or changed to listen publicly.**

Location: `scripts/serve.cjs:16-19`.

The handler URL-decodes the path and checks that its resolved location remains
inside the site directory. However, a path such as `/index.html%00.js` survives
those checks and reaches `fs.readFile` with an embedded null byte.
`fs.readFile` throws `ERR_INVALID_ARG_VALUE` synchronously, outside the handler's
`try/catch`. The uncaught exception terminates Node.

Verified by launching the actual server in an isolated child process, sending
that request, and observing exit code 1 with `ERR_INVALID_ARG_VALUE`.
Ordinary encoded traversal attempts and malformed percent escapes were rejected
in separate handler checks.

Impact is denial of service, not demonstrated file disclosure or code execution.
This server binds to `127.0.0.1` and is documented for local preview. Deploying
only `dist/` to an independent static host does not deploy this handler.

Recommended fix: reject decoded null bytes before filesystem access and handle
synchronous filesystem argument errors without letting them escape the request
handler. Add a regression test that sends the bad request, expects a client
error, and then confirms the same process serves a normal request.

## Hardening opportunities

### Browser security policy is not supplied by the project

Locations: `src/index.html:3-8`, `scripts/serve.cjs:20`,
`webpack.common.js:16`.

There is no Content Security Policy (CSP) in the HTML or preview-server response,
and no production header configuration is included. A production host may already
supply one, but that was not checked. This is defense in depth, not an existing
XSS exploit: a restrictive script policy would provide another barrier if a
future change accidentally renders untrusted HTML.

A starting policy to validate on the production host is:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

The style exception accommodates the existing style-loader implementation; it
does not permit inline JavaScript. The `data:` image permission accommodates PNG
QR images. Serve `frame-ancestors` as an HTTP header. Test creation, copying,
QR generation/download/printing, and viewer behavior with the policy before
deployment. Deploy the production build over HTTPS. A dedicated static origin
also keeps this page separate from authenticated applications and user uploads.

References: [MDN CSP guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP),
[MDN Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).

### Size limits differ between link formats

Locations: `src/js/event-link.js:5`, `src/js/event-link.js:61-68`,
`src/js/event-link.js:80-83`, `src/index.html:63`.

Compressed payloads have a 1 MiB decoded-data limit, an encoded-input limit, and
chunked inflation. An attempted 8 MiB expansion was rejected. A valid description
just under 1 MiB can still fit in a roughly 1,400-character compressed query.

Plain links have no application-level query or description limit. A direct
decoder test accepted a 2 MiB plain description. Actual delivery also depends on
browser, proxy, and HTTP-server URL limits, so this does not demonstrate a remotely
deliverable browser crash. It does show inconsistent resource limits. Creation
also falls back to an unrestricted plain link when the compression size limit is
exceeded.

Recommended fix: choose a practical description limit, enforce it for creation
and both decoders, bound the total query before parsing, and bound timezone
metadata. An HTML `maxlength` alone would not protect recipients because attackers
can construct links directly. Keep the existing decompression limit and chunking.

## Why the reviewed payload paths resist execution

- `src/js/app.js:161` assigns descriptions to `textContent`. Markup, event-handler
  attributes, script tags, and `javascript:` text remain text.
- `src/js/event-link.js:50-56` uses `JSON.parse` and checks a three-item array with
  typed fields. There is no evaluation of decoded strings or merge into an object
  prototype.
- `src/js/event-link.js:70-95` builds links with `URL` and `URLSearchParams`.
  Its caller supplies `window.location.href` as the base. Event fields cannot
  replace the URL scheme or host, and unrelated query parameters and fragments
  are cleared. If this helper is reused elsewhere, preserve that trusted-base
  assumption or explicitly allow only HTTP(S) bases.
- `src/js/app.js:113-135` gives the generated URL to the QR library, which renders
  a canvas PNG. The download is a PNG, and there is no QR upload/scanning or
  arbitrary-image decoding feature in this application.
- Date inputs are validated; organizer timezone metadata is validated before
  formatting and is also rendered as text.
- Production is a static bundle. There is no application API, database query,
  shell command, template evaluation, or server-side event decompression reached
  from an event payload. The preview server ignores query data for file lookup.
- Release packaging validates asset names, rejects source-tree symlinks, and
  checks archive paths before extraction. Release execution is a separate manual
  workflow, not a route reachable through an event link. Workflow actions are
  pinned to commits.

## Validation performed

- 95 existing unit tests passed.
- Production webpack build passed.
- All 10 existing Chromium browser tests passed, including link/QR tests.
- 34 additional targeted checks passed in Chromium and another 34 in WebKit.
  These covered 12 hostile descriptions in both link formats, eight malformed
  or oversized compressed inputs, and two creation/QR flows. Checks asserted
  exact text rendering, no injected child elements, no execution sentinel changes,
  no unexpected requests, and no page errors. These additional checks were run
  as an ad hoc harness and are not added to the repository test suite.
- The targeted Firefox harness could not launch Firefox in the local environment;
  no Firefox result is claimed.
- 2,000 random malformed compressed inputs produced no uncaught decoder errors.
- Boundary probes confirmed rejection above the compressed decoded-data limit
  and acceptance of an oversized plain description.
- Live `npm audit --json` reported zero known vulnerabilities across the locked
  dependency tree at review time. This is an advisory-database check, not a manual
  audit of every dependency or assurance about future advisories.
- The preview-server crash was reproduced against the actual server process.

QR generation and the URL handling were tested. Independent phone cameras,
scanner applications, and their browser engines were not audited.

## Remaining trust boundaries

Compression is not encryption or authentication. Anyone with a link can read or
change the event, and anyone can create an event that appears on this site.
Descriptions should not be treated as verified statements from the site owner.
Text-only rendering prevents executable markup, but cannot prevent deceptive text.

Both formats place event data in the query string. The initial request therefore
exposes it to the hosting infrastructure, and it can appear in browser history,
logs, and link-preview services. A no-referrer policy reduces subsequent referrer
disclosure; it does not conceal the initial request. Avoid putting secrets in
event descriptions. A future fragment-based format could keep event data out of
ordinary HTTP requests, but would require a deliberate format change.

A QR code can always be replaced with one pointing to an unrelated malicious
site. These results apply to links served by the reviewed application, not to
every QR code someone labels as an event timer.

Recommended next work: fix the preview-server crash, configure and test CSP on
the actual host, then add shared input limits and permanent security regression
tests. Keep dependency advisory checks part of maintenance. No application code
or deployment settings were changed during this review.
