// Nebulux OS 4.0: Quick Search (Nebulux + Space), Peek (Space on a file), the App Grid, hot corners,
// taskbar icons that grow under the pointer, and shaking the pointer to find it.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const visible = () => { const p = NX.prefs(); return Object.keys(NX.apps).filter((id) => NX.apps[id].builtIn || p.installed.includes(id)); };
  const FI = { folder: "folder", image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };

  // ---------- Quick Search: one box in the middle of the screen for apps, settings, files, sums and the web ----------
  let qsGen = 0;
  NX.quickSearch = () => {
    if (!NX.me) return; let o = $("#nx-qs"); if (o) { o.remove(); return; }
    if (NX.shell) NX.shell.closeFlyouts();
    o = document.createElement("div"); o.id = "nx-qs"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Quick Search");
    o.innerHTML = `<div class="qs2-box"><label class="qs2-in">${NX.icon("search", 22)}<input placeholder="Search apps, settings, files, or type a sum" aria-label="Quick Search" autocomplete="off" spellcheck="false"></label><div class="qs2-res" role="listbox"></div></div>`;
    document.body.appendChild(o);
    const inp = $("input", o), res = $(".qs2-res", o); let items = [], at = 0;
    const close = () => o.remove();
    const pick = (k) => { const it = items[k]; if (!it) return; close(); it.go(); };
    const paint = () => { res.innerHTML = items.map((it, k) => `${it.head ? `<h4>${it.head}</h4>` : ""}<button class="qs2-it ${k === at ? "on" : ""}" data-k="${k}" role="option" aria-selected="${k === at}">${it.icon}<span><b>${NX.esc(it.name)}</b><small>${NX.esc(it.sub)}</small></span></button>`).join(""); res.hidden = !items.length; };
    const run = async () => {
      const q = inp.value.trim(), ql = q.toLowerCase(), gen = ++qsGen; items = []; at = 0;
      if (!q) { paint(); return; }
      // a sum
      if (/[\d)]/.test(q) && /[-+*/^×÷%!()]|sqrt|sin|cos|tan|log|ln/.test(q) && NX.calcEval) { try { const v = NX.calcEval(q, true); if (isFinite(v)) { const r = String(+v.toPrecision(12)); items.push({ head: "Answer", icon: NX.icon("calculator", 30), name: "= " + r, sub: "Press Enter to copy it", go: () => { navigator.clipboard && navigator.clipboard.writeText(r).catch(() => {}); if (NX.clip) NX.clip.add(r); NX.toast("Copied " + r + "."); } }); } } catch (e) { /* not a sum */ } }
      const apps = visible().filter((id) => NX.apps[id].name.toLowerCase().includes(ql)).sort((a, b) => NX.apps[a].name.toLowerCase().indexOf(ql) - NX.apps[b].name.toLowerCase().indexOf(ql)).slice(0, 5);
      apps.forEach((id, k) => items.push({ head: k ? "" : "Apps", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "App", go: () => NX.open(id) }));
      const pages = (NX.settingsPages || []).filter((pg) => pg.id !== "home" && (pg.name.toLowerCase().includes(ql) || ((NX.settingsWords || {})[pg.id] || "").includes(ql))).slice(0, 3);
      pages.forEach((pg, k) => items.push({ head: k ? "" : "Settings", icon: NX.icon(pg.icon, 30), name: pg.name, sub: "Settings", go: () => NX.open("settings", { page: pg.id }) }));
      const web = { head: "The web", icon: NX.icon("google", 30), name: "Search Google for “" + q + "”", sub: "Opens Google", go: () => NX.open("google", { q }) };
      items.push(web); paint();
      if (ql.length < 2 || !NX.fs) return;
      let found = []; try { const pl = await NX.fs.places(); for (const f of pl.folders) { const r = await NX.fs.list(f.path).catch(() => null); if (r) found.push(...r.entries.filter((e) => e.name.toLowerCase().includes(ql)).map((e) => Object.assign({ where: f.name }, e))); if (found.length > 12) break; } } catch (e) { return; }
      if (gen !== qsGen || !found.length || !document.body.contains(o)) return;
      const fi = found.slice(0, 5).map((e, k) => ({ head: k ? "" : "Files", icon: NX.icon(FI[e.kind] || "file", 30), name: e.name, sub: e.where, go: () => (e.dir ? NX.open("files", { path: e.path }) : NX.openFile(e)) }));
      items.splice(items.indexOf(web), 0, ...fi); paint();
    };
    inp.oninput = run;
    inp.onkeydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (items.length) { at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; paint(); const b = res.querySelector(".on"); if (b) b.scrollIntoView({ block: "nearest" }); } }
      else if (e.key === "Enter") { e.preventDefault(); pick(at); }
    };
    res.onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) pick(+b.dataset.k); };
    o.onpointerdown = (e) => { if (e.target === o) close(); };
    inp.focus(); paint();
  };

  // ---------- Peek (NX.peekFile): Space on a file in File Explorer shows it right away; Space or Esc closes, arrows go to the next one ----------
  NX.peekFile = async (e, list) => {
    let o = $("#nx-peek"); if (o) o.remove();
    list = (list && list.length ? list : [e]); let i = Math.max(0, list.findIndex((x) => x.path === e.path));
    o = document.createElement("div"); o.id = "nx-peek"; o.tabIndex = -1; o.setAttribute("role", "dialog"); document.body.appendChild(o);
    const show = async () => {
      const f = list[i]; o.setAttribute("aria-label", f.name);
      o.innerHTML = `<div class="pk2-card"><div class="pk2-top"><b>${NX.esc(f.name)}</b><span class="pk2-sp"></span><button class="btn sm" data-pk="open">Open</button><button class="btn sm" data-pk="close" aria-label="Close">${NX.icon("close", 12)}</button></div><div class="pk2-body"><p class="pk2-msg">Loading...</p></div></div>`;
      const b = $(".pk2-body", o);
      try {
        if (f.kind === "image") { b.innerHTML = `<img alt="${NX.esc(f.name)}" src="${await NX.fs.url(f.path)}">`; }
        else if (f.kind === "video") { b.innerHTML = `<video controls autoplay src="${await NX.fs.url(f.path)}"></video>`; }
        else if (f.kind === "audio") { b.innerHTML = `<div class="pk2-aud">${NX.icon("faudio", 96)}<audio controls autoplay src="${await NX.fs.url(f.path)}"></audio></div>`; }
        else if (f.kind === "text") { const t = await NX.fs.read(f.path); b.innerHTML = `<pre></pre>`; $("pre", b).textContent = t.length > 60000 ? t.slice(0, 60000) + "\n..." : t; }
        else b.innerHTML = `<div class="pk2-aud">${NX.icon(FI[f.kind] || "file", 96)}<p class="pk2-msg">${f.size != null ? (f.size > 1e6 ? (f.size / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(f.size / 1e3)) + " KB") : ""}${f.mtime ? " · changed " + new Date(f.mtime).toLocaleString() : ""}</p></div>`;
      } catch (er) { b.innerHTML = `<p class="pk2-msg">${NX.esc(er.message || "This file can't be shown.")}</p>`; }
      o.focus();
    };
    const close = () => { const m = o.querySelector("video,audio"); if (m) m.pause(); o.remove(); };
    o.onclick = (ev) => { const a = ev.target.closest("[data-pk]"); if (ev.target === o || (a && a.dataset.pk === "close")) close(); else if (a && a.dataset.pk === "open") { close(); NX.openFile(list[i], list); } };
    o.onkeydown = (ev) => { if (ev.key === " " || ev.key === "Escape") { if (ev.target.closest && ev.target.closest("video,audio") && ev.key === " ") return; ev.preventDefault(); ev.stopPropagation(); close(); }
      else if ((ev.key === "ArrowRight" || ev.key === "ArrowDown") && list.length > 1) { ev.preventDefault(); i = (i + 1) % list.length; show(); }
      else if ((ev.key === "ArrowLeft" || ev.key === "ArrowUp") && list.length > 1) { ev.preventDefault(); i = (i - 1 + list.length) % list.length; show(); } };
    show();
  };

  // ---------- The App Grid: every app, big, on the whole screen (Nebulux + G, or a hot corner) ----------
  NX.appGrid = () => {
    if (!NX.me) return; let o = $("#nx-grid"); if (o) { o.remove(); return; }
    if (NX.shell) NX.shell.closeFlyouts();
    const ids = visible().sort((a, b) => NX.apps[a].name.localeCompare(NX.apps[b].name));
    o = document.createElement("div"); o.id = "nx-grid"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "All apps");
    o.innerHTML = `<input class="ag-q" placeholder="Search" aria-label="Search apps"><div class="ag-apps">${ids.map((id) => `<button class="ag-app" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 72)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("")}</div>`;
    document.body.appendChild(o);
    const q = $(".ag-q", o);
    q.oninput = () => { const v = q.value.trim().toLowerCase(); o.querySelectorAll(".ag-app").forEach((b) => (b.hidden = !!v && !NX.apps[b.dataset.app].name.toLowerCase().includes(v))); };
    q.onkeydown = (e) => { if (e.key === "Escape") o.remove(); if (e.key === "Enter") { const b = [...o.querySelectorAll(".ag-app")].find((x) => !x.hidden); if (b) b.click(); } };
    o.onclick = (e) => { const b = e.target.closest(".ag-app"); if (b) { o.remove(); NX.open(b.dataset.app); } else if (!e.target.closest(".ag-q")) o.remove(); };
    q.focus();
  };

  // ---------- keys: Nebulux + Space (Quick Search) and Nebulux + G (App Grid); on the USB they come from the window manager ----------
  addEventListener("keydown", (e) => {
    const win = e.metaKey || (e.getModifierState && e.getModifierState("OS"));
    if (win && e.key === " ") { e.preventDefault(); NX.quickSearch(); }
    else if (win && /^g$/i.test(e.key)) { e.preventDefault(); NX.appGrid(); }
    else if (e.key === "Escape" && $("#nx-grid")) $("#nx-grid").remove();
  });
  document.addEventListener("nx:key", (e) => { if (e.detail === "search") NX.quickSearch(); if (e.detail === "grid") NX.appGrid(); });

  // ---------- hot corners: push the pointer into a corner to do something (Settings > Personalization) ----------
  NX.cornerActions = { none: ["Nothing", null], desktop: ["Show the desktop", () => NX.showDesktop && NX.showDesktop()], tview: ["Task View", () => NX.taskView && NX.taskView()], grid: ["App Grid", () => NX.appGrid()], search: ["Quick Search", () => NX.quickSearch()], lock: ["Lock", () => NX.shell && NX.shell.lockKeep && NX.shell.lockKeep()], start: ["Start", () => NX.shell && NX.shell.toggleStart && NX.shell.toggleStart()] };
  let cornerAt = null, cornerT = 0;
  addEventListener("pointermove", (e) => {
    if (!NX.me || e.pointerType !== "mouse") return; const c = NX.prefs().corners || {};
    const w = innerWidth, h = innerHeight, E = 3, k = e.clientX <= E && e.clientY <= E ? "tl" : e.clientX >= w - 1 - E && e.clientY <= E ? "tr" : e.clientX <= E && e.clientY >= h - 1 - E ? "bl" : e.clientX >= w - 1 - E && e.clientY >= h - 1 - E ? "br" : null;
    if (k === cornerAt) return; cornerAt = k; clearTimeout(cornerT);
    if (k && c[k] && c[k] !== "none" && NX.cornerActions[c[k]]) cornerT = setTimeout(() => { if (cornerAt === k && !document.documentElement.classList.contains("nx-drag")) NX.cornerActions[c[k]][1](); }, 220);
  }, { passive: true });

  // ---------- taskbar icons that grow under the pointer (Settings > Personalization) ----------
  const tb = () => $("#tb-apps");
  addEventListener("pointermove", (e) => {
    const box = tb(); if (!box || !NX.me || !NX.prefs().magnify) return;
    const r = box.getBoundingClientRect(), near = e.clientY > r.top - 30 && e.clientY < r.bottom + 4 && e.clientX > r.left - 60 && e.clientX < r.right + 60;
    box.classList.toggle("tb-mag", near);
    box.querySelectorAll(".tb-app").forEach((b) => { const br = b.getBoundingClientRect(), d = Math.abs(e.clientX - (br.left + br.width / 2)), s = near ? 1 + .55 * Math.max(0, 1 - d / 110) : 1; const ic = b.querySelector(".ico"); if (ic) ic.style.transform = s > 1.01 ? `translateY(${-(s - 1) * 22}px) scale(${s})` : ""; });
  }, { passive: true });

  // ---------- shake the pointer to find it: it grows for a moment (on by default) ----------
  let pts = [], ring = null;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || (NX.me && NX.prefs().shakeFind === false)) return;
    const t = performance.now(); pts.push([e.clientX, t]); pts = pts.filter((p) => t - p[1] < 600);
    let turns = 0, dist = 0; for (let k = 2; k < pts.length; k++) { const a = pts[k - 1][0] - pts[k - 2][0], b = pts[k][0] - pts[k - 1][0]; dist += Math.abs(b); if (a * b < 0 && Math.abs(a) > 6 && Math.abs(b) > 6) turns++; }
    if (ring) { ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px"; }
    if (turns >= 4 && dist > 900 && !ring) {
      ring = document.createElement("div"); ring.className = "nx-find"; ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px"; document.body.appendChild(ring);
      NX.pointerFound = (NX.pointerFound || 0) + 1; setTimeout(() => { if (ring) ring.remove(); ring = null; pts = []; }, 1100);
    }
  }, { passive: true });
})();
