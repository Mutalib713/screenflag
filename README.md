# screenflag

A responsive review station that opens **inside the page you are already looking at**.

Resize the viewport, step through your routes, measure each screen for real layout faults, and
**flag** the broken ones with a note. End the session with a list you can hand to someone.

## Why not just use Responsive Viewer / Responsively / Polypane

Those show you many widths. None of them close the loop:

- **They cannot see behind a login.** Responsively App is a separate browser, so your session does
  not come with it. screenflag runs in your tab, so an admin screen you are signed into just works.
- **They do not measure.** No overflow detection, no tap-target check, no font-size floor.
- **They do not remember.** There is no "these four screens are broken, here is the list."

## Install

Open **[install.html](install.html)** and drag the button to your bookmarks bar. That is it — no
extension, no account, nothing to compile.

Then click the bookmark on any page you want to review.

## What it does

| | |
|---|---|
| **Routes** | Save a route list per site. Your GMSA routes wait for you on GMSA; Perry's wait on Perry's. |
| **Widths** | Presets, plus drag the right edge to any width. The true CSS width is always shown. |
| **Scale** | Fit / 100% / 75% / 50%. Shrinks the *picture* only — the page still lays out at its real width. |
| **Device / full page** | Scroll inside a fixed height like a phone, or grow the frame to the whole document. |
| **Measure** | Horizontal overflow (naming the element), tap targets under 44px, text under 12px, nested scrollers. |
| **Flag** | Star a screen, add a note. Captures route, width, time and the findings. |
| **Export** | Routes and flags as JSON for a teammate, or a markdown summary for chat. |

## What it cannot do

- **Measure a page on another domain.** Browsers do not let one site read another's DOM. It will
  display, and it will say plainly that it cannot measure — it never reports a false all-clear.
- **Run on sites with a strict content security policy.** GitHub and X block injected scripts.
  Your own apps almost never do.
- **Replace a real device.** It changes the viewport, not the browser engine, the touch input or
  the GPU.

## Sharing with your team

Send them the install link. Then export your routes and flags and send them the blob — they import
it and see exactly your screens and your findings.

Updates arrive on their own: the bookmark loads the current file each click, so nobody re-copies
anything.

## Development

Plain JavaScript, one file, no build step. Edit `src/screenflag.js` and reload.

```
npm run check
```

Lints the file and opens the self-test page, which loads the tool against a fixture with three
deliberate faults and asserts it finds exactly those.
