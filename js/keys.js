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

  // Ctrl + / : every shortcut in one place
  const LIST = [
    ["Windows and apps", [["Ctrl + W", "Close the tab, or the window"], ["Ctrl + T", "New tab (Notepad, File Explorer)"], ["Ctrl + N", "New tab or note"], ["Ctrl + Shift + T", "Bring back the tab you closed"], ["Ctrl + Tab", "Next tab (add Shift to go back)"], ["Ctrl + 1 to 9", "Go to a tab"], ["Alt + F4", "Close the window, or shut down from the desktop"], ["Alt + Tab", "Switch between windows"], ["Nebulux + Arrow keys", "Snap a window to a side, or maximize it"], ["Nebulux + Z", "Snap layouts"], ["Nebulux + D", "Show the desktop"]]],
    ["Seeing better", [["Ctrl + Plus / Minus", "Zoom the window you're in"], ["Ctrl + 0", "Zoom back to 100%"], ["Ctrl + mouse wheel", "Zoom the window under the pointer"], ["Nebulux + Plus / Minus", "Magnifier"], ["Nebulux + Esc", "Stop the Magnifier"]]],
    ["Nebulux OS", [["Nebulux", "Open Start"], ["Nebulux + E", "File Explorer"], ["Nebulux + L", "Lock"], ["Nebulux + V", "Clipboard history"], ["Nebulux + W", "Widgets"], ["Nebulux + Shift + S", "Screenshot"], ["Ctrl + Shift + Esc", "Task Manager"], ["Ctrl + Alt + Delete", "Lock, switch user, sign out"], ["Ctrl + /", "This list"]]],
    ["Typing", [["Ctrl + C, X, V", "Copy, cut, paste"], ["Ctrl + Z", "Undo (File Explorer: put back what you deleted)"], ["Ctrl + F", "Find (Notepad)"], ["Ctrl + H", "Replace (Notepad)"], ["Ctrl + G", "Go to line (Notepad)"], ["F5", "Date and time (Notepad)"], ["F2", "Rename (File Explorer)"], ["Space", "Quick look at a file (File Explorer)"]]],
  ];
  NX.shortcutsSheet = () => {
    const old = document.querySelector(".nx-keys"); if (old) { old.remove(); return; }
    const d = document.createElement("div"); d.className = "nx-keys"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Keyboard shortcuts");
    d.innerHTML = `<div class="nk-card"><div class="nk-head"><b>Keyboard shortcuts</b><button class="wb nk-x" aria-label="Close" title="Close (Esc)">${NX.icon("close", 14)}</button></div><div class="nk-cols">${LIST.map(([h, rows]) => `<section><h4>${NX.esc(h)}</h4>${rows.map(([k, t]) => `<div class="nk-row"><span class="nk-k">${k.split(" + ").map((x) => `<kbd>${NX.esc(x)}</kbd>`).join("<i>+</i>")}</span><span class="nk-t">${NX.esc(t)}</span></div>`).join("")}</section>`).join("")}</div></div>`;
    const close = () => { d.remove(); removeEventListener("keydown", esc, true); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); } };
    d.onclick = (e) => { if (e.target === d || e.target.closest(".nk-x")) close(); };
    addEventListener("keydown", esc, true); document.body.appendChild(d); d.querySelector(".nk-x").focus();
  };

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
