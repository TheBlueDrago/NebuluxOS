// Sticky Notes: quick colored notes that save as you type. Pick a color, search them, delete the ones you're done with.
"use strict";
(function () {
  const COLORS = [["sun", "Yellow"], ["rose", "Pink"], ["mint", "Green"], ["sky", "Blue"], ["violet", "Purple"], ["slate", "Gray"]];
  const notes = () => NX.data("sticky-notes", []);
  let saveT = 0, pending = null;
  const save = (L) => { pending = L; clearTimeout(saveT); saveT = setTimeout(() => { NX.setData("sticky-notes", pending); pending = null; }, 300); };
  const now = () => (pending || notes());

  // notes pinned to the desktop: they sit on the wallpaper, behind windows; type in them, drag them by the top, unpin with the pin
  const syncDesk = (id, t) => { const ta = document.querySelector(`#nx-dnotes [data-id="${id}"] textarea`); if (ta && ta !== document.activeElement) ta.value = t; };
  function deskNotes() {
    let box = document.getElementById("nx-dnotes"); const desk = document.getElementById("desktop");
    const L = NX.me ? now().filter((n) => n.pin) : [];
    if (!L.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "nx-dnotes"; const ic = document.getElementById("icons"); (ic ? ic.parentNode : desk).insertBefore(box, ic ? ic.nextSibling : null); }
    const have = new Set([...box.children].map((x) => x.dataset.id));
    for (const el of [...box.children]) if (!L.some((n) => n.id === el.dataset.id)) el.remove();
    L.forEach((n, k) => {
      let el = box.querySelector(`[data-id="${n.id}"]`);
      if (!el) { el = document.createElement("div"); el.className = "dn-note"; el.dataset.id = n.id; el.innerHTML = `<div class="dn-top"><span>Sticky note</span><button class="dn-un" aria-label="Take off the desktop" title="Take off the desktop">${NX.icon("close", 10)}</button></div><textarea aria-label="Sticky note" placeholder="Take a note..."></textarea>`; box.appendChild(el);
        const ta = el.querySelector("textarea"); ta.value = n.t;
        ta.oninput = () => { save(now().map((x) => (x.id === n.id ? Object.assign({}, x, { t: ta.value.slice(0, 20000), at: Date.now() }) : x))); const w = document.querySelector(`.win[data-app=notes] [data-id="${n.id}"] textarea`); if (w) w.value = ta.value; };
        el.querySelector(".dn-un").onclick = () => { save(now().map((x) => (x.id === n.id ? Object.assign({}, x, { pin: false }) : x))); el.remove(); if (!box.children.length) box.remove(); };
        const top = el.querySelector(".dn-top");
        top.onpointerdown = (e) => { if (e.target.closest("button")) return; e.preventDefault(); const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; top.setPointerCapture(e.pointerId);
          top.onpointermove = (ev) => { el.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 120, ev.clientY - dy)) + "px"; };
          top.onpointerup = () => { top.onpointermove = top.onpointerup = null; save(now().map((x) => (x.id === n.id ? Object.assign({}, x, { x: parseInt(el.style.left), y: parseInt(el.style.top) }) : x))); }; };
      }
      el.className = "dn-note c-" + n.c;
      el.style.left = (n.x != null ? n.x : innerWidth - 260 - (k % 3) * 24) + "px"; el.style.top = (n.y != null ? n.y : 24 + k * 34) + "px";
      if (!have.has(n.id)) el.querySelector("textarea").value = n.t;
    });
  }
  NX.deskNotes = deskNotes;
  document.addEventListener("nx:prefs", () => setTimeout(deskNotes, 50)); setInterval(() => { if (NX.me && now().some((n) => n.pin) !== !!document.getElementById("nx-dnotes")) deskNotes(); if (!NX.me && document.getElementById("nx-dnotes")) deskNotes(); }, 1500);
  NX.apps.notes = {
    name: "Sticky Notes", icon: "sticky", builtIn: true, category: "Productivity", w: 760, h: 560, minW: 340, minH: 340,
    desc: "Quick colored notes that save as you type.",
    open(body) {
      body.classList.add("stn");
      body.innerHTML = `<div class="stn-bar"><button class="btn primary sm" data-a="new">${NX.icon("plus", 14)}New note</button><input class="stn-q" type="search" placeholder="Search notes" aria-label="Search notes"><span class="stn-count"></span></div><div class="stn-grid"></div><div class="stn-undo" hidden><span>Note deleted.</span><button class="btn sm" data-a="undo">Undo</button></div>`;
      const grid = body.querySelector(".stn-grid"), q = body.querySelector(".stn-q"), count = body.querySelector(".stn-count"), undo = body.querySelector(".stn-undo");
      let gone = null, undoT = 0;
      body.querySelector("[data-a=undo]").onclick = () => { if (!gone) return; const L = now().slice(); L.splice(Math.min(gone.i, L.length), 0, gone.n); save(L); gone = null; undo.hidden = true; draw(); };
      const when = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? NX.fmtTime(d) : d.toLocaleDateString(); };
      const draw = (focusId) => {
        const all = now(), f = q.value.trim().toLowerCase(), L = f ? all.filter((n) => n.t.toLowerCase().includes(f)) : all;
        count.textContent = all.length === 1 ? "1 note" : all.length + " notes";
        grid.innerHTML = L.length ? L.map((n) => `<div class="stn-note c-${n.c}" data-id="${n.id}">
            <div class="stn-top"><span class="stn-when">${when(n.at)}</span><span class="stn-cols">${COLORS.map(([c, name]) => `<button class="stn-dot c-${c} ${c === n.c ? "on" : ""}" data-c="${c}" aria-label="${name}" title="${name}"></button>`).join("")}</span><button class="stn-pin ${n.pin ? "on" : ""}" aria-label="${n.pin ? "Take off the desktop" : "Pin to the desktop"}" title="${n.pin ? "Take off the desktop" : "Pin to the desktop"}">${NX.icon("pin", 14)}</button><button class="stn-del" aria-label="Delete note" title="Delete">${NX.icon("trash", 14)}</button></div>
            <textarea aria-label="Note" placeholder="Take a note...">${NX.esc(n.t)}</textarea></div>`).join("")
          : `<div class="stn-empty">${f ? "No notes match." : "No notes yet. Press New note to write one."}</div>`;
        grid.querySelectorAll(".stn-note").forEach((el) => {
          const id = el.dataset.id, ta = el.querySelector("textarea");
          ta.oninput = () => { const L2 = now().map((n) => (n.id === id ? Object.assign({}, n, { t: ta.value.slice(0, 20000), at: Date.now() }) : n)); save(L2); syncDesk(id, ta.value); };
          el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { save(now().map((n) => (n.id === id ? Object.assign({}, n, { c: b.dataset.c }) : n))); draw(); }));
          el.querySelector(".stn-pin").onclick = () => { save(now().map((n) => (n.id === id ? Object.assign({}, n, { pin: !n.pin }) : n))); draw(); setTimeout(deskNotes, 350); };
          el.querySelector(".stn-del").onclick = () => {
            const all = now(), i = all.findIndex((x) => x.id === id); if (i < 0) return;
            gone = { n: all[i], i }; save(all.filter((x) => x.id !== id)); draw(); setTimeout(deskNotes, 350);
            undo.hidden = false; clearTimeout(undoT); undoT = setTimeout(() => { undo.hidden = true; gone = null; }, 6000);
          };
        });
        if (focusId) { const ta = grid.querySelector(`[data-id="${focusId}"] textarea`); if (ta) ta.focus(); }
      };
      body.querySelector("[data-a=new]").onclick = () => {
        const n = { id: NX.uid(), t: "", c: COLORS[now().length % COLORS.length][0], at: Date.now() };
        q.value = ""; save([n, ...now()]); draw(n.id);
      };
      q.oninput = () => draw();
      draw();
    },
  };
})();
