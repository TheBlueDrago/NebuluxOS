// The Windows 11 touches: Task View (Nebulux + Tab), Widgets with the weather (Nebulux + W), snap layouts on the
// maximize button, and the Desktop folder's files on the desktop.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);

  // ---------- Task View: every open window at once ----------
  NX.taskView = () => {
    const tv = $("#taskview"); if (!tv.hidden) { tv.hidden = true; return; }
    NX.shell.closeFlyouts();
    const list = [...NX.wins.values()].filter(((w) => !w.desk || !NX.desks || w.desk === NX.desks.current())).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex));
    tv.innerHTML = `<div class="tv-grid">${list.length ? list.map((w) => `<div class="tv-card" data-id="${w.id}" tabindex="0" role="button" aria-label="${NX.esc(w.app.name)}"><div class="tv-top">${NX.icon(w.app.icon || w.id, 18)}<span>${NX.esc(w.el.querySelector(".wt-name").textContent)}</span><button class="tv-x" data-x="${w.id}" aria-label="Close ${NX.esc(w.app.name)}">${NX.icon("close", 14)}</button></div><div class="tv-face">${NX.icon(w.app.icon || w.id, 64)}</div></div>`).join("") : `<p class="tv-none">No windows are open.</p>`}</div><div class="tv-desk"><span>${NX.icon("display", 16)}Desktop</span></div>`;
    tv.hidden = false;
    // 4.0: each card shows a live miniature of its window (apps with a website inside keep their icon)
    tv.querySelectorAll(".tv-card").forEach((card) => {
      const w = NX.wins.get(card.dataset.id), face = card.querySelector(".tv-face"); if (!w || !face || w.el.querySelector("iframe")) return;
      const r = { width: w.el.offsetWidth, height: w.el.offsetHeight }; if (!r.width || !r.height) return;
      const FW = face.clientWidth || 300, FH = face.clientHeight || 180, k = Math.min(FW / r.width, FH / r.height);
      const c = w.el.cloneNode(true); c.removeAttribute("id"); c.removeAttribute("data-app"); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); c.classList.remove("opening", "closing", "minimized", "offdesk", "maxed");
      Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: r.width + "px", height: r.height + "px", transform: "translate(" + Math.round((FW - r.width * k) / 2) + "px," + Math.round((FH - r.height * k) / 2) + "px) scale(" + k + ")", transformOrigin: "0 0", pointerEvents: "none", margin: 0, zIndex: 0, opacity: 1 });
      c.setAttribute("aria-hidden", "true"); c.inert = true; face.innerHTML = ""; face.classList.add("tv-live"); face.appendChild(c);
    });
    if (NX.desks) NX.desks.strip(tv, () => { tv.hidden = true; NX.taskView(); });
    tv.querySelectorAll("[data-id]").forEach((c) => { c.onclick = (e) => { if (e.target.closest("[data-x]")) return; tv.hidden = true; NX.focus(c.dataset.id); }; c.onkeydown = (e) => { if (e.key === "Enter") c.click(); }; });
    tv.querySelectorAll("[data-x]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); NX.close(b.dataset.x); tv.hidden = true; NX.taskView(); }));
    tv.onclick = (e) => { if (e.target === tv || (e.target.closest(".tv-desk") && !e.target.closest(".tv-desks"))) tv.hidden = true; };
    const first = tv.querySelector(".tv-card"); if (first) first.focus();
  };
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#taskview").hidden) $("#taskview").hidden = true; });

  // ---------- Widgets: the weather where you are, the date, and your recent files ----------
  const WX = [[0, "Clear", "sun"], [2, "Partly cloudy", "partly"], [3, "Cloudy", "cloud"], [48, "Fog", "fog"], [57, "Drizzle", "rain"], [67, "Rain", "rain"], [77, "Snow", "snow"], [82, "Rain showers", "rain"], [86, "Snow showers", "snow"], [99, "Thunderstorms", "storm"]];
  const wx = (code) => (WX.find((x) => code <= x[0]) || WX[WX.length - 1]);
  const WICON = {
    sun: `<circle cx="24" cy="24" r="8" fill="#fbbf24"/><g stroke="#fbbf24" stroke-width="3" stroke-linecap="round"><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l3.5 3.5M33.5 33.5L37 37M11 37l3.5-3.5M33.5 14.5L37 11"/></g>`,
    partly: `<circle cx="18" cy="18" r="7" fill="#fbbf24"/><path d="M16 36h18a7 7 0 000-14 9 9 0 00-17 2 6 6 0 00-1 12z" fill="#e2e8f0"/>`,
    cloud: `<path d="M13 36h21a8 8 0 000-16 10 10 0 00-19 3 6.5 6.5 0 00-2 13z" fill="#cbd5e1"/>`,
    fog: `<g stroke="#cbd5e1" stroke-width="3.5" stroke-linecap="round"><path d="M10 18h28M8 25h32M12 32h24"/></g>`,
    rain: `<path d="M13 28h21a8 8 0 000-16 10 10 0 00-19 3 6.5 6.5 0 00-2 13z" fill="#cbd5e1"/><g stroke="#60a5fa" stroke-width="3" stroke-linecap="round"><path d="M17 33l-2 6M25 33l-2 6M33 33l-2 6"/></g>`,
    snow: `<path d="M13 28h21a8 8 0 000-16 10 10 0 00-19 3 6.5 6.5 0 00-2 13z" fill="#e2e8f0"/><g fill="#fff"><circle cx="17" cy="36" r="2"/><circle cx="25" cy="39" r="2"/><circle cx="33" cy="36" r="2"/></g>`,
    storm: `<path d="M13 26h21a8 8 0 000-16 10 10 0 00-19 3 6.5 6.5 0 00-2 13z" fill="#94a3b8"/><path d="M25 27l-6 9h5l-3 8 8-11h-5l3-6z" fill="#fbbf24"/>`,
  };
  const wIcon = (k, s) => `<svg viewBox="0 0 48 48" width="${s}" height="${s}" aria-hidden="true">${WICON[k] || WICON.cloud}</svg>`;
  const fahrenheit = () => { const r = NX.me && NX.prefs().region; return r ? ["US", "LR", "MM"].includes(r) : /-(US|LR|MM)$/i.test(navigator.language || ""); };
  // shared with the Weather app (js/app-more.js)
  NX.wxInfo = { icon: (code, s) => wIcon(wx(code)[2], s), name: (code) => wx(code)[1], fahrenheit, refresh: () => weather(true).then((w) => { tbWidget(w); return w; }) };
  let wxBusy = false;
  async function weather(force) {
    const place = NX.data("wx-place", null); if (!place) return null;
    const cached = NX.data("wx", null);
    if (!force && cached && cached.key === place.name && Date.now() - cached.at < 30 * 60000) return cached;
    if (wxBusy || !NX.netOK()) return cached; wxBusy = true;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4${fahrenheit() ? "&temperature_unit=fahrenheit" : ""}`;
      const j = await (await fetch(u)).json();
      const w = { key: place.name, at: Date.now(), unit: fahrenheit() ? "F" : "C", now: Math.round(j.current.temperature_2m), code: j.current.weather_code, days: j.daily.time.map((t, i) => ({ t, code: j.daily.weather_code[i], hi: Math.round(j.daily.temperature_2m_max[i]), lo: Math.round(j.daily.temperature_2m_min[i]) })) };
      NX.setData("wx", w); NX.set("wx-lock", { now: w.now, unit: w.unit, code: w.code, at: w.at }); return w; // (the lock screen shows the last weather too)
    } catch (e) { return cached; } finally { wxBusy = false; }
  }
  function tbWidget(w) {
    const b = $("#tb-widgets"); if (!b) return;
    b.innerHTML = w ? `${wIcon(wx(w.code)[2], 22)}<span><b>${w.now}°${w.unit}</b><small>${wx(w.code)[1]}</small></span>` : `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><rect x="7" y="7" width="15" height="15" rx="3" fill="#60a5fa"/><rect x="26" y="7" width="15" height="15" rx="3" fill="#a78bfa"/><rect x="7" y="26" width="15" height="15" rx="3" fill="#34d399"/><rect x="26" y="26" width="15" height="15" rx="3" fill="#f472b6"/></svg><span><b>Widgets</b></span>`;
  }
  async function widgetsDraw() {
    const W = $("#widgets"), d = new Date(), place = NX.data("wx-place", null), w = place ? await weather() : null;
    const files = NX.prefs().showrecent === false ? [] : NX.data("recent-files", []).slice(0, 4);
    W.innerHTML = `<div class="wg-head"><b>${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b><span>${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div>
      <div class="wg-grid"><section class="wg-card wg-wx">${place ? (w ? `<div class="wg-wxnow">${wIcon(wx(w.code)[2], 56)}<div><b>${w.now}°${w.unit}</b><span>${wx(w.code)[1]}</span><small>${NX.esc(place.name)}</small></div></div><div class="wg-days">${w.days.slice(1).map((x) => `<div>${new Date(x.t + "T12:00").toLocaleDateString(undefined, { weekday: "short" })}${wIcon(wx(x.code)[2], 26)}<span>${x.hi}° <small>${x.lo}°</small></span></div>`).join("")}</div>` : `<p class="wg-note">${NX.netOK() ? "Getting the weather..." : "Connect to the internet to see the weather."}</p>`) + `<button class="wg-link" data-wx="change">Change city</button>`
        : `<h4>Weather</h4><p class="wg-note">Type your city to see its weather.</p>`}<form class="wg-city" ${place ? "hidden" : ""}><input placeholder="Your city" aria-label="Your city" maxlength="60"><button class="btn primary" type="submit">Show</button><button class="wg-link wg-here" type="button" data-wx="here">Use my location</button></form><p class="wg-err"></p></section>
      <section class="wg-card"><h4>Recent files</h4>${files.length ? files.map((f, i) => `<button class="wg-file" data-rf="${i}">${NX.icon({ image: "fimage", video: "fvideo", audio: "faudio", text: "ftext" }[f.kind] || "file", 22)}<span>${NX.esc(f.name)}</span></button>`).join("") : `<p class="wg-note">Files you open will show up here.</p>`}<button class="wg-link" data-open="files">Open File Explorer</button></section>
      <section class="wg-card wg-notes"><h4>Sticky Notes</h4>${(() => { const ns = NX.data("sticky-notes", []).filter((n) => n.t.trim()).slice(0, 3); return ns.length ? ns.map((n) => `<button class="wg-note1 c-${n.c}" data-note="${n.id}">${NX.esc(n.t.length > 120 ? n.t.slice(0, 120) + "..." : n.t)}</button>`).join("") : `<p class="wg-note">Notes you write in Sticky Notes show up here.</p>`; })()}<button class="btn wg-nbtn" data-open="notes">${NX.icon("plus", 14)}New note</button></section>
      ${NX.batt && NX.batt() ? `<section class="wg-card wg-batt"><h4>Battery</h4><div class="wg-bnow">${NX.battIcon(48)}<div><b>${NX.batt().percent}%</b><span>${NX.batt().charging ? "Charging" : NX.saverOn() ? "Battery saver is on" : "On battery"}</span>${NX.battLeft() ? `<span>${NX.battLeft()}</span>` : ""}</div></div><button class="btn" data-open="power">Power &amp; battery settings</button></section>` : ""}
      ${NX.dwHTML ? ["events", "todos", "photo"].map((k) => NX.dwHTML(k).replace('class="dw ', 'class="wg-card wg-dw dw ')).join("") : ""}
      ${(() => { const T = NX.timers ? NX.timers.list().filter((t) => t.on) : []; if (!T.length) return ""; const mm = (ms) => { const s2 = Math.ceil(ms / 1000), h = Math.floor(s2 / 3600), m = Math.floor((s2 % 3600) / 60), x = s2 % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }; return `<section class="wg-card wg-tmr" data-wgclock><h4>Timers</h4>${T.slice(0, 3).map((t) => `<div class="wg-tm"><b data-wgt="${t.id}">${mm(NX.timers.left(t))}</b><span>${NX.esc(t.name)}</span></div>`).join("")}</section>`; })()}
      <section class="wg-card"><h4>Shortcuts</h4><p class="wg-note"><b>Nebulux + V</b> opens your clipboard history. <b>Ctrl + Nebulux + D</b> adds a desktop, and <b>Ctrl + Nebulux + Left or Right</b> switches between them. <b>Nebulux + Tab</b> shows all your windows and desktops. <b>Nebulux + Left or Right</b> snaps a window to half the screen.</p></section></div>`;
    // running timers count down here and open Clock when clicked
    { const tc = W.querySelector("[data-wgclock]"); if (tc) { tc.onclick = () => { NX.shell.closeFlyouts(); NX.open("clock"); }; clearInterval(W.nxTmT); W.nxTmT = setInterval(() => { if (!tc.isConnected) { clearInterval(W.nxTmT); return; } tc.querySelectorAll("[data-wgt]").forEach((b) => { const t = NX.timers.get(b.dataset.wgt); if (!t) return; const s2 = Math.ceil(NX.timers.left(t) / 1000), h = Math.floor(s2 / 3600), m = Math.floor((s2 % 3600) / 60), x = s2 % 60; b.textContent = (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }); }, 1000); } }
    W.querySelectorAll(".wg-dw[data-dw]").forEach((c) => (c.onclick = () => { NX.shell.closeFlyouts(); NX.open(c.dataset.dw === "events" ? "calendar" : c.dataset.dw === "photo" ? "photos" : "reminders"); }));
    const f = $(".wg-city", W);
    f.onsubmit = async (e) => {
      e.preventDefault(); const q = f.querySelector("input").value.trim(), er = $(".wg-err", W); if (!q) return;
      if (!NX.netOK()) { er.textContent = NX.netWhy(); return; }
      er.textContent = "Looking it up...";
      try {
        const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(q))).json();
        const r = g.results && g.results[0]; if (!r) { er.textContent = "That city wasn't found. Try its full name."; return; }
        NX.setData("wx-place", { name: r.name + (r.admin1 ? ", " + r.admin1 : r.country ? ", " + r.country : ""), lat: r.latitude, lon: r.longitude });
        const w2 = await weather(true); tbWidget(w2); widgetsDraw();
      } catch (er2) { er.textContent = "The weather service didn't answer. Try again in a moment."; }
    };
    const ch = $("[data-wx=change]", W); if (ch) ch.onclick = () => { f.hidden = false; f.querySelector("input").focus(); };
    // Use my location: the city this internet connection is in (only when you press it; nothing is saved but the city)
    $("[data-wx=here]", W).onclick = async () => {
      const er = $(".wg-err", W); if (!NX.netOK()) { er.textContent = NX.netWhy(); return; }
      er.textContent = "Finding where you are...";
      try {
        const j = await (await fetch("https://ipapi.co/json/")).json();
        if (!(isFinite(j.latitude) && isFinite(j.longitude))) throw new Error("no place");
        NX.setData("wx-place", { name: (j.city || "Your area") + (j.region ? ", " + j.region : j.country_name ? ", " + j.country_name : ""), lat: +j.latitude, lon: +j.longitude });
        const w2 = await weather(true); tbWidget(w2); widgetsDraw();
      } catch (e) { er.textContent = "Your location couldn't be found. Type your city instead."; }
    };
    W.querySelectorAll("[data-rf]").forEach((b) => (b.onclick = () => { const file = NX.data("recent-files", [])[+b.dataset.rf]; NX.shell.closeFlyouts(); if (file) NX.openFile(file); }));
    $("[data-open=files]", W).onclick = () => { NX.shell.closeFlyouts(); NX.open("files"); };
    $("[data-open=notes]", W).onclick = () => { NX.shell.closeFlyouts(); NX.open("notes"); setTimeout(() => { const b = document.querySelector(".win[data-app=notes] [data-a=new]"); if (b) b.click(); }, 80); };
    W.querySelectorAll("[data-note]").forEach((b) => (b.onclick = () => { NX.shell.closeFlyouts(); NX.open("notes"); setTimeout(() => { const t = document.querySelector('.win[data-app=notes] [data-id="' + b.dataset.note + '"] textarea'); if (t) t.focus(); }, 80); }));
    const pw = $("[data-open=power]", W); if (pw) pw.onclick = () => { NX.shell.closeFlyouts(); NX.open("settings", { page: "system" }); };
    tbWidget(w);
  }
  NX.widgets = () => { const W = $("#widgets"); if (!W.hidden) { NX.shell.closeFlyouts(); return; } NX.shell.closeFlyouts("widgets"); W.hidden = false; widgetsDraw(); };
  document.addEventListener("nx:signin", () => { tbWidget(NX.data("wx", null) && NX.data("wx-place", null) ? NX.data("wx") : null); weather().then((w) => tbWidget(w)); });
  setInterval(() => { if (NX.me && NX.data("wx-place", null)) weather().then((w) => tbWidget(w)); }, 10 * 60000);

  // ---------- snap layouts: hover over the maximize button ----------
  const LAYOUTS = [
    [[0, 0, .5, 1], [.5, 0, .5, 1]],
    [[0, 0, .66, 1], [.66, 0, .34, 1]],
    [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]],
    [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
    // wide screens: three columns, and a wide middle with narrow sides
    [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
    [[0, 0, .25, 1], [.25, 0, .5, 1], [.75, 0, .25, 1]],
  ];
  const layouts = () => (innerWidth >= 1200 ? LAYOUTS : LAYOUTS.slice(0, 4));
  let hoverT = 0, fly = null;
  const hideFly = () => { clearTimeout(hoverT); const s = $("#snapfly"); if (s) s.hidden = true; fly = null; };
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest && e.target.closest(".wb-max"); if (!b || e.pointerType === "touch") return;
    const win = b.closest(".win"); if (!win || innerWidth < 700) return;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => showFly(b, win), 550);
  });
  // the snap layouts under a window's maximize button (also Nebulux + Z for the window you're using)
  function showFly(b, win) {
    {
      const s = $("#snapfly"), r = b.getBoundingClientRect(), id = win.dataset.app; fly = id;
      s.innerHTML = layouts().map((L, i) => `<div class="sf-lay">${L.map((z, k) => `<button class="sf-zone" data-l="${i}" data-z="${k}" style="left:${z[0] * 100}%;top:${z[1] * 100}%;width:${z[2] * 100}%;height:${z[3] * 100}%" aria-label="Snap here"></button>`).join("")}</div>`).join("");
      s.hidden = false; const sr = s.getBoundingClientRect();
      s.style.left = Math.max(8, Math.min(innerWidth - sr.width - 8, r.right - sr.width + 20)) + "px"; s.style.top = (r.bottom + 6) + "px";
      s.querySelectorAll(".sf-zone").forEach((z) => (z.onclick = (ev) => { ev.stopPropagation(); const zz = LAYOUTS[+z.dataset.l][+z.dataset.z]; hideFly(); NX.snapRect(id, ...zz); }));
    }
  }
  NX.snapLayoutsKey = () => { const w = NX.topWin && NX.topWin(); if (!w || innerWidth < 700) return; const b = w.el.querySelector(".wb-max"); if (b) { showFly(b, w.el); const z = $("#snapfly .sf-zone"); if (z) z.focus(); } };
  document.addEventListener("nx:key", (e) => { if (e.detail === "snapz" && NX.me) setTimeout(NX.snapLayoutsKey, 0); }); // after the shell closes its menus for the key
  addEventListener("keydown", (e) => { if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); NX.snapLayoutsKey(); } }, true);
  document.addEventListener("pointerout", (e) => {
    const from = e.target.closest && (e.target.closest(".wb-max") || e.target.closest("#snapfly")); if (!from) return;
    const to = e.relatedTarget && e.relatedTarget.closest && (e.relatedTarget.closest(".wb-max") || e.relatedTarget.closest("#snapfly"));
    if (!to) { clearTimeout(hoverT); setTimeout(() => { const s = $("#snapfly"); if (s && !s.matches(":hover")) hideFly(); }, 250); }
  });
  document.addEventListener("pointerdown", (e) => { if (fly && !e.target.closest("#snapfly")) hideFly(); }, true);

  // ---------- the Desktop folder on the desktop ----------
  const FICON = { folder: "folder", image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };
  let deskGen = 0;
  async function deskFiles() {
    const box = $("#icons"); if (!NX.me || !box || !NX.fs) return; const gen = ++deskGen;
    let list = []; try { list = (await NX.fs.list(await NX.folder("Desktop"))).entries; } catch (e) { list = []; }
    if (gen !== deskGen) return;
    box.querySelectorAll(".dicon.dfile").forEach((x) => x.remove());
    const used = +box.dataset.apps || 0, rows = +box.dataset.rows || 6;
    // Stacks (desktop right-click > Use stacks): files grouped into one pile per kind, like macOS
    if (NX.prefs().stacks && list.length) {
      const G = [["Folders", (x) => x.dir, "folder"], ["Pictures", (x) => x.kind === "image", "fimage"], ["Movies", (x) => x.kind === "video", "fvideo"], ["Music", (x) => x.kind === "audio", "faudio"], ["Documents", (x) => x.kind === "text" || x.kind === "pdf", "ftext"], ["Other", () => true, "file"]];
      const left = list.slice(0, 200), groups = [];
      for (const [n, test, ic] of G) { const items = left.filter((x) => !x.taken && test(x)); items.forEach((x) => (x.taken = 1)); if (items.length) groups.push({ n, ic, items }); }
      groups.forEach((g, j) => {
        const i = used + j, b = document.createElement("button");
        b.className = "dicon dfile dstack"; b.style.gridRow = (i % rows) + 1; b.style.gridColumn = Math.floor(i / rows) + 1; b.title = g.n;
        b.innerHTML = `<span class="st-pile"><i></i><i></i>${NX.icon(g.ic, 40)}</span><span>${g.n} <small>${g.items.length}</small></span>`;
        b.onclick = (e) => { e.stopPropagation(); stackOpen(b, g, list); };
        box.appendChild(b);
      });
      return;
    }
    list.slice(0, 60).forEach((f, j) => {
      const i = used + j, b = document.createElement("button");
      b.className = "dicon dfile"; b.style.gridRow = (i % rows) + 1; b.style.gridColumn = Math.floor(i / rows) + 1; b.title = f.name;
      b.innerHTML = `${f.kind === "image" ? `<span class="d-thumb">${NX.icon("fimage", 40)}</span>` : NX.icon(FICON[f.kind] || "file", 40)}<span>${NX.esc(f.name)}</span>`;
      b.onclick = (e) => { e.stopPropagation(); box.querySelectorAll(".dicon").forEach((x) => x.classList.toggle("sel", x === b)); NX.openFile(f, list); };
      b.onkeydown = (e) => { if (e.key === "Enter") NX.openFile(f, list); };
      b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); NX.menu(e.clientX, e.clientY, [["Open", () => NX.openFile(f, list)], ["Show in File Explorer", () => NX.open("files", { place: "Desktop" })], ["Delete", async () => { try { await NX.fs.remove([f.path]); NX.toast("Moved to the Recycle Bin."); NX.filesChanged(); } catch (er) { NX.toast(er.message); } }]]); };
      box.appendChild(b);
      if (f.kind === "image") NX.fs.url(f.path).then((u) => { const t = b.querySelector(".d-thumb"); if (t) t.innerHTML = `<img src="${NX.esc(u)}" alt="">`; }).catch(() => {});
    });
  }
  // an open stack: its files fan out in a card next to the pile
  function stackOpen(btn, g, list) {
    let o = document.getElementById("nx-stack"); if (o) { const same = o.dataset.n === g.n; o.remove(); if (same) return; }
    o = document.createElement("div"); o.id = "nx-stack"; o.dataset.n = g.n;
    o.innerHTML = `<b>${NX.esc(g.n)}</b><div class="stk-grid">${g.items.map((f, k) => `<button data-k="${k}" title="${NX.esc(f.name)}" style="--k:${Math.min(k, 12)}">${f.kind === "image" ? `<span class="d-thumb">${NX.icon("fimage", 40)}</span>` : NX.icon(f.dir ? "folder" : FICON[f.kind] || "file", 40)}<span>${NX.esc(f.name)}</span></button>`).join("")}</div><button class="btn sm stk-show">Show in File Explorer</button>`;
    document.getElementById("desktop").appendChild(o);
    const r = btn.getBoundingClientRect(), w = o.offsetWidth, h = o.offsetHeight;
    o.style.left = Math.min(innerWidth - w - 10, r.right + 8) + "px"; o.style.top = Math.max(10, Math.min(innerHeight - h - 70, r.top - 10)) + "px";
    o.querySelectorAll("[data-k]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); o.remove(); NX.openFile(g.items[+b.dataset.k], list); }));
    o.querySelector(".stk-show").onclick = () => { o.remove(); NX.open("files", { place: "Desktop" }); };
    g.items.forEach((f, k) => { if (f.kind === "image") NX.fs.url(f.path).then((u) => { const t = o.querySelector(`[data-k="${k}"] .d-thumb`); if (t) t.innerHTML = `<img src="${NX.esc(u)}" alt="">`; }).catch(() => {}); });
  }
  document.addEventListener("pointerdown", (e) => { const o = document.getElementById("nx-stack"); if (o && !e.target.closest("#nx-stack, .dstack")) o.remove(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") { const o = document.getElementById("nx-stack"); if (o) o.remove(); } }, true);
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "stacks") { const o = document.getElementById("nx-stack"); if (o) o.remove(); deskFiles(); } });
  document.addEventListener("nx:icons", deskFiles);
  document.addEventListener("nx:files", () => { if (NX.me) deskFiles(); });
  NX.desktopNew = async (folder) => {
    try {
      const dir = await NX.folder("Desktop");
      const host = document.getElementById("desktop");
      const name = await NX.ask(host, { title: folder ? "New folder" : "New text document", input: true, value: folder ? "New folder" : "New text document.txt", ok: "Make it" });
      if (!name) return; await NX.fs.create(dir, name, folder); NX.filesChanged();
    } catch (e) { NX.toast(e.message); }
  };

  // ---------- taskbar buttons ----------
  function wire() {
    const tw = $("#tb-widgets"), tv = $("#tb-tview");
    if (tw) { tbWidget(null); tw.onclick = (e) => { e.stopPropagation(); NX.widgets(); }; }
    if (tv) tv.onclick = (e) => { e.stopPropagation(); NX.taskView(); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
