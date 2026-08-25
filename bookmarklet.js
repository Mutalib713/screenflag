/*
 * Loader. Kept tiny so the bookmark stays one short line; the real tool is fetched fresh each
 * click, which is how a fix reaches the whole team without anyone re-copying anything.
 */
(function () {
  var existing = document.getElementById("__screenflag_host");
  if (existing) { existing.remove(); return; }
  var s = document.createElement("script");
  s.src = "https://screenflag.vercel.app/src/screenflag.js";
  s.onerror = function () {
    alert(
      "screenflag could not load.\n\n" +
      "Most likely this site blocks injected scripts with a Content Security Policy " +
      "(GitHub and X do this). Your own apps normally do not.\n\n" +
      "It is not a network problem and retrying will not help on this site."
    );
  };
  document.documentElement.appendChild(s);
})();
