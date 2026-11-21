// Nebulux OS shell: boot, lock screen and sign-in, the desktop with icons, the taskbar, Start, quick settings, the
// calendar, notifications and power (sign out, restart, shut down).
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const visibleApps = () => { const p = NX.prefs(); return Object.keys(NX.apps).filter((id) => NX.apps[id].builtIn || p.installed.includes(id)); };
  NX.fmtTime = (d, sec) => d.toLocaleTimeString([], { hour: NX.prefs().clock24 ? "2-digit" : "numeric", minute: "2-digit", second: sec ? "2-digit" : undefined, hour12: !NX.prefs().clock24 });
  NX.notes = [];
  NX.toast = (text) => {
    NX.notes.unshift({ text: String(text), at: Date.now() }); NX.notes.length = Math.min(NX.notes.length, 30); NX.unread = (NX.unread || 0) + 1;
    if (NX.me) { const c = document.getElementById("tb-badge"); if (c) { c.textContent = NX.unread > 9 ? "9+" : NX.unread; c.hidden = false; } }
    if (NX.me && NX.prefs().dnd) return; // Do not disturb: kept in the notification center, not shown
    const box = $("#toasts"), t = document.createElement("div"); t.className = "toast"; t.innerHTML = `${NX.icon("logo", 18)}<span>${NX.esc(text)}</span>`;
    box.appendChild(t); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add("out"), 3200); setTimeout(() => t.remove(), 3600);
  };
  // the internet: this computer's real connection, plus the OS's own Wi-Fi switch and airplane mode
  NX.online = () => navigator.onLine !== false;
  NX.netOK = () => { const p = NX.prefs(); return NX.native ? NX.online() : NX.online() && p.wifi && !p.airplane; }; // on the real OS, a cable counts too
  NX.netWhy = () => { const p = NX.prefs(); if (NX.native) return p.airplane ? "Airplane mode is on. Turn it off and connect to Wi-Fi to go online." : "This computer isn't connected to the internet. Connect to Wi-Fi in quick settings or Settings."; return p.airplane ? "Airplane mode is on. Turn it off in quick settings to go online." : !p.wifi ? "Wi-Fi is off. Turn it on in quick settings to go online." : "This computer isn't connected to the internet."; };
  const netChange = (on) => { if (NX.me) { tray(); NX.toast(on ? "You're back online." : "The internet connection was lost."); } document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "net" })); };
  addEventListener("online", () => netChange(true)); addEventListener("offline", () => netChange(false));
  let actx = null;
  NX.beep = (f) => { try { const v = NX.prefs().volume / 100; if (!v) return; actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f || 880; o.type = "sine"; g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.18 * v, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.35); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.4); } catch (e) { /* no sound */ } };

  // ---------- look: theme, accent, wallpaper, brightness, night light ----------
  let lastWall = null;
  function applyLook() {
    const p = NX.prefs(), root = document.documentElement;
    root.dataset.theme = NX.me ? p.theme : "dark"; root.style.setProperty("--accent", p.accent);
    root.classList.toggle("nofx", !NX.fx());
    const wall = NX.wallpaperURL(NX.me ? p.wallpaper : 0, innerWidth * Math.min(2, devicePixelRatio || 1), innerHeight * Math.min(2, devicePixelRatio || 1));
    if (wall !== lastWall) { lastWall = wall; root.style.setProperty("--wall", `url(${wall})`); }
    $("#dim").style.opacity = NX.me && !NX.hw.brightness ? ((100 - p.brightness) / 100) * 0.75 : 0; $("#night").classList.toggle("on", !!(NX.me && p.night));
    $("#desktop").classList.toggle("tb-left", p.align === "left");
  }
  let resizeT = 0; addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { applyLook(); if (NX.me) icons(); }, 150); });
  document.addEventListener("nx:prefs", (e) => { applyLook(); const k = e.detail; if (["installed", "pinned", "desktop", "align"].includes(k)) { icons(); taskbar(); } if (["wifi", "bt", "airplane", "volume", "brightness", "night", "theme", "net", "battery", "dnd"].includes(k)) { tray(); if (!$("#qs").hidden) qsDraw(); } if (k === "clock24") clock(); });

  NX.fx = () => { const v = NX.me ? NX.prefs().transparency : undefined; return v == null ? !NX.native : !!v; };
  NX.fast = /[?&]fast(&|=|$)/.test(location.search); // tests skip the boot animation
  // ---------- boot ----------
  function boot() {
    const b = $("#boot"); b.hidden = false; $("#lock").hidden = true; $("#desktop").hidden = true; $("#off").hidden = true;
    if (NX.native && !boot.again) { boot.again = true; b.hidden = true; lock(); return; }
    applyLook(); setTimeout(() => { b.classList.add("out"); setTimeout(() => { b.hidden = true; b.classList.remove("out"); lock(); }, 400); }, NX.fast ? 50 : NX.native ? 500 : 1300);
  }

  // ---------- lock screen and sign-in ----------
  let lockT = 0, chosen = null, mode = "";
  function lock(clockFirst) {
    NX.me = null; applyLook(); const L = $("#lock"); L.hidden = false; L.className = clockFirst ? "locked" : "signin"; $("#desktop").hidden = true;
    const tick = () => { const d = new Date(); $("#lk-time").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""); $("#lk-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); };
    tick(); clearInterval(lockT); lockT = setInterval(tick, 1000);
    const users = NX.users(); chosen = (users.find((u) => u.id === NX.get("lastUser")) || users[0] || null); mode = users.length ? "signin" : "setup";
    signinDraw();
    if (!clockFirst) setTimeout(() => { const i = $("#lock input"); if (i) i.focus(); }, 60);
  }
  function reveal() { const L = $("#lock"); if (L.className !== "locked") return; L.className = "signin"; setTimeout(() => { const i = $("#lock input"); if (i) i.focus(); }, 260); }
  function signinDraw() {
    const users = NX.users(), box = $("#lk-panel");
    if (mode === "setup") {
      box.innerHTML = `<div class="lk-av new">${NX.icon("logo", 64)}</div><h2>${users.length ? "Add an account" : "Welcome to Nebulux OS"}</h2><p class="lk-sub">${users.length ? "Make a new account on this PC." : (NX.native ? "Make your account to get started. It stays on this computer." : "Make your account to get started. It stays on this PC, in this browser.")}</p>
        <form class="lk-form" autocomplete="off"><input name="n" maxlength="24" placeholder="Your name" aria-label="Your name" autocomplete="username"><input name="p" type="password" maxlength="64" placeholder="Password" aria-label="Password" autocomplete="new-password"><input name="p2" type="password" maxlength="64" placeholder="Password again" aria-label="Password again" autocomplete="new-password"><button class="btn primary wide" type="submit">Make my account</button></form><p class="lk-err" role="alert"></p>
        ${users.length ? `<button class="lk-link" data-a="back">Back to sign in</button>` : ""}`;
      const f = $(".lk-form", box), er = $(".lk-err", box);
      f.onsubmit = async (e) => {
        e.preventDefault(); const n = f.n.value, p = f.p.value;
        if (p !== f.p2.value) { er.textContent = "The two passwords don't match."; return; }
        const btn = $("button", f); btn.disabled = true; er.textContent = "";
        try { const u = await NX.addUser(n, p); enter(u); } catch (err) { er.textContent = err.message; btn.disabled = false; }
      };
    } else {
      const u = chosen;
      box.innerHTML = `<div class="lk-av" style="background:${u.color}">${NX.esc(u.name[0].toUpperCase())}</div><h2>${NX.esc(u.name)}</h2>
        <form class="lk-form pw"><input name="p" type="password" maxlength="64" placeholder="Password" aria-label="Password" autocomplete="current-password"><button class="lk-go" type="submit" aria-label="Sign in">${NX.icon("arrow", 18)}</button></form><p class="lk-err" role="alert"></p>
        <button class="lk-link" data-a="forgot">I forgot my password</button>`;
      const f = $(".lk-form", box), er = $(".lk-err", box);
      f.onsubmit = async (e) => {
        e.preventDefault(); const p = f.p.value; if (!p) { er.textContent = "Type your password."; return; }
        const btn = $("button", f); btn.disabled = true; er.textContent = ""; box.classList.add("busy");
        try { const me = await NX.checkPassword(u.id, p); enter(me); } catch (err) { er.textContent = err.message; f.p.value = ""; btn.disabled = false; box.classList.remove("busy"); f.p.focus(); box.classList.add("shake"); setTimeout(() => box.classList.remove("shake"), 400); }
      };
    }
    $("#lk-users").innerHTML = users.length ? users.map((x) => `<button class="lk-user ${chosen && x.id === chosen.id && mode !== "setup" ? "on" : ""}" data-u="${x.id}"><span class="av" style="background:${x.color}">${NX.esc(x.name[0].toUpperCase())}</span><span>${NX.esc(x.name)}</span></button>`).join("") + (users.length < 8 ? `<button class="lk-user ${mode === "setup" ? "on" : ""}" data-a="add"><span class="av plus">+</span><span>Add account</span></button>` : "") : "";
    document.querySelectorAll("#lock [data-u]").forEach((b) => (b.onclick = () => { chosen = NX.users().find((x) => x.id === b.dataset.u); mode = "signin"; signinDraw(); reveal(); setTimeout(() => { const i = $("#lock input"); i && i.focus(); }, 30); }));
    document.querySelectorAll("#lock [data-a]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === "add") { mode = "setup"; signinDraw(); reveal(); setTimeout(() => { const i = $("#lock input"); i && i.focus(); }, 30); }
      if (a === "back") { mode = "signin"; chosen = chosen || NX.users()[0]; signinDraw(); }
      if (a === "forgot") { $(".lk-err").textContent = "Passwords on Nebulux OS stay on this PC and can't be recovered. You can add a new account below."; }
    }));
  }
  function enter(u) {
    const back = lockedBy === u.id; if (lockedBy && !back) NX.closeAll(); lockedBy = null; // someone else signing in doesn't see your apps
    NX.me = u; NX.set("lastUser", u.id); clearInterval(lockT);
    const L = $("#lock"); L.className = "out"; setTimeout(() => { L.hidden = true; }, 350);
    $("#desktop").hidden = false; applyLook(); icons(); taskbar(); tray(); clock(); closeFlyouts();
    document.dispatchEvent(new CustomEvent("nx:signin"));
    NX.unread = 0; const bd = document.getElementById("tb-badge"); if (bd) bd.hidden = true;
    if (!back) setTimeout(() => NX.toast("Welcome, " + u.name + "."), 500);
  }
  function signOut() { lockedBy = null; closeFlyouts(); NX.closeAll(); setTimeout(lock, 160); }
  // Lock: the lock screen comes up, and your apps stay open behind it
  let lockedBy = null;
  function lockKeep() { if (!NX.me) return; lockedBy = NX.me.id; closeFlyouts(); lock(true); }
  function power(kind) {
    closeFlyouts(); NX.closeAll(); NX.me = null;
    const o = $("#off"); o.hidden = false; o.innerHTML = `<div class="off-msg">${NX.icon("logo", 56)}<span class="spin"></span><b>${kind === "restart" ? "Restarting" : "Shutting down"}</b></div>`;
    $("#desktop").hidden = true; $("#lock").hidden = true;
    if (NX.native) { // the real computer restarts or turns off
      setTimeout(() => NX.api("POST", "/power", { kind }).catch((e) => { o.innerHTML = `<div class="off-msg">${NX.icon("logo", 56)}<b>Couldn't ${kind === "restart" ? "restart" : "shut down"}: ${NX.esc(e.message)}</b></div>`; setTimeout(() => { o.hidden = true; boot(); }, 2500); }), 900);
      return;
    }
    setTimeout(() => {
      if (kind === "restart") { o.hidden = true; boot(); return; }
      o.innerHTML = `<button class="off-on" aria-label="Turn on">${NX.icon("power", 34)}<span>Turn on</span></button>`; $(".off-on", o).onclick = () => { o.hidden = true; boot(); };
    }, 1400);
  }

  // ---------- desktop icons ----------
  let sel = null;
  function icons() {
    if (!NX.me) return; const box = $("#icons"), p = NX.prefs(), list = p.desktop.filter((id) => NX.apps[id] && (NX.apps[id].builtIn || p.installed.includes(id)));
    const rows = Math.max(1, Math.floor((box.clientHeight || innerHeight - 60) / 96));
    box.dataset.apps = list.length; box.dataset.rows = rows;
    box.innerHTML = list.map((id, i) => `<button class="dicon" data-app="${id}" style="grid-row:${(i % rows) + 1};grid-column:${Math.floor(i / rows) + 1}">${NX.icon(NX.apps[id].icon || id, 40)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("");
    setTimeout(iconsDone, 0);
    box.querySelectorAll(".dicon").forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); box.querySelectorAll(".dicon").forEach((x) => x.classList.toggle("sel", x === b)); sel = b.dataset.app; if (e.pointerType === "touch") NX.open(b.dataset.app); };
      b.ondblclick = () => NX.open(b.dataset.app);
      b.onkeydown = (e) => { if (e.key === "Enter") NX.open(b.dataset.app); };
      b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.app, a = NX.apps[id]; menu(e.clientX, e.clientY, [["Open", () => NX.open(id)], [NX.prefs().pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], ["Remove from desktop", () => NX.setPref("desktop", NX.prefs().desktop.filter((x) => x !== id))], ...(a.builtIn ? [] : [["Uninstall", () => NX.uninstall(id)]])]); };
    });
  }
  const iconsDone = () => document.dispatchEvent(new CustomEvent("nx:icons"));
  const pin = (id) => { const p = NX.prefs(); NX.setPref("pinned", p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [...p.pinned, id]); };

  // (the Desktop folder's files are added by win11.js when the icons are drawn)
  // ---------- context menu ----------
  function menu(x, y, items) {
    closeFlyouts(); const m = $("#ctx"); m.innerHTML = items.map(([t], i) => `<button data-i="${i}">${NX.esc(t)}</button>`).join(""); m.hidden = false;
    const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 6) + "px"; m.style.top = Math.min(y, innerHeight - r.height - 6) + "px";
    m.querySelectorAll("button").forEach((b) => (b.onclick = () => { m.hidden = true; items[+b.dataset.i][1](); }));
  }

  // ---------- taskbar ----------
  function taskbar() {
    if (!NX.me) return; const p = NX.prefs(), running = [...NX.wins.keys()], ids = [...p.pinned.filter((id) => NX.apps[id] && (NX.apps[id].builtIn || p.installed.includes(id))), ...running.filter((id) => !p.pinned.includes(id))];
    const top = [...NX.wins.values()].filter((w) => !w.min).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex))[0];
    $("#tb-apps").innerHTML = ids.map((id) => { const w = NX.wins.get(id); return `<button class="tb-app ${w ? "run" : ""} ${w && top === w ? "act" : ""}" data-app="${id}" title="${NX.esc(NX.apps[id].name)}" aria-label="${NX.esc(NX.apps[id].name)}">${NX.icon(NX.apps[id].icon || id, 26)}<i></i></button>`; }).join("");
    $("#tb-apps").querySelectorAll(".tb-app").forEach((b) => {
      b.onclick = () => { const id = b.dataset.app, w = NX.wins.get(id); closeFlyouts(); if (!w) NX.open(id); else if (!w.min && w === top) NX.minimize(id); else NX.focus(id); };
      b.oncontextmenu = (e) => { e.preventDefault(); const id = b.dataset.app, w = NX.wins.get(id); menu(e.clientX, e.clientY - 10, [[NX.apps[id].name, () => NX.open(id)], [NX.prefs().pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], ...(w ? [["Close window", () => NX.close(id)]] : [])]); };
    });
  }
  function tray() {
    if (!NX.me) return; const p = NX.prefs();
    $("#tb-tray").innerHTML = `${NX.icon(p.airplane ? "plane" : NX.netOK() ? "wifi" : "wifioff", 16)}${NX.icon("volume", 16)}${batt() ? `<span class="tb-batt" title="Battery ${batt().percent}%${batt().charging ? ", charging" : ""}">${NX.icon("battery", 18)}</span>` : ""}`;
  }
  // the battery: on the real OS the computer's own (none on a desktop PC); in a browser tab a full one
  const batt = () => NX.native ? (NX.battery && NX.battery.present ? NX.battery : null) : { percent: 100, charging: false };
  function clock() { const d = new Date(); $("#tb-time").textContent = NX.fmtTime(d); $("#tb-date").textContent = d.toLocaleDateString(); }
  setInterval(() => { if (NX.me) clock(); }, 5000);

  // ---------- flyouts: Start, quick settings, calendar ----------
  function closeFlyouts(except) { for (const id of ["start", "qs", "cal", "ctx", "widgets", "snapfly"]) if (id !== except) $("#" + id).hidden = true; $("#tb-start").classList.toggle("on", except === "start"); }
  function startDraw(q, view) {
    const p = NX.prefs(), all = visibleApps(), me = NX.me;
    if (view === "all" && !q) return allAppsDraw(all, me);
    const list = q ? all.filter((id) => NX.apps[id].name.toLowerCase().includes(q.toLowerCase())) : all;
    const rec = p.recent.filter((id) => all.includes(id)).slice(0, 4);
    $("#start").innerHTML = `<label class="sm-search">${NX.icon("search", 16)}<input placeholder="Search for apps, settings and the web" aria-label="Search" value="${NX.esc(q || "")}"></label>
      <div class="sm-body">${q ? `<h4>Best match</h4><div class="sm-results">${list.map((id) => `<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 32)}<span><b>${NX.esc(NX.apps[id].name)}</b><small>App</small></span></button>`).join("")}<button class="sm-res" data-web="1">${NX.icon("google", 32)}<span><b>${NX.esc(q)}</b><small>Search the web with Google</small></span></button></div>` :
      `<div class="sm-h"><h4>Pinned</h4><button class="sm-all" data-allapps="1">All apps ${NX.icon("chevron", 12)}</button></div><div class="sm-grid">${list.map((id) => `<button class="sm-tile" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 36)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("")}</div>
      <div class="sm-h"><h4>Recommended</h4></div><div class="sm-rec">${recHTML(rec)}</div>`}</div>
      <div class="sm-foot"><button class="sm-me" data-me="1"><span class="av" style="background:${me.color}">${NX.esc(me.name[0].toUpperCase())}</span><span>${NX.esc(me.name)}</span></button><div class="sm-pw"><button class="sm-pwb" aria-label="Power" title="Power">${NX.icon("power", 18)}</button><div class="sm-pwm" hidden><button data-pw="lock">${NX.icon("lock", 16)}Lock</button><button data-pw="out">${NX.icon("signout", 16)}Sign out</button><button data-pw="restart">${NX.icon("restart", 16)}Restart</button><button data-pw="off">${NX.icon("power", 16)}Shut down</button></div></div></div>`;
    const S = $("#start"), si = $(".sm-search input", S);
    si.oninput = () => { const pos = si.selectionStart; startDraw(si.value); const n = $(".sm-search input"); n.focus(); n.setSelectionRange(pos, pos); };
    si.onkeydown = (e) => { if (e.key === "Enter") { const f = $(".sm-res", S); if (f) f.click(); } };
    S.querySelectorAll("[data-app]").forEach((b) => { b.onclick = () => { closeFlyouts(); NX.open(b.dataset.app); }; b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.app, a = NX.apps[id]; const r = S.getBoundingClientRect(); const mx = e.clientX, my = e.clientY; const items = [[p.pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], [p.desktop.includes(id) ? "Remove from desktop" : "Add to desktop", () => NX.setPref("desktop", p.desktop.includes(id) ? p.desktop.filter((x) => x !== id) : [...p.desktop, id])], ...(a.builtIn ? [] : [["Uninstall", () => NX.uninstall(id)]])]; menu(mx, my, items); void r; }; });
    const web = $("[data-web]", S); if (web) web.onclick = () => { closeFlyouts(); NX.searchWeb(q); };
    const st = $("[data-store]", S); if (st) st.onclick = () => { closeFlyouts(); NX.open("store"); };
    const aa = $("[data-allapps]", S); if (aa) aa.onclick = (e) => { e.stopPropagation(); startDraw("", "all"); };
    S.querySelectorAll("[data-rfile]").forEach((b) => (b.onclick = () => { const f = NX.data("recent-files", [])[+b.dataset.rfile]; closeFlyouts(); if (f) NX.openFile(f); }));
    $("[data-me]", S).onclick = () => { closeFlyouts(); NX.open("settings", { page: "accounts" }); };
    $(".sm-pwb", S).onclick = (e) => { e.stopPropagation(); const m = $(".sm-pwm", S); m.hidden = !m.hidden; };
    S.querySelectorAll("[data-pw]").forEach((b) => (b.onclick = () => { const k = b.dataset.pw; if (k === "lock") lockKeep(); else if (k === "out") signOut(); else power(k === "restart" ? "restart" : "off"); }));
  }
  // Recommended: recently opened files first (like Windows 11), then recently used apps
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "Just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString(); };
  const FICON = { image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };
  function recHTML(rec) {
    const files = NX.data("recent-files", []).slice(0, 4), out = [];
    files.forEach((f, i) => out.push(`<button class="sm-res" data-rfile="${i}">${NX.icon(FICON[f.kind] || "file", 30)}<span><b>${NX.esc(f.name)}</b><small>${ago(f.at)}</small></span></button>`));
    rec.slice(0, 6 - out.length).forEach((id) => out.push(`<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 30)}<span><b>${NX.esc(NX.apps[id].name)}</b><small>Recently opened</small></span></button>`));
    return out.length ? out.join("") : `<p class="sm-empty">The apps and files you open will show up here.</p>`;
  }
  // All apps: every app, A to Z, with letter headings
  function allAppsDraw(all, me) {
    const S = $("#start"), list = [...all].sort((a, b) => NX.apps[a].name.localeCompare(NX.apps[b].name));
    let letter = "", rows = "";
    for (const id of list) { const L = NX.apps[id].name[0].toUpperCase(); if (L !== letter) { letter = L; rows += `<h5 class="sm-letter">${NX.esc(L)}</h5>`; } rows += `<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 28)}<span><b>${NX.esc(NX.apps[id].name)}</b></span></button>`; }
    S.innerHTML = `<label class="sm-search">${NX.icon("search", 16)}<input placeholder="Search for apps, settings and the web" aria-label="Search"></label>
      <div class="sm-body"><div class="sm-h"><h4>All apps</h4><button class="sm-all" data-back="1">${NX.icon("back", 12)} Back</button></div><div class="sm-allist">${rows}<button class="sm-res" data-store="1">${NX.icon("store", 28)}<span><b>Get more apps</b><small>Nebulux Store</small></span></button></div></div>
      <div class="sm-foot"><button class="sm-me" data-me="1"><span class="av" style="background:${me.color}">${NX.esc(me.name[0].toUpperCase())}</span><span>${NX.esc(me.name)}</span></button></div>`;
    S.querySelectorAll("[data-app]").forEach((b) => (b.onclick = () => { closeFlyouts(); NX.open(b.dataset.app); }));
    $("[data-back]", S).onclick = (e) => { e.stopPropagation(); startDraw(""); };
    $("[data-store]", S).onclick = () => { closeFlyouts(); NX.open("store"); };
    $("[data-me]", S).onclick = () => { closeFlyouts(); NX.open("settings", { page: "accounts" }); };
    const si = $(".sm-search input", S); si.oninput = () => { startDraw(si.value); const n = $(".sm-search input"); n.focus(); };
  }
  function toggleStart(focus) { const S = $("#start"); if (!S.hidden) { closeFlyouts(); return; } closeFlyouts("start"); startDraw(""); S.hidden = false; if (focus) setTimeout(() => $(".sm-search input").focus(), 30); }
  function qsDraw() {
    const p = NX.prefs(), t = (k, icon, label, on) => `<button class="qs-t ${on ? "on" : ""}" data-k="${k}">${NX.icon(icon, 18)}<span>${label}</span></button>`;
    $("#qs").innerHTML = `<div class="qs-grid">${t("wifi", "wifi", "Wi-Fi", p.wifi && !p.airplane)}${t("bt", "bt", "Bluetooth", p.bt && !p.airplane)}${t("airplane", "plane", "Airplane mode", p.airplane)}${t("night", "moon", "Night light", p.night)}${t("theme", "contrast", p.theme === "dark" ? "Dark mode" : "Light mode", p.theme === "dark")}${t("dnd", "bell", "Do not disturb", !!p.dnd)}${t("store", "store", "Store", false)}</div>
      <label class="qs-sl">${NX.icon("sun", 18)}<input type="range" min="30" max="100" value="${p.brightness}" data-s="brightness" aria-label="Brightness"></label><label class="qs-sl">${NX.icon("volume", 18)}<input type="range" min="0" max="100" value="${p.volume}" data-s="volume" aria-label="Volume"></label>
      <div class="qs-foot"><span>${batt() ? `${NX.icon("battery", 18)} ${batt().percent}%${batt().charging ? " (charging)" : ""}` : ""}</span><button class="qs-set" aria-label="All settings">${NX.icon("settings", 18)}</button></div>`;
    const Q = $("#qs");
    Q.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.k, P = NX.prefs();
      if (k === "store") { closeFlyouts(); NX.open("store"); return; }
      if (k === "theme") NX.setPref("theme", P.theme === "dark" ? "light" : "dark");
      else if (k === "airplane") { NX.setPref("airplane", !P.airplane); if (!P.airplane) { NX.setPref("wifi", false); NX.setPref("bt", false); } }
      else if (k === "dnd") NX.setPref("dnd", !P.dnd);
      else { NX.setPref(k, !(P[k] && !P.airplane)); if (k !== "night") NX.setPref("airplane", false); }
      qsDraw();
    }));
    Q.querySelectorAll("[data-s]").forEach((s) => (s.oninput = () => NX.setPref(s.dataset.s, +s.value)));
    $(".qs-set", Q).onclick = () => { closeFlyouts(); NX.open("settings"); };
  }
  let calM = null;
  function calDraw() {
    const now = new Date(), m = calM || new Date(now.getFullYear(), now.getMonth(), 1), first = new Date(m.getFullYear(), m.getMonth(), 1), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    let cells = ""; for (let i = 0; i < first.getDay(); i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) { const today = d === now.getDate() && m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear(); cells += `<span class="${today ? "today" : ""}">${d}</span>`; }
    const notes = NX.notes.slice(0, 8);
    NX.unread = 0; const bd = document.getElementById("tb-badge"); if (bd) bd.hidden = true;
    $("#cal").innerHTML = `<div class="nc"><div class="nc-h"><b>Notifications</b>${notes.length ? `<button class="nc-clear">Clear all</button>` : ""}</div>${notes.length ? notes.map((n) => `<div class="nc-item">${NX.icon("logo", 18)}<span>${NX.esc(n.text)}<small>${new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span></div>`).join("") : `<p class="nc-none">No new notifications</p>`}${NX.prefs().dnd ? `<p class="nc-dnd">Do not disturb is on. Notifications wait here.</p>` : ""}</div><div class="cal-top"><b>${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b></div><div class="cal-h"><span>${m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span><button data-m="-1" aria-label="Previous month">${NX.icon("up", 14)}</button><button data-m="1" aria-label="Next month" class="dn">${NX.icon("up", 14)}</button></div>
      <div class="cal-g">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<i>${x}</i>`).join("")}${cells}</div>`;
    const ncc = $("#cal .nc-clear"); if (ncc) ncc.onclick = (e) => { e.stopPropagation(); NX.notes.length = 0; calDraw(); };
    $("#cal").querySelectorAll("[data-m]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); calM = new Date(m.getFullYear(), m.getMonth() + +b.dataset.m, 1); calDraw(); }));
  }

  // ---------- wiring ----------
  function init() {
    $("#lock").addEventListener("click", (e) => { if ($("#lock").className === "locked" && !e.target.closest("button")) reveal(); });
    let winAlone = false, sw = null;
    // Alt + Tab: a row of your open windows; let go of Alt to switch
    const swDraw = () => { const el = document.getElementById("switcher"); el.innerHTML = sw.list.map((w, i) => `<button class="sw-item ${i === sw.i ? "on" : ""}" data-i="${i}">${NX.icon(w.app.icon || w.id, 40)}<span>${NX.esc(w.app.name)}</span></button>`).join(""); el.hidden = false;
      el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { sw.i = +b.dataset.i; swEnd(); })); };
    const swEnd = () => { const el = document.getElementById("switcher"); if (!sw) return; const w = sw.list[sw.i]; sw = null; el.hidden = true; if (w) NX.focus(w.id); };
    const winKeys = (key) => {
      if (key === "desk") NX.showDesktop(); if (key === "lock") lockKeep(); if (key === "files") NX.open("files");
      if (key === "shot" && NX.screenshot) NX.screenshot().catch((er) => NX.toast(er.message));
      if (key === "tm") NX.open("taskmgr");
      if (key === "tview" && NX.taskView) NX.taskView(); if (key === "widgets" && NX.widgets) NX.widgets();
      if (/^snap-/.test(key)) { const w = NX.topWin(); if (w) NX.snap(w.id, key.slice(5)); }
    };
    addEventListener("keydown", (e) => {
      if (!$("#lock").hidden && $("#lock").className === "locked") { reveal(); return; }
      if (e.key === "Escape") closeFlyouts();
      if (e.key === "Meta" || e.key === "OS") { winAlone = true; e.preventDefault(); return; }
      if (e.metaKey || e.getModifierState && e.getModifierState("OS")) winAlone = false;
      if (!NX.me) return;
      if (e.ctrlKey && !e.shiftKey && e.key === "Escape") { e.preventDefault(); toggleStart(true); }
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && /^s$/i.test(e.key))) { e.preventDefault(); winKeys("shot"); }
      else if (e.metaKey && /^[edlw]$/i.test(e.key)) { e.preventDefault(); winKeys({ e: "files", d: "desk", l: "lock", w: "widgets" }[e.key.toLowerCase()]); }
      else if (e.metaKey && e.key === "Tab") { e.preventDefault(); winKeys("tview"); }
      else if (e.metaKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { e.preventDefault(); winKeys("snap-" + { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "max", ArrowDown: "down" }[e.key]); }
      if (e.ctrlKey && e.shiftKey && e.key === "Escape") { e.preventDefault(); winKeys("tm"); }
      if (e.altKey && e.key === "Tab") {
        e.preventDefault(); const list = [...NX.wins.values()].sort((a, b) => (a.min - b.min) || ((+b.el.style.zIndex) - (+a.el.style.zIndex)));
        if (!list.length) return; if (!sw) sw = { list, i: Math.min(1, list.length - 1) }; else sw.i = (sw.i + (e.shiftKey ? -1 : 1) + sw.list.length) % sw.list.length; swDraw();
      }
    });
    addEventListener("keyup", (e) => { if (e.key === "Alt" && sw) swEnd(); });
    addEventListener("blur", () => { if (sw && document.activeElement && document.activeElement.tagName !== "IFRAME") swEnd(); });
    addEventListener("keyup", (e) => { if ((e.key === "Meta" || e.key === "OS") && winAlone && NX.me) { e.preventDefault(); toggleStart(true); } if (e.key === "Meta" || e.key === "OS") winAlone = false; });
    // the same keys pressed while a website in a window has the keyboard
    addEventListener("message", (e) => { const d = e.data; if (!d || d.nx !== "key" || !NX.me || ![...document.querySelectorAll("iframe")].some((f) => f.contentWindow === e.source)) return;
      if (d.key === "start") toggleStart(true); else if (typeof d.key === "string") winKeys(d.key); });
    let ty = null; $("#lock").addEventListener("touchstart", (e) => (ty = e.touches[0].clientY), { passive: true });
    $("#lock").addEventListener("touchend", (e) => { if (ty != null && ty - e.changedTouches[0].clientY > 40) reveal(); ty = null; }, { passive: true });
    $("#lk-power").onclick = (e) => { e.stopPropagation(); const m = $("#lk-pmenu"); m.hidden = !m.hidden; };
    $("#lk-pmenu").addEventListener("click", (e) => { const b = e.target.closest("[data-pw]"); if (!b) return; $("#lk-pmenu").hidden = true; power(b.dataset.pw === "restart" ? "restart" : "off"); });
    $("#tb-start").onclick = (e) => { e.stopPropagation(); toggleStart(false); };
    $("#tb-search").onclick = (e) => { e.stopPropagation(); toggleStart(true); };
    $("#tb-qs").onclick = (e) => { e.stopPropagation(); const q = $("#qs"); if (!q.hidden) { closeFlyouts(); return; } closeFlyouts("qs"); qsDraw(); q.hidden = false; };
    $("#tb-clock").onclick = (e) => { e.stopPropagation(); const c = $("#cal"); if (!c.hidden) { closeFlyouts(); return; } closeFlyouts("cal"); calM = null; calDraw(); c.hidden = false; };
    for (const id of ["start", "qs", "cal", "ctx", "widgets", "snapfly"]) $("#" + id).addEventListener("pointerdown", (e) => e.stopPropagation());
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#taskbar")) closeFlyouts(); if (!e.target.closest(".dicon")) { document.querySelectorAll(".dicon.sel").forEach((x) => x.classList.remove("sel")); sel = null; } });
    $("#desktop").addEventListener("contextmenu", (e) => {
      if (e.target.closest(".win") || e.target.closest("#taskbar") || e.target.closest(".dicon") || e.target.closest("#start,#qs,#cal")) return;
      e.preventDefault(); menu(e.clientX, e.clientY, [["New folder", () => NX.desktopNew && NX.desktopNew(true)], ["New text document", () => NX.desktopNew && NX.desktopNew(false)], ["Refresh", () => { icons(); }], ["Display settings", () => NX.open("settings", { page: "system" })], ["Personalize", () => NX.open("settings", { page: "personal" })], ["Open in File Explorer", () => NX.open("files", { place: "Desktop" })]]);
    });
    boot();
  }
  NX.menu = menu;
  NX.shell = { closeFlyouts, toggleStart, icons, lockKeep, taskbar, refresh: () => { icons(); taskbar(); if (!$("#start").hidden) startDraw($(".sm-search input") ? $(".sm-search input").value : ""); }, recent: (id) => { if (!NX.me) return; NX.setPref("recent", [id, ...NX.prefs().recent.filter((x) => x !== id)].slice(0, 6)); }, signOut, power, lock };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
