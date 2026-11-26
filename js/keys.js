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

  // Settings > Accessibility > Color filters for color blindness: the screen's colors are shifted (daltonized) so that
  // red-green or blue-yellow differences show up as other differences
  const M = { protan: "1 0 0 0 0 -0.255 1.255 0 0 0 0.303 -0.545 1.242 0 0 0 0 0 1 0", deutan: "1 0 0 0 0 -0.438 1.438 0 0 0 0.262 -0.563 1.3 0 0 0 0 0 1 0", tritan: "1 -0.332 0.332 0 0 0 0.667 0.332 0 0 0 0 1 0 0 0 0 0 1 0" };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("aria-hidden", "true"); svg.style.cssText = "position:absolute;width:0;height:0";
  svg.innerHTML = Object.entries(M).map(([k, m]) => `<filter id="nx-cf-${k}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m}"/></filter>`).join("");
  document.body.appendChild(svg);

  // Settings > Accessibility > Find my pointer: press and let go of Ctrl (nothing else) and rings close in on the pointer
  let px = innerWidth / 2, py = innerHeight / 2, ctrlAlone = false;
  addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { capture: true, passive: true });
  addEventListener("keydown", (e) => { ctrlAlone = e.key === "Control" && !e.repeat && !e.shiftKey && !e.altKey && !e.metaKey; }, true);
  addEventListener("pointerdown", () => { ctrlAlone = false; }, true);
  addEventListener("keyup", (e) => {
    if (e.key !== "Control" || !ctrlAlone) return; ctrlAlone = false; if (!NX.me || !NX.prefs().findPointer) return;
    NX.findPointer();
  }, true);
  NX.findPointer = () => { const r = document.createElement("div"); r.className = "nx-findptr"; r.style.left = px + "px"; r.style.top = py + "px"; r.innerHTML = "<i></i><i></i><i></i>"; document.body.appendChild(r); setTimeout(() => r.remove(), 1100); };
  for (const name of ["alarmTone"]) { const orig = NX[name]; if (typeof orig === "function") NX[name] = function () { flash(); return orig.apply(this, arguments); }; }

  // ---------- Narrator: reads out loud what the keyboard is on, windows that open and messages (Settings > Accessibility,
  // or Ctrl + Nebulux + Enter). On the USB it speaks through speech-dispatcher and eSpeak NG (in the 4.4 USB and newer). ----------
  const SS = window.speechSynthesis;
  if (SS && SS.getVoices) SS.getVoices(); // starts loading the voices
  const N = NX.narrator = { last: "", said: [], on: () => !!(NX.me && NX.prefs().narrator) };
  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 220);
  N.speak = (text, now) => {
    text = clean(text); if (!text) return; N.last = text; N.said = [...N.said, text].slice(-12);
    if (!SS || typeof SpeechSynthesisUtterance === "undefined") return;
    try { if (now !== false) SS.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = +(NX.me && NX.prefs().narratorRate) || 1; SS.speak(u); } catch (e) { /* no voice */ }
  };
  // what a screen reader says about an element: its name, then what it is and its state
  N.describe = (el) => {
    if (!el || el === document.body || el === document.documentElement) return "";
    const tag = el.tagName.toLowerCase(), role = el.getAttribute("role") || "", type = (el.getAttribute("type") || "").toLowerCase();
    let name = el.getAttribute("aria-label") || (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute("alt") || "";
    if (!name && (tag === "input" || tag === "textarea")) name = el.getAttribute("placeholder") || "";
    if (!name) name = el.innerText || el.textContent || el.getAttribute("title") || "";
    name = clean(name).slice(0, 140);
    let what = "", state = "";
    if (tag === "button" || role === "button") what = "button";
    else if (tag === "a") what = "link";
    else if (tag === "select") { what = "combo box"; state = el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].text : ""; }
    else if (tag === "input" && (type === "checkbox" || type === "radio")) { what = type === "radio" ? "radio button" : "switch"; state = el.checked ? "on" : "off"; }
    else if (tag === "input" && type === "range") { what = "slider"; state = el.value; }
    else if (tag === "textarea" || tag === "input") { what = "edit text"; state = el.type === "password" ? "" : clean(el.value).slice(0, 80); }
    else if (role === "tab") { what = "tab"; state = el.getAttribute("aria-selected") === "true" ? "selected" : ""; }
    else if (/^h[1-6]$/.test(tag)) what = "heading";
    if (el.getAttribute("aria-pressed") === "true") state = state || "pressed";
    if (el.disabled) state = (state ? state + ", " : "") + "unavailable";
    return [name, what, state].filter(Boolean).join(", ");
  };
  addEventListener("focusin", (e) => { if (N.on()) N.speak(N.describe(e.target)); }, true);
  addEventListener("change", (e) => { if (N.on() && e.target.matches && e.target.matches("input[type=checkbox], input[type=radio], select")) N.speak(N.describe(e.target)); }, true);
  // the mouse too: buttons and links are read when the pointer rests on them
  let hoverT = 0, hoverEl = null;
  addEventListener("pointerover", (e) => {
    if (!N.on()) return; const el = e.target.closest && e.target.closest("button, a, [role=button], [role=tab], input, select, .fx-item, .tb-app, .sm-app");
    if (!el || el === hoverEl) return; hoverEl = el; clearTimeout(hoverT); hoverT = setTimeout(() => { if (el.matches(":hover") && document.activeElement !== el) N.speak(N.describe(el)); }, 450);
  }, true);
  document.addEventListener("nx:winopen", (e) => { if (!N.on()) return; const w = NX.wins && NX.wins.get(e.detail); if (w && w.app) setTimeout(() => N.speak(w.app.name + " window", false), 120); });
  // NX.toast and NX.beep come from shell.js, which loads after this file: wrap them once every script has run
  const later = () => {
    { const t0 = NX.toast; if (typeof t0 === "function" && !t0.nxN) { NX.toast = function (text) { if (N.on()) N.speak(text, false); return t0.apply(this, arguments); }; NX.toast.nxN = 1; } }
    { const b0 = NX.beep; if (typeof b0 === "function" && !b0.nxF) { NX.beep = function () { flash(); return b0.apply(this, arguments); }; NX.beep.nxF = 1; } }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", later); else later();
  N.toggle = () => { if (NX.me) NX.setPref("narrator", !NX.prefs().narrator); };
  document.addEventListener("nx:prefs", (e) => {
    if (e.detail !== "narrator" || !NX.me) return; const on = !!NX.prefs().narrator;
    if (on) { N.speak("Narrator is on. Press Control, Nebulux and Enter to turn it off."); setTimeout(() => { if (SS && SS.getVoices && !SS.getVoices().length && NX.prefs().narrator) NX.toast("Narrator can't find a voice on this computer. It speaks on the Nebulux OS 4.4 USB and newer."); }, 1500); }
    else { if (SS) SS.cancel(); N.last = "Narrator is off."; if (SS && typeof SpeechSynthesisUtterance !== "undefined") try { SS.speak(new SpeechSynthesisUtterance("Narrator is off.")); } catch (e) { /* no voice */ } }
  });
  addEventListener("keydown", (e) => { if (e.key === "Enter" && e.ctrlKey && (e.metaKey || (e.getModifierState && e.getModifierState("OS")))) { e.preventDefault(); N.toggle(); } }, true);
  document.addEventListener("nx:key", (e) => { if (e.detail === "narrator") N.toggle(); });
  addEventListener("keydown", (e) => { if (e.key === "Control" && N.on() && SS) SS.cancel(); }, true); // Ctrl stops the talking, like Windows
})();
