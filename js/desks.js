// Virtual desktops: separate sets of windows, managed from Task View.
//   Task View (Nebulux + Tab) has the desktops at the bottom: click one to switch, New desktop to add, double-click a
//   name to rename, the x to close (its windows move to the desktop next to it), and drag a window onto a desktop to
//   move it there.
//   Ctrl + Nebulux + Left / Right switches, Ctrl + Nebulux + D adds one, Ctrl + Nebulux + F4 closes the current one.
// On the real computer the window manager's desktops follow along, so real apps and web browser windows stay on the
// desktop they were opened on (Nebulux OS itself shows on every desktop).
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const MAX = 8;
  let desks = [{ id: "d1", name: "" }], cur = "d1", flashT = 0;
  const label = (d, i) => d.name || "Desktop " + (i + 1);
  const idx = () => Math.max(0, desks.findIndex((d) => d.id === cur));
  const saveNames = () => NX.setData("desks", desks.map((d) => ({ id: d.id, name: d.name, wall: d.wall })));
  const tellSystem = () => { if (NX.native) NX.api("POST", "/desks", { count: desks.length, cur: idx() }).catch(() => {}); };

  function apply() {
    for (const w of NX.wins.values()) { if (!w.desk) w.desk = cur; w.el.classList.toggle("offdesk", w.desk !== cur); }
    if (NX.shell) NX.shell.taskbar();
    const tb = $("#tb-desk"); if (tb) tb.textContent = desks.length > 1 ? String(idx() + 1) : "";
    // each desktop can have its own background (right-click it in Task View)
    const D = document.getElementById("desktop"), dw = (desks[idx()] || {}).wall;
    if (D) { if (typeof dw === "number" && NX.wallpapers[dw]) D.style.setProperty("--wall", `url(${NX.wallpaperURL(dw, innerWidth * Math.min(2, devicePixelRatio || 1), innerHeight * Math.min(2, devicePixelRatio || 1))})`); else D.style.removeProperty("--wall"); }
  }
  function flash() {
    const f = $("#deskflash"); if (!f) return;
    f.innerHTML = `<div class="df-dots">${desks.map((d) => `<span class="${d.id === cur ? "on" : ""}"></span>`).join("")}</div><b>${NX.esc(label(desks[idx()], idx()))}</b>`;
    f.hidden = false; f.classList.remove("out"); clearTimeout(flashT); flashT = setTimeout(() => { f.classList.add("out"); setTimeout(() => (f.hidden = true), 250); }, 900);
  }
  function go(id, quiet) {
    if (!desks.some((d) => d.id === id) || id === cur) return;
    cur = id; apply(); tellSystem(); if (!quiet) flash();
    const top = NX.topWin(); if (top) NX.focus(top.id);
  }
  function add(silent) {
    if (desks.length >= MAX) { NX.toast("You can have up to " + MAX + " desktops."); return null; }
    let n = 1; while (desks.some((d) => d.id === "d" + n)) n++;
    const d = { id: "d" + n, name: "" }; desks.push(d); saveNames(); tellSystem(); if (!silent) go(d.id); return d;
  }
  function remove(id) {
    if (desks.length <= 1) return;
    const i = desks.findIndex((d) => d.id === id); if (i < 0) return;
    const to = desks[i > 0 ? i - 1 : 1].id;
    for (const w of NX.wins.values()) if (w.desk === id) w.desk = to;
    desks.splice(i, 1); if (cur === id) cur = to;
    saveNames(); apply(); tellSystem();
  }
  function move(winId, deskId) { const w = NX.wins.get(winId); if (!w || !desks.some((d) => d.id === deskId)) return; w.desk = deskId; apply(); }
  function rename(id, name) { const d = desks.find((x) => x.id === id); if (!d) return; d.name = String(name || "").trim().slice(0, 24); saveNames(); }

  // new windows open on the desktop you're on; bringing up a window on another desktop goes there
  document.addEventListener("nx:winopen", (e) => { const w = NX.wins.get(e.detail); if (w) { w.desk = cur; apply(); } });
  const focus = NX.focus;
  NX.focus = (id) => { const w = NX.wins.get(id); if (w && w.desk && w.desk !== cur) { cur = w.desk; apply(); tellSystem(); flash(); } focus(id); };
  const topWin = NX.topWin;
  NX.topWin = () => { const t = [...NX.wins.values()].filter((w) => !w.min && (!w.desk || w.desk === cur)).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex))[0]; return t || null; };
  void topWin;

  document.addEventListener("nx:signin", () => {
    const saved = NX.data("desks", null);
    desks = Array.isArray(saved) && saved.length ? saved.slice(0, MAX).map((d, i) => ({ id: String(d.id || "d" + (i + 1)), name: String(d.name || ""), wall: typeof d.wall === "number" ? d.wall : undefined })) : [{ id: "d1", name: "" }];
    if (!desks.some((d) => d.id === cur)) cur = desks[0].id;
    apply(); tellSystem();
  });

  // the desktops strip in Task View
  function strip(tv, redraw) {
    const el = document.createElement("div"); el.className = "tv-desks";
    el.innerHTML = desks.map((d, i) => { const n = [...NX.wins.values()].filter((w) => w.desk === d.id).length;
      return `<div class="tv-dk ${d.id === cur ? "on" : ""}" style="--wall:${typeof d.wall === "number" ? `url(${NX.wallpaperURL(d.wall, 192, 108)})` : getComputedStyle(document.documentElement).getPropertyValue("--wall").trim().replace(/"/g, "'")}" data-dk="${d.id}" role="button" tabindex="0" aria-label="${NX.esc(label(d, i))}"><div class="tv-dkp">${n ? `${n} window${n === 1 ? "" : "s"}` : "Empty"}</div><span class="tv-dkn">${NX.esc(label(d, i))}</span>${desks.length > 1 ? `<button class="tv-dkx" data-dkx="${d.id}" aria-label="Close ${NX.esc(label(d, i))}">${NX.icon("close", 12)}</button>` : ""}</div>`; }).join("") +
      (desks.length < MAX ? `<button class="tv-dkadd" aria-label="New desktop">${NX.icon("plus", 18)}<span>New desktop</span></button>` : "");
    tv.appendChild(el);
    el.querySelectorAll("[data-dk]").forEach((c) => {
      c.onclick = (e) => { e.stopPropagation(); if (e.target.closest("[data-dkx]") || e.target.closest("input")) return; go(c.dataset.dk, true); redraw(); };
      c.onkeydown = (e) => { if (e.key === "Enter") c.click(); };
      c.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const d = desks.find((x) => x.id === c.dataset.dk); NX.menu(e.clientX, e.clientY - 10, [["Background", null], ["Same as my background", () => { d.wall = undefined; saveNames(); apply(); redraw(); }, typeof d.wall === "number" ? "blank" : "check"], ...NX.wallpapers.map((w, k) => [w.name, () => { d.wall = k; saveNames(); apply(); redraw(); }, d.wall === k ? "check" : "blank"])]); };
      c.querySelector(".tv-dkn").ondblclick = (e) => {
        e.stopPropagation(); const s = e.currentTarget, d = desks.find((x) => x.id === c.dataset.dk);
        const inp = document.createElement("input"); inp.className = "tv-dkin"; inp.maxLength = 24; inp.value = label(d, desks.indexOf(d)); s.replaceWith(inp); inp.focus(); inp.select();
        const done = () => { rename(d.id, inp.value === "Desktop " + (desks.indexOf(d) + 1) ? "" : inp.value); redraw(); };
        inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(); if (ev.key === "Escape") redraw(); }; inp.onblur = done; inp.onclick = (ev) => ev.stopPropagation();
      };
      c.ondragover = (e) => { e.preventDefault(); c.classList.add("drop"); };
      c.ondragleave = () => c.classList.remove("drop");
      c.ondrop = (e) => { e.preventDefault(); c.classList.remove("drop"); const id = e.dataTransfer.getData("text/nx-win"); if (id) { move(id, c.dataset.dk); redraw(); } };
    });
    el.querySelectorAll("[data-dkx]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); remove(b.dataset.dkx); redraw(); }));
    const ad = el.querySelector(".tv-dkadd"); if (ad) ad.onclick = (e) => { e.stopPropagation(); add(true); redraw(); };
    // drag a window's card onto a desktop
    tv.querySelectorAll(".tv-card[data-id]").forEach((card) => { card.draggable = true; card.ondragstart = (e) => { e.dataTransfer.setData("text/nx-win", card.dataset.id); e.dataTransfer.effectAllowed = "move"; }; });
  }

  // keys: Ctrl + Nebulux + Left / Right / D / F4
  function key(k) {
    const i = idx();
    if (k === "desk-prev" && i > 0) go(desks[i - 1].id);
    if (k === "desk-next" && i < desks.length - 1) go(desks[i + 1].id);
    if (k === "desk-new") add();
    if (k === "desk-close") { if (desks.length > 1) { remove(cur); flash(); } }
  }
  addEventListener("keydown", (e) => {
    if (!NX.me || !e.ctrlKey || !(e.metaKey || (e.getModifierState && e.getModifierState("OS")))) return;
    const k = { ArrowLeft: "desk-prev", ArrowRight: "desk-next", d: "desk-new", D: "desk-new", F4: "desk-close" }[e.key];
    if (k) { e.preventDefault(); key(k); } // the shell still sees it, so letting go of Nebulux doesn't open Start
  }, true);
  document.addEventListener("nx:key", (e) => { if (NX.me && /^desk-/.test(e.detail || "") && e.detail !== "desk") key(e.detail); });

  NX.desks = { list: () => desks.map((d, i) => ({ id: d.id, name: label(d, i), current: d.id === cur })), current: () => cur, go, add, remove, move, rename, strip, key, apply };
})();
