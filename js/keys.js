// Nebulux OS keyboard shortcuts, like Windows and macOS:
//   Ctrl + W closes the tab (or the window when it has no other tab), Ctrl + T and Ctrl + N open a tab,
//   Ctrl + Shift + T brings back the tab you closed, Ctrl + Tab and Ctrl + 1 to 9 move between tabs,
//   Ctrl + Plus, Minus and 0 (and Ctrl + the mouse wheel) zoom the window you're in, Ctrl + / lists every shortcut.
// The browser under Nebulux OS would take some of these keys for itself (Ctrl + W could close the whole screen),
// so Nebulux OS always keeps them.
// Also here: accessibility extras (a bold keyboard focus outline, flashing the screen for alerts).
"use strict";
(function () {
  const blocked = () => !NX.me || [...document.querySelectorAll("#lock, #oobe")].some((x) => !x.hidden);
  const active = () => { const w = NX.topWin && NX.topWin(); return w && w.el.classList.contains("active") ? w : null; };
  const isBrowserKey = (e) => (e.ctrlKey || e.metaKey) && !e.altKey && (/^[wtn]$/i.test(e.key) || e.key === "Tab" || /^[=+\-0]$/.test(e.key) || e.key === "_");

  // the zoom of one window (on top of Settings > Accessibility > Text size)
  const STEPS = [0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  NX.winZoom = (w, d) => {
    if (!w) return; const now = +(w.zoom || 1); let z = 1;
    if (d) { const i = STEPS.findIndex((s) => s >= now - 0.001); z = STEPS[Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? STEPS.length - 1 : i) + d))]; }
    w.zoom = z; w.el.style.setProperty("--winzoom", String(z)); w.onresize && w.onresize();
    NX.toast(w.app && w.app.name ? w.app.name + " at " + Math.round(z * 100) + "%" : Math.round(z * 100) + "%");
  };

  // Ctrl + / : the shortcut guide (the same one as Nebulux + /, in app-more.js)
  NX.shortcutsSheet = () => NX.shortcuts && NX.shortcuts();

  // first: keep the browser's own keys (close tab, new tab, page zoom) away from the browser
  addEventListener("keydown", (e) => { if (isBrowserKey(e)) e.preventDefault(); }, true);
  // then: do the Nebulux OS thing (after the app had its turn)
  addEventListener("keydown", (e) => {
    const c = e.ctrlKey || e.metaKey; if (!c || e.altKey || blocked() || e.nxDone) return;
    const k = e.key.toLowerCase(), w = active(), T = w && w.tabs;
    if (k === "/" || k === "?") { NX.shortcutsSheet(); }
    else if (k === "w" && !e.shiftKey) { if (!w) return; if (T && T.count() > 1) T.close(); else NX.close(w.id); }
    else if ((k === "t" || k === "n") && !e.shiftKey) { if (T) T.add(); else return; }
    else if (k === "t" && e.shiftKey) { if (T && T.reopen) T.reopen(); else return; }
    else if (e.key === "Tab") { if (T && T.count() > 1) T.step(e.shiftKey ? -1 : 1); else return; }
    else if (/^[1-9]$/.test(e.key) && !e.shiftKey) { if (!T) return; const n = T.count(), i = e.key === "9" ? n - 1 : +e.key - 1; if (i < n) T.go(i); }
    else if (k === "=" || k === "+") NX.winZoom(w, 1);
    else if (k === "-" || k === "_") NX.winZoom(w, -1);
    else if (k === "0" && !e.shiftKey) { if (w) NX.winZoom(w, 0); else return; }
    else return;
    e.preventDefault();
  });
  // Ctrl + the mouse wheel zooms the window under the pointer (and never the whole screen)
  addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); if (blocked()) return;
    const el = e.target.closest && e.target.closest(".win"), w = el && NX.wins && NX.wins.get(el.dataset.app); if (!w) return;
    const now = Date.now(); if (now - (w.zoomAt || 0) < 120) return; w.zoomAt = now; NX.winZoom(w, e.deltaY < 0 ? 1 : -1);
  }, { capture: true, passive: false });

  // Settings > Accessibility: flash the screen when an alert sound plays (for people who can't hear it)
  const flash = () => {
    if (!NX.me || !NX.prefs().flashAlerts) return; const f = document.createElement("div"); f.className = "nx-flash";
    document.body.appendChild(f); setTimeout(() => f.remove(), 700);
  };
  NX.flashAlert = flash;
  for (const name of ["beep", "alarmTone"]) { const orig = NX[name]; if (typeof orig === "function") NX[name] = function () { flash(); return orig.apply(this, arguments); }; }
})();
