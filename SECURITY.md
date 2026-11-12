# Security policy

Tz Global Event Timer is maintained by one person. That person is disabled and has other life obligations. The work matters. A security report is welcome. A reply, a fix, and any date for either are not promised.

## Report it in private

Use GitHub private vulnerability reporting:

[Report a vulnerability](https://github.com/taggedzi/tz-global-event-timer/security/advisories/new)

That form stays between you and the maintainer. Please do not open a public issue, pull request, or discussion for a security problem. Please do not post exploit details in public.

If that page will not take a report, contact [Matthew Craig](https://github.com/taggedzi) through GitHub and say that you have a security report. Wait for a private channel before you send the details.

## What helps

- What you found, in a few sentences.
- How to see it: steps, a link, and a browser.
- Who it affects, if you know.
- Whether you plan to talk about it in public.

Leave passwords and other secrets out of the report. Describe them instead.

## What to expect

Reports get read when the maintainer can read them. Some reports get no reply.

Please leave the details private while the report is open. If you need to publish them, say so in the private report. There is still no date to commit to.

When a fix happens, it lands on `main` and in a later release. Older releases are not kept up as a separate line.

## What this covers

This is a static site. The event time travels inside the link. An optional password hides the time and the note until someone types it. Anyone with the link can try guesses on their own computer. A password is not a promise that the event stays private.

Problems in the site, the link format, or the release files are in scope. A problem that exists only in a host this project does not control, or only in the browser itself, is usually outside what this repository can change.
