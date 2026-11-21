// Settings: a left column (your account card, search, pages) and the page on the right, built from cards.
// Every control changes the OS right away and is saved for this account.
"use strict";
(function () {
  const ACCENTS = ["#7c5cff", "#ff4fa3", "#22c3ee", "#34d399", "#f5a524", "#ef4444", "#3b82f6", "#a855f7"];
  const PAGES = [
    { id: "system", name: "System", icon: "display" },
    { id: "personal", name: "Personalization", icon: "brush" },
    { id: "apps", name: "Apps", icon: "apps" },
    { id: "accounts", name: "Accounts", icon: "user" },
    { id: "time", name: "Time & language", icon: "time" },
    { id: "about", name: "About", icon: "info" },
  ];
  const row = (icon, title, sub, ctrl) => `<div class="s-row">${icon ? `<span class="s-ri">${NX.icon(icon, 20)}</span>` : ""}<div class="s-rt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div><div class="s-rc">${ctrl || ""}</div></div>`;
  const toggle = (key, on) => `<label class="tg"><input type="checkbox" data-pref="${key}" ${on ? "checked" : ""}><i></i><span>${on ? "On" : "Off"}</span></label>`;
  const slider = (key, v, min, max) => `<input type="range" class="sl" data-pref="${key}" min="${min}" max="${max}" value="${v}">`;

  NX.apps.settings = { name: "Settings", icon: "settings", builtIn: true, w: 980, h: 640, minW: 420, minH: 360, desc: "Change how Nebulux OS looks and works.",
    open(body, win, opts) {
      let page = opts.page || "system", q = "";
      body.classList.add("settings");
      const draw = () => {
        const p = NX.prefs(), me = NX.me;
        const nav = PAGES.filter((x) => !q || x.name.toLowerCase().includes(q)).map((x) => `<button class="s-nav ${x.id === page ? "on" : ""}" data-p="${x.id}">${NX.icon(x.icon, 18)}<span>${x.name}</span></button>`).join("");
        body.innerHTML = `<aside class="s-side"><div class="s-me" data-p="accounts"><span class="av" style="background:${me.color}">${NX.esc(me.name[0].toUpperCase())}</span><span><b>${NX.esc(me.name)}</b><small>Local account</small></span></div>
          <label class="s-search">${NX.icon("search", 16)}<input placeholder="Find a setting" value="${NX.esc(q)}" aria-label="Find a setting"></label><nav>${nav || `<p class="s-none">No settings match.</p>`}</nav></aside>
          <section class="s-main"><h1>${PAGES.find((x) => x.id === page).name}</h1>${pageHTML(page, p, me)}</section>`;
        wire();
      };
      function pageHTML(pg, p, me) {
        if (pg === "system") return `<div class="s-hero"><img src="${NX.wallpaperURL(p.wallpaper, 320, 180)}" alt=""><div><b>Nebulux PC</b><small>Nebulux OS 1.1</small></div></div>
          <h3>Display</h3>${row("sun", "Brightness", "Make the screen brighter or dimmer", slider("brightness", p.brightness, 30, 100))}${row("moon", "Night light", "Warmer colors to help you sleep", toggle("night", p.night))}
          <h3>Sound</h3>${row("sound", "Volume", NX.native ? "How loud this computer is" : "How loud the OS sounds are", slider("volume", p.volume, 0, 100))}
          <h3>Network</h3>${NX.native ? nativeNet(p) : `${row("wifi", "Wi-Fi", p.airplane ? "Airplane mode is on" : !p.wifi ? "Off: web searches and web apps won't open" : NX.online() ? "Connected to the internet (through this computer's connection)" : "Not connected: this computer is offline", toggle("wifi", p.wifi && !p.airplane))}
          ${row("bt", "Bluetooth", p.airplane ? "Airplane mode is on" : p.bt ? (navigator.bluetooth ? "On. Add a device to connect it." : "This browser can't reach Bluetooth devices. Try Edge or Chrome on a computer.") : "Off", toggle("bt", p.bt && !p.airplane))}
          ${p.bt && !p.airplane ? `<div class="s-card"><div class="s-bth"><b>Bluetooth devices</b><button class="btn primary" id="s-btadd" ${navigator.bluetooth ? "" : "disabled"}>Add device</button></div>${(NX.data("bt-devices", []).length ? NX.data("bt-devices", []).map((d, i) => `<div class="s-user">${NX.icon("bt", 20)}<b>${NX.esc(d.name)}</b><span class="s-tag">${d.at}</span><button class="btn" data-btrm="${i}">Remove</button></div>`).join("") : `<p class="s-note">No devices yet. Add device opens your browser's Bluetooth list, where you pick a device near you.</p>`)}<p class="s-msg" id="s-btmsg"></p></div>` : ""}
          `}${row("plane", "Airplane mode", "Turns off Wi-Fi and Bluetooth", toggle("airplane", p.airplane))}`;
        if (pg === "personal") return `<div class="s-preview" style="background-image:url(${NX.wallpaperURL(p.wallpaper, 560, 315)})"><div class="s-pv-task"></div><div class="s-pv-win ${p.theme}"></div></div>
          <h3>Background</h3><div class="s-walls">${NX.wallpapers.map((w, i) => `<button class="s-wall ${i === p.wallpaper ? "on" : ""}" data-wall="${i}" title="${w.name}" aria-label="${w.name}"><img src="${NX.wallpaperURL(i, 192, 108)}" alt=""><span>${w.name}</span></button>`).join("")}</div>
          <h3>Colors</h3>${row("contrast", "Choose your mode", "Dark or light windows and menus", `<div class="seg"><button data-theme="dark" class="${p.theme === "dark" ? "on" : ""}">Dark</button><button data-theme="light" class="${p.theme === "light" ? "on" : ""}">Light</button></div>`)}
          ${row("brush", "Accent color", "Used for buttons, switches and highlights", `<div class="s-acc">${ACCENTS.map((c) => `<button data-acc="${c}" class="${c === p.accent ? "on" : ""}" style="background:${c}" aria-label="Accent ${c}"></button>`).join("")}</div>`)}
          <h3>Taskbar</h3>${row("taskbar", "Taskbar alignment", "Where the Start button and apps sit", `<div class="seg"><button data-align="center" class="${p.align === "center" ? "on" : ""}">Center</button><button data-align="left" class="${p.align === "left" ? "on" : ""}">Left</button></div>`)}`;
        if (pg === "apps") {
          const all = Object.entries(NX.apps).filter(([id, a]) => a.builtIn || p.installed.includes(id));
          return `<h3>Installed apps</h3><p class="s-note">${all.length} apps. Get more in the Nebulux Store.</p>${all.map(([id, a]) => row(null, `<span class="s-appname">${NX.icon(a.icon || id, 28)}${NX.esc(a.name)}</span>`, a.builtIn ? "Part of Nebulux OS" : (a.size || "1 MB") + " · " + (a.url ? "Opens on the web" : "Runs on this PC"),
            a.builtIn ? `<span class="s-tag">System app</span>` : `<button class="btn" data-uninstall="${id}">Uninstall</button>`)).join("")}
            <div class="s-row s-link" data-openstore="1"><span class="s-ri">${NX.icon("store", 20)}</span><div class="s-rt"><b>Nebulux Store</b><small>Find new apps and games</small></div><div class="s-rc">${NX.icon("chevron", 16)}</div></div>`;
        }
        if (pg === "accounts") {
          const others = NX.users().filter((u) => u.id !== me.id);
          return `<div class="s-acct"><span class="av big" style="background:${me.color}">${NX.esc(me.name[0].toUpperCase())}</span><div><b>${NX.esc(me.name)}</b><small>Local account on this PC</small></div></div>
            <h3>Your info</h3><div class="s-card"><label class="fld"><span>Your name</span><input id="s-name" maxlength="24" value="${NX.esc(me.name)}"></label><button class="btn primary" id="s-rename">Save name</button><p class="s-msg" id="s-namemsg"></p></div>
            <h3>Sign-in options</h3><div class="s-card"><label class="fld"><span>Current password</span><input id="s-old" type="password" maxlength="64" autocomplete="current-password"></label><label class="fld"><span>New password</span><input id="s-new" type="password" maxlength="64" autocomplete="new-password"></label><label class="fld"><span>New password again</span><input id="s-new2" type="password" maxlength="64" autocomplete="new-password"></label><button class="btn primary" id="s-pw">Change password</button><p class="s-msg" id="s-pwmsg"></p></div>
            <h3>Other users</h3><div class="s-card">${others.length ? others.map((u) => `<div class="s-user"><span class="av" style="background:${u.color}">${NX.esc(u.name[0].toUpperCase())}</span><b>${NX.esc(u.name)}</b><button class="btn" data-rmuser="${u.id}">Remove</button></div>`).join("") : `<p class="s-note">No other accounts on this PC.</p>`}
            <p class="s-note">To add someone, sign out and choose Add account on the sign-in screen.</p></div>`;
        }
        if (pg === "time") { const d = new Date(); return `<div class="s-big-time">${NX.fmtTime(d)}<small>${d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</small></div>
          ${row("time", "24-hour clock", "Show 13:00 instead of 1:00 PM", toggle("clock24", p.clock24))}${row("globe", "Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Set by your browser", "")}${row("globe", "Language", navigator.language || "English", "")}`; }
        if (pg === "about") return `<div class="s-about">${NX.icon("logo", 64)}<div><b>Nebulux OS</b><small>Version 1.1 · made by Nebulux</small></div></div>
          <h3>Device specifications</h3><div class="s-card s-spec"><div><span>Device name</span><b>Nebulux PC</b></div><div><span>Processor threads</span><b>${navigator.hardwareConcurrency || "Unknown"}</b></div><div><span>Memory</span><b>${navigator.deviceMemory ? navigator.deviceMemory + " GB or more" : "Unknown"}</b></div><div><span>Screen</span><b>${screen.width} x ${screen.height}</b></div><div><span>Runs in</span><b>${NX.native ? "This computer, from the Nebulux OS USB" : "Your web browser"}</b></div><div id="s-kernel" hidden></div></div>
          <h3>Safe by design</h3><div class="s-card"><p class="s-note">${NX.native ? "Nebulux OS runs from its USB. It never changes this computer's own drive or the system already on it: take the USB out and restart, and the computer starts the way it always did." : "Nebulux OS runs inside a browser tab. It can't change or harm your computer, and closing the tab closes it. Your accounts and settings are saved in this browser only."}</p></div>`;
        return "";
      }
      // ---------- the real computer's Wi-Fi and Bluetooth (Nebulux OS from the USB) ----------
      function nativeNet(p) {
        return `<div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("wifi", 20)}<b>Wi-Fi</b></span><span class="s-hwc"><button class="btn" id="s-wrefresh" ${p.wifi && !p.airplane ? "" : "hidden"}>Refresh</button>${toggle("wifi", p.wifi && !p.airplane)}</span></div><p class="s-note" id="s-netnow"></p><div id="s-wlist"><p class="s-note">Looking for networks...</p></div></div>
          <div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("bt", 20)}<b>Bluetooth</b></span><span class="s-hwc"><button class="btn primary" id="s-bscan" ${p.bt && !p.airplane ? "" : "hidden"}>Add device</button>${toggle("bt", p.bt && !p.airplane)}</span></div><div id="s-blist"><p class="s-note">Checking Bluetooth...</p></div></div>`;
      }
      const q$ = (s) => body.querySelector(s);
      let nets = [], wifiBusy = false;
      async function fillWifi() {
        if (wifiBusy || !q$("#s-wlist")) return;
        NX.api("GET", "/net").then((n) => { const e = q$("#s-netnow"); if (e) e.textContent = n.online ? (n.kind === "wifi" ? "Connected to " + n.name + "." : "Connected with a network cable.") : "Not connected to the internet."; }).catch(() => {});
        let w; try { w = await NX.api("GET", "/wifi"); } catch (e) { const b0 = q$("#s-wlist"); if (b0) b0.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        const b = q$("#s-wlist"); if (!b || wifiBusy) return;
        if (!w.device) { b.innerHTML = `<p class="s-note">${NX.esc(w.error || "This computer has no Wi-Fi that Nebulux OS can use. A network cable works too.")}</p>`; return; }
        if (!w.on) { b.innerHTML = `<p class="s-note">Wi-Fi is off. Turn it on to see networks near you.</p>`; return; }
        nets = w.networks;
        b.innerHTML = nets.length ? nets.map((n, i) => `<div class="s-net ${n.active ? "on" : ""}"><span class="s-sig">${NX.icon("wifi", 20)}</span><span class="s-nn"><b>${NX.esc(n.ssid)}</b><small>${n.active ? "Connected" : n.secure ? "Secured" : "Open"} · signal ${n.signal}%</small></span><button class="btn ${n.active ? "" : "primary"}" data-wc="${i}">${n.active ? "Disconnect" : "Connect"}</button></div>`).join("") : `<p class="s-note">No networks found yet. Press Refresh in a moment.</p>`;
        b.querySelectorAll("[data-wc]").forEach((btn) => (btn.onclick = () => {
          const n = nets[+btn.dataset.wc], row = btn.closest(".s-net");
          if (n.active) { btn.disabled = true; btn.textContent = "Disconnecting..."; NX.api("POST", "/wifi/disconnect").then(() => { NX.toast("Disconnected from " + n.ssid + "."); fillWifi(); }).catch((e) => { NX.toast(e.message); fillWifi(); }); return; }
          const connect = (password, done) => {
            wifiBusy = true;
            NX.api("POST", "/wifi/connect", { ssid: n.ssid, password }).then(() => { wifiBusy = false; NX.toast("Connected to " + n.ssid + "."); fillWifi(); }).catch((e) => { wifiBusy = false; done(e.message); });
          };
          if (!n.secure) { btn.disabled = true; btn.textContent = "Connecting..."; connect("", (m) => { btn.disabled = false; btn.textContent = "Connect"; NX.toast(m); }); return; }
          if (row.querySelector(".s-pwf")) { row.querySelector(".s-pwf input").focus(); return; }
          btn.hidden = true;
          row.insertAdjacentHTML("beforeend", `<form class="s-pwf"><input type="password" maxlength="63" placeholder="Network password" aria-label="Password for ${NX.esc(n.ssid)}" autocomplete="off"><button class="btn primary" type="submit">Connect</button><button class="btn" type="button" data-cancel="1">Cancel</button><p class="s-msg"></p></form>`);
          const f = row.querySelector(".s-pwf"), pi = f.querySelector("input"), sub = f.querySelector("[type=submit]"), cancel = f.querySelector("[data-cancel]"), msg = f.querySelector(".s-msg"); pi.focus();
          cancel.onclick = () => { f.remove(); btn.hidden = false; };
          f.onsubmit = (e) => {
            e.preventDefault(); if (pi.value.length < 8) { msg.textContent = "Wi-Fi passwords are at least 8 characters."; return; }
            sub.disabled = true; sub.textContent = "Connecting..."; cancel.hidden = true; pi.disabled = true; msg.textContent = "";
            connect(pi.value, (m) => { sub.disabled = false; sub.textContent = "Connect"; cancel.hidden = false; pi.disabled = false; pi.value = ""; pi.focus(); msg.textContent = m; });
          };
        }));
      }
      async function fillBt(found) {
        if (!q$("#s-blist")) return;
        let s; try { s = await NX.api("GET", "/bt"); } catch (e) { const b0 = q$("#s-blist"); if (b0) b0.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        const b = q$("#s-blist"); if (!b) return; const scan = q$("#s-bscan");
        if (!s.available) { b.innerHTML = `<p class="s-note">This computer has no Bluetooth that Nebulux OS can use.</p>`; if (scan) scan.hidden = true; return; }
        if (!s.on) { b.innerHTML = `<p class="s-note">Bluetooth is off. Turn it on to connect headphones, mice and more.</p>`; return; }
        const mine = s.devices, near = (found || []).filter((d) => !d.paired);
        const dev = (d, btn) => `<div class="s-net"><span class="s-sig">${NX.icon("bt", 20)}</span><span class="s-nn"><b>${NX.esc(d.name)}</b><small>${d.paired ? (d.connected ? "Connected" : "Paired") : "Ready to pair"}</small></span>${btn}</div>`;
        b.innerHTML = (mine.length ? `<h4 class="s-sub">Your devices</h4>` + mine.map((d) => dev(d, `<button class="btn" data-brm="${NX.esc(d.mac)}">Remove</button>`)).join("") : `<p class="s-note">No devices yet. Press Add device, then put your device in pairing mode.</p>`) +
          (found ? `<h4 class="s-sub">Nearby</h4>` + (near.length ? near.map((d) => dev(d, `<button class="btn primary" data-bpair="${NX.esc(d.mac)}">Pair</button>`)).join("") : `<p class="s-note">No new devices found. Make sure yours is in pairing mode and press Add device again.</p>`) : "") + `<p class="s-msg" id="s-bmsg"></p>`;
        b.querySelectorAll("[data-brm]").forEach((x) => (x.onclick = () => { x.disabled = true; NX.api("POST", "/bt/remove", { mac: x.dataset.brm }).then(() => { NX.toast("Device removed."); fillBt(); }).catch((e) => { x.disabled = false; NX.toast(e.message); }); }));
        b.querySelectorAll("[data-bpair]").forEach((x) => (x.onclick = () => {
          b.querySelectorAll("[data-bpair]").forEach((y) => (y.disabled = true)); x.textContent = "Pairing...";
          const name = x.closest(".s-net").querySelector("b").textContent;
          NX.api("POST", "/bt/pair", { mac: x.dataset.bpair }).then(() => { NX.toast(name + " is connected."); fillBt(); })
            .catch((e) => { const m = q$("#s-bmsg"); if (m) m.textContent = e.message; b.querySelectorAll("[data-bpair]").forEach((y) => (y.disabled = false)); x.textContent = "Pair"; });
        }));
      }
      async function fillInfo() {
        let i; try { i = await NX.api("GET", "/info"); } catch (e) { return; }
        const spec = q$(".s-spec"); if (!spec) return;
        spec.innerHTML = [["Device name", "Nebulux PC"], ["Processor", i.cpu], ["Processor threads", i.threads], ["Installed memory", i.memoryGB + " GB"], ["Screen", screen.width + " x " + screen.height], ["Kernel", "Linux " + i.kernel + " (" + i.arch + ")"], ["Runs from", "The Nebulux OS USB"]]
          .map(([k, v]) => `<div><span>${k}</span><b>${NX.esc(String(v))}</b></div>`).join("");
      }
      function wireHW() {
        const r = q$("#s-wrefresh"); if (r) r.onclick = () => { const b = q$("#s-wlist"); if (b) b.innerHTML = `<p class="s-note">Looking for networks...</p>`; fillWifi(); };
        const sc = q$("#s-bscan"); if (sc) sc.onclick = async () => {
          sc.disabled = true; sc.textContent = "Looking..."; const b = q$("#s-blist"); if (b) b.insertAdjacentHTML("afterbegin", `<p class="s-note">Looking for devices near you. This takes about 10 seconds.</p>`);
          try { const r2 = await NX.api("POST", "/bt/scan"); await fillBt(r2.devices); } catch (e) { NX.toast(e.message); fillBt(); }
          const s2 = q$("#s-bscan"); if (s2) { s2.disabled = false; s2.textContent = "Add device"; }
        };
      }
      function wire() {
        if (NX.native) wireHW();
        body.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { page = b.dataset.p; draw(); body.querySelector(".s-main").scrollTop = 0; }));
        const si = body.querySelector(".s-search input"); si.oninput = () => { q = si.value.trim().toLowerCase(); const pos = si.selectionStart; draw(); const n = body.querySelector(".s-search input"); n.focus(); n.setSelectionRange(pos, pos); };
        body.querySelectorAll("[data-pref]").forEach((inp) => {
          const k = inp.dataset.pref;
          if (inp.type === "checkbox") inp.onchange = () => { NX.setPref(k, inp.checked); if (k === "airplane" && inp.checked) { NX.setPref("wifi", false); NX.setPref("bt", false); } if ((k === "wifi" || k === "bt") && inp.checked) NX.setPref("airplane", false); draw(); if (NX.native && ["wifi", "bt", "airplane"].includes(k)) setTimeout(() => { if (page === "system") { fillWifi(); fillBt(); } }, 1500); };
          else inp.oninput = () => NX.setPref(k, +inp.value);
        });
        body.querySelectorAll("[data-wall]").forEach((b) => (b.onclick = () => { NX.setPref("wallpaper", +b.dataset.wall); draw(); }));
        body.querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => { NX.setPref("theme", b.dataset.theme); draw(); }));
        body.querySelectorAll("[data-acc]").forEach((b) => (b.onclick = () => { NX.setPref("accent", b.dataset.acc); draw(); }));
        body.querySelectorAll("[data-align]").forEach((b) => (b.onclick = () => { NX.setPref("align", b.dataset.align); draw(); }));
        body.querySelectorAll("[data-uninstall]").forEach((b) => (b.onclick = () => { NX.uninstall(b.dataset.uninstall); draw(); }));
        // Bluetooth: the browser's own device chooser (Web Bluetooth); the chosen device is remembered for this account
        const bt = body.querySelector("#s-btadd"); if (bt) bt.onclick = async () => {
          const m = body.querySelector("#s-btmsg"); m.textContent = "";
          try {
            const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
            const L = NX.data("bt-devices", []).filter((d) => d.id !== dev.id); L.push({ id: dev.id, name: dev.name || "Unnamed device", at: new Date().toLocaleDateString() });
            NX.setData("bt-devices", L); NX.toast((dev.name || "The device") + " was added."); draw();
          } catch (e) { m.textContent = e && e.name === "NotFoundError" ? "No device was picked." : e && e.name === "SecurityError" ? "The browser blocked Bluetooth here. Open Nebulux OS from a web address (https) to use it." : "Couldn't reach Bluetooth: " + (e && e.message || "unknown error"); }
        };
        body.querySelectorAll("[data-btrm]").forEach((b) => (b.onclick = () => { const L = NX.data("bt-devices", []); L.splice(+b.dataset.btrm, 1); NX.setData("bt-devices", L); draw(); }));
        if (NX.native && page === "system") { fillWifi(); fillBt(); }
        if (NX.native && page === "about") fillInfo();
        const os = body.querySelector("[data-openstore]"); if (os) os.onclick = () => NX.open("store");
        const rn = body.querySelector("#s-rename"); if (rn) rn.onclick = () => { const m = body.querySelector("#s-namemsg"); try { NX.renameUser(NX.me.id, body.querySelector("#s-name").value); NX.me = NX.users().find((u) => u.id === NX.me.id); NX.shell.refresh(); draw(); NX.toast("Your name is saved."); } catch (e) { m.textContent = e.message; } };
        const pw = body.querySelector("#s-pw"); if (pw) pw.onclick = async () => {
          const m = body.querySelector("#s-pwmsg"), n = body.querySelector("#s-new").value;
          if (n !== body.querySelector("#s-new2").value) { m.textContent = "The two new passwords don't match."; return; }
          pw.disabled = true; m.textContent = "Saving...";
          try { await NX.changePassword(NX.me.id, body.querySelector("#s-old").value, n); m.textContent = ""; NX.toast("Your password is changed."); draw(); } catch (e) { m.textContent = e.message; pw.disabled = false; }
        };
        body.querySelectorAll("[data-rmuser]").forEach((b) => (b.onclick = () => { if (b.dataset.sure) { NX.removeUser(b.dataset.rmuser); draw(); NX.toast("Account removed."); } else { b.dataset.sure = 1; b.textContent = "Remove for good?"; b.classList.add("danger"); } }));
      }
      win.onopts = (o) => { if (o.page) { page = o.page; draw(); } };
      const onPref = () => { if (document.activeElement && document.activeElement.type === "range" && body.contains(document.activeElement)) return; };
      document.addEventListener("nx:prefs", onPref); win.onclose = () => document.removeEventListener("nx:prefs", onPref);
      draw();
    } };
})();
