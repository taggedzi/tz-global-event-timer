# Hosting

For people who put the site on the web, and for people who publish a GitHub release.

The site is a folder of files. Node.js is for the build and the tests. Visitors need a normal web host and an address that starts with `https://`.

Pictures and the short tour are on the [home page](../README.md). People who change the code should use [Contributing](../CONTRIBUTING.md).

## Build the site

Install the Node.js version named in [`.nvmrc`](../.nvmrc) (26.13.1). Node.js 24 or newer can run the scripts.

```text
npm ci
npx playwright install chromium
npm run build
```

`npm run build` writes the finished site into `dist/` and then exits. `npm run prod` does the same thing, and is kept so older notes still work.

| Command | What it does |
| --- | --- |
| `npm run build` | One production build in `dist/` |
| `npm run build:dev` | One development build |
| `npm run dev` | Rebuilds while you edit. Stop it with Ctrl+C |
| `npm run serve` | Serves the built files at `http://127.0.0.1:4173` |
| `npm run check` | Unit tests, a production build, and the Chromium browser tests |

Run `npm run dev` and `npm run serve` in two terminals when you want a live preview. `npm run serve` only serves files that are already built.

Upload **the contents of `dist/`** to the host. Keep `index.html` and the files next to it together.

## Use HTTPS

HTTPS is the padlock in the browser. Password links and the copy buttons need it on a public site. A preview at `127.0.0.1` can do those jobs without a public certificate.

Also serve `.js` files as JavaScript and `.svg` files as SVG. If the host guesses the file type wrong, the page can fail to load.

## Headers to set on the host

The built HTML already sends a content security policy and a no-referrer policy. Set the same rules on the host. The frame rule only works when the browser receives it as a response header. The rule is explained in the [CSP `frame-ancestors` specification](https://www.w3.org/TR/CSP3/#directive-frame-ancestors).

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

These rules tell the browser to load this site’s own files, and to keep other sites from embedding the page.

## Check the live site

After you upload:

1. Confirm the response headers match the block above.
2. Create an event link and open it.
3. Lock a link with a password and unlock it.
4. Copy a link.
5. Download or print a QR code.

## Publish a GitHub release

You can publish from GitHub with no release command on your computer, and with no personal access token.

1. Open **Actions**.
2. Open **Release**.
3. Click **Run workflow**.
4. Choose **main**, or another branch you mean to release.
5. Click **Run workflow**.

The workflow tests that exact commit. It builds a ZIP, unpacks it, and runs the Chromium smoke test on the unpacked site before it publishes.

The release includes:

- `tz-global-event-timer-vYYYY.MM.DD.RUN.zip`
- A SHA-256 checksum file for that ZIP
- Change notes
- The source commit
- The build time in UTC
- A link to the workflow run

The date comes from the moment the workflow run was created, in UTC. The run number keeps two releases on the same day distinct. If you rerun that same run, the version stays the same, even after midnight.

A successful rerun leaves the release that is already published as it is. A failed upload leaves a draft, and that same run can retry the upload. Releases run one at a time. Ordinary CI, pushes, and tags do not publish a release.

Download the ZIP from the release. Check it before you upload it anywhere.

```text
sha256sum -c <filename>.zip.sha256
```

On Windows, compare the checksum file with:

```text
Get-FileHash <filename>.zip -Algorithm SHA256
```

Unpack the whole ZIP into the web root. Keep the assets and the license notices together.

The workflow uses GitHub’s built-in token. If repository rules reject a tag or a release, the workflow reports that error.
