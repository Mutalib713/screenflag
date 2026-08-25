# screenflag — PROFILE

**Canonical spec.** Anything not written here is undecided; anything written here does not get
quietly reversed. Sacred Rules change only with Mutalib's explicit approval.

*(Name is provisional. Say the word before the first share and it costs nothing to change.)*

---

## 1. What it is

A bookmarklet that turns any page you are already looking at into a responsive review station:
resize the viewport freely, step through a saved list of routes, **measure** each screen for real
layout faults, and **flag** the broken ones with a note so you can come back to them or hand the
list to someone else.

## 2. Who it is for

Mutalib, reviewing his own work, and the GMSA-UPSA dev crew reviewing each other's. Volunteer
students on shared laptops, near-zero budget, mixed hardware. A teammate must be able to go from
"never heard of this" to "looking at the flagged screens" without installing anything or creating
an account.

## 3. The problem, and what he does today

Checking responsiveness today means one of:

- resizing the browser by hand and eyeballing it, which misses the things that are 9px off
- a Node + Playwright script, which **fails on this machine intermittently** because Application
  Control blocks the browser executable, and which cannot see any page behind a login
- asking Claude to run it, which is not a tool he owns

None of these leave a record. He spots a broken screen, fixes something else, and forgets it.

## 4. The one success metric

**A review session ends with a shareable list of flagged screens.** Not "the tool ran" — a real
artifact a teammate can act on. If a session produces no list, the tool did not do its job.

## 5. Core features (v1)

1. **Overlay on the current page.** Injected into the page you are on, so it inherits your logged-in
   session. This is the whole reason it beats a separate app.
2. **Viewport control.** Preset widths, a **drag handle** to resize freely, and the true CSS width
   always printed. Height presets too.
3. **Scale to fit.** Zoom out to see a 1440 layout on a small laptop. See Sacred Rule 2.
4. **Device / full-page toggle.** Device scrolls inside a fixed height like a real phone; full page
   grows the frame to the whole document so nothing is hidden.
5. **Frame toggle.** A device bezel on or off, purely cosmetic.
6. **Route list per site.** Saved against the origin, so the routes you use on GMSA are waiting
   when you open it there, and Perry's list is waiting on Perry's.
7. **Auto-advance.** Cycle the routes hands-free, with pause.
8. **Measure.** Per screen: horizontal overflow (with the offending element named), tap targets
   under 44px, text under 12px, nested scrollers. Same probe logic as the sweep script.
9. **Flag.** A bookmark/star control plus a note. Captures route, width, timestamp and the current
   measurements automatically.
10. **Export / import.** Routes and flags as one blob of text, so a teammate imports and sees
    exactly your screens and your findings.

## 6. NOT IN V1

- Side-by-side multi-width view (Responsive Viewer already does this well and free)
- Screenshots or image capture
- Any server, account, database or hosted backend
- A Chrome extension build (the shell comes later only if page CSP actually blocks the loader)
- Cross-browser rendering (Firefox/Safari engines)
- Editing the page under review

## 7. Stack — **Mutalib's decision, 2026-08-25**

**Plain JavaScript, no build step.** One readable `src/screenflag.js`, no npm install, no compile,
nothing for Application Control to block. Chosen over TypeScript because the thing shared must be
the same file that is edited, and because this machine punishes toolchains.

- Storage: `localStorage`, scoped per origin — routes and flags live with the site they describe
- Delivery: a short loader bookmarklet that fetches `screenflag.js` from the public repo via CDN,
  so a fix reaches everyone on their next click with nothing re-copied
- Hosting: **none.** GitHub raw through a CDN. No Vercel project, no infra, $0/month.
- Repo: **public** (his decision, same day) so teammates need no account and no invite

> ⚠ **OPEN — the update story does not work yet.** Measured 2026-08-25: jsDelivr serves a stale
> copy of `@main` for hours after a push. A fix was pushed, `purge.jsdelivr.net` returned
> `"status":"finished"`, and the CDN still served the old file **70+ seconds and six checks
> later**. A commit-pinned URL (`@<sha>`) serves the new file instantly, but a pinned bookmark
> never updates, which defeats the point.
>
> So README's "updates arrive on their own, nobody re-copies anything" is **currently false**.
> Resolve before sharing widely. Candidates: deploy the repo as a Vercel static site (push →
> auto-deploy → fresh, still $0, but it is a change to this section and therefore Mutalib's call),
> or accept eventual consistency and document the lag honestly.

## 8. SACRED RULES

1. **Flags are the product.** If something must be cut, cut viewport polish. Never the flagging or
   the export. The tool exists to end a session with a list.
2. **Never change the tested width to make it fit.** Scaling is `transform: scale()` — picture only,
   the frame keeps its true CSS width and its real breakpoints. Browser zoom, which changes the
   effective viewport, is banned. **The true width is always displayed** so the user cannot be
   fooled about what was tested.
3. **Never report a clean result you did not actually measure.** Cross-origin frames cannot be
   read; auth-gated routes may redirect. Both must say so in place of a number. Silence that reads
   as "all clear" is the exact failure the sweep script shipped with.
4. **No account, no server, no telemetry.** Nothing leaves the machine unless the user exports it.
5. Read-only toward the page under review. The tool observes; it never submits forms or clicks
   through flows on the user's behalf.

## 8b. Look — locked, Mutalib's call 2026-08-25

**Keep the exact style of the overlay he has been using.** He pinned it by pointing at the working
tool and saying "same style and even the colours". Not a new direction; these values are canon and
do not get "improved" later.

| Role | Value |
|---|---|
| App ground | `#eef1ee` |
| Bars / surfaces | `#ffffff` |
| Recessed surface (button groups, pills) | `#f4f6f3` |
| Ink | `#16191a` |
| Ink, secondary | `#444d46` |
| Ink, muted / readouts | `#6b756d` |
| Accent — title | `#004d27` |
| Accent — active control | `#006837` (white text on it) |
| Rules / borders | `#d3dcd1` |
| Device shadow | `0 14px 40px rgba(0,45,25,.13)` |

- **Type:** `"Source Sans 3", Segoe UI, system-ui` for UI; `"JetBrains Mono", Consolas` for the
  width readout and any number. Mono ligatures **off** — `!==` must not render as a single glyph.
- **Shape:** 6px on buttons inside a group, 9px on the group, 8px on the primary button, 999px on
  route pills, 10px on the device frame.
- **Layout:** top bar (title · play/pause · widths · readout · close), stage in the middle, route
  pills along the bottom in a horizontally scrolling rail.

Deliberate: the tool wears its own colours regardless of the site under review, so tool chrome is
never mistaken for page chrome. It stays green on Perry's and on knust-hostels too.

## 9. Constraints

- **Ghana floor.** Volunteer laptops, slow links. The loaded file stays small and dependency-free;
  no framework, no CDN library beyond the tool itself.
- **This machine.** Application Control intermittently blocks executables — hence no Node runtime
  requirement for using the tool at all.
- **Page CSP.** A site with a strict script policy will block the loader. Known and accepted:
  it must fail with a plain message naming CSP, not a stack trace.
- **Same-origin only for measurement.** Display works anywhere framing is allowed; measurement
  needs same origin. Rule 3 governs how that is reported.

## 10. Data model

Everything in `localStorage`, keyed by origin.

- `screenflag.routes.<origin>` — `[{label, path}]`
- `screenflag.flags.<origin>` — `[{id, path, width, height, mode, note, findings, createdAt}]`
- `screenflag.prefs` — last width, frame on/off, mode, autoplay interval

Export is one JSON blob carrying a `version` field, so an old import announces itself instead of
failing quietly.

## 11. VERIFICATION

- `npm run check` — no build, so this lints the single file and runs the self-test page
- `test/selftest.html` — loads the tool against a fixture page with deliberate faults (a 320
  overflow, a 30px button, a 10px label) and asserts the probe finds exactly those
- Manual gate before any share: works on the live GMSA admin while logged in, and correctly
  refuses to report measurements on a cross-origin page

## 12. Prior art, and why this exists anyway

- **Responsive Viewer** (free Chrome extension) — many widths at once. No measuring, no flagging.
- **Responsively App** (free, Electron) — separate browser, so it does not carry your Chrome login.
- **Polypane** (paid) — very capable, costs money and needs procurement.
- **Sizzy** — abandoned; developer unresponsive, last update botched (HN, Mar 2025).

The viewport half is solved and free. **Nothing in the category closes the loop from "that looks
wrong" to "here is the list."** That loop is the product.
