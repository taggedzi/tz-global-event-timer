# Calendar file export

**Status** · Approved

A visitor who opens a timer link can download one timed event as an iCalendar
(`.ics`) file and import it into a calendar app. The app exports the event's
start time and optional description.

## Scope

This feature covers a one-time download of the event shown in the viewer.
Calendar file import into the timer, all-day and recurring events, multi-event
files, invitations, and calendar subscriptions are outside the scope.

## Viewer behavior

- Add a **Download calendar file (.ics)** button next to **Download text** in
  the event actions. Make it available for valid public links and for protected
  links after successful unlock, including events whose start time has passed.
- Download `event.ics` directly from the browser. Use the decoded event's
  stored start time and description. Changing **Display time zone** changes
  the viewer's display but has no effect on the exported start time.
- Treat the downloaded file as plain text, including when the source link is
  password-protected. Use a generic filename and leave credentials and the
  source link out of the generated calendar metadata.

## File format

Use UTF-8 with the media type `text/calendar;charset=utf-8`. Write one
`VCALENDAR` containing `VERSION:2.0`, a fixed product identifier (`PRODID`),
and one `VEVENT` with these properties.

| Property | Value |
| --- | --- |
| `UID` | An opaque, globally unique identifier, such as a UUID. Reuse it for repeated downloads from the same open viewer. |
| `DTSTAMP` | The UTC time when the file is generated. |
| `DTSTART` | The event's stored instant in UTC, to whole-second precision. Drop any fractional seconds. |
| `SUMMARY` | `Event`, since the timer has no title field. |
| `DESCRIPTION` | The original event description. Omit this property when the description is blank. |

Format timestamps as `YYYYMMDDTHHMMSSZ`. The timer models only a start, so omit
`DTEND` and `DURATION`. Calendar apps may display the event with their own
default duration.

Normalize CRLF and CR in the description to LF, then escape backslashes, commas,
semicolons, and line breaks as iCalendar text. A line in a description that
resembles a calendar property must remain part of the description. Replace
unsupported control characters with the Unicode replacement character. End each
line with CRLF. Fold long lines at 75 UTF-8 bytes or fewer, counting the leading
space on continuation lines and keeping multi-byte characters intact.

iCalendar dates use a four-digit year. If an existing timer link uses an
extended year, show a message when export is requested and keep the viewer
usable.

[iCalendar content lines](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.1) ·
[Text escaping](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.11) ·
[Event component](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1)

## Implementation

Add a small serializer in `src/js/` that takes the event data, export timestamp,
and UID. Wire it into `showEvent` in `src/js/app.js` and add the button to the
event actions in `src/index.html`. Use a browser-generated download. The existing
link format already carries the required event data. Update the README's
**Viewing and exporting an event** section when the feature ships.

## Acceptance criteria

- A keyboard-accessible action on a valid event viewer downloads `event.ics`
  for events with a four-digit year.
  Creation, invalid-link, and locked-event screens expose no calendar download.
- A calendar app imports exactly one timed event titled **Event** at the
  expected start instant. Changing the viewer's display zone leaves the
  downloaded `DTSTART` identical.
- The imported description preserves punctuation, Unicode, and line breaks.
  Events with blank descriptions also produce valid files.
- Public and successfully unlocked protected events export through the same
  viewer. Existing event links, the countdown, and the text, copy, and print
  actions continue to work.

## Testing

- **Unit tests.** Use a fixed timestamp and UID. Check required properties,
  UTC formatting, fractional-second handling, and blank descriptions. Verify
  CRLF and byte-based folding with a long Unicode description. Unfold the
  output and check escaping with punctuation, mixed line endings, and text
  such as `END:VEVENT` on its own line.
- **Browser tests.** Use Playwright's download event to verify the filename and
  file contents. Download before and after changing the display zone and check
  that `DTSTART` and `UID` match. Verify export for an already-started event,
  verify that a protected event only offers export after unlock, and check that
  an invalid link offers no export. Run `npm run check` for the unit suite,
  production build, and Chromium tests.
- **Calendar app check.** Create a timer for January 1, 2030 at 20:00 UTC.
  Use a two-line description with `Game night 🎮, snacks; bring a friend` on
  the first line and `Path: games\party` on the second. Download the file
  and import it into a test calendar in Google Calendar, Apple Calendar, and
  Outlook. With the calendar set to Asia/Tokyo, verify one event titled
  **Event** on January 2 at 05:00 and check that both description lines
  match. Record the client and result for each check.
  [Google Calendar](https://support.google.com/calendar/answer/37118) ·
  [Apple Calendar](https://support.apple.com/en-us/guide/calendar/icl1023/mac) ·
  [Outlook](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)
