// The apps in the Nebulux Store. Each one runs in its own window and keeps its data with your account.
"use strict";
(function () {
  const A = NX.apps;

  // ---------- Notepad: saves as you type, as a note with your account or as a real text file ----------
  A.notepad = { name: "Notepad", icon: "notepad", category: "Productivity", rating: "4.7", size: "1 MB", w: 760, h: 520, desc: "Write notes and lists. Everything saves by itself as you type. Open and save text files too.",
    open(body, win, opts) {
      body.classList.add("np");
      body.innerHTML = `<div class="np-tabs" role="tablist" aria-label="Notes"></div><div class="np-bar"><button class="btn sm" data-a="new">New tab</button><button class="btn sm" data-a="open">Open</button><button class="btn sm" data-a="save">Save to Documents</button><button class="btn sm" data-a="dl">Download</button><span class="np-sp"></span><button class="btn sm" data-a="wrap" aria-pressed="true" title="Word wrap">Wrap</button><button class="btn sm" data-a="-" aria-label="Smaller text">A-</button><button class="btn sm" data-a="+" aria-label="Bigger text">A+</button></div><form class="np-find" hidden><input name="f" placeholder="Find" aria-label="Find"><input name="r" placeholder="Replace with" aria-label="Replace with" hidden><button class="btn sm" type="button" data-f="next">Next</button><button class="btn sm" type="button" data-f="rep" hidden>Replace</button><button class="btn sm" type="button" data-f="all" hidden>Replace all</button><span class="np-fmsg"></span><button class="btn sm" type="button" data-f="close" aria-label="Close find">${NX.icon("close", 12)}</button></form><textarea spellcheck="true" placeholder="Start typing..." aria-label="Note"></textarea><div class="np-status"><span class="np-pos">Ln 1, Col 1</span><span class="np-count"></span><span class="np-saved">Saved</span></div>`;
      const ta = body.querySelector("textarea"), cnt = body.querySelector(".np-count"), sv = body.querySelector(".np-saved"), saveBtn = body.querySelector("[data-a=save]");
      let size = NX.data("np-size", 15), t = 0, file = null; ta.style.fontSize = size + "px";
      // word wrap (on by default, kept for next time) and where the cursor is
      const wrapBtn = body.querySelector("[data-a=wrap]"), setWrap = (on) => { ta.wrap = on ? "soft" : "off"; ta.classList.toggle("np-nowrap", !on); wrapBtn.classList.toggle("on", on); wrapBtn.setAttribute("aria-pressed", on); };
      setWrap(NX.data("np-wrap", true));
      const pos = body.querySelector(".np-pos"), where = () => { const before = ta.value.slice(0, ta.selectionStart).split("\n"); pos.textContent = "Ln " + before.length + ", Col " + (before[before.length - 1].length + 1); };
      ["keyup", "click", "input", "select"].forEach((ev) => ta.addEventListener(ev, where));
      const title = () => { win.el.querySelector(".wt-name").textContent = (file ? NX.fs.base(file) : "Notepad"); saveBtn.hidden = !!file; };
      // tabs: each one is a note Notepad keeps for you ("Untitled" until it has a first line) or a text file; they come back next time
      let tabs = (NX.data("np-tabs", null) || [{ id: 1 }]).filter((x) => x && x.id); if (!tabs.length) tabs = [{ id: 1 }];
      let ti = Math.max(0, Math.min(+NX.data("np-tab", 0) || 0, tabs.length - 1));
      const keyOf = (tb) => (tb.id === 1 ? "np-text" : "np-text-" + tb.id), strip = body.querySelector(".np-tabs");
      const tabsSave = () => { NX.setData("np-tabs", tabs.map((x) => (x.file ? { id: x.id, file: x.file } : { id: x.id }))); NX.setData("np-tab", ti); };
      const tabName = (tb, k) => { if (tb.file) return NX.fs.base(tb.file); const txt = k === ti ? ta.value : NX.data(keyOf(tb), ""); return (txt.split("\n").find((x) => x.trim()) || "").trim().slice(0, 24) || "Untitled"; };
      const drawTabs = () => { strip.innerHTML = tabs.map((tb, k) => `<div class="np-tab ${k === ti ? "on" : ""}"><button class="np-tn" role="tab" aria-selected="${k === ti}" data-ti="${k}" title="${NX.esc(tb.file || tabName(tb, k))}">${NX.icon(tb.file ? "ftext" : "notepad", 14)}<span>${NX.esc(tabName(tb, k))}</span></button><button class="np-tx" data-tx="${k}" aria-label="Close ${NX.esc(tabName(tb, k))}">${NX.icon("close", 10)}</button></div>`).join("") + `<button class="np-tadd" data-tadd="1" aria-label="New tab" title="New tab">${NX.icon("plus", 14)}</button>`; };
      const newId = () => Math.max(1, ...tabs.map((x) => x.id)) + 1;
      async function loadTab(k) {
        await flush(); ti = k; const tb = tabs[ti]; file = tb.file || null;
        if (file) { try { ta.value = await NX.fs.read(file); sv.textContent = "Opened"; } catch (e) { NX.toast(e.message); tb.file = null; file = null; ta.value = NX.data(keyOf(tb), ""); } }
        else { ta.value = NX.data(keyOf(tb), ""); sv.textContent = "Saved"; }
        title(); count(); where(); drawTabs(); tabsSave(); ta.focus();
      }
      async function newTab() { await flush(); const id = newId(); tabs.push({ id }); NX.setData("np-text-" + id, ""); await loadTab(tabs.length - 1); }
      async function closeTab(k) {
        await flush(); const tb = tabs[k]; if (!tb) return; if (!tb.file) NX.setData(keyOf(tb), "");
        tabs.splice(k, 1); if (!tabs.length) tabs = [{ id: 1 }];
        if (k < ti) ti--; ti = Math.max(0, Math.min(ti, tabs.length - 1)); t = 0; await loadTab(ti);
      }
      strip.onclick = (e) => { const x = e.target.closest("[data-tx]"); if (x) { closeTab(+x.dataset.tx); return; } if (e.target.closest("[data-tadd]")) { newTab(); return; } const b = e.target.closest("[data-ti]"); if (b && +b.dataset.ti !== ti) loadTab(+b.dataset.ti); };
      strip.onauxclick = (e) => { const b = e.target.closest("[data-ti]"); if (e.button === 1 && b) closeTab(+b.dataset.ti); };
      win.np2 = { tabs: () => tabs.map((x, k) => ({ file: x.file || null, name: tabName(x, k), on: k === ti })), newTab, closeTab, loadTab };
      const count = () => { const v = ta.value; cnt.textContent = (v.trim() ? v.trim().split(/\s+/).length : 0) + " words · " + v.length + " characters"; };
      const saveNow = () => {
        if (!file) { NX.setData(keyOf(tabs[ti]), ta.value); sv.textContent = "Saved"; drawTabs(); return Promise.resolve(); }
        const p = file, text = ta.value;
        return NX.fs.write(p, text).then(() => { if (p === file) sv.textContent = "Saved in " + NX.fs.base(NX.fs.parent(p)); NX.filesChanged && NX.filesChanged(); }).catch((e) => { sv.textContent = "Not saved: " + e.message; });
      };
      ta.oninput = () => { count(); sv.textContent = "Saving..."; clearTimeout(t); t = setTimeout(saveNow, 400); };
      const flush = () => { if (t) { clearTimeout(t); t = 0; return saveNow(); } return Promise.resolve(); };
      // a file opens in its own tab (or in this one, if it's an empty note)
      async function openFile(p) {
        await flush(); const ex = tabs.findIndex((x) => x.file === p); if (ex >= 0) return loadTab(ex);
        const cur = tabs[ti]; if (!cur.file && !ta.value.trim()) { cur.file = p; return loadTab(ti); }
        tabs.push({ id: newId(), file: p }); return loadTab(tabs.length - 1);
      }
      body.querySelector(".np-bar").onclick = async (e) => {
        const a = e.target.closest("button"); if (!a) return; const k = a.dataset.a;
        if (k === "new") { newTab(); return; }
        if (k === "open") { await flush(); NX.open("files", { place: "Documents" }); NX.toast("Double-click a text file to open it in Notepad."); }
        if (k === "save") {
          const first = (ta.value.split("\n").find((x) => x.trim()) || "Note").trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "").replace(/^\.+/, "").slice(0, 40).trim() || "Note";
          try { const dir = await NX.folder("Documents"); const r = await NX.fs.create(dir, first + ".txt", false); file = r.path; await NX.fs.write(file, ta.value); NX.setData(keyOf(tabs[ti]), ""); tabs[ti].file = file; tabsSave(); drawTabs(); title(); sv.textContent = "Saved in Documents"; NX.toast("Saved in Documents as " + r.name + "."); NX.filesChanged && NX.filesChanged(); } catch (er) { NX.toast(er.message); }
        }
        if (k === "dl") { const url = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" })), l = document.createElement("a"); l.href = url; l.download = file ? NX.fs.base(file) : "note.txt"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        if (k === "wrap") { const on = ta.wrap === "off"; setWrap(on); NX.setData("np-wrap", on); }
        if (k === "+" || k === "-") { size = Math.max(11, Math.min(32, size + (k === "+" ? 2 : -2))); ta.style.fontSize = size + "px"; NX.setData("np-size", size); }
      };
      win.onopts = (o) => { if (o.file) openFile(o.file); };
      win.onclose = () => { flush(); };
      loadTab(ti).then(() => { if (opts && opts.file) openFile(opts.file); });
      // Find (Ctrl + F) and Replace (Ctrl + H), not case-sensitive
      const fb = body.querySelector(".np-find"), fi = fb.f, ri = fb.r, fmsg = body.querySelector(".np-fmsg");
      const findOpen = (rep) => { fb.hidden = false; ri.hidden = !rep; fb.querySelector("[data-f=rep]").hidden = !rep; fb.querySelector("[data-f=all]").hidden = !rep; const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (sel && !sel.includes("\n")) fi.value = sel; fi.focus(); fi.select(); };
      const findNext = () => { const q = fi.value; if (!q) return false; const hay = ta.value.toLowerCase(), n = q.toLowerCase(); let i = hay.indexOf(n, ta.selectionEnd); if (i < 0) i = hay.indexOf(n); if (i < 0) { fmsg.textContent = "Not found"; return false; } fmsg.textContent = ""; ta.focus(); ta.setSelectionRange(i, i + q.length); fi.focus(); return true; };
      const replaceOne = () => { const q = fi.value; if (!q) return; if (ta.value.slice(ta.selectionStart, ta.selectionEnd).toLowerCase() !== q.toLowerCase() && !findNext()) return; ta.setRangeText(ri.value, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); findNext(); };
      const replaceAll = () => { const q = fi.value; if (!q) return; let n = 0; const low = q.toLowerCase(); let out = "", i = 0, v = ta.value, lv = v.toLowerCase(); for (;;) { const j = lv.indexOf(low, i); if (j < 0) break; out += v.slice(i, j) + ri.value; i = j + q.length; n++; } if (!n) { fmsg.textContent = "Not found"; return; } ta.value = out + v.slice(i); ta.dispatchEvent(new Event("input")); fmsg.textContent = n === 1 ? "Replaced 1" : "Replaced " + n; };
      fb.onsubmit = (e) => { e.preventDefault(); findNext(); };
      fb.onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; const k = b.dataset.f; if (k === "next") findNext(); if (k === "rep") replaceOne(); if (k === "all") replaceAll(); if (k === "close") { fb.hidden = true; fmsg.textContent = ""; ta.focus(); } };
      fb.onkeydown = (e) => { if (e.key === "Escape") { e.stopPropagation(); fb.hidden = true; ta.focus(); } if (e.key === "Enter") { e.preventDefault(); if (e.target === ri) replaceOne(); else findNext(); } };
      body.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[fh]$/i.test(e.key)) { e.preventDefault(); findOpen(e.key.toLowerCase() === "h"); } if (e.key === "F3") { e.preventDefault(); findNext(); } });
      win.np = { findOpen, findNext, replaceAll, ta };
      count(); setTimeout(() => ta.focus(), 60);
    } };

  // ---------- Calculator: a real calculator (no eval), with keyboard keys ----------
  A.calculator = { name: "Calculator", icon: "calculator", category: "Utilities", rating: "4.8", size: "1 MB", w: 340, h: 520, minW: 300, minH: 440, desc: "Add, subtract, multiply and divide, with percent, square root and your keyboard.",
    open(body, win) {
      body.classList.add("calc");
      const K = [["%", "pct"], ["CE", "ce"], ["C", "c"], ["⌫", "bs"], ["1/x", "inv"], ["x²", "sq"], ["√x", "sqrt"], ["÷", "/"], ["7"], ["8"], ["9"], ["×", "*"], ["4"], ["5"], ["6"], ["−", "-"], ["1"], ["2"], ["3"], ["+", "+"], ["±", "neg"], ["0"], [".", "."], ["=", "="]];
      body.innerHTML = `<div class="seg c-mode"><button data-m="std" class="on">Standard</button><button data-m="conv">Converter</button></div><div class="c-conv" hidden></div><div class="c-disp"><button class="c-hbtn" aria-label="History" title="History">${NX.icon("time", 16)}</button><small class="c-expr"></small><b class="c-val">0</b></div><div class="c-hist" hidden></div><div class="c-keys">${K.map(([l, k]) => `<button class="c-k ${/^[0-9.]$/.test(k || l) ? "num" : ""} ${(k || l) === "=" ? "eq" : ""}" data-k="${k || l}">${l}</button>`).join("")}</div>`;
      let cur = "0", prev = null, op = null, fresh = true, expr = "";
      const val = body.querySelector(".c-val"), ex = body.querySelector(".c-expr");
      const fmt = (n) => { if (!isFinite(n)) return "Can't divide by zero"; const s = Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0) ? n.toExponential(8) : String(+n.toPrecision(15)); return s; };
      const calc = (a, b, o) => o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : o === "/" ? (b === 0 ? Infinity : a / b) : b;
      const show = () => { val.textContent = cur; val.style.fontSize = cur.length > 14 ? "24px" : cur.length > 10 ? "32px" : ""; ex.textContent = expr; };
      const press = (k) => {
        if (cur === "Can't divide by zero" && k !== "c" && k !== "ce") { cur = "0"; prev = null; op = null; expr = ""; }
        if (/^[0-9]$/.test(k)) { cur = fresh || cur === "0" ? k : (cur.length < 16 ? cur + k : cur); fresh = false; }
        else if (k === ".") { if (fresh) { cur = "0."; fresh = false; } else if (!cur.includes(".")) cur += "."; }
        else if (["+", "-", "*", "/"].includes(k)) { const n = parseFloat(cur); if (op && !fresh) { prev = calc(prev, n, op); cur = fmt(prev); } else if (prev == null || !op) prev = n; op = k; fresh = true; expr = fmt(prev) + " " + { "+": "+", "-": "−", "*": "×", "/": "÷" }[k]; }
        else if (k === "=") { if (op) { const n = parseFloat(cur), r = calc(prev, n, op); expr = fmt(prev) + " " + { "+": "+", "-": "−", "*": "×", "/": "÷" }[op] + " " + fmt(n) + " ="; cur = fmt(r); prev = null; op = null; fresh = true; if (isFinite(r)) NX.setData("calc-history", [{ e: expr, r: cur }, ...NX.data("calc-history", [])].slice(0, 20)); } }
        else if (k === "c") { cur = "0"; prev = null; op = null; fresh = true; expr = ""; }
        else if (k === "ce") { cur = "0"; fresh = true; }
        else if (k === "bs") { if (!fresh) { cur = cur.length > 1 ? cur.slice(0, -1) : "0"; if (cur === "-") cur = "0"; } }
        else if (k === "neg") { if (cur !== "0") cur = cur.startsWith("-") ? cur.slice(1) : "-" + cur; }
        else if (k === "pct") { const n = parseFloat(cur); cur = fmt(prev != null && op ? (prev * n) / 100 : n / 100); fresh = true; }
        else if (k === "sq") { const n = parseFloat(cur); cur = fmt(n * n); fresh = true; }
        else if (k === "sqrt") { const n = parseFloat(cur); cur = n < 0 ? "Invalid input" : fmt(Math.sqrt(n)); fresh = true; if (n < 0) setTimeout(() => { cur = "0"; show(); }, 1200); }
        else if (k === "inv") { const n = parseFloat(cur); cur = n === 0 ? "Can't divide by zero" : fmt(1 / n); fresh = true; }
        show();
      };
      body.querySelector(".c-keys").onclick = (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.k); };
      // History: the last 20 answers; click one to use it again
      const hist = body.querySelector(".c-hist");
      const histDraw = () => { const H = NX.data("calc-history", []);
        hist.innerHTML = (H.length ? H.map((h, i) => `<button class="c-hi" data-h="${i}"><small>${NX.esc(h.e)}</small><b>${NX.esc(h.r)}</b></button>`).join("") + `<button class="btn sm c-hclear">Clear history</button>` : `<p class="c-hnone">There's no history yet.</p>`);
        hist.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { const h = NX.data("calc-history", [])[+b.dataset.h]; if (h) { cur = h.r; fresh = true; expr = h.e; show(); } hist.hidden = true; }));
        const cl = hist.querySelector(".c-hclear"); if (cl) cl.onclick = () => { NX.setData("calc-history", []); histDraw(); }; };
      body.querySelector(".c-hbtn").onclick = () => { hist.hidden = !hist.hidden; if (!hist.hidden) histDraw(); };
      const key = (e) => {
        if (!win.el.classList.contains("active") || /input|textarea/i.test((document.activeElement || {}).tagName)) return;
        if ((e.ctrlKey || e.metaKey) && /^c$/i.test(e.key)) { e.preventDefault(); navigator.clipboard && navigator.clipboard.writeText(cur).catch(() => {}); if (NX.clip) NX.clip.add(cur); NX.toast("Copied " + cur + "."); return; }
        const m = { Enter: "=", "=": "=", Backspace: "bs", Escape: "c", Delete: "ce", "%": "pct" }[e.key] || (/^[0-9.+\-*/]$/.test(e.key) ? e.key : null);
        if (m) { e.preventDefault(); press(m); }
      };
      addEventListener("keydown", key); win.onclose = () => removeEventListener("keydown", key);
      // the unit converter: length, weight, temperature, volume, speed and time
      const U = {
        Length: { Millimeters: .001, Centimeters: .01, Meters: 1, Kilometers: 1000, Inches: .0254, Feet: .3048, Yards: .9144, Miles: 1609.344 },
        Weight: { Grams: .001, Kilograms: 1, Ounces: .028349523125, Pounds: .45359237, Stones: 6.35029318, "Metric tons": 1000 },
        Temperature: { Celsius: 0, Fahrenheit: 0, Kelvin: 0 },
        Volume: { Milliliters: .001, Liters: 1, Teaspoons: .00492892159375, Tablespoons: .01478676478125, "Fluid ounces": .0295735295625, Cups: .2365882365, Gallons: 3.785411784 },
        Speed: { "Meters per second": 1, "Kilometers per hour": 1 / 3.6, "Miles per hour": .44704, Knots: .514444 },
        Time: { Seconds: 1, Minutes: 60, Hours: 3600, Days: 86400, Weeks: 604800 },
      };
      const toC = { Celsius: (v) => v, Fahrenheit: (v) => (v - 32) * 5 / 9, Kelvin: (v) => v - 273.15 }, fromC = { Celsius: (v) => v, Fahrenheit: (v) => v * 9 / 5 + 32, Kelvin: (v) => v + 273.15 };
      const conv = body.querySelector(".c-conv"); let cat = "Length";
      const opts = (sel) => Object.keys(U[cat]).map((u) => `<option ${u === sel ? "selected" : ""}>${u}</option>`).join("");
      const convDraw = () => {
        const us = Object.keys(U[cat]), a = us[cat === "Temperature" ? 0 : cat === "Length" ? 2 : cat === "Weight" ? 1 : 0], b = us[cat === "Temperature" ? 1 : cat === "Length" ? 5 : cat === "Weight" ? 3 : us.length - 1];
        conv.innerHTML = `<select class="cv-cat" aria-label="What to convert">${Object.keys(U).map((c) => `<option ${c === cat ? "selected" : ""}>${c}</option>`).join("")}</select>
          <label class="cv-box"><input class="cv-a" type="number" inputmode="decimal" value="1" aria-label="Amount"><select class="cv-ua" aria-label="From">${opts(a)}</select></label>
          <button class="cv-swap" type="button" aria-label="Swap" title="Swap"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/></svg></button>
          <label class="cv-box out"><output class="cv-b"></output><select class="cv-ub" aria-label="To">${opts(b)}</select></label><p class="cv-note"></p>`;
        const q = (s) => conv.querySelector(s), go = () => {
          const v = parseFloat(q(".cv-a").value), ua = q(".cv-ua").value, ub = q(".cv-ub").value;
          if (!isFinite(v)) { q(".cv-b").textContent = ""; q(".cv-note").textContent = ""; return; }
          const r = cat === "Temperature" ? fromC[ub](toC[ua](v)) : (v * U[cat][ua]) / U[cat][ub];
          const s = Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(6) : String(+r.toPrecision(10));
          q(".cv-b").textContent = s; q(".cv-note").textContent = v + " " + ua.toLowerCase() + " = " + s + " " + ub.toLowerCase();
        };
        q(".cv-cat").onchange = (e) => { cat = e.target.value; convDraw(); };
        q(".cv-a").oninput = go; q(".cv-ua").onchange = go; q(".cv-ub").onchange = go;
        q(".cv-swap").onclick = () => { const x = q(".cv-ua").value; q(".cv-ua").value = q(".cv-ub").value; q(".cv-ub").value = x; go(); };
        go();
      };
      body.querySelector(".c-mode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; const c = b.dataset.m === "conv";
        body.querySelectorAll(".c-mode button").forEach((x) => x.classList.toggle("on", x === b)); conv.hidden = !c; body.querySelector(".c-disp").hidden = c; body.querySelector(".c-keys").hidden = c; hist.hidden = true; if (c && !conv.innerHTML) convDraw(); };
    } };

  // ---------- Paint: brush, colors, sizes, eraser, save as a picture ----------
  A.paint = { name: "Paint", icon: "paint", category: "Creativity", rating: "4.6", size: "2 MB", w: 900, h: 620, minW: 420, minH: 360, desc: "Draw and paint with brushes and colors, then save your picture.",
    open(body, win) {
      body.classList.add("paint");
      const COLS = ["#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#22d3ee", "#3b82f6", "#7c5cff", "#ec4899", "#8b5a2b", "#94a3b8"];
      body.innerHTML = `<div class="p-bar"><div class="p-cols">${COLS.map((c, i) => `<button data-col="${c}" class="${i === 8 ? "on" : ""}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div><label class="p-size">Size <input type="range" min="2" max="48" value="8"></label><button class="btn sm" data-t="brush">Brush</button><button class="btn sm" data-t="line">Line</button><button class="btn sm" data-t="rect">Box</button><button class="btn sm" data-t="ellipse">Circle</button><button class="btn sm" data-t="fill">Fill</button><button class="btn sm" data-t="eraser">Eraser</button><button class="btn sm" data-t="undo">Undo</button><button class="btn sm" data-t="clear">Clear</button><button class="btn sm primary" data-t="save">Save picture</button></div><div class="p-wrap"><canvas></canvas></div>`;
      const cv = body.querySelector("canvas"), g = cv.getContext("2d"), wrap = body.querySelector(".p-wrap");
      let col = COLS[8], size = 8, tool = "brush", down = false, last = null; const hist = [];
      const resize = () => {
        const r = { width: wrap.clientWidth, height: wrap.clientHeight }; if (r.width < 10 || r.height < 10) return; // (clientWidth: the real size, even while the window is still opening)
        const old = document.createElement("canvas"); old.width = cv.width; old.height = cv.height; old.getContext("2d").drawImage(cv, 0, 0);
        if (cv.width === Math.round(r.width) && cv.height === Math.round(r.height)) return; cv.width = Math.round(r.width); cv.height = Math.round(r.height); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(old, 0, 0);
      };
      const snap = () => { try { hist.push(g.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 20) hist.shift(); } catch (e) { /* too big */ } };
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      // shapes (line, box, circle) are drawn from where you press to where you let go; Fill pours color into an area
      let start = null, base = null; const SHAPES = ["line", "rect", "ellipse"];
      const shape = (a, b) => { g.putImageData(base, 0, 0); g.strokeStyle = col; g.lineWidth = size; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
        if (tool === "line") { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
        if (tool === "rect") g.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        if (tool === "ellipse") g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || .1, Math.abs(b[1] - a[1]) / 2 || .1, 0, 0, Math.PI * 2);
        g.stroke(); };
      const fillAt = (x, y) => {
        const W = cv.width, H = cv.height, d = g.getImageData(0, 0, W, H), px = d.data; x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
        const at = (y * W + x) * 4, t = [px[at], px[at + 1], px[at + 2]], c = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
        if (Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) + Math.abs(t[2] - c[2]) < 6) return;
        const same = (i) => Math.abs(px[i] - t[0]) + Math.abs(px[i + 1] - t[1]) + Math.abs(px[i + 2] - t[2]) < 60, seen = new Uint8Array(W * H), stack = [[x, y]];
        while (stack.length) { let [sx, sy] = stack.pop(); while (sx >= 0 && same((sy * W + sx) * 4) && !seen[sy * W + sx]) sx--; sx++; let up = false, dn = false;
          while (sx < W && !seen[sy * W + sx] && same((sy * W + sx) * 4)) { const i = (sy * W + sx) * 4; seen[sy * W + sx] = 1; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
            if (sy > 0) { const u = !seen[(sy - 1) * W + sx] && same(((sy - 1) * W + sx) * 4); if (u && !up) stack.push([sx, sy - 1]); up = u; }
            if (sy < H - 1) { const dd = !seen[(sy + 1) * W + sx] && same(((sy + 1) * W + sx) * 4); if (dd && !dn) stack.push([sx, sy + 1]); dn = dd; }
            sx++; } }
        g.putImageData(d, 0, 0);
      };
      win.paintTest = { fillAt: (x, y) => { snap(); fillAt(x, y); }, pixel: (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)), setTool: (t) => (tool = t), setCol: (c) => (col = c) };
      cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); snap(); last = pos(e);
        if (tool === "fill") { fillAt(last[0], last[1]); return; }
        if (SHAPES.includes(tool)) { start = last; base = g.getImageData(0, 0, cv.width, cv.height); down = true; return; }
        down = true; g.beginPath(); g.fillStyle = tool === "eraser" ? "#fff" : col; g.arc(last[0], last[1], size / 2, 0, 7); g.fill(); };
      cv.onpointermove = (e) => { if (!down) return; const p = pos(e); if (start) { shape(start, p); return; } g.strokeStyle = tool === "eraser" ? "#fff" : col; g.lineWidth = size; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
      cv.onpointerup = cv.onpointercancel = (e) => { if (start && e && e.clientX != null) shape(start, pos(e)); down = false; start = null; base = null; };
      body.querySelector(".p-cols").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; col = b.dataset.col; if (tool === "eraser") { tool = "brush"; body.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("on", x.dataset.t === "brush")); } body.querySelectorAll(".p-cols button").forEach((x) => x.classList.toggle("on", x === b)); };
      body.querySelector(".p-size input").oninput = (e) => (size = +e.target.value);
      body.querySelector(".p-bar").addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]"); if (!b) return; const t = b.dataset.t;
        if (["brush", "eraser", "line", "rect", "ellipse", "fill"].includes(t)) { tool = t; body.querySelectorAll("[data-t=brush],[data-t=eraser],[data-t=line],[data-t=rect],[data-t=ellipse],[data-t=fill]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (t === "undo" && hist.length) g.putImageData(hist.pop(), 0, 0);
        if (t === "clear") { snap(); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); }
        if (t === "save") { // into Pictures, where Photos and File Explorer find it
          cv.toBlob(async (blob) => { try { const r = await NX.fs.upload(await NX.folder("Pictures"), "Painting.png", blob); NX.toast("Saved in Pictures as " + r.name + "."); NX.filesChanged && NX.filesChanged(); } catch (e) { NX.toast(e.message); } }, "image/png");
        }
      });
      body.querySelector("[data-t=brush]").classList.add("on");
      win.onresize = () => setTimeout(resize, 0); setTimeout(resize, 30); setTimeout(resize, 400);
    } };

  // ---------- Clock: time, stopwatch and timer ----------
  // Focus sessions: Do not disturb for a set time, and a heads-up when it's done (keeps going with Clock closed)
  const FS = { end: 0, len: 0, prevDnd: false, t: 0 };
  NX.focusSession = {
    on: () => FS.end > Date.now(),
    left: () => Math.max(0, FS.end - Date.now()),
    len: () => FS.len,
    today: () => { const d = new Date().toDateString(); return NX.data("focus-log", []).filter((x) => new Date(x.at).toDateString() === d).length; },
    start(min) {
      if (!NX.me) return; FS.len = min * 60000; FS.end = Date.now() + FS.len; FS.prevDnd = !!NX.prefs().dnd; NX.setPref("dnd", true);
      clearInterval(FS.t); FS.t = setInterval(() => { if (FS.end && Date.now() >= FS.end) NX.focusSession.finish(true); }, 1000);
      NX.toast("Focus session started: " + min + " minutes. Do not disturb is on.");
    },
    finish(done) {
      clearInterval(FS.t); const was = FS.end; FS.end = 0; if (!was) return;
      if (NX.me) { NX.setPref("dnd", FS.prevDnd); if (done) { NX.setData("focus-log", [...NX.data("focus-log", []).slice(-199), { at: Date.now(), min: Math.round(FS.len / 60000) }]); } }
      NX.toast(done ? "Focus session done. Nice work. Take a short break." : "Focus session stopped."); if (done && NX.beep) NX.beep();
      document.dispatchEvent(new CustomEvent("nx:focus"));
    },
  };
  document.addEventListener("nx:signin", () => { if (FS.end) NX.focusSession.finish(false); });
  // Alarms: a time, the days it rings (none = once), and a name; checked every 15 seconds, also with Clock closed
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  NX.alarms = {
    list: () => NX.data("alarms", []),
    save: (L) => { NX.setData("alarms", L); document.dispatchEvent(new CustomEvent("nx:alarms")); },
    add(time, days, name) { const L = NX.alarms.list(); if (L.length >= 20) throw new Error("You can have up to 20 alarms."); L.push({ id: NX.uid(), time, days: days || [], name: String(name || "").slice(0, 40), on: true, last: "" }); NX.alarms.save(L.sort((a, b) => a.time.localeCompare(b.time))); },
    check(now) {
      if (!NX.me) return; const d = now || new Date(), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"), stamp = d.toDateString() + " " + hm;
      let changed = false; const L = NX.alarms.list();
      for (const a of L) {
        if (!a.on || a.time !== hm || a.last === stamp || (a.days.length && !a.days.includes(d.getDay()))) continue;
        a.last = stamp; changed = true; if (!a.days.length) a.on = false;
        NX.toast((a.name || "Alarm") + ": it's " + NX.fmtTime(d) + "."); if (NX.beep) { NX.beep(); setTimeout(() => NX.beep(), 700); setTimeout(() => NX.beep(), 1400); }
        document.dispatchEvent(new CustomEvent("nx:alarm", { detail: a.id }));
      }
      if (changed) NX.alarms.save(L);
    },
    days: DAYS,
  };
  setInterval(() => NX.alarms.check(), 15000);
  A.clock = { name: "Clock", icon: "clock", category: "Utilities", rating: "4.6", size: "1 MB", w: 520, h: 480, minW: 340, minH: 380, desc: "The time, a stopwatch with laps, and a timer that rings when it's done.",
    open(body, win) {
      body.classList.add("clk");
      body.innerHTML = `<div class="seg clk-tabs"><button data-v="clock" class="on">Clock</button><button data-v="sw">Stopwatch</button><button data-v="tm">Timer</button><button data-v="fo">Focus</button><button data-v="al">Alarms</button></div><div class="clk-face"></div>`;
      let v = "clock", swOn = false, swT = 0, swAt = 0, laps = [], tmLeft = 300000, tmOn = false, tmAt = 0, tmSet = 300000;
      const face = body.querySelector(".clk-face"), f2 = (n) => String(n).padStart(2, "0");
      const fmtMs = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100; return (h ? h + ":" : "") + f2(m) + ":" + f2(s) + "." + f2(cs); };
      const draw = () => {
        const now = performance.now();
        if (v === "clock") { // the time here, and world clocks for other cities (saved for each person)
          const d = new Date();
          if (!face.querySelector(".wc")) {
            const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : []).filter((z) => z.includes("/"));
            face.innerHTML = `<div class="clk-big"></div><div class="clk-sub"></div><div class="wc"><form class="wc-add"><input list="wc-zones" placeholder="Add a city, like London or Tokyo" aria-label="Add a city"><datalist id="wc-zones">${zones.map((z) => `<option value="${NX.esc(z.split("/").pop().replace(/_/g, " "))}">${NX.esc(z.replace(/_/g, " "))}</option>`).join("")}</datalist><button class="btn" type="submit">Add</button></form><div class="wc-list"></div></div>`;
            const f = face.querySelector(".wc-add");
            f.onsubmit = (e) => { e.preventDefault(); const q = f.querySelector("input").value.trim().toLowerCase().replace(/ /g, "_"); if (!q) return;
              const z = zones.find((x) => x.toLowerCase() === q) || zones.find((x) => x.split("/").pop().toLowerCase() === q) || zones.find((x) => x.toLowerCase().includes(q));
              if (!z) { NX.toast("That city wasn't found. Try a big city near it."); return; }
              const list = NX.data("world-clocks", []); if (!list.includes(z)) NX.setData("world-clocks", [...list, z].slice(-8)); f.querySelector("input").value = ""; face.querySelector(".wc-list").dataset.k = "redraw"; draw(); };
            face.querySelector(".wc-list").onclick = (e) => { const b = e.target.closest("[data-wcdel]"); if (!b) return; NX.setData("world-clocks", NX.data("world-clocks", []).filter((x) => x !== b.dataset.wcdel)); face.querySelector(".wc-list").dataset.k = "redraw"; draw(); };
          }
          face.querySelector(".clk-big").textContent = NX.fmtTime(d, true); face.querySelector(".clk-sub").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
          const list = NX.data("world-clocks", []), box = face.querySelector(".wc-list"), here = d.toLocaleDateString("en-CA");
          const rows = list.map((z) => { let t = "", day = "", off = ""; try { t = d.toLocaleTimeString([], { timeZone: z, hour: "numeric", minute: "2-digit" }); const ds = d.toLocaleDateString("en-CA", { timeZone: z }); day = ds === here ? "Today" : ds > here ? "Tomorrow" : "Yesterday"; const loc = new Date(d.toLocaleString("en-US", { timeZone: z })), mine = new Date(d.toLocaleString("en-US")); const h = Math.round((loc - mine) / 1800000) / 2; off = h === 0 ? "Same time" : (h > 0 ? "+" : "") + h + (Math.abs(h) === 1 ? " hour" : " hours"); } catch (e) { t = "?"; } return [z, t, day, off]; });
          const k = rows.map((r) => r.join("|")).join(";");
          if (box.dataset.k !== k) { box.dataset.k = k; box.innerHTML = rows.length ? rows.map(([z, t, day, off]) => `<div class="wc-row"><span><b>${NX.esc(z.split("/").pop().replace(/_/g, " "))}</b><small>${day} · ${off}</small></span><strong>${NX.esc(t)}</strong><button class="btn sm" data-wcdel="${NX.esc(z)}" aria-label="Remove ${NX.esc(z.split("/").pop().replace(/_/g, " "))}">${NX.icon("close", 12)}</button></div>`).join("") : `<p class="clk-sub">Add cities to see their time.</p>`; }
        }
        if (v === "sw") { const t = swT + (swOn ? now - swAt : 0); face.innerHTML = `<div class="clk-big mono">${fmtMs(t)}</div><div class="clk-btns"><button class="btn primary" data-a="sws">${swOn ? "Pause" : "Start"}</button><button class="btn" data-a="swl" ${swOn ? "" : "disabled"}>Lap</button><button class="btn" data-a="swr">Reset</button></div><ol class="clk-laps">${laps.map((l, i) => `<li><span>Lap ${laps.length - i}</span><b>${fmtMs(l)}</b></li>`).join("")}</ol>`; }
        if (v === "al") { const L = NX.alarms.list();
          face.innerHTML = `<form class="al-new"><input type="time" name="t" value="07:00" aria-label="Time" required><input name="n" maxlength="40" placeholder="Name (optional)" aria-label="Name"><span class="al-days">${NX.alarms.days.map((x, i) => `<label><input type="checkbox" value="${i}"><span>${x}</span></label>`).join("")}</span><button class="btn primary" type="submit">Add alarm</button></form>
            <div class="al-list">${L.length ? L.map((a) => `<div class="al-row ${a.on ? "" : "off"}" data-al="${a.id}"><b>${NX.esc(a.time)}</b><span><small>${NX.esc(a.name || "Alarm")}</small><small>${a.days.length === 7 ? "Every day" : a.days.length ? a.days.map((i) => NX.alarms.days[i]).join(", ") : "Once"}</small></span><label class="tg"><input type="checkbox" data-alon ${a.on ? "checked" : ""} aria-label="On"><i></i></label><button class="btn sm" data-aldel aria-label="Delete alarm">${NX.icon("trash", 14)}</button></div>`).join("") : `<p class="clk-sub">No alarms yet. Alarms ring while Nebulux OS is on.</p>`}</div>`;
          const f = face.querySelector(".al-new"); f.onsubmit = (e) => { e.preventDefault(); try { NX.alarms.add(f.t.value, [...f.querySelectorAll(".al-days input:checked")].map((x) => +x.value), f.n.value.trim()); NX.toast("Alarm set for " + f.t.value + "."); } catch (er) { NX.toast(er.message); } draw(); };
          face.querySelectorAll("[data-al]").forEach((r) => { const id = r.dataset.al;
            r.querySelector("[data-alon]").onchange = (e) => { NX.alarms.save(NX.alarms.list().map((a) => (a.id === id ? Object.assign({}, a, { on: e.target.checked }) : a))); draw(); };
            r.querySelector("[data-aldel]").onclick = () => { NX.alarms.save(NX.alarms.list().filter((a) => a.id !== id)); draw(); }; });
        }
        if (v === "fo") { const on = NX.focusSession.on(), n = NX.focusSession.today();
          face.innerHTML = on ? `<div class="clk-ring" style="--p:${(1 - NX.focusSession.left() / NX.focusSession.len()) * 100}"><div class="clk-big mono">${fmtMs(NX.focusSession.left()).slice(0, -3)}</div></div><div class="clk-sub">Do not disturb is on until it's done.</div><div class="clk-btns"><button class="btn" data-a="fostop">Stop</button></div>`
            : `<div class="clk-sub" style="margin-top:6px">Focus for a while. Do not disturb stays on until it's done.</div><div class="clk-btns">${[15, 25, 45, 60].map((m) => `<button class="btn ${m === 25 ? "primary" : ""}" data-a="fo${m}">${m} min</button>`).join("")}</div><div class="clk-sub">${n ? n + (n === 1 ? " session" : " sessions") + " today" : "No focus sessions yet today"}</div>`; }
        if (v === "tm") { const left = tmOn ? tmLeft - (now - tmAt) : tmLeft; face.innerHTML = `<div class="clk-big mono">${fmtMs(left).slice(0, -3)}</div><div class="clk-btns">${tmOn ? "" : `<button class="btn" data-a="t1">1 min</button><button class="btn" data-a="t5">5 min</button><button class="btn" data-a="t10">10 min</button>`}</div><div class="clk-btns"><button class="btn primary" data-a="tms">${tmOn ? "Pause" : "Start"}</button><button class="btn" data-a="tmr">Reset</button></div>`;
 }
      };
      body.querySelector(".clk-tabs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; v = b.dataset.v; body.querySelectorAll(".clk-tabs button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
      face.onclick = (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a, now = performance.now();
        if (a === "sws") { if (swOn) { swT += now - swAt; swOn = false; } else { swAt = now; swOn = true; } }
        if (a === "swl") laps.unshift(swT + now - swAt);
        if (a === "swr") { swOn = false; swT = 0; laps = []; }
        if (a === "t1" || a === "t5" || a === "t10") { tmSet = tmLeft = { t1: 60000, t5: 300000, t10: 600000 }[a]; }
        if (a === "tms") { if (tmOn) { tmLeft -= now - tmAt; tmOn = false; } else if (tmLeft > 0) { tmAt = now; tmOn = true; } }
        if (a === "tmr") { tmOn = false; tmLeft = tmSet; }
        if (/^fo\d+$/.test(a)) NX.focusSession.start(+a.slice(2));
        if (a === "fostop") NX.focusSession.finish(false);
        draw();
      };
      // the tick only updates the time text, so buttons are never rebuilt under the pointer
      const tick = setInterval(() => {
        const big = face.querySelector(".clk-big") || { set textContent(x) { /* this face shows no time (Alarms) */ } }, now = performance.now();
        if (v === "clock") { const d = new Date(); big.textContent = NX.fmtTime(d, true); }
        else if (v === "sw" && swOn) big.textContent = fmtMs(swT + now - swAt);
        else if (v === "tm" && tmOn) big.textContent = fmtMs(tmLeft - (now - tmAt)).slice(0, -3);
        else if (v === "fo" && NX.focusSession.on()) { big.textContent = fmtMs(NX.focusSession.left()).slice(0, -3); const r = face.querySelector(".clk-ring"); if (r) r.style.setProperty("--p", (1 - NX.focusSession.left() / NX.focusSession.len()) * 100); }
        if (tmOn && tmLeft - (now - tmAt) <= 0) { tmOn = false; tmLeft = tmSet; NX.toast("Time's up!"); NX.beep && NX.beep(); draw(); }
      }, 50);
      const onFocus = () => { if (v === "fo") draw(); }; document.addEventListener("nx:focus", onFocus);
      const onAl = () => { if (v === "al" && !face.contains(document.activeElement)) draw(); }; document.addEventListener("nx:alarms", onAl);
      win.onclose = () => { clearInterval(tick); document.removeEventListener("nx:focus", onFocus); document.removeEventListener("nx:alarms", onAl); }; draw();
    } };

  // ---------- Comet Snake: an original arcade game ----------
  A.snake = { name: "Comet Snake", icon: "snake", category: "Games", rating: "4.9", size: "1 MB", w: 560, h: 620, minW: 360, minH: 420, desc: "Steer a comet through space, collect stardust to grow, and don't hit your own tail. Arrow keys or WASD, or swipe.",
    open(body, win) {
      body.classList.add("snk");
      body.innerHTML = `<div class="snk-top"><span>Score <b class="snk-s">0</b></span><span>Best <b class="snk-b">${NX.data("snake-best", 0)}</b></span></div><div class="snk-wrap"><canvas></canvas><div class="snk-msg"><b>Comet Snake</b><span>Arrow keys or WASD to steer. Swipe on a touch screen.</span><button class="btn primary">Play</button></div></div>`;
      const cv = body.querySelector("canvas"), g = cv.getContext("2d"), msg = body.querySelector(".snk-msg"), N = 20;
      let sn, dir, nd, food, score, run = false, loop = 0, cell = 20;
      const size = () => { const r = body.querySelector(".snk-wrap").getBoundingClientRect(); const s = Math.max(200, Math.floor(Math.min(r.width, r.height) - 16)); cell = Math.floor(s / N); cv.width = cv.height = cell * N; draw(); };
      const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (sn.some((p) => p[0] === food[0] && p[1] === food[1])); };
      const reset = () => { sn = [[10, 10], [9, 10], [8, 10]]; dir = nd = [1, 0]; score = 0; body.querySelector(".snk-s").textContent = 0; place(); };
      const draw = () => {
        if (!sn) return; g.fillStyle = "#0b0620"; g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (((i * 37) % 10) / 20 + 0.1) + ")"; g.fillRect(((i * 97) % N) * cell + cell / 2, ((i * 53) % N) * cell + cell / 3, 1.5, 1.5); }
        g.fillStyle = "#fde68a"; g.beginPath(); g.arc(food[0] * cell + cell / 2, food[1] * cell + cell / 2, cell * 0.32, 0, 7); g.fill();
        sn.forEach((p, i) => { const t = i / sn.length; g.fillStyle = `hsl(${190 + t * 110},90%,${65 - t * 20}%)`; const pad = i ? cell * 0.14 : cell * 0.06; g.beginPath(); g.roundRect ? g.roundRect(p[0] * cell + pad, p[1] * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.3) : g.rect(p[0] * cell + pad, p[1] * cell + pad, cell - pad * 2, cell - pad * 2); g.fill(); });
      };
      const step = () => {
        dir = nd; const h = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || sn.some((p) => p[0] === h[0] && p[1] === h[1])) { end(); return; }
        sn.unshift(h); if (h[0] === food[0] && h[1] === food[1]) { score++; body.querySelector(".snk-s").textContent = score; place(); } else sn.pop(); draw();
      };
      const end = () => { run = false; clearInterval(loop); const best = Math.max(score, NX.data("snake-best", 0)); NX.setData("snake-best", best); body.querySelector(".snk-b").textContent = best; msg.querySelector("b").textContent = "Game over · " + score; msg.querySelector("button").textContent = "Play again"; msg.hidden = false; };
      const start = () => { reset(); msg.hidden = true; run = true; clearInterval(loop); loop = setInterval(step, 115); draw(); };
      msg.querySelector("button").onclick = start;
      const turn = (x, y) => { if (!run) return; if (x === -dir[0] && y === -dir[1]) return; nd = [x, y]; };
      const key = (e) => { if (!win.el.classList.contains("active")) return; const m = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (m && run) { e.preventDefault(); turn(m[0], m[1]); } };
      let ts = null; cv.addEventListener("touchstart", (e) => { ts = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
      cv.addEventListener("touchend", (e) => { if (!ts) return; const dx = e.changedTouches[0].clientX - ts[0], dy = e.changedTouches[0].clientY - ts[1]; if (Math.abs(dx) + Math.abs(dy) > 24) Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); ts = null; }, { passive: true });
      addEventListener("keydown", key); win.onclose = () => { clearInterval(loop); removeEventListener("keydown", key); };
      win.onresize = () => setTimeout(size, 0); reset(); setTimeout(size, 30);
    } };

  // ---------- web apps (a new tab in a browser; their own window on the real OS) ----------
  A.youtube = { name: "YouTube", icon: "youtube", builtIn: true, url: "https://www.youtube.com/", desc: "Watch videos on YouTube." };
  A.nebuluxai = { name: "Nebulux AI", icon: "ai", category: "Web", rating: "4.8", size: "Web app", url: "https://nebuluxai.com", desc: "Chat with AI, make games and websites on nebuluxai.com." };
  A.arcade = { name: "Nebulux Arcade", icon: "arcade", category: "Web", rating: "4.7", size: "Web app", url: "https://nebuluxai.com/arcade", desc: "Play Nebula Royale, Nebula Brawl and dozens of free games." };
})();
