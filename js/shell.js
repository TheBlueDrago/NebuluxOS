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
    if (NX.onToast) NX.onToast(text);
    const box = $("#toasts"), t = document.createElement("div"); t.className = "toast"; t.innerHTML = `${NX.icon(NX.noteIcon ? NX.noteIcon(text) : "logo", 18)}<span>${NX.esc(text)}</span>`;
    box.appendChild(t); while (box.children.length > 3) box.firstChild.remove();
    t.title = "Click to close"; t.onclick = () => { t.classList.add("out"); setTimeout(() => t.remove(), 350); };
    // how long it stays: Settings > Accessibility > Show messages for (and never while the pointer is on it)
    const stay = Math.max(3.2, +(NX.me && NX.prefs().toastSecs) || 3.2) * 1000; let gone = 0;
    const later = (ms) => { clearTimeout(gone); gone = setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, ms); };
    t.addEventListener("mouseenter", () => clearTimeout(gone)); t.addEventListener("mouseleave", () => later(1500));
    later(stay);
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
    root.dataset.theme = NX.me ? p.theme : "dark"; root.style.setProperty("--accent", p.accent === "auto" && NX.autoAccent ? NX.autoAccent() : p.accent);
    const sv = !!(NX.me && NX.saverOn()); root.classList.toggle("saver", sv);
    root.classList.toggle("nofx", !NX.fx() || sv);
    root.classList.toggle("noanim", !!(NX.me && (p.anim === false || sv)));
    // Settings > Accessibility > Text size: everything inside app windows grows
    root.style.setProperty("--appzoom", NX.me && +p.textSize > 100 ? String(+p.textSize / 100) : "1");
    root.classList.toggle("bigfocus", !!(NX.me && p.bigfocus));
    root.dataset.caps = NX.me && p.captionStyle ? p.captionStyle : "default";
    // Settings > Accessibility > Contrast themes
    { const ct = NX.me && ["aquatic", "desert", "dusk", "night"].includes(p.contrastTheme) ? p.contrastTheme : null; if (ct) root.dataset.ct = ct; else delete root.dataset.ct; }
    const cf = NX.me ? p.colorFilter || "none" : "none"; root.classList.toggle("cf-gray", cf === "gray"); root.classList.toggle("cf-invert", cf === "invert"); ["protan", "deutan", "tritan"].forEach((k) => root.classList.toggle("cf-" + k, cf === k)); root.classList.toggle("bigcursor", !!(NX.me && p.bigcursor)); root.classList.toggle("hc", !!(NX.me && p.contrast)); if (NX.pointerApply) NX.pointerApply(); root.dataset.wbtn = NX.me ? p.wbtn || "plain" : "plain"; root.dataset.corners = NX.me ? p.corners40 || "round" : "round"; root.dataset.glass = NX.me ? p.glass || "frosted" : "frosted"; root.classList.toggle("bigscroll", !!(NX.me && p.bigscroll));
    // the lock screen picture (Settings > Personalization): saved for this computer so it shows before anyone signs in
    if (NX.me) NX.set("lock-show", p.lockPic === "show" ? 1 : 0);
    if (NX.me && p.lockPic !== "show") { const lp = p.lockPic == null || p.lockPic === "match" ? (typeof p.wallpaper === "number" ? p.wallpaper : NX.defaultWall) : +p.lockPic; if (NX.get("lock-wall", 0) !== lp) NX.set("lock-wall", lp); }
    const lw = NX.get("lock-wall", NX.defaultWall), wall = NX.wallpaperURL(NX.me ? p.wallpaper : (typeof lw === "number" && NX.wallpapers[lw] ? lw : NX.defaultWall), innerWidth * Math.min(2, devicePixelRatio || 1), innerHeight * Math.min(2, devicePixelRatio || 1));
    if (wall !== lastWall) {
      // a new background fades in over the old one (not when signing in, and not with animations off)
      const D = $("#desktop"), was = lastWall;
      if (was && NX.me && D && !D.hidden && !root.classList.contains("noanim") && !root.classList.contains("nx-lite") && !D.style.getPropertyValue("--wall")) {
        const f = document.createElement("div"); f.className = "wall-fade"; f.style.backgroundImage = `url(${was})`; D.insertBefore(f, D.firstChild);
        requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add("go"))); setTimeout(() => f.remove(), 900);
      }
      lastWall = wall; root.style.setProperty("--wall", `url(${wall})`);
    }
    $("#dim").style.opacity = NX.me && !NX.hw.brightness ? ((100 - p.brightness) / 100) * 0.75 : 0; $("#night").classList.toggle("on", !!(NX.me && p.night)); $("#night").style.setProperty("--ns", ((NX.me && p.nightStr) || 50) / 100);
    $("#desktop").classList.toggle("tb-left", p.align === "left");
  }
  let resizeT = 0; addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { applyLook(); if (NX.me) icons(); }, 150); });
  document.addEventListener("nx:prefs", (e) => { applyLook(); const k = e.detail; if (["battPct", "volume", "airplane", "wifi"].includes(k)) tray(); if (k === "clockSec") clock(); if (["installed", "pinned", "desktop", "align"].includes(k)) { icons(); taskbar(); } if (["wifi", "bt", "airplane", "volume", "brightness", "night", "theme", "net", "battery", "dnd", "saver", "saverAuto"].includes(k)) { tray(); if (!$("#qs").hidden) qsDraw(); } if (k === "clock24") clock(); });

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
  // the lock screen's corner: the network and the battery, like the taskbar
  function lkStatus() {
    const el = $("#lk-status"); if (!el) return; const b = batt(), net = NX.netOK ? NX.netOK() : true;
    const nn = $("#lock") && $("#lock").className === "locked" && lockedBy ? NX.unread || 0 : 0; // only while someone locked it, and only how many
    const html = `${nn ? `<span class="lk-notes" title="${nn} new notification${nn === 1 ? "" : "s"}">${NX.icon("bell", 18)}<small>${nn > 9 ? "9+" : nn}</small></span>` : ""}<span title="${net ? "Connected" : "Not connected"}">${NX.icon(net ? "wifi" : "wifioff", 18)}</span>${b ? `<span class="lk-batt" title="${battText()}">${NX.battIcon(22)}<small>${b.percent}%</small></span>` : ""}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  // the lock screen's weather: the last forecast Widgets got (up to 3 hours old)
  function lkWeather() {
    let el = $("#lk-wx"); const d = $("#lk-date"); if (!el && d) { el = document.createElement("div"); el.id = "lk-wx"; d.after(el); } if (!el) return;
    const w = NX.get("wx-lock", null), fresh = !!(w && Date.now() - w.at < 3 * 3600000 && NX.wxInfo);
    const html = fresh ? NX.wxInfo.icon(w.code, 30) + "<span>" + w.now + "°" + w.unit + "  " + NX.esc(NX.wxInfo.name(w.code)) + "</span>" : "";
    if (el.innerHTML !== html) el.innerHTML = html; el.hidden = !fresh;
  }
  function lock(clockFirst) {
    NX.me = null; applyLook(); const L = $("#lock"); L.hidden = false; L.className = clockFirst ? "locked" : "signin"; $("#desktop").hidden = true;
    const tick = () => { const d = new Date(); L.dataset.time = NX.fmtTime ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; $("#lk-time").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""); $("#lk-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); lkStatus(); lkWeather(); };
    tick(); clearInterval(lockT); lockT = setInterval(tick, 1000);
    const users = NX.users(); chosen = (users.find((u) => u.id === NX.get("lastUser")) || users[0] || null); mode = users.length ? "signin" : "setup";
    if (!users.length && NX.oobe) { L.hidden = true; clearInterval(lockT); NX.oobe((u) => { L.hidden = false; enter(u); }); return; }
    signinDraw();
    if (!clockFirst) setTimeout(() => { const i = $("#lock input"); if (i) i.focus(); }, 60);
  }
  function reveal() { const L = $("#lock"); if (L.className !== "locked") return; L.className = "signin"; setTimeout(() => { const i = $("#lock input"); if (i) i.focus(); }, 260); }
  let usePw = false; // "Sign in with your password instead"
  function signinDraw() {
    const users = NX.users(), box = $("#lk-panel");
    if (mode === "setup") {
      box.innerHTML = `<div class="lk-av new">${NX.icon("logo", 120)}</div><h2>${users.length ? "Add an account" : "Welcome to Nebulux OS"}</h2><p class="lk-sub">${users.length ? "Make a new account on this PC." : (NX.native ? "Make your account to get started. It stays on this computer." : "Make your account to get started. It stays on this PC, in this browser.")}</p>
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
      if (u.guest) {
        box.innerHTML = `${NX.avatar(u, "lk-av", "div")}<h2>${NX.esc(u.name)}</h2><button class="btn primary wide lk-guest">Sign in</button>`;
        $(".lk-guest", box).onclick = async () => enter(await NX.checkPassword(u.id, ""));
        setTimeout(() => { const g = $(".lk-guest", box); if (g) g.focus(); }, 60);
      } else {
      const pin = NX.hasPin && NX.hasPin(u.id) && !usePw;
      box.innerHTML = `${NX.avatar(u, "lk-av", "div")}<h2>${NX.esc(u.name)}</h2>
        <form class="lk-form pw ${pin ? "pin" : ""}"><input name="p" type="password" maxlength="${pin ? 12 : 64}" placeholder="${pin ? "PIN" : "Password"}" aria-label="${pin ? "PIN" : "Password"}" ${pin ? 'inputmode="numeric" pattern="[0-9]*"' : ""} autocomplete="current-password"><button class="lk-go" type="submit" aria-label="Sign in">${NX.icon("arrow", 18)}</button></form><p class="lk-err" role="alert"></p>
        ${pin ? `<button class="lk-link" data-a="usepw">Sign in with your password instead</button>` : (NX.hasPin && NX.hasPin(u.id) ? `<button class="lk-link" data-a="usepin">Sign in with your PIN</button>` : `<button class="lk-link" data-a="forgot">I forgot my password</button>`)}`;
      }
      const f = $(".lk-form", box), er = $(".lk-err", box);
      if (f) f.onsubmit = async (e) => {
        const isPin = f.classList.contains("pin");
        e.preventDefault(); const p = f.p.value; if (!p) { er.textContent = isPin ? "Type your PIN." : "Type your password."; return; }
        const btn = $("button", f); btn.disabled = true; er.textContent = ""; box.classList.add("busy");
        try { const me = isPin ? await NX.checkPin(u.id, p) : await NX.checkPassword(u.id, p); usePw = false; enter(me); } catch (err) { er.textContent = err.message; f.p.value = ""; btn.disabled = false; box.classList.remove("busy"); f.p.focus(); box.classList.add("shake"); setTimeout(() => box.classList.remove("shake"), 400); }
      };
    }
    $("#lk-users").innerHTML = users.length ? users.map((x) => `<button class="lk-user ${chosen && x.id === chosen.id && mode !== "setup" ? "on" : ""}" data-u="${x.id}">${NX.avatar(x, "av")}<span>${NX.esc(x.name)}</span></button>`).join("") + (users.length < 8 ? `<button class="lk-user ${mode === "setup" ? "on" : ""}" data-a="add"><span class="av plus">+</span><span>Add account</span></button>` : "") : "";
    document.querySelectorAll("#lock [data-u]").forEach((b) => (b.onclick = () => { chosen = NX.users().find((x) => x.id === b.dataset.u); mode = "signin"; signinDraw(); reveal(); setTimeout(() => { const i = $("#lock input"); i && i.focus(); }, 30); }));
    document.querySelectorAll("#lock [data-a]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === "add") {
        if (NX.oobe) { const L = $("#lock"); L.hidden = true; clearInterval(lockT); NX.oobe((u) => { L.hidden = false; enter(u); }, { cancel: () => { L.hidden = false; lock(); } }); return; }
        mode = "setup"; signinDraw(); reveal(); setTimeout(() => { const i = $("#lock input"); i && i.focus(); }, 30);
      }
      if (a === "back") { mode = "signin"; chosen = chosen || NX.users()[0]; signinDraw(); }
      if (a === "usepw" || a === "usepin") { usePw = a === "usepw"; signinDraw(); setTimeout(() => { const i = $("#lock input"); i && i.focus(); }, 30); return; }
      if (a === "forgot") { $(".lk-err").textContent = "Passwords on Nebulux OS stay on this PC and can't be recovered. You can add a new account below."; }
    }));
  }
  function enter(u) {
    const back = lockedBy === u.id; if (lockedBy && !back) NX.closeAll(); lockedBy = null; // someone else signing in doesn't see your apps
    NX.me = u; NX.set("lastUser", u.id); clearInterval(lockT);
    const L = $("#lock"); L.className = "out"; setTimeout(() => { L.hidden = true; }, 350);
    $("#desktop").hidden = false; applyLook(); icons(); taskbar(); tray(); clock(); closeFlyouts();
    { const D = $("#desktop"); D.classList.remove("nx-arrive"); void D.offsetWidth; D.classList.add("nx-arrive"); setTimeout(() => D.classList.remove("nx-arrive"), 900); }
    document.dispatchEvent(new CustomEvent("nx:signin", { detail: { back } }));
    NX.unread = 0; const bd = document.getElementById("tb-badge"); if (bd) bd.hidden = true;
    if (!back) setTimeout(() => { const h = new Date().getHours(); const hol = NX.holidayGreeting ? NX.holidayGreeting() : ""; NX.toast((hol || (h < 5 ? "Welcome back" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening")) + ", " + u.name + "."); }, 500); // a greeting for the time of day
  }
  function signOut() { lockedBy = null; NX.set("lk-next", null); closeFlyouts(); NX.closeAll(); setTimeout(lock, 160); }
  // Lock: the lock screen comes up, and your apps stay open behind it
  let lockedBy = null;
  // after the computer sleeps, sign in again (Guest has no password, so it just carries on)
  // startup apps (Settings > Apps): opened once each time someone signs in (not when coming back from the lock screen)
  document.addEventListener("nx:signin", (e) => { if (e.detail && e.detail.back) return; const L = (NX.prefs().startup || []).filter((id) => NX.apps[id] && !NX.wins.has(id)); if (!L.length) return; setTimeout(() => L.forEach((id, i) => setTimeout(() => NX.me && NX.open(id), i * 250)), 1200); });
  document.addEventListener("nx:resumed", () => { if (NX.me && !NX.me.guest && $("#lock").hidden) lockKeep(); });
  function lockKeep() { if (!NX.me) return; lockedBy = NX.me.id; if (NX.lockNextSave) NX.lockNextSave(); closeFlyouts(); lock(true); }
  // Sleep: the computer sleeps (on the real OS); press a key or click to wake it, then sign in again
  function sleep() {
    closeFlyouts(); lockKeep();
    if (NX.native) { setTimeout(() => NX.api("POST", "/power", { kind: "sleep" }).catch((e) => NX.toast(e.message)), 400); return; }
    const o = $("#off"); o.hidden = false; o.innerHTML = ""; o.classList.add("sleeping");
    const wake = () => { o.hidden = true; o.classList.remove("sleeping"); removeEventListener("keydown", wake, true); o.removeEventListener("pointerdown", wake); };
    setTimeout(() => { addEventListener("keydown", wake, true); o.addEventListener("pointerdown", wake); }, 300);
  }
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
    const isz = ["small", "large"].includes(p.iconSize) ? p.iconSize : "medium"; box.dataset.size = isz;
    const rows = Math.max(1, Math.floor((box.clientHeight || innerHeight - 60) / ({ small: 80, medium: 96, large: 124 }[isz])));
    const bin = p.deskBin !== false, nb = list.length;
    box.dataset.apps = nb + (bin ? 1 : 0); box.dataset.rows = rows;
    box.innerHTML = list.map((id, i) => `<button class="dicon" data-app="${id}" style="grid-row:${(i % rows) + 1};grid-column:${Math.floor(i / rows) + 1}">${NX.icon(NX.apps[id].icon || id, 40)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("")
      + (bin ? `<button class="dicon dbin" style="grid-row:${(nb % rows) + 1};grid-column:${Math.floor(nb / rows) + 1}">${NX.icon(NX.binFull ? "binfull" : "binempty", 40)}<span>Recycle Bin</span></button>` : "");
    const db = box.querySelector(".dbin"); if (db) { db.onclick = (e) => { e.stopPropagation(); NX.open("files", { path: "::trash" }); }; db.onkeydown = (e) => { if (e.key === "Enter") NX.open("files", { path: "::trash" }); }; db.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); menu(e.clientX, e.clientY, [["Open", () => NX.open("files", { path: "::trash" })], ["Empty Recycle Bin", async () => { if (!(await NX.ask(document.getElementById("desktop"), { title: "Empty the Recycle Bin?", text: "Everything in it will be deleted for good.", ok: "Empty it", danger: true }))) return; await NX.fs.emptyTrash(); NX.binCheck && NX.binCheck(); }]]); }; }
    setTimeout(iconsDone, 0);
    box.querySelectorAll(".dicon:not(.dbin)").forEach((b) => {
      // one click opens it (a slow double-click on a slow computer used to do nothing)
      b.onclick = (e) => { e.stopPropagation(); box.querySelectorAll(".dicon").forEach((x) => x.classList.toggle("sel", x === b)); sel = b.dataset.app; NX.open(b.dataset.app); };
      b.onkeydown = (e) => { if (e.key === "Enter") NX.open(b.dataset.app); };
      b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.app, a = NX.apps[id]; menu(e.clientX, e.clientY, [["Open", () => NX.open(id)], [NX.prefs().pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], ["Hide from desktop", () => NX.setPref("desktop", NX.prefs().desktop.filter((x) => x !== id))], ...(a.builtIn ? [] : [["Uninstall", () => NX.uninstall(id)]])]); };
    });
  }
  const iconsDone = () => document.dispatchEvent(new CustomEvent("nx:icons"));
  const pin = (id) => { const p = NX.prefs(); NX.setPref("pinned", p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [...p.pinned, id]); };

  // (the Desktop folder's files are added by win11.js when the icons are drawn)
  // ---------- context menu ----------
  // 4.0: every menu item gets a small icon that matches what it does
  const MICON = [[/^new folder/i, "newfolder"], [/^new text|^new note|sticky/i, "ftext"], [/^refresh/i, "reload"], [/widgets/i, "apps"], [/background/i, "brush"], [/display/i, "display"], [/personaliz/i, "brush"], [/file explorer/i, "folder"],
    [/^open in new tab/i, "plus"], [/^open/i, "fwd"], [/^cut$/i, "cut"], [/^copy$/i, "copy"], [/^paste$/i, "paste"], [/^rename/i, "rename"], [/^delete|for good|^empty/i, "trash"], [/^restore$/i, "restart"], [/properties/i, "info"], [/tag/i, "pin"],
    [/unpin|pin to|quick access|taskbar/i, "pin"], [/^close/i, "close"], [/^minimize/i, "min"], [/^maximize|^restore/i, "max"], [/on top/i, "up"], [/uninstall/i, "trash"], [/settings/i, "settings"], [/desktop/i, "display"]];
  const micon = (t) => { const m = MICON.find(([re]) => re.test(t)); return m ? NX.icon(m[1], 15) : `<span class="ctx-sp"></span>`; };
  function menu(x, y, items) {
    closeFlyouts(); const m = $("#ctx"); m.innerHTML = items.map(([t, fn, ic], i) => fn === null ? (t ? `<div class="ctx-h">${NX.esc(t)}</div>` : `<i class="ctx-sep"></i>`) : `<button data-i="${i}">${ic ? NX.icon(ic, 16) : micon(t)}<span>${NX.esc(t)}</span></button>`).join(""); m.hidden = false;
    const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 6) + "px"; m.style.top = Math.min(y, innerHeight - r.height - 6) + "px";
    m.querySelectorAll("button").forEach((b) => (b.onclick = () => { m.hidden = true; menuBack(); items[+b.dataset.i][1](); }));
    // the keyboard (4.4): the first item is ready, Up and Down (and Home, End) move, Enter picks, Esc closes and goes back
    m.setAttribute("role", "menu"); m.querySelectorAll("button").forEach((b) => b.setAttribute("role", "menuitem"));
    menuFrom = document.activeElement && document.activeElement !== document.body && !m.contains(document.activeElement) ? document.activeElement : menuFrom;
    const first = m.querySelector("button"); if (first) first.focus({ preventScroll: true });
  }
  let menuFrom = null; const menuBack = () => { const f = menuFrom; menuFrom = null; if (f && f.isConnected) try { f.focus({ preventScroll: true }); } catch (e) { /* gone */ } };
  addEventListener("keydown", (e) => {
    const m = document.getElementById("ctx"); if (!m || m.hidden) return;
    const L = [...m.querySelectorAll("button")], i = L.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); const n = L.length; if (n) L[((i < 0 ? (e.key === "ArrowDown" ? -1 : 0) : i) + (e.key === "ArrowDown" ? 1 : -1) + n) % n].focus(); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); e.stopPropagation(); (e.key === "Home" ? L[0] : L[L.length - 1]).focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); m.hidden = true; menuBack(); }
    else if (e.key === "Tab") { e.preventDefault(); }
  }, true);

  // ---------- taskbar ----------
  function taskbar() {
    if (!NX.me) return; const p = NX.prefs(), running = [...NX.wins.values()].filter(((w) => !w.desk || !NX.desks || w.desk === NX.desks.current())).map((w) => w.id), ids = [...p.pinned.filter((id) => NX.apps[id] && (NX.apps[id].builtIn || p.installed.includes(id))), ...running.filter((id) => !p.pinned.includes(id)), ...[...(NX.nativeRunning || [])].filter((id) => NX.apps[id] && !p.pinned.includes(id) && !running.includes(id))];
    const top = [...NX.wins.values()].filter((w) => !w.min).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex))[0];
    $("#tb-apps").innerHTML = ids.map((id) => { const w = NX.wins.get(id) || (id === "google" && NX.browserRunning ? { browser: true } : null) || (NX.nativeRunning && NX.nativeRunning.has(id) ? { nat: true } : null); return `<button class="tb-app ${w ? "run" : ""} ${w && (top === w || (w.browser && NX.browserShown) || (w.nat && NX.nativeActive.has(id))) ? "act" : ""}" data-app="${id}" title="${NX.esc(NX.apps[id].name)}" aria-label="${NX.esc(NX.apps[id].name)}">${NX.icon(NX.apps[id].icon || id, 26)}<span class="tb-lbl">${NX.esc((w && w.el && w.el.querySelector(".wt-name") ? w.el.querySelector(".wt-name").textContent : NX.apps[id].name).replace(/ - [^-]+$/, ""))}</span><i></i>${NX.appBadge && NX.appBadge(id) ? `<b class="tb-cnt">${NX.appBadge(id)}</b>` : ""}</button>`; }).join("");
    $("#tb-apps").querySelectorAll(".tb-app").forEach((b) => {
      b.onclick = () => { const id = b.dataset.app, w = NX.wins.get(id); closeFlyouts(); if (id === "google" && NX.browserOK && NX.browserRunning) { NX.browserToggle(); return; }
        if (NX.nativeRunning && NX.nativeRunning.has(id)) { NX.nativeToggle(id); return; } if (NX.browserHide) NX.browserHide(); if (!w) NX.open(id); else if (!w.min && w === top) NX.minimize(id); else NX.focus(id); };
      b.onpointerenter = (e) => { if (e.pointerType === "mouse") peekSoon(b); };
      b.onpointerleave = () => peekLeave();
      b.oncontextmenu = (e) => { e.preventDefault(); peekHide(); const id = b.dataset.app, w = NX.wins.get(id); const JK = { notepad: ["text"], photos: ["image"], media: ["video", "audio"], files: null }, FIC = { image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };
      const jl = id in JK && NX.prefs().showrecent !== false ? NX.data("recent-files", []).filter((f) => !JK[id] || JK[id].includes(f.kind)).slice(0, 5) : [];
      menu(e.clientX, e.clientY - 10, [...(jl.length ? [["Recent", null], ...jl.map((f) => [f.name, () => NX.openFile(f), FIC[f.kind] || "file"]), ["", null]] : []), [NX.apps[id].name, () => NX.open(id)], [NX.prefs().pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], ...(w ? [["Close window", () => NX.close(id)]] : NX.nativeRunning && NX.nativeRunning.has(id) && NX.nativeClose ? [["Close window", () => NX.nativeClose(id)]] : [])]); };
      // drag a pinned app sideways to put it somewhere else on the taskbar
      b.onpointerdown = (e) => {
        if (e.button !== 0 || !NX.prefs().pinned.includes(b.dataset.app)) return;
        const x0 = e.clientX; let moved = false;
        const move = (ev) => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 8) return; if (!moved) { moved = true; peekHide(); b.classList.add("tb-drag"); try { b.setPointerCapture(ev.pointerId); } catch (er) { /* fine */ } } b.style.transform = `translateX(${dx}px)`; };
        const up = (ev) => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); if (!moved) return;
          b.classList.remove("tb-drag"); b.style.transform = ""; const swallow = (ce) => { ce.stopPropagation(); ce.preventDefault(); }; b.addEventListener("click", swallow, { capture: true, once: true }); setTimeout(() => b.removeEventListener("click", swallow, true), 50);
          const pins = NX.prefs().pinned.filter((id) => NX.apps[id] && (NX.apps[id].builtIn || NX.prefs().installed.includes(id))), others = [...$("#tb-apps").querySelectorAll(".tb-app")].filter((x) => x !== b && pins.includes(x.dataset.app));
          let at = others.findIndex((x) => { const r = x.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; }); if (at < 0) at = others.length;
          const order = others.map((x) => x.dataset.app); order.splice(at, 0, b.dataset.app);
          const rest = NX.prefs().pinned.filter((id) => !order.includes(id)); NX.setPref("pinned", [...order, ...rest]); taskbar(); };
        addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
      };
    });
  }
  // taskbar previews: hovering an open app shows a small picture of its window, its title and a close button
  let peekT = 0, peekOut = 0;
  function peekSoon(b) { clearTimeout(peekOut); clearTimeout(peekT); peekT = setTimeout(() => peek(b), $("#tb-peek") && !$("#tb-peek").hidden ? 0 : 450); }
  function peekLeave() { clearTimeout(peekT); clearTimeout(peekOut); peekOut = setTimeout(peekHide, 250); }
  function peekHide() { clearTimeout(peekT); const P = $("#tb-peek"); if (P) { P.hidden = true; P.innerHTML = ""; } }
  function peek(b) {
    const id = b.dataset.app, w = NX.wins.get(id); if (!w || !document.body.contains(b)) { peekHide(); return; }
    let P = $("#tb-peek"); if (!P) { P = document.createElement("div"); P.id = "tb-peek"; P.hidden = true; document.body.appendChild(P); P.onpointerenter = () => clearTimeout(peekOut); P.onpointerleave = peekLeave; }
    const title = w.el.querySelector(".wt-name").textContent, W = 220, r = w.el.getBoundingClientRect(), k = Math.min(W / Math.max(1, r.width), 140 / Math.max(1, r.height)), H = Math.round(Math.max(60, Math.min(140, r.height * k)));
    P.innerHTML = `<div class="pk-top">${NX.icon(w.app.icon || id, 16)}<span>${NX.esc(title)}</span><button class="pk-x" aria-label="Close ${NX.esc(w.app.name)}">${NX.icon("close", 12)}</button></div><div class="pk-shot" style="height:${H}px"></div>`;
    // a still picture of the window (a copy, so nothing in it runs); web pages show the app's icon instead
    const shot = P.querySelector(".pk-shot");
    if (w.el.querySelector("iframe") || w.min || !r.width) shot.innerHTML = `<div class="pk-ico">${NX.icon(w.app.icon || id, 44)}</div>`;
    else { const c = w.el.cloneNode(true); c.removeAttribute("id"); c.removeAttribute("data-app"); c.removeAttribute("role"); c.classList.add("pk-clone"); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); c.classList.remove("opening", "closing", "minimized", "offdesk"); Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: r.width + "px", height: r.height + "px", transform: "translateX(" + Math.round((W - r.width * k) / 2) + "px) scale(" + k + ")", transformOrigin: "0 0", pointerEvents: "none", zIndex: 0, margin: 0 }); c.setAttribute("aria-hidden", "true"); c.inert = true; shot.appendChild(c); }
    P.querySelector(".pk-x").onclick = (e) => { e.stopPropagation(); peekHide(); NX.close(id); };
    P.onclick = () => { peekHide(); if (NX.browserHide) NX.browserHide(); NX.focus(id); };
    const br = b.getBoundingClientRect(); P.hidden = false; const pw = P.offsetWidth;
    P.style.left = Math.round(Math.max(8, Math.min(innerWidth - pw - 8, br.left + br.width / 2 - pw / 2))) + "px"; P.style.bottom = Math.round(innerHeight - br.top + 8) + "px";
  }
  NX.peek = { show: peek, hide: peekHide };
  function tray() {
    if (!NX.me) return; const p = NX.prefs();
    $("#tb-qs").title = [p.airplane ? "Airplane mode is on" : NX.netOK() ? "Connected to the internet" : "Not connected", "Volume: " + (p.volume || 0) + "%", ...(batt() ? [battText()] : [])].join("\n");
    $("#tb-tray").innerHTML = `${NX.icon(p.airplane ? "plane" : NX.netOK() ? "wifi" : "wifioff", 16)}${NX.icon("volume", 16)}${batt() ? `<span class="tb-batt" title="${battText()}">${NX.battIcon(20)}${p.battPct ? `<small class="tb-bpct">${batt().percent}%</small>` : ""}</span>` : ""}`;
  }
  // the battery: this computer's own, on the real OS and in a browser tab (none on a desktop PC). The bar inside the
  // icon goes down with it and changes color: green while charging, orange at 20% or less, red at 10% or less, and
  // yellow while Battery saver is on.
  const batt = () => NX.battery ? (NX.battery.present ? NX.battery : null) : NX.native ? null : { percent: 100, charging: false };
  NX.batt = batt;
  NX.saverOn = () => { const b = batt(), p = NX.prefs(); return !!b && !b.charging && (!!p.saver || (p.saverAuto !== false && b.percent <= 20)); };
  NX.battIcon = (size) => {
    const b = batt(); if (!b) return "";
    const pc = Math.max(0, Math.min(100, b.percent)), w = Math.max(pc > 0 ? 1.5 : 0, 22 * pc / 100);
    const c = NX.saverOn() ? "saver" : b.charging ? "charging" : pc <= 10 ? "critical" : pc <= 20 ? "low" : "ok";
    return `<svg class="nx-batt b-${c}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="15" width="34" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2.6"/><rect x="40" y="20.5" width="3.5" height="7" rx="1.2" fill="currentColor"/><rect class="nx-bfill" x="9" y="19" width="${w.toFixed(1)}" height="10" rx="1.6"/>${b.charging ? `<path d="M23.5 16.5l-5 8.5h4.5l-2 6.5 6-9h-4.6z" fill="#fff" stroke="#0006" stroke-width=".8"/>` : ""}</svg>`;
  };
  // "About 3 h 20 min left" or "1 h 5 min until full", when the battery says
  NX.battLeft = () => { const b = batt(); if (!b || !b.minutes || (b.charging && b.percent >= 100)) return ""; const h = Math.floor(b.minutes / 60), m = b.minutes % 60, t = (h ? h + " h " : "") + (h && !m ? "" : m + " min"); return b.charging ? t.trim() + " until full" : "About " + t.trim() + " left"; };
  const battText = () => { const b = batt(); return b ? "Battery " + b.percent + "%" + (b.charging ? ", charging" : NX.saverOn() ? ", Battery saver on" : "") + (NX.battLeft() ? ". " + NX.battLeft() : "") : ""; };
  // low battery: a warning at 20% and 10% (once each time it gets there)
  let lowTold = 101;
  document.addEventListener("nx:prefs", (e) => {
    if (e.detail === "saver" && NX.me && NX.prefs().saver === false && NX.saverOn()) NX.setPref("saverAuto", false); // turned off by hand while low
    if (e.detail !== "battery" || !NX.me) return; const b = batt(); if (!b) return;
    if (b.charging || b.percent > 20) { lowTold = 101; return; }
    const lvl = b.percent <= 10 ? 10 : 20; if (lvl >= lowTold) return; lowTold = lvl;
    NX.toast(lvl === 10 ? "Battery is very low (" + b.percent + "%). Plug in your computer soon." : "Battery is at " + b.percent + "%." + (NX.prefs().saverAuto !== false ? " Battery saver is on." : " Turn on Battery saver to make it last longer."));
  });
  function clock() { const d = new Date(); $("#tb-time").textContent = NX.fmtTime(d, !!NX.prefs().clockSec); $("#tb-date").textContent = d.toLocaleDateString(); const full = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }); if ($("#tb-clock").title !== full) $("#tb-clock").title = full; }
  setInterval(() => { if (NX.me) clock(); }, 1000);
  // Night light on a schedule: on at "nightFrom", off at "nightTo" (it can run past midnight). Turning it on or off
  // by hand still works; the schedule takes over again at the next on or off time.
  let nightWas = null;
  const inHours = (from, to, d) => { const m = d.getHours() * 60 + d.getMinutes(), f = (s) => { const [h, mi] = String(s).split(":").map(Number); return h * 60 + mi; }, a = f(from), b = f(to); return a === b ? false : a < b ? m >= a && m < b : m >= a || m < b; };
  function nightTick(force) {
    if (!NX.me) { nightWas = null; return; }
    const p = NX.prefs(); if (!p.nightSched) { nightWas = null; return; }
    const want = inHours(p.nightFrom || "21:00", p.nightTo || "07:00", new Date());
    if (force || nightWas === null || want !== nightWas) { nightWas = want; if (!!p.night !== want) NX.setPref("night", want); }
  }
  setInterval(() => nightTick(false), 30000);
  document.addEventListener("nx:signin", () => { nightWas = null; nightTick(true); });
  document.addEventListener("nx:prefs", (e) => { if (e.detail === "nightSched") { nightWas = null; nightTick(true); } });

  // ---------- flyouts: Start, quick settings, calendar ----------
  function closeFlyouts(except) { if (except !== "qs") qsEdit = false; if (except && NX.browserHide) NX.browserHide(); for (const id of ["start", "qs", "cal", "ctx", "widgets", "snapfly", "clip"]) if (id !== except) $("#" + id).hidden = true; $("#tb-start").classList.toggle("on", except === "start"); }
  function startDraw(q, view) {
    const p = NX.prefs(), all = visibleApps(), me = NX.me;
    if (view === "all" && !q) return allAppsDraw(all, me);
    // your own order for the pinned apps (drag a tile onto another to move it there)
    const ord = p.startOrder || [], rank = (id) => { const i = ord.indexOf(id); return i < 0 ? 1000 + all.indexOf(id) : i; };
    const list = q ? all.filter((id) => NX.apps[id].name.toLowerCase().includes(q.toLowerCase())) : [...all].sort((a, b) => rank(a) - rank(b));
    const rec = p.recent.filter((id) => all.includes(id)).slice(0, 4);
    $("#start").innerHTML = `<label class="sm-search">${NX.icon("search", 16)}<input placeholder="Search for apps, settings and the web" aria-label="Search" value="${NX.esc(q || "")}"></label>
      <div class="sm-body ${q ? "sm-searching" : ""}">${q ? `<div class="sm-split"><div class="sm-left"><h4>Best match</h4><div class="sm-results">${list.map((id) => `<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 32)}<span><b>${NX.esc(NX.apps[id].name)}</b><small>App</small></span></button>`).join("")}<button class="sm-res" data-web="1">${NX.icon("google", 32)}<span><b>${NX.esc(q)}</b><small>Search the web with Google</small></span></button></div></div><aside class="sm-detail" aria-label="Details"></aside></div>` :
      `<div class="sm-h"><h4>Pinned</h4><button class="sm-all" data-allapps="1">All apps ${NX.icon("chevron", 12)}</button></div><div class="sm-grid">${list.map((id) => `<button class="sm-tile" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 36)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("")}</div>
      <div class="sm-h"><h4>Recommended</h4>${NX.prefs().showrecent !== false && NX.data("recent-files", []).length ? `<button class="sm-all" data-recmore="1">More ${NX.icon("chevron", 11)}</button>` : ""}</div><div class="sm-rec">${recHTML(rec)}</div>`}</div>
      ${smFoot(me)}`;
    const S = $("#start"), si = $(".sm-search input", S);
    si.oninput = () => { const pos = si.selectionStart; startDraw(si.value); const n = $(".sm-search input"); n.focus(); n.setSelectionRange(pos, pos); };
    si.onkeydown = (e) => { if (e.key === "Enter") { const f = $(".sm-res", S); if (f) f.click(); } };
    if (q) { startExtras(q, S); wireDetail(S); }
    S.querySelectorAll("[data-app]").forEach((b) => { b.onclick = () => { closeFlyouts(); NX.open(b.dataset.app); }; b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.app, a = NX.apps[id]; const r = S.getBoundingClientRect(); const mx = e.clientX, my = e.clientY; const items = [[p.pinned.includes(id) ? "Unpin from taskbar" : "Pin to taskbar", () => pin(id)], [p.desktop.includes(id) ? "Remove from desktop" : "Add to desktop", () => NX.setPref("desktop", p.desktop.includes(id) ? p.desktop.filter((x) => x !== id) : [...p.desktop, id])], ...(a.builtIn ? [] : [["Uninstall", () => NX.uninstall(id)]])]; menu(mx, my, items); void r; }; });
    const web = $("[data-web]", S); if (web) web.onclick = () => { closeFlyouts(); NX.searchWeb(q); };
    const st = $("[data-store]", S); if (st) st.onclick = () => { closeFlyouts(); NX.open("store"); };
    const aa = $("[data-allapps]", S); if (aa) aa.onclick = (e) => { e.stopPropagation(); startDraw("", "all"); };
    S.querySelectorAll("[data-rfile]").forEach((b) => (b.onclick = () => { const f = NX.data("recent-files", [])[+b.dataset.rfile]; closeFlyouts(); if (f) NX.openFile(f); }));
    S.querySelectorAll("[data-rfile]").forEach((b) => { const f = NX.data("recent-files", [])[+b.dataset.rfile]; if (f && f.kind === "image" && NX.fs && NX.fs.url) NX.fs.url(f.path).then((u) => { const i = b.querySelector("svg"); if (i) i.outerHTML = `<img class="sm-thumb" src="${NX.esc(u)}" alt="">`; }).catch(() => {}); });
    $("[data-me]", S).onclick = () => { closeFlyouts(); NX.open("settings", { page: "accounts" }); };
    smFootWire(S);
    S.querySelectorAll(".sm-grid .sm-tile[data-app]").forEach((t) => { t.draggable = true;
      t.ondragstart = (e) => { e.dataTransfer.setData("text/nx-pin", t.dataset.app); e.dataTransfer.effectAllowed = "move"; t.classList.add("dragging"); };
      t.ondragend = () => t.classList.remove("dragging");
      t.ondragover = (e) => { e.preventDefault(); t.classList.add("drop"); }; t.ondragleave = () => t.classList.remove("drop");
      t.ondrop = (e) => { e.preventDefault(); t.classList.remove("drop"); const from = e.dataTransfer.getData("text/nx-pin"); if (!from || from === t.dataset.app) return; const cur = [...S.querySelectorAll(".sm-grid .sm-tile[data-app]")].map((x) => x.dataset.app).filter((x) => x !== from); cur.splice(cur.indexOf(t.dataset.app), 0, from); NX.setPref("startOrder", cur); startDraw(""); };
    });
    const rm = $("[data-recmore]", S); if (rm) rm.onclick = (e) => { e.stopPropagation(); closeFlyouts(); NX.open("files", { path: "::recent" }); };
  }
  // Recommended: recently opened files first (like Windows 11), then recently used apps
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "Just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString(); };
  const FICON = { image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };
  function recHTML(rec) {
    const files = NX.prefs().showrecent === false ? [] : NX.data("recent-files", []).slice(0, 4), out = [];
    files.forEach((f, i) => out.push(`<button class="sm-res" data-rfile="${i}">${NX.icon(FICON[f.kind] || "file", 30)}<span><b>${NX.esc(f.name)}</b><small>${ago(f.at)}</small></span></button>`));
    rec.slice(0, 6 - out.length).forEach((id) => out.push(`<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 30)}<span><b>${NX.esc(NX.apps[id].name)}</b><small>Recently opened</small></span></button>`));
    return out.length ? out.join("") : `<p class="sm-empty">The apps and files you open will show up here.</p>`;
  }
  // the bottom of Start: you, the folder shortcuts and the power button (both Start views)
  const smFoot = (me) => `<div class="sm-foot"><button class="sm-me" data-me="1">${NX.avatar(me, "av")}<span>${NX.esc(me.name)}</span></button><div class="sm-right"><div class="sm-places">${[["Documents", "file"], ["Downloads", "download"], ["Pictures", "folder"], ["Settings", "settings"]].map(([n, ic]) => `<button data-place="${n}" title="${n}" aria-label="${n}">${NX.icon(ic, 17)}</button>`).join("")}</div><div class="sm-pw"><button class="sm-pwb" aria-label="Power" title="Power">${NX.icon("power", 18)}</button><div class="sm-pwm" hidden><button data-pw="lock">${NX.icon("lock", 16)}Lock</button><button data-pw="out">${NX.icon("signout", 16)}Sign out</button><button data-pw="sleep">${NX.icon("moon", 16)}Sleep</button>${NX.update && NX.update.info && NX.update.info.available ? `<button data-pw="update">${NX.icon("download", 16)}Update and restart</button>` : ""}<button data-pw="restart">${NX.icon("restart", 16)}Restart</button><button data-pw="off">${NX.icon("power", 16)}Shut down</button></div></div></div></div>`;
  function smFootWire(S) {
    $(".sm-pwb", S).onclick = (e) => { e.stopPropagation(); const m = $(".sm-pwm", S); m.hidden = !m.hidden; };
    S.querySelectorAll("[data-place]").forEach((b) => (b.onclick = () => { closeFlyouts(); const n = b.dataset.place; if (n === "Settings") NX.open("settings"); else NX.open("files", { place: n }); }));
    S.querySelectorAll("[data-pw]").forEach((b) => (b.onclick = () => { const k = b.dataset.pw; if (k === "update") { closeFlyouts(); NX.toast("Updating Nebulux OS. Keep the computer on."); NX.update.install().catch((e) => NX.toast(e.message)); return; } if (k === "lock") lockKeep(); else if (k === "out") signOut(); else if (k === "sleep") sleep(); else power(k === "restart" ? "restart" : "off"); }));
  }
  // All apps: every app, A to Z, with letter headings
  // All apps by category (like Windows 11's newest Start): a card for each kind of app, with its first apps showing
  function catHTML(list) {
    const G = new Map(); for (const id of list) { const a = NX.apps[id], c = a.category || (a.builtIn ? "Nebulux OS" : "Other"); if (!G.has(c)) G.set(c, []); G.get(c).push(id); }
    const order = [...G.keys()].sort((x, y) => (x === "Nebulux OS" ? -1 : y === "Nebulux OS" ? 1 : G.get(y).length - G.get(x).length));
    return `<div class="sm-cats">${order.map((c) => { const ids = G.get(c); return `<div class="sm-cat"><button class="sm-cat-h"><b>${NX.esc(c)}</b><small>${ids.length}</small></button><div class="sm-cat-g">${ids.map((id, k) => `<button class="sm-cat-a ${k > 3 ? "more" : ""}" data-app="${id}" title="${NX.esc(NX.apps[id].name)}">${NX.icon(NX.apps[id].icon || id, 34)}<span>${NX.esc(NX.apps[id].name)}</span></button>`).join("")}</div></div>`; }).join("")}</div>`;
  }
  function allAppsDraw(all, me) {
    const S = $("#start"), list = [...all].sort((a, b) => NX.apps[a].name.localeCompare(NX.apps[b].name)), view = NX.prefs().allView === "cat" ? "cat" : "list";
    let letter = "", rows = "";
    for (const id of list) { const L = NX.apps[id].name[0].toUpperCase(); if (L !== letter) { letter = L; rows += `<h5 class="sm-letter">${NX.esc(L)}</h5>`; } rows += `<button class="sm-res" data-app="${id}">${NX.icon(NX.apps[id].icon || id, 28)}<span><b>${NX.esc(NX.apps[id].name)}</b></span></button>`; }
    S.innerHTML = `<label class="sm-search">${NX.icon("search", 16)}<input placeholder="Search for apps, settings and the web" aria-label="Search"></label>
      <div class="sm-body"><div class="sm-h"><h4>All apps</h4><div class="seg sm-av">${[["cat", "Category"], ["list", "List"]].map(([v, t]) => `<button data-av="${v}" class="${view === v ? "on" : ""}">${t}</button>`).join("")}</div><button class="sm-all" data-back="1">${NX.icon("back", 12)} Back</button></div>${view === "cat" ? catHTML(list) : `<div class="sm-allist">${rows}<button class="sm-res" data-store="1">${NX.icon("store", 28)}<span><b>Get more apps</b><small>Nebulux Store</small></span></button></div>`}</div>
      ${smFoot(me)}`;
    S.querySelectorAll("[data-app]").forEach((b) => (b.onclick = () => { closeFlyouts(); NX.open(b.dataset.app); }));
    $("[data-back]", S).onclick = (e) => { e.stopPropagation(); startDraw(""); };
    const stb = $("[data-store]", S); if (stb) stb.onclick = () => { closeFlyouts(); NX.open("store"); };
    S.querySelectorAll("[data-av]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); NX.setPref("allView", b.dataset.av); allAppsDraw(all, me); }));
    S.querySelectorAll(".sm-cat-h").forEach((h) => (h.onclick = (e) => { e.stopPropagation(); h.parentElement.classList.toggle("open"); }));
    $("[data-me]", S).onclick = () => { closeFlyouts(); NX.open("settings", { page: "accounts" }); }; smFootWire(S);
    const si = $(".sm-search input", S); si.oninput = () => { startDraw(si.value); const n = $(".sm-search input"); n.focus(); };
  }
  // the details panel of Start search
  function wireDetail(S) {
    const box = $(".sm-results", S), pane = $(".sm-detail", S); if (!box || !pane) return;
    const show = (b) => {
      if (!b) { pane.innerHTML = ""; return; }
      box.querySelectorAll(".sm-res").forEach((x) => x.classList.toggle("on", x === b));
      const id = b.dataset.app;
      if (id && NX.apps[id]) {
        const a = NX.apps[id], p = NX.prefs(), pinned = p.pinned.includes(id), onDesk = p.desktop.includes(id);
        pane.innerHTML = `<div class="sm-dt">${NX.icon(a.icon || id, 72)}<b>${NX.esc(a.name)}</b><small>App${a.publisher ? " · " + NX.esc(a.publisher) : ""}</small></div>
          <div class="sm-dacts"><button data-da="open">${NX.icon("fwd", 16)}Open</button><button data-da="pin">${NX.icon("taskbar", 16)}${pinned ? "Unpin from taskbar" : "Pin to taskbar"}</button><button data-da="desk">${NX.icon("display", 16)}${onDesk ? "Hide from desktop" : "Show on desktop"}</button>${a.builtIn ? "" : `<button data-da="uninstall">${NX.icon("trash", 16)}Uninstall</button>`}</div>`;
        pane.querySelectorAll("[data-da]").forEach((x) => (x.onclick = async (e) => {
          e.stopPropagation(); const k = x.dataset.da, P = NX.prefs();
          if (k === "open") { closeFlyouts(); NX.open(id); return; }
          if (k === "pin") { pin(id); NX.toast(a.name + (P.pinned.includes(id) ? " is unpinned from the taskbar." : " is pinned to the taskbar.")); }
          if (k === "desk") NX.setPref("desktop", P.desktop.includes(id) ? P.desktop.filter((v) => v !== id) : [...P.desktop, id]);
          if (k === "uninstall") { if (NX.isNative && NX.isNative(id)) { x.disabled = true; try { await NX.uninstallNative(id); } catch (er) { NX.toast(er.message); } } NX.uninstall(id); closeFlyouts(); return; }
          show(b);
        }));
        return;
      }
      const t = b.querySelector("b"), sm = b.querySelector("small");
      pane.innerHTML = `<div class="sm-dt">${b.querySelector("svg") ? b.querySelector("svg").outerHTML.replace(/width="\d+" height="\d+"/, 'width="72" height="72"') : ""}<b>${t ? NX.esc(t.textContent) : ""}</b><small>${sm ? NX.esc(sm.textContent) : ""}</small></div><div class="sm-dacts"><button data-da="open">${NX.icon("fwd", 16)}Open</button></div>`;
      pane.querySelector("[data-da=open]").onclick = (e) => { e.stopPropagation(); b.click(); };
    };
    box.addEventListener("pointerover", (e) => { const b = e.target.closest(".sm-res"); if (b && !b.classList.contains("on")) show(b); });
    show(box.querySelector(".sm-res"));
  }
  // Settings pages and files that match a Start search (files are looked up in your main folders)
  let searchGen = 0;
  async function startExtras(q, S) {
    const gen = ++searchGen, ql = q.toLowerCase(), box = $(".sm-results", S); if (!box) return;
    const web = box.querySelector("[data-web]");
    // quick actions, like in Quick Search: a sum, a timer, a reminder
    { const acts = [];
      if (/[0-9)]/.test(q) && /[-+*/^%()]|sqrt|sin|cos|tan|log/.test(q) && NX.calcEval) { try { const v = NX.calcEval(q, true); if (isFinite(v)) { const r2 = String(+v.toPrecision(12)); acts.push([NX.icon("calculator", 28), "= " + r2, "Copy the answer", () => { navigator.clipboard && navigator.clipboard.writeText(r2).catch(() => {}); if (NX.clip) NX.clip.add(r2); NX.toast("Copied " + r2 + "."); }]); } } catch (e) { /* not a sum */ } }
      const tm = NX.parseTimer && NX.parseTimer(q); if (tm) acts.push([NX.icon("clock", 28), "Start a " + tm.one + " timer", "Clock", () => NX.startTimer(tm)]);
      const rm = /^remind me /i.test(q) && NX.parseReminder ? NX.parseReminder(q) : null; if (rm) acts.push([NX.icon("reminders", 28), "Remind me: " + rm.text, rm.when ? rm.when.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Reminders", () => { NX.addReminder(rm.text, rm.when); NX.toast("Reminder added" + (rm.when ? " for " + NX.fmtTime(rm.when) + "." : ".")); }]);
      if (acts.length) { box.insertAdjacentHTML("afterbegin", `<h4 class="sm-sub">Do it now</h4>` + acts.map(([ic, t, sub], i) => `<button class="sm-res sm-act" data-sact="${i}">${ic}<span><b>${NX.esc(t)}</b><small>${NX.esc(sub)}</small></span></button>`).join(""));
        box.querySelectorAll("[data-sact]").forEach((b) => (b.onclick = () => { closeFlyouts(); acts[+b.dataset.sact][3](); })); } }
    const pages = (NX.settingsPages || []).filter((pg) => pg.id !== "home" && (pg.name.toLowerCase().includes(ql) || ((NX.settingsWords || {})[pg.id] || "").includes(ql) || (pg.keys || "").includes(ql))).slice(0, 3);
    if (pages.length) { web.insertAdjacentHTML("beforebegin", `<h4 class="sm-sub">Settings</h4>` + pages.map((pg) => `<button class="sm-res" data-spage="${pg.id}">${NX.icon(pg.icon, 28)}<span><b>${NX.esc(pg.name)}</b><small>Settings</small></span></button>`).join(""));
      box.querySelectorAll("[data-spage]").forEach((b) => (b.onclick = () => { closeFlyouts(); NX.open("settings", { page: b.dataset.spage, find: ql }); })); }
    if (!NX.fs || ql.length < 2) return;
    let found = [];
    try { const pl = await NX.fs.places(); for (const f of pl.folders) { const r = await NX.fs.list(f.path).catch(() => null); if (r) found.push(...r.entries.filter((e) => e.name.toLowerCase().includes(ql)).map((e) => Object.assign({ where: f.name }, e))); if (found.length > 12) break; } } catch (e) { return; }
    if (gen !== searchGen || !found.length || !document.body.contains(web)) return;
    found = found.slice(0, 5); const FI = { folder: "folder", image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf" };
    web.insertAdjacentHTML("beforebegin", `<h4 class="sm-sub">Files</h4>` + found.map((e, i) => `<button class="sm-res" data-sfile="${i}">${NX.icon(FI[e.kind] || "file", 28)}<span><b>${NX.esc(e.name)}</b><small>${NX.esc(e.where)}</small></span></button>`).join(""));
    box.querySelectorAll("[data-sfile]").forEach((b) => (b.onclick = () => { closeFlyouts(); NX.openFile(found[+b.dataset.sfile]); }));
  }
  function toggleStart(focus) { if (NX.browserHide) NX.browserHide(); if (NX.nativeHideActive) NX.nativeHideActive(); const S = $("#start"); if (!S.hidden) { closeFlyouts(); return; } closeFlyouts("start"); startDraw(""); S.hidden = false; if (focus) setTimeout(() => $(".sm-search input").focus(), 30); }
  var qsEdit = false; // Edit mode: tap tiles to show or hide them
  function qsDraw() {
    const p = NX.prefs(), t = (k, icon, label, on, more) => more ? `<div class="qs-t qs-split ${on ? "on" : ""}"><button class="qs-main" data-k="${k}" aria-label="${label}">${NX.icon(icon, 18)}</button><button class="qs-more" data-more="${k}" aria-label="${label} list">${NX.icon("chevron", 12)}</button><span>${label}</span></div>` : `<button class="qs-t ${on ? "on" : ""}" data-k="${k}">${NX.icon(icon, 18)}<span>${label}</span></button>`;
    const hide = p.qsHide || [], tiles = [["wifi", t("wifi", "wifi", "Wi-Fi", p.wifi && !p.airplane, true)], ["bt", t("bt", "bt", "Bluetooth", p.bt && !p.airplane, true)], ["airplane", t("airplane", "plane", "Airplane mode", p.airplane)], ["night", t("night", "moon", "Night light", p.night)], ["theme", t("theme", "contrast", p.theme === "dark" ? "Dark mode" : "Light mode", p.theme === "dark")], ["dnd", t("dnd", "bell", "Do not disturb", !!p.dnd)], ...(batt() ? [["saver", t("saver", "leaf", "Battery saver", NX.saverOn())]] : []), ["cast", t("cast", "cast", "Cast", false)], ["snip", t("snip", "shot", "Screenshot", false)], ["bigcursor", t("bigcursor", "mouse", "Large pointer", !!p.bigcursor)], ["access", t("access", "access", "Accessibility", !!(p.narrator || p.stickyKeys || p.bigfocus || (p.colorFilter && p.colorFilter !== "none")), true)]];
    $("#qs").innerHTML = `<div class="qs-grid ${qsEdit ? "qs-editing" : ""}">${tiles.filter(([k]) => qsEdit || !hide.includes(k)).map(([k, h]) => qsEdit ? h.replace(/class="qs-t/, `class="qs-t ${hide.includes(k) ? "qs-hid" : "qs-shown"}`) : h).join("")}</div>
      <label class="qs-sl">${NX.icon("sun", 18)}<input type="range" min="30" max="100" value="${p.brightness}" data-s="brightness" aria-label="Brightness"></label><label class="qs-sl">${NX.icon("volume", 18)}<input type="range" min="0" max="100" value="${p.volume}" data-s="volume" aria-label="Volume"></label>
      ${NX.nowPlaying && NX.nowPlaying() ? (() => { const n = NX.nowPlaying(); return `<div class="qs-np"><span class="qs-npi">${NX.icon(n.video ? "fvideo" : "faudio", 26)}</span><span class="qs-npt"><b>${NX.esc(n.name)}</b><small>Media Player</small></span><button data-np="play" aria-label="${n.playing ? "Pause" : "Play"}">${n.playing ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>'}</button><button data-np="next" aria-label="Next">${NX.icon("fwd", 16)}</button></div>`; })() : ""}
      <div class="qs-foot"><button class="qs-batt" aria-label="Power and battery settings" ${batt() ? "" : "hidden"}>${batt() ? `${NX.battIcon(20)} ${batt().percent}%${batt().charging ? " (charging)" : ""}${NX.battLeft() ? `<small class="qs-left">${NX.battLeft()}</small>` : ""}` : ""}</button>${qsEdit ? `<button class="btn primary qs-done">Done</button>` : `<button class="qs-editb" aria-label="Edit quick settings" title="Edit quick settings">${NX.icon("rename", 18)}</button>`}<button class="qs-set" aria-label="All settings">${NX.icon("settings", 18)}</button></div>`;
    const Q = $("#qs");
    Q.querySelectorAll("[data-np]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const n = NX.nowPlaying && NX.nowPlaying(); if (!n) return; if (b.dataset.np === "play") n.toggle(); else n.next(); setTimeout(qsDraw, 150); }));
    Q.querySelectorAll("[data-k]").forEach((b) => (b.onclick = (ev) => {
      const k = b.dataset.k, P = NX.prefs();
      if (qsEdit) { ev.stopPropagation(); const h = (P.qsHide || []).slice(), at = h.indexOf(k); if (at >= 0) h.splice(at, 1); else h.push(k); NX.setPref("qsHide", h); qsDraw(); return; }
      if (k === "snip") { closeFlyouts(); setTimeout(() => NX.snipArea && NX.snipArea(), 250); return; }
      if (k === "bigcursor") { NX.setPref("bigcursor", !P.bigcursor); qsDraw(); return; }
      if (k === "store") { closeFlyouts(); NX.open("store"); return; }
      if (k === "cast") { qsMore("cast"); return; }
      if (k === "access") { qsAccess(); return; }
      if (k === "theme") { NX.setPref("themeAuto", false); NX.setPref("theme", P.theme === "dark" ? "light" : "dark"); }
      else if (k === "airplane") { NX.setPref("airplane", !P.airplane); if (!P.airplane) { NX.setPref("wifi", false); NX.setPref("bt", false); } }
      else if (k === "dnd") NX.setPref("dnd", !P.dnd);
      else if (k === "saver") { const on = NX.saverOn(); NX.setPref("saver", !on); if (on) NX.setPref("saverAuto", false); NX.toast(on ? "Battery saver is off." : "Battery saver is on: effects and animations are off to save power."); }
      else { NX.setPref(k, !(P[k] && !P.airplane)); if (k !== "night") NX.setPref("airplane", false); }
      qsDraw();
    }));
    const fill = (s) => s.style.setProperty("--fill", ((s.value - s.min) / (s.max - s.min)) * 100 + "%");
    Q.querySelectorAll("[data-s]").forEach((s) => { fill(s); s.oninput = () => { fill(s); NX.setPref(s.dataset.s, +s.value); }; });
    $(".qs-set", Q).onclick = () => { qsEdit = false; closeFlyouts(); NX.open("settings"); };
    const qe = $(".qs-editb", Q); if (qe) qe.onclick = (e) => { e.stopPropagation(); qsEdit = true; qsDraw(); };
    const qd = $(".qs-done", Q); if (qd) qd.onclick = (e) => { e.stopPropagation(); qsEdit = false; qsDraw(); };
    $(".qs-batt", Q).onclick = () => { closeFlyouts(); NX.open("settings", { page: "system" }); };
    Q.querySelectorAll("[data-more]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (qsEdit) { b.parentElement.querySelector("[data-k]").click(); return; } qsMore(b.dataset.more); }));
  }
  // ---------- the lists inside quick settings: Wi-Fi networks, Bluetooth devices, Cast ----------
  // Quick Settings > Accessibility (like Windows): the helpers you might need right now, one click each
  function qsAccess() {
    const Q = $("#qs"), p = NX.prefs(), sw = (k, on, name) => `<label class="qs-arow"><span>${name}</span><span class="tg"><input type="checkbox" ${on ? "checked" : ""} data-qa="${k}" aria-label="${name}" role="switch"><i></i></span></label>`;
    Q.innerHTML = `<div class="qs-sub"><div class="qs-subh"><button class="qs-back" aria-label="Back">${NX.icon("back", 16)}</button><b>Accessibility</b></div><div class="qs-list qs-alist">
      ${sw("narrator", !!p.narrator, "Narrator")}${sw("stickyKeys", !!p.stickyKeys, "Sticky Keys")}${sw("bigfocus", !!p.bigfocus, "Bold focus outline")}${sw("colorFilter", !!(p.colorFilter && p.colorFilter !== "none"), "Color filter")}
      <button class="qs-arow qs-abtn" data-qb="osk"><span>On-screen keyboard</span>${NX.icon("chevron", 14)}</button><button class="qs-arow qs-abtn" data-qb="mag"><span>Magnifier</span>${NX.icon("chevron", 14)}</button></div>
      <button class="qs-link" data-go="access">More accessibility settings</button></div>`;
    $(".qs-back", Q).onclick = (e) => { e.stopPropagation(); qsDraw(); };
    $(".qs-link", Q).onclick = () => { closeFlyouts(); NX.open("settings", { page: "access" }); };
    Q.querySelectorAll("[data-qa]").forEach((i) => { i.onclick = (e) => e.stopPropagation(); i.onchange = () => { const k = i.dataset.qa; if (k === "colorFilter") NX.setPref("colorFilter", i.checked ? (NX.prefs().lastColorFilter || "gray") : "none"); else NX.setPref(k, i.checked); }; });
    Q.querySelectorAll("[data-qb]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); closeFlyouts(); if (b.dataset.qb === "osk") NX.osk && NX.osk(true); else NX.magnifier && NX.magnifier.zoom(1); }));
  }
  function qsMore(kind) {
    const Q = $("#qs"), p = NX.prefs(), title = { wifi: "Wi-Fi", bt: "Bluetooth", cast: "Cast" }[kind], go = { wifi: "network", bt: "devices", cast: "system" }[kind];
    const on = kind === "cast" ? null : !!(p[kind] && !p.airplane);
    Q.innerHTML = `<div class="qs-sub"><div class="qs-subh"><button class="qs-back" aria-label="Back">${NX.icon("back", 16)}</button><b>${title}</b>${on == null ? "" : `<label class="tg"><input type="checkbox" ${on ? "checked" : ""} data-qt="${kind}"><i></i></label>`}</div><div class="qs-list"><p class="qs-note">Looking...</p></div>
      <button class="qs-link" data-go="${go}">${kind === "wifi" ? "More Wi-Fi settings" : kind === "bt" ? "More Bluetooth settings" : "Display settings"}</button></div>`;
    $(".qs-back", Q).onclick = (e) => { e.stopPropagation(); qsDraw(); };
    $(".qs-link", Q).onclick = () => { closeFlyouts(); NX.open("settings", { page: go }); };
    const tq = Q.querySelector("[data-qt]"); if (tq) tq.onchange = () => { NX.setPref(kind, tq.checked); if (tq.checked) NX.setPref("airplane", false); setTimeout(() => qsMore(kind), 1500); };
    const list = Q.querySelector(".qs-list"), note = (t) => (list.innerHTML = `<p class="qs-note">${t}</p>`);
    // when Wi-Fi isn't working: a Troubleshoot button that opens the troubleshooter and runs it
    const noteFix = (t) => { list.innerHTML = `<p class="qs-note">${t}</p><div class="qs-fixw"><button class="btn sm primary qs-fix">Troubleshoot</button></div>`; $(".qs-fix", list).onclick = (e) => { e.stopPropagation(); NX.shell.troubleshoot(); }; };
    if (!NX.native) {
      note(kind === "wifi" ? (NX.netOK() ? "Connected to the internet through this computer's connection." : NX.netWhy()) : kind === "bt" ? "Bluetooth devices connect on the real Nebulux OS (from the USB), or through Settings in Edge and Chrome." : "On the real Nebulux OS (from the USB), cast to a TV that supports screen mirroring, or plug one into the HDMI port.");
      return;
    }
    if (kind === "wifi") {
      if (!on) return note("Wi-Fi is off.");
      NX.api("GET", "/wifi").then((w) => {
        if (!w.device) return noteFix(NX.esc(w.error || "This computer has no Wi-Fi that Nebulux OS can use. A network cable works too."));
        if (w.error) return noteFix(NX.esc(w.error));
        if (!w.networks.length) return noteFix("No networks found yet. Wait a moment, or troubleshoot.");
        list.innerHTML = w.networks.slice(0, 12).map((n, i) => `<div class="qs-item ${n.active ? "on" : ""}" data-i="${i}"><button class="qs-row" data-row="${i}">${NX.icon("wifi", 18)}<span><b>${NX.esc(n.ssid)}</b><small>${n.active ? "Connected" : n.secure ? "Secured" : "Open"}</small></span></button></div>`).join("");
        list.querySelectorAll("[data-row]").forEach((r) => (r.onclick = (e) => {
          e.stopPropagation(); const n = w.networks[+r.dataset.row], item = r.parentNode;
          if (item.querySelector(".qs-act")) return;
          // school and work networks need a username too: that's in Settings, with room to type
          if (n.enterprise && !n.active) { closeFlyouts(); NX.open("settings", { page: "network" }); NX.toast(n.ssid + " needs your username and password. Press Connect next to it."); return; }
          item.insertAdjacentHTML("beforeend", n.active ? `<div class="qs-act"><button class="btn sm" data-dis="1">Disconnect</button></div>` : `<form class="qs-act">${n.secure ? `<input type="password" placeholder="Network password" aria-label="Password for ${NX.esc(n.ssid)}" maxlength="63">` : ""}<button class="btn sm primary" type="submit">Connect</button><p class="qs-err"></p></form>`);
          const d = item.querySelector("[data-dis]"); if (d) d.onclick = () => NX.api("POST", "/wifi/disconnect").then(() => qsMore("wifi"));
          const f = item.querySelector("form"); if (!f) return; const pi = f.querySelector("input"); if (pi) pi.focus();
          f.onsubmit = (ev) => { ev.preventDefault(); const b = f.querySelector("button"); b.disabled = true; b.textContent = "Connecting...";
            NX.api("POST", "/wifi/connect", { ssid: n.ssid, password: pi ? pi.value : "" }).then(() => { NX.toast("Connected to " + n.ssid + "."); qsMore("wifi"); }).catch((er) => { b.disabled = false; b.textContent = "Connect"; f.querySelector(".qs-err").textContent = er.message; }); };
        }));
      }).catch((e) => note(e.message));
    }
    if (kind === "bt") {
      if (!on) return note("Bluetooth is off.");
      NX.api("GET", "/bt").then((b) => {
        if (!b.available) return note(b.error || "This computer has no Bluetooth that Nebulux OS can use.");
        list.innerHTML = (b.devices.length ? b.devices.map((d) => `<div class="qs-item"><div class="qs-row">${NX.icon("bt", 18)}<span><b>${NX.esc(d.name)}</b><small>${d.connected ? "Connected" : "Paired"}</small></span></div></div>`).join("") : `<p class="qs-note">No devices yet.</p>`) + `<button class="btn sm" data-add="1">Add a device</button>`;
        list.querySelector("[data-add]").onclick = () => { closeFlyouts(); NX.open("settings", { page: "devices" }); setTimeout(() => { const s = document.querySelector("#s-bscan"); if (s && !s.disabled) s.click(); }, 700); };
      }).catch((e) => note(e.message));
    }
    if (kind === "cast") {
      NX.api("GET", "/cast").then((c) => {
        list.innerHTML = `<p class="qs-note">Show Nebulux OS on a TV. With a wire: plug the TV into the HDMI port and it shows the same picture by itself.</p>` + (c.available ? (c.running ? `<div class="qs-castbtns"><button class="btn sm" data-c="show">Show the TV list</button><button class="btn sm" data-c="stop">Stop casting</button></div>` : `<button class="btn sm primary" data-c="start">Find wireless displays</button><p class="qs-note">For TVs with screen mirroring (Miracast). The computer's Wi-Fi needs to support it too.</p>`) : "");
        list.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { b.disabled = true; NX.api("POST", "/cast/" + b.dataset.c).then(() => qsMore("cast")).catch((e) => NX.toast(e.message)); }));
      }).catch((e) => note(e.message));
    }
  }
  let calM = null;
  // events: a reminder when one starts (checked every 15 seconds)
  let calSel = null;
  function eventsTick(now) {
    if (!NX.me) return; const d = now || new Date(), k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const L = NX.data("events", []); let ch = false;
    for (const e of L) { const today = e.repeat && NX.occursOn ? NX.occursOn(e, k) : e.date === k; if (today && e.time === hm && (e.repeat ? e.toldOn !== k : !e.told)) { if (e.repeat) e.toldOn = k; else e.told = "1"; ch = true; NX.toast("Now: " + e.title); if (NX.beep) NX.beep(); } }
    if (ch) NX.setData("events", L);
  }
  setInterval(() => eventsTick(), 15000);
  NX.eventsTick = eventsTick;
  function calDraw() {
    const now = new Date(), m = calM || new Date(now.getFullYear(), now.getMonth(), 1), first = new Date(m.getFullYear(), m.getMonth(), 1), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    let cells = ""; for (let i = 0; i < first.getDay(); i++) cells += "<span></span>";
    const ev = NX.calEvents ? NX.calEvents() : NX.data("events", []), key = (y, mo, d) => y + "-" + String(mo + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate()); calSel = calSel || todayKey;
    for (let d = 1; d <= days; d++) { const k = key(m.getFullYear(), m.getMonth(), d), today = k === todayKey; cells += `<button class="${today ? "today" : ""} ${k === calSel ? "sel" : ""} ${ev.some((e) => e.date === k) ? "has" : ""}" data-day="${k}" aria-label="${k}">${d}</button>`; }
    const dayEv = ev.filter((e) => e.date === calSel).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const selD = new Date(calSel + "T12:00");
    const notes = NX.notes.slice(0, 8);
    NX.unread = 0; const bd = document.getElementById("tb-badge"); if (bd) bd.hidden = true;
    $("#cal").innerHTML = `<div class="nc"><div class="nc-h"><b>Notifications</b>${notes.length ? `<button class="nc-clear">Clear all</button>` : ""}</div>${notes.length ? notes.map((n, ni) => `<div class="nc-item"><span class="nc-ic">${NX.icon(NX.noteIcon ? NX.noteIcon(n.text) : "logo", 18)}</span><span>${NX.esc(n.text)}<small>${new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span><button class="nc-x" data-ncx="${ni}" aria-label="Dismiss" title="Dismiss">${NX.icon("close", 12)}</button></div>`).join("") : `<p class="nc-none">No new notifications</p>`}${NX.prefs().dnd ? `<p class="nc-dnd">Do not disturb is on. Notifications wait here.</p>` : ""}</div><div class="cal-card ${NX.data("cal-fold", false) ? "folded" : ""}"><div class="cal-top"><b>${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b><button class="cal-fold" aria-label="${NX.data("cal-fold", false) ? "Show the month" : "Hide the month"}" aria-expanded="${!NX.data("cal-fold", false)}" title="${NX.data("cal-fold", false) ? "Show the month" : "Hide the month"}">${NX.icon("up", 14)}</button></div><div class="cal-h"><span>${m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span><button data-m="-1" aria-label="Previous month">${NX.icon("up", 14)}</button><button data-m="1" aria-label="Next month" class="dn">${NX.icon("up", 14)}</button></div>
      <div class="cal-g">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<i>${x}</i>`).join("")}${cells}</div>
      <div class="cal-ev"><b>${calSel === todayKey ? "Today" : selD.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b>
        ${dayEv.length ? dayEv.map((e) => `<div class="cal-e"><span class="cal-et">${e.time ? NX.esc(NX.fmtTime(new Date(e.date + "T" + e.time))) : "All day"}</span><span class="cal-en">${NX.esc(e.title)}</span>${e.holiday ? "" : `<button data-evdel="${e.id}" aria-label="Delete event">${NX.icon("close", 12)}</button>`}</div>`).join("") : `<p class="cal-none">No events</p>`}
        <form class="cal-add"><input name="t" type="time" aria-label="Time (optional)"><input name="n" maxlength="60" placeholder="Add an event" aria-label="Event name"><button class="btn sm primary" type="submit">Add</button></form></div><div class="cal-focus"></div></div>`;
    if (NX.calFocus) NX.calFocus($("#cal .cal-focus"));
    // like Windows: the month folds away, so more notifications fit
    $("#cal .cal-fold").onclick = (e) => { e.stopPropagation(); NX.setData("cal-fold", !NX.data("cal-fold", false)); calDraw(); };
    const ncc = $("#cal .nc-clear"); if (ncc) ncc.onclick = (e) => { e.stopPropagation(); NX.notes.length = 0; calDraw(); };
    $("#cal").querySelectorAll("[data-ncx]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const it = b.closest(".nc-item"); it.classList.add("gone"); setTimeout(() => { NX.notes.splice(+b.dataset.ncx, 1); calDraw(); }, 200); }));
    $("#cal").querySelectorAll("[data-m]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); calM = new Date(m.getFullYear(), m.getMonth() + +b.dataset.m, 1); calDraw(); }));
    $("#cal").querySelectorAll("[data-day]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); calSel = b.dataset.day; calDraw(); }));
    $("#cal").querySelectorAll("[data-evdel]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); NX.setData("events", NX.data("events", []).filter((x) => x.id !== b.dataset.evdel)); calDraw(); }));
    const af = $("#cal .cal-add"); af.onclick = (e) => e.stopPropagation();
    af.onsubmit = (e) => { e.preventDefault(); const t = af.n.value.trim(); if (!t) { af.n.focus(); return; } const L = NX.data("events", []); if (L.length >= 300) { NX.toast("That's a lot of events. Delete some old ones first."); return; }
      L.push({ id: NX.uid(), date: calSel, time: /^\d\d:\d\d$/.test(af.t.value) ? af.t.value : "", title: t.slice(0, 60), told: "" }); NX.setData("events", L); calDraw(); const n2 = $("#cal .cal-add [name=n]"); if (n2) n2.focus(); };
  }

  // ---------- wiring ----------
  function init() {
    $("#lock").addEventListener("click", (e) => { if ($("#lock").className === "locked" && !e.target.closest("button")) reveal(); });
    let winAlone = false, sw = null;
    // Alt + Tab: a row of your open windows; let go of Alt to switch
    // 4.0: each item shows a live picture of its window above its icon and name (built once; Tab only moves the highlight)
    const swDraw = () => { const el = document.getElementById("switcher");
      if (el.dataset.n !== String(sw.list.length) || el.hidden) {
        el.dataset.n = sw.list.length;
        el.innerHTML = sw.list.map((w, i) => `<button class="sw-item" data-i="${i}"><span class="sw-pic"></span><span class="sw-name">${NX.icon(w.app.icon || w.id, 18)}<span>${NX.esc(w.app.name)}</span></span></button>`).join("");
        el.querySelectorAll(".sw-item").forEach((b, i) => { const w = sw.list[i], pic = b.querySelector(".sw-pic");
          if (!w.el || w.el.querySelector("iframe") || !w.el.offsetWidth) { pic.innerHTML = NX.icon(w.app.icon || w.id, 48); return; }
          const r = { width: w.el.offsetWidth, height: w.el.offsetHeight }, PW = 200, PH = 124, k = Math.min(PW / r.width, PH / r.height), c = w.el.cloneNode(true);
          c.removeAttribute("id"); c.removeAttribute("data-app"); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); c.classList.remove("opening", "closing", "minimized", "offdesk", "maxed");
          Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: r.width + "px", height: r.height + "px", transform: "translate(" + Math.round((PW - r.width * k) / 2) + "px," + Math.round((PH - r.height * k) / 2) + "px) scale(" + k + ")", transformOrigin: "0 0", pointerEvents: "none", margin: 0, opacity: 1 });
          c.inert = true; c.setAttribute("aria-hidden", "true"); pic.appendChild(c); });
        el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { sw.i = +b.dataset.i; swEnd(); }));
      }
      el.querySelectorAll(".sw-item").forEach((b, i) => b.classList.toggle("on", i === sw.i)); el.hidden = false; };
    const swEnd = () => { const el = document.getElementById("switcher"); if (!sw) return; const w = sw.list[sw.i]; sw = null; el.hidden = true; if (w) NX.focus(w.id); };
    const winKeys = (key) => {
      if (key === "desk") NX.showDesktop(); if (key === "lock") lockKeep(); if (key === "files") NX.open("files");
      if (key === "shot" && NX.screenshot) NX.screenshot().catch((er) => NX.toast(er.message));
      if (key === "snip" && NX.snipArea) NX.snipArea();
      if (key === "tm") NX.open("taskmgr");
      if (key === "tview" && NX.taskView) NX.taskView(); if (key === "widgets" && NX.widgets) NX.widgets(); if (key === "clip" && NX.clip) NX.clip.toggle();
      if (/^snap-/.test(key)) { const w = NX.topWin(); if (w) NX.snap(w.id, key.slice(5)); }
    };
    addEventListener("keydown", (e) => {
      if (!$("#lock").hidden && $("#lock").className === "locked") { reveal(); return; }
      if (e.key === "Escape") closeFlyouts();
      if (e.key === "Meta" || e.key === "OS") { winAlone = true; e.preventDefault(); return; }
      if (e.metaKey || e.getModifierState && e.getModifierState("OS")) winAlone = false;
      if (!NX.me) return;
      if (e.ctrlKey && !e.shiftKey && e.key === "Escape") { e.preventDefault(); toggleStart(true); }
      if (e.key === "PrintScreen") { e.preventDefault(); winKeys("shot"); }
      else if (e.metaKey && e.shiftKey && /^s$/i.test(e.key)) { e.preventDefault(); winKeys(NX.snipArea ? "snip" : "shot"); }
      else if (e.metaKey && !e.ctrlKey && /^[edlwv]$/i.test(e.key)) { e.preventDefault(); winKeys({ e: "files", d: "desk", l: "lock", w: "widgets", v: "clip" }[e.key.toLowerCase()]); }
      else if (e.metaKey && e.key === "Tab") { e.preventDefault(); winKeys("tview"); }
      else if (e.metaKey && !e.ctrlKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { e.preventDefault(); winKeys("snap-" + { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "max", ArrowDown: "down" }[e.key]); }
      if (e.ctrlKey && e.shiftKey && e.key === "Escape") { e.preventDefault(); winKeys("tm"); }
      if (e.altKey && e.key === "Tab") {
        e.preventDefault(); const list = [...NX.wins.values()].filter(((w) => !w.desk || !NX.desks || w.desk === NX.desks.current())).sort((a, b) => (a.min - b.min) || ((+b.el.style.zIndex) - (+a.el.style.zIndex)));
        if (!list.length) return; if (!sw) sw = { list, i: Math.min(1, list.length - 1) }; else sw.i = (sw.i + (e.shiftKey ? -1 : 1) + sw.list.length) % sw.list.length; swDraw();
      }
    });
    addEventListener("keyup", (e) => { if (e.key === "Alt" && sw) swEnd(); });
    addEventListener("blur", () => { if (sw && document.activeElement && document.activeElement.tagName !== "IFRAME") swEnd(); });
    addEventListener("keyup", (e) => { if ((e.key === "Meta" || e.key === "OS") && winAlone && NX.me) { e.preventDefault(); toggleStart(true); } if (e.key === "Meta" || e.key === "OS") winAlone = false; });
    // shortcuts from the window manager on the real computer
    document.addEventListener("nx:key", (e) => { if (!NX.me) return; const k = e.detail; if (k === "start") toggleStart(true); else { if (k !== "shot" && k !== "clip") closeFlyouts(); if (k === "desk" && NX.browserHide) NX.browserHide(); winKeys(k); } });
    // the same keys pressed while a website in a window has the keyboard
    addEventListener("message", (e) => { const d = e.data; if (!d || d.nx !== "key" || !NX.me || ![...document.querySelectorAll("iframe")].some((f) => f.contentWindow === e.source)) return;
      if (d.key === "start") toggleStart(true); else if (typeof d.key === "string") winKeys(d.key); });
    let ty = null; $("#lock").addEventListener("touchstart", (e) => (ty = e.touches[0].clientY), { passive: true });
    $("#lock").addEventListener("touchend", (e) => { if (ty != null && ty - e.changedTouches[0].clientY > 40) reveal(); ty = null; }, { passive: true });
    // the preview goes away with any click or key (and isn't left showing a copy of a window)
    addEventListener("pointerdown", (e) => { if (!e.target.closest || !e.target.closest("#tb-peek")) peekHide(); }, true);
    addEventListener("keydown", () => peekHide(), true);
    document.addEventListener("nx:winopen", () => peekHide());
    $("#tb-showdesk").onclick = () => { closeFlyouts(); if (NX.browserHide) NX.browserHide(); NX.showDesktop(); };
    $("#lk-power").onclick = (e) => { e.stopPropagation(); const m = $("#lk-pmenu"); m.hidden = !m.hidden; };
    $("#lk-pmenu").addEventListener("click", (e) => { const b = e.target.closest("[data-pw]"); if (!b) return; $("#lk-pmenu").hidden = true; power(b.dataset.pw === "restart" ? "restart" : "off"); });
    $("#tb-start").onclick = (e) => { e.stopPropagation(); toggleStart(false); };
    $("#tb-search").onclick = (e) => { e.stopPropagation(); toggleStart(true); };
    $("#tb-qs").onclick = (e) => { e.stopPropagation(); const q = $("#qs"); if (!q.hidden) { closeFlyouts(); return; } closeFlyouts("qs"); qsDraw(); q.hidden = false; };
    $("#tb-clock").onclick = (e) => { e.stopPropagation(); const c = $("#cal"); if (!c.hidden) { closeFlyouts(); return; } closeFlyouts("cal"); calM = null; calDraw(); c.hidden = false; };
    for (const id of ["start", "qs", "cal", "ctx", "widgets", "snapfly", "clip"]) $("#" + id).addEventListener("pointerdown", (e) => e.stopPropagation());
    // (the capture phase, so a click on a window edge that stops the event still closes flyouts)
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#taskbar,#start,#qs,#cal,#ctx,#widgets,#snapfly,.nx-ask")) closeFlyouts(); }, true);
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".dicon")) { document.querySelectorAll(".dicon.sel").forEach((x) => x.classList.remove("sel")); sel = null; } });
    $("#desktop").addEventListener("contextmenu", (e) => {
      if (e.target.closest(".win") || e.target.closest("#taskbar") || e.target.closest(".dicon") || e.target.closest("#start,#qs,#cal")) return;
      e.preventDefault(); menu(e.clientX, e.clientY, [["New folder", () => NX.desktopNew && NX.desktopNew(true)], ["New text document", () => NX.desktopNew && NX.desktopNew(false)], ["Refresh", () => { icons(); }], [NX.prefs().stacks ? "Stop using stacks" : "Use stacks", () => NX.setPref("stacks", !NX.prefs().stacks)], ["Sort by name", () => { const P = NX.prefs(); NX.setPref("desktop", [...P.desktop].sort((x, y) => (NX.apps[x] ? NX.apps[x].name : x).localeCompare(NX.apps[y] ? NX.apps[y].name : y))); icons(); }, "listv"], ["", null], ["View", null], ...[["large", "Large icons"], ["medium", "Medium icons"], ["small", "Small icons"]].map(([k, t]) => [t, () => { NX.setPref("iconSize", k); icons(); }, (NX.prefs().iconSize || "medium") === k ? "check" : "blank"]), ["", null], ["Desktop widgets", () => NX.open("settings", { page: "personal" })], ["Next background", () => { const p = NX.prefs(), n = NX.wallpapers.length, cur = typeof p.wallpaper === "number" ? p.wallpaper : -1; NX.setPref("wallpaper", (cur + 1) % n); NX.toast(NX.wallpapers[(cur + 1) % n].name + "."); }], ["Display settings", () => NX.open("settings", { page: "system" })], ["Personalize", () => NX.open("settings", { page: "personal" })], ["Open in File Explorer", () => NX.open("files", { place: "Desktop" })]]);
    });
    boot();
  }
  NX.menu = menu;
  const openWifi = () => { closeFlyouts("qs"); qsDraw(); $("#qs").hidden = false; qsMore("wifi"); };
  // Settings > Network & internet with the troubleshooter running
  function troubleshoot() {
    closeFlyouts(); NX.open("settings", { page: "network" });
    let n = 0; const t = setInterval(() => { const b = document.querySelector(".win[data-app=settings] #s-diag"); if (b) { clearInterval(t); b.scrollIntoView({ block: "center" }); b.click(); } else if (++n > 40) clearInterval(t); }, 100);
  }
  NX.shell = { sleep, troubleshoot, nightTick, nightHours: inHours, openWifi, closeFlyouts, toggleStart, icons, lockKeep, taskbar, refresh: () => { icons(); taskbar(); if (!$("#start").hidden) startDraw($(".sm-search input") ? $(".sm-search input").value : ""); }, recent: (id) => { if (!NX.me) return; NX.setPref("recent", [id, ...NX.prefs().recent.filter((x) => x !== id)].slice(0, 6)); }, signOut, power, lock };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
