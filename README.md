# Tz Global Event Timer

This project was created to help manage events in multiple timezones. I play games with people around the world and co-ordinating when things will start is always difficult.  I created this project to make this process easier.

## Usage

Load the page into a web browser. Select a date/time for the event in your LOCAL time. Optionally, you can add a short description, then click the Create Event Link. It will generate a URL. You can click on it directly, manually copy the link, or click the copy to clipboard button. Distribute that link to friends, when they view it they will see the even shown in their local time zone with a count down to the event.

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
