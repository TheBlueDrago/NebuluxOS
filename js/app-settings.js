// Settings: a left column (your account card, search, pages) and the page on the right, built from cards.
// Every control changes the OS right away and is saved for this account.
"use strict";
(function () {
  const ACCENTS = ["#7c5cff", "#ff4fa3", "#22c3ee", "#34d399", "#f5a524", "#ef4444", "#3b82f6", "#a855f7"];
  const PAGES = [
    { id: "home", name: "Home", icon: "home" },
    { id: "system", name: "System", icon: "display", keys: "display brightness night light scale screen tv sound volume chime notification storage clean up back up backup usb battery power sleep clipboard focus screen time troubleshoot" },
    { id: "devices", name: "Bluetooth & devices", icon: "bt", keys: "bluetooth mouse pointer speed printer devices" },
    { id: "network", name: "Network & internet", icon: "wifi", keys: "wi-fi wifi internet hotspot airplane ethernet vpn" },
    { id: "personal", name: "Personalization", icon: "brush", keys: "background wallpaper themes theme dark light mode accent color colour corners glass transparency window buttons dots lock screen picture screen saver taskbar floating search widgets task view app names stage hot corners desktop widgets snap assist shake living stars daily start fit" },
    { id: "apps", name: "Apps", icon: "apps", keys: "apps startup default uninstall install" },
    { id: "accounts", name: "Accounts", icon: "user", keys: "account password picture sign-in users" },
    { id: "time", name: "Time & language", icon: "time", keys: "time date clock 24-hour seconds time zone language region keyboard" },
    { id: "access", name: "Accessibility", icon: "access", keys: "accessibility magnifier contrast pointer size color pointer colour animation large text filters grayscale scroll bars" },
    { id: "privacy", name: "Privacy & security", icon: "shield", keys: "privacy location recent files security" },
    { id: "update", name: "Nebulux Update", icon: "restart", keys: "update what's new version" },
    { id: "about", name: "About", icon: "info", under: "system" },
  ];
  NX.settingsPages = PAGES;
  // your account picture: a square from the middle of the picture, 192 pixels
  NX.setPicFile = (file) => new Promise((done, fail) => {
    if (!String(file.type || "").startsWith("image/")) { fail(new Error("Pick a picture (JPG, PNG, WebP or GIF).")); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas"); c.width = c.height = 192;
      c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 192, 192); URL.revokeObjectURL(url);
      NX.setUserPic(NX.me.id, c.toDataURL("image/jpeg", 0.85)); if (NX.shell && NX.shell.refresh) NX.shell.refresh(); NX.toast("Your picture is set."); done();
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("That picture couldn't be opened.")); };
    img.src = url;
  });
  NX.setWallpaperFile = (file) => new Promise((done, fail) => {
    if (!String(file.type || "").startsWith("image/")) { fail(new Error("Pick a picture (JPG, PNG, WebP or GIF).")); return; }
    if (file.size > 40 * 1048576) { fail(new Error("That picture is too big. Pick one under 40 MB.")); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1920 / img.naturalWidth, 1200 / img.naturalHeight), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let data = c.toDataURL("image/jpeg", 0.86); if (data.length > 1.6e6) data = c.toDataURL("image/jpeg", 0.7);
      try { NX.setData("wall-custom", data); NX.setPref("wallpaper", "custom"); NX.toast("Your picture is your background now."); done(); } catch (e) { fail(new Error("There isn't room to keep that picture. Try a smaller one.")); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("That picture couldn't be opened.")); };
    img.src = url;
  });
  NX.timeZones = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "America/Mexico_City", "America/Bogota", "America/Lima", "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Santiago", "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Athens", "Europe/Istanbul", "Europe/Moscow", "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Jakarta", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Manila", "Asia/Seoul", "Asia/Tokyo", "Australia/Perth", "Australia/Sydney", "Pacific/Auckland", "UTC"];
  NX.settingsWords = { system: "screen time usage how long display brightness night light schedule screen tv hdmi sound volume speakers storage space disk usb full clean up cleanup temporary files cache clipboard history power battery saver", devices: "bluetooth mouse pointer speed headphones keyboard", network: "wifi wi-fi internet airplane network troubleshoot fix driver hidden known forget password hotspot share qr code phone", personal: "stage focus windows cards auto-hide hide taskbar desktop widgets clock up next hot corners quick search magnify grow taskbar icons shake pointer background wallpaper every day daily dark light auto mode night color accent taskbar transparency theme", apps: "uninstall installed apps", accounts: "password name account user", time: "clock 24-hour time zone language", access: "accessibility contrast high contrast magnifier zoom bigger screen animations scrollbars color filters grayscale invert large mouse pointer cursor bigger", privacy: "privacy weather location recent files", update: "update version", about: "about pc kernel memory processor specifications" };
  // a row that goes to another page, with an arrow (like Windows 11)
  const link = (icon, title, sub, to) => `<button class="s-row s-link" data-p="${to}">${icon ? `<span class="s-ri" data-ri="${icon}">${NX.icon(icon, 18)}</span>` : ""}<span class="s-rt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="s-rc">${NX.icon("chevron", 14)}</span></button>`;
  const row = (icon, title, sub, ctrl) => `<div class="s-row">${icon ? `<span class="s-ri" data-ri="${icon}">${NX.icon(icon, 18)}</span>` : ""}<div class="s-rt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div><div class="s-rc">${ctrl || ""}</div></div>`;
  const toggle = (key, on) => `<label class="tg"><input type="checkbox" data-pref="${key}" ${on ? "checked" : ""}><i></i><span>${on ? "On" : "Off"}</span></label>`;
  const slider = (key, v, min, max) => `<input type="range" class="sl" data-pref="${key}" min="${min}" max="${max}" value="${v}">`;

  NX.apps.settings = { name: "Settings", icon: "settings", builtIn: true, w: 980, h: 640, minW: 420, minH: 360, desc: "Change how Nebulux OS looks and works.",
    open(body, win, opts) {
      let page = opts.page || "home", q = "", qRaw = ""; // qRaw keeps the spaces you type
      body.classList.add("settings");
      const draw = () => {
        const p = NX.prefs(), me = NX.me;
        const nav = PAGES.filter((x) => !x.under && (!q || x.name.toLowerCase().includes(q) || (x.keys || "").includes(q))).map((x) => `<button class="s-nav ${x.id === page || (PAGES.find((y) => y.id === page) || {}).under === x.id ? "on" : ""}" data-p="${x.id}"><span class="s-ri s-ni" data-ri="${x.icon}">${NX.icon(x.icon, 15)}</span><span>${x.name}</span></button>`).join("");
        body.innerHTML = `<aside class="s-side"><div class="s-me" data-p="accounts">${NX.avatar(me, "av")}<span><b>${NX.esc(me.name)}</b><small>Local account</small></span></div>
          <label class="s-search">${NX.icon("search", 16)}<input placeholder="Find a setting" value="${NX.esc(qRaw)}" aria-label="Find a setting"></label><nav>${nav || `<p class="s-none">No settings match.</p>`}</nav></aside>
          <section class="s-main"><h1>${(() => { const pg = PAGES.find((x) => x.id === page); return pg.under ? `<button class="s-crumb" data-p="${pg.under}">${PAGES.find((x) => x.id === pg.under).name}</button><span class="s-crumbsep">${NX.icon("chevron", 14)}</span>${pg.name}` : pg.name; })()}</h1>${pageHTML(page, p, me)}</section>`;
        wire();
      };
      function pageHTML(pg, p, me) {
        if (pg === "home") {
          const net = NX.online(), bt = p.bt && !p.airplane;
          return `<div class="s-homegrid">
            <button class="s-hcard s-hme" data-p="accounts">${NX.avatar(me, "av big")}<span><b>${NX.esc(me.name)}</b><small>Local account</small><em>Manage your account ${NX.icon("chevron", 11)}</em></span></button>
            <button class="s-hcard s-hpc" data-p="about"><img src="${NX.wallpaperURL(p.wallpaper)}" alt=""><span><b>Nebulux PC</b><small>Nebulux OS ${NX.version}</small><em>About this PC ${NX.icon("chevron", 11)}</em></span></button>
            <button class="s-hcard" data-p="network"><span class="s-hic">${NX.icon(net ? "wifi" : "wifioff", 24)}</span><span><b>${net ? "Connected" : "Not connected"}</b><small>Network & internet</small></span></button>
            <button class="s-hcard" data-p="devices"><span class="s-hic">${NX.icon("bt", 24)}</span><span><b>Bluetooth ${bt ? "on" : "off"}</b><small>Bluetooth & devices</small></span></button>
          </div>
          <h3>Recommended settings</h3>${link("sun", "Display", "Brightness, night light, screens and TV", "system")}${link("volume", "Sound", "Volume, and where sound plays", "system")}${link("brush", "Background", "Wallpapers, colors and dark or light", "personal")}${link("mouse", "Mouse", "Pointer speed", "devices")}${link("access", "Accessibility", "Animations and how things look", "access")}
          <h3>Personalize your device</h3><div class="s-themes s-hthemes">${(NX.looks40 || []).map((t, i) => `<button class="s-theme ${NX.lookOn40(t) ? "on" : ""}" data-look="${i}" aria-label="${t.name}"><span class="s-th-pic" style="background-image:url(${NX.wallpaperURL(t.wall, 192, 108)})"><i class="s-th-win ${t.theme}" style="--c:${t.accent}"><b></b><b></b></i></span><span class="s-th-n"><i style="background:${t.accent}"></i>${t.name}</span></button>`).join("")}</div><div class="s-walls s-hwalls">${NX.wallpapers.map((w, i) => `<button class="s-wall ${i === p.wallpaper ? "on" : ""}" data-wall="${i}" title="${w.name}" aria-label="${w.name}"><img src="${NX.wallpaperURL(i)}" alt=""></button>`).join("")}</div>
          ${row("contrast", "Choose your mode", "Dark or light windows and menus, or Auto: light from 7 AM, dark from 7 PM", `<div class="seg"><button data-theme="dark" class="${!p.themeAuto && p.theme === "dark" ? "on" : ""}">Dark</button><button data-theme="light" class="${!p.themeAuto && p.theme === "light" ? "on" : ""}">Light</button><button data-theme="auto" class="${p.themeAuto ? "on" : ""}" title="Light during the day, dark at night">Auto</button></div>`)}`;
        }
        if (pg === "access") return `<h3>Vision</h3>${row("contrast", "Transparency effects", "See-through, frosted windows and taskbar", toggle("transparency", NX.fx()))}${row("time", "Animation effects", "Windows, menus and pop-ups glide in and out", toggle("anim", p.anim !== false))}${row("eye", "Always show scrollbars", "Thicker scroll bars that are easier to grab", toggle("bigscroll", !!p.bigscroll))}${row("zoomin", "Magnifier", "Nebulux + Plus zooms in around the pointer, Nebulux + Minus zooms out, Nebulux + Esc stops", `<button class="btn" data-magon="1">Zoom in</button>`)}${row("contrast", "Increase contrast", "Stronger outlines and brighter text that are easier to read", toggle("contrast", !!p.contrast))}${row("mouse", "Large mouse pointer", "A bigger arrow and hand that are easier to see", toggle("bigcursor", !!p.bigcursor))}${row("mouse", "Pointer color", "White, black, or your accent color", `<div class="s-pcols">${[["white", "White", "#fff"], ["black", "Black", "#111"], ["accent", "Accent color", "var(--accent)"]].map(([v, t, c]) => `<button data-pcol="${v}" class="${(p.pointerColor || "white") === v ? "on" : ""}" title="${t}" aria-label="${t}"><svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path d="M6 3l0 36 9-9 6 14 6-3-6-13 13 0z" fill="${c}" stroke="${v === "black" ? "#fff" : "#000"}" stroke-width="2.5" stroke-linejoin="round"/></svg></button>`).join("")}</div>`)}${row("contrast", "Color filters", "See the screen in grayscale, or with inverted colors", `<div class="seg">${[["none", "Off"], ["gray", "Grayscale"], ["invert", "Inverted"]].map(([v, t]) => `<button data-cf="${v}" class="${(p.colorFilter || "none") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}
          <h3>Interaction</h3>${link("mouse", "Mouse", "Pointer speed", "devices")}${row("bell", "Do not disturb", "Notifications wait quietly in the notification center", toggle("dnd", !!p.dnd))}`;
        if (pg === "privacy") { const rf = NX.data("recent-files", []).length;
          return `<div class="s-card"><p class="s-note">Nebulux OS keeps your accounts, passwords, files and settings on this computer (and its USB). It doesn't send anything about you to Nebulux.</p></div>
          <h3>App permissions</h3>${row("globe", "Weather where you are", "Widgets sends only the city you type to the weather service (Open-Meteo)", toggle("location", p.location !== false))}
          <h3>Activity</h3>${row("files", "Show recently opened files", "In Start, Widgets and File Explorer", toggle("showrecent", p.showrecent !== false))}${row("trash", "Clear recently opened files", rf ? rf + " files are listed" : "Nothing is listed", `<button class="btn" id="s-clearrecent" ${rf ? "" : "disabled"}>Clear</button>`)}${row("bell", "Tips", "Tips and shortcuts in Widgets", toggle("tips", p.tips !== false))}`; }
        if (pg === "update") return `<div class="s-upd s-upd40"><i class="upd-orb a"></i><i class="upd-orb b"></i><div class="upd-logo"><span class="upd-ring"></span>${NX.icon("logo", 52)}</div><div><b>You're on Nebulux OS ${NX.version}</b><small id="s-updnow">${NX.native ? "Checking for updates..." : "Updates come with the Nebulux OS USB."}</small></div><span class="s-updc" id="s-updc"></span></div>
          <div id="s-updbox"></div>
          <h3>What's new in ${NX.version}</h3><div class="s-wn">${NX.whatsNew.map((w, k) => `<div class="wn-item" style="--c:${["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#f59e0b", "#60a5fa", "#a78bfa", "#fb7185"][k % 8]}"><i class="wn-ic">${NX.icon(["spark", "brush", "apps", "search", "time", "folder", "sun", "bell"][k % 8], 16)}</i><div><b>${NX.esc(w[0])}</b><span>${NX.esc(w[1])}</span></div></div>`).join("")}</div>${(NX.whatsNewBefore || []).length ? `<h3>Earlier updates</h3><div class="s-card">${NX.whatsNewBefore.map((w) => `<p class="s-note"><b>${NX.esc(w[0])}</b><br>${NX.esc(w[1])}</p>`).join("")}</div>` : ""}
          <h3>Starting fresh</h3><div class="s-card"><p class="s-note">Nebulux OS updates itself. You only need a new .iso from Releases (written with Rufus) for a brand-new USB, or when an update says it needs one.</p></div>`;
        if (pg === "system") return `<div class="s-hero"><img src="${NX.wallpaperURL(p.wallpaper, 320, 180)}" alt=""><div><b>Nebulux PC</b><small>Nebulux OS ${NX.version}</small></div></div>
          <h3>Display</h3>${row("sun", "Brightness", "Make the screen brighter or dimmer", slider("brightness", p.brightness, 30, 100))}${NX.native ? row("display", "Scale", "Make text, apps and everything bigger or smaller", `<div class="seg s-scale">${[["1", "100%"], ["1.25", "125%"], ["1.5", "150%"], ["1.75", "175%"], ["2", "200%"]].map(([v, t]) => `<button data-scale="${v}" class="${String(NX.scale || "1") === v ? "on" : ""}">${t}</button>`).join("")}</div>`) : ""}${row("moon", "Night light", "Warmer colors to help you sleep", toggle("night", p.night))}${row("moon", "Night light strength", "How warm the colors get", slider("nightStr", p.nightStr || 50, 10, 100))}${row("time", "Schedule night light", p.nightSched ? "On from " + NX.esc(p.nightFrom || "21:00") + " to " + NX.esc(p.nightTo || "07:00") : "Turns night light on and off by itself", toggle("nightSched", !!p.nightSched))}${p.nightSched ? `<div class="s-row s-nsched"><span class="s-ri"></span><div class="s-rt"><b>Hours</b><small>Night light comes on and goes off at these times every day</small></div><div class="s-rc"><label>Turn on <input type="time" data-time="nightFrom" value="${NX.esc(p.nightFrom || "21:00")}"></label><label>Turn off <input type="time" data-time="nightTo" value="${NX.esc(p.nightTo || "07:00")}"></label></div></div>` : ""}
          ${screensHTML()}
          <h3>Sound</h3>${row("sound", "Volume", NX.native ? "How loud this computer is" : "How loud the OS sounds are", slider("volume", p.volume, 0, 100))}${row("sound", "Sign-in sound", "A soft chime when you sign in", toggle("signinSound", p.signinSound !== false))}${row("bell", "Notification sound", "A gentle sound when a notification pops up", toggle("noteSound", !!p.noteSound))}${NX.native ? `<div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("volume", 20)}<b>Play sound on</b></span></div><div id="s-alist"><p class="s-note">Checking...</p></div></div>` : ""}
          ${NX.batt && NX.batt() ? `<h3>Power & battery</h3><div class="s-card s-battc">${NX.battIcon(44)}<div><b>${NX.batt().percent}%</b><small>${NX.batt().charging ? "Charging" : NX.saverOn() ? "Battery saver is on" : "On battery"}${NX.battLeft() ? " · " + NX.battLeft() : ""}</small></div></div>${row("leaf", "Battery saver", "Turns off see-through effects and animations so the battery lasts longer. The battery icon turns yellow.", toggle("saver", NX.saverOn()))}${row("battery", "Turn on Battery saver by itself", "At 20% battery", toggle("saverAuto", p.saverAuto !== false))}` : ""}
          ${NX.native ? `<h3>Power</h3>${row("power", "When I press the power button", "Closing the lid always puts the computer to sleep", `<div class="seg s-pkey">${[["sleep", "Sleep"], ["off", "Shut down"], ["nothing", "Nothing"]].map(([v, t]) => `<button data-pkey="${v}" class="${(p.powerKey || "sleep") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}` : ""}
          <h3>Screen time</h3><div class="s-card s-st" id="s-st"></div>
          ${NX.native ? `<h3>Storage</h3><div class="s-card s-hw" id="s-store"><p class="s-note">Checking...</p></div><h3>Back up</h3><div class="s-card s-hw" id="s-backup"><p class="s-note">Looking for USB drives...</p></div>` : ""}
          <h3>Clipboard</h3>${row("files", "Clipboard history", "Keep the last 25 things you copy. Nebulux + V shows them.", toggle("cliphist", p.cliphist !== false))}${row("trash", "Clear clipboard history", (NX.data("clip-history", []).length || "Nothing") + (NX.data("clip-history", []).length === 1 ? " item" : NX.data("clip-history", []).length ? " items" : ""), `<button class="btn" id="s-clipclear" ${NX.data("clip-history", []).some((x) => !x.pin) ? "" : "disabled"}>Clear</button>`)}
          <h3>More</h3>${link("info", "About", "Device specifications, kernel and version", "about")}`;
        if (pg === "network") return `<h3>Wi-Fi</h3>${NX.native ? nativeWifi(p) : `${row("wifi", "Wi-Fi", p.airplane ? "Airplane mode is on" : !p.wifi ? "Off: web searches and web apps won't open" : NX.online() ? "Connected to the internet (through this computer's connection)" : "Not connected: this computer is offline", toggle("wifi", p.wifi && !p.airplane))}`}
          <h3>More</h3>${row("plane", "Airplane mode", "Turns off Wi-Fi and Bluetooth", toggle("airplane", p.airplane))}
          ${NX.native ? `<h3>Mobile hotspot</h3><div class="s-card s-hw" id="s-hot"><p class="s-note">Checking...</p></div>` : ""}
          ${NX.native ? `<h3>Known networks</h3><div class="s-card s-hw" id="s-known"><p class="s-note">Checking...</p></div>
          <div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("wifi", 20)}<b>Join a hidden network</b></span><span class="s-hwc"><button class="btn" id="s-hidgo">Join</button></span></div><form class="s-hidf" id="s-hidf" hidden><input name="ssid" maxlength="32" placeholder="Network name" aria-label="Network name" autocomplete="off"><input name="pw" type="password" maxlength="63" placeholder="Password (leave empty if it has none)" aria-label="Password" autocomplete="off"><button class="btn primary" type="submit">Connect</button><p class="s-msg" id="s-hidmsg"></p></form></div>` : ""}
          ${NX.native ? `<h3>Troubleshoot</h3><div class="s-card s-hw" id="s-trouble"><div class="s-bth"><span class="s-hwt">${NX.icon("wifi", 20)}<b>Network troubleshooter</b></span><span class="s-hwc"><button class="btn primary" id="s-diag">Run</button></span></div><p class="s-note">Checks the Wi-Fi chip, its driver, the Wi-Fi switch, the connection and the internet, and says what's wrong.</p><div id="s-diagout"></div></div>` : ""}`;
        if (pg === "devices") return devicesMouse(p) + `<h3>Bluetooth</h3>${NX.native ? nativeBt(p) : `${row("bt", "Bluetooth", p.airplane ? "Airplane mode is on" : p.bt ? (navigator.bluetooth ? "On. Add a device to connect it." : "This browser can't reach Bluetooth devices. Try Edge or Chrome on a computer.") : "Off", toggle("bt", p.bt && !p.airplane))}
          ${p.bt && !p.airplane ? `<div class="s-card"><div class="s-bth"><b>Bluetooth devices</b><button class="btn primary" id="s-btadd" ${navigator.bluetooth ? "" : "disabled"}>Add device</button></div>${(NX.data("bt-devices", []).length ? NX.data("bt-devices", []).map((d, i) => `<div class="s-user">${NX.icon("bt", 20)}<b>${NX.esc(d.name)}</b><span class="s-tag">${d.at}</span><button class="btn" data-btrm="${i}">Remove</button></div>`).join("") : `<p class="s-note">No devices yet. Add device opens your browser's Bluetooth list, where you pick a device near you.</p>`)}<p class="s-msg" id="s-btmsg"></p></div>` : ""}`}`;
        if (pg === "personal") return `<div class="s-preview" style="background-image:url(${NX.wallpaperURL(p.wallpaper, 560, 315)})"><div class="s-pv-task"><i></i><i></i><i></i><i></i><i></i></div><div class="s-pv-win ${p.theme}"><div class="pv-bar"><span></span><span></span><span></span></div><div class="pv-body"><div class="pv-side"><i></i><i></i><i></i><i></i></div><div class="pv-main"><b></b><i></i><i></i><em></em></div></div></div></div>
          <h3>Themes</h3><div class="s-themes">${NX.looks40.map((t, i) => `<button class="s-theme ${NX.lookOn40(t) ? "on" : ""}" data-look="${i}" aria-label="${t.name}"><span class="s-th-pic" style="background-image:url(${NX.wallpaperURL(t.wall, 192, 108)})"><i class="s-th-win ${t.theme}" style="--c:${t.accent}"><b></b><b></b></i></span><span class="s-th-n"><i style="background:${t.accent}"></i>${t.name}</span></button>`).join("")}</div>
          <h3>Background</h3><div class="s-walls">${NX.wallpapers.map((w, i) => `<button class="s-wall ${i === p.wallpaper ? "on" : ""}" data-wall="${i}" title="${w.name}" aria-label="${w.name}"><img src="${NX.wallpaperURL(i, 192, 108)}" alt=""><span>${w.name}</span></button>`).join("")}${NX.data("wall-custom", null) ? `<button class="s-wall ${p.wallpaper === "custom" ? "on" : ""}" data-wallc="1" title="Your picture" aria-label="Your picture"><img src="${NX.data("wall-custom", null)}" alt=""><span>Your picture</span></button>` : ""}</div>
          <div class="s-card s-browse"><div class="s-rt"><b>Your own picture</b><small>Any picture from your computer as your background</small></div><label class="btn"><input type="file" accept="image/*" id="s-wallfile" hidden>Browse photos</label></div>
          ${p.wallpaper === "custom" ? row("brush", "Choose a fit", "How your picture fills the screen", `<div class="seg">${[["fill", "Fill"], ["fit", "Fit"], ["stretch", "Stretch"], ["center", "Center"]].map(([v, t]) => `<button data-wfit="${v}" class="${(p.wallFit || "fill") === v ? "on" : ""}">${t}</button>`).join("")}</div>`) : ""}
          ${row("spark", "Living background", "A few stars slowly twinkle and drift over your background", toggle("living", p.living !== false))}${row("sun", "Background follows the day", "Morning, midday, sunset and night backgrounds that change by themselves", toggle("dynWall", !!p.dynWall))}
          ${row("calendar", "Lock screen details", "Show your next event and reminders that are due when the computer is locked", toggle("lockNext", p.lockNext !== false))}
          ${row("lock", "Lock screen picture", "What shows on the lock screen and sign-in screen of this computer", `<select class="s-sel" data-lockpic aria-label="Lock screen picture"><option value="match">Same as my background</option>${NX.wallpapers.map((w, i) => `<option value="${i}" ${String(p.lockPic) === String(i) ? "selected" : ""}>${w.name}</option>`).join("")}</select>`)}
          ${row("moon", "Screen saver", "Shows after the computer sits still for a while. Any key or mouse move ends it.", `<div class="s-svc"><select class="s-sel" data-saver aria-label="Screen saver">${Object.entries(NX.saverKinds || { off: "None" }).map(([k, n]) => `<option value="${k}" ${(p.scrSaver || "off") === k ? "selected" : ""}>${n}</option>`).join("")}</select><select class="s-sel" data-saverwait aria-label="Wait" ${!p.scrSaver || p.scrSaver === "off" ? "disabled" : ""}>${[1, 3, 5, 10, 15, 30].map((m) => `<option value="${m}" ${(p.saverWait || 5) === m ? "selected" : ""}>${m} min</option>`).join("")}</select><button class="btn" data-saverpv ${!p.scrSaver || p.scrSaver === "off" ? "disabled" : ""}>Preview</button></div>`)}${p.scrSaver && p.scrSaver !== "off" ? row("lock", "Lock when the screen saver ends", "Asks for your password to come back", toggle("saverLock", !!p.saverLock)) : ""}
          ${row("time", "A new background every day", "Picks one of the Nebulux backgrounds each morning, to match dark or light mode", toggle("dailyWall", !!p.dailyWall))}
          <h3>Desktop extras</h3>${row("search", "Quick Search", "Nebulux + Space: apps, settings, files and sums in one box", `<button class="btn" data-qsopen="1">Try it</button>`)}${row("max", "Stage", "Only the window you're using stays out. Your other windows wait as cards on the left, one click away", toggle("stage", !!p.stage))}${row("taskbar", "Floating taskbar", "A rounded taskbar that floats just above the bottom of the screen", toggle("tbFloat", p.tbFloat !== false))}${row("taskbar", "Hide the taskbar by itself", "It slides away and comes back when the pointer touches the bottom of the screen", toggle("tbAuto", !!p.tbAuto))}${row("battery", "Battery percentage", "Show how much battery is left next to its icon on the taskbar", toggle("battPct", !!p.battPct))}${row("apps", "Grow taskbar icons", "Icons get bigger under the pointer", toggle("magnify", !!p.magnify))}${row("mouse", "Shake to find the pointer", "Shake the mouse and the pointer grows for a moment", toggle("shakeFind", p.shakeFind !== false))}${row("max", "Snap Assist", "After you snap a window to one half, pick which window fills the other half", toggle("snapAssist", p.snapAssist !== false))}${row("max", "Shake a window", "Grab a window by its title bar and shake it to minimize the others. Shake again to bring them back.", toggle("shakeMin", p.shakeMin !== false))}
          <div class="s-card s-corners"><div class="s-rt"><b>Desktop widgets</b><small>Show these right on your wallpaper</small></div><div class="s-dwk">${Object.entries(NX.deskWidgetKinds || {}).map(([k, n]) => `<label><input type="checkbox" data-dwk="${k}" ${(p.deskWidgets || []).includes(k) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
          <div class="s-card s-corners"><div class="s-rt"><b>Hot corners</b><small>Push the pointer into a corner of the screen to do something</small></div><div class="s-cgrid">${[["tl", "Top left"], ["tr", "Top right"], ["bl", "Bottom left"], ["br", "Bottom right"]].map(([k, n]) => `<label><span>${n}</span><select data-corner="${k}">${Object.entries(NX.cornerActions || {}).map(([a, [t]]) => `<option value="${a}" ${((p.corners || {})[k] || "none") === a ? "selected" : ""}>${t}</option>`).join("")}</select></label>`).join("")}</div></div>
          <h3>Colors</h3>${row("contrast", "Choose your mode", "Dark or light windows and menus, or Auto: light from 7 AM, dark from 7 PM", `<div class="seg"><button data-theme="dark" class="${!p.themeAuto && p.theme === "dark" ? "on" : ""}">Dark</button><button data-theme="light" class="${!p.themeAuto && p.theme === "light" ? "on" : ""}">Light</button><button data-theme="auto" class="${p.themeAuto ? "on" : ""}" title="Light during the day, dark at night">Auto</button></div>`)}
          ${row("brush", "Accent color", "Used for buttons, switches and highlights", `<div class="s-acc"><button data-acc="auto" class="s-acc-auto ${p.accent === "auto" ? "on" : ""}" title="From your background" aria-label="Accent color from your background"></button>${ACCENTS.map((c) => `<button data-acc="${c}" class="${c === p.accent ? "on" : ""}" style="background:${c}" aria-label="Accent ${c}"></button>`).join("")}</div>`)}
          ${row("contrast", "Transparency effects", NX.native ? "See-through, frosted windows and taskbar. Off makes Nebulux OS faster on this computer." : "See-through, frosted windows and taskbar", toggle("transparency", NX.fx()))}
          ${row("max", "Corners", "How round windows, menus and buttons are", `<div class="seg">${[["square", "Square"], ["round", "Round"], ["xround", "Extra round"]].map(([v, t]) => `<button data-corners="${v}" class="${(p.corners40 || "round") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}
          ${row("max", "Window buttons", "Plain buttons, or three colored dots", `<div class="seg">${[["plain", "Plain"], ["dots", "Dots"]].map(([v, t]) => `<button data-wbtn="${v}" class="${(p.wbtn || "plain") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}
          ${row("spark", "Glass", "How much of the background shows through", `<div class="seg">${[["clear", "Clear"], ["frosted", "Frosted"], ["solid", "Solid"]].map(([v, t]) => `<button data-glass="${v}" class="${(p.glass || "frosted") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}
          <h3>Taskbar</h3>${row("search", "Search on the taskbar", "A search box, just the icon, or nothing", `<div class="seg">${[["box", "Search box"], ["icon", "Icon only"], ["hide", "Hide"]].map(([v, t]) => `<button data-tbsearch="${v}" class="${(p.tbSearch || "box") === v ? "on" : ""}">${t}</button>`).join("")}</div>`)}${row("max", "Task view button", "The button that shows all your windows and desktops", toggle("tbTaskView", p.tbTaskView !== false))}${row("apps", "Widgets button", "The weather and Widgets on the left of the taskbar", toggle("tbWidgets", p.tbWidgets !== false))}${row("taskbar", "Show app names on the taskbar", "Each open app shows its name next to its icon", toggle("tbLabels", !!p.tbLabels))}${row("taskbar", "Taskbar alignment", "Where the Start button and apps sit", `<div class="seg"><button data-align="center" class="${p.align === "center" ? "on" : ""}">Center</button><button data-align="left" class="${p.align === "left" ? "on" : ""}">Left</button></div>`)}`;
        if (pg === "apps") {
          const all = Object.entries(NX.apps).filter(([id, a]) => a.builtIn || p.installed.includes(id));
          const startable = all.filter(([id, a]) => !a.url && !a.browser && !a.webapp && id !== "settings").slice(0, 30), su = p.startup || [];
          return `<h3>Startup apps</h3><p class="s-note">These open by themselves when you sign in.</p><div class="s-card s-startup">${startable.map(([id, a]) => `<label class="s-su"><input type="checkbox" data-su="${id}" ${su.includes(id) ? "checked" : ""}>${NX.icon(a.icon || id, 22)}<span>${NX.esc(a.name)}</span></label>`).join("")}</div>
          <h3>Installed apps</h3><input class="s-appq" type="search" placeholder="Search your apps" aria-label="Search your apps"><p class="s-note">${all.length} apps. Get more in the Nebulux Store.</p>${all.map(([id, a]) => row(null, `<span class="s-appname">${NX.icon(a.icon || id, 28)}${NX.esc(a.name)}</span>`, a.builtIn ? "Part of Nebulux OS" : (a.size || "1 MB") + " · " + (a.url ? "Opens on the web" : "Runs on this PC"),
            a.builtIn ? `<span class="s-tag">System app</span>` : `<button class="btn" data-uninstall="${id}">Uninstall</button>`).replace("<div class=\"s-row","<div data-appn=\"" + NX.esc(a.name.toLowerCase()) + "\" class=\"s-row")).join("")}
            <div class="s-row s-link" data-openstore="1"><span class="s-ri">${NX.icon("store", 20)}</span><div class="s-rt"><b>Nebulux Store</b><small>Find new apps and games</small></div><div class="s-rc">${NX.icon("chevron", 16)}</div></div>`;
        }
        if (pg === "accounts") {
          const others = NX.users().filter((u) => u.id !== me.id);
          return `<div class="s-acct">${NX.avatar(me, "av big")}<div><b>${NX.esc(me.name)}</b><small>Local account on this PC</small></div><span class="s-picbtns"><label class="btn"><input type="file" accept="image/*" id="s-picfile" hidden>${me.pic ? "Change picture" : "Add a picture"}</label>${me.pic ? `<button class="btn" id="s-picrm">Remove</button>` : ""}</span></div>
            ${NX.native ? `<h3>Google</h3>${row("google", p.googleSignedIn ? "Signed in to Google" : "Google account", p.googleSignedIn ? "Gmail, YouTube and Drive use your Google account in the web browser" : "Sign in to use Gmail, YouTube, Drive and more", `<button class="btn" id="s-goog">${p.googleSignedIn ? "Open Gmail" : "Sign in"}</button>`)}` : ""}
            <h3>Your info</h3><div class="s-card"><label class="fld"><span>Your name</span><input id="s-name" maxlength="24" value="${NX.esc(me.name)}"></label><button class="btn primary" id="s-rename">Save name</button><p class="s-msg" id="s-namemsg"></p></div>
            <h3>Sign-in options</h3><div class="s-card"><label class="fld"><span>Current password</span><input id="s-old" type="password" maxlength="64" autocomplete="current-password"></label><label class="fld"><span>New password</span><input id="s-new" type="password" maxlength="64" autocomplete="new-password"></label><label class="fld"><span>New password again</span><input id="s-new2" type="password" maxlength="64" autocomplete="new-password"></label><button class="btn primary" id="s-pw">Change password</button><p class="s-msg" id="s-pwmsg"></p></div>
            <h3>Other users</h3><div class="s-card">${others.length ? others.map((u) => `<div class="s-user">${NX.avatar(u, "av")}<b>${NX.esc(u.name)}</b><button class="btn" data-rmuser="${u.id}">Remove</button></div>`).join("") : `<p class="s-note">No other accounts on this PC.</p>`}
            <p class="s-note">To add someone, sign out and choose Add account on the sign-in screen.</p></div>`;
        }
        if (pg === "time") { const d = new Date(); return `<div class="s-big-time">${NX.fmtTime(d)}<small>${d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</small></div>
          ${row("time", "24-hour clock", "Show 13:00 instead of 1:00 PM", toggle("clock24", p.clock24))}${row("time", "Show seconds", "Show seconds in the taskbar clock", toggle("clockSec", !!p.clockSec))}${NX.native ? row("globe", "Set time zone automatically", "Looks it up once from your internet address when you sign in", toggle("tzAuto", p.tzAuto !== false)) + row("globe", "Time zone", "Now " + NX.esc(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), `<select class="s-sel" id="s-tz" aria-label="Time zone" ${p.tzAuto !== false ? "disabled" : ""}>${NX.timeZones.map((z) => `<option value="${z}" ${(Intl.DateTimeFormat().resolvedOptions().timeZone || "") === z ? "selected" : ""}>${z.replace(/_/g, " ")}</option>`).join("")}</select>`) : row("globe", "Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Set by your browser", "")}${row("globe", "Language", navigator.language || "English", "")}${NX.keyboards ? row("keyboard", "Keyboard layout", "Match the letters on your keys", `<select class="s-sel" id="s-kb" aria-label="Keyboard layout">${NX.keyboards.map(([v, t]) => `<option value="${v}" ${(p.keyboard || "us") === v ? "selected" : ""}>${NX.esc(t)}</option>`).join("")}</select>`) : ""}`; }
        if (pg === "about") return `<div class="s-about">${NX.icon("logo", 64)}<div><b>Nebulux OS</b><small>Version ${NX.version} · made by Nebulux</small></div></div>
          <h3>Device specifications</h3><div class="s-card s-spec"><div><span>Device name</span><b>Nebulux PC</b></div><div><span>Processor threads</span><b>${navigator.hardwareConcurrency || "Unknown"}</b></div><div><span>Memory</span><b>${navigator.deviceMemory ? navigator.deviceMemory + " GB or more" : "Unknown"}</b></div><div><span>Screen</span><b>${screen.width} x ${screen.height}</b></div><div><span>Runs in</span><b>${NX.native ? "This computer, from the Nebulux OS USB" : "Your web browser"}</b></div><div id="s-kernel" hidden></div></div>
          <h3>Safe by design</h3><div class="s-card"><p class="s-note">${NX.native ? "Nebulux OS runs from its USB. It never changes this computer's own drive or the system already on it: take the USB out and restart, and the computer starts the way it always did." : "Nebulux OS runs inside a browser tab. It can't change or harm your computer, and closing the tab closes it. Your accounts and settings are saved in this browser only."}</p></div>`;
        return "";
      }
      const devicesMouse = (p) => `<h3>Mouse</h3>${row("mouse", "Mouse pointer speed", NX.native ? "How fast the pointer moves when you move the mouse or touchpad" : "On the real Nebulux OS this sets how fast the pointer moves", `<span class="s-slab">Slower</span>${slider("mouse", p.mouse, 0, 10)}<span class="s-slab">Faster</span>`)}
        <h3>Touchpad</h3>${row("mouse", "Tap to click", "Tap the touchpad once to click, with two fingers to right-click", toggle("tpTap", p.tpTap !== false))}${row("mouse", "Natural scrolling", "Two fingers down moves the page up, like a phone", toggle("tpNatural", p.tpNatural !== false))}`;
      // ---------- screens: a TV or monitor on HDMI, and wireless displays ----------
      function screensHTML() {
        if (!NX.native) return `<h3>Screens and TV</h3><div class="s-card"><p class="s-note">On the real Nebulux OS (started from the USB), plug a TV or monitor into the computer's HDMI port to show Nebulux OS on it, or cast to a wireless TV.</p></div>`;
        return `<h3>Screens and TV</h3><div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("tv", 20)}<b>Screens</b></span><span class="s-hwc"><button class="btn" id="s-detect">Detect</button></span></div><div id="s-dlist"><p class="s-note">Checking screens...</p></div></div>
          <div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("cast", 20)}<b>Wireless display</b></span><span class="s-hwc" id="s-castc"></span></div><p class="s-note" id="s-castn">Checking...</p></div>`;
      }
      async function fillScreens(probe) {
        if (!q$("#s-dlist")) return; let d;
        try { d = await NX.api("POST", "/display/get", { probe: !!probe }); } catch (e) { const b0 = q$("#s-dlist"); if (b0) b0.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        const b = q$("#s-dlist"); if (!b) return;
        const outs = d.outputs || [];
        b.innerHTML = outs.map((o) => `<div class="s-net"><span class="s-sig">${NX.icon(o.builtIn ? "display" : "tv", 20)}</span><span class="s-nn"><b>${NX.esc(o.label)}</b><small>${o.active ? (o.w ? o.w + " x " + o.h : "On") : "Off"}</small></span></div>`).join("") +
          (d.ext ? `<h4 class="s-sub">How to use the TV or monitor</h4><div class="seg s-dmode">${[["mirror", "Duplicate"], ["external", "Second screen only"], ["internal", "This screen only"]].map(([k, l]) => `<button data-dm="${k}" class="${d.mode === k ? "on" : ""}">${l}</button>`).join("")}</div><p class="s-msg" id="s-dmsg"></p>`
            : `<p class="s-note">To show Nebulux OS on a TV, plug it into this computer's HDMI port (with an HDMI cable), turn the TV to that HDMI input, then press Detect.</p>`);
        b.querySelectorAll("[data-dm]").forEach((x) => (x.onclick = async () => {
          b.querySelectorAll("[data-dm]").forEach((y) => (y.disabled = true)); const m = q$("#s-dmsg"); if (m) m.textContent = "Changing the screens...";
          try { await NX.api("POST", "/display/set", { mode: x.dataset.dm }); NX.setData("tv-mode", x.dataset.dm); NX.toast(x.dataset.dm === "mirror" ? "The TV shows the same picture." : x.dataset.dm === "external" ? "Nebulux OS shows on the TV only." : "Nebulux OS shows on this screen only."); }
          catch (e) { NX.toast(e.message); }
          fillScreens(); fillAudio();
        }));
      }
      // a QR code phones scan to join a Wi-Fi network (the standard WIFI: format; qrcode-generator, MIT, in js/vendor)
      const hotQR = (name, pw) => {
        if (typeof qrcode !== "function") return "";
        const e = (s) => String(s).replace(/([\\;,:"])/g, "\\$1"), q = qrcode(0, "M"); q.addData("WIFI:T:WPA;S:" + e(name) + ";P:" + e(pw) + ";;"); q.make();
        return '<span class="s-qr" role="img" aria-label="QR code to join ' + NX.esc(name) + '">' + q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }) + "</span>";
      };
      // Mobile hotspot: share this computer's internet over Wi-Fi (its name and password are kept for next time)
      async function fillHot() {
        const box = q$("#s-hot"); if (!box) return; let h;
        try { h = await NX.api("GET", "/hotspot"); } catch (e) { box.innerHTML = "<p class=\"s-note\">" + NX.esc(e.message) + "</p>"; return; }
        if (!q$("#s-hot")) return;
        let saved = NX.data("hotspot", null); if (!saved) { const abc = "abcdefghjkmnpqrstuvwxyz23456789", pick = (n) => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join(""); saved = { name: "Nebulux-" + pick(4).toUpperCase(), pw: pick(10) }; NX.setData("hotspot", saved); }
        box.innerHTML = h.on
          ? "<div class=\"s-bth\"><span class=\"s-hwt\"><b>Sharing as " + NX.esc(h.name) + "</b></span><span class=\"s-hwc\"><button class=\"btn\" id=\"s-hotoff\">Turn off</button></span></div><div class=\"s-hotqr\">" + hotQR(h.name, saved.pw) + "<p class=\"s-note\">Point your phone's camera at this code to join, no typing needed. Or pick <b>" + NX.esc(h.name) + "</b> and type the password <b>" + NX.esc(saved.pw) + "</b>.</p></div>"
          : "<p class=\"s-note\">Share this computer's internet with your phone or another computer over Wi-Fi. Works best when this computer is on a network cable: most Wi-Fi chips can't use Wi-Fi and share it at the same time.</p><form class=\"s-hidf\" id=\"s-hotf\"><input name=\"n\" maxlength=\"32\" aria-label=\"Hotspot name\" value=\"" + NX.esc(saved.name) + "\"><input name=\"p\" maxlength=\"63\" aria-label=\"Hotspot password\" value=\"" + NX.esc(saved.pw) + "\"><button class=\"btn primary\" type=\"submit\">Turn on</button><p class=\"s-msg\" id=\"s-hotmsg\"></p></form>";
        const off = q$("#s-hotoff"); if (off) off.onclick = async () => { off.disabled = true; try { await NX.api("POST", "/hotspot", { on: false }); NX.toast("Mobile hotspot is off."); } catch (e) { NX.toast(e.message); } fillHot(); fillWifi(); };
        const f = q$("#s-hotf"); if (f) f.onsubmit = async (e) => { e.preventDefault(); const name = f.n.value.trim(), pw = f.p.value, m = q$("#s-hotmsg"), b = f.querySelector("[type=submit]");
          b.disabled = true; m.textContent = "Turning on...";
          try { await NX.api("POST", "/hotspot", { on: true, name, password: pw }); NX.setData("hotspot", { name, pw }); NX.toast("Mobile hotspot is on: " + name + "."); fillHot(); }
          catch (er) { m.textContent = er.message; b.disabled = false; } };
      }
      // networks this computer remembers (Forget one that keeps failing)
      async function fillKnown() {
        const box = q$("#s-known"); if (!box) return; let k;
        try { k = (await NX.api("GET", "/wifi/known")).known; } catch (e) { box.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        if (!q$("#s-known")) return;
        box.innerHTML = k.length ? k.map((n, i) => `<div class="s-net"><span class="s-sig">${NX.icon("wifi", 20)}</span><span class="s-nn"><b>${NX.esc(n)}</b><small>Saved</small></span><button class="btn" data-forget="${i}">Forget</button></div>`).join("") : `<p class="s-note">No saved networks yet. Networks you connect to are remembered here.</p>`;
        box.querySelectorAll("[data-forget]").forEach((b) => (b.onclick = async () => { const n = k[+b.dataset.forget]; b.disabled = true; try { await NX.api("POST", "/wifi/forget", { name: n }); NX.toast("Forgot " + n + ". Connect again to type its password."); } catch (e) { NX.toast(e.message); } fillKnown(); fillWifi(); }));
      }
      function wireHidden() {
        const go = q$("#s-hidgo"), f = q$("#s-hidf"); if (!go || !f) return;
        go.onclick = () => { f.hidden = !f.hidden; if (!f.hidden) f.querySelector("[name=ssid]").focus(); };
        f.onsubmit = async (e) => {
          e.preventDefault(); const msg = q$("#s-hidmsg"), ssid = f.ssid.value.trim(), password = f.pw.value, sub = f.querySelector("[type=submit]");
          if (!ssid) { msg.textContent = "Type the network's name."; return; }
          sub.disabled = true; msg.textContent = "Connecting...";
          try { await NX.api("POST", "/wifi/hidden", { ssid, password }); msg.textContent = ""; f.reset(); f.hidden = true; NX.toast("Connected to " + ssid + "."); fillWifi(); fillKnown(); }
          catch (er) { msg.textContent = er.message; }
          sub.disabled = false;
        };
      }
      // the network troubleshooter: run, try to fix, save a report to Documents
      function wireTrouble() {
        const go = q$("#s-diag"); if (!go) return;
        const draw = (d) => {
          const o = q$("#s-diagout"); if (!o) return;
          o.innerHTML = `<div class="s-diag ${d.ok ? "ok" : "bad"}"><b>${d.ok ? "Everything works" : NX.esc(d.summary)}</b></div>` +
            d.checks.map((c) => `<div class="s-dc ${c.ok ? "ok" : "bad"}"><span class="s-dci">${NX.icon(c.ok ? "check" : "close", 14)}</span><span><b>${NX.esc(c.title)}</b>${c.detail ? `<small>${NX.esc(c.detail)}</small>` : ""}</span></div>`).join("") +
            `<div class="s-dacts">${d.ok ? "" : `<button class="btn primary" id="s-dfix">Try to fix</button>`}<button class="btn" id="s-drep">Save a report to Documents</button></div>`;
          const fx = q$("#s-dfix"); if (fx) fx.onclick = () => run(true);
          q$("#s-drep").onclick = async () => { try { const r = await NX.api("POST", "/net/report"); NX.toast("Saved the report to " + r.path.split("/").filter(Boolean).join(" > ") + "."); } catch (e) { NX.toast(e.message); } };
        };
        const run = async (fix) => {
          const o = q$("#s-diagout"); if (o) o.innerHTML = `<p class="s-note">${fix ? "Trying to fix it..." : "Checking..."}</p>`; go.disabled = true;
          try { const d = await NX.api("POST", "/net/diagnose", { fix: !!fix }); draw(d); if (fix) { NX.toast(d.ok ? "Fixed. Everything works now." : "That didn't fix it: " + d.summary); fillWifi(); } }
          catch (e) { if (q$("#s-diagout")) q$("#s-diagout").innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; }
          go.disabled = false;
        };
        go.onclick = () => run(false);
      }
      // how full the USB is, and what uses the space
      function fillScreenTime() {
        const box = q$("#s-st"); if (!box || !NX.screenTime) return;
        const t = Object.entries(NX.screenTime()).filter(([id]) => NX.apps[id]).sort((a, b) => b[1] - a[1]), total = t.reduce((n, x) => n + x[1], 0), max = Math.max(1, ...t.map((x) => x[1]));
        const hm = (s) => { const m = Math.round(s / 60); return m < 1 ? "under a minute" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
        box.innerHTML = t.length ? `<div class="s-sth"><b>${hm(total)}</b><small>with apps open today</small></div><div class="s-stlist">${t.slice(0, 6).map(([id, s]) => `<div class="s-str"><span class="s-stn">${NX.icon(NX.apps[id].icon || id, 18)}${NX.esc(NX.apps[id].name)}</span><span class="s-strb"><i style="width:${Math.max(3, Math.round((s / max) * 100))}%"></i></span><b>${hm(s)}</b></div>`).join("")}</div><p class="s-note">Counted only on this computer, for the last 7 days.</p>` : `<p class="s-note">How long you use each app shows up here during the day. It's counted only on this computer.</p>`;
      }
      async function fillStorage() {
        const box = q$("#s-store"); if (!box) return; let s;
        try { s = await NX.api("GET", "/storage"); } catch (e) { box.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        if (!q$("#s-store")) return;
        const gb = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : b > 0 ? Math.max(1, Math.round(b / 1e3)) + " KB" : "0 KB";
        const pct = s.total ? Math.min(100, Math.round((s.used / s.total) * 100)) : 0;
        const rows = [...s.folders, ["Apps from the Nebulux Store", s.apps], ["Recycle Bin", s.trash], ["Temporary files (website and app caches)", s.cache || 0]].filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...rows.map((r) => r[1]));
        box.innerHTML = `<div class="s-sth"><b>${gb(s.free)} free</b><small>of ${gb(s.total)} ${s.persistent ? "on this USB" : "(in memory: this USB doesn't save changes)"}</small></div>
          <div class="s-stbar ${pct > 90 ? "full" : pct > 75 ? "high" : ""}"><i style="width:${pct}%"></i></div>
          ${rows.length ? `<div class="s-stlist">${rows.map((r) => `<div class="s-str"><span>${NX.esc(r[0])}</span><span class="s-strb"><i style="width:${Math.max(2, Math.round((r[1] / max) * 100))}%"></i></span><b>${gb(r[1])}</b></div>`).join("")}</div>` : ""}
          <div class="s-dacts">${(s.cache || 0) > 0 ? `<button class="btn primary" id="s-stclean" title="Website and app caches. Your files, sign-ins and settings stay.">Clean up ${gb(s.cache)} of temporary files</button>` : ""}${s.trash > 0 ? `<button class="btn" id="s-stempty">Empty the Recycle Bin (${gb(s.trash)})</button>` : ""}</div>
          ${pct > 90 ? `<p class="s-note">The USB is almost full. Delete files you don't need, empty the Recycle Bin, or uninstall apps.</p>` : ""}`;
        const em = q$("#s-stempty"); if (em) em.onclick = async () => { em.disabled = true; try { await NX.fs.emptyTrash(); NX.toast("The Recycle Bin is empty."); } catch (e) { NX.toast(e.message); } fillStorage(); };
        const cl = q$("#s-stclean"); if (cl) cl.onclick = async () => { cl.disabled = true; cl.textContent = "Cleaning up..."; try { const r = await NX.api("POST", "/storage/clean"); NX.toast(r.freed > 0 ? "Cleaned up " + gb(r.freed) + "." : "Cleaned up. There wasn't much to free."); } catch (e) { NX.toast(e.message); } fillStorage(); };
      }
      async function fillAudio() {
        if (!q$("#s-alist")) return; let a;
        try { a = await NX.api("GET", "/audio"); } catch (e) { const b0 = q$("#s-alist"); if (b0) b0.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        const b = q$("#s-alist"); if (!b) return;
        b.innerHTML = a.outputs.length ? a.outputs.map((o, i) => `<div class="s-net ${o.active ? "on" : ""}"><span class="s-sig">${NX.icon(/hdmi|tv/i.test(o.id + o.label) ? "tv" : "volume", 20)}</span><span class="s-nn"><b>${NX.esc(o.label)}</b><small>${o.active ? "Playing here" : ""}</small></span>${o.active ? "" : `<button class="btn" data-ao="${i}">Use this</button>`}</div>`).join("") : `<p class="s-note">No speakers were found.</p>`;
        b.querySelectorAll("[data-ao]").forEach((x) => (x.onclick = async () => { x.disabled = true; x.textContent = "Switching..."; try { await NX.api("POST", "/audio", { id: a.outputs[+x.dataset.ao].id }); NX.toast("Sound now plays on " + a.outputs[+x.dataset.ao].label + "."); } catch (e) { NX.toast(e.message); } fillAudio(); }));
      }
      async function fillCast() {
        const c = q$("#s-castc"), n = q$("#s-castn"); if (!c || !n) return; let s;
        try { s = await NX.api("GET", "/cast"); } catch (e) { n.textContent = e.message; return; }
        if (!s.available) { n.textContent = "Wireless display isn't available on this copy of Nebulux OS."; c.innerHTML = ""; return; }
        if (!s.running) { n.textContent = "Show Nebulux OS on a TV that supports Miracast (\"screen mirroring\" on many Samsung, LG and Roku TVs and Fire TV sticks). The computer's Wi-Fi needs to support it too."; c.innerHTML = `<button class="btn primary" data-cast="start">Connect</button>`; }
        else { n.textContent = "Pick your TV in the Network Displays window. Hide it when you're casting, and Stop to end."; c.innerHTML = `<button class="btn" data-cast="show">Show</button><button class="btn" data-cast="hide">Hide</button><button class="btn" data-cast="stop">Stop</button>`; }
        c.querySelectorAll("[data-cast]").forEach((x) => (x.onclick = async () => { x.disabled = true; try { await NX.api("POST", "/cast/" + x.dataset.cast); } catch (e) { NX.toast(e.message); } fillCast(); }));
      }

      // ---------- the real computer's Wi-Fi and Bluetooth (Nebulux OS from the USB) ----------
      function nativeWifi(p) { return nativeNet(p).split("<!--bt-->")[0]; }
      function nativeBt(p) { return nativeNet(p).split("<!--bt-->")[1]; }
      function nativeNet(p) {
        return `<div class="s-card s-hw"><div class="s-bth"><span class="s-hwt">${NX.icon("wifi", 20)}<b>Wi-Fi</b></span><span class="s-hwc"><button class="btn" id="s-wrefresh" ${p.wifi && !p.airplane ? "" : "hidden"}>Refresh</button>${toggle("wifi", p.wifi && !p.airplane)}</span></div><p class="s-note" id="s-netnow"></p><div id="s-wlist"><p class="s-note">Looking for networks...</p></div></div><!--bt-->
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
        if (!w.on) { b.innerHTML = `<p class="s-note">${NX.esc(w.error || "Wi-Fi is off. Turn it on to see networks near you.")}</p>`; return; }
        nets = w.networks;
        b.innerHTML = nets.length ? nets.map((n, i) => `<div class="s-net ${n.active ? "on" : ""}"><span class="s-sig">${NX.icon("wifi", 20)}</span><span class="s-nn"><b>${NX.esc(n.ssid)}</b><small>${n.active ? "Connected" : n.enterprise ? "School or work network" : n.secure ? "Secured" : "Open"} · signal ${n.signal}%</small></span>${n.active ? `<button class="btn" data-wprop="1">Properties</button>` : ""}<button class="btn ${n.active ? "" : "primary"}" data-wc="${i}">${n.active ? "Disconnect" : "Connect"}</button></div>`).join("") : `<p class="s-note">No networks found yet. Press Refresh in a moment.</p>`;
        const wp = b.querySelector("[data-wprop]"); if (wp) wp.onclick = async () => {
          const row = wp.closest(".s-net"), old = row.nextElementSibling; if (old && old.classList.contains("s-wprops")) { old.remove(); return; }
          let d; try { d = await NX.api("GET", "/wifi/details"); } catch (e) { NX.toast(e.message); return; } if (!d.ssid) return;
          const it = [["Signal", d.signal ? d.signal + "%" : ""], ["Band", d.band + (d.channel ? " (channel " + d.channel + ")" : "")], ["Speed", d.rate], ["Security", d.security], ["IP address", d.ip], ["Router", d.gateway], ["DNS", (d.dns || []).join(", ")], ["Wi-Fi address", d.mac]].filter((x) => x[1]);
          row.insertAdjacentHTML("afterend", `<div class="s-wprops">${it.map(([k, v]) => `<div><span>${k}</span><b>${NX.esc(v)}</b></div>`).join("")}</div>`);
        };
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
          const userBox = n.enterprise ? `<input class="s-pwu" maxlength="128" placeholder="Username" aria-label="Username for ${NX.esc(n.ssid)}" autocomplete="username">` : "";
          row.insertAdjacentHTML("beforeend", `<form class="s-pwf">${userBox}<input type="password" maxlength="${n.enterprise ? 128 : 63}" placeholder="${n.enterprise ? "Password" : "Network password"}" aria-label="Password for ${NX.esc(n.ssid)}" autocomplete="off"><button class="btn" type="button" data-show aria-label="Show password">Show</button><button class="btn primary" type="submit">Connect</button><button class="btn" type="button" data-cancel="1">Cancel</button><p class="s-msg"></p></form>`);
          const f = row.querySelector(".s-pwf"), pu = f.querySelector(".s-pwu"), pi = f.querySelector("input[type=password]"), sub = f.querySelector("[type=submit]"), cancel = f.querySelector("[data-cancel]"), msg = f.querySelector(".s-msg"); (pu || pi).focus();
          cancel.onclick = () => { f.remove(); btn.hidden = false; };
          const sh = f.querySelector("[data-show]"); if (sh) sh.onclick = () => { const v = pi.type === "password"; pi.type = v ? "text" : "password"; sh.textContent = v ? "Hide" : "Show"; pi.focus(); };
          f.onsubmit = (e) => {
            e.preventDefault();
            if (pu) { // a school or work network: a username and a password
              if (!pu.value.trim() || !pi.value) { msg.textContent = "Type your username and password."; return; }
              sub.disabled = true; sub.textContent = "Connecting..."; cancel.hidden = true; msg.textContent = ""; wifiBusy = true;
              NX.api("POST", "/wifi/connect", { ssid: n.ssid, username: pu.value.trim(), password: pi.value }).then(() => { wifiBusy = false; NX.toast("Connected to " + n.ssid + "."); fillWifi(); })
                .catch((er) => { wifiBusy = false; sub.disabled = false; sub.textContent = "Connect"; cancel.hidden = false; pi.value = ""; pi.focus(); msg.textContent = er.message; });
              return;
            }
            if (pi.value.length < 8) { msg.textContent = "Wi-Fi passwords are at least 8 characters."; return; }
            sub.disabled = true; sub.textContent = "Connecting..."; cancel.hidden = true; pi.disabled = true; msg.textContent = "";
            connect(pi.value, (m) => { sub.disabled = false; sub.textContent = "Connect"; cancel.hidden = false; pi.disabled = false; pi.value = ""; pi.focus(); msg.textContent = m; });
          };
        }));
      }
      async function fillBt(found) {
        if (!q$("#s-blist")) return;
        let s; try { s = await NX.api("GET", "/bt"); } catch (e) { const b0 = q$("#s-blist"); if (b0) b0.innerHTML = `<p class="s-note">${NX.esc(e.message)}</p>`; return; }
        const b = q$("#s-blist"); if (!b) return; const scan = q$("#s-bscan");
        if (!s.available) { b.innerHTML = `<p class="s-note">${NX.esc(s.error || "This computer has no Bluetooth that Nebulux OS can use.")}</p>`; if (scan) scan.hidden = true; return; }
        if (!s.on) { b.innerHTML = `<p class="s-note">Bluetooth is off. Turn it on to connect headphones, mice and more.</p>`; return; }
        const mine = s.devices, near = (found || []).filter((d) => !d.paired);
        const dev = (d, btn) => `<div class="s-net"><span class="s-sig">${NX.icon("bt", 20)}</span><span class="s-nn"><b>${NX.esc(d.name)}</b><small>${d.paired ? (d.connected ? "Connected" : "Paired") : "Ready to pair"}${d.battery != null ? " · battery " + d.battery + "%" : ""}</small></span>${btn}</div>`;
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
        const cr = body.querySelector("#s-clearrecent"); if (cr) cr.onclick = () => { NX.setData("recent-files", []); NX.toast("Recently opened files cleared."); draw(); };
        body.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { page = b.dataset.p; draw(); body.querySelector(".s-main").scrollTop = 0; }));
        const si = body.querySelector(".s-search input"); si.oninput = () => { qRaw = si.value; q = si.value.trim().toLowerCase(); const pos = si.selectionStart; draw(); const n = body.querySelector(".s-search input"); n.focus(); n.setSelectionRange(pos, pos); };
        body.querySelectorAll("[data-pref]").forEach((inp) => {
          const k = inp.dataset.pref;
          if (inp.type === "checkbox") inp.onchange = () => { NX.setPref(k, inp.checked); if (inp.checked && k === "dynWall") NX.setPref("dailyWall", false); if (inp.checked && k === "dailyWall") NX.setPref("dynWall", false); if (k === "airplane" && inp.checked) { NX.setPref("wifi", false); NX.setPref("bt", false); } if ((k === "wifi" || k === "bt") && inp.checked) NX.setPref("airplane", false); draw(); if (NX.native && ["wifi", "bt", "airplane"].includes(k)) setTimeout(() => { if (page === "network") fillWifi(); if (page === "devices") fillBt(); }, 1500); };
          else inp.oninput = () => NX.setPref(k, +inp.value);
        });
        body.querySelectorAll("[data-time]").forEach((inp) => (inp.onchange = () => { if (/^dd:dd$/.test(inp.value)) { NX.setPref(inp.dataset.time, inp.value); if (NX.shell && NX.shell.nightTick) NX.shell.nightTick(true); } }));
        body.querySelectorAll("[data-wall]").forEach((b) => (b.onclick = () => { NX.setPref("wallpaper", +b.dataset.wall); draw(); }));
        const pf = body.querySelector("#s-picfile"); if (pf) pf.onchange = () => { const f = pf.files && pf.files[0]; if (f) NX.setPicFile(f).then(() => draw()).catch((e) => NX.toast(e.message)); };
        const pr = body.querySelector("#s-picrm"); if (pr) pr.onclick = () => { NX.setUserPic(NX.me.id, null); NX.shell && NX.shell.refresh && NX.shell.refresh(); draw(); };
        body.querySelectorAll("[data-wallc]").forEach((b) => (b.onclick = () => { NX.setPref("wallpaper", "custom"); draw(); }));
        const wf = body.querySelector("#s-wallfile"); if (wf) wf.onchange = () => { const f = wf.files && wf.files[0]; if (f) NX.setWallpaperFile(f).then(() => draw()).catch((e) => NX.toast(e.message)); };
        body.querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => { if (b.dataset.theme === "auto") { NX.setPref("themeAuto", true); if (NX.autoTheme) NX.autoTheme(); } else { NX.setPref("themeAuto", false); NX.setPref("theme", b.dataset.theme); } draw(); }));
        body.querySelectorAll("[data-pkey]").forEach((b) => (b.onclick = async () => { try { await NX.api("POST", "/powerkey", { what: b.dataset.pkey }); NX.setPref("powerKey", b.dataset.pkey); draw(); } catch (e) { NX.toast(e.message); } }));
        body.querySelectorAll("[data-su]").forEach((c) => (c.onchange = () => { const L = (NX.prefs().startup || []).filter((x) => x !== c.dataset.su); if (c.checked) L.push(c.dataset.su); NX.setPref("startup", L); }));
        const tz = body.querySelector("#s-tz"); if (tz) tz.onchange = async () => { try { await NX.api("POST", "/timezone", { zone: tz.value }); NX.toast("Time zone: " + tz.value.replace(/_/g, " ") + "."); setTimeout(draw, 800); } catch (e) { NX.toast(e.message); } };
        const kb = body.querySelector("#s-kb"); if (kb) kb.onchange = async () => { NX.setPref("keyboard", kb.value); if (NX.native) { try { await NX.api("POST", "/keyboard", { layout: kb.value }); } catch (e) { NX.toast(e.message); return; } } NX.toast("Keyboard layout: " + kb.options[kb.selectedIndex].text + "."); };
        body.querySelectorAll("[data-scale]").forEach((b) => (b.onclick = async () => {
          if (b.classList.contains("on")) return;
          if (!(await NX.ask(body, { title: "Change the size?", text: "The screen starts again at " + b.textContent + ". Save your work first: open apps close.", ok: "Change it" }))) return;
          try { await NX.api("POST", "/scale", { scale: b.dataset.scale }); NX.scale = b.dataset.scale; NX.toast("Changing the size..."); draw(); } catch (e) { NX.toast(e.message); }
        }));
        body.querySelectorAll("[data-cf]").forEach((b) => (b.onclick = () => { NX.setPref("colorFilter", b.dataset.cf); draw(); }));
        body.querySelectorAll("[data-acc]").forEach((b) => (b.onclick = () => { NX.setPref("accent", b.dataset.acc); draw(); }));
        body.querySelectorAll("[data-align]").forEach((b) => (b.onclick = () => { NX.setPref("align", b.dataset.align); draw(); }));
        body.querySelectorAll("[data-uninstall]").forEach((b) => (b.onclick = () => { NX.uninstall(b.dataset.uninstall); draw(); }));
        body.querySelectorAll("[data-look]").forEach((b) => (b.onclick = () => { const t = NX.looks40[+b.dataset.look]; NX.setPref("wallpaper", t.wall); NX.setPref("theme", t.theme); NX.setPref("accent", t.accent); NX.setPref("corners40", t.corners); NX.setPref("glass", t.glass); draw(); }));
        const lps = body.querySelector("[data-lockpic]"); if (lps) lps.onchange = () => NX.setPref("lockPic", lps.value === "match" ? "match" : +lps.value);
        body.querySelectorAll("button[data-wbtn]").forEach((b) => (b.onclick = () => { NX.setPref("wbtn", b.dataset.wbtn); draw(); }));
        body.querySelectorAll("[data-pcol]").forEach((b) => (b.onclick = () => { NX.setPref("pointerColor", b.dataset.pcol); draw(); }));
        const svs = body.querySelector("[data-saver]"); if (svs) svs.onchange = () => { NX.setPref("scrSaver", svs.value); draw(); };
        const svw = body.querySelector("[data-saverwait]"); if (svw) svw.onchange = () => NX.setPref("saverWait", +svw.value);
        const svp = body.querySelector("[data-saverpv]"); if (svp) svp.onclick = () => NX.saver && NX.saver.preview(NX.prefs().scrSaver);
        body.querySelectorAll("button[data-tbsearch]").forEach((b) => (b.onclick = () => { NX.setPref("tbSearch", b.dataset.tbsearch); draw(); }));
        body.querySelectorAll("button[data-wfit]").forEach((b) => (b.onclick = () => { NX.setPref("wallFit", b.dataset.wfit); draw(); }));
        const gg = body.querySelector("#s-goog"); if (gg) gg.onclick = () => { if (NX.prefs().googleSignedIn) NX.open("gmail"); else { NX.browserOpen ? NX.browserOpen("https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmail.google.com%2F") : NX.open("google"); } };
        body.querySelectorAll("[data-corners]").forEach((b) => (b.onclick = () => { NX.setPref("corners40", b.dataset.corners); draw(); }));
        body.querySelectorAll("[data-glass]").forEach((b) => (b.onclick = () => { NX.setPref("glass", b.dataset.glass); draw(); }));
        body.querySelectorAll("[data-dwk]").forEach((c) => (c.onchange = () => { NX.setPref("deskWidgets", [...body.querySelectorAll("[data-dwk]:checked")].map((x) => x.dataset.dwk)); }));
        body.querySelectorAll("[data-corner]").forEach((s) => (s.onchange = () => { NX.setPref("corners", Object.assign({}, NX.prefs().corners || {}, { [s.dataset.corner]: s.value })); }));
        const mgo = body.querySelector("[data-magon]"); if (mgo) mgo.onclick = () => NX.magnifier && NX.magnifier.zoom(1);
        const qso = body.querySelector("[data-qsopen]"); if (qso) qso.onclick = () => NX.quickSearch && NX.quickSearch();
        const aq = body.querySelector(".s-appq"); if (aq) aq.oninput = () => { const q = aq.value.trim().toLowerCase(); body.querySelectorAll("[data-appn]").forEach((r) => (r.hidden = !!q && !r.dataset.appn.includes(q))); };
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
        if (NX.native && page === "network") { fillWifi(); wireTrouble(); fillKnown(); wireHidden(); fillHot(); }
        if (NX.native && page === "devices") fillBt();
        if (page === "update" && NX.update) NX.update.fillSettings(q$);
        const cc = q$("#s-clipclear"); if (cc) cc.onclick = () => { NX.setData("clip-history", NX.data("clip-history", []).filter((x) => x.pin)); NX.toast("Clipboard history cleared. Pinned items stay."); draw(); };
        if (page === "system") fillScreenTime();
        if (NX.native && page === "system") { fillScreens(); fillAudio(); fillCast(); fillStorage(); if (NX.backupFill) NX.backupFill(q$("#s-backup")); const dt = q$("#s-detect"); if (dt) dt.onclick = () => { const b = q$("#s-dlist"); if (b) b.innerHTML = `<p class="s-note">Looking for screens...</p>`; fillScreens(true); }; }
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
      const onDisp = () => { if (page === "system") { fillScreens(); fillAudio(); } }; document.addEventListener("nx:display", onDisp);
      const onPref = () => { if (document.activeElement && document.activeElement.type === "range" && body.contains(document.activeElement)) return; };
      document.addEventListener("nx:prefs", onPref); win.onclose = () => { document.removeEventListener("nx:prefs", onPref); document.removeEventListener("nx:display", onDisp); };
      draw();
    } };
})();
