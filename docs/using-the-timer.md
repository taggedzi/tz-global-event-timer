# Using the timer

For people who create event links and for people who open them.

The [home page](../README.md) shows the short version and the pictures. This page is the rest of the detail.

## Create an event

1. Choose the **Event time zone**. Search by city or region, such as `London`, or type a name such as `America/New_York`.
2. Choose the **Event date and time** in that zone.
3. Add a **Description** if you want one. Plain text only. The limit is 4,096 bytes, which is about 4,000 letters. Emoji and some other characters count as more than one.
4. Leave **Compress event link** checked. The site uses the shorter of the two link shapes.
5. Click **Create event link**.

Leave secrets and sensitive information out of event links. Anyone with a public link can read the event details. Public links may appear in hosting logs.

The line under the button confirms the date, the time, the zone, and the offset from UTC. UTC is the shared world clock. `UTC-04:00` means four hours behind it.

If you change the form after that, the old link is cleared. Create a new one before you copy again.

**Copy link** says it worked only after the browser confirms the copy. If copying is blocked, the link box is selected so you can copy it yourself.

## Passwords

Password protection is disabled by default because the legal implications of hosting it are unclear. Anyone who enables and hosts it takes responsibility for doing so. If you open a protected link on a site with the feature disabled, the site will ask you to get a new link from the organizer.

When the site owner has enabled the feature, fill in **Protect with a password** before you create the link. The browser locks the time, the description, and your time zone inside the link. Leave the box blank for a public link.

- Password protection reduces casual access. Anyone with the link can try guesses on their own computer.
- Choose a strong, unique password, such as a long, randomly generated password or passphrase.
- Send the password through a separate channel. A message that includes both the password and the link or QR code exposes both if someone intercepts or forwards it.
- Knowing the password gives no assurance about who sent the link. Check the [official addresses](../README.md#official-addresses) before entering a password.

Friends see a box titled **Password protected event**. They type the password and click **Unlock event**. A wrong password, or a link that was edited, shows an error and does not open the event.

Creating and unlocking a protected link needs the browser’s built-in crypto tools. That works on a site served over HTTPS. It also works in a local preview at `127.0.0.1`. This flow is tested in Chromium, Firefox, and WebKit.

Recipients can share unlocked details through copied text, text downloads, calendar files, or printouts. A calendar file is plain text and contains the start time and description. Passwords and source links are left out of the calendar metadata.

## QR codes

**Generate QR code** draws a square code for the whole link. Download the PNG or print it. On sites with password protection enabled, scanning a protected link opens the same password box.

A typical event fits. A very long link may not. About 2,300 characters is a rough guide for a normal event URL. The real limit depends on how the characters are encoded. If the site says the link is too long, keep **Compress event link** checked or shorten the description, then create the link again. You can still share the link itself.

The size chart is on the [QR code version page](https://www.qrcode.com/en/about/version.html).

## When the clock jumps

Twice a year, some time zones move the clock forward or back.

- If the clock moves forward, one hour does not exist. Pick another time.
- If the clock moves back, one hour happens twice. The site asks you to choose the first or the second time, and it shows the UTC offset for each.

## What someone sees

The page opens in the time zone of their browser. **Display time zone** can show another zone, or switch back to local time. The countdown still tracks the same moment.

Your time zone appears as **Organizer time** when the link includes a valid zone. If the browser cannot name a time zone, the page shows the time in UTC and says so.

The computer’s own time zone setting is enough.

The countdown rounds leftover seconds up. At the exact moment of the event, it changes to **Event has already started.** It refreshes when the tab is visible again. The countdown follows the device clock. An inaccurate clock can make the countdown wrong. The moment stored in the link stays fixed.

The timer displays the details supplied by whoever made the link. Confirm important times and unexpected details with the organizer through a contact method you already trust.

## Save or share the time

On the event card:

| Button | What it does |
| --- | --- |
| Download text | Saves the time on screen, and the description, as a text file |
| Download calendar file (.ics) | Saves one calendar event named **Event** |
| Copy text | Copies that same text. If copying is blocked, the text is selected for you |
| Print event | Prints the time and the description |

The calendar file uses the saved start time. Changing **Display time zone** changes the screen, and the file still starts at the same moment. The steps for the file format are in [Calendar export](calendar-export.md). That note is for people changing the code.

## Links remember one moment

A link is a copy of the event at the time you clicked **Create event link**. If the schedule changes, create and send a replacement link. People who keep the old link still see the old details. The site has no central event record, so organizers cannot revoke previously shared links.
