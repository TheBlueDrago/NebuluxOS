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
  const N = NX.narrator = { last: "", said: [], on: () => (NX.me ? !!NX.prefs().narrator : !!(NX.get && NX.get("lock-narrator", false))) }; // before sign-in: the sign-in screen switch
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

  // Settings > Accessibility > Mono audio: on the USB the system helper mixes left and right for every app
  const mono = (on) => { if (!NX.native) { if (on) NX.toast("Mono audio works on the Nebulux OS USB."); return; } NX.api("POST", "/sound/mono", { on: !!on }).then((r) => { if (r && r.on !== !!on) NX.toast("Mono audio couldn't change."); }).catch((e) => NX.toast(e.message)); };
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "monoAudio" && NX.me) mono(NX.prefs().monoAudio); });
  document.addEventListener("nx:signin", () => { if (NX.me && NX.native) mono(!!NX.prefs().monoAudio); });

  // ---------- Hover Text (Settings > Accessibility, like macOS): hold Alt and the words under the pointer show big ----------
  let hvOn = false, hvEl = null, hvX = 0, hvY = 0;
  const hvText = (el) => { if (!el || el.closest(".nx-hover")) return ""; const t = el.closest("button, a, label, input, select, textarea, h1, h2, h3, h4, p, li, b, small, span, td, .wt-name") || el; if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return t.value || t.getAttribute("placeholder") || t.getAttribute("aria-label") || ""; return clean(t.getAttribute("aria-label") || t.innerText || t.textContent || t.getAttribute("title") || "").slice(0, 160); };
  const hvShow = () => {
    const el = document.elementFromPoint(hvX, hvY), t = hvText(el);
    if (!t) { if (hvEl) hvEl.hidden = true; return; }
    if (!hvEl) { hvEl = document.createElement("div"); hvEl.className = "nx-hover"; hvEl.setAttribute("aria-hidden", "true"); document.body.appendChild(hvEl); }
    hvEl.hidden = false; hvEl.textContent = t;
    const w = Math.min(innerWidth - 24, 720), x = Math.max(12, Math.min(innerWidth - w - 12, hvX - w / 2)); hvEl.style.maxWidth = w + "px"; hvEl.style.left = x + "px";
    hvEl.style.top = (hvY > innerHeight / 2 ? Math.max(12, hvY - hvEl.offsetHeight - 30) : hvY + 30) + "px";
  };
  addEventListener("pointermove", (e) => { hvX = e.clientX; hvY = e.clientY; if (hvOn) hvShow(); }, { capture: true, passive: true });
  addEventListener("keydown", (e) => { if (e.key !== "Alt") { if (hvOn) hvOff(); return; } if (!e.repeat && NX.me && NX.prefs().hoverText) { hvOn = true; hvShow(); } }, true); // another key (like Alt + Tab) hides it
  const hvOff = () => { hvOn = false; if (hvEl) hvEl.hidden = true; };
  addEventListener("keyup", (e) => { if (e.key === "Alt") hvOff(); }, true); addEventListener("blur", hvOff);

  // ---------- the keyboard in Start, Quick Settings, Symbols and on the desktop icons, like Windows:
  // the arrow keys move to the nearest item that way; typing while Start is open goes into its search ----------
  // typing a letter while Start is open (after clicking it) goes into Start's search
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || !NX.me || e.key.length !== 1 || !e.key.trim()) return;
    const a = document.activeElement, start = document.getElementById("start"); if (!start || start.hidden || (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable))) return;
    const q = start.querySelector(".sm-search input"); if (!q) return;
    e.preventDefault(); e.stopPropagation(); q.focus(); q.setRangeText(e.key, q.selectionStart || 0, q.selectionEnd || 0, "end"); q.dispatchEvent(new Event("input", { bubbles: true }));
  }, true);
  const NAV = ["#start", "#qs", ".nx-sym .sy-grid", "#icons", ".s-side nav", ".tm-tabs", ".clk-tabs", ".c-mode", ".seg", ".sy-tabs", ".np-bar", ".ph-bar"];
  const navItems = (box) => [...box.querySelectorAll("button, a[href], [tabindex='0']")].filter((b) => !b.disabled && b.offsetParent !== null && !b.closest("[hidden]"));
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || !NX.me) return;
    const a = document.activeElement, start = document.getElementById("start");
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!dir || !a || !a.closest) return;
    if (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable) return;
    const sel = NAV.find((s) => a.closest(s)); if (!sel) return; const box = a.closest(sel);
    const r0 = a.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2; let best = null, bestD = Infinity;
    for (const b of navItems(box)) {
      if (b === a) continue; const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1] + dy * dir[0]); if (along <= 4) continue;
      const d = along + across * 2.2; if (d < bestD) { bestD = d; best = b; }
    }
    // nothing that way (a list laid out in one row or one column): the next or previous item in order
    if (!best) { const L = navItems(box), i = L.indexOf(a), step = dir[0] + dir[1]; best = L[i + step] || null; }
    if (best) { e.preventDefault(); best.focus(); best.scrollIntoView && best.scrollIntoView({ block: "nearest", inline: "nearest" }); }
  });

  // ---------- keep the browser's own page keys away from Nebulux OS: the screen is a browser window underneath, and
  // F5 or Ctrl + R would reload it (closing every app), Ctrl + P would print it, Alt + Left or the mouse's back button
  // would go "back". This listener is added last, so apps (like Notepad's F5) still get their keys first. ----------
  // printing (Ctrl + P in Notepad and Photos): a hidden page with only what's printed; the print window can also save a PDF
  NX.printDoc = (title, html) => {
    const f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0"; document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write(`<!doctype html><title>${NX.esc(title)}</title><style>body{margin:16mm;font:11pt/1.45 "Segoe UI",Arial,sans-serif;color:#111}pre{white-space:pre-wrap;word-wrap:break-word;font:10.5pt/1.5 Consolas,"DejaVu Sans Mono",monospace;margin:0}img{max-width:100%;max-height:250mm;display:block;margin:auto}</style>${html}`); d.close();
    const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { NX.toast("This computer can't print right now."); } setTimeout(() => f.remove(), 2000); };
    const im = d.querySelector("img"); if (im && !im.complete) { im.onload = go; im.onerror = go; } else setTimeout(go, 50);
    return f;
  };
  const guard = (e) => {
    if (e.defaultPrevented) return;
    const key = e.key, low = key.toLowerCase(), c = e.ctrlKey && !e.metaKey && !e.altKey, t = e.target, ed = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (key === "F5" || (c && low === "r")) { e.preventDefault(); const w = active(); if (w && w.refresh) w.refresh(); return; }
    if (key === "F11" || key === "F7" || key === "BrowserBack" || key === "BrowserForward" || key === "BrowserRefresh" || (e.altKey && !e.ctrlKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "Home"))) { e.preventDefault(); return; }
    if (c && low === "s") { e.preventDefault(); const w = active(); if (w && w.save) w.save(); return; } // Ctrl + S saves in Notepad and Paint
    if (c && low === "p") { e.preventDefault(); const w = active(); if (w && w.print) w.print(); return; } // Ctrl + P prints in Notepad and Photos
    if (c && ["o", "j", "h", "d", "e", "k", "l"].includes(low)) { e.preventDefault(); return; }
    if (c && low === "u" && !ed) { e.preventDefault(); return; }
  };
  addEventListener("load", () => addEventListener("keydown", guard));
  // "back" (the mouse's back button, Alt + Left) stays on Nebulux OS
  try { history.pushState({ nx: 1 }, "", location.href); addEventListener("popstate", () => history.pushState({ nx: 1 }, "", location.href)); } catch (e) { /* file: pages in tests */ }
  addEventListener("mouseup", (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); }, true);

  // ---------- Nebulux + M minimizes every window, Nebulux + Shift + M brings them back, Nebulux + Home keeps only the one
  // you're in (like shaking it), as in Windows ----------
  let minimized = [];
  NX.minAll = () => { minimized = [...NX.wins.values()].filter((w) => !w.min).map((w) => w.id); minimized.forEach((id) => NX.minimize(id)); };
  NX.restoreAll = () => { const L = minimized.filter((id) => NX.wins.has(id)); minimized = []; L.forEach((id) => NX.focus(id)); };
  const winKey = (k) => { if (!NX.me) return; if (k === "minall") NX.minAll(); if (k === "restoreall") NX.restoreAll(); if (k === "home") { const w = active(); if (w && NX.shakeWin) NX.shakeWin(w.id); } };
  document.addEventListener("nx:key", (e) => winKey(e.detail));
  addEventListener("keydown", (e) => { if (!e.metaKey || e.ctrlKey || e.altKey) return; if (/^m$/i.test(e.key)) { e.preventDefault(); winKey(e.shiftKey ? "restoreall" : "minall"); } else if (e.key === "Home" && !e.shiftKey) { e.preventDefault(); winKey("home"); } }, true);
  // ---------- Alt + Space: the window menu (Restore, Minimize, Maximize, Move, Size, Close), like Windows.
  // Move and Size use the arrow keys (Shift for small steps); Enter keeps it, Esc puts it back ----------
  NX.kbMove = (id, mode) => {
    const w = NX.wins && NX.wins.get(id); if (!w || w.max) return;
    const start = { x: w.x, y: w.y, w: w.w, h: w.h }, el = w.el;
    const apply = () => { el.style.left = w.x + "px"; el.style.top = w.y + "px"; el.style.width = w.w + "px"; el.style.height = w.h + "px"; w.onresize && w.onresize(); };
    el.classList.add("kbmove"); NX.toast(mode === "move" ? "Move the window with the arrow keys, then press Enter." : "Size the window with the arrow keys, then press Enter.");
    const key = (e) => {
      const d = e.shiftKey ? 2 : 24, k = e.key;
      if (/^Arrow/.test(k)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const dx = k === "ArrowLeft" ? -d : k === "ArrowRight" ? d : 0, dy = k === "ArrowUp" ? -d : k === "ArrowDown" ? d : 0;
        if (mode === "move") { w.x = Math.max(-w.w + 120, Math.min(innerWidth - 120, w.x + dx)); w.y = Math.max(0, Math.min(innerHeight - 90, w.y + dy)); }
        else { w.w = Math.max(w.minW || 320, Math.min(innerWidth, w.w + dx)); w.h = Math.max(w.minH || 240, Math.min(innerHeight, w.h + dy)); }
        apply(); return;
      }
      if (k === "Enter" || k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (k === "Escape") { Object.assign(w, start); apply(); } done(); }
    };
    const done = () => { removeEventListener("keydown", key, true); removeEventListener("pointerdown", done, true); el.classList.remove("kbmove"); };
    addEventListener("keydown", key, true); setTimeout(() => addEventListener("pointerdown", done, true), 0);
  };
  addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== "Space" || !NX.me) return;
    const w = active(); if (!w || !w.sysMenu) return; e.preventDefault(); e.stopPropagation();
    const r = w.el.getBoundingClientRect(); w.sysMenu(r.left + 8, r.top + 34);
  }, true);
  // ---------- the Menu key or Shift + F10 opens the right-click menu for what the keyboard is on, like Windows ----------
  addEventListener("keydown", (e) => {
    if (!NX.me || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return;
    const a = document.activeElement; if (!a || a === document.body || (a.closest && a.closest("#ctx"))) return;
    e.preventDefault(); const r = a.getBoundingClientRect();
    a.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + Math.min(24, r.width / 2), clientY: r.top + Math.min(r.height, 28), button: 2 }));
  }, true);
  // ---------- Narrator keys, like Windows: hold Caps Lock (the Narrator key) and press
  // W to read the whole window, T for the time and date, B for the battery, N for the newest notification ----------
  let capsHeld = false;
  addEventListener("keydown", (e) => {
    if (e.key === "CapsLock") { capsHeld = true; return; }
    if (!capsHeld || !N.on() || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase(); let say = "";
    if (k === "w") { const w = active(); say = w ? w.app.name + " window. " + clean(w.el.querySelector(".win-body").innerText).slice(0, 1500) : "The desktop."; }
    else if (k === "t") { const d = new Date(); say = NX.fmtTime(d) + ", " + d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
    else if (k === "b") { const b = NX.batt && NX.batt(); say = b ? "Battery " + b.percent + " percent" + (b.charging ? ", charging" : "") : "No battery information."; }
    else if (k === "n") { const n = (NX.notes || [])[0]; say = n ? "Newest notification: " + n.text : "No notifications."; }
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); N.speak(say.length > 1500 ? say.slice(0, 1500) : say);
  }, true);
  addEventListener("keyup", (e) => { if (e.key === "CapsLock") capsHeld = false; }, true);
  addEventListener("blur", () => { capsHeld = false; });
})();
