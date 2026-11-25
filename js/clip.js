// Clipboard history (Nebulux + V): the last 25 things you copied, newest first. Pinned ones stay.
// It collects text copied in Nebulux OS's own apps, and on the real computer also in real apps and the web browser
// (the system helper reads the screen's clipboard). Click one to copy it again; it's also pasted into the box you
// were typing in. Settings > System > Clipboard turns it off or clears it. Kept on this computer, per person.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const MAX = 25, MAXLEN = 20000;
  let lastFocus = null, lastSeen = "", pollT = 0;
  const on = () => !!NX.me && NX.prefs().cliphist !== false;
  const list = () => NX.data("clip-history", []);
  const save = (L) => NX.setData("clip-history", L);

  function add(text) {
    if (!on()) return;
    text = String(text || ""); if (!text.trim() || text.length > MAXLEN) return;
    lastSeen = text;
    const L = list(), old = L.find((x) => x.t === text);
    const rest = L.filter((x) => x.t !== text);
    const item = { t: text, at: Date.now(), pin: !!(old && old.pin) };
    const pinned = rest.filter((x) => x.pin), plain = rest.filter((x) => !x.pin);
    save([item, ...plain, ...pinned].sort((a, b) => (b.pin - a.pin) || (b.at - a.at)).filter((x, i, a) => x.pin || a.filter((y) => !y.pin).indexOf(x) < MAX));
    if (!$("#clip").hidden) draw();
  }

  // copies inside Nebulux OS (its own apps, and boxes in its windows)
  const selected = () => {
    const a = document.activeElement;
    if (a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && /^(text|search|url|email|tel|number)$/i.test(a.type))) && a.selectionStart !== a.selectionEnd) return a.value.slice(a.selectionStart, a.selectionEnd);
    return String(getSelection() || "");
  };
  document.addEventListener("copy", (e) => { const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || selected(); setTimeout(() => add(t || selected()), 0); });
  document.addEventListener("cut", () => { const t = selected(); setTimeout(() => add(t), 0); });
  // remember where you were typing, to paste there
  document.addEventListener("focusin", (e) => { const t = e.target; if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) && !t.closest("#clip")) lastFocus = t; });

  // on the real computer: what real apps and the browser copied
  async function poll() {
    if (!NX.native || !on()) return;
    try { const r = await NX.api("GET", "/clip"); if (r.text && r.text !== lastSeen) add(r.text); } catch (e) { /* next time */ }
  }
  document.addEventListener("nx:signin", () => { lastSeen = ""; clearInterval(pollT); if (NX.native) { poll(); pollT = setInterval(poll, 2000); } });

  async function use(text) {
    lastSeen = text;
    if (NX.native) await NX.api("POST", "/clip", { text }).catch(() => {});
    try { await navigator.clipboard.writeText(text); } catch (e) { /* not allowed here; the history still has it */ }
    const f = lastFocus;
    if (f && document.contains(f) && !f.disabled && !f.readOnly) {
      f.focus();
      if (f.isContentEditable) document.execCommand("insertText", false, text);
      else if (typeof f.setRangeText === "function") { try { f.setRangeText(text, f.selectionStart, f.selectionEnd, "end"); f.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* number boxes */ } }
      NX.toast("Pasted.");
    } else NX.toast("Copied. Press Ctrl + V to paste it.");
  }

  function draw() {
    const P = $("#clip"), L = list();
    const when = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "Just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : new Date(t).toLocaleDateString(); };
    P.innerHTML = `<div class="cl-head"><b>Clipboard</b>${L.some((x) => !x.pin) ? `<button class="cl-clear">Clear all</button>` : ""}</div>${on() && L.length > 4 ? `<label class="cl-find">${NX.icon("search", 14)}<input placeholder="Search what you copied" aria-label="Search the clipboard history"></label>` : ""}` +
      (!on() ? `<p class="cl-empty">Clipboard history is off. Turn it on to keep the things you copy.</p><div class="cl-onwrap"><button class="btn primary cl-on">Turn on</button></div>` :
      L.length ? `<div class="cl-list">${L.map((x, i) => `<div class="cl-item ${x.pin ? "pin" : ""}" data-i="${i}" role="button" tabindex="0"><div class="cl-t">${NX.esc(x.t.length > 400 ? x.t.slice(0, 400) + "..." : x.t)}</div><div class="cl-meta"><span>${x.pin ? "Pinned" : when(x.at)}</span><span class="cl-acts"><button data-pin="${i}" aria-label="${x.pin ? "Unpin" : "Pin"}" title="${x.pin ? "Unpin" : "Pin"}">${NX.icon("pin", 14)}</button><button data-del="${i}" aria-label="Delete" title="Delete">${NX.icon("trash", 14)}</button></span></div></div>`).join("")}</div>` :
      `<p class="cl-empty">Copy something, and it shows up here. Nebulux + V opens this any time.</p>`);
    P.querySelectorAll(".cl-item").forEach((el) => {
      const go = () => { const x = list()[+el.dataset.i]; if (!x) return; close(); use(x.t); };
      el.onclick = (e) => { if (e.target.closest("button")) return; go(); };
      el.onkeydown = (e) => { if (e.key === "Enter") go(); };
    });
    P.querySelectorAll("[data-pin]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const L2 = list(), x = L2[+b.dataset.pin]; if (!x) return; x.pin = !x.pin; save(L2.sort((a, c) => (c.pin - a.pin) || (c.at - a.at))); draw(); }));
    P.querySelectorAll("[data-del]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const L2 = list(); L2.splice(+b.dataset.del, 1); save(L2); draw(); }));
    const fq = $(".cl-find input", P); if (fq) { fq.oninput = () => { const q = fq.value.trim().toLowerCase(); P.querySelectorAll(".cl-item").forEach((el) => (el.hidden = !!q && !el.querySelector(".cl-t").textContent.toLowerCase().includes(q))); }; fq.onkeydown = (e) => { if (e.key === "Enter") { const v = [...P.querySelectorAll(".cl-item")].find((el) => !el.hidden); if (v) v.click(); } if (e.key === "Escape") close(); }; }
    const c = $(".cl-clear", P); if (c) c.onclick = (e) => { e.stopPropagation(); save(list().filter((x) => x.pin)); draw(); };
    const o = $(".cl-on", P); if (o) o.onclick = (e) => { e.stopPropagation(); NX.setPref("cliphist", true); draw(); };
  }
  function close() { $("#clip").hidden = true; }
  function toggle() {
    const P = $("#clip"); if (!NX.me) return;
    if (!P.hidden) { close(); return; }
    if (NX.shell) NX.shell.closeFlyouts("clip");
    P.hidden = false; draw();
    const first = P.querySelector(".cl-item"); if (first) first.focus({ preventScroll: true });
  }
  NX.clip = { add, toggle, close, list, use };
})();
