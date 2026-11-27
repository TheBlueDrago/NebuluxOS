// The apps in the Nebulux Store. Each one runs in its own window and keeps its data with your account.
"use strict";
(function () {
  const A = NX.apps;

  // ---------- Notepad: saves as you type, as a note with your account or as a real text file ----------
  // Markdown to safe HTML (Notepad Preview, File Explorer preview): everything is escaped first, links are https only
  NX.mdHTML = (src) => {
    const inline = (t) => NX.esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>").replace(/~~([^~]+)~~/g, "<s>$1</s>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, a, u) => `<a href="${u}" data-mdlink="${u}">${a}</a>`);
    const out = []; let list = null, code = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of String(src).split(String.fromCharCode(10))) {
      if (/^```/.test(line)) { if (code !== null) { out.push(`<pre>${NX.esc(code)}</pre>`); code = null; } else { close(); code = ""; } continue; }
      if (code !== null) { code += (code ? String.fromCharCode(10) : "") + line; continue; }
      let m;
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { close(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); }
      else if ((m = /^\s*[-*+]\s+\[( |x)\]\s+(.*)$/i.exec(line))) { if (list !== "ul") { close(); out.push("<ul class=\"np-task\">"); list = "ul"; } out.push(`<li><i class="np-box ${m[1].trim() ? "on" : ""}"></i>${inline(m[2])}</li>`); }
      else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = /^>\s?(.*)$/.exec(line))) { close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
      else if (/^\s*(---|\*\*\*)\s*$/.test(line)) { close(); out.push("<hr>"); }
      else if (!line.trim()) { close(); }
      else { close(); out.push(`<p>${inline(line)}</p>`); }
    }
    if (code !== null) out.push(`<pre>${NX.esc(code)}</pre>`); close(); return out.join("");
  };
  A.notepad = { name: "Notepad", icon: "notepad", category: "Productivity", rating: "4.7", size: "1 MB", w: 760, h: 520, desc: "Write notes and lists. Everything saves by itself as you type. Open and save text files too.",
    open(body, win, opts) {
      body.classList.add("np");
      body.innerHTML = `<div class="np-tabs" role="tablist" aria-label="Notes"></div><div class="np-bar"><button class="btn sm" data-a="new">New tab</button><button class="btn sm" data-a="open">Open</button><button class="btn sm" data-a="save">Save to Documents</button><button class="btn sm" data-a="dl">Download</button><button class="btn sm" data-a="ver" title="Go back to an earlier version">Versions</button><button class="btn sm" data-a="speak" title="Read the selected words, or the whole note, out loud">Read aloud</button><button class="btn sm" data-a="md" aria-pressed="false" title="See the note formatted: # headings, **bold**, *italic*, lists and links (Markdown)">Preview</button><span class="np-sp"></span><button class="btn sm" data-a="wrap" aria-pressed="true" title="Word wrap">Wrap</button><button class="btn sm" data-a="-" aria-label="Smaller text">A-</button><button class="btn sm" data-a="+" aria-label="Bigger text">A+</button></div><form class="np-find" hidden><input name="f" placeholder="Find" aria-label="Find"><input name="r" placeholder="Replace with" aria-label="Replace with" hidden><button class="btn sm np-mc" type="button" data-f="case" aria-pressed="false" title="Match case" aria-label="Match case">Aa</button><button class="btn sm" type="button" data-f="next">Next</button><button class="btn sm" type="button" data-f="rep" hidden>Replace</button><button class="btn sm" type="button" data-f="all" hidden>Replace all</button><span class="np-fmsg"></span><button class="btn sm" type="button" data-f="close" aria-label="Close find">${NX.icon("close", 12)}</button></form><textarea spellcheck="true" placeholder="Start typing..." aria-label="Note"></textarea><article class="np-md" hidden aria-label="Formatted note"></article><div class="np-status"><span class="np-pos">Ln 1, Col 1</span><span class="np-count"></span><span class="np-saved">Saved</span></div>`;
      const ta = body.querySelector("textarea"), cnt = body.querySelector(".np-count"), sv = body.querySelector(".np-saved"), saveBtn = body.querySelector("[data-a=save]");
      let size = NX.data("np-size", 15), t = 0, file = null; ta.style.fontSize = size + "px";
      // word wrap (on by default, kept for next time) and where the cursor is
      const wrapBtn = body.querySelector("[data-a=wrap]"), setWrap = (on) => { ta.wrap = on ? "soft" : "off"; ta.classList.toggle("np-nowrap", !on); wrapBtn.classList.toggle("on", on); wrapBtn.setAttribute("aria-pressed", on); };
      setWrap(NX.data("np-wrap", true));
      const pos = body.querySelector(".np-pos"), where = () => { const before = ta.value.slice(0, ta.selectionStart).split("\n"); pos.textContent = "Ln " + before.length + ", Col " + (before[before.length - 1].length + 1); };
      ["keyup", "click", "input", "select"].forEach((ev) => ta.addEventListener(ev, where));
      pos.title = "Go to line (Ctrl + G)"; pos.classList.add("np-posbtn"); pos.onclick = () => goLine();
      // Preview (4.4, like Windows Notepad's Markdown): # headings, **bold**, *italic*, `code`, lists, > quotes and [links](https://...)
      const mdHTML = NX.mdHTML;
      const md = body.querySelector(".np-md");
      const mdShow = (on) => { md.hidden = !on; ta.hidden = !!on; const b = body.querySelector("[data-a=md]"); b.classList.toggle("on", !!on); b.setAttribute("aria-pressed", !!on); if (on) md.innerHTML = mdHTML(ta.value) || `<p class="np-mdnone">Nothing to show yet. Type some Markdown, like # A heading or **bold**.</p>`; };
      md.addEventListener("click", (e) => { const a = e.target.closest("[data-mdlink]"); if (a) { e.preventDefault(); NX.open("google", { url: a.dataset.mdlink }); } });
      const title = () => { win.el.querySelector(".wt-name").textContent = (file ? NX.fs.base(file) : "Notepad"); saveBtn.hidden = !!file; };
      // tabs: each one is a note Notepad keeps for you ("Untitled" until it has a first line) or a text file; they come back next time
      let tabs = (NX.data("np-tabs", null) || [{ id: 1 }]).filter((x) => x && x.id); if (!tabs.length) tabs = [{ id: 1 }];
      let ti = Math.max(0, Math.min(+NX.data("np-tab", 0) || 0, tabs.length - 1));
      const keyOf = (tb) => (tb.id === 1 ? "np-text" : "np-text-" + tb.id), strip = body.querySelector(".np-tabs");
      const tabsSave = () => { NX.setData("np-tabs", tabs.map((x) => (x.file ? { id: x.id, file: x.file } : { id: x.id }))); NX.setData("np-tab", ti); };
      const tabName = (tb, k) => { if (tb.file) return NX.fs.base(tb.file); const txt = k === ti ? ta.value : NX.data(keyOf(tb), ""); return (txt.split("\n").find((x) => x.trim()) || "").trim().replace(/^#+\s*/, "").slice(0, 24) || "Untitled"; };
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
        await flush(); const tb = tabs[k]; if (!tb) return; closedNotes = [...closedNotes, { file: tb.file || null, text: tb.file ? "" : (k === ti ? ta.value : NX.data(keyOf(tb), "")) }].slice(-10); if (!tb.file) NX.setData(keyOf(tb), "");
        tabs.splice(k, 1); if (!tabs.length) tabs = [{ id: 1 }];
        if (k < ti) ti--; ti = Math.max(0, Math.min(ti, tabs.length - 1)); t = 0; await loadTab(ti);
      }
      strip.onclick = (e) => { const x = e.target.closest("[data-tx]"); if (x) { closeTab(+x.dataset.tx); return; } if (e.target.closest("[data-tadd]")) { newTab(); return; } const b = e.target.closest("[data-ti]"); if (b && +b.dataset.ti !== ti) loadTab(+b.dataset.ti); };
      strip.onauxclick = (e) => { const b = e.target.closest("[data-ti]"); if (e.button === 1 && b) closeTab(+b.dataset.ti); };
      // for the keyboard shortcuts (js/keys.js); a closed note can come back with Ctrl + Shift + T
      let closedNotes = [];
      win.tabs = { count: () => tabs.length, add: () => newTab(), close: () => closeTab(ti), go: (i) => loadTab(i), step: (d) => loadTab((ti + d + tabs.length) % tabs.length),
        reopen: async () => { const c = closedNotes.pop(); if (!c) { NX.toast("There's no closed note to bring back."); return; } await flush(); const id = newId(); tabs.push(c.file ? { id, file: c.file } : { id }); if (!c.file) NX.setData("np-text-" + id, c.text); await loadTab(tabs.length - 1); } };
      win.print = () => NX.printDoc(file ? NX.fs.base(file) : tabName(tabs[ti], ti), `<pre>${NX.esc(ta.value)}</pre>`);
      win.save = async () => { if (file) { await flush(); NX.toast("Saved " + NX.fs.base(file) + "."); } else body.querySelector(".np-bar [data-a=save]").click(); };
      win.np2 = { tabs: () => tabs.map((x, k) => ({ file: x.file || null, name: tabName(x, k), on: k === ti })), newTab, closeTab, loadTab };
      const count = () => { const v = ta.value; cnt.textContent = (v.trim() ? v.trim().split(/\s+/).length : 0) + " words · " + v.length + " characters"; };
      const verKey = () => (file ? "f:" + file : "n:" + (tabs[ti] ? tabs[ti].id : 1));
      const keepVersion = (force) => { const k = verKey(), all = Object.assign({}, NX.data("np-versions", {})), L = all[k] || [], t = ta.value; if (!t.trim() || (L[0] && L[0].t === t)) return; if (!force && L[0] && Date.now() - L[0].at < 120000) return;
        all[k] = [{ at: Date.now(), t: t.slice(0, 30000) }, ...L].slice(0, 12); const keys = Object.keys(all); if (keys.length > 40) keys.sort((a, b) => (all[a][0] || {}).at - (all[b][0] || {}).at).slice(0, keys.length - 40).forEach((x) => delete all[x]); NX.setData("np-versions", all); };
      win.npKeep = keepVersion;
      const saveNow = () => { keepVersion(false);
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
          // like Save as: pick the name (it starts with the first line)
          let nm = await NX.ask(body, { title: "Save in Documents", input: true, value: first + ".txt", ok: "Save" }); if (!nm) return;
          nm = String(nm).trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "").replace(/^\.+/, "").slice(0, 80) || first + ".txt"; if (!/\.[a-z0-9]{1,5}$/i.test(nm)) nm += ".txt";
          try { const dir = await NX.folder("Documents"); const r = await NX.fs.create(dir, nm, false); file = r.path; await NX.fs.write(file, ta.value); NX.setData(keyOf(tabs[ti]), ""); tabs[ti].file = file; tabsSave(); drawTabs(); title(); sv.textContent = "Saved in Documents"; NX.toast("Saved in Documents as " + r.name + "."); NX.filesChanged && NX.filesChanged(); } catch (er) { NX.toast(er.message); }
        }
        if (k === "dl") { const url = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" })), l = document.createElement("a"); l.href = url; l.download = file ? NX.fs.base(file) : "note.txt"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        if (k === "md") { mdShow(md.hidden); return; }
        if (k === "speak") {
          // Read aloud: the selected words, or everything (press it again to stop)
          const SS = window.speechSynthesis; if (!SS || typeof SpeechSynthesisUtterance === "undefined") { NX.toast("This computer can’t read out loud."); return; }
          if (SS.speaking) { SS.cancel(); a.textContent = "Read aloud"; return; }
          const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd), text = (sel.trim() ? sel : ta.value).trim(); if (!text) { NX.toast("There’s nothing to read yet."); return; }
          const u = new SpeechSynthesisUtterance(text.slice(0, 30000)); u.rate = +NX.prefs().narratorRate || 1; u.onend = u.onerror = () => { a.textContent = "Read aloud"; };
          a.textContent = "Stop reading"; SS.speak(u); if (NX.narrator) NX.narrator.read = text.slice(0, 200); return;
        }
        if (k === "ver") {
          const L = (NX.data("np-versions", {})[verKey()] || []).filter((v) => v.t !== ta.value); const r = a.getBoundingClientRect();
          if (!L.length) { NX.toast("No earlier versions yet. Notepad keeps one every couple of minutes while you write."); return; }
          NX.menu(r.left, r.bottom + 4, L.slice(0, 10).map((v) => [new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "  ·  " + (v.t.split("\n").find((x) => x.trim()) || "").trim().slice(0, 28), () => { keepVersion(true); ta.value = v.t; ta.dispatchEvent(new Event("input")); NX.toast("Went back to the version from " + new Date(v.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ". The newer text is kept in Versions."); }]));
          return;
        }
        if (k === "wrap") { const on = ta.wrap === "off"; setWrap(on); NX.setData("np-wrap", on); }
        if (k === "+" || k === "-") { size = Math.max(11, Math.min(32, size + (k === "+" ? 2 : -2))); ta.style.fontSize = size + "px"; NX.setData("np-size", size); }
      };
      win.onopts = (o) => { if (o.file) openFile(o.file); };
      win.onclose = () => { flush(); };
      loadTab(ti).then(() => { if (opts && opts.file) openFile(opts.file); });
      // Find (Ctrl + F) and Replace (Ctrl + H), not case-sensitive
      const fb = body.querySelector(".np-find"), fi = fb.f, ri = fb.r, fmsg = body.querySelector(".np-fmsg");
      const findOpen = (rep) => { fb.hidden = false; ri.hidden = !rep; fb.querySelector("[data-f=rep]").hidden = !rep; fb.querySelector("[data-f=all]").hidden = !rep; const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (sel && !sel.includes("\n")) fi.value = sel; fi.focus(); fi.select(); };
      // Match case (the Aa button): off finds Red and red alike
      let matchCase = false; const cs = (t) => (matchCase ? String(t) : String(t).toLowerCase());
      const findNext = () => { const q = fi.value; if (!q) return false; const hay = cs(ta.value), n = cs(q); let i = hay.indexOf(n, ta.selectionEnd); if (i < 0) i = hay.indexOf(n); if (i < 0) { fmsg.textContent = "Not found"; return false; } { let total = 0, nth = 0, j = hay.indexOf(n); while (j >= 0 && total < 9999) { total++; if (j === i) nth = total; j = hay.indexOf(n, j + Math.max(1, n.length)); } fmsg.textContent = nth + " of " + total; } ta.focus(); ta.setSelectionRange(i, i + q.length); fi.focus(); return true; };
      const replaceOne = () => { const q = fi.value; if (!q) return; if (cs(ta.value.slice(ta.selectionStart, ta.selectionEnd)) !== cs(q) && !findNext()) return; ta.setRangeText(ri.value, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); findNext(); };
      const replaceAll = () => { const q = fi.value; if (!q) return; let n = 0; const low = cs(q); let out = "", i = 0, v = ta.value, lv = cs(v); for (;;) { const j = lv.indexOf(low, i); if (j < 0) break; out += v.slice(i, j) + ri.value; i = j + q.length; n++; } if (!n) { fmsg.textContent = "Not found"; return; } ta.value = out + v.slice(i); ta.dispatchEvent(new Event("input")); fmsg.textContent = n === 1 ? "Replaced 1" : "Replaced " + n; };
      fb.onsubmit = (e) => { e.preventDefault(); findNext(); };
      // Go to line (Ctrl + G, or click Ln and Col at the bottom)
      const goLine = async () => {
        const lines = ta.value.split("\n"), now = ta.value.slice(0, ta.selectionStart).split("\n").length;
        const v = await NX.ask(body, { title: "Go to line", text: "Line 1 to " + lines.length, input: true, value: String(now), ok: "Go" }); if (v == null || v === false) { ta.focus(); return; }
        const n = Math.max(1, Math.min(lines.length, parseInt(v, 10) || 1)); let at = 0; for (let k = 0; k < n - 1; k++) at += lines[k].length + 1;
        ta.focus(); ta.setSelectionRange(at, at); const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20; ta.scrollTop = Math.max(0, (n - 3) * lh); ta.dispatchEvent(new Event("keyup"));
      };
      win.npGoLine = goLine;
      fb.onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; const k = b.dataset.f; if (k === "case") { matchCase = !matchCase; b.classList.toggle("on", matchCase); b.setAttribute("aria-pressed", matchCase); fmsg.textContent = ""; return; } if (k === "next") findNext(); if (k === "rep") replaceOne(); if (k === "all") replaceAll(); if (k === "close") { fb.hidden = true; fmsg.textContent = ""; ta.focus(); } };
      fb.onkeydown = (e) => { if (e.key === "Escape") { e.stopPropagation(); fb.hidden = true; ta.focus(); } if (e.key === "Enter") { e.preventDefault(); if (e.target === ri) replaceOne(); else findNext(); } };
      body.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[fh]$/i.test(e.key)) { e.preventDefault(); findOpen(e.key.toLowerCase() === "h"); } if (e.key === "F3") { e.preventDefault(); findNext(); }
        // Ctrl + G: Go to line
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^g$/i.test(e.key)) { e.preventDefault(); goLine(); }
        // F5: the date and time where you're typing, like Windows Notepad
        if (e.key === "F5" && e.target === ta) { e.preventDefault(); const d = new Date(); ta.setRangeText(NX.fmtTime(d) + " " + d.toLocaleDateString(), ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input", { bubbles: true })); } });
      win.np = { findOpen, findNext, replaceAll, ta };
      count(); setTimeout(() => ta.focus(), 60);
    } };

  // ---------- Calculator: a real calculator (no eval), with keyboard keys ----------
  // works out a sum like 2^10 or sin(30) + log(100) (a small parser, no eval); used by Calculator and Quick Search
  NX.calcEval = (src, degrees, vars) => {
    const s = String(src).replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi"); let i = 0;
    const fail = () => { throw new Error("That doesn't look right."); };
    const toRad = (x) => (degrees ? x * Math.PI / 180 : x), fromRad = (x) => (degrees ? x * 180 / Math.PI : x);
    const FN = { sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => Math.tan(toRad(x)), asin: (x) => fromRad(Math.asin(x)), acos: (x) => fromRad(Math.acos(x)), atan: (x) => fromRad(Math.atan(x)), log: Math.log10, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs };
    const fact = (n) => { if (n < 0 || n !== Math.floor(n) || n > 170) fail(); let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
    const peek = () => s[i];
    const num = () => { const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i)); if (!m) fail(); i += m[0].length; return parseFloat(m[0]); };
    const atom = () => {
      if (peek() === "(") { i++; const v = expr(); if (peek() !== ")") fail(); i++; return v; }
      if (peek() === "-") { i++; return -power(); } if (peek() === "+") { i++; return power(); }
      const w = /^[a-z]+/i.exec(s.slice(i));
      if (w) { const name = w[0].toLowerCase(); i += w[0].length; if (name === "pi") return Math.PI; if (name === "e") return Math.E; if (vars && name in vars) return vars[name]; const f = FN[name]; if (!f || peek() !== "(") fail(); i++; const v = expr(); if (peek() !== ")") fail(); i++; return f(v); }
      return num();
    };
    const post = () => { let v = atom(); while (peek() === "!" || peek() === "%") { v = peek() === "!" ? fact(v) : v / 100; i++; } return v; };
    const power = () => { const b = post(); if (peek() === "^") { i++; return Math.pow(b, power()); } return b; };
    const term = () => { let v = power(); for (;;) { const c = peek(); if (c === "*") { i++; v *= power(); } else if (c === "/") { i++; const d = power(); v = d === 0 ? Infinity : v / d; } else if (c === "(" || (c && /[a-z\d.]/i.test(c) && /[\d)!%a-z.]/i.test(s[i - 1] || ""))) { v *= power(); } else return v; } };
    const expr = () => { let v = term(); for (;;) { if (peek() === "+") { i++; v += term(); } else if (peek() === "-") { i++; v -= term(); } else return v; } };
    if (!s) return 0; const v = expr(); if (i < s.length) fail(); return v;
  };
  // ---------- Clock's timers (4.4): several at once, each with a name and any length; they keep going with Clock closed ----------
  NX.timers = (function () {
    const L = () => NX.data("timers", null) || [{ id: "t1", name: "Timer", len: 300000, rest: 300000, on: false, at: 0 }];
    const save = (T) => { NX.setData("timers", T); document.dispatchEvent(new CustomEvent("nx:timers")); };
    const left = (t) => Math.max(0, t.on ? t.rest - (Date.now() - t.at) : t.rest);
    const edit = (id, fn) => { const T = L(); const t = T.find((x) => x.id === id); if (t) { fn(t, T); save(T); } };
    const api = {
      list: L, get: (id) => L().find((x) => x.id === id), left,
      add: (name, ms, start) => { const T = L(); if (T.length >= 12) { NX.toast("That's a lot of timers. Delete one first."); return; } T.push({ id: NX.uid(), name: String(name).slice(0, 30), len: ms, rest: ms, on: !!start, at: Date.now() }); save(T); },
      toggle: (id) => edit(id, (t) => { if (t.on) { t.rest = left(t); t.on = false; } else { if (t.rest <= 0) t.rest = t.len; t.at = Date.now(); t.on = true; } }),
      reset: (id) => edit(id, (t) => { t.on = false; t.rest = t.len; }),
      remove: (id) => { save(L().filter((x) => x.id !== id)); },
    };
    setInterval(() => { if (!NX.me) return; const T = L(); let ch = false; for (const t of T) if (t.on && left(t) <= 0) { t.on = false; t.rest = t.len; ch = true; if (NX.alarms && NX.alarms.ring) NX.alarms.ring({ name: (t.name === "Timer" ? "Timer" : t.name) + ": time's up", snooze: false }); } if (ch) save(T); }, 1000);
    return api;
  })();
  A.calculator = { name: "Calculator", icon: "calculator", category: "Utilities", rating: "4.8", size: "1 MB", w: 390, h: 640, minW: 300, minH: 440, desc: "Add, subtract, multiply and divide, with percent, square root and your keyboard.",
    open(body, win) {
      body.classList.add("calc");
      const K = [["%", "pct"], ["CE", "ce"], ["C", "c"], ["⌫", "bs"], ["1/x", "inv"], ["x²", "sq"], ["√x", "sqrt"], ["÷", "/"], ["7"], ["8"], ["9"], ["×", "*"], ["4"], ["5"], ["6"], ["−", "-"], ["1"], ["2"], ["3"], ["+", "+"], ["±", "neg"], ["0"], [".", "."], ["=", "="]];
      body.innerHTML = `<div class="seg c-mode"><button data-m="std" class="on">Standard</button><button data-m="sci">Scientific</button><button data-m="conv">Converter</button><button data-m="date">Dates</button><button data-m="prog">Programmer</button><button data-m="graph">Graph</button></div><div class="c-conv" hidden></div><div class="c-prog" hidden></div><div class="c-graph" hidden></div><div class="c-date" hidden></div><div class="c-sci" hidden></div><div class="c-disp"><button class="c-hbtn" aria-label="History" title="History">${NX.icon("time", 16)}</button><small class="c-expr"></small><b class="c-val">0</b></div><div class="c-hist" hidden></div><div class="c-mem" role="group" aria-label="Memory">${[["mc", "MC", "Clear memory"], ["mr", "MR", "Recall memory"], ["m+", "M+", "Add to memory"], ["m-", "M-", "Take away from memory"], ["ms", "MS", "Store in memory"]].map(([k, t, l]) => `<button class="c-mk" data-k="${k}" aria-label="${l}" title="${l}">${t}</button>`).join("")}<span class="c-memv"></span></div><div class="c-keys">${K.map(([l, k]) => `<button class="c-k ${/^[0-9.]$/.test(k || l) ? "num" : ""} ${(k || l) === "=" ? "eq" : ""}" data-k="${k || l}">${l}</button>`).join("")}</div>`;
      let cur = "0", prev = null, op = null, fresh = true, expr = "", mem = NX.data("calc-mem", null);
      const memDraw = () => { NX.setData("calc-mem", mem); const v = body.querySelector(".c-memv"); if (v) v.textContent = mem == null ? "" : "M = " + fmt(mem); body.querySelectorAll("[data-k=mc],[data-k=mr]").forEach((b) => (b.disabled = mem == null)); };
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
        // memory, like Windows Calculator: MS stores, MR recalls, M+ and M- add and take away, MC clears
        else if (/^m[scr+-]$/.test(k)) { const n = parseFloat(cur) || 0; if (k === "ms") mem = n; if (k === "m+") mem = (mem || 0) + n; if (k === "m-") mem = (mem || 0) - n; if (k === "mc") mem = null; if (k === "mr" && mem != null) { cur = fmt(mem); fresh = true; } if (k !== "mr") fresh = true; memDraw(); }
        show();
      };
      body.querySelector(".c-keys").onclick = (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.k); };
      body.querySelector(".c-mem").onclick = (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.k); }; setTimeout(memDraw, 0);
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
      // Scientific: type or tap a whole expression, like 2^10 or sin(30) + log(100); worked out by a small parser (no eval)
      const sci = body.querySelector(".c-sci"); let deg = true;
      const SK = [["sin", "sin("], ["cos", "cos("], ["tan", "tan("], ["(", "("], [")", ")"], ["log", "log("], ["ln", "ln("], ["√", "sqrt("], ["x^y", "^"], ["x!", "!"], ["π", "π"], ["7"], ["8"], ["9"], ["÷", "÷"], ["e", "e"], ["4"], ["5"], ["6"], ["×", "×"], ["Deg", "DEG"], ["1"], ["2"], ["3"], ["−", "−"], ["C", "C"], ["⌫", "BS"], ["0"], ["."], ["+"], ["=", "="]];
      const sciDraw = () => {
        sci.innerHTML = `<div class="sc-disp"><input class="sc-in" aria-label="Expression" spellcheck="false" autocomplete="off"><b class="sc-out">0</b></div><div class="sc-keys">${SK.map(([l, k]) => `<button class="c-k ${/^[0-9.]$/.test(k || l) ? "num" : ""} ${(k || l) === "=" ? "eq" : ""}" data-sk="${NX.esc(k || l)}">${l}</button>`).join("")}</div>`;
        const inp = sci.querySelector(".sc-in"), out = sci.querySelector(".sc-out");
        const live = () => { try { const v = NX.calcEval(inp.value, deg); out.textContent = inp.value ? fmt(v) : "0"; out.classList.remove("bad"); } catch (e) { out.classList.add("bad"); } };
        const done = () => { try { const v = NX.calcEval(inp.value, deg), r = fmt(v); if (inp.value && isFinite(v)) NX.setData("calc-history", [{ e: inp.value + " =", r }, ...NX.data("calc-history", [])].slice(0, 20)); inp.value = isFinite(v) ? r : ""; out.textContent = r; } catch (e) { out.textContent = e.message; out.classList.add("bad"); } };
        sci.querySelector(".sc-keys").onclick = (e) => { const b = e.target.closest("[data-sk]"); if (!b) return; const k = b.dataset.sk;
          if (k === "=") done(); else if (k === "C") { inp.value = ""; live(); } else if (k === "BS") { inp.value = inp.value.slice(0, -1); live(); } else if (k === "DEG") { deg = !deg; b.textContent = deg ? "Deg" : "Rad"; live(); } else { inp.value += k; live(); } inp.focus(); };
        inp.oninput = live; inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); done(); } };
        live();
      };
      // Dates: the days between two dates, or a date plus or minus some days (like Windows Calculator)
      const dateEl = body.querySelector(".c-date"), iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const dateDraw = () => {
        const t = iso(new Date());
        dateEl.innerHTML = `<div class="cd-sec"><b>Days between two dates</b><label>From <input type="date" class="cd-a" value="${t}"></label><label>To <input type="date" class="cd-b" value="${t}"></label><p class="cd-out cd-diff"></p></div>
          <div class="cd-sec"><b>Add or take away days</b><label>From <input type="date" class="cd-c" value="${t}"></label><div class="cd-row"><select class="s-sel cd-op"><option value="1">Add</option><option value="-1">Take away</option></select><input type="number" class="cd-n" min="0" max="100000" value="30" aria-label="Days"><span>days</span></div><p class="cd-out cd-sum"></p></div>`;
        const $d = (q) => dateEl.querySelector(q);
        const run = () => {
          const a = new Date($d(".cd-a").value + "T12:00"), b = new Date($d(".cd-b").value + "T12:00");
          if (!isNaN(a) && !isNaN(b)) { const days = Math.round(Math.abs(b - a) / 86400000), w = Math.floor(days / 7), rest = days % 7;
            $d(".cd-diff").innerHTML = days ? `<strong>${days.toLocaleString()} day${days === 1 ? "" : "s"}</strong><small>${w ? w + " week" + (w === 1 ? "" : "s") + (rest ? ", " + rest + " day" + (rest === 1 ? "" : "s") : "") : ""}</small>` : "<strong>Same day</strong>"; }
          const c = new Date($d(".cd-c").value + "T12:00"), n = Math.max(0, Math.min(100000, +$d(".cd-n").value || 0)) * +$d(".cd-op").value;
          if (!isNaN(c)) { c.setDate(c.getDate() + n); $d(".cd-sum").innerHTML = `<strong>${c.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>`; }
        };
        dateEl.querySelectorAll("input,select").forEach((x) => (x.oninput = x.onchange = run)); run();
      };
      // Programmer: one number in hexadecimal, decimal, octal and binary; type in any of them (whole numbers up to 64 bits)
      const prog = body.querySelector(".c-prog"), BASES = [["HEX", 16, /^[0-9a-f]*$/i], ["DEC", 10, /^[0-9]*$/], ["OCT", 8, /^[0-7]*$/], ["BIN", 2, /^[01]*$/]], MAX = (1n << 64n) - 1n;
      let pv = 0n;
      const parseBig = (s, base) => { let v = 0n; for (const ch of s.toLowerCase()) v = v * BigInt(base) + BigInt(parseInt(ch, base)); return v; };
      const progDraw = () => {
        prog.innerHTML = BASES.map(([n, base]) => `<label class="pg-row"><b>${n}</b><input class="pg-in" data-base="${base}" spellcheck="false" autocomplete="off" aria-label="${n}"></label>`).join("") + `<p class="pg-bits"></p><div class="pg-keys">${[["shl", "Shift left"], ["shr", "Shift right"], ["not", "Flip bits"], ["clr", "Clear"]].map(([k, t]) => `<button class="btn sm" data-pk="${k}">${t}</button>`).join("")}</div>`;
        const fill = (skip) => { prog.querySelectorAll(".pg-in").forEach((i) => { if (i !== skip) { const s = pv.toString(+i.dataset.base); i.value = +i.dataset.base === 16 ? s.toUpperCase() : s; } i.classList.remove("bad"); }); const bits = pv.toString(2).length; prog.querySelector(".pg-bits").textContent = pv ? bits + (bits === 1 ? " bit" : " bits") + ", " + pv.toString(2).split("").filter((x) => x === "1").length + " set to 1" : "Type a number in any row."; };
        prog.querySelectorAll(".pg-in").forEach((i) => (i.oninput = () => { const base = +i.dataset.base, s = i.value.trim().replace(/[\s_]/g, ""), re = BASES.find((x) => x[1] === base)[2]; if (!re.test(s)) { i.classList.add("bad"); return; } const v = s ? parseBig(s, base) : 0n; if (v > MAX) { i.classList.add("bad"); return; } pv = v; fill(i); }));
        prog.querySelector(".pg-keys").onclick = (e) => { const b = e.target.closest("[data-pk]"); if (!b) return; const k = b.dataset.pk; pv = k === "shl" ? (pv << 1n) & MAX : k === "shr" ? pv >> 1n : k === "not" ? ~pv & MAX : 0n; fill(null); };
        fill(null);
      };
      // Graph (4.4, like Windows Calculator): up to three functions of x, with a grid, axes, zoom and dragging
      const graph = body.querySelector(".c-graph"), GC = ["#7c5cff", "#22d3ee", "#f472b6"];
      let gv = { cx: 0, cy: 0, sc: 30 }, gDrag = null;
      const gFns = () => { const L = NX.data("calc-graph", null); return Array.isArray(L) ? L : ["sin(x)", "x^2/4", ""]; };
      const gEval = (src) => { const t = String(src || "").replace(/^\s*y\s*=\s*/i, "").replace(/(\d)\s*(x|\()/gi, "$1*$2").replace(/\)\s*(x|\d|\()/gi, ")*$1"); if (!t.trim()) return null; try { NX.calcEval(t, false, { x: 1 }); } catch (e) { return false; } return (x) => { try { return NX.calcEval(t, false, { x }); } catch (e) { return NaN; } }; };
      const gPlot = () => {
        const cv = graph.querySelector("canvas"); if (!cv) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
        const g = cv.getContext("2d"), W = cv.width, H = cv.height, sc = gv.sc * dpr, X = (x) => W / 2 + (x - gv.cx) * sc, Y = (y) => H / 2 - (y - gv.cy) * sc, cs = getComputedStyle(body);
        g.clearRect(0, 0, W, H); const step = [1, 2, 5, 10, 20, 50, 100].find((s2) => s2 * sc >= 40 * dpr) || 100;
        g.lineWidth = 1; g.strokeStyle = "rgba(128,128,160,.18)"; g.fillStyle = cs.getPropertyValue("--sub") || "#aaa"; g.font = 11 * dpr + "px sans-serif";
        const x0 = gv.cx - W / 2 / sc, x1 = gv.cx + W / 2 / sc, y0 = gv.cy - H / 2 / sc, y1 = gv.cy + H / 2 / sc;
        for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); if (x) g.fillText(String(+x.toFixed(6)), X(x) + 3, Math.min(H - 4, Math.max(12 * dpr, Y(0) + 13 * dpr))); }
        for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(W, Y(y)); g.stroke(); if (y) g.fillText(String(+y.toFixed(6)), Math.min(W - 30 * dpr, Math.max(3, X(0) + 4)), Y(y) - 3); }
        g.strokeStyle = "rgba(160,160,200,.7)"; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.stroke();
        gFns().forEach((src, k) => { const f = gEval(src); if (!f) return; g.strokeStyle = GC[k]; g.lineWidth = 2.4 * dpr; g.beginPath(); let pen = false, py = 0;
          for (let px = 0; px <= W; px += 1.5) { const y = f(gv.cx + (px - W / 2) / sc), sy = Y(y); if (!isFinite(y) || Math.abs(sy - py) > H * 2) { pen = false; py = sy; continue; } if (pen) g.lineTo(px, sy); else g.moveTo(px, sy); pen = true; py = sy; } g.stroke(); });
      };
      const graphDraw = () => {
        const F = gFns(); graph.innerHTML = `<div class="gr-fns">${[0, 1, 2].map((k) => `<label class="gr-fn" style="--c:${GC[k]}"><i></i><span>y =</span><input data-gf="${k}" value="${NX.esc(F[k] || "")}" placeholder="${k ? "Add a function" : "sin(x)"}" spellcheck="false" autocomplete="off" aria-label="Function ${k + 1}"></label>`).join("")}</div><div class="gr-plot"><canvas aria-label="The graph"></canvas><div class="gr-zoom"><button class="btn sm" data-gz="in" aria-label="Zoom in">+</button><button class="btn sm" data-gz="out" aria-label="Zoom out">-</button><button class="btn sm" data-gz="home">Center</button></div></div>`;
        graph.querySelectorAll("[data-gf]").forEach((inp) => (inp.oninput = () => { const L = gFns().slice(); L[+inp.dataset.gf] = inp.value.slice(0, 80); NX.setData("calc-graph", L); inp.classList.toggle("bad", gEval(inp.value) === false); gPlot(); }));
        graph.querySelectorAll("[data-gz]").forEach((b) => (b.onclick = () => { const z = b.dataset.gz; if (z === "home") gv = { cx: 0, cy: 0, sc: 30 }; else gv.sc = Math.max(2, Math.min(400, gv.sc * (z === "in" ? 1.5 : 1 / 1.5))); gPlot(); }));
        const cv = graph.querySelector("canvas");
        cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); gDrag = { x: e.clientX, y: e.clientY, cx: gv.cx, cy: gv.cy }; };
        cv.onpointermove = (e) => { if (!gDrag) return; gv.cx = gDrag.cx - (e.clientX - gDrag.x) / gv.sc; gv.cy = gDrag.cy + (e.clientY - gDrag.y) / gv.sc; gPlot(); };
        cv.onpointerup = cv.onpointercancel = () => { gDrag = null; };
        cv.onwheel = (e) => { if (e.ctrlKey) return; e.preventDefault(); gv.sc = Math.max(2, Math.min(400, gv.sc * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); gPlot(); };
        requestAnimationFrame(gPlot);
      };
      win.graph = { draw: () => gPlot(), view: () => gv, eval: gEval };
      { const ro = window.ResizeObserver ? new ResizeObserver(() => { if (!graph.hidden) gPlot(); }) : null; if (ro) ro.observe(graph); }
      body.querySelector(".c-mode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; const m = b.dataset.m, c = m === "conv", sc = m === "sci", dt = m === "date", pg = m === "prog", gr = m === "graph";
        body.querySelectorAll(".c-mode button").forEach((x) => x.classList.toggle("on", x === b)); conv.hidden = !c; sci.hidden = !sc; dateEl.hidden = !dt; prog.hidden = !pg; graph.hidden = !gr; body.querySelector(".c-disp").hidden = c || sc || dt || pg || gr; body.querySelector(".c-keys").hidden = c || sc || dt || pg || gr; body.querySelector(".c-mem").hidden = c || sc || dt || pg || gr; hist.hidden = true;
        if (gr && !graph.innerHTML) graphDraw(); if (gr) requestAnimationFrame(gPlot);
        if (pg && !prog.innerHTML) progDraw(); if (pg) prog.querySelector(".pg-in[data-base='10']").focus();
        if (dt && !dateEl.innerHTML) dateDraw();
        if (c && !conv.innerHTML) convDraw(); if (sc && !sci.innerHTML) sciDraw(); if (sc) sci.querySelector(".sc-in").focus(); };
    } };

  // ---------- Paint: brush, colors, sizes, eraser, save as a picture ----------
  A.paint = { name: "Paint", icon: "paint", category: "Creativity", rating: "4.6", size: "2 MB", w: 900, h: 620, minW: 420, minH: 360, desc: "Draw and paint with brushes and colors, then save your picture.",
    open(body, win, opts) {
      body.classList.add("paint");
      const COLS = ["#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#22d3ee", "#3b82f6", "#7c5cff", "#ec4899", "#8b5a2b", "#94a3b8"];
      body.innerHTML = `<div class="p-bar"><div class="p-cols">${COLS.map((c, i) => `<button data-col="${c}" class="${i === 8 ? "on" : ""}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div><label class="p-size">Size <input type="range" min="2" max="48" value="8"></label><div class="p-tools"><button class="p-tb" data-t="brush" title="Brush" aria-label="Brush"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L10 19l-5 1 1-5z"/><path d="M12.5 6.5l5 5"/></svg></button><button class="p-tb" data-t="line" title="Line" aria-label="Line"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5"/></svg></button><button class="p-tb" data-t="rect" title="Box" aria-label="Box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="6" width="15" height="12" rx="1.5"/></svg></button><button class="p-tb" data-t="ellipse" title="Circle" aria-label="Circle"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="8" ry="6.5"/></svg></button><button class="p-tb" data-t="fill" title="Fill" aria-label="Fill"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l7-7 7 7-7 7z"/><path d="M19.5 15.5c0 1.5 1 2.5 1 3.2a1 1 0 01-2 0c0-.7 1-1.7 1-3.2z" fill="currentColor"/></svg></button><button class="p-tb" data-t="text" title="Text" aria-label="Text"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/></svg></button><button class="p-tb" data-t="eraser" title="Eraser" aria-label="Eraser"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 19h12"/><path d="M4.5 14.5l8-8 6 6-5 5H9z"/></svg></button></div><div class="p-tools"><button class="p-tb" data-t="undo" title="Undo (Ctrl + Z)" aria-label="Undo"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L5 10l4 4"/><path d="M5 10h9a5 5 0 010 10h-3"/></svg></button><button class="p-tb" data-t="redo" title="Redo (Ctrl + Y)" aria-label="Redo"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l4 4-4 4"/><path d="M19 10h-9a5 5 0 000 10h3"/></svg></button><button class="p-tb" data-t="clear" title="Clear" aria-label="Clear"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></div><button class="btn sm primary" data-t="save">Save picture</button></div><div class="p-wrap"><canvas></canvas></div>`;
      const cv = body.querySelector("canvas"), g = cv.getContext("2d"), wrap = body.querySelector(".p-wrap");
      let col = COLS[8], size = 8, tool = "brush", down = false, last = null; const hist = [];
      const resize = () => {
        const r = { width: wrap.clientWidth, height: wrap.clientHeight }; if (r.width < 10 || r.height < 10) return; // (clientWidth: the real size, even while the window is still opening)
        const old = document.createElement("canvas"); old.width = cv.width; old.height = cv.height; old.getContext("2d").drawImage(cv, 0, 0);
        if (cv.width === Math.round(r.width) && cv.height === Math.round(r.height)) return; cv.width = Math.round(r.width); cv.height = Math.round(r.height); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(old, 0, 0);
      };
      const redo = [];
      const snap = () => { try { hist.push(g.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 20) hist.shift(); redo.length = 0; } catch (e) { /* too big */ } };
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
      // Edit in Paint (File Explorer > Open with): the picture is fitted onto the canvas
      const loadPic = async (p) => {
        if (!p) return;
        try {
          const src = NX.native ? NX.rawURL(p) : await NX.fs.url(p), blob = await (await fetch(src)).blob(), u = URL.createObjectURL(blob), im = new Image();
          await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = u; }); resize(); snap();
          const k = Math.min(cv.width / im.width, cv.height / im.height, 1), w = im.width * k, h = im.height * k;
          g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h); URL.revokeObjectURL(u);
          win.el.querySelector(".wt-name").textContent = NX.fs.base(p) + " - Paint";
        } catch (e) { NX.toast("That picture couldn't be opened in Paint."); }
      };
      win.onopts = (o) => { if (o && o.path) loadPic(o.path); };
      if (opts && opts.path) setTimeout(() => loadPic(opts.path), 150);
      win.save = () => { const b = body.querySelector("[data-t=save]"); if (b) b.click(); };
      win.paintTest = { fillAt: (x, y) => { snap(); fillAt(x, y); }, pixel: (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)), setTool: (t) => (tool = t), setCol: (c) => (col = c) };
      cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); snap(); last = pos(e);
        if (tool === "fill") { fillAt(last[0], last[1]); return; }
        if (tool === "text") { const at = last; NX.ask(body, { title: "Add text", input: true, value: "", ok: "Add" }).then((t) => { if (!t) { hist.pop(); return; } g.fillStyle = col; g.textBaseline = "top"; g.font = `600 ${Math.max(12, size * 3)}px "Segoe UI", sans-serif`; String(t).split("\n").forEach((ln, k) => g.fillText(ln, at[0], at[1] + k * Math.max(12, size * 3) * 1.2)); }); return; }
        if (SHAPES.includes(tool)) { start = last; base = g.getImageData(0, 0, cv.width, cv.height); down = true; return; }
        down = true; g.beginPath(); g.fillStyle = tool === "eraser" ? "#fff" : col; g.arc(last[0], last[1], size / 2, 0, 7); g.fill(); };
      cv.onpointermove = (e) => { if (!down) return; const p = pos(e); if (start) { shape(start, p); return; } g.strokeStyle = tool === "eraser" ? "#fff" : col; g.lineWidth = size; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
      cv.onpointerup = cv.onpointercancel = (e) => { if (start && e && e.clientX != null) shape(start, pos(e)); down = false; start = null; base = null; };
      body.querySelector(".p-cols").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; col = b.dataset.col; if (tool === "eraser") { tool = "brush"; body.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("on", x.dataset.t === "brush")); } body.querySelectorAll(".p-cols button").forEach((x) => x.classList.toggle("on", x === b)); };
      body.querySelector(".p-size input").oninput = (e) => (size = +e.target.value);
      { const pc = body.querySelector(".p-cols"); pc.insertAdjacentHTML("beforeend", `<label class="p-any" title="Any color"><input type="color" value="#7c5cff" aria-label="Pick any color"></label>`);
        const ci = pc.querySelector(".p-any input"); ci.oninput = () => { col = ci.value; pc.querySelectorAll("button").forEach((x) => x.classList.remove("on")); ci.parentElement.classList.add("on"); ci.parentElement.style.background = ci.value; if (tool === "eraser") { tool = "brush"; body.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("on", x.dataset.t === "brush")); } }; }
      // Ctrl + Z and Ctrl + Y (or Ctrl + Shift + Z)
      body.tabIndex = -1; body.addEventListener("keydown", (e) => { if (!(e.ctrlKey || e.metaKey) || /input|textarea/i.test(e.target.tagName)) return; const k = e.key.toLowerCase(); const t = k === "z" && !e.shiftKey ? "undo" : k === "y" || (k === "z" && e.shiftKey) ? "redo" : null; if (!t) return; e.preventDefault(); body.querySelector(`[data-t=${t}]`).click(); });
      cv.addEventListener("pointerdown", () => { try { body.focus({ preventScroll: true }); } catch (e) { /* fine */ } });
      body.querySelector(".p-bar").addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]"); if (!b) return; const t = b.dataset.t;
        if (["brush", "eraser", "line", "rect", "ellipse", "fill", "text"].includes(t)) { tool = t; body.querySelectorAll("[data-t=brush],[data-t=eraser],[data-t=line],[data-t=rect],[data-t=ellipse],[data-t=fill],[data-t=text]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (t === "undo" && hist.length) { try { redo.push(g.getImageData(0, 0, cv.width, cv.height)); } catch (e2) { /* too big */ } g.putImageData(hist.pop(), 0, 0); }
        if (t === "redo" && redo.length) { try { hist.push(g.getImageData(0, 0, cv.width, cv.height)); } catch (e2) { /* too big */ } g.putImageData(redo.pop(), 0, 0); }
        if (t === "clear") { snap(); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); }
        if (t === "save") { // into Pictures, where Photos and File Explorer find it
          cv.toBlob(async (blob) => { try { let nm = await NX.ask(body, { title: "Save picture in Pictures", input: true, value: (win.paintName || "Painting") + ".png", ok: "Save" }); if (!nm) return; nm = String(nm).trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "Painting.png"; if (!/\.png$/i.test(nm)) nm += ".png"; win.paintName = nm.replace(/\.png$/i, ""); const r = await NX.fs.upload(await NX.folder("Pictures"), nm, blob); NX.toast("Saved in Pictures as " + r.name + "."); NX.filesChanged && NX.filesChanged(); } catch (e) { NX.toast(e.message); } }, "image/png");
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
    // a ringing alarm: a card with its name and the time, Snooze (5 minutes) and Dismiss; it beeps every 2 seconds for up to a minute
    ring(a, d) {
      let box = document.getElementById("nx-alarm"); if (!box) { box = document.createElement("div"); box.id = "nx-alarm"; box.setAttribute("role", "alertdialog"); document.body.appendChild(box); }
      const card = document.createElement("div"); card.className = "al-card";
      card.innerHTML = `<div class="al-ring">${NX.icon("clock", 44)}</div><div class="al-txt"><b>${NX.esc(a.name || "Alarm")}</b><span>${NX.esc(NX.fmtTime(d || new Date()))}</span></div><div class="al-btns"><button class="btn" data-al="snooze">Snooze 5 min</button><button class="btn primary" data-al="off">Dismiss</button></div>`;
      box.appendChild(card);
      let n = 0; const beep = () => { if (NX.alarmTone) NX.alarmTone(); else if (NX.beep) NX.beep(); }; beep(); const t = setInterval(() => { if (++n >= 30) stop(); else beep(); }, 2000);
      const stop = () => { clearInterval(t); card.remove(); if (!box.children.length) box.remove(); };
      card.onclick = (e) => { const b = e.target.closest("[data-al]"); if (!b) return; stop();
        if (b.dataset.al === "snooze") { const s = new Date(Date.now() + 5 * 60000), hm = String(s.getHours()).padStart(2, "0") + ":" + String(s.getMinutes()).padStart(2, "0");
          const L = NX.alarms.list(); L.push({ id: NX.uid(), time: hm, days: [], name: (a.name || "Alarm").replace(/ \(snoozed\)$/, "") + " (snoozed)", on: true, last: "", snooze: true }); NX.alarms.save(L.sort((x, y) => x.time.localeCompare(y.time))); NX.toast("Snoozed until " + NX.fmtTime(s) + "."); } };
      card.querySelector("[data-al=off]").focus();
      if (a.snooze) NX.alarms.save(NX.alarms.list().filter((x) => x.id !== a.id));
    },
    list: () => NX.data("alarms", []),
    save: (L) => { NX.setData("alarms", L); document.dispatchEvent(new CustomEvent("nx:alarms")); },
    add(time, days, name) { const L = NX.alarms.list(); if (L.length >= 20) throw new Error("You can have up to 20 alarms."); L.push({ id: NX.uid(), time, days: days || [], name: String(name || "").slice(0, 40), on: true, last: "" }); NX.alarms.save(L.sort((a, b) => a.time.localeCompare(b.time))); },
    check(now) {
      if (!NX.me) return; const d = now || new Date(), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"), stamp = d.toDateString() + " " + hm;
      let changed = false; const L = NX.alarms.list();
      for (const a of L) {
        if (!a.on || a.time !== hm || a.last === stamp || (a.days.length && !a.days.includes(d.getDay()))) continue;
        a.last = stamp; changed = true; if (!a.days.length) a.on = false;
        NX.alarms.ring(a, d);
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
      body.innerHTML = `<div class="seg clk-tabs"><button data-v="clock" class="on">Clock</button><button data-v="sw">Stopwatch</button><button data-v="tm">Timer</button><button data-v="fo">Focus</button><button data-v="al">Alarms</button><button data-v="cd">Countdown</button></div><div class="clk-face"></div>`;
      let v = "clock", swOn = false, swT = 0, swAt = 0, laps = [];
      const face = body.querySelector(".clk-face"), f2 = (n) => String(n).padStart(2, "0");
      const fmtMs = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100; return (h ? h + ":" : "") + f2(m) + ":" + f2(s) + "." + f2(cs); };
      const draw = () => {
        const now = performance.now();
        if (v === "clock") { // the time here, and world clocks for other cities (saved for each person)
          const d = new Date();
          if (!face.querySelector(".wc")) {
            const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : []).filter((z) => z.includes("/"));
            face.innerHTML = `<div class="clk-top"><svg class="clk-analog" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" class="ca-face"/><g class="ca-ticks"><line x1="50" y1="5" x2="50" y2="13" transform="rotate(0 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(30 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(60 50 50)"/><line x1="50" y1="5" x2="50" y2="13" transform="rotate(90 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(120 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(150 50 50)"/><line x1="50" y1="5" x2="50" y2="13" transform="rotate(180 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(210 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(240 50 50)"/><line x1="50" y1="5" x2="50" y2="13" transform="rotate(270 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(300 50 50)"/><line x1="50" y1="7" x2="50" y2="10" transform="rotate(330 50 50)"/></g><line class="ca-h" x1="50" y1="50" x2="50" y2="27"/><line class="ca-m" x1="50" y1="50" x2="50" y2="15"/><line class="ca-s" x1="50" y1="58" x2="50" y2="12"/><circle cx="50" cy="50" r="2.6" class="ca-dot"/></svg><div><div class="clk-big"></div><div class="clk-sub"></div></div></div><div class="wc"><form class="wc-add"><input list="wc-zones" placeholder="Add a city, like London or Tokyo" aria-label="Add a city"><datalist id="wc-zones">${zones.map((z) => `<option value="${NX.esc(z.split("/").pop().replace(/_/g, " "))}">${NX.esc(z.replace(/_/g, " "))}</option>`).join("")}</datalist><button class="btn" type="submit">Add</button></form><div class="wc-list"></div></div>`;
            const f = face.querySelector(".wc-add");
            f.onsubmit = (e) => { e.preventDefault(); const q = f.querySelector("input").value.trim().toLowerCase().replace(/ /g, "_"); if (!q) return;
              const z = zones.find((x) => x.toLowerCase() === q) || zones.find((x) => x.split("/").pop().toLowerCase() === q) || zones.find((x) => x.toLowerCase().includes(q));
              if (!z) { NX.toast("That city wasn't found. Try a big city near it."); return; }
              const list = NX.data("world-clocks", []); if (!list.includes(z)) NX.setData("world-clocks", [...list, z].slice(-8)); f.querySelector("input").value = ""; face.querySelector(".wc-list").dataset.k = "redraw"; draw(); };
            face.querySelector(".wc-list").onclick = (e) => { const b = e.target.closest("[data-wcdel]"); if (!b) return; NX.setData("world-clocks", NX.data("world-clocks", []).filter((x) => x !== b.dataset.wcdel)); face.querySelector(".wc-list").dataset.k = "redraw"; draw(); };
          }
          { const an = face.querySelector(".clk-analog"); if (an) { const sec = d.getSeconds(), mi = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + mi / 60; an.querySelector(".ca-h").setAttribute("transform", `rotate(${hr * 30} 50 50)`); an.querySelector(".ca-m").setAttribute("transform", `rotate(${mi * 6} 50 50)`); an.querySelector(".ca-s").setAttribute("transform", `rotate(${sec * 6} 50 50)`); } }
          face.querySelector(".clk-big").textContent = NX.fmtTime(d, true); face.querySelector(".clk-sub").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
          const list = NX.data("world-clocks", []), box = face.querySelector(".wc-list"), here = d.toLocaleDateString("en-CA");
          const rows = list.map((z) => { let t = "", day = "", off = ""; try { t = d.toLocaleTimeString([], { timeZone: z, hour: "numeric", minute: "2-digit" }); const ds = d.toLocaleDateString("en-CA", { timeZone: z }); day = ds === here ? "Today" : ds > here ? "Tomorrow" : "Yesterday"; const loc = new Date(d.toLocaleString("en-US", { timeZone: z })), mine = new Date(d.toLocaleString("en-US")); const h = Math.round((loc - mine) / 1800000) / 2; off = h === 0 ? "Same time" : (h > 0 ? "+" : "") + h + (Math.abs(h) === 1 ? " hour" : " hours"); } catch (e) { t = "?"; } return [z, t, day, off]; });
          const k = rows.map((r) => r.join("|")).join(";");
          if (box.dataset.k !== k) { box.dataset.k = k; box.innerHTML = rows.length ? rows.map(([z, t, day, off]) => `<div class="wc-row"><span><b>${NX.esc(z.split("/").pop().replace(/_/g, " "))}</b><small>${day} · ${off}</small></span><strong>${NX.esc(t)}</strong><button class="btn sm" data-wcdel="${NX.esc(z)}" aria-label="Remove ${NX.esc(z.split("/").pop().replace(/_/g, " "))}">${NX.icon("close", 12)}</button></div>`).join("") : `<div class="wc-none">${NX.icon("globe", 22)}<span><b>Clocks around the world</b><small>Add a city above to see its time and how far ahead or behind it is.</small></span></div>`; }
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
        if (v === "cd") { // countdowns to days you're waiting for (up to 8), kept for each person
          const L = NX.data("countdowns", []), today = new Date(); today.setHours(0, 0, 0, 0);
          const k = L.map((c) => c.id + c.date).join(";") + today.toDateString();
          if (face.dataset.cdk !== k) { face.dataset.cdk = k;
            face.innerHTML = `<form class="cd-new"><input name="n" maxlength="40" placeholder="Like My birthday" aria-label="Name" required><input type="date" name="d" aria-label="Date" required><button class="btn primary" type="submit">Add</button></form><div class="cd-list">${L.length ? L.map((c) => { const d = new Date(c.date + "T00:00"), n = Math.round((d - today) / 864e5); return `<div class="cd-row"><b class="cd-n">${n > 0 ? n : n === 0 ? "Today" : Math.abs(n)}</b><span><b>${NX.esc(c.name)}</b><small>${n > 1 ? "days to go" : n === 1 ? "day to go" : n === 0 ? "It's today!" : "days ago"} · ${d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</small></span><button class="btn sm" data-cddel="${c.id}" aria-label="Remove ${NX.esc(c.name)}">${NX.icon("close", 12)}</button></div>`; }).join("") : `<p class="clk-sub">Count the days to a birthday, a trip or the last day of school.</p>`}</div>`;
            const f = face.querySelector(".cd-new"); f.onsubmit = (e) => { e.preventDefault(); const L2 = NX.data("countdowns", []); if (L2.length >= 8) { NX.toast("You can have up to 8 countdowns."); return; } L2.push({ id: NX.uid(), name: f.n.value.trim(), date: f.d.value }); NX.setData("countdowns", L2.sort((a, b) => a.date.localeCompare(b.date))); face.dataset.cdk = ""; draw(); };
            face.querySelectorAll("[data-cddel]").forEach((b) => (b.onclick = () => { NX.setData("countdowns", NX.data("countdowns", []).filter((c) => c.id !== b.dataset.cddel)); face.dataset.cdk = ""; draw(); }));
          }
        } else face.dataset.cdk = "";
        if (v === "fo") { const on = NX.focusSession.on(), n = NX.focusSession.today();
          face.innerHTML = on ? `<div class="clk-ring" style="--p:${(1 - NX.focusSession.left() / NX.focusSession.len()) * 100}"><div class="clk-big mono">${fmtMs(NX.focusSession.left()).slice(0, -3)}</div></div><div class="clk-sub">Do not disturb is on until it's done.</div><div class="clk-btns"><button class="btn" data-a="fostop">Stop</button></div>`
            : `<div class="clk-sub" style="margin-top:6px">Focus for a while. Do not disturb stays on until it's done.</div><div class="clk-btns">${[15, 25, 45, 60].map((m) => `<button class="btn ${m === 25 ? "primary" : ""}" data-a="fo${m}">${m} min</button>`).join("")}</div><div class="clk-sub">${n ? n + (n === 1 ? " session" : " sessions") + " today" : "No focus sessions yet today"}</div>`; }
        if (v === "tm") { const T = NX.timers.list();
          face.innerHTML = `<div class="tmr-list">${T.map((t) => { const left = NX.timers.left(t); return `<div class="tmr ${t.on ? "on" : ""}" data-tid="${t.id}"><div class="tmr-ring" style="--p:${(1 - left / t.len) * 100}"><b class="mono tmr-left">${fmtMs(left).slice(0, -3)}</b></div><div class="tmr-info"><b>${NX.esc(t.name)}</b><small>${fmtMs(t.len).slice(0, -3)}</small></div><div class="tmr-btns"><button class="btn sm ${t.on ? "" : "primary"}" data-a="tgo" data-tid="${t.id}">${t.on ? "Pause" : "Start"}</button><button class="btn sm" data-a="treset" data-tid="${t.id}">Reset</button><button class="btn sm" data-a="tdel" data-tid="${t.id}" aria-label="Delete ${NX.esc(t.name)}">Delete</button></div></div>`; }).join("") || `<p class="clk-sub">No timers yet. Add one below.</p>`}</div>
            <form class="tmr-add"><input name="n" maxlength="30" placeholder="Name, like Pasta" aria-label="Timer name"><input name="h" type="number" min="0" max="23" value="0" aria-label="Hours"><span>h</span><input name="m" type="number" min="0" max="59" value="5" aria-label="Minutes"><span>m</span><input name="s" type="number" min="0" max="59" value="0" aria-label="Seconds"><span>s</span><button class="btn primary">Add timer</button></form>`;
          const fa = face.querySelector(".tmr-add"); fa.onsubmit = (e) => { e.preventDefault(); const ms = ((+fa.h.value || 0) * 3600 + (+fa.m.value || 0) * 60 + (+fa.s.value || 0)) * 1000; if (ms < 1000) { NX.toast("Make the timer at least a second long."); return; } NX.timers.add(fa.n.value.trim() || "Timer", ms, true); draw(); };
 }
      };
      body.querySelector(".clk-tabs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; v = b.dataset.v; body.querySelectorAll(".clk-tabs button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
      face.onclick = (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a, now = performance.now();
        if (a === "sws") { if (swOn) { swT += now - swAt; swOn = false; } else { swAt = now; swOn = true; } }
        if (a === "swl") laps.unshift(swT + now - swAt);
        if (a === "swr") { swOn = false; swT = 0; laps = []; }
        if (a === "tgo") NX.timers.toggle(b.dataset.tid);
        if (a === "treset") NX.timers.reset(b.dataset.tid);
        if (a === "tdel") NX.timers.remove(b.dataset.tid);
        if (/^fo\d+$/.test(a)) NX.focusSession.start(+a.slice(2));
        if (a === "fostop") NX.focusSession.finish(false);
        draw();
      };
      // the tick only updates the time text, so buttons are never rebuilt under the pointer
      const tick = setInterval(() => {
        const big = face.querySelector(".clk-big") || { set textContent(x) { /* this face shows no time (Alarms) */ } }, now = performance.now();
        if (v === "clock") { const d = new Date(); big.textContent = NX.fmtTime(d, true); }
        else if (v === "sw" && swOn) big.textContent = fmtMs(swT + now - swAt);
        else if (v === "tm") face.querySelectorAll(".tmr").forEach((el) => { const t = NX.timers.get(el.dataset.tid); if (!t || !t.on) return; const left = NX.timers.left(t); el.querySelector(".tmr-left").textContent = fmtMs(left).slice(0, -3); el.querySelector(".tmr-ring").style.setProperty("--p", (1 - left / t.len) * 100); });
        else if (v === "fo" && NX.focusSession.on()) { big.textContent = fmtMs(NX.focusSession.left()).slice(0, -3); const r = face.querySelector(".clk-ring"); if (r) r.style.setProperty("--p", (1 - NX.focusSession.left() / NX.focusSession.len()) * 100); }
      }, 50);
      const onFocus = () => { if (v === "fo") draw(); }; document.addEventListener("nx:focus", onFocus);
      const onTm = () => { if (v === "tm" && !face.contains(document.activeElement && document.activeElement.closest(".tmr-add"))) draw(); }; document.addEventListener("nx:timers", onTm);
      const onAl = () => { if (v === "al" && !face.contains(document.activeElement)) draw(); }; document.addEventListener("nx:alarms", onAl);
      win.onclose = () => { clearInterval(tick); document.removeEventListener("nx:timers", onTm); document.removeEventListener("nx:focus", onFocus); document.removeEventListener("nx:alarms", onAl); }; draw();
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
  A.nebuluxai = { name: "Nebulux AI", icon: "ai", category: "Web", rating: "4.8", size: "Online app", url: "https://nebuluxai.com", desc: "Chat with AI, make games and websites on nebuluxai.com." };
  A.arcade = { name: "Nebulux Arcade", icon: "arcade", category: "Web", rating: "4.7", size: "Online app", url: "https://nebuluxai.com/arcade", desc: "Play Nebula Royale, Nebula Brawl and dozens of free games." };
})();
