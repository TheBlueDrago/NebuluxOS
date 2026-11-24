// Nebulux OS 4.0: Quick Search (Nebulux + Space), Peek (Space on a file), the App Grid, hot corners,
// taskbar icons that grow under the pointer, and shaking the pointer to find it.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const visible = () => { const p = NX.prefs(); return Object.keys(NX.apps).filter((id) => NX.apps[id].builtIn || p.installed.includes(id)); };
  const FI = { folder: "folder", image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };

  // ---------- Quick Search: one box in the middle of the screen for apps, settings, files, sums and the web ----------
  let qsGen = 0;
  // conversions Quick Search understands, like "5 km in miles" or "100 f to c"
  const UNITS = {
    mm: ["l", .001], cm: ["l", .01], m: ["l", 1], meter: ["l", 1], meters: ["l", 1], km: ["l", 1000], kilometers: ["l", 1000], in: ["l", .0254], inch: ["l", .0254], inches: ["l", .0254], ft: ["l", .3048], foot: ["l", .3048], feet: ["l", .3048], yd: ["l", .9144], yards: ["l", .9144], mi: ["l", 1609.344], mile: ["l", 1609.344], miles: ["l", 1609.344],
    g: ["w", .001], grams: ["w", .001], kg: ["w", 1], kilograms: ["w", 1], oz: ["w", .028349523125], ounces: ["w", .028349523125], lb: ["w", .45359237], lbs: ["w", .45359237], pounds: ["w", .45359237],
    ml: ["v", .001], l: ["v", 1], liter: ["v", 1], liters: ["v", 1], cup: ["v", .2365882365], cups: ["v", .2365882365], gal: ["v", 3.785411784], gallon: ["v", 3.785411784], gallons: ["v", 3.785411784],
    kmh: ["s", 1 / 3.6], kph: ["s", 1 / 3.6], mph: ["s", .44704],
    c: ["t", "C"], celsius: ["t", "C"], f: ["t", "F"], fahrenheit: ["t", "F"], k: ["t", "K"], kelvin: ["t", "K"],
    sec: ["d", 1], seconds: ["d", 1], min: ["d", 60], minutes: ["d", 60], h: ["d", 3600], hr: ["d", 3600], hours: ["d", 3600], day: ["d", 86400], days: ["d", 86400], week: ["d", 604800], weeks: ["d", 604800],
  };
  NX.qsConvert = (q) => {
    const m = /^\s*(-?[\d.]+)\s*°?\s*([a-z]+)\s+(?:in|to|=|as)\s+°?\s*([a-z]+)\s*$/i.exec(q); if (!m) return null;
    const v = parseFloat(m[1]), a = UNITS[m[2].toLowerCase()], b = UNITS[m[3].toLowerCase()]; if (!isFinite(v) || !a || !b || a[0] !== b[0]) return null;
    let r; if (a[0] === "t") { const toC = { C: (x) => x, F: (x) => (x - 32) * 5 / 9, K: (x) => x - 273.15 }, fromC = { C: (x) => x, F: (x) => x * 9 / 5 + 32, K: (x) => x + 273.15 }; r = fromC[b[1]](toC[a[1]](v)); } else r = (v * a[1]) / b[1];
    return { value: +r.toPrecision(8), text: v + " " + m[2] + " = " + +r.toPrecision(8) + " " + m[3] };
  };
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
      const cv = NX.qsConvert(q); if (cv) items.push({ head: "Answer", icon: NX.icon("calculator", 30), name: cv.text, sub: "Press Enter to copy it", go: () => { const r = String(cv.value); navigator.clipboard && navigator.clipboard.writeText(r).catch(() => {}); if (NX.clip) NX.clip.add(r); NX.toast("Copied " + r + "."); } });
      if (/^weather\b|^forecast\b/i.test(q)) { const w = NX.data("wx", null), p = NX.data("wx-place", null); items.push({ head: "Weather", icon: w && NX.wxInfo ? NX.wxInfo.icon(w.code, 30) : NX.icon("weather", 30), name: w && p && NX.wxInfo ? w.now + "°" + w.unit + ", " + NX.wxInfo.name(w.code) + " in " + p.name : "See the weather", sub: "Opens Weather", go: () => NX.open("weather") }); }
      const apps = visible().filter((id) => NX.apps[id].name.toLowerCase().includes(ql)).sort((a, b) => NX.apps[a].name.toLowerCase().indexOf(ql) - NX.apps[b].name.toLowerCase().indexOf(ql)).slice(0, 5);
      apps.forEach((id, k) => items.push({ head: k ? "" : "Apps", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "App", go: () => NX.open(id) }));
      // apps from the Nebulux Store you don't have yet
      const vis = new Set(visible()), store = Object.keys(NX.apps).filter((id) => !vis.has(id) && !NX.apps[id].builtIn && NX.apps[id].name.toLowerCase().includes(ql)).slice(0, apps.length ? 2 : 4);
      store.forEach((id, k) => items.push({ head: k ? "" : "In the Nebulux Store", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "Get it from the Nebulux Store", go: () => NX.open("store", { app: id }) }));
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
        else if (f.kind === "pdf") { b.innerHTML = `<embed type="application/pdf" src="${await NX.fs.url(f.path)}">`; }
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
    q.onkeydown = (e) => { if (e.key === "Escape") o.remove(); if (e.key === "Enter") { const b = [...o.querySelectorAll(".ag-app")].find((x) => !x.hidden); if (b) b.click(); } if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); const b = [...o.querySelectorAll(".ag-app")].find((x) => !x.hidden); if (b) b.focus(); } };
    // arrow keys move between apps (Enter opens one)
    o.querySelector(".ag-apps").onkeydown = (e) => { const all = [...o.querySelectorAll(".ag-app")].filter((x) => !x.hidden), i = all.indexOf(document.activeElement); if (i < 0) return;
      const cols = Math.max(1, Math.round(o.querySelector(".ag-apps").clientWidth / (all[0].getBoundingClientRect().width + 10))), d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (e.key === "Escape") o.remove(); if (d == null) return; e.preventDefault(); const n = i + d; if (n < 0) { q.focus(); return; } if (all[n]) all[n].focus(); };
    o.onclick = (e) => { const b = e.target.closest(".ag-app"); if (b) { o.remove(); NX.open(b.dataset.app); } else if (!e.target.closest(".ag-q")) o.remove(); };
    q.focus();
  };

  // ---------- Calendar: a whole month with your events in each day (the same events as the taskbar's calendar) ----------
  NX.apps.calendar = { name: "Calendar", icon: "calendar", builtIn: true, category: "Productivity", w: 980, h: 660, minW: 360, minH: 420, desc: "Your month at a glance, with your events and reminders.",
    open(body) {
      body.classList.add("ca");
      const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      let m = new Date(); m = new Date(m.getFullYear(), m.getMonth(), 1); let sel = key(new Date());
      const COLS = ["#7c5cff", "#22c55e", "#f97316", "#ec4899", "#0ea5e9"];
      const draw = () => {
        const ev = NX.data("events", []), today = key(new Date()), first = new Date(m), start = new Date(first); start.setDate(1 - first.getDay());
        let cells = ""; for (let k = 0; k < 42; k++) { const d = new Date(start); d.setDate(start.getDate() + k); const kk = key(d), es = ev.filter((e) => e.date === kk).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
          cells += `<button class="ca-d ${d.getMonth() !== m.getMonth() ? "out" : ""} ${kk === today ? "today" : ""} ${kk === sel ? "sel" : ""}" data-day="${kk}" aria-label="${d.toDateString()}${es.length ? ", " + es.length + " events" : ""}"><span class="ca-n">${d.getDate()}</span>${es.slice(0, 3).map((e) => `<i style="--c:${e.color || COLS[0]}" title="${e.time ? NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) + " " : ""}${NX.esc(e.title)}">${NX.esc(e.title)}</i>`).join("")}${es.length > 3 ? `<small>+${es.length - 3} more</small>` : ""}</button>`; }
        const sd = new Date(sel + "T12:00"), list = ev.filter((e) => e.date === sel).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        body.innerHTML = `<div class="ca-main"><div class="ca-head"><h2>${m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><span class="ca-sp"></span><button class="btn" data-ca="today">Today</button><button class="btn" data-ca="-1" aria-label="Last month">${NX.icon("back", 14)}</button><button class="btn" data-ca="1" aria-label="Next month">${NX.icon("fwd", 14)}</button></div>
          <div class="ca-wd">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => `<span>${x}</span>`).join("")}</div><div class="ca-grid">${cells}</div></div>
          <aside class="ca-side"><h3>${sel === today ? "Today" : sd.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
          <div class="ca-list">${list.length ? list.map((e) => `<div class="ca-e" style="--c:${e.color || COLS[0]}"><span><b>${NX.esc(e.title)}</b><small>${e.time ? NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : "All day"}</small></span><button class="btn sm" data-del="${e.id}" aria-label="Delete ${NX.esc(e.title)}">${NX.icon("trash", 12)}</button></div>`).join("") : `<p class="ca-none">Nothing planned.</p>`}</div>
          <form class="ca-add"><input name="n" maxlength="60" placeholder="Add an event" aria-label="Event name" required><input name="t" type="time" aria-label="Time (optional)"><div class="ca-cols">${COLS.map((c, k) => `<label><input type="radio" name="c" value="${c}" ${k ? "" : "checked"}><i style="background:${c}" aria-label="Color ${c}"></i></label>`).join("")}</div><button class="btn primary" type="submit">Add</button><p class="ca-tip">You get a reminder when an event with a time starts.</p></form></aside>`;
        body.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { sel = b.dataset.day; const d = new Date(sel + "T12:00"); if (d.getMonth() !== m.getMonth()) m = new Date(d.getFullYear(), d.getMonth(), 1); draw(); }));
        body.querySelectorAll("[data-ca]").forEach((b) => (b.onclick = () => { const a = b.dataset.ca; if (a === "today") { const t = new Date(); m = new Date(t.getFullYear(), t.getMonth(), 1); sel = key(t); } else m = new Date(m.getFullYear(), m.getMonth() + +a, 1); draw(); }));
        body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { NX.setData("events", NX.data("events", []).filter((x) => x.id !== b.dataset.del)); draw(); }));
        const f = $(".ca-add", body); f.onsubmit = (e) => { e.preventDefault(); const L = NX.data("events", []); if (L.length >= 300) { NX.toast("That's a lot of events. Delete some old ones first."); return; }
          L.push({ id: NX.uid(), date: sel, time: /^\d\d:\d\d$/.test(f.t.value) ? f.t.value : "", title: f.n.value.trim().slice(0, 60), told: "", color: (f.querySelector("[name=c]:checked") || {}).value || COLS[0] }); NX.setData("events", L); draw(); const n2 = $(".ca-add [name=n]", body); if (n2) n2.focus(); };
      };
      draw();
    } };

  // ---------- Screen time: how long each app was in front today (counted every 30 seconds, kept for 7 days, only on this computer) ----------
  let stBuf = {}, stN = 0;
  const dayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  NX.screenTime = (day) => { const all = Object.assign({}, NX.data("screen-time", {})), d = day || dayKey(), out = Object.assign({}, all[d] || {}); for (const [k, v] of Object.entries(stBuf)) if (k.startsWith(d + "|")) { const id = k.slice(d.length + 1); out[id] = (out[id] || 0) + v; } return out; };
  const stFlush = () => { if (!NX.me || !Object.keys(stBuf).length) return; const all = NX.data("screen-time", {}); for (const [k, v] of Object.entries(stBuf)) { const [d, id] = k.split("|"); all[d] = all[d] || {}; all[d][id] = (all[d][id] || 0) + v; } const keep = Object.keys(all).sort().slice(-7); NX.setData("screen-time", Object.fromEntries(keep.map((d) => [d, all[d]]))); stBuf = {}; };
  NX.screenTimeTick = (secs) => {
    if (!NX.me || document.getElementById("lock") && !document.getElementById("lock").hidden) return;
    const ids = new Set(); const t = NX.topWin && NX.topWin(); if (t) ids.add(t.id); if (NX.nativeActive) for (const id of NX.nativeActive) ids.add(id);
    for (const id of ids) { const k = dayKey() + "|" + id; stBuf[k] = (stBuf[k] || 0) + (secs || 30); }
    if (++stN % 4 === 0) stFlush();
  };
  setInterval(() => NX.screenTimeTick(30), 30000); addEventListener("pagehide", stFlush); document.addEventListener("nx:signout", stFlush);

  // ---------- Magnifier: Nebulux + Plus zooms in around the pointer, Nebulux + Minus zooms out, Nebulux + Esc stops ----------
  let mag = 1, mx = 0, my = 0;
  const magApply = () => { const d = document.getElementById("desktop"); if (!d) return; if (mag <= 1.001) { mag = 1; d.style.transform = ""; d.style.transformOrigin = ""; document.documentElement.classList.remove("nx-zoomed"); }
    else { d.style.transformOrigin = mx + "px " + my + "px"; d.style.transform = "scale(" + mag + ")"; document.documentElement.classList.add("nx-zoomed"); } };
  NX.magnifier = { zoom: (dir) => { mag = dir === 0 ? 1 : Math.max(1, Math.min(4, +(mag + dir * .5).toFixed(2))); if (mag > 1 && dir > 0 && mag === 1.5) NX.toast("Magnifier is on. Nebulux + Minus zooms out, Nebulux + Esc stops."); magApply(); return mag; }, level: () => mag };
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; if (mag > 1) magApply(); }, { passive: true });

  // ---------- desktop widgets: a clock, the weather, what's next in your calendar and the battery, right on the wallpaper ----------
  NX.deskWidgetKinds = { clock: "Clock", weather: "Weather", events: "Up next", battery: "Battery" };
  function deskWidgets() {
    const on = NX.me ? (NX.prefs().deskWidgets || []).filter((k) => NX.deskWidgetKinds[k]) : [];
    let box = document.getElementById("nx-dwidgets");
    if (!on.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "nx-dwidgets"; const ic = document.getElementById("icons"); (ic ? ic.parentNode : document.getElementById("desktop")).insertBefore(box, ic ? ic.nextSibling : null); }
    const d = new Date(), html = on.map((k) => {
      if (k === "clock") return `<section class="dw dw-clock" data-dw="clock"><b>${NX.esc(NX.fmtTime(d))}</b><span>${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></section>`;
      if (k === "weather") { const w = NX.data("wx", null), p = NX.data("wx-place", null); return `<section class="dw dw-wx" data-dw="weather">${w && p && NX.wxInfo ? `${NX.wxInfo.icon(w.code, 46)}<div><b>${w.now}°${w.unit}</b><span>${NX.esc(NX.wxInfo.name(w.code))}</span><small>${NX.esc(p.name)}</small></div>` : `<div><b>Weather</b><small>Pick your city in Widgets or the Weather app.</small></div>`}</section>`; }
      if (k === "events") { const key = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"), today = key(d), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        const next = NX.data("events", []).filter((e) => e.date > today || (e.date === today && (!e.time || e.time >= hm))).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 3);
        return `<section class="dw dw-ev" data-dw="events"><h4>Up next</h4>${next.length ? next.map((e) => `<div><i style="background:${e.color || "#7c5cff"}"></i><span><b>${NX.esc(e.title)}</b><small>${e.date === today ? "Today" : new Date(e.date + "T12:00").toLocaleDateString(undefined, Object.assign({ weekday: "short", month: "short", day: "numeric" }, e.date.slice(0, 4) !== String(d.getFullYear()) ? { year: "numeric" } : {}))}${e.time ? " · " + NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : ""}</small></span></div>`).join("") : `<small>Nothing planned. Add events in Calendar.</small>`}</section>`; }
      if (k === "battery") { const b = NX.batt && NX.batt(); return `<section class="dw dw-bt" data-dw="battery">${b ? `${NX.battIcon(40)}<div><b>${b.percent}%</b><small>${b.charging ? "Charging" : (NX.battLeft && NX.battLeft()) || "On battery"}</small></div>` : `<div><b>Battery</b><small>No battery on this computer.</small></div>`}</section>`; }
      return "";
    }).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  NX.deskWidgets = deskWidgets;
  document.addEventListener("click", (e) => { const w = e.target.closest && e.target.closest("#nx-dwidgets [data-dw]"); if (!w) return; const k = w.dataset.dw; NX.open(k === "clock" ? "clock" : k === "weather" ? "weather" : k === "events" ? "calendar" : "settings", k === "battery" ? { page: "system" } : undefined); });
  document.addEventListener("nx:prefs", () => setTimeout(deskWidgets, 30)); setInterval(deskWidgets, 15000); setTimeout(deskWidgets, 1500);

  // ---------- Nebulux + Shift + S: take the screen, then drag over the part you want (Esc keeps all of it) ----------
  NX.snipArea = async () => {
    if (document.getElementById("nx-snip")) return; if (NX.shell) NX.shell.closeFlyouts();
    let r; try { r = await take(true); } catch (e) { NX.toast(e.message); return; }
    const url = await NX.fs.url(r.path).catch(() => null); if (!url) { shotThumb(r); return; }
    const o = document.createElement("div"); o.id = "nx-snip"; o.innerHTML = `<img alt="" draggable="false"><div class="sa-box" hidden></div><p class="sa-tip">Drag over the part you want. Esc keeps the whole screen.</p>`; document.body.appendChild(o);
    const img = o.querySelector("img"), box = o.querySelector(".sa-box"); img.src = url; await img.decode().catch(() => {});
    let a = null, sel = null; const done = () => { removeEventListener("keydown", key, true); o.remove(); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(); shotThumb(r); } };
    addEventListener("keydown", key, true);
    const at = (e) => { const b = img.getBoundingClientRect(); return [Math.max(0, Math.min(b.width, e.clientX - b.left)), Math.max(0, Math.min(b.height, e.clientY - b.top)), b]; };
    o.onpointerdown = (e) => { e.preventDefault(); o.setPointerCapture(e.pointerId); a = at(e); };
    o.onpointermove = (e) => { if (!a) return; const p = at(e), b = a[2]; sel = { x: Math.min(a[0], p[0]), y: Math.min(a[1], p[1]), w: Math.abs(p[0] - a[0]), h: Math.abs(p[1] - a[1]), bw: b.width, bh: b.height };
      box.hidden = false; box.style.left = b.left + sel.x + "px"; box.style.top = b.top + sel.y + "px"; box.style.width = sel.w + "px"; box.style.height = sel.h + "px"; };
    o.onpointerup = async () => { a = null; if (!sel || sel.w < 6 || sel.h < 6) { sel = null; box.hidden = true; return; }
      const kx = img.naturalWidth / sel.bw, ky = img.naturalHeight / sel.bh, c = document.createElement("canvas"); c.width = Math.round(sel.w * kx); c.height = Math.round(sel.h * ky);
      c.getContext("2d").drawImage(img, sel.x * kx, sel.y * ky, c.width, c.height, 0, 0, c.width, c.height); done();
      try { const blob = await new Promise((ok) => c.toBlob(ok, "image/png")), out = await NX.fs.upload(NX.fs.parent(r.path), NX.fs.base(r.path).replace(/\.png$/i, "") + " (part).png", blob); NX.filesChanged && NX.filesChanged(); shotThumb(out); } catch (er) { NX.toast(er.message); shotThumb(r); } };
    NX.snipTest = { select: (x, y, w, h) => { const b = img.getBoundingClientRect(); sel = { x, y, w, h, bw: b.width, bh: b.height }; return o.onpointerup(); } };
  };

  // ---------- after a screenshot, a small picture of it floats in the corner for 6 seconds: click it to open it in Photos ----------
  const take = NX.screenshot || (async () => { throw new Error("Screenshots aren't available here."); });
  if (NX.screenshot) {
    NX.screenshot = async (quiet) => { const r = await take(true); if (!quiet && r && r.path) shotThumb(r); else if (!quiet) NX.toast("Screenshot saved."); return r; };
  }
  async function shotThumb(r) {
    let el = document.getElementById("nx-shot"); if (el) el.remove();
    el = document.createElement("button"); el.id = "nx-shot"; el.setAttribute("aria-label", "Screenshot saved. Open it in Photos"); el.title = "Saved in Pictures. Click to open it";
    el.innerHTML = `<img alt=""><span>Screenshot saved</span>`; document.body.appendChild(el);
    try { el.querySelector("img").src = await NX.fs.url(r.path); } catch (e) { /* the text is enough */ }
    const t = setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 6000);
    el.onclick = () => { clearTimeout(t); el.remove(); NX.open("photos", { path: r.path }); };
  }

  // ---------- auto-hide the taskbar: it slides away, and comes back when the pointer touches the bottom of the screen ----------
  let tbHideT = 0;
  const flyoutOpen = () => ["start", "qs", "cal", "widgets", "clip", "ctx", "snapfly"].some((id) => { const e = document.getElementById(id); return e && !e.hidden; });
  const tbAutoApply = () => { const d = document.getElementById("desktop"); if (!d) return; const on = !!(NX.me && NX.prefs().tbAuto); if (d.classList.contains("tb-auto") !== on) { d.classList.toggle("tb-auto", on); d.classList.remove("tb-show"); dispatchEvent(new Event("resize")); } };
  NX.tbAutoApply = tbAutoApply;
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "tbAuto") tbAutoApply(); }); setInterval(tbAutoApply, 2000); setTimeout(tbAutoApply, 800);
  addEventListener("pointermove", (e) => {
    const d = document.getElementById("desktop"); if (!d || !d.classList.contains("tb-auto")) return;
    const tb = document.getElementById("taskbar"), over = e.clientY >= innerHeight - 3 || (tb && d.classList.contains("tb-show") && e.clientY >= tb.getBoundingClientRect().top - 6);
    if (over) { clearTimeout(tbHideT); d.classList.add("tb-show"); }
    else if (d.classList.contains("tb-show")) { clearTimeout(tbHideT); tbHideT = setTimeout(() => { if (!flyoutOpen()) d.classList.remove("tb-show"); }, 700); }
  }, { passive: true });
  // the Nebulux key (Start) and other flyouts bring it up too
  new MutationObserver(() => { const d = document.getElementById("desktop"); if (d && d.classList.contains("tb-auto") && flyoutOpen()) d.classList.add("tb-show"); }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["hidden"] });

  // ---------- Stage: only the window you're using stays out; your other windows wait as cards on the left (Settings > Personalization) ----------
  let stageOrder = [];
  const stageOn = () => !!(NX.me && NX.prefs().stage);
  const deskOf = (w) => !w.desk || !NX.desks || w.desk === NX.desks.current();
  function stageDraw() {
    const d = document.getElementById("desktop"); if (!d) return;
    const on = stageOn(); if (d.classList.contains("stage") !== on) { d.classList.toggle("stage", on); dispatchEvent(new Event("resize")); }
    let box = document.getElementById("nx-stage");
    const top = NX.topWin && NX.topWin(), others = on ? stageOrder.filter((id) => NX.wins.has(id) && deskOf(NX.wins.get(id)) && (!top || id !== top.id)).slice(0, 6) : [];
    if (!on) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "nx-stage"; box.setAttribute("aria-label", "Your other windows"); (document.getElementById("windows") || d).parentNode.insertBefore(box, document.getElementById("taskbar")); }
    const html = others.map((id) => { const a = NX.apps[id] || {}, w = NX.wins.get(id), t = (w && w.el.querySelector(".wt-name") || {}).textContent || a.name; return `<button class="stg-card" data-stage="${id}" title="${NX.esc(t)}">${NX.icon(a.icon || id, 36)}<span>${NX.esc(t)}</span></button>`; }).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  NX.stageDraw = stageDraw;
  if (NX.focus) {
    const focus0 = NX.focus;
    NX.focus = (id) => { focus0(id); stageOrder = [id, ...stageOrder.filter((x) => x !== id)];
      if (stageOn()) { for (const w of NX.wins.values()) if (w.id !== id && !w.min && deskOf(w) && !w.onTop) NX.minimize(w.id); } stageDraw(); };
  }
  if (NX.close) { const close0 = NX.close; NX.close = (id) => { const r = close0(id); stageOrder = stageOrder.filter((x) => x !== id); setTimeout(stageDraw, 50); return r; }; }
  document.addEventListener("click", (e) => { const c = e.target.closest && e.target.closest("[data-stage]"); if (c) NX.focus(c.dataset.stage); });
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "stage") { stageDraw(); const t = NX.topWin && NX.topWin(); if (stageOn() && t) NX.focus(t.id); } });
  setInterval(stageDraw, 2000);

  // ---------- "Caps Lock is on" under any password box you're typing in ----------
  const capsCheck = (e) => { const t = e.target; if (!t || t.tagName !== "INPUT" || t.type !== "password" || !e.getModifierState) return; const on = e.getModifierState("CapsLock");
    let h = t.nextElementSibling && t.nextElementSibling.classList && t.nextElementSibling.classList.contains("nx-caps") ? t.nextElementSibling : null;
    if (on && !h) { h = document.createElement("small"); h.className = "nx-caps"; h.setAttribute("role", "status"); h.textContent = "Caps Lock is on"; t.after(h); } else if (!on && h) h.remove(); };
  addEventListener("keydown", capsCheck, true); addEventListener("keyup", capsCheck, true);
  addEventListener("focusout", (e) => { const n = e.target && e.target.nextElementSibling; if (n && n.classList && n.classList.contains("nx-caps")) n.remove(); }, true);

  // ---------- keys: Nebulux + Space (Quick Search) and Nebulux + G (App Grid); on the USB they come from the window manager ----------
  addEventListener("keydown", (e) => {
    const win = e.metaKey || (e.getModifierState && e.getModifierState("OS"));
    if (win && e.key === " ") { e.preventDefault(); NX.quickSearch(); }
    else if (win && /^g$/i.test(e.key)) { e.preventDefault(); NX.appGrid(); }
    else if (win && (e.key === "+" || e.key === "=")) { e.preventDefault(); NX.magnifier.zoom(1); }
    else if (win && (e.key === "-" || e.key === "_")) { e.preventDefault(); NX.magnifier.zoom(-1); }
    else if (win && e.key === "Escape" && NX.magnifier.level() > 1) { e.preventDefault(); NX.magnifier.zoom(0); }
    else if (e.key === "Escape" && $("#nx-grid")) $("#nx-grid").remove();
  });
  const closeTop = () => { const t = NX.topWin && NX.topWin(); if (t) NX.close(t.id); };
  addEventListener("keydown", (e) => { if (e.altKey && e.key === "F4" && NX.me) { e.preventDefault(); closeTop(); } });
  document.addEventListener("nx:key", (e) => { if (e.detail === "close") closeTop(); if (e.detail === "search") NX.quickSearch(); if (e.detail === "grid") NX.appGrid(); if (/^zoom-/.test(e.detail) && NX.shell) NX.shell.closeFlyouts(); if (e.detail === "zoom-in") NX.magnifier.zoom(1); if (e.detail === "zoom-out") NX.magnifier.zoom(-1); if (e.detail === "zoom-off") NX.magnifier.zoom(0); });

  // ---------- hot corners: push the pointer into a corner to do something (Settings > Personalization) ----------
  NX.cornerActions = { none: ["Nothing", null], desktop: ["Show the desktop", () => NX.showDesktop && NX.showDesktop()], tview: ["Task View", () => NX.taskView && NX.taskView()], grid: ["App Grid", () => NX.appGrid()], search: ["Quick Search", () => NX.quickSearch()], lock: ["Lock", () => NX.shell && NX.shell.lockKeep && NX.shell.lockKeep()], start: ["Start", () => NX.shell && NX.shell.toggleStart && NX.shell.toggleStart()], note: ["New sticky note", () => { const L = NX.data("sticky-notes", []); L.unshift({ id: NX.uid(), t: "", c: "sun", at: Date.now(), pin: true }); NX.setData("sticky-notes", L); if (NX.deskNotes) NX.deskNotes(); setTimeout(() => { const t = document.querySelector("#nx-dnotes .dn-note textarea"); if (t) t.focus(); }, 60); }] };
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
