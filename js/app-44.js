// Nebulux OS 4.4 apps.
//   Color Picker: pick any color on the screen (Nebulux + Shift + C), see it as HEX, RGB and HSL, copy it, keep the last ones.
"use strict";
(function () {
  const A = NX.apps;
  const hexOk = (h) => /^#[0-9a-f]{6}$/i.test(h);
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hslOf = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  };
  const formats = (h) => { const rgb = rgbOf(h), hsl = hslOf(rgb); return [["HEX", h.toUpperCase()], ["RGB", `rgb(${rgb.join(", ")})`], ["HSL", `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`]]; };
  const copy = (t) => { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); if (NX.clip) NX.clip.add(t); if (NX.native) NX.api("POST", "/clip", { text: t }).catch(() => {}); NX.toast("Copied " + t + "."); };
  // a name a person would use for the color, from its hue and lightness
  const nameOf = (h) => {
    const [hu, s, l] = hslOf(rgbOf(h));
    if (l < 8) return "Black"; if (l > 94) return "White"; if (s < 10) return l < 35 ? "Dark gray" : l > 70 ? "Light gray" : "Gray";
    const n = hu < 12 ? "Red" : hu < 35 ? "Orange" : hu < 60 ? "Yellow" : hu < 85 ? "Lime" : hu < 160 ? "Green" : hu < 190 ? "Teal" : hu < 210 ? "Cyan" : hu < 250 ? "Blue" : hu < 280 ? "Violet" : hu < 320 ? "Purple" : hu < 345 ? "Pink" : "Red";
    return l < 30 ? "Dark " + n.toLowerCase() : l > 72 ? "Light " + n.toLowerCase() : n;
  };
  NX.colorHistory = () => NX.data("colors", []);
  NX.colorKeep = (h) => { if (!hexOk(h)) return; h = h.toLowerCase(); NX.setData("colors", [h, ...NX.colorHistory().filter((x) => x !== h)].slice(0, 16)); document.dispatchEvent(new CustomEvent("nx:color", { detail: h })); };
  // pick from the screen: the browser's eyedropper (the whole screen on the USB, where Nebulux OS fills it)
  NX.colorPick = async () => {
    if (!window.EyeDropper) { NX.toast("Picking colors from the screen needs the Nebulux OS USB or a newer browser."); return null; }
    try { const r = await new window.EyeDropper().open(); if (r && hexOk(r.sRGBHex)) { NX.colorKeep(r.sRGBHex); return r.sRGBHex; } } catch (e) { /* Esc: nothing picked */ }
    return null;
  };
  A.colorpick = { name: "Color Picker", icon: "colorpick", builtIn: true, category: "Utilities", rating: "4.7", size: "1 MB", w: 420, h: 560, minW: 320, minH: 420,
    desc: "Pick any color on your screen and copy it as HEX, RGB or HSL.",
    open(body, win) {
      body.classList.add("cpk");
      let cur = NX.colorHistory()[0] || "#7c5cff";
      const draw = () => {
        const H = NX.colorHistory();
        body.innerHTML = `<div class="cpk-top"><div class="cpk-sw" style="--c:${cur}"></div><div class="cpk-name"><b>${NX.esc(nameOf(cur))}</b><small>${cur.toUpperCase()}</small></div></div>
          <button class="btn primary cpk-pick">${NX.icon("colorpick", 16)}Pick a color from the screen</button>
          <label class="cpk-own">Or type one <input type="color" value="${cur}" aria-label="Choose a color"></label>
          <div class="cpk-fmts">${formats(cur).map(([k, v]) => `<div class="cpk-f"><span>${k}</span><code>${NX.esc(v)}</code><button class="btn sm" data-copy="${NX.esc(v)}" aria-label="Copy ${k}">Copy</button></div>`).join("")}</div>
          <h4>Recent colors</h4><div class="cpk-hist">${H.length ? H.map((h) => `<button class="cpk-dot ${h === cur ? "on" : ""}" style="--c:${h}" data-h="${h}" title="${h.toUpperCase()}" aria-label="${NX.esc(nameOf(h))} ${h.toUpperCase()}"></button>`).join("") : `<p class="cpk-none">Colors you pick show up here.</p>`}</div>
          ${H.length ? `<button class="btn sm cpk-clear">Clear recent colors</button>` : ""}<p class="cpk-tip">Nebulux + Shift + C picks a color any time.</p>`;
        body.querySelector(".cpk-pick").onclick = async () => { const h = await NX.colorPick(); if (h) { cur = h.toLowerCase(); draw(); } };
        body.querySelector(".cpk-own input").onchange = (e) => { cur = e.target.value.toLowerCase(); NX.colorKeep(cur); draw(); };
        body.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
        body.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { cur = b.dataset.h; draw(); }));
        const cl = body.querySelector(".cpk-clear"); if (cl) cl.onclick = () => { NX.setData("colors", []); draw(); };
      };
      const onColor = (e) => { cur = e.detail; draw(); };
      document.addEventListener("nx:color", onColor); win.onclose = () => document.removeEventListener("nx:color", onColor);
      win.colors = { show: (h) => { if (hexOk(h)) { cur = h.toLowerCase(); draw(); } } };
      draw();
    } };
  // Nebulux + Shift + C: pick straight away, copy the HEX, and show it in Color Picker
  const quick = async () => { if (!NX.me) return; const h = await NX.colorPick(); if (!h) return; copy(h.toUpperCase()); NX.open("colorpick"); };
  NX.colorQuick = quick;
  addEventListener("keydown", (e) => { if (e.metaKey && e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === "C" || e.key === "c")) { e.preventDefault(); quick(); } }, true);
  document.addEventListener("nx:key", (e) => { if (e.detail === "color") quick(); });
})();

// ---------- The on-screen keyboard: type with the mouse or a finger (Settings > Accessibility, Quick Settings, or it
// shows by itself when you tap a text box with your finger) ----------
(function () {
  let target = null, shift = false, caps = false, sym = false, el = null;
  const editable = (t) => t && t.isConnected && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|email|url|tel|password|number|)$/i.test(t.type || "")) || t.isContentEditable);
  addEventListener("focusin", (e) => { if (editable(e.target) && !e.target.closest(".nx-osk")) target = e.target; }, true);
  const ROWS = [
    ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"],
    ["!@#$%^&*()", "-_=+[]{}\|", ";:'\",.<>/", "?`~°€£"],
  ];
  const type = (ch) => {
    const t = editable(target) ? target : null; if (!t) { NX.toast("Tap a text box first, then type."); return; }
    t.focus();
    if (t.isContentEditable) { document.execCommand("insertText", false, ch); return; }
    if (t.type === "number" || t.selectionStart == null) { t.value += ch; t.dispatchEvent(new Event("input", { bubbles: true })); return; }
    t.setRangeText(ch, t.selectionStart, t.selectionEnd, "end"); t.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const key = (k) => {
    const t = editable(target) ? target : null;
    if (k === "bs") { if (!t) return; t.focus(); if (t.isContentEditable) { document.execCommand("delete"); return; } const a = t.selectionStart, b = t.selectionEnd; if (a == null) { t.value = t.value.slice(0, -1); } else if (a !== b) t.setRangeText("", a, b, "end"); else if (a > 0) t.setRangeText("", a - 1, a, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); return; }
    if (k === "enter") { if (!t) return; if (t.tagName === "TEXTAREA" || t.isContentEditable) type(String.fromCharCode(10)); else { t.focus(); ["keydown", "keyup"].forEach((ty) => t.dispatchEvent(new KeyboardEvent(ty, { key: "Enter", code: "Enter", bubbles: true, cancelable: true }))); if (t.form) t.form.requestSubmit ? t.form.requestSubmit() : t.form.submit(); } return; }
    if (k === "left" || k === "right") { if (!t || t.selectionStart == null) return; t.focus(); const p = Math.max(0, Math.min(t.value.length, (k === "left" ? t.selectionStart - 1 : t.selectionEnd + 1))); t.setSelectionRange(p, p); return; }
    if (k === "shift") { shift = !shift; draw(); return; }
    if (k === "caps") { caps = !caps; shift = false; draw(); return; }
    if (k === "sym") { sym = !sym; draw(); return; }
    if (k === "space") { type(" "); return; }
    if (k === "close") { NX.osk(false); return; }
    const up = (shift || caps) && !sym; type(up ? k.toUpperCase() : k); if (shift) { shift = false; draw(); }
  };
  const draw = () => {
    if (!el) return; const R = ROWS[sym ? 1 : 0], up = (shift || caps) && !sym;
    const row = (s, extraL, extraR) => `<div class="ok-row">${extraL || ""}${[...s].map((c) => `<button data-k="${NX.esc(c)}">${NX.esc(up ? c.toUpperCase() : c)}</button>`).join("")}${extraR || ""}</div>`;
    el.innerHTML = `<div class="ok-bar"><span>On-screen keyboard</span><button class="wb" data-k="close" aria-label="Close the keyboard" title="Close">${NX.icon("close", 12)}</button></div>` +
      row(R[0], "", `<button class="ok-w2" data-k="bs" aria-label="Backspace">${NX.icon("back", 16)}</button>`) +
      row(R[1], "") +
      row(R[2], `<button class="ok-w2 ${caps ? "on" : ""}" data-k="caps" aria-label="Caps Lock" aria-pressed="${caps}">Caps</button>`, `<button class="ok-w2" data-k="enter" aria-label="Enter">Enter</button>`) +
      row(R[3], `<button class="ok-w2 ${shift ? "on" : ""}" data-k="shift" aria-label="Shift" aria-pressed="${shift}">Shift</button>`, `<button class="ok-w1" data-k="left" aria-label="Left">&lsaquo;</button><button class="ok-w1" data-k="right" aria-label="Right">&rsaquo;</button>`) +
      `<div class="ok-row"><button class="ok-w2 ${sym ? "on" : ""}" data-k="sym" aria-label="Symbols">${sym ? "abc" : "&amp;123"}</button><button class="ok-space" data-k="space" aria-label="Space">Space</button><button class="ok-w2" data-k="close" aria-label="Hide the keyboard">Hide</button></div>`;
  };
  NX.osk = (on) => {
    if (on === undefined) on = !el;
    if (!on) { if (el) { el.remove(); el = null; } return; }
    if (el) return;
    shift = caps = sym = false; // it always opens on the letters
    el = document.createElement("div"); el.className = "nx-osk"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "On-screen keyboard");
    // pressing a key never takes the typing away from the text box
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); const b = e.target.closest("[data-k]"); if (b) { b.classList.add("down"); setTimeout(() => b.classList.remove("down"), 120); key(b.dataset.k); } });
    draw(); document.body.appendChild(el);
  };
  // Windows' touch keyboard: tapping a text box with a finger brings it up (Settings > Accessibility can turn this off)
  addEventListener("pointerup", (e) => { if (e.pointerType !== "touch" || !NX.me || !NX.oskTouchOn()) return; const t = e.target.closest && e.target.closest("input, textarea, [contenteditable=true]"); if (t && editable(t)) { target = t; NX.osk(true); } }, true);
  // on by itself only on the USB: phones and tablets in a browser already show their own keyboard
  NX.oskTouchOn = () => { const v = NX.prefs().oskTouch; return v == null ? !!NX.native : !!v; };
  document.addEventListener("nx:key", (e) => { if (e.detail === "osk") NX.osk(); });
  addEventListener("keydown", (e) => { if (e.metaKey && e.ctrlKey && !e.altKey && (e.key === "o" || e.key === "O")) { e.preventDefault(); NX.osk(); } }, true);
})();

// ---------- Accessibility on the sign-in screen (like Windows): Narrator and the on-screen keyboard before anyone signs in ----------
(function () {
  const corner = document.querySelector("#lock .lk-corner"), power = document.getElementById("lk-power"); if (!corner || !power) return;
  const b = document.createElement("button"); b.id = "lk-access"; b.setAttribute("aria-label", "Accessibility"); b.title = "Accessibility";
  b.innerHTML = NX.icon("access", 20);
  const m = document.createElement("div"); m.id = "lk-amenu"; m.className = "lk-pmenu"; m.hidden = true;
  const draw = () => { const on = !!NX.get("lock-narrator", false); m.innerHTML = `<button data-la="narrator" role="menuitemcheckbox" aria-checked="${on}">Narrator: ${on ? "On" : "Off"}</button><button data-la="osk">On-screen keyboard</button>`; };
  b.onclick = (e) => { e.stopPropagation(); draw(); m.hidden = !m.hidden; const pm = document.getElementById("lk-pmenu"); if (pm) pm.hidden = true; };
  m.addEventListener("click", (e) => {
    e.stopPropagation(); const k = e.target.closest("[data-la]"); if (!k) return; m.hidden = true;
    if (k.dataset.la === "narrator") { const on = !NX.get("lock-narrator", false); NX.set("lock-narrator", on); if (NX.narrator) { NX.narrator.speak(on ? "Narrator is on. Type your password, then press Enter." : "Narrator is off."); } }
    if (k.dataset.la === "osk") { const i = document.querySelector("#lock input"); if (i) i.focus(); NX.osk && NX.osk(true); }
  });
  corner.insertBefore(b, power); corner.appendChild(m);
  document.addEventListener("click", () => { m.hidden = true; });
})();
