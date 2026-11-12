# Event links

For people who build links by hand or in code.

A link holds the whole event. The site can be a plain folder of files, with no database. Visitors open one address and see the time in their own zone. The [home page](../README.md) shows that flow in pictures. Day-to-day steps are in [Using the timer](using-the-timer.md).

**Compress event link** is checked by default. The site uses the compressed form when that form is shorter. Clear the box to force the readable form below.

All of these forms carry the full event in the URL. They accept:

| Piece | Limit |
| --- | --- |
| Description | 4,096 UTF-8 bytes |
| Organizer time zone | 128 characters |
| Event data before encryption | 13 KiB |

Older links over those limits need to be created again with shorter values. A host, a chat app, or a browser can also impose a smaller URL limit of its own.

Links are a copy of one moment. Changing the event means sending a new link.

## A public link you can read

Add the query to your site address.

```text
https://your-site.example/?date=2026-06-20T23%3A30%3A00.000Z&desc=Saturday+game+night.+Bring+a+headset.&zone=America%2FNew_York
```

That sample is 7:30 PM in New York on June 20, 2026. In June, New York is four hours behind UTC, so the stored moment is `23:30` UTC.

| Name | Required | Meaning |
| --- | --- | --- |
| `date` | Yes | The exact moment in UTC, written in ISO 8601, ending in `Z`. It includes seconds, and it may include three-digit milliseconds |
| `desc` | No | The event note. Encode spaces and special characters. A space can be `+` |
| `zone` | No | An IANA time zone name, such as `America/New_York`. Visitors then see the organizer’s clock as well as their own |

`zone` is the organizer’s zone. Each visitor’s own browser still picks the local clock.

You can leave out `desc` or `zone`. When you build links in code, use `URLSearchParams` or another encoder so the values are escaped.

Valid older links that store a UTC string still open. The site rejects local-time strings, impossible dates, and a repeated `date` parameter, and it explains why. A link that only has tracking tags opens the create page.

## A shorter public link

When the compressed form is shorter, the query uses a single parameter named `v1`.

The value is unpadded base64url. Decode it as raw DEFLATE, then as UTF-8. The text is a JSON array:

1. The UTC moment, as milliseconds since 1970.
2. The description.
3. The organizer’s time zone, or `null`.

## A password link

A protected link stores the locked event in the fragment, after `#p1=`.

```text
https://your-site.example/#p1=<payload>
```

The payload is unpadded base64url. The bytes inside are:

1. A 16-byte random salt.
2. A 12-byte random IV.
3. The AES-256-GCM ciphertext, including its 16-byte authentication tag.

The browser builds the key from the password with PBKDF2-HMAC-SHA-256 and 600,000 iterations. The fragment is not sent to the host with the normal page request. A public link puts the event in the query string, which can show up in host logs.

The browser checks the size of a protected fragment before it starts that password work.
