# screenflag — PLAN

One task per session. Each has its own verification. Ordered so the thing is usable from a real
bookmark by task 3, before any of the new features land.

Read PROFILE.md first. Decisions PROFILE.md does not answer: stop and ask.

---

## Task 1 — The shell, carried over

- [ ] `src/screenflag.js`: the overlay as it already works — top bar, stage, route rail,
      iframe, auto-advance, pause, preset widths, close
- [ ] Scale-to-fit with the **wrapper sized to the scaled dimensions** (Sacred Rule 2, and the bug
      that cut the title off the left edge the first time)
- [ ] Look exactly per PROFILE §8b — same colours, same type, same radii
- [ ] Guard: refuses to double-inject; a second click re-opens rather than stacking

**Verify:** paste into the console on the live GMSA admin while logged in. All 9 routes load,
auto-advance runs, pause holds, 1440 scales down, and the tool's own page does not scroll sideways
at any preset. Measure it, do not eyeball it.

## Task 2 — Routes per site

- [ ] Route list read from `localStorage` keyed by origin; sensible default when empty
- [ ] Add / rename / remove / reorder routes from the UI
- [ ] "Add current page" button — grabs the path you are on
- [ ] Empty state that says what to do, not just a blank rail

**Verify:** add three routes on the GMSA origin, reload, they are still there. Open a different
origin, its list is separate and empty.

## Task 3 — Bookmarklet delivery

- [ ] `bookmarklet.js` — short loader that injects `src/screenflag.js` from the CDN
- [ ] `install.html` — a page with the draggable bookmarklet link and one-line instructions
- [ ] CSP failure prints a plain message naming CSP, not a stack trace (Sacred Rule 3)
- [ ] README with the one-paragraph pitch and the install link

**Verify:** drag the bookmark to the bar on a clean Chrome profile, click it on the live GMSA
admin, tool opens. Click it on a site with strict CSP and confirm the message is the readable one.

> Usable by a teammate from here on. Everything below is the actual product.

## Task 4 — Drag to resize

- [ ] Right-edge drag handle, live width readout while dragging
- [ ] Bottom-edge handle for height
- [ ] Snap indicator when passing a common breakpoint (320/375/768/1024/1440)
- [ ] Presets stay; dragging updates the active preset to "custom"

**Verify:** drag from 320 to 1440 and confirm the frame's real `clientWidth` tracks the readout
exactly, and that the page under review re-lays-out at each breakpoint as it crosses.

## Task 5 — Frame, scale, and full-page

- [ ] Device bezel toggle (cosmetic only, must not change the frame's CSS width)
- [ ] Scale control: fit / 100% / 75% / 50%, true width always printed beside it
- [ ] Device ↔ full-page toggle; full page grows the frame to `scrollHeight` and scales it down

**Verify:** at 1440 scaled to 50%, assert `iframe.clientWidth === 1440` — the picture shrank, the
test did not. Full-page mode shows a long page end to end with no inner scrollbar.

## Task 6 — Measure

- [ ] Port the probe: horizontal overflow + offending element, tap targets < 44px (measuring a
      checkbox by its label), text < 12px, nested scrollers, off-canvas elements ignored
- [ ] Runs on every route change; result badge in the top bar
- [ ] Cross-origin or auth-redirect → says so, never a zero (Sacred Rule 3)

**Verify:** against `test/selftest.html`, which ships a deliberate 320 overflow, a 30px button and
a 10px label. The probe must find exactly those three and nothing else.

## Task 7 — Flag

- [ ] Bookmark/star control in the top bar; filled when the current screen is flagged
- [ ] Note field; auto-captures path, width, height, mode, timestamp, current findings
- [ ] Flag list panel: jump back to a flagged screen at the width it was flagged at
- [ ] Clear one / clear all, with confirm on clear all

**Verify:** flag three screens at three widths, reload the page, all three survive and each jumps
back to the exact route and width.

## Task 8 — Export and import

- [ ] Export routes + flags as one versioned JSON blob, copy to clipboard
- [ ] Import by paste; version mismatch says so plainly
- [ ] Human-readable summary export (markdown list) for pasting into WhatsApp or an issue

**Verify:** export on one Chrome profile, import on another, and confirm identical routes and
flags. Import a blob with a bumped version and confirm the warning.

## Task 9 — Harden and share

- [ ] `test/selftest.html` green; `npm run check` passes
- [ ] Works on: live GMSA admin (logged in), localhost dev server, a plain public site
- [ ] Named failure on cross-origin measurement and on CSP block
- [ ] README: what it is, install, the five things it does, the two things it cannot
- [ ] Public repo pushed; install link handed to the crew

**Verify:** a teammate installs from the link on their own machine and gets to a flagged list
without asking a question.

---

## Later, explicitly not now

Chrome extension shell (only if CSP actually bites) · side-by-side multi-width · screenshots ·
shared/hosted flag lists · other rendering engines.
