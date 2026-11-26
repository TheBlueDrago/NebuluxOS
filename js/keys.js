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
  const isBrowserKey = (e) => e.ctrlKey && !e.metaKey && !e.altKey && (/^[wtn]$/i.test(e.key) || e.key === "Tab" || /^[=+\-0]$/.test(e.key) || e.key === "_");

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
    // only Ctrl: the Nebulux key is Meta, so Nebulux + W (Widgets) or Nebulux + T is never Ctrl + W or Ctrl + T
    const c = e.ctrlKey && !e.metaKey; if (!c || e.altKey || blocked() || e.nxDone) return;
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
    if (!e.ctrlKey) return; e.preventDefault(); if (blocked()) return;
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

  // ---------- the taskbar from the keyboard, like Windows: Nebulux + T goes to the apps, Nebulux + B to the icons on the
  // right; Left and Right move along, Home and End jump to the ends, Esc goes back ----------
  const tbItems = () => [...document.querySelectorAll("#taskbar button")].filter((b) => b.offsetParent !== null && !b.disabled);
  NX.taskbarFocus = (where) => { if (!NX.me) return; const L = tbItems(); const t = where === "tray" ? document.querySelector("#tb-qs") : document.querySelector("#tb-apps .tb-app") || document.querySelector("#tb-start"); (t || L[0]) && (t || L[0]).focus(); };
  document.addEventListener("nx:key", (e) => { if (e.detail === "tbar") NX.taskbarFocus("apps"); if (e.detail === "tray") NX.taskbarFocus("tray"); });
  addEventListener("keydown", (e) => {
    if (e.metaKey && !e.ctrlKey && !e.altKey && /^[tb]$/i.test(e.key)) { e.preventDefault(); NX.taskbarFocus(e.key.toLowerCase() === "b" ? "tray" : "apps"); return; }
    const a = document.activeElement; if (!a || !a.closest || !a.closest("#taskbar") || e.ctrlKey || e.altKey || e.metaKey) return;
    const L = tbItems(), i = L.indexOf(a); if (i < 0) return;
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? L.length - 1 : null;
    if (to != null) { e.preventDefault(); L[Math.max(0, Math.min(L.length - 1, to))].focus(); }
    else if (e.key === "Escape") { a.blur(); }
  });
  // ---------- Symbols (Nebulux + .): special characters for whatever you're typing in, like Windows' symbol panel
  // (symbols only: Nebulux OS doesn't use emojis) ----------
  const SYM = [
    ["Popular", "© ® ™ ° • … – — ¶ § † ‡ ‰ € £ ¥ ¢ ½ ¼ ¾ × ÷ ± ≈ ≠ ≤ ≥ ∞ √ π µ ← → ↑ ↓ ✓ ✗ ★ ☆"],
    ["Punctuation", "« » ‹ › “ ” ‘ ’ „ ‚ ¡ ¿ · ¦ ‖ ′ ″ ‴ ※ ⁂ ⁎ ⁑ ⸮"],
    ["Currency", "$ € £ ¥ ¢ ₹ ₩ ₽ ₺ ₴ ₦ ₱ ₫ ₪ ₡ ₲ ₵ ₸ ₿ ¤"],
    ["Math", "+ − × ÷ = ≠ ≈ ≡ < > ≤ ≥ ± ∓ √ ∛ ∜ ∞ ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ∩ ∪ ⊂ ⊃ ⊆ ⊇ ∀ ∃ ∅ ∝ ∠ ⊥ ∥ ° ′ ″ ¹ ² ³ ⁴ ½ ⅓ ⅔ ¼ ¾ ⅛ π"],
    ["Arrows", "← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⇔ ⇕ ↩ ↪ ↺ ↻ ➔ ➜ ➝ ➞ ➟ ➠ ⟵ ⟶ ⟷"],
    ["Letters", "á à â ä ã å æ ç é è ê ë í ì î ï ñ ó ò ô ö õ ø œ ß ú ù û ü ý ÿ Á À Â Ä Ã Å Æ Ç É È Ê Ë Í Ì Î Ï Ñ Ó Ò Ô Ö Õ Ø Œ Ú Ù Û Ü Ý"],
    ["Greek", "α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω"],
    ["Shapes", "■ □ ▪ ▫ ▲ △ ▼ ▽ ◆ ◇ ○ ● ◎ ◐ ◑ ★ ☆ ♠ ♣ ♥ ♦ ♤ ♧ ♡ ♢ ♪ ♫ ✦ ✧ ✱ ✳"],
  ];
  let lastEdit = null;
  const editable = (el) => el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|email|url|tel|password|)$/i.test(el.type || "")) || el.isContentEditable);
  addEventListener("focusin", (e) => { if (editable(e.target) && !e.target.closest(".nx-sym")) lastEdit = e.target; }, true);
  const put = (ch) => {
    const t = lastEdit; if (!t || !t.isConnected) { navigator.clipboard && navigator.clipboard.writeText(ch).catch(() => {}); if (NX.clip) NX.clip.add(ch); NX.toast("Copied " + ch + ". Paste it where you're typing."); return; }
    t.focus();
    if (t.isContentEditable) { document.execCommand("insertText", false, ch); return; }
    const a = t.selectionStart != null ? t.selectionStart : t.value.length, b = t.selectionEnd != null ? t.selectionEnd : a;
    t.setRangeText(ch, a, b, "end"); t.dispatchEvent(new Event("input", { bubbles: true }));
  };
  NX.symbols = () => {
    const old = document.querySelector(".nx-sym"); if (old) { old.remove(); return; }
    if (!NX.me) return;
    const recent = NX.data("sym-recent", []), groups = recent.length ? [["Recent", recent.join(" ")], ...SYM] : SYM;
    const d = document.createElement("div"); d.className = "nx-sym"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Symbols");
    let g = 0;
    const draw = () => {
      d.innerHTML = `<div class="sy-head"><b>Symbols</b><button class="wb sy-x" aria-label="Close" title="Close (Esc)">${NX.icon("close", 12)}</button></div><div class="sy-tabs" role="tablist">${groups.map(([n], i) => `<button role="tab" aria-selected="${i === g}" class="${i === g ? "on" : ""}" data-g="${i}">${NX.esc(n)}</button>`).join("")}</div><div class="sy-grid">${groups[g][1].split(" ").filter(Boolean).map((c) => `<button data-c="${NX.esc(c)}" aria-label="${NX.esc(c)}" title="${NX.esc(c)}">${NX.esc(c)}</button>`).join("")}</div><small class="sy-tip">Click a symbol to type it. Nebulux + . opens this any time.</small>`;
      d.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { g = +b.dataset.g; draw(); }));
      d.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { const c = b.dataset.c; put(c); NX.setData("sym-recent", [c, ...NX.data("sym-recent", []).filter((x) => x !== c)].slice(0, 24)); }));
      d.querySelector(".sy-x").onclick = () => d.remove();
    };
    draw(); document.body.appendChild(d);
    // keep the place you were typing in (clicking the panel would otherwise take the focus away)
    d.addEventListener("mousedown", (e) => { if (e.target.closest("[data-c]")) e.preventDefault(); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); d.remove(); if (lastEdit) lastEdit.focus(); } });
  };
  addEventListener("keydown", (e) => { if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "." || e.key === ";")) { e.preventDefault(); NX.symbols(); } }, true);
  document.addEventListener("nx:key", (e) => { if (e.detail === "symbols") NX.symbols(); });
  // ---------- Sticky Keys (Settings > Accessibility, or press Shift five times): press Ctrl, Alt, Shift or the Nebulux key
  // on its own, then the next key, and they work as if held together. A pill by the clock shows what's held. ----------
  const MODS = { Control: "ctrl", Alt: "alt", Shift: "shift", Meta: "meta", OS: "meta" }, held = { ctrl: false, alt: false, shift: false, meta: false };
  const pill = () => {
    let el = document.querySelector(".nx-sticky"); const on = NX.me && NX.prefs().stickyKeys, any = Object.values(held).some(Boolean);
    if (!on || !any) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.className = "nx-sticky"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = [["ctrl", "Ctrl"], ["alt", "Alt"], ["shift", "Shift"], ["meta", "Nebulux"]].filter(([k]) => held[k]).map(([, t]) => `<kbd>${t}</kbd>`).join("") + "<span>held</span>";
  };
  const release = () => { held.ctrl = held.alt = held.shift = held.meta = false; pill(); };
  let shifts = [];
  addEventListener("keydown", (e) => {
    if (!e.isTrusted || !NX.me) return;
    const m = MODS[e.key];
    // Shift five times in a row: offer Sticky Keys
    if (e.key === "Shift" && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) { const t = Date.now(); shifts = [...shifts.filter((x) => t - x < 3000), t]; if (shifts.length >= 5 && !NX.prefs().stickyKeys) { shifts = []; NX.ask && NX.ask(document.body, { title: "Turn on Sticky Keys?", text: "Sticky Keys let you press Ctrl, Alt, Shift or the Nebulux key, then the next key, instead of holding them together.", ok: "Turn on" }).then((y) => { if (y) { NX.setPref("stickyKeys", true); NX.toast("Sticky Keys are on."); } }); return; } }
    else if (!m) shifts = [];
    if (!NX.prefs().stickyKeys) return;
    // a modifier pressed on its own (only its own flag is down) holds it, or lets go of it if it was held
    if (m) { const down = [e.ctrlKey, e.altKey, e.shiftKey, e.metaKey].filter(Boolean).length; if (!e.repeat && down <= 1) { held[m] = !held[m]; pill(); } return; }
    const any = held.ctrl || held.alt || held.shift || held.meta; if (!any) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const mods = { ctrl: held.ctrl || e.ctrlKey, alt: held.alt || e.altKey, shift: held.shift || e.shiftKey, meta: held.meta || e.metaKey }; release();
    const t = e.target, editable = t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable);
    // typing: Shift alone makes a capital letter or the key's other character
    if (editable && mods.shift && !mods.ctrl && !mods.alt && !mods.meta && e.key.length === 1) {
      const up = { 1: "!", 2: "@", 3: "#", 4: "$", 5: "%", 6: "^", 7: "&", 8: "*", 9: "(", 0: ")", "-": "_", "=": "+", "[": "{", "]": "}", ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?", "`": "~" }[e.key] || e.key.toUpperCase();
      if (t.isContentEditable) document.execCommand("insertText", false, up); else { t.setRangeText(up, t.selectionStart, t.selectionEnd, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    // editing keys the browser keeps for itself: do them here
    if (editable && mods.ctrl && !mods.alt && !mods.meta) {
      const k = e.key.toLowerCase(), cmd = { c: "copy", x: "cut", a: "selectAll", z: mods.shift ? "redo" : "undo", y: "redo" }[k];
      if (cmd) { document.execCommand(cmd); return; }
      if (k === "v" && navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then((s) => { if (t.isContentEditable) document.execCommand("insertText", false, s); else { t.setRangeText(s, t.selectionStart, t.selectionEnd, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); } }).catch(() => {}); return; }
    }
    // everything else: the same key again, with the held keys down (Nebulux OS's own shortcuts, like Ctrl + W or Nebulux + E)
    const ev = new KeyboardEvent("keydown", { key: e.key, code: e.code, ctrlKey: mods.ctrl, altKey: mods.alt, shiftKey: mods.shift, metaKey: mods.meta, bubbles: true, cancelable: true });
    (t || document.body).dispatchEvent(ev);
  }, true);
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "stickyKeys") release(); });
  NX.sticky = { held, release };
})();
