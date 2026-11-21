// Nebulux OS window manager: open, focus, drag (drag to the top edge to maximize, to a side to snap half), resize from
// any edge or corner, minimize, maximize and close. One window per app; opening it again brings it to the front.
"use strict";
(function () {
  const wins = new Map(); let z = 10, desk = null;
  NX.apps = NX.apps || {};
  NX.wins = wins;
  const area = () => { const r = desk.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function place(w) {
    const s = w.el.style;
    if (w.max) { s.left = "0px"; s.top = "0px"; s.width = "100%"; s.height = "100%"; return; }
    s.left = w.x + "px"; s.top = w.y + "px"; s.width = w.w + "px"; s.height = w.h + "px";
  }
  function fit(w) {
    const A = area(); w.w = clamp(w.w, w.minW, A.w); w.h = clamp(w.h, w.minH, A.h);
    w.x = clamp(w.x, -w.w + 120, A.w - 120); w.y = clamp(w.y, 0, A.h - 40);
  }
  NX.focus = (id) => {
    const w = wins.get(id); if (!w) return;
    if (w.min) { w.min = false; w.el.classList.remove("minimized"); }
    w.el.style.zIndex = ++z;
    for (const o of wins.values()) o.el.classList.toggle("active", o === w);
    NX.shell && NX.shell.taskbar();
  };
  NX.minimize = (id) => { const w = wins.get(id); if (!w) return; w.min = true; w.el.classList.add("minimized"); w.el.classList.remove("active"); NX.shell && NX.shell.taskbar(); };
  NX.toggleMax = (id) => {
    const w = wins.get(id); if (!w) return; w.max = !w.max; w.snap = null; w.el.classList.toggle("maxed", w.max);
    w.el.querySelector(".wb-max").innerHTML = NX.icon(w.max ? "restore" : "max", 16); w.el.querySelector(".wb-max").title = w.max ? "Restore down" : "Maximize";
    place(w); w.onresize && w.onresize();
  };
  NX.close = (id) => {
    const w = wins.get(id); if (!w) return;
    try { w.onclose && w.onclose(); } catch (e) { console.error(e); }
    w.el.classList.add("closing"); wins.delete(id);
    setTimeout(() => w.el.remove(), 140); NX.shell && NX.shell.taskbar();
  };
  NX.closeAll = () => { for (const id of [...wins.keys()]) NX.close(id); };
  NX.open = (id, opts) => {
    const app = NX.apps[id]; if (!app) return null;
    if (app.url) { window.open(app.url, "_blank", "noopener"); NX.shell && NX.shell.recent(id); return null; }
    if (wins.has(id)) { NX.focus(id); const w = wins.get(id); if (opts && w.onopts) w.onopts(opts); return w; }
    desk = desk || document.getElementById("windows");
    const A = area(), small = A.w < 700;
    const el = document.createElement("div"); el.className = "win opening"; el.dataset.app = id; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", app.name);
    el.innerHTML = `<div class="titlebar"><span class="wt-ico">${NX.icon(app.icon || id, 16)}</span><span class="wt-name">${NX.esc(app.name)}</span><span class="wt-btns"><button class="wb wb-min" title="Minimize" aria-label="Minimize">${NX.icon("min", 16)}</button><button class="wb wb-max" title="Maximize" aria-label="Maximize">${NX.icon("max", 16)}</button><button class="wb wb-close" title="Close" aria-label="Close">${NX.icon("close", 16)}</button></span></div><div class="win-body"></div>` +
      ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((d) => `<div class="rz rz-${d}" data-d="${d}"></div>`).join("");
    desk.appendChild(el);
    const n = wins.size, w = { id, el, app, min: false, max: small, minW: Math.min(app.minW || 360, A.w), minH: Math.min(app.minH || 260, A.h),
      w: Math.min(app.w || 900, A.w - 40), h: Math.min(app.h || 600, A.h - 40), x: 0, y: 0 };
    w.x = Math.round((A.w - w.w) / 2 + (n % 5) * 26 - 52); w.y = Math.round((A.h - w.h) / 2.4 + (n % 5) * 22 - 44); fit(w);
    wins.set(id, w); el.classList.toggle("maxed", w.max); if (w.max) el.querySelector(".wb-max").innerHTML = NX.icon("restore", 16);
    place(w); NX.focus(id);
    setTimeout(() => el.classList.remove("opening"), 16); // a timer, not an animation frame: frames pause in a hidden tab
    // buttons
    el.querySelector(".wb-min").onclick = (e) => { e.stopPropagation(); NX.minimize(id); };
    el.querySelector(".wb-max").onclick = (e) => { e.stopPropagation(); NX.toggleMax(id); };
    el.querySelector(".wb-close").onclick = (e) => { e.stopPropagation(); NX.close(id); };
    el.addEventListener("pointerdown", () => { if (wins.get(id) === w) NX.focus(id); }, true);
    const tb = el.querySelector(".titlebar");
    tb.addEventListener("dblclick", (e) => { if (!e.target.closest(".wb")) NX.toggleMax(id); });
    // drag
    tb.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".wb")) return;
      const A2 = area(), sx = e.clientX, sy = e.clientY; let ox = w.x, oy = w.y, moved = false, hint = document.getElementById("snaphint"), zone = null;
      const mv = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) { moved = true; el.classList.add("dragging");
          if (w.max || w.snap) { const fx = (sx - el.getBoundingClientRect().left) / el.getBoundingClientRect().width; w.max = false; w.snap = null; el.classList.remove("maxed"); el.querySelector(".wb-max").innerHTML = NX.icon("max", 16); w.w = w.rw || w.w; w.h = w.rh || w.h; ox = sx - fx * w.w; oy = 0; } }
        w.x = Math.round(ox + dx); w.y = Math.round(clamp(oy + dy, 0, A2.h - 40)); w.x = clamp(w.x, -w.w + 120, A2.w - 120); place(w);
        const r = desk.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
        zone = py < 6 ? "max" : px < 6 ? "left" : px > A2.w - 6 ? "right" : null;
        if (hint) { hint.className = zone ? "show " + zone : ""; }
      };
      const up = () => {
        removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
        el.classList.remove("dragging"); if (hint) hint.className = "";
        if (moved && zone) {
          w.rw = w.w; w.rh = w.h;
          if (zone === "max") { w.max = false; NX.toggleMax(id); }
          else { const A3 = area(); w.snap = zone; w.x = zone === "left" ? 0 : Math.round(A3.w / 2); w.y = 0; w.w = Math.round(A3.w / 2); w.h = A3.h; place(w); w.onresize && w.onresize(); }
        }
      };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
    });
    // resize
    el.querySelectorAll(".rz").forEach((h) => h.addEventListener("pointerdown", (e) => {
      if (w.max) return; e.preventDefault(); e.stopPropagation();
      const d = h.dataset.d, sx = e.clientX, sy = e.clientY, o = { x: w.x, y: w.y, w: w.w, h: w.h }, A2 = area();
      const mv = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (d.includes("e")) w.w = clamp(o.w + dx, w.minW, A2.w - o.x);
        if (d.includes("s")) w.h = clamp(o.h + dy, w.minH, A2.h - o.y);
        if (d.includes("w")) { const nw = clamp(o.w - dx, w.minW, o.x + o.w); w.x = o.x + o.w - nw; w.w = nw; }
        if (d.includes("n")) { const nh = clamp(o.h - dy, w.minH, o.y + o.h); w.y = o.y + o.h - nh; w.h = nh; }
        w.snap = null; place(w); w.onresize && w.onresize();
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
    }));
    try { app.open(el.querySelector(".win-body"), w, opts || {}); } catch (e) { console.error(e); el.querySelector(".win-body").innerHTML = `<div class="app-error">${NX.esc(app.name)} couldn't start: ${NX.esc(e.message)}</div>`; }
    NX.shell && NX.shell.recent(id); NX.shell && NX.shell.taskbar();
    return w;
  };
  // keep windows on screen when the screen changes size
  addEventListener("resize", () => { if (!desk) return; for (const w of wins.values()) { if (!w.max && !w.snap) fit(w); else if (w.snap) { const A = area(); w.x = w.snap === "left" ? 0 : Math.round(A.w / 2); w.w = Math.round(A.w / 2); w.h = A.h; } place(w); w.onresize && w.onresize(); } });
})();
