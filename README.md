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

Open **<https://screenflag.vercel.app/install>** and drag the button to your bookmarks bar. That is it — no
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

## Using it

1. Open the site you want to check and click the bookmark.
2. Click **Routes**, paste in the pages you care about — one per line, `Label = /path` — or browse
   the frame to a page and hit **Add current page**. Saved against that domain, so they are waiting
   next time.
3. Pick a width, or drag the right edge. **320 is where things break.**
4. Press **Play** to walk the list hands-free, or click a pill to jump to one page.
5. When something looks wrong, hit the **star** and write a line about it. The route, width, time
   and measurements are captured for you.
6. **Flags → Export** when you are done.

## Sharing what you found

**Flags → Export** gives you two buttons, for two different people:

- **Copy summary** — plain text for *anyone*, nothing installed. Paste into WhatsApp or an issue:
  ```
  - **Members** @320px — header pushes the page sideways on a small phone
    overflow +9px: a.flex-1.md:flex-none "person_addAdd New Member"
  ```
- **Copy JSON** — for someone who also has screenflag. They **Import** it and get your exact routes
  and flags, and can jump back to any flagged screen at the width you flagged it at.

To share the tool itself, send them the install link. Updates arrive on their own: the bookmark
loads the current file each click, so nobody re-copies anything.

## Development

Plain JavaScript, one file, no build step. Edit `src/screenflag.js` and reload.

```
npm run check
```

Lints the file and opens the self-test page, which loads the tool against a fixture with three
deliberate faults and asserts it finds exactly those.
