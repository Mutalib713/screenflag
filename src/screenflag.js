/*!
 * screenflag — responsive review station, injected into the page you are already on.
 *
 * Why injected rather than a separate app: it inherits your logged-in session, so admin screens
 * behind a login can be reviewed. That is the one thing Responsively App and friends cannot do.
 *
 * Sacred rules enforced in here (see PROFILE.md §8):
 *   - Scaling is transform only. The frame keeps its true CSS width, so the page under review
 *     lays out at the width the readout claims. Browser zoom is never used.
 *   - Nothing reports "clean" that was not actually measured. Cross-origin frames and login
 *     redirects say so instead of showing a zero.
 *   - No account, no server, no telemetry. Everything is localStorage until you export it.
 */
(function () {
  "use strict";

  var HOST_ID = "__screenflag_host";

  // Second click closes rather than stacking a second copy.
  var existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return;
  }

  /* ---------------------------------------------------------------- storage */

  var ORIGIN = location.origin;
  var K_ROUTES = "screenflag.routes." + ORIGIN;
  var K_FLAGS = "screenflag.flags." + ORIGIN;
  var K_PREFS = "screenflag.prefs";
  var EXPORT_VERSION = 1;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode or full quota — the tool still works, it just forgets */
    }
  }

  var routes = read(K_ROUTES, null);
  if (!routes || !routes.length) {
    routes = [{ label: "Current", path: location.pathname || "/" }];
    if (location.pathname !== "/") routes.push({ label: "Home", path: "/" });
  }
  var flags = read(K_FLAGS, []);
  var prefs = read(K_PREFS, {});

  var WIDTHS = [320, 375, 414, 768, 1024, 1440, 1920];
  var state = {
    i: 0,
    w: prefs.w || 375,
    h: prefs.h || 812,
    scale: prefs.scale || "fit", // "fit" | 1 | 0.75 | 0.5
    mode: prefs.mode || "device", // "device" | "full"
    frame: prefs.frame !== false,
    playing: false,
    timer: null,
    findings: null,
  };

  function savePrefs() {
    write(K_PREFS, {
      w: state.w, h: state.h, scale: state.scale, mode: state.mode, frame: state.frame,
    });
  }

  /* ------------------------------------------------------------------ probe */

  // Returns findings, or a reason it could not look. Never returns a clean result it did not earn.
  function measure(frameEl) {
    var d, win;
    try {
      d = frameEl.contentDocument;
      win = frameEl.contentWindow;
      if (!d || !d.body) return { blocked: "still loading" };
      void win.location.pathname; // throws on cross-origin
    } catch (e) {
      return { blocked: "cross-origin — cannot measure a page from another domain" };
    }

    var path = win.location.pathname;
    if (/login|signin|auth/i.test(path) && path !== routes[state.i].path) {
      return { blocked: "redirected to " + path + " — sign in, then re-run" };
    }

    var vw = frameEl.clientWidth;
    var cs = function (el) { return win.getComputedStyle(el); };

    function visible(el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      // Off-canvas counts as hidden. Honeypot fields are parked at -9999px on purpose;
      // reporting one as an undersized control is a false alarm.
      if (r.right <= 0 || r.bottom <= 0 || r.left >= vw) return false;
      var s = cs(el);
      return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    }
    function describe(el) {
      var c = String(el.className || "").split(/\s+/).slice(0, 2).filter(Boolean).join(".");
      var t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
      return el.tagName.toLowerCase() + (c ? "." + c : "") + (t ? ' "' + t + '"' : "");
    }
    // A checkbox inside a big label is not a small target: clicking the label toggles it.
    function hitBox(el) {
      var own = el.getBoundingClientRect();
      if (!/^(checkbox|radio)$/.test(el.type || "")) return own;
      var lab = el.closest("label");
      if (!lab && el.id) { try { lab = d.querySelector('label[for="' + CSS.escape(el.id) + '"]'); } catch (e) {} }
      if (!lab) return own;
      var lr = lab.getBoundingClientRect();
      return lr.height > own.height ? lr : own;
    }

    var all = [].slice.call(d.querySelectorAll("body *"));
    var over = all.filter(function (el) {
      return visible(el) && Math.round(el.getBoundingClientRect().right) > vw + 1;
    });
    var outermost = over.filter(function (el) { return over.indexOf(el.parentElement) === -1; });

    var controls = [].slice
      .call(d.querySelectorAll('button, input:not([type="hidden"]), select, textarea, [role="button"], a[class*="py-"], a[class*="min-h"]'))
      .filter(visible)
      .filter(function (el) { var r = hitBox(el); return r.height < 44 || r.width < 24; })
      .map(function (el) {
        var r = hitBox(el);
        return describe(el) + "  " + Math.round(r.width) + "x" + Math.round(r.height);
      });

    var tiny = all
      .filter(function (el) { return visible(el) && !el.children.length && (el.textContent || "").trim(); })
      .filter(function (el) { return parseFloat(cs(el).fontSize) < 11.5; })
      .map(function (el) { return describe(el) + "  @" + cs(el).fontSize; });

    var scrollers = all
      .filter(visible)
      .filter(function (el) {
        return el.scrollWidth > el.clientWidth + 1 && ["auto", "scroll"].indexOf(cs(el).overflowX) > -1;
      })
      .map(function (el) { return describe(el) + "  " + el.clientWidth + "->" + el.scrollWidth; });

    var uniq = function (a) { return a.filter(function (v, k) { return a.indexOf(v) === k; }).slice(0, 6); };

    return {
      overflow: Math.round(d.documentElement.scrollWidth - d.documentElement.clientWidth),
      overflowers: outermost.slice(0, 3).map(describe),
      targets: uniq(controls),
      tiny: uniq(tiny),
      scrollers: uniq(scrollers),
    };
  }

  function issueCount(f) {
    if (!f || f.blocked) return null;
    return (f.overflow > 1 ? 1 : 0) + f.targets.length + f.tiny.length;
  }

  /* --------------------------------------------------------------------- UI */

  var host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
  // Shadow DOM so the reviewed site's CSS cannot reach in and wreck the toolbar.
  var root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  root.innerHTML = [
    "<style>",
    ":host,*{box-sizing:border-box;}",
    ".wrap{position:fixed;inset:0;display:flex;flex-direction:column;background:#eef1ee;color:#16191a;",
    "  font:14px/1.5 'Source Sans 3','Segoe UI',system-ui,sans-serif;}",
    ".mono{font-family:'JetBrains Mono',Consolas,monospace;font-variant-ligatures:none;",
    "  font-feature-settings:'liga' 0,'calt' 0;}",

    ".bar{flex:0 0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:9px 14px;",
    "  background:#fff;border-bottom:1px solid #d3dcd1;}",
    ".ttl{font-weight:700;color:#004d27;white-space:nowrap;}",
    ".grp{display:inline-flex;gap:3px;padding:3px;background:#f4f6f3;border:1px solid #d3dcd1;border-radius:9px;}",
    ".grp button{font:inherit;font-weight:600;font-size:12.5px;min-height:36px;padding:0 11px;border:0;",
    "  border-radius:6px;background:transparent;color:#444d46;cursor:pointer;}",
    ".grp button[aria-pressed='true']{background:#006837;color:#fff;}",
    ".grp button:hover:not([aria-pressed='true']){background:#fff;color:#16191a;}",
    ".btn{font:inherit;font-weight:600;font-size:13px;min-height:38px;padding:0 15px;cursor:pointer;",
    "  border:1px solid #d3dcd1;border-radius:8px;background:#fff;color:#16191a;}",
    ".btn.pri{background:#006837;border-color:#006837;color:#fff;}",
    ".btn.pri[data-on='false']{background:transparent;color:#006837;}",
    ".btn:hover{border-color:#006837;}",
    ".readout{font-size:12px;color:#6b756d;white-space:nowrap;}",
    ".readout b{color:#16191a;font-weight:500;}",
    ".spacer{margin-left:auto;}",
    ".star{font-size:18px;line-height:1;min-height:38px;width:42px;padding:0;display:grid;place-items:center;}",
    ".star[data-on='true']{background:#006837;border-color:#006837;color:#fff;}",
    ".badge{font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;}",
    ".ok{background:#dff3e4;color:#0b5b30;}",
    ".bad{background:#fbeceb;color:#8c1d18;}",
    ".warn{background:#fdf3dd;color:#6b4c05;}",

    ".stage{flex:1 1 auto;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:16px;position:relative;}",
    ".scaler{position:relative;flex:0 0 auto;}",
    ".dev{position:absolute;top:0;left:0;transform-origin:top left;background:#fff;overflow:hidden;",
    "  box-shadow:0 14px 40px rgba(0,45,25,.13);}",
    ".dev.framed{border:10px solid #16191a;border-radius:22px;}",
    ".dev.plain{border:1px solid #d3dcd1;border-radius:10px;}",
    ".dev iframe{display:block;border:0;background:#fff;width:100%;height:100%;}",
    ".grip{position:absolute;top:0;bottom:0;width:14px;cursor:ew-resize;display:grid;place-items:center;}",
    ".grip::after{content:'';width:4px;height:44px;border-radius:2px;background:#b9c6bb;}",
    ".grip:hover::after,.grip.on::after{background:#006837;}",
    ".gripB{position:absolute;left:0;right:0;height:14px;cursor:ns-resize;display:grid;place-items:center;}",
    ".gripB::after{content:'';height:4px;width:44px;border-radius:2px;background:#b9c6bb;}",
    ".gripB:hover::after,.gripB.on::after{background:#006837;}",

    ".rail{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:8px 14px;background:#fff;border-top:1px solid #d3dcd1;}",
    ".rail button{font:inherit;font-size:12px;min-height:34px;padding:0 12px;white-space:nowrap;cursor:pointer;",
    "  border:1px solid #d3dcd1;border-radius:999px;background:#f4f6f3;color:#444d46;}",
    ".rail button[aria-current='true']{background:#006837;border-color:#006837;color:#fff;font-weight:600;}",

    ".panel{position:absolute;right:16px;top:16px;width:360px;max-height:calc(100% - 32px);overflow:auto;",
    "  background:#fff;border:1px solid #d3dcd1;border-radius:10px;box-shadow:0 14px 40px rgba(0,45,25,.16);",
    "  padding:14px;z-index:5;}",
    ".panel h3{margin:0 0 8px;font-size:14px;color:#004d27;}",
    ".panel textarea{width:100%;min-height:70px;font:inherit;font-size:13px;padding:8px;",
    "  border:1px solid #d3dcd1;border-radius:7px;resize:vertical;}",
    ".panel .row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}",
    ".flagItem{border-top:1px solid #e5ebe6;padding:9px 0;font-size:13px;}",
    ".flagItem:first-of-type{border-top:0;}",
    ".flagItem .meta{font-size:11px;color:#6b756d;}",
    ".flagItem button{font:inherit;font-size:11.5px;padding:3px 8px;margin-top:5px;margin-right:5px;",
    "  border:1px solid #d3dcd1;border-radius:6px;background:#f4f6f3;cursor:pointer;}",
    ".muted{color:#6b756d;font-size:12.5px;}",
    ".findings{font-size:11.5px;color:#6b756d;margin-top:6px;white-space:pre-wrap;}",
    "</style>",

    "<div class='wrap'>",
    "  <div class='bar'>",
    "    <span class='ttl'>screenflag</span>",
    "    <button class='btn pri' id='play' data-on='false'>Play</button>",
    "    <div class='grp' id='widths'></div>",
    "    <div class='grp' id='scales'></div>",
    "    <div class='grp' id='modes'></div>",
    "    <button class='btn' id='frameBtn'>Frame</button>",
    "    <span class='readout mono' id='readout'></span>",
    "    <span class='badge ok' id='badge'>—</span>",
    "    <span class='spacer'></span>",
    "    <button class='btn star' id='star' title='Flag this screen'>&#9734;</button>",
    "    <button class='btn' id='flagsBtn'>Flags</button>",
    "    <button class='btn' id='routesBtn'>Routes</button>",
    "    <button class='btn' id='close'>Close</button>",
    "  </div>",
    "  <div class='stage' id='stage'>",
    "    <div class='scaler' id='scaler'>",
    "      <div class='dev' id='dev'><iframe id='frame'></iframe></div>",
    "    </div>",
    "    <div class='grip' id='grip'></div>",
    "    <div class='gripB' id='gripB'></div>",
    "  </div>",
    "  <div class='rail' id='rail'></div>",
    "</div>",
  ].join("\n");

  var $ = function (id) { return root.getElementById(id); };
  var stage = $("stage"), scaler = $("scaler"), dev = $("dev"), frame = $("frame");
  var rail = $("rail"), readout = $("readout"), badge = $("badge"), star = $("star");
  var grip = $("grip"), gripB = $("gripB");

  /* ------------------------------------------------------------------ fit */

  function currentScale() {
    var room = Math.max(240, stage.clientWidth - 60);
    if (state.scale === "fit") return Math.min(1, room / state.w);
    return state.scale;
  }

  function fit() {
    var s = currentScale();
    var h = state.mode === "full" ? state.fullH || state.h : state.h;
    dev.style.width = state.w + "px";
    dev.style.height = h + "px";
    dev.style.transform = "scale(" + s + ")";
    dev.className = "dev " + (state.frame ? "framed" : "plain");
    // The wrapper carries the SCALED size as real layout size. transform is visual only, so
    // without this the stage scrolls sideways and the toolbar gets pushed off screen.
    var outW = Math.round(state.w * s) + (state.frame ? 20 * s : 2 * s);
    var outH = Math.round(h * s) + (state.frame ? 20 * s : 2 * s);
    scaler.style.width = outW + "px";
    scaler.style.height = outH + "px";

    var r = scaler.getBoundingClientRect();
    var sr = stage.getBoundingClientRect();
    grip.style.left = Math.round(r.right - sr.left) + "px";
    grip.style.top = "16px";
    grip.style.height = outH + "px";
    gripB.style.top = Math.round(r.bottom - sr.top) + "px";
    gripB.style.left = Math.round(r.left - sr.left) + "px";
    gripB.style.width = outW + "px";

    readout.innerHTML =
      "<b>" + state.w + "&times;" + h + "</b> css px &middot; shown at " + Math.round(s * 100) + "%";
    [].forEach.call(root.getElementById("widths").children, function (b) {
      b.setAttribute("aria-pressed", String(+b.dataset.w === state.w));
    });
  }

  /* --------------------------------------------------------------- navigate */

  function go(n) {
    state.i = (n + routes.length) % routes.length;
    state.findings = null;
    frame.src = routes[state.i].path;
    [].forEach.call(rail.children, function (b, k) {
      b.setAttribute("aria-current", String(k === state.i));
    });
    if (rail.children[state.i]) rail.children[state.i].scrollIntoView({ block: "nearest", inline: "center" });
    syncStar();
    badge.className = "badge warn";
    badge.textContent = "measuring…";
  }

  frame.addEventListener("load", function () {
    setTimeout(function () {
      if (state.mode === "full") {
        try {
          state.fullH = frame.contentDocument.documentElement.scrollHeight;
          fit();
        } catch (e) { /* cross-origin: keep the fixed height */ }
      }
      state.findings = measure(frame);
      paintBadge();
    }, 900);
  });

  function paintBadge() {
    var f = state.findings;
    if (!f) { badge.className = "badge warn"; badge.textContent = "—"; return; }
    if (f.blocked) { badge.className = "badge warn"; badge.textContent = f.blocked; return; }
    var n = issueCount(f);
    badge.className = "badge " + (n ? "bad" : "ok");
    badge.textContent = n
      ? n + (n === 1 ? " issue" : " issues") + (f.overflow > 1 ? " · +" + f.overflow + "px wide" : "")
      : "clean at " + state.w;
  }

  function findingsText(f) {
    if (!f) return "not measured";
    if (f.blocked) return f.blocked;
    var out = [];
    if (f.overflow > 1) out.push("overflow +" + f.overflow + "px: " + (f.overflowers[0] || "?"));
    f.targets.forEach(function (t) { out.push("target " + t); });
    f.tiny.forEach(function (t) { out.push("small text " + t); });
    f.scrollers.forEach(function (t) { out.push("scroller " + t); });
    return out.length ? out.join("\n") : "clean";
  }

  /* ------------------------------------------------------------------ flags */

  function flagKey() { return routes[state.i].path + "@" + state.w; }
  function findFlag() {
    return flags.filter(function (f) { return f.path === routes[state.i].path && f.width === state.w; })[0];
  }
  function syncStar() {
    var on = !!findFlag();
    star.dataset.on = String(on);
    star.innerHTML = on ? "&#9733;" : "&#9734;";
  }

  star.onclick = function () {
    var existingFlag = findFlag();
    if (existingFlag) {
      flags = flags.filter(function (f) { return f !== existingFlag; });
      write(K_FLAGS, flags);
      syncStar();
      return;
    }
    openPanel("Flag this screen", [
      "<p class='muted mono'>" + routes[state.i].path + " &middot; " + state.w + "&times;" + state.h + "</p>",
      "<textarea id='note' placeholder='What looks wrong here?'></textarea>",
      "<div class='findings mono'>" + esc(findingsText(state.findings)) + "</div>",
      "<div class='row'><button class='btn pri' id='saveFlag'>Save flag</button>",
      "<button class='btn' id='cancelFlag'>Cancel</button></div>",
    ].join(""), function (p) {
      p.querySelector("#note").focus();
      p.querySelector("#cancelFlag").onclick = closePanel;
      p.querySelector("#saveFlag").onclick = function () {
        flags.push({
          id: Date.now(),
          path: routes[state.i].path,
          label: routes[state.i].label,
          width: state.w,
          height: state.h,
          mode: state.mode,
          note: p.querySelector("#note").value.trim(),
          findings: findingsText(state.findings),
          createdAt: new Date().toISOString(),
        });
        write(K_FLAGS, flags);
        syncStar();
        closePanel();
      };
    });
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------ panel */

  var panel = null;
  function closePanel() { if (panel) { panel.remove(); panel = null; } }
  function openPanel(title, html, after) {
    closePanel();
    panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = "<h3>" + esc(title) + "</h3>" + html;
    stage.appendChild(panel);
    if (after) after(panel);
  }

  $("flagsBtn").onclick = function () {
    if (panel && panel.dataset.kind === "flags") return closePanel();
    var body = flags.length
      ? flags.map(function (f) {
          return [
            "<div class='flagItem'>",
            "<div><b>", esc(f.label || f.path), "</b></div>",
            "<div class='meta mono'>", esc(f.path), " &middot; ", f.width, "px &middot; ",
            new Date(f.createdAt).toLocaleString(), "</div>",
            f.note ? "<div>" + esc(f.note) + "</div>" : "",
            "<div class='findings mono'>" + esc(f.findings) + "</div>",
            "<button data-go='", f.id, "'>Go there</button>",
            "<button data-del='", f.id, "'>Remove</button>",
            "</div>",
          ].join("");
        }).join("")
      : "<p class='muted'>No flags yet. Star a screen to add one.</p>";
    openPanel("Flags (" + flags.length + ")", body +
      "<div class='row'><button class='btn' id='exp'>Export</button>" +
      "<button class='btn' id='imp'>Import</button>" +
      (flags.length ? "<button class='btn' id='clr'>Clear all</button>" : "") + "</div>",
      function (p) {
        p.dataset.kind = "flags";
        p.querySelectorAll("[data-go]").forEach(function (b) {
          b.onclick = function () {
            var f = flags.filter(function (x) { return String(x.id) === b.dataset.go; })[0];
            if (!f) return;
            var idx = routes.map(function (r) { return r.path; }).indexOf(f.path);
            state.w = f.width; state.h = f.height;
            if (idx > -1) go(idx); else { frame.src = f.path; }
            fit(); closePanel();
          };
        });
        p.querySelectorAll("[data-del]").forEach(function (b) {
          b.onclick = function () {
            flags = flags.filter(function (x) { return String(x.id) !== b.dataset.del; });
            write(K_FLAGS, flags); syncStar(); $("flagsBtn").onclick();
          };
        });
        var clr = p.querySelector("#clr");
        if (clr) clr.onclick = function () {
          if (confirm("Remove all " + flags.length + " flags for this site?")) {
            flags = []; write(K_FLAGS, flags); syncStar(); $("flagsBtn").onclick();
          }
        };
        p.querySelector("#exp").onclick = doExport;
        p.querySelector("#imp").onclick = doImport;
      });
  };

  function doExport() {
    var blob = { version: EXPORT_VERSION, origin: ORIGIN, routes: routes, flags: flags };
    var text = JSON.stringify(blob, null, 2);
    var md = flags.length
      ? flags.map(function (f) {
          return "- **" + (f.label || f.path) + "** @" + f.width + "px — " +
            (f.note || "(no note)") + "\n  " + f.findings.replace(/\n/g, "\n  ");
        }).join("\n")
      : "(no flags)";
    openPanel("Export", [
      "<p class='muted'>JSON for a teammate to import, or the markdown summary to paste in chat.</p>",
      "<textarea id='out' style='min-height:150px' class='mono'>", esc(text), "</textarea>",
      "<div class='row'><button class='btn pri' id='cpJson'>Copy JSON</button>",
      "<button class='btn' id='cpMd'>Copy summary</button>",
      "<button class='btn' id='x'>Close</button></div>",
    ].join(""), function (p) {
      p.querySelector("#x").onclick = closePanel;
      p.querySelector("#cpJson").onclick = function () { copy(text, p.querySelector("#cpJson")); };
      p.querySelector("#cpMd").onclick = function () { copy(md, p.querySelector("#cpMd")); };
    });
  }

  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = t; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.remove();
  }

  function doImport() {
    openPanel("Import", [
      "<p class='muted'>Paste an exported blob. This replaces the routes and flags for this site.</p>",
      "<textarea id='in' style='min-height:150px' class='mono'></textarea>",
      "<div class='row'><button class='btn pri' id='doImp'>Import</button>",
      "<button class='btn' id='x'>Cancel</button></div>",
      "<p class='muted' id='msg'></p>",
    ].join(""), function (p) {
      p.querySelector("#x").onclick = closePanel;
      p.querySelector("#doImp").onclick = function () {
        var msg = p.querySelector("#msg");
        try {
          var blob = JSON.parse(p.querySelector("#in").value);
          if (blob.version !== EXPORT_VERSION) {
            msg.textContent = "That blob is version " + blob.version + ", this build reads version " +
              EXPORT_VERSION + ". Importing anyway may miss fields.";
          }
          if (blob.routes && blob.routes.length) { routes = blob.routes; write(K_ROUTES, routes); }
          if (blob.flags) { flags = blob.flags; write(K_FLAGS, flags); }
          buildRail(); go(0); syncStar(); closePanel();
        } catch (e) {
          msg.textContent = "That is not valid JSON: " + e.message;
        }
      };
    });
  }

  /* ----------------------------------------------------------------- routes */

  $("routesBtn").onclick = function () {
    if (panel && panel.dataset.kind === "routes") return closePanel();
    openPanel("Routes for " + ORIGIN.replace(/^https?:\/\//, ""), [
      "<p class='muted'>One per line, as <code>Label = /path</code> or just <code>/path</code>.</p>",
      "<textarea id='rt' style='min-height:170px' class='mono'>",
      esc(routes.map(function (r) { return r.label + " = " + r.path; }).join("\n")),
      "</textarea>",
      "<div class='row'><button class='btn pri' id='saveRt'>Save</button>",
      "<button class='btn' id='addCur'>Add current page</button>",
      "<button class='btn' id='x'>Cancel</button></div>",
    ].join(""), function (p) {
      p.dataset.kind = "routes";
      p.querySelector("#x").onclick = closePanel;
      p.querySelector("#addCur").onclick = function () {
        var ta = p.querySelector("#rt");
        var cur = "Page = " + (frameCurrentPath() || location.pathname);
        ta.value = ta.value.trim() + "\n" + cur;
      };
      p.querySelector("#saveRt").onclick = function () {
        var next = p.querySelector("#rt").value.split("\n").map(function (line) {
          line = line.trim();
          if (!line) return null;
          var m = line.split("=");
          if (m.length > 1) return { label: m[0].trim(), path: m.slice(1).join("=").trim() };
          return { label: line.replace(/^\//, "") || "Home", path: line };
        }).filter(Boolean);
        if (!next.length) return;
        routes = next; write(K_ROUTES, routes);
        buildRail(); go(0); closePanel();
      };
    });
  };

  function frameCurrentPath() {
    try { return frame.contentWindow.location.pathname; } catch (e) { return null; }
  }

  function buildRail() {
    rail.innerHTML = "";
    routes.forEach(function (r, k) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = r.label;
      b.onclick = function () { go(k); pause(); };
      rail.appendChild(b);
    });
  }

  /* --------------------------------------------------------------- controls */

  var widths = $("widths");
  WIDTHS.forEach(function (px) {
    var b = document.createElement("button");
    b.type = "button"; b.dataset.w = px; b.textContent = px;
    b.onclick = function () { state.w = px; savePrefs(); fit(); syncStar(); remeasure(); };
    widths.appendChild(b);
  });

  var scales = $("scales");
  [["fit", "Fit"], [1, "100%"], [0.75, "75%"], [0.5, "50%"]].forEach(function (pair) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = pair[1];
    b.setAttribute("aria-pressed", String(state.scale === pair[0]));
    b.onclick = function () {
      state.scale = pair[0];
      [].forEach.call(scales.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      savePrefs(); fit();
    };
    scales.appendChild(b);
  });

  var modes = $("modes");
  [["device", "Device"], ["full", "Full page"]].forEach(function (pair) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = pair[1];
    b.setAttribute("aria-pressed", String(state.mode === pair[0]));
    b.onclick = function () {
      state.mode = pair[0];
      [].forEach.call(modes.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      if (state.mode === "full") {
        try { state.fullH = frame.contentDocument.documentElement.scrollHeight; } catch (e) {}
      }
      savePrefs(); fit();
    };
    modes.appendChild(b);
  });

  $("frameBtn").onclick = function () {
    state.frame = !state.frame;
    $("frameBtn").style.borderColor = state.frame ? "#006837" : "#d3dcd1";
    savePrefs(); fit();
  };
  $("frameBtn").style.borderColor = state.frame ? "#006837" : "#d3dcd1";

  function remeasure() {
    state.findings = measure(frame);
    paintBadge();
  }

  /* ------------------------------------------------------------------- drag */

  function drag(handle, onMove) {
    handle.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("on");
      var startX = e.clientX, startY = e.clientY, w0 = state.w, h0 = state.h;
      var s = currentScale();
      function move(ev) {
        onMove(ev.clientX - startX, ev.clientY - startY, w0, h0, s);
        fit();
      }
      function up(ev) {
        handle.releasePointerCapture(ev.pointerId);
        handle.classList.remove("on");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        savePrefs(); syncStar(); remeasure();
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }
  // Divide by the scale: at 50% the pointer moves two screen px per one CSS px of frame.
  drag(grip, function (dx, dy, w0, h0, s) {
    state.w = Math.max(240, Math.min(2560, Math.round(w0 + dx / s)));
  });
  drag(gripB, function (dx, dy, w0, h0, s) {
    state.h = Math.max(320, Math.min(4000, Math.round(h0 + dy / s)));
  });

  /* ------------------------------------------------------------------- play */

  var play = $("play");
  function start() {
    state.playing = true; play.textContent = "Pause"; play.dataset.on = "true";
    clearInterval(state.timer);
    state.timer = setInterval(function () { go(state.i + 1); }, 3600);
  }
  function pause() {
    state.playing = false; play.textContent = "Play"; play.dataset.on = "false";
    clearInterval(state.timer);
  }
  play.onclick = function () { state.playing ? pause() : start(); };

  $("close").onclick = function () { clearInterval(state.timer); host.remove(); };

  root.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePanel();
  });
  window.addEventListener("resize", fit);

  /* ------------------------------------------------------------------- init */

  buildRail();
  fit();
  go(0);
  pause();
})();
