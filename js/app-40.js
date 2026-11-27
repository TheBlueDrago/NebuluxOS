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
      if (!q) { // nothing typed yet: your recent apps and files, like Spotlight and Windows search
        const P = NX.prefs(), recA = (P.recent || []).filter((id) => NX.apps[id]).slice(0, 5), recF = P.showrecent === false ? [] : NX.data("recent-files", []).slice(0, 4);
        recA.forEach((id, k) => items.push({ head: k ? "" : "Recent apps", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "App", go: () => NX.open(id) }));
        recF.forEach((f, k) => items.push({ head: k ? "" : "Recent files", icon: NX.icon(FI[f.kind] || "file", 30), name: f.name, sub: "Opened " + new Date(f.at).toLocaleDateString([], { month: "short", day: "numeric" }), go: () => NX.openFile(f) }));
        paint(); return;
      }
      // a sum
      if (/[\d)]/.test(q) && /[-+*/^×÷%!()]|sqrt|sin|cos|tan|log|ln/.test(q) && NX.calcEval) { try { const v = NX.calcEval(q, true); if (isFinite(v)) { const r = String(+v.toPrecision(12)); items.push({ head: "Answer", icon: NX.icon("calculator", 30), name: "= " + r, sub: "Press Enter to copy it", go: () => { navigator.clipboard && navigator.clipboard.writeText(r).catch(() => {}); if (NX.clip) NX.clip.add(r); NX.toast("Copied " + r + "."); } }); } } catch (e) { /* not a sum */ } }
      const cv = NX.qsConvert(q); if (cv) items.push({ head: "Answer", icon: NX.icon("calculator", 30), name: cv.text, sub: "Press Enter to copy it", go: () => { const r = String(cv.value); navigator.clipboard && navigator.clipboard.writeText(r).catch(() => {}); if (NX.clip) NX.clip.add(r); NX.toast("Copied " + r + "."); } });
      if (/^weather\b|^forecast\b/i.test(q)) { const w = NX.data("wx", null), p = NX.data("wx-place", null); items.push({ head: "Weather", icon: w && NX.wxInfo ? NX.wxInfo.icon(w.code, 30) : NX.icon("weather", 30), name: w && p && NX.wxInfo ? w.now + "°" + w.unit + ", " + NX.wxInfo.name(w.code) + " in " + p.name : "See the weather", sub: "Opens Weather", go: () => NX.open("weather") }); }
      const apps = visible().filter((id) => NX.apps[id].name.toLowerCase().includes(ql)).sort((a, b) => NX.apps[a].name.toLowerCase().indexOf(ql) - NX.apps[b].name.toLowerCase().indexOf(ql)).slice(0, 5);
      apps.forEach((id, k) => items.push({ head: k ? "" : "Apps", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "App", go: () => NX.open(id) }));
      // apps from the Nebulux Store you don't have yet
      const vis = new Set(visible()), store = Object.keys(NX.apps).filter((id) => !vis.has(id) && !NX.apps[id].builtIn && NX.apps[id].name.toLowerCase().includes(ql)).slice(0, apps.length ? 2 : 4);
      store.forEach((id, k) => items.push({ head: k ? "" : "In the Nebulux Store", icon: NX.icon(NX.apps[id].icon || id, 30), name: NX.apps[id].name, sub: "Get it from the Nebulux Store", go: () => NX.open("store", { app: id }) }));
      const pages = (NX.settingsPages || []).filter((pg) => pg.id !== "home" && (pg.name.toLowerCase().includes(ql) || ((NX.settingsWords || {})[pg.id] || "").includes(ql) || (pg.keys || "").includes(ql))).slice(0, 3);
      pages.forEach((pg, k) => items.push({ head: k ? "" : "Settings", icon: NX.icon(pg.icon, 30), name: pg.name, sub: "Settings", go: () => NX.open("settings", { page: pg.id, find: ql }) }));
      const evs = NX.data("events", []).filter((e) => e.title.toLowerCase().includes(ql)).slice(0, 3), tds = NX.data("todos", []).filter((t) => !t.done && t.text.toLowerCase().includes(ql)).slice(0, 3);
      evs.forEach((e, k) => items.push({ head: k ? "" : "Calendar", icon: NX.icon("calendar", 30), name: e.title, sub: new Date(e.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + (e.time ? ", " + NX.fmtTime(new Date(e.date + "T" + e.time)) : ""), go: () => NX.open("calendar") }));
      tds.forEach((t, k) => items.push({ head: k ? "" : "Reminders", icon: NX.icon("reminders", 30), name: t.text, sub: t.due ? new Date(t.due).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Reminder", go: () => NX.open("reminders") }));
      const web = { head: "The web", icon: NX.icon("google", 30), name: "Search Google for “" + q + "”", sub: "Opens Google", go: () => NX.open("google", { q }) };
      items.push(web); paint();
      // "time in Tokyo": the time in another city, from the computer's own list of time zones (no internet needed)
      const tm = /^(?:what\s+)?time\s+(?:is\s+it\s+)?in\s+([a-z .'-]{2,40})\??$/i.exec(q);
      if (tm && Intl.supportedValuesOf) {
        const city = tm[1].trim().toLowerCase().replace(/\s+/g, "_");
        const zone = Intl.supportedValuesOf("timeZone").find((z) => z.toLowerCase().split("/").pop() === city);
        if (zone) { const now = new Date(), nice = zone.split("/").pop().replace(/_/g, " ");
          const t = now.toLocaleTimeString([], { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: !NX.prefs().clock24 }), day = now.toLocaleDateString([], { timeZone: zone, weekday: "long" });
          items.unshift({ head: "Time", icon: NX.icon("clock", 30), name: t + " in " + nice, sub: day + ". Press Enter to add it to your world clocks.", go: () => { const L = NX.data("world-clocks", []); if (!L.includes(zone)) NX.setData("world-clocks", [...L, zone].slice(-8)); NX.toast(nice + " is in your world clocks."); } }); at = 0; paint(); }
      }
      // money: "20 usd in eur", "$15 to euros" (daily rates, looked up only when you type a currency)
      const CUR = { usd: "USD", dollar: "USD", dollars: "USD", "$": "USD", eur: "EUR", euro: "EUR", euros: "EUR", gbp: "GBP", pound: "GBP", pounds: "GBP", jpy: "JPY", yen: "JPY", cad: "CAD", aud: "AUD", mxn: "MXN", pesos: "MXN", inr: "INR", rupees: "INR", cny: "CNY", yuan: "CNY", krw: "KRW", won: "KRW", chf: "CHF", brl: "BRL", php: "PHP" };
      const mm = /^(\$)?\s*([\d.,]+)\s*([a-z$]+)?\s+(?:in|to)\s+([a-z]+)$/i.exec(q);
      const from = mm && (CUR[(mm[3] || mm[1] || "").toLowerCase()]), to = mm && CUR[mm[4].toLowerCase()], amt = mm && parseFloat(mm[2].replace(/,/g, ""));
      if (from && to && from !== to && isFinite(amt) && NX.netOK && NX.netOK()) {
        const rates = NX.data("fx-rates", null), fresh = rates && rates.base === from && Date.now() - rates.at < 6 * 3600000;
        (fresh ? Promise.resolve(rates) : fetch("https://open.er-api.com/v6/latest/" + from).then((r) => r.json()).then((j) => { if (j.result !== "success") throw 0; const v = { base: from, at: Date.now(), r: j.rates }; NX.setData("fx-rates", v); return v; })).then((v) => {
          const rate = v.r[to]; if (!rate || gen !== qsGen || !document.body.contains(o)) return;
          const out = amt * rate, txt = out.toLocaleString(undefined, { style: "currency", currency: to });
          items.unshift({ head: "Money", icon: NX.icon("calculator", 30), name: amt.toLocaleString(undefined, { style: "currency", currency: from }) + " = " + txt, sub: "Today's rate. Press Enter to copy it.", go: () => { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); NX.toast("Copied " + txt + "."); } });
          at = 0; paint();
        }).catch(() => {});
      }
      // "define a word": its meaning from a free dictionary (only looked up when you type "define")
      const dm = /^define\s+([a-z][a-z' -]{1,40})$/i.exec(q);
      if (dm && NX.netOK && NX.netOK()) {
        const word = dm[1].trim();
        fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word)).then((r) => (r.ok ? r.json() : null)).then((j) => {
          const m = j && j[0] && j[0].meanings && j[0].meanings[0], def = m && m.definitions && m.definitions[0] && m.definitions[0].definition;
          if (!def || gen !== qsGen || !document.body.contains(o)) return;
          items.unshift({ head: "Dictionary", icon: NX.icon("info", 30), name: word + (m.partOfSpeech ? " (" + m.partOfSpeech + ")" : ""), sub: def.length > 160 ? def.slice(0, 157) + "..." : def, go: () => { navigator.clipboard && navigator.clipboard.writeText(def).catch(() => {}); NX.toast("The meaning is copied."); } });
          at = 0; paint();
        }).catch(() => {});
      }
      if (ql.length < 2 || !NX.fs) return;
      let found = []; try { const pl = await NX.fs.places(); for (const f of pl.folders) { const r = await NX.fs.list(f.path).catch(() => null); if (r) found.push(...r.entries.filter((e) => e.name.toLowerCase().includes(ql)).map((e) => Object.assign({ where: f.name }, e))); if (found.length > 12) break; } } catch (e) { return; }
      if (gen !== qsGen || !document.body.contains(o)) return;
      if (found.length) { const fi = found.slice(0, 5).map((e, k) => ({ head: k ? "" : "Files", icon: NX.icon(FI[e.kind] || "file", 30), name: e.name, sub: e.where, go: () => (e.dir ? NX.open("files", { path: e.path }) : NX.openFile(e)) }));
        items.splice(items.indexOf(web), 0, ...fi); paint(); }
      // words inside your text files (3 letters or more)
      if (ql.length >= 3 && NX.fs.searchText) {
        const hits = await NX.fs.searchText(q).catch(() => []);
        if (gen !== qsGen || !hits.length || !document.body.contains(o)) return;
        const seen = new Set(found.map((e) => e.path));
        const ci = hits.filter((h) => !seen.has(h.path)).slice(0, 4).map((h, k) => ({ head: k ? "" : "Inside your files", icon: NX.icon("ftext", 30), name: h.name, sub: "..." + h.snippet + "...", go: () => NX.openFile({ name: h.name, path: h.path, kind: "text" }) }));
        if (ci.length) { items.splice(items.indexOf(web), 0, ...ci); paint(); }
      }
    };
    inp.oninput = run; run();
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
      // Week view (4.4): the week around the day you picked, hour by hour, like Windows and macOS
      let view = NX.data("ca-view", "month") === "week" ? "week" : "month";
      const weekStart = () => { const d = new Date(sel + "T12:00"); d.setDate(d.getDate() - d.getDay()); return d; };
      const weekTitle = () => { const a = weekStart(), b = new Date(a); b.setDate(a.getDate() + 6); const mo = (d) => d.toLocaleDateString(undefined, { month: "long" }); return mo(a) + " " + a.getDate() + " to " + (a.getMonth() === b.getMonth() ? "" : mo(b) + " ") + b.getDate() + ", " + b.getFullYear(); };
      const HH = 44;
      const weekGrid = (ev, today) => {
        const a = weekStart(), days = [...Array(7)].map((_, k) => { const d = new Date(a); d.setDate(a.getDate() + k); return d; });
        const head = days.map((d) => { const kk = key(d); return `<button class="cw-dh ${kk === today ? "today" : ""} ${kk === sel ? "sel" : ""}" data-day="${kk}"><small>${d.toLocaleDateString(undefined, { weekday: "short" })}</small><b>${d.getDate()}</b></button>`; }).join("");
        const allDay = days.map((d) => { const kk = key(d); return `<div class="cw-ad">${ev.filter((e) => e.date === kk && !e.time).map((e) => `<i style="--c:${e.color || COLS[0]}" title="${NX.esc(e.title)}">${NX.esc(e.title)}</i>`).join("")}</div>`; }).join("");
        const hours = [...Array(24)].map((_, h) => `<span class="cw-h" style="top:${h * HH}px">${h ? NX.fmtTime(new Date(2000, 0, 1, h)).replace(":00", "") : ""}</span>`).join("");
        const cols = days.map((d) => { const kk = key(d), now = new Date(); const nowLine = kk === today ? `<i class="cw-now" style="top:${(now.getHours() + now.getMinutes() / 60) * HH}px"></i>` : "";
          return `<div class="cw-col ${kk === today ? "today" : ""}" data-wday="${kk}">${[...Array(24)].map((_, h) => `<button class="cw-slot" data-slot="${kk}|${h}" aria-label="${d.toDateString()}, ${h}:00" tabindex="-1"></button>`).join("")}${ev.filter((e) => e.date === kk && e.time).map((e) => { const [hh, mm] = e.time.split(":").map(Number); return `<div class="cw-e" style="top:${(hh + mm / 60) * HH}px;--c:${e.color || COLS[0]}" title="${NX.esc(e.title)}"><b>${NX.esc(e.title)}</b><small>${NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time)))}</small></div>`; }).join("")}${nowLine}</div>`; }).join("");
        return `<div class="cw"><div class="cw-top"><span></span>${head}</div><div class="cw-adrow"><span>All day</span>${allDay}</div><div class="cw-body"><div class="cw-inner" style="height:${24 * HH}px"><div class="cw-hours">${hours}</div>${cols}</div></div></div>`;
      };
      const draw = () => {
        const ev = NX.calEvents ? NX.calEvents() : NX.data("events", []), today = key(new Date()), first = new Date(m), start = new Date(first); start.setDate(1 - first.getDay());
        let cells = ""; for (let k = 0; k < 42; k++) { const d = new Date(start); d.setDate(start.getDate() + k); const kk = key(d), es = ev.filter((e) => e.date === kk).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
          cells += `<button class="ca-d ${d.getMonth() !== m.getMonth() ? "out" : ""} ${kk === today ? "today" : ""} ${kk === sel ? "sel" : ""}" data-day="${kk}" aria-label="${d.toDateString()}${es.length ? ", " + es.length + " events" : ""}"><span class="ca-n">${d.getDate()}</span>${es.slice(0, 3).map((e) => `<i style="--c:${e.color || COLS[0]}" title="${e.time ? NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) + " " : ""}${NX.esc(e.title)}">${NX.esc(e.title)}</i>`).join("")}${es.length > 3 ? `<small>+${es.length - 3} more</small>` : ""}</button>`; }
        const sd = new Date(sel + "T12:00"), list = ev.filter((e) => e.date === sel).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        body.innerHTML = `<div class="ca-main"><div class="ca-head"><h2>${view === "week" ? weekTitle() : m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><span class="ca-sp"></span><div class="seg ca-vw" role="tablist" aria-label="View">${[["month", "Month"], ["week", "Week"]].map(([v, t]) => `<button role="tab" aria-selected="${view === v}" class="${view === v ? "on" : ""}" data-vw="${v}">${t}</button>`).join("")}</div><button class="btn" data-ca="today">Today</button><button class="btn" data-ca="-1" aria-label="${view === "week" ? "Last week" : "Last month"}">${NX.icon("back", 14)}</button><button class="btn" data-ca="1" aria-label="${view === "week" ? "Next week" : "Next month"}">${NX.icon("fwd", 14)}</button></div>
          ${view === "week" ? weekGrid(ev, today) : `<div class="ca-wd">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => `<span>${x}</span>`).join("")}</div><div class="ca-grid">${cells}</div>`}</div>
          <aside class="ca-side"><h3>${sel === today ? "Today" : sd.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
          <div class="ca-list">${list.length ? list.map((e) => `<div class="ca-e" style="--c:${e.color || COLS[0]}"><span><b>${NX.esc(e.title)}</b><small>${e.time ? NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : "All day"}${e.repeat ? " · " + ({ week: "Every week", month: "Every month", year: "Every year" }[e.repeat] || "") : ""}</small></span>${e.holiday ? "" : `<button class="btn sm" data-del="${e.id}" aria-label="Delete ${NX.esc(e.title)}">${NX.icon("trash", 12)}</button>`}</div>`).join("") : `<p class="ca-none">Nothing planned.</p>`}</div>${(() => { const up = ev.filter((e) => e.date > sel).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 5); return up.length ? `<h4 class="ca-uph">Coming up</h4><div class="ca-up">${up.map((e) => `<button class="ca-upi" data-day="${e.date}" style="--c:${e.color || COLS[0]}"><i></i><span><b>${NX.esc(e.title)}</b><small>${new Date(e.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}${e.time ? ", " + NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : ""}</small></span></button>`).join("")}</div>` : ""; })()}
          <form class="ca-add"><input name="n" maxlength="60" placeholder="Add an event" aria-label="Event name" required><input name="t" type="time" aria-label="Time (optional)"><select name="r" class="s-sel" aria-label="Repeat"><option value="">Doesn't repeat</option><option value="week">Every week</option><option value="month">Every month</option><option value="year">Every year</option></select><div class="ca-cols">${COLS.map((c, k) => `<label><input type="radio" name="c" value="${c}" ${k ? "" : "checked"}><i style="background:${c}" aria-label="Color ${c}"></i></label>`).join("")}</div><button class="btn primary" type="submit">Add</button><p class="ca-tip">You get a reminder when an event with a time starts.</p></form></aside>`;
        body.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { sel = b.dataset.day; const d = new Date(sel + "T12:00"); if (d.getMonth() !== m.getMonth()) m = new Date(d.getFullYear(), d.getMonth(), 1); draw(); }));
        body.querySelectorAll("[data-ca]").forEach((b) => (b.onclick = () => { const a = b.dataset.ca; if (a === "today") { const t = new Date(); m = new Date(t.getFullYear(), t.getMonth(), 1); sel = key(t); } else if (view === "week") { const d = new Date(sel + "T12:00"); d.setDate(d.getDate() + 7 * +a); sel = key(d); m = new Date(d.getFullYear(), d.getMonth(), 1); } else m = new Date(m.getFullYear(), m.getMonth() + +a, 1); draw(); }));
        body.querySelectorAll("[data-vw]").forEach((b) => (b.onclick = () => { view = b.dataset.vw; NX.setData("ca-view", view); draw(); }));
        // Week view: click an hour to add an event then; it starts scrolled to the morning (or to now)
        body.querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => { const [d, h] = b.dataset.slot.split("|"); sel = d; draw(); const f2 = $(".ca-add", body); if (f2) { f2.t.value = String(h).padStart(2, "0") + ":00"; f2.n.focus(); } }));
        { const wb = $(".cw-body", body); if (wb) { const n = new Date(); wb.scrollTop = Math.max(0, (sel === key(n) ? n.getHours() - 2 : 7) * HH); } }
        body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { NX.setData("events", NX.data("events", []).filter((x) => x.id !== b.dataset.del)); draw(); }));
        const f = $(".ca-add", body); f.onsubmit = (e) => { e.preventDefault(); const L = NX.data("events", []); if (L.length >= 300) { NX.toast("That's a lot of events. Delete some old ones first."); return; }
          L.push({ id: NX.uid(), date: sel, time: /^\d\d:\d\d$/.test(f.t.value) ? f.t.value : "", title: f.n.value.trim().slice(0, 60), told: "", repeat: ["week", "month", "year"].includes(f.r.value) ? f.r.value : "", color: (f.querySelector("[name=c]:checked") || {}).value || COLS[0] }); NX.setData("events", L); draw(); const n2 = $(".ca-add [name=n]", body); if (n2) n2.focus(); };
      };
      draw();
    } };

  // ---------- Reminders: things to do, with a day and time if you like; it rings when one is due (also with the app closed) ----------
  const todos = () => NX.data("todos", []), saveTodos = (L) => { NX.setData("todos", L); document.dispatchEvent(new CustomEvent("nx:todos")); };
  NX.todosTick = (now) => {
    if (!NX.me) return; const d = now || new Date(), stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    let ch = false; const L = todos(); for (const t of L) if (!t.done && !t.rang && t.due && t.due <= stamp) { t.rang = 1; ch = true; if (NX.alarms && NX.alarms.ring) NX.alarms.ring({ name: "Reminder: " + t.text, snooze: false }, d); }
    if (ch) saveTodos(L);
  };
  setInterval(() => NX.todosTick(), 15000);
  // the next time a repeating reminder is due (moved past now, keeping the same time of day)
  NX.nextDue = (t) => {
    const d = new Date(t.due), now = new Date(); let n = 0;
    do { if (t.repeat === "day") d.setDate(d.getDate() + 1); else if (t.repeat === "week") d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1); } while (d <= now && ++n < 1000);
    const z = (x) => String(x).padStart(2, "0"); return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + (t.due.length > 10 ? "T" + z(d.getHours()) + ":" + z(d.getMinutes()) : "");
  };
  NX.apps.reminders = { name: "Reminders", icon: "reminders", builtIn: true, category: "Productivity", w: 560, h: 620, minW: 340, minH: 420, desc: "Things to do, with reminders when they're due.",
    open(body) {
      body.classList.add("rm"); let showDone = false;
      const draw = () => {
        const L = todos(), open = L.filter((t) => !t.done), done = L.filter((t) => t.done), now = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })();
        const when = (t) => { if (!t.due) return ""; const d = new Date(t.due), today = new Date().toDateString() === d.toDateString(); return (today ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })) + (t.due.length > 10 ? ", " + NX.fmtTime(d) : ""); };
        const item = (t) => `<div class="rm-it ${t.done ? "done" : ""} ${!t.done && t.due && t.due < now ? "late" : ""}" data-id="${t.id}"><label class="rm-ck"><input type="checkbox" ${t.done ? "checked" : ""} aria-label="Done"><i></i></label><span><b>${NX.esc(t.text)}</b>${t.due ? `<small>${NX.esc(when(t))}${t.repeat ? " · " + ({ day: "Every day", week: "Every week", month: "Every month" }[t.repeat] || "") : ""}</small>` : ""}</span><button class="rm-del" aria-label="Delete" title="Delete">${NX.icon("close", 12)}</button></div>`;
        body.innerHTML = `<div class="rm-head"><h2>Reminders</h2><span>${open.length ? open.length + " to do" : "All done"}</span></div>
          <form class="rm-add"><input name="t" maxlength="120" placeholder="Add a reminder" aria-label="Add a reminder" required><input name="d" type="datetime-local" aria-label="When (optional)"><select name="r" class="s-sel" aria-label="Repeat"><option value="">Once</option><option value="day">Every day</option><option value="week">Every week</option><option value="month">Every month</option></select><button class="btn primary" type="submit">Add</button></form>
          <div class="rm-list">${open.length ? open.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).map(item).join("") : `<div class="rm-none big">${NX.icon("reminders", 64)}<b>All clear</b><p>Nothing to do. Type a reminder above, and pick a time if you want a nudge.</p></div>`}</div>
          ${done.length ? `<button class="rm-show" type="button">${showDone ? "Hide" : "Show"} ${done.length} done</button>${showDone ? `<div class="rm-list">${done.map(item).join("")}</div><button class="btn sm rm-clear" type="button">Clear done</button>` : ""}` : ""}`;
        const f = $(".rm-add", body); f.onsubmit = (e) => { e.preventDefault(); const L2 = todos(); L2.push({ id: NX.uid(), text: f.t.value.trim().slice(0, 120), due: f.d.value || "", done: false, repeat: f.d.value && ["day", "week", "month"].includes(f.r.value) ? f.r.value : "" }); saveTodos(L2); draw(); const n = $(".rm-add [name=t]", body); if (n) n.focus(); };
        body.querySelectorAll(".rm-it").forEach((el) => { const id = el.dataset.id;
          // a repeating reminder that gets checked off moves on to its next time instead of being done
          el.querySelector("input").onchange = (e) => { saveTodos(todos().map((t) => (t.id !== id ? t : e.target.checked && t.repeat && t.due ? Object.assign({}, t, { due: NX.nextDue(t), rang: 0 }) : Object.assign({}, t, { done: e.target.checked })))); setTimeout(draw, e.target.checked ? 250 : 0); };
          el.querySelector(".rm-del").onclick = () => { saveTodos(todos().filter((t) => t.id !== id)); draw(); }; });
        const sh = $(".rm-show", body); if (sh) sh.onclick = () => { showDone = !showDone; draw(); };
        const cl = $(".rm-clear", body); if (cl) cl.onclick = () => { saveTodos(todos().filter((t) => !t.done)); draw(); };
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
  NX.deskWidgetKinds = { clock: "Clock", weather: "Weather", events: "Up next", todos: "Reminders", photo: "Photos", battery: "Battery" };
  // the Photos widget: your newest picture in Pictures (looked up once a minute, so the widget doesn't blink)
  let dwPhoto = null, dwPhotoAt = 0;
  const dwPhotoLoad = async () => { if (Date.now() - dwPhotoAt < 60000) return; dwPhotoAt = Date.now(); try { const e = ((await NX.fs.list(await NX.folder("Pictures"))).entries || []).filter((x) => x.kind === "image").sort((a, b) => (b.mtime || 0) - (a.mtime || 0))[0]; const was = dwPhoto && dwPhoto.path; dwPhoto = e ? { path: e.path, name: e.name, url: await NX.fs.url(e.path) } : null; if ((dwPhoto && dwPhoto.path) !== was && NX.deskWidgets) NX.deskWidgets(); } catch (er) { /* none */ } };
  // one desktop widget's card (also used by the Widgets panel)
  NX.dwHTML = (k) => {
    const d = new Date();
      if (k === "clock") { const wc = NX.data("world-clocks", []).slice(0, 3).map((z) => { try { return `<i><em>${NX.esc(z.split("/").pop().replace(/_/g, " "))}</em>${NX.esc(d.toLocaleTimeString([], { timeZone: z, hour: "numeric", minute: "2-digit", hour12: !(NX.prefs && NX.prefs().clock24) }))}</i>`; } catch (e) { return ""; } }).join("");
        return `<section class="dw dw-clock" data-dw="clock"><b>${NX.esc(NX.fmtTime(d))}</b><span>${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>${wc ? `<div class="dw-wc">${wc}</div>` : ""}</section>`; }
      if (k === "weather") { const w = NX.data("wx", null), p = NX.data("wx-place", null); const code = w ? +w.code : -1, h = new Date().getHours(), sky = code < 0 ? "" : code >= 95 ? "storm" : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow" : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? "rain" : code === 45 || code === 48 ? "fog" : code >= 2 ? "cloud" : "clear";
        return `<section class="dw dw-wx" data-dw="weather" ${sky && p ? `data-sky="${sky}" data-day="${h >= 7 && h < 18 ? 1 : 0}"` : ""}>${w && p && NX.wxInfo ? `${NX.wxInfo.icon(w.code, 46)}<div><b>${w.now}°${w.unit}</b><span>${NX.esc(NX.wxInfo.name(w.code))}</span><small>${NX.esc(p.name)}</small></div>` : `<div><b>Weather</b><small>Pick your city in Widgets or the Weather app.</small></div>`}</section>`; }
      if (k === "events") { const key = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"), today = key(d), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        // your own events first, plus the next holiday
        const up = (e) => e.date > today || (e.date === today && (!e.time || e.time >= hm)), byDate = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
        const all = NX.calEvents ? NX.calEvents() : NX.data("events", []), hol = all.filter((e) => e.holiday && up(e)).sort(byDate)[0], mine = all.filter((e) => !e.holiday && up(e)).sort(byDate);
        const next = [...mine.slice(0, hol ? 2 : 3), ...(hol ? [hol] : [])].sort(byDate);
        return `<section class="dw dw-ev" data-dw="events"><h4>Up next</h4>${next.length ? next.map((e) => `<div><i style="background:${e.color || "#7c5cff"}"></i><span><b>${NX.esc(e.title)}</b><small>${e.date === today ? "Today" : new Date(e.date + "T12:00").toLocaleDateString(undefined, Object.assign({ weekday: "short", month: "short", day: "numeric" }, e.date.slice(0, 4) !== String(d.getFullYear()) ? { year: "numeric" } : {}))}${e.time ? " · " + NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : ""}</small></span></div>`).join("") : `<small>Nothing planned. Add events in Calendar.</small>`}</section>`; }
      if (k === "todos") { const L = NX.data("todos", []).filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 4);
        return `<section class="dw dw-ev dw-todo" data-dw="todos"><h4>Reminders</h4>${L.length ? L.map((t) => `<div><i style="background:#fb923c"></i><span><b>${NX.esc(t.text)}</b>${t.due ? `<small>${new Date(t.due).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</small>` : ""}</span></div>`).join("") : `<small>Nothing to do.</small>`}</section>`; }
      if (k === "photo") { dwPhotoLoad(); return `<section class="dw dw-photo" data-dw="photo">${dwPhoto ? `<img src="${NX.esc(dwPhoto.url)}" alt=""><span>${NX.esc(dwPhoto.name.replace(/\.[a-z0-9]{2,5}$/i, ""))}</span>` : `<div><b>Photos</b><small>Pictures you save show up here.</small></div>`}</section>`; }
      if (k === "battery") { const b = NX.batt && NX.batt(); return `<section class="dw dw-bt" data-dw="battery">${b ? `${NX.battIcon(40)}<div><b>${b.percent}%</b><small>${b.charging ? "Charging" : (NX.battLeft && NX.battLeft()) || "On battery"}</small></div>` : `<div><b>Battery</b><small>No battery on this computer.</small></div>`}</section>`; }
      return "";
  };
  function deskWidgets() {
    const on = NX.me ? (NX.prefs().deskWidgets || []).filter((k) => NX.deskWidgetKinds[k]) : [];
    let box = document.getElementById("nx-dwidgets");
    if (!on.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "nx-dwidgets"; const ic = document.getElementById("icons"); (ic ? ic.parentNode : document.getElementById("desktop")).insertBefore(box, ic ? ic.nextSibling : null); }
    const html = on.map((k) => NX.dwHTML(k)).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  NX.deskWidgets = deskWidgets;
  document.addEventListener("click", (e) => { const w = e.target.closest && e.target.closest("#nx-dwidgets [data-dw]"); if (!w) return; const k = w.dataset.dw; NX.open(k === "clock" ? "clock" : k === "weather" ? "weather" : k === "events" ? "calendar" : k === "todos" ? "reminders" : k === "photo" ? "photos" : "settings", k === "battery" ? { page: "system" } : undefined); });
  document.addEventListener("nx:prefs", () => setTimeout(deskWidgets, 30)); document.addEventListener("nx:todos", () => setTimeout(deskWidgets, 30)); setInterval(deskWidgets, 15000); setTimeout(deskWidgets, 1500);

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

  // ---------- the 4.0 look: Aura (glass tinted by the wallpaper's color) and the floating taskbar ----------
  let auraFor = null;
  const auraApply = () => {
    const root = document.documentElement, d = document.getElementById("desktop");
    if (d) d.classList.toggle("tb-float", !NX.me || NX.prefs().tbFloat !== false);
    if (d) d.classList.toggle("tb-labels", !!(NX.me && NX.prefs().tbLabels));
    if (d) d.classList.toggle("accent-bars", !!(NX.me && NX.prefs().accentBars));
    if (d) d.dataset.wfit = NX.me && NX.prefs().wallpaper === "custom" ? NX.prefs().wallFit || "fill" : "fill";
    if (d) { const P = NX.me ? NX.prefs() : {}; d.dataset.tbsearch = P.tbSearch || "box"; d.classList.toggle("tb-notv", P.tbTaskView === false); d.classList.toggle("tb-nowg", P.tbWidgets === false); }
    const p = NX.me ? NX.prefs() : null, w = p ? p.wallpaper : 0, key = String(w) + (w === "custom" ? NX.data("wall-custom", "").length : "");
    if (key === auraFor) return; auraFor = key;
    if (w !== "custom") { const col = (NX.wallAura || [])[typeof w === "number" ? (NX.wallpapers[w] && NX.wallpapers[w].dynamic ? NX.wallNow() : w) : 0]; if (col) root.style.setProperty("--aura", col); if (p && p.accent === "auto") root.style.setProperty("--accent", NX.autoAccent()); return; }
    const src = NX.data("wall-custom", null); if (!src || !/^data:image\//.test(src)) return; // your own picture is kept as a data: picture, which can be read
    const img = new Image();
    img.onload = () => { try {
      const c = document.createElement("canvas"); c.width = c.height = 24; const g = c.getContext("2d"); g.drawImage(img, 0, 0, 24, 24);
      const px = g.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let k = 0; k < px.length; k += 4) { const w = 1 + (Math.max(px[k], px[k + 1], px[k + 2]) - Math.min(px[k], px[k + 1], px[k + 2])) / 40; r += px[k] * w; gg += px[k + 1] * w; b += px[k + 2] * w; n += w; } // colorful pixels count more
      root.style.setProperty("--aura", "rgb(" + Math.round(r / n) + "," + Math.round(gg / n) + "," + Math.round(b / n) + ")"); if (NX.prefs().accent === "auto") root.style.setProperty("--accent", NX.autoAccent());
    } catch (e) { /* a picture we can't read: the default aura stays */ } };
    img.src = src;
  };
  NX.auraApply = auraApply;
  // the accent color from your background: the wallpaper's color, made bright and colorful enough for buttons
  NX.autoAccent = () => {
    const a = getComputedStyle(document.documentElement).getPropertyValue("--aura").trim(), m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(a) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(a);
    if (!m) return "#7c5cff"; let [r, g, b] = m.slice(1, 4).map((x) => (a[0] === "#" ? parseInt(x, 16) : +x) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60 + 360) % 360;
    const sat = d ? Math.max(62, Math.min(85, Math.round((d / (1 - Math.abs(2 * l - 1))) * 100))) : 0;
    return d < .06 ? "#7c5cff" : "hsl(" + h + " " + sat + "% 62%)";
  };
  document.addEventListener("nx:prefs", (e) => { if (!e.detail || ["wallpaper", "wallFit", "tbFloat", "tbLabels", "accentBars", "tbSearch", "tbTaskView", "tbWidgets", "theme"].includes(e.detail)) auraApply(); }); setInterval(auraApply, 3000); setTimeout(auraApply, 300);

  // ---------- Living wallpaper: a few stars slowly twinkle and drift over the background (Settings > Personalization).
  // Off when there's no graphics chip (lite glass), when motion is turned down, and while windows fill the screen.
  let star = null, starT = 0;
  function livingWall() {
    const d = document.getElementById("desktop"), want = !!(NX.me && NX.prefs().living !== false && !document.documentElement.classList.contains("nx-lite") && !document.documentElement.classList.contains("noanim") && !matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!want) { if (star) { cancelAnimationFrame(starT); star.cv.remove(); star = null; } return; }
    if (star || !d) return;
    const cv = document.createElement("canvas"); cv.id = "nx-living"; cv.setAttribute("aria-hidden", "true"); d.insertBefore(cv, d.firstChild);
    const g = cv.getContext("2d"), rnd = (a, b) => a + Math.random() * (b - a);
    star = { cv, pts: [] };
    const size = () => { cv.width = innerWidth; cv.height = innerHeight; star.pts = Array.from({ length: Math.round(innerWidth * innerHeight / 22000) }, () => ({ x: rnd(0, innerWidth), y: rnd(0, innerHeight), r: rnd(.4, 1.6), s: rnd(.02, .09), ph: rnd(0, 6.28), sp: rnd(.6, 1.8) })); };
    size(); addEventListener("resize", size);
    let last = 0;
    const frame = (t) => { starT = requestAnimationFrame(frame); if (!star) return;
      if (t - last < (star.sh ? 16 : 50)) return; last = t; // about 20 frames a second is plenty for twinkling (a shooting star gets full speed)
      const cover = NX.topWin && NX.topWin(); if (cover && cover.max) return; // a full-screen window hides it anyway
      g.clearRect(0, 0, cv.width, cv.height);
      for (const p of star.pts) { p.y -= p.s; p.x += p.s * .35; if (p.y < -4) { p.y = cv.height + 4; p.x = rnd(0, cv.width); } if (p.x > cv.width + 4) p.x = -4;
        const a = .25 + .55 * (.5 + .5 * Math.sin(t / 1000 * p.sp + p.ph)); g.globalAlpha = a; g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
        if (p.r > 1.3) { g.globalAlpha = a * .25; g.beginPath(); g.arc(p.x, p.y, p.r * 3.2, 0, 7); g.fill(); } }
      // now and then a shooting star streaks across the sky
      if (!star.sh && t > (star.next || (star.next = t + rnd(6000, 14000)))) { const ang = rnd(.35, .6); star.sh = { x: rnd(cv.width * .2, cv.width * .9), y: rnd(0, cv.height * .35), vx: -Math.cos(ang) * rnd(.9, 1.3), vy: Math.sin(ang) * rnd(.9, 1.3), t0: t, life: rnd(900, 1400) }; }
      if (star.sh) { const s = star.sh, k = (t - s.t0) / s.life; if (k >= 1) { star.sh = null; star.next = t + rnd(12000, 26000); } else {
        const x = s.x + s.vx * (t - s.t0), y = s.y + s.vy * (t - s.t0), len = 140, fade = Math.sin(k * Math.PI), gr = g.createLinearGradient(x, y, x - s.vx * len, y - s.vy * len);
        gr.addColorStop(0, "rgba(255,255,255," + (.95 * fade) + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.8; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x - s.vx * len, y - s.vy * len); g.stroke();
        g.fillStyle = "rgba(255,255,255," + fade + ")"; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } }
      g.globalAlpha = 1; };
    starT = requestAnimationFrame(frame);
  }
  NX.livingWall = livingWall;
  document.addEventListener("nx:prefs", () => setTimeout(livingWall, 20)); setInterval(livingWall, 3000); setTimeout(livingWall, 1000);

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
  const closeTop = () => { const t = NX.topWin && NX.topWin(); if (t) NX.close(t.id); else if (NX.shutDownBox) NX.shutDownBox(); }; // nothing open: the Shut down box, like Windows
  addEventListener("keydown", (e) => { if (e.altKey && e.key === "F4" && NX.me) { e.preventDefault(); closeTop(); } });
  document.addEventListener("nx:key", (e) => { if (e.detail === "close") closeTop(); if (e.detail === "search") NX.quickSearch(); if (e.detail === "grid") NX.appGrid(); if (/^zoom-/.test(e.detail) && NX.shell) NX.shell.closeFlyouts(); if (e.detail === "zoom-in") NX.magnifier.zoom(1); if (e.detail === "zoom-out") NX.magnifier.zoom(-1); if (e.detail === "zoom-off") NX.magnifier.zoom(0); });

  // ---------- hot corners: push the pointer into a corner to do something (Settings > Personalization) ----------
  NX.cornerActions = { none: ["Nothing", null], saver: ["Start the screen saver", () => NX.saver && NX.saver.start(NX.prefs().scrSaver && NX.prefs().scrSaver !== "off" ? NX.prefs().scrSaver : "stars")], desktop: ["Show the desktop", () => NX.showDesktop && NX.showDesktop()], tview: ["Task View", () => NX.taskView && NX.taskView()], grid: ["App Grid", () => NX.appGrid()], search: ["Quick Search", () => NX.quickSearch()], lock: ["Lock", () => NX.shell && NX.shell.lockKeep && NX.shell.lockKeep()], start: ["Start", () => NX.shell && NX.shell.toggleStart && NX.shell.toggleStart()], note: ["New sticky note", () => { const L = NX.data("sticky-notes", []); L.unshift({ id: NX.uid(), t: "", c: "sun", at: Date.now(), pin: true }); NX.setData("sticky-notes", L); if (NX.deskNotes) NX.deskNotes(); setTimeout(() => { const t = document.querySelector("#nx-dnotes .dn-note textarea"); if (t) t.focus(); }, 60); }] };
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

// ---------- Themes: one click sets the background, dark or light, the accent color, the corners and the glass ----------
NX.looks40 = [
  { name: "Nebulux", wall: 10, theme: "dark", accent: "#7c5cff", corners: "round", glass: "frosted" },
  { name: "Aurora", wall: 11, theme: "dark", accent: "#22d3ee", corners: "xround", glass: "clear" },
  { name: "Ember", wall: 2, theme: "dark", accent: "#f97316", corners: "square", glass: "solid" },
  { name: "Polar", wall: 8, theme: "dark", accent: "#34d399", corners: "round", glass: "frosted" },
  { name: "Pearl", wall: 12, theme: "light", accent: "#c026d3", corners: "xround", glass: "clear" },
  { name: "Daybreak", wall: 5, theme: "light", accent: "#2563eb", corners: "round", glass: "frosted" },
];
NX.lookOn40 = (t) => { const p = NX.prefs(); return p.wallpaper === t.wall && p.theme === t.theme && p.accent === t.accent && (p.corners40 || "round") === t.corners && (p.glass || "frosted") === t.glass; };

// ---------- a count on Reminders' taskbar button: how many reminders are due ----------
(function () {
  const due = () => { if (!NX.me) return 0; const d = new Date(), now = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); return NX.data("todos", []).filter((t) => !t.done && t.due && t.due <= now).length; };
  NX.appBadge = (id) => { if (id !== "reminders") return ""; const n = due(); return n ? (n > 9 ? "9+" : String(n)) : ""; };
  let last = -1; const tick = () => { const n = due(); if (n !== last) { last = n; if (NX.shell && NX.me) NX.shell.taskbar(); } };
  document.addEventListener("nx:todos", () => setTimeout(tick, 30)); setInterval(tick, 30000);
})();

// ---------- pointer color (Settings > Accessibility): white, black, or the accent color, at normal or large size ----------
(function () {
  const svg = (size, body) => "url(\"data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 48 48'>${body}</svg>`) + "\")";
  function apply() {
    const p = NX.me ? NX.prefs() : {}, c = p.pointerColor || "white"; let st = document.getElementById("nx-pointer");
    if (!NX.me || c === "white") { if (st) st.remove(); return; }
    const fill = c === "black" ? "#111" : c === "accent" ? (p.accent === "auto" && NX.autoAccent ? NX.autoAccent() : p.accent) || "#7c5cff" : c, edge = c === "black" ? "#fff" : "#000";
    const size = p.bigcursor ? 48 : 26, k = size / 48, h = (x, y) => Math.round(x * k) + " " + Math.round(y * k);
    const arrow = svg(size, `<path d='M6 3l0 36 9-9 6 14 6-3-6-13 13 0z' fill='${fill}' stroke='${edge}' stroke-width='2.5' stroke-linejoin='round'/>`);
    const hand = svg(size, `<path d='M17 22V7a3 3 0 016 0v13l1-1a3 3 0 016 0v2a3 3 0 016 0v2a3 3 0 016 0v9c0 8-5 13-13 13h-3c-5 0-8-3-11-7l-6-8a3 3 0 015-4l3 3z' fill='${fill}' stroke='${edge}' stroke-width='2.5' stroke-linejoin='round'/>`);
    const css = `html.nx-pc,html.nx-pc *{cursor:${arrow} ${h(6, 3)},default!important}html.nx-pc button,html.nx-pc a,html.nx-pc [role=button],html.nx-pc label,html.nx-pc select,html.nx-pc .tb-app,html.nx-pc summary{cursor:${hand} ${h(19, 4)},pointer!important}html.nx-pc input:not([type=checkbox]):not([type=radio]):not([type=range]),html.nx-pc textarea,html.nx-pc [contenteditable=true]{cursor:text!important}`;
    if (!st) { st = document.createElement("style"); st.id = "nx-pointer"; document.head.appendChild(st); }
    if (st.textContent !== css) st.textContent = css;
    document.documentElement.classList.add("nx-pc");
  }
  NX.pointerApply = apply;
  document.addEventListener("nx:prefs", () => setTimeout(apply, 20)); setTimeout(apply, 300);
  const mo = () => { if (!document.getElementById("nx-pointer")) document.documentElement.classList.remove("nx-pc"); }; document.addEventListener("nx:prefs", () => setTimeout(mo, 40));
})();

// ---------- system sounds: a soft chime when you sign in, and an optional gentle sound for notifications ----------
(function () {
  let ac = null;
  // notes: [frequency, start (s), length (s), loudness]
  function play(notes) {
    try {
      const v = (NX.prefs().volume || 0) / 100; if (!v) return;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume();
      const t = ac.currentTime + 0.02;
      for (const [f, at, len, loud] of notes) {
        const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o2.type = "triangle"; o.frequency.value = f; o2.frequency.value = f * 2; o2.detune.value = 4;
        const g2 = ac.createGain(); g2.gain.value = 0.18;
        g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(loud * v, t + at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
        o.connect(g); o2.connect(g2).connect(g); g.connect(ac.destination);
        o.start(t + at); o2.start(t + at); o.stop(t + at + len + 0.05); o2.stop(t + at + len + 0.05);
      }
    } catch (e) { /* no sound on this computer */ }
  }
  NX.sounds = {
    play,
    signin: () => play([[523.25, 0, 1.1, 0.10], [659.25, 0.09, 1.1, 0.09], [783.99, 0.18, 1.2, 0.08], [1046.5, 0.3, 1.4, 0.06]]),
    note: () => play([[880, 0, 0.35, 0.07], [1318.5, 0.07, 0.45, 0.05]]),
  };
  document.addEventListener("nx:signin", (e) => { if (NX.me && NX.prefs().signinSound !== false && !(e.detail && e.detail.back)) setTimeout(NX.sounds.signin, 250); });
  let lastNote = 0;
  NX.onToast = () => { if (NX.me && NX.prefs().noteSound && Date.now() - lastNote > 2500) { lastNote = Date.now(); NX.sounds.note(); } };
})();

// ---------- drag on an empty part of the desktop to draw a box and select the icons inside it ----------
(function () {
  let start = null, box = null;
  const BLOCK = ".win, #taskbar, .flyout, .dicon, .dw, #start, #widgets, #taskview, #cal, #qs, button, input, textarea, select, a, [contenteditable], .ctx, #nx-snip, #nx-qs, #oobe, #lock";
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch" || !NX.me) return;
    const d = document.getElementById("desktop"); if (!d || d.hidden || !d.contains(e.target) || e.target.closest(BLOCK)) return;
    start = { x: e.clientX, y: e.clientY };
  }, true);
  document.addEventListener("pointermove", (e) => {
    if (!start) return;
    const x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY), w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
    if (!box) { if (w < 5 && h < 5) return; box = document.createElement("div"); box.id = "nx-lasso"; document.body.appendChild(box); }
    Object.assign(box.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    document.querySelectorAll("#desktop .dicon").forEach((ic) => { const r = ic.getBoundingClientRect(); ic.classList.toggle("sel", r.right > x && r.left < x + w && r.bottom > y && r.top < y + h); });
  });
  const end = () => { start = null; if (box) { box.remove(); box = null; } };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end); addEventListener("blur", end);
})();

// ---------- the desktop Recycle Bin shows whether anything is in it ----------
(function () {
  let busy = false;
  NX.binCheck = async () => {
    if (!NX.me || busy || !NX.fs || !NX.fs.trash) return; busy = true;
    try { const full = ((await NX.fs.trash()).entries || []).length > 0; if (full !== !!NX.binFull) { NX.binFull = full; if (NX.shell) NX.shell.icons(); } } catch (e) { /* skip */ }
    busy = false;
  };
  document.addEventListener("nx:files", () => setTimeout(NX.binCheck, 200)); document.addEventListener("nx:signin", () => setTimeout(NX.binCheck, 800)); setInterval(NX.binCheck, 20000);
})();

// ---------- screen saver: after a few idle minutes, a starfield or a floating clock; any key or move ends it ----------
(function () {
  let last = Date.now(), el = null, raf = 0, grace = 0;
  const KINDS = { off: "None", stars: "Starfield", clock: "Floating clock" };
  NX.saverKinds = KINDS;
  const poke = () => { last = Date.now(); if (el && Date.now() > grace) stop(); };
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => addEventListener(t, poke, { capture: true, passive: true }));
  function playing() { return [...document.querySelectorAll("video,audio")].some((m) => !m.paused && !m.ended); }
  function start(kind) {
    if (el) return; grace = Date.now() + 1200; kind = kind || NX.prefs().scrSaver;
    el = document.createElement("div"); el.id = "nx-saver"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = kind === "clock" ? `<div class="sv-clock"><b></b><span></span></div>` : `<canvas></canvas>`;
    document.body.appendChild(el); requestAnimationFrame(() => el && el.classList.add("on"));
    if (kind === "clock") clock(); else stars();
  }
  function stop() {
    cancelAnimationFrame(raf); const e = el; el = null; if (!e) return;
    e.classList.remove("on"); setTimeout(() => e.remove(), 400);
    if (NX.me && NX.prefs().saverLock && !e.dataset.preview && NX.shell && NX.shell.lockKeep) NX.shell.lockKeep();
  }
  function stars() {
    const c = el.querySelector("canvas"), g = c.getContext("2d"), lite = document.documentElement.classList.contains("nx-lite");
    const fit = () => { c.width = innerWidth; c.height = innerHeight; }; fit();
    const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c5cff";
    const N = lite ? 160 : 420, S = [], rnd = () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() * 1 + 0.05, h: Math.random() < 0.25 });
    for (let i = 0; i < N; i++) S.push(rnd());
    let t0 = performance.now();
    const draw = (t) => {
      if (!el) return; const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
      if (c.width !== innerWidth) fit();
      g.fillStyle = "rgba(4,2,12,0.35)"; g.fillRect(0, 0, c.width, c.height);
      const cx = c.width / 2, cy = c.height / 2, k = Math.max(c.width, c.height) * 0.5;
      for (const s of S) {
        const pz = s.z; s.z -= dt * 0.32; if (s.z <= 0.02) { Object.assign(s, rnd(), { z: 1.05 }); continue; }
        const x = cx + (s.x / s.z) * k * 0.5, y = cy + (s.y / s.z) * k * 0.5, px = cx + (s.x / pz) * k * 0.5, py = cy + (s.y / pz) * k * 0.5;
        if (x < -50 || x > c.width + 50 || y < -50 || y > c.height + 50) { Object.assign(s, rnd(), { z: 1.05 }); continue; }
        const a = Math.min(1, (1.05 - s.z) * 1.4);
        g.strokeStyle = s.h ? acc : "#ffffff"; g.globalAlpha = a; g.lineWidth = Math.max(0.6, (1.1 - s.z) * 2.6);
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      }
      g.globalAlpha = 1; raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
  function clock() {
    const box = el.querySelector(".sv-clock"); let x = innerWidth * 0.3, y = innerHeight * 0.35, vx = 38, vy = 26, t0 = performance.now();
    const step = (t) => {
      if (!el) return; const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; const d = new Date();
      box.querySelector("b").textContent = NX.fmtTime ? NX.fmtTime(d) : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      box.querySelector("span").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      const w = box.offsetWidth, h = box.offsetHeight; x += vx * dt; y += vy * dt;
      if (x < 20 || x + w > innerWidth - 20) { vx = -vx; x = Math.max(20, Math.min(innerWidth - w - 20, x)); }
      if (y < 20 || y + h > innerHeight - 20) { vy = -vy; y = Math.max(20, Math.min(innerHeight - h - 20, y)); }
      box.style.transform = `translate(${x}px,${y}px)`; raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  NX.saver = { start, stop, preview: (k) => { last = Date.now(); start(k); if (el) el.dataset.preview = "1"; }, get on() { return !!el; } };
  setInterval(() => {
    const p = NX.me ? NX.prefs() : null; if (!p || !p.scrSaver || p.scrSaver === "off" || el) return;
    const lk = document.getElementById("lock"); if (lk && !lk.hidden) return;
    if (Date.now() - last >= (p.saverWait || 5) * 60000 && !playing()) start();
  }, 5000);
})();

// ---------- Peek: rest the pointer on the far right of the taskbar and the windows turn see-through ----------
(function () {
  let t = 0;
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest && e.target.closest("#tb-showdesk"); if (!b || e.pointerType === "touch") return;
    clearTimeout(t); t = setTimeout(() => { const d = document.getElementById("desktop"); if (d && b.matches(":hover")) d.classList.add("nx-peek"); }, 450);
  });
  const off = () => { clearTimeout(t); const d = document.getElementById("desktop"); if (d) d.classList.remove("nx-peek"); };
  document.addEventListener("pointerout", (e) => { if (e.target.closest && e.target.closest("#tb-showdesk")) off(); });
  document.addEventListener("pointerdown", off, true);
  NX.peekDesktop = (on) => { const d = document.getElementById("desktop"); if (d) d.classList.toggle("nx-peek", !!on); };
})();

// ---------- Shake: grab a window by its title bar and shake it to minimize all the other windows (shake again to bring them back) ----------
(function () {
  let g = null, shaken = [];
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || NX.prefs && NX.me && NX.prefs().shakeMin === false) return;
    const tb = e.target.closest && e.target.closest(".win .titlebar"); if (!tb || e.target.closest("button")) return;
    g = { id: tb.closest(".win").dataset.app, x: e.clientX, dir: 0, flips: [], far: e.clientX };
  }, true);
  document.addEventListener("pointermove", (e) => {
    if (!g) return; const dx = e.clientX - g.far, d = Math.sign(dx);
    if (Math.abs(dx) < 28) return;
    if (d && d !== g.dir) { if (g.dir) g.flips.push(performance.now()); g.dir = d; }
    g.far = e.clientX; const now = performance.now(); g.flips = g.flips.filter((t) => now - t < 900);
    if (g.flips.length >= 4) { NX.shakeWin(g.id); g.flips = []; g.dir = 0; }
  });
  addEventListener("pointerup", () => { g = null; });
  NX.shakeWin = (id) => {
    const others = [...NX.wins.values()].filter((w) => w.id !== id && !w.min).map((w) => w.id);
    if (others.length) { shaken = others; others.forEach((o) => NX.minimize(o)); }
    else if (shaken.length) { shaken.forEach((o) => NX.open(o)); shaken = []; if (NX.focus) NX.focus(id); }
  };
})();

// ---------- a little bounce on an app's taskbar button when it opens ----------
(function () {
  const open0 = NX.open;
  NX.open = (id, opts) => {
    const had = NX.wins.has(id) || (NX.nativeRunning && NX.nativeRunning.has(id)), r = open0(id, opts);
    if (!had && NX.me) [40, 260].forEach((ms) => setTimeout(() => { const b = document.querySelector(`#tb-apps .tb-app[data-app="${id}"]`); if (b && !b.dataset.bounced) { b.dataset.bounced = "1"; b.classList.add("nx-bounce"); setTimeout(() => b.classList.remove("nx-bounce"), 900); } }, ms));
    return r;
  };
})();

// ---------- the snap bar: drag a window to the top of the screen and drop it on a layout ----------
(function () {
  const L = [[[0, 0, .5, 1], [.5, 0, .5, 1]], [[0, 0, .66, 1], [.66, 0, .34, 1]], [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]], [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]], [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]]];
  let bar = null, hot = null, id = null;
  const make = () => {
    bar = document.createElement("div"); bar.id = "nx-snapbar";
    bar.innerHTML = L.map((lay, i) => `<div class="sb-lay">${lay.map((z, k) => `<i data-l="${i}" data-z="${k}" style="left:${z[0] * 100}%;top:${z[1] * 100}%;width:${z[2] * 100}%;height:${z[3] * 100}%"></i>`).join("")}</div>`).join("");
    document.body.appendChild(bar);
  };
  addEventListener("pointermove", (e) => {
    const dw = document.documentElement.classList.contains("nx-drag") && document.querySelector(".win.dragging");
    if (!dw || innerWidth < 700) { if (bar) bar.classList.remove("show", "near"); hot = null; return; }
    id = dw.dataset.app; if (!bar) make();
    bar.classList.toggle("show", e.clientY < 120); bar.classList.toggle("near", e.clientY < 70);
    hot = null; bar.querySelectorAll("i").forEach((z) => { const r = z.getBoundingClientRect(), on = bar.classList.contains("near") && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; z.classList.toggle("hot", on); if (on) hot = z; });
  }, true);
  addEventListener("pointerup", () => {
    if (!bar) return; const z = hot, w = id; bar.classList.remove("show", "near"); bar.querySelectorAll("i.hot").forEach((x) => x.classList.remove("hot")); hot = null;
    if (z && w) setTimeout(() => NX.snapRect(w, ...L[+z.dataset.l][+z.dataset.z]), 0);
  }, true);
})();

// ---------- Ctrl + Alt + Delete: Lock, Switch user, Sign out, Change a password, Task Manager ----------
(function () {
  function open() {
    if (!NX.me || document.getElementById("nx-sec")) return; if (NX.shell) NX.shell.closeFlyouts();
    const o = document.createElement("div"); o.id = "nx-sec"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Security options");
    const it = [["lock", "Lock"], ["switch", "Switch user"], ["out", "Sign out"], ["pass", "Change a password"], ["tm", "Task Manager"]];
    o.innerHTML = `<div class="sec-list">${it.map(([k, t]) => `<button data-sec="${k}">${t}</button>`).join("")}<button data-sec="cancel" class="sec-cancel">Cancel</button></div>
      <div class="sec-power"><button data-sec="restart" title="Restart" aria-label="Restart">${NX.icon("restart", 20)}</button><button data-sec="off" title="Shut down" aria-label="Shut down">${NX.icon("power", 20)}</button></div>`;
    document.body.appendChild(o);
    const close = () => { o.classList.add("out"); setTimeout(() => o.remove(), 200); };
    o.querySelectorAll("[data-sec]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.sec; close(); const S = NX.shell || {};
      if (k === "lock" || k === "switch") S.lockKeep && S.lockKeep();
      else if (k === "out") S.signOut && S.signOut();
      else if (k === "pass") NX.open("settings", { page: "accounts" });
      else if (k === "tm") NX.open("taskmgr");
      else if (k === "restart" || k === "off") S.power && S.power(k === "restart" ? "restart" : "off");
    }));
    o.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    setTimeout(() => { const f = o.querySelector("[data-sec=lock]"); if (f) f.focus(); }, 50);
  }
  NX.securityScreen = open;
  document.addEventListener("nx:key", (e) => { if (e.detail === "sec") open(); });
  addEventListener("keydown", (e) => { if (e.ctrlKey && e.altKey && (e.key === "Delete" || e.code === "Delete")) { e.preventDefault(); open(); } }, true);
})();

// ---------- Focus in the calendar flyout (like Windows 11): pick the minutes, start, and see the time left ----------
(function () {
  let t = 0, mins = 25;
  NX.calFocus = (box) => {
    if (!box || !NX.focusSession) return; clearInterval(t);
    const draw = () => {
      if (!box.isConnected) { clearInterval(t); return; }
      const F = NX.focusSession;
      if (F.on()) { const l = F.left(), m = Math.floor(l / 60000), sec = Math.floor((l % 60000) / 1000);
        box.innerHTML = `<div class="cf-ring" style="--p:${(1 - l / F.len()) * 100}"><b>${m}:${String(sec).padStart(2, "0")}</b></div><div class="cf-t"><b>Focusing</b><small>Do not disturb is on</small></div><button class="btn sm" data-cf="stop">Stop</button>`;
      } else box.innerHTML = `<button class="cf-pm" data-cf="minus" aria-label="Fewer minutes">-</button><span class="cf-min"><b>${mins}</b> mins</span><button class="cf-pm" data-cf="plus" aria-label="More minutes">+</button><button class="btn sm primary cf-go" data-cf="go">${NX.icon("time", 14)}Focus</button>`;
      box.querySelectorAll("[data-cf]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.cf;
        if (k === "minus") mins = Math.max(5, mins - 5); if (k === "plus") mins = Math.min(240, mins + 5);
        if (k === "go") F.start(mins); if (k === "stop") F.finish(false); draw(); }));
    };
    draw(); t = setInterval(() => { if (NX.focusSession.on()) draw(); }, 1000);
  };
})();

// ---------- Weather: an animated sky behind the weather now (sun, clouds, rain, snow, storm, fog, stars at night) ----------
NX.wxSky = (el, code, day) => {
  if (!el) return; code = +code;
  const kind = code >= 95 ? "storm" : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow" : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? "rain" : code === 45 || code === 48 ? "fog" : code >= 2 ? "cloud" : "clear";
  el.dataset.sky = kind; el.dataset.day = day ? "1" : "0";
  const old = el.querySelector(".wx-sky"); if (old) old.remove();
  const s = document.createElement("div"); s.className = "wx-sky"; s.setAttribute("aria-hidden", "true");
  const R = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
  let h = "";
  if (kind === "clear" && day) h = `<i class="wx-sun"></i>`;
  if (!day && (kind === "clear" || kind === "cloud")) for (let i = 0; i < 40; i++) h += `<i class="wx-star" style="left:${R(0, 100)}%;top:${R(0, 90)}%;animation-delay:-${R(0, 4)}s;--z:${R(.5, 1.6)}"></i>`;
  if (kind === "cloud" || kind === "rain" || kind === "storm" || kind === "snow") for (let i = 0; i < 5; i++) h += `<i class="wx-cloud" style="top:${R(-10, 40)}%;animation-duration:${R(40, 80)}s;animation-delay:-${R(0, 80)}s;--z:${R(.7, 1.4)}"></i>`;
  if (kind === "rain" || kind === "storm") for (let i = 0; i < 60; i++) h += `<i class="wx-drop" style="left:${R(0, 100)}%;animation-duration:${R(.5, .9)}s;animation-delay:-${R(0, 1)}s"></i>`;
  if (kind === "snow") for (let i = 0; i < 50; i++) h += `<i class="wx-flake" style="left:${R(0, 100)}%;animation-duration:${R(5, 11)}s;animation-delay:-${R(0, 11)}s;--z:${R(.5, 1.3)}"></i>`;
  if (kind === "storm") h += `<i class="wx-flash"></i>`;
  if (kind === "fog") h += `<i class="wx-fog"></i><i class="wx-fog b"></i>`;
  s.innerHTML = h; el.prepend(s);
};

// ---------- the lock screen shows what's playing, with play, pause and next ----------
(function () {
  const PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/></svg>';
  function tick() {
    const L = document.getElementById("lock"), d = document.getElementById("lk-date"); if (!L || !d) return;
    const n = !L.hidden && NX.nowPlaying ? NX.nowPlaying() : null; let el = document.getElementById("lk-np");
    if (!n) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.id = "lk-np";
      el.innerHTML = `<span class="lknp-i">${NX.icon(n.video ? "fvideo" : "faudio", 26)}</span><span class="lknp-t"><b></b><small>Media Player</small></span><button data-lknp="play" aria-label="Play or pause"></button><button data-lknp="next" aria-label="Next">${NX.icon("fwd", 16)}</button>`;
      (document.getElementById("lk-wx") || d).after(el);
      el.addEventListener("click", (e) => { e.stopPropagation(); const b = e.target.closest("[data-lknp]"), m = NX.nowPlaying && NX.nowPlaying(); if (!b || !m) return; if (b.dataset.lknp === "play") m.toggle(); else m.next(); setTimeout(tick, 150); });
      ["pointerdown", "keydown", "touchstart"].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
    }
    el.querySelector("b").textContent = n.name; const pb = el.querySelector("[data-lknp=play]"); const want = n.playing ? PAUSE : PLAY; if (pb.innerHTML !== want) pb.innerHTML = want;
  }
  setInterval(tick, 1000);
  NX.lockNowPlaying = tick;
})();

// ---------- a fitting icon for each notification, picked from what it says ----------
NX.noteIcon = (text) => {
  const t = String(text || "");
  const R = [[/Wi-?Fi|internet|online|connection|network/i, "wifi"], [/Bluetooth/i, "bt"], [/battery|charg/i, "battery"], [/update|Nebulux OS \d/i, "download"], [/screenshot|snip/i, "snip"], [/^Now:|event|calendar/i, "calendar"], [/remind/i, "reminders"], [/alarm|timer|focus|countdown/i, "time"], [/sav|file|folder|copied|moved|deleted|Recycle/i, "folder"], [/background|theme|color|accent/i, "brush"], [/volume|sound|mute/i, "volume"], [/install|Store/i, "store"], [/password|lock|sign/i, "lock"], [/Welcome/i, "logo"]];
  for (const [re, ic] of R) if (re.test(t)) return ic;
  return "logo";
};

// ---------- Back up (Settings > System): copy Documents, Pictures, Music, Videos and Desktop to a USB drive ----------
(function () {
  const FOLDERS = ["Desktop", "Documents", "Pictures", "Music", "Videos"];
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}.${z(d.getMinutes())}`; };
  NX.backupNow = async (drive, say) => {
    const fsx = NX.fs; if (!drive || !drive.mount) throw new Error("Open the drive in File Explorer first, then try again.");
    say && say("Getting the drive ready...");
    let root = fsx.join(drive.mount, "Nebulux Backup");
    try { await fsx.list(root); } catch (e) { root = (await fsx.create(drive.mount, "Nebulux Backup", true)).path || root; }
    const made = await fsx.create(root, stamp(), true), dest = made.path || fsx.join(root, stamp());
    // the main folders themselves are protected, so each gets a new folder on the drive and what's inside is copied into it
    for (const n of FOLDERS) {
      let src; try { src = await NX.folder(n); } catch (e) { continue; }
      const items = ((await fsx.list(src)).entries || []).map((e) => e.path).filter(Boolean); if (!items.length) continue;
      say && say("Copying " + n + "...");
      const sub = await fsx.create(dest, n, true); await fsx.copy(items, sub.path || fsx.join(dest, n), false);
    }
    const rec = { at: Date.now(), drive: drive.label || "USB drive", path: dest }; NX.setData("backup-last", rec); return rec;
  };
  NX.backupFill = async (box) => {
    if (!box || !NX.fs || !NX.fs.drives) return;
    let ds = []; try { ds = await NX.fs.drives(); } catch (e) { ds = []; }
    const last = NX.data("backup-last", null), lastTxt = last ? `Last backup: ${new Date(last.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} to ${NX.esc(last.drive)}` : "No backups yet";
    if (!ds.length) { box.innerHTML = `<div class="s-bth"><span class="s-hwt">${NX.icon("download", 20)}<b>Plug in a USB drive to back up your files</b></span></div><p class="s-note">${lastTxt}. A backup copies your Desktop, Documents, Pictures, Music and Videos into a Nebulux Backup folder on the drive.</p>`; return; }
    box.innerHTML = `<div class="s-bth"><span class="s-hwt">${NX.icon("download", 20)}<b>Back up to</b></span><select class="s-sel" id="s-bkdrive">${ds.map((d, i) => `<option value="${i}">${NX.esc(d.label || "USB drive")}${d.mount ? "" : " (not open)"}</option>`).join("")}</select><button class="btn primary" id="s-bkgo">Back up now</button></div><p class="s-note" id="s-bkmsg">${lastTxt}. Copies your Desktop, Documents, Pictures, Music and Videos into a Nebulux Backup folder on the drive.</p>${last && last.path ? `<button class="btn sm" id="s-bkopen">Open the last backup</button>` : ""}`;
    const msg = box.querySelector("#s-bkmsg"), go = box.querySelector("#s-bkgo");
    go.onclick = async () => {
      let d = ds[+box.querySelector("#s-bkdrive").value];
      if (d && !d.mount && NX.fs.mount) { try { msg.textContent = "Opening the drive..."; await NX.fs.mount(d.dev); ds = await NX.fs.drives(); d = ds.find((x) => x.dev === d.dev) || d; } catch (e) { msg.textContent = e.message; return; } }
      go.disabled = true; go.textContent = "Backing up...";
      try { const r = await NX.backupNow(d, (t) => (msg.textContent = t)); msg.textContent = "Done. Your files are in " + r.path + "."; NX.toast("Backup done: your files are on " + r.drive + "."); }
      catch (e) { msg.textContent = e.message || "The backup didn't finish."; }
      go.disabled = false; go.textContent = "Back up now";
    };
    const op = box.querySelector("#s-bkopen"); if (op) op.onclick = () => NX.open("files", { path: NX.data("backup-last", {}).path });
  };
})();

// ---------- new windows grow out of the place you clicked (a taskbar button, a Start tile, a desktop icon) ----------
(function () {
  let pt = null;
  addEventListener("pointerdown", (e) => { pt = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
  document.addEventListener("nx:winopen", (e) => {
    const w = NX.wins.get(e.detail); if (!w || !pt || Date.now() - pt.t > 900) return;
    const root = document.documentElement; if (root.classList.contains("noanim") || root.classList.contains("nx-lite")) return;
    const el = w.el;
    const par = (el.offsetParent || document.body).getBoundingClientRect(), ox = pt.x - par.left - el.offsetLeft, oy = pt.y - par.top - el.offsetTop; pt = null;
    el.style.transformOrigin = `${Math.round(ox)}px ${Math.round(oy)}px`;
    const an = el.animate([{ transform: "scale(.16)", opacity: 0 }, { transform: "scale(1.012)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.2,.8,.25,1)" });
    an.onfinish = an.oncancel = () => { el.style.transformOrigin = ""; };
  });
})();

// ---------- Snap Assist: after a window snaps to one half, pick which window fills the other half ----------
(function () {
  // a small live picture of a window (the same way Task View draws them)
  function winPic(w, face) {
    if (!w || !face || w.el.querySelector("iframe")) return;
    const r = { width: w.el.offsetWidth, height: w.el.offsetHeight }; if (!r.width || !r.height) return;
    const FW = face.clientWidth || 200, FH = face.clientHeight || 110, k = Math.min(FW / r.width, FH / r.height);
    const cl = w.el.cloneNode(true); cl.removeAttribute("id"); cl.removeAttribute("data-app"); cl.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); cl.classList.remove("opening", "closing", "minimized", "offdesk", "maxed");
    Object.assign(cl.style, { position: "absolute", left: "0", top: "0", width: r.width + "px", height: r.height + "px", transform: "translate(" + Math.round((FW - r.width * k) / 2) + "px," + Math.round((FH - r.height * k) / 2) + "px) scale(" + k + ")", transformOrigin: "0 0", pointerEvents: "none", margin: 0, zIndex: 0, opacity: 1 });
    cl.setAttribute("aria-hidden", "true"); cl.inert = true; face.innerHTML = ""; face.appendChild(cl);
  }
  const close = () => { const o = document.getElementById("nx-assist"); if (o) { o.classList.add("out"); setTimeout(() => o.remove(), 180); } };
  document.addEventListener("nx:snapped", (e) => {
    close(); if (innerWidth < 700 || (NX.me && NX.prefs().snapAssist === false)) return;
    const { id, side } = e.detail || {}; if (side !== "left" && side !== "right") return;
    const others = [...NX.wins.values()].filter((w) => w.id !== id && !w.min && !w.el.classList.contains("offdesk") && !(w.snap && w.snap !== "zone" && w.snap !== side));
    if (!others.length) return;
    const host = document.getElementById("windows"); if (!host) return;
    const o = document.createElement("div"); o.id = "nx-assist"; o.className = side === "left" ? "right" : "left";
    o.innerHTML = `<div class="as-grid">${others.map((w) => `<button class="as-card" data-as="${w.id}"><span class="as-top">${NX.icon(w.app.icon || w.id, 18)}<b>${NX.esc(w.el.querySelector(".wt-name") ? w.el.querySelector(".wt-name").textContent : w.app.name)}</b></span><span class="as-face">${NX.icon(w.app.icon || w.id, 56)}</span></button>`).join("")}</div>`;
    host.appendChild(o);
    o.querySelectorAll("[data-as]").forEach((b) => winPic(NX.wins.get(b.dataset.as), b.querySelector(".as-face")));
    o.querySelectorAll("[data-as]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); const oid = b.dataset.as; close(); NX.snapRect(oid, side === "left" ? .5 : 0, 0, .5, 1); const w2 = NX.wins.get(oid); if (w2) w2.snap = side === "left" ? "right" : "left"; }));
    o.addEventListener("pointerdown", (ev) => { if (ev.target === o) close(); });
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, true);
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest || !e.target.closest("#nx-assist")) close(); }, true);
})();

// ---------- the lock screen shows your next event and how many reminders are due (only while you're locked, not after signing out) ----------
(function () {
  const key = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  NX.lockNextSave = () => {
    if (!NX.me || NX.prefs().lockNext === false) { NX.set("lk-next", null); return; }
    const d = new Date(), today = key(d), tm = new Date(d.getTime() + 86400000), tomorrow = key(tm), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const ev = NX.data("events", []).filter((e) => (e.date === today && (!e.time || e.time >= hm)) || e.date === tomorrow).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
    const now = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16), due = NX.data("todos", []).filter((t) => !t.done && t.due && t.due <= now).length;
    NX.set("lk-next", ev || due ? { title: ev ? ev.title : "", when: ev ? (ev.date === today ? "Today" : "Tomorrow") + (ev.time ? ", " + NX.fmtTime(new Date(ev.date + "T" + ev.time)) : "") : "", color: ev ? ev.color || "#7c5cff" : "", due } : null);
  };
  function tick() {
    const L = document.getElementById("lock"), d = document.getElementById("lk-date"); if (!L || !d) return;
    const n = !L.hidden && !NX.me ? NX.get("lk-next", null) : null; let el = document.getElementById("lk-next");
    if (!n) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "lk-next"; (document.getElementById("lk-wx") || d).after(el); }
    const html = (n.title ? `<span class="lkn-ev"><i style="background:${NX.esc(n.color)}"></i><b>${NX.esc(n.title)}</b><small>${NX.esc(n.when)}</small></span>` : "") + (n.due ? `<span class="lkn-due">${NX.icon("reminders", 16)}${n.due} reminder${n.due === 1 ? "" : "s"} due</span>` : "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  setInterval(tick, 1000);
})();

// ---------- the lock screen names its background picture, bottom left (like Windows Spotlight) ----------
(function () {
  setInterval(() => {
    const L = document.getElementById("lock"); if (!L) return; let el = document.getElementById("lk-pic");
    const lw = NX.get("lock-wall", NX.defaultWall), w = typeof lw === "number" && NX.wallpapers && NX.wallpapers[lw];
    if (L.hidden || NX.me || !w) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "lk-pic"; L.appendChild(el); }
    const html = `<b>${NX.esc(w.name)}</b><small>A Nebulux OS background</small>`; if (el.innerHTML !== html) el.innerHTML = html;
  }, 1000);
})();

// ---------- holidays in the calendar (Calendar app and the clock flyout), for the United States region ----------
(function () {
  const z = (n) => String(n).padStart(2, "0"), k = (y, m, d) => y + "-" + z(m + 1) + "-" + z(d);
  const nth = (y, m, wd, n) => { const d = new Date(y, m, 1); const off = (wd - d.getDay() + 7) % 7; return 1 + off + (n - 1) * 7; };
  const last = (y, m, wd) => { const d = new Date(y, m + 1, 0); return d.getDate() - ((d.getDay() - wd + 7) % 7); };
  const easter = (y) => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), kk = c % 4, l = (32 + 2 * e + 2 * i - h - kk) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return [mo - 1, da]; };
  const cache = {};
  NX.holidays = (y) => {
    if (cache[y]) return cache[y]; const [em, ed] = easter(y);
    const L = [[0, 1, "New Year's Day"], [0, nth(y, 0, 1, 3), "Martin Luther King Jr. Day"], [1, 14, "Valentine's Day"], [1, nth(y, 1, 1, 3), "Presidents' Day"], [2, 17, "St. Patrick's Day"], [em, ed, "Easter"], [4, nth(y, 4, 0, 2), "Mother's Day"], [4, last(y, 4, 1), "Memorial Day"], [5, 19, "Juneteenth"], [5, nth(y, 5, 0, 3), "Father's Day"], [6, 4, "Independence Day"], [8, nth(y, 8, 1, 1), "Labor Day"], [9, 31, "Halloween"], [10, 11, "Veterans Day"], [10, nth(y, 10, 4, 4), "Thanksgiving"], [11, 24, "Christmas Eve"], [11, 25, "Christmas Day"], [11, 31, "New Year's Eve"]];
    return (cache[y] = L.map(([m, d, t]) => ({ id: "hol-" + k(y, m, d), date: k(y, m, d), time: "", title: t, color: "#ef4444", holiday: true })));
  };
  const usRegion = () => { const r = NX.me && NX.prefs().region; return r ? r === "US" : /-US$/i.test(navigator.language || ""); };
  // repeating events: every week, month or year from their first day (shown from a year back to a year ahead)
  NX.occursOn = (e, day) => {
    if (!e.repeat || day < e.date) return e.date === day;
    const a = new Date(e.date + "T12:00"), b = new Date(day + "T12:00");
    if (e.repeat === "week") return Math.round((b - a) / 86400000) % 7 === 0;
    if (e.repeat === "month") return a.getDate() === b.getDate();
    if (e.repeat === "year") return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    return false;
  };
  const expand = (L) => {
    const out = []; const now = new Date(), from = new Date(now.getTime() - 400 * 86400000), to = new Date(now.getTime() + 400 * 86400000);
    for (const e of L) {
      out.push(e); if (!e.repeat) continue;
      const b0 = new Date(e.date + "T12:00"); let n = 0;
      while (n++ < 400) {
        // counted from the first day each time, so the 31st doesn't drift in shorter months (those months are skipped)
        const d = e.repeat === "week" ? new Date(b0.getFullYear(), b0.getMonth(), b0.getDate() + 7 * n, 12) : e.repeat === "month" ? new Date(b0.getFullYear(), b0.getMonth() + n, b0.getDate(), 12) : new Date(b0.getFullYear() + n, b0.getMonth(), b0.getDate(), 12);
        if (d > to) break; const kk = k(d.getFullYear(), d.getMonth(), d.getDate());
        if (d >= from && NX.occursOn(e, kk)) out.push(Object.assign({}, e, { date: kk, occ: true }));
      }
    }
    return out;
  };
  NX.calEvents = () => { const mine = expand(NX.data("events", [])); if (!NX.me || NX.prefs().holidays === false || !usRegion()) return mine; const y = new Date().getFullYear(); return [...mine, ...NX.holidays(y - 1), ...NX.holidays(y), ...NX.holidays(y + 1)]; };
})();

// ---------- on a holiday, the sign-in greeting says so ----------
NX.holidayGreeting = () => {
  const G = { Thanksgiving: "Happy Thanksgiving", Halloween: "Happy Halloween", "Christmas Day": "Merry Christmas", "New Year's Day": "Happy New Year", Easter: "Happy Easter", "Independence Day": "Happy Fourth of July", "Valentine's Day": "Happy Valentine's Day", "Mother's Day": "Happy Mother's Day", "Father's Day": "Happy Father's Day", "St. Patrick's Day": "Happy St. Patrick's Day" };
  const d = new Date(), k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const h = (NX.calEvents ? NX.calEvents() : []).find((e) => e.holiday && e.date === k && G[e.title]); return h ? G[h.title] : "";
};

// ---------- Do not disturb on a schedule (quiet hours): on at dndFrom, off at dndTo, every day ----------
(function () {
  const inHours = (from, to, hm) => (from <= to ? hm >= from && hm < to : hm >= from || hm < to);
  let was = null;
  NX.dndTick = (now) => {
    if (!NX.me) return; const p = NX.prefs(); if (!p.dndSched) { was = null; return; }
    const d = now || new Date(), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const on = inHours(p.dndFrom || "22:00", p.dndTo || "07:00", hm);
    // only at the edges of the quiet hours, so turning it on or off by hand in between still works
    if (on !== was) { was = on; if (!!p.dnd !== on) NX.setPref("dnd", on); }
  };
  setInterval(() => NX.dndTick(), 30000); document.addEventListener("nx:signin", () => { was = null; setTimeout(() => NX.dndTick(), 1500); });
  document.addEventListener("nx:prefs", (e) => { if (/^dnd(Sched|From|To)$/.test(e.detail || "")) { was = null; NX.dndTick(); } });
})();

// ---------- lock screen slideshow: while locked, the lock screen moves through the backgrounds every 90 seconds ----------
(function () {
  let t = 0;
  NX.lockShowNext = () => {
    const n = (NX.wallpapers || []).length; if (!n) return;
    NX.set("lock-wall", ((+NX.get("lock-wall", 0) || 0) + 1) % n);
    document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "lockshow" }));
  };
  setInterval(() => {
    const L = document.getElementById("lock");
    if (!L || L.hidden || NX.me || !NX.get("lock-show", 0)) { t = 0; return; }
    if (++t >= 9) { t = 0; NX.lockShowNext(); }
  }, 10000);
})();

// ---------- screen recording: a red pill shows the time and Stop while the screen is being filmed ----------
(function () {
  let pill = null, t = 0, t0 = 0;
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const show = () => {
    if (pill) return; pill = document.createElement("div"); pill.id = "nx-rec";
    pill.innerHTML = `<i></i><b>0:00</b><button class="btn sm" data-stop>Stop</button>`; document.body.appendChild(pill);
    pill.querySelector("[data-stop]").onclick = () => NX.screenRec.stop();
    t = setInterval(() => { if (pill) pill.querySelector("b").textContent = fmt(Date.now() - t0); }, 500);
  };
  const hide = () => { clearInterval(t); if (pill) pill.remove(); pill = null; };
  NX.screenRec = {
    async start() {
      try { if (NX.shell) NX.shell.closeFlyouts(); NX.minimize && NX.wins.has("snip") && NX.minimize("snip"); for (let k = 3; k > 0; k--) { NX.toast("Recording in " + k + "..."); await new Promise((r) => setTimeout(r, 1000)); }
        await NX.api("POST", "/screenrec/start"); t0 = Date.now(); show(); }
      catch (e) { NX.toast(e.message); }
    },
    async stop() {
      hide();
      try { const r = await NX.api("POST", "/screenrec/stop"); NX.toast("Screen recording saved in Videos."); NX.filesChanged && NX.filesChanged(); return r; }
      catch (e) { NX.toast(e.message); }
    },
  };
  // still recording after the page reloads: bring the pill back
  document.addEventListener("nx:signin", () => { if (NX.native) NX.api("GET", "/screenrec").then((r) => { if (r.recording) { t0 = r.since || Date.now(); show(); } }).catch(() => {}); });
})();

// ---------- Storage Sense: empties Recycle Bin items older than 30 days by itself (Settings > System > Storage) ----------
(function () {
  NX.trashPurge = async (ids) => { if (!ids.length) return; if (NX.native) await NX.api("POST", "/files/purge", { ids }); else NX.setData("vfs-trash", NX.data("vfs-trash", []).filter((t) => !ids.includes(t.id))); };
  NX.storageSense = async (now) => {
    if (!NX.me || !NX.prefs().storageSense || !NX.fs || !NX.fs.trash) return 0;
    const limit = (now || Date.now()) - 30 * 86400000;
    const old = ((await NX.fs.trash().catch(() => ({ entries: [] }))).entries || []).filter((e) => { const t = Date.parse(e.deleted); return isFinite(t) && t < limit; }).map((e) => e.id);
    if (old.length) { await NX.trashPurge(old); if (NX.binCheck) NX.binCheck(); }
    return old.length;
  };
  document.addEventListener("nx:signin", () => setTimeout(() => NX.storageSense(), 6000));
  setInterval(() => NX.storageSense(), 6 * 3600000);
})();

// ---------- battery level over the last 24 hours (Settings > System > Power & battery), kept on this computer ----------
(function () {
  const log = () => { const b = NX.batt && NX.batt(); if (!b || !b.present && b.percent == null) return; const L = NX.get("batt-log", []).filter((x) => Date.now() - x.t < 86400000); const last = L[L.length - 1]; if (last && Date.now() - last.t < 9 * 60000) return; L.push({ t: Date.now(), p: b.percent, c: !!b.charging }); NX.set("batt-log", L.slice(-200)); };
  setInterval(log, 60000); setTimeout(log, 5000);
  NX.battChart = () => {
    const L = NX.get("batt-log", []).filter((x) => Date.now() - x.t < 86400000); if (L.length < 2) return `<p class="s-note s-bnote">A chart of your battery over the last 24 hours shows here once Nebulux OS has been on for a while.</p>`;
    const W = 600, H = 120, t0 = Date.now() - 86400000, x = (t) => ((t - t0) / 86400000) * W, y = (p) => H - 6 - (p / 100) * (H - 12);
    const d = L.map((q, k) => (k ? "L" : "M") + x(q.t).toFixed(1) + " " + y(q.p).toFixed(1)).join(" ");
    const charge = L.map((q, k) => (q.c ? `<rect x="${x(q.t).toFixed(1)}" y="0" width="${Math.max(2, x((L[k + 1] || { t: Date.now() }).t) - x(q.t)).toFixed(1)}" height="${H}" fill="#22c55e26"/>` : "")).join("");
    return `<div class="s-card s-bchart"><div class="s-bch"><b>Battery level</b><small>Last 24 hours</small></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Battery level over the last 24 hours"><defs><linearGradient id="bcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${[25, 50, 75].map((p) => `<line x1="0" x2="${W}" y1="${y(p)}" y2="${y(p)}" class="tm-gl"/>`).join("")}${charge}<path d="${d} L${x(L[L.length - 1].t).toFixed(1)} ${H} L${x(L[0].t).toFixed(1)} ${H} Z" fill="url(#bcg)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg><div class="s-bax"><span>24 hours ago</span><span>12 hours ago</span><span>Now</span></div></div>`;
  };
})();

// ---------- reopen my apps when I sign in (Settings > Apps): the built-in apps that were open come back ----------
(function () {
  const save = () => { if (!NX.me || !NX.prefs().reopenApps) return; const ids = [...NX.wins.values()].filter((w) => !w.el.classList.contains("closing")).map((w) => w.id).filter((id) => NX.apps[id] && !NX.apps[id].url && !NX.apps[id].browser && id !== "settings"); NX.setData("open-apps", ids.slice(0, 8)); };
  NX.reopenSave = save;
  setInterval(save, 20000); addEventListener("beforeunload", save); addEventListener("pagehide", save);
  document.addEventListener("nx:winopen", () => setTimeout(save, 500));
  // signing out closes everything: remember the apps first
  const close0 = NX.closeAll; if (close0) NX.closeAll = (...a) => { if (NX.me && NX.wins.size) save(); return close0(...a); };
  document.addEventListener("nx:signin", (e) => {
    if (e.detail && e.detail.back) return; if (!NX.prefs().reopenApps) return;
    const L = NX.data("open-apps", []).filter((id) => NX.apps[id] && !NX.wins.has(id)); if (!L.length) return;
    setTimeout(() => L.forEach((id, k) => setTimeout(() => NX.open(id), k * 250)), 1200);
  });
})();

// ---------- Alt + F4 on the desktop: "What do you want the computer to do?" ----------
NX.shutDownBox = () => {
  if (!NX.me || document.getElementById("nx-sd")) return; if (NX.shell) NX.shell.closeFlyouts();
  const o = document.createElement("div"); o.id = "nx-sd"; o.className = "nx-pop";
  const opts = [["off", "Shut down"], ["restart", "Restart"], ["sleep", "Sleep"], ["out", "Sign out"], ["lock", "Lock"]];
  o.innerHTML = `<form class="nx-pcard sd-card"><div class="nx-ph">${NX.icon("logo", 40)}<div><b>Shut down Nebulux OS</b><small>What do you want the computer to do?</small></div></div><select class="s-sel sd-sel" aria-label="What to do">${opts.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><div class="nx-pbtns"><button type="button" class="btn" data-sd="cancel">Cancel</button><button class="btn primary" type="submit">OK</button></div></form>`;
  document.body.appendChild(o);
  const close = () => o.remove(), sel = o.querySelector("select");
  o.querySelector("[data-sd=cancel]").onclick = close;
  o.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  o.querySelector("form").onsubmit = (e) => { e.preventDefault(); const k = sel.value, S = NX.shell || {}; close(); if (k === "off" || k === "restart") S.power && S.power(k); else if (k === "sleep") S.sleep && S.sleep(); else if (k === "out") S.signOut && S.signOut(); else S.lockKeep && S.lockKeep(); };
  setTimeout(() => sel.focus(), 30);
};

// ---------- alarm sounds: Beep, Chime or Bells (Settings > Sound) ----------
NX.alarmTone = () => {
  const k = NX.me ? NX.prefs().alarmTone || "beep" : "beep";
  if (k === "beep" || !NX.sounds || !NX.sounds.play) { if (NX.beep) NX.beep(); return; }
  if (k === "chime") NX.sounds.play([[659.25, 0, 0.5, 0.12], [783.99, 0.18, 0.5, 0.12], [1046.5, 0.36, 0.8, 0.1]]);
  else NX.sounds.play([[1318.5, 0, 0.9, 0.09], [1567.98, 0.12, 0.9, 0.08], [1318.5, 0.5, 0.9, 0.09], [1567.98, 0.62, 0.9, 0.08]]);
};
