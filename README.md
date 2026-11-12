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
