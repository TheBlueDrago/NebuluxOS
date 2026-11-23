// The laptop's own keys: volume up and down, mute, and brightness up and down (the window manager catches them on
// the real computer), with a small indicator above the taskbar. Nebulux + 1 to 9 opens the apps on the taskbar.
"use strict";
(function () {
  let osdT = 0, unmuteTo = 0;
  function osd(kind, value) {
    let el = document.getElementById("osd");
    if (!el) { el = document.createElement("div"); el.id = "osd"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    const icon = kind === "bright" ? "sun" : value === 0 ? "mute" : "volume";
    el.innerHTML = `${NX.icon(icon, 20)}<span class="osd-bar"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></span><b>${Math.round(value)}</b>`;
    el.hidden = false; el.classList.remove("out"); clearTimeout(osdT); osdT = setTimeout(() => { el.classList.add("out"); setTimeout(() => (el.hidden = true), 250); }, 1400);
  }
  function key(k) {
    if (!NX.me) return; const p = NX.prefs();
    if (k === "vol-up" || k === "vol-down") { const v = Math.max(0, Math.min(100, (p.volume || 0) + (k === "vol-up" ? 5 : -5))); NX.setPref("volume", v); osd("vol", v); }
    if (k === "mute") { if (p.volume > 0) { unmuteTo = p.volume; NX.setPref("volume", 0); osd("vol", 0); } else { const v = unmuteTo || 50; NX.setPref("volume", v); osd("vol", v); } }
    if (k === "bright-up" || k === "bright-down") { const v = Math.max(30, Math.min(100, (p.brightness || 100) + (k === "bright-up" ? 10 : -10))); NX.setPref("brightness", v); osd("bright", v); }
    const m = /^app-([1-9])$/.exec(k); if (m) { const b = document.querySelectorAll("#tb-apps .tb-app")[+m[1] - 1]; if (b) b.click(); }
  }
  document.addEventListener("nx:key", (e) => key(e.detail || ""));
  // in a browser tab: Nebulux + 1 to 9
  addEventListener("keydown", (e) => { if (NX.me && e.metaKey && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); key("app-" + e.key); } });
  NX.osd = osd; NX.hwKey = key;
})();
