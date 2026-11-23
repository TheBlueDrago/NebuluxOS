// Get Started: a quick tour of Nebulux OS for new people. Welcome, the shortcuts, what's new, and buttons that open
// the right place (the Nebulux Store, Settings, File Explorer...).
"use strict";
(function () {
  const KEYS = [
    ["Nebulux", "Open Start"], ["Nebulux + Tab", "Task View: all your windows and desktops"], ["Nebulux + D", "Show the desktop, and back"],
    ["Nebulux + E", "File Explorer"], ["Nebulux + L", "Lock the computer"], ["Nebulux + V", "Clipboard history"], ["Nebulux + W", "Widgets"],
    ["Nebulux + Left / Right", "Snap a window to half the screen"], ["Nebulux + Up / Down", "Maximize, or restore and minimize"],
    ["Ctrl + Nebulux + D", "New desktop"], ["Ctrl + Nebulux + Left / Right", "Switch desktops"], ["Ctrl + Nebulux + F4", "Close this desktop"],
    ["Alt + Tab", "Switch windows"], ["Nebulux + Shift + S or Print Screen", "Take a screenshot"], ["Ctrl + Shift + Esc", "Task Manager"],
    ["Ctrl + T / Ctrl + W", "New tab / close tab in File Explorer"],
  ];
  const PAGES = [["welcome", "Welcome"], ["basics", "The basics"], ["keys", "Shortcuts"], ["new", "What's new"], ["more", "Make it yours"]];
  NX.apps.tips = {
    name: "Get Started", icon: "tips", builtIn: true, category: "Utilities", w: 880, h: 600, minW: 360, minH: 420,
    desc: "A quick tour of Nebulux OS: the basics, every shortcut, and what's new.",
    open(body, win, opts) {
      body.classList.add("gs");
      let pg = (opts && opts.page) || "welcome";
      const go = (id, o) => { NX.open(id, o); };
      const card = (icon, title, text, btn, act) => `<div class="gs-card">${NX.icon(icon, 36)}<div><b>${title}</b><p>${text}</p>${btn ? `<button class="btn" data-go="${act}">${btn}</button>` : ""}</div></div>`;
      const page = () => {
        if (pg === "welcome") return `<div class="gs-hero">${NX.icon("logo", 96)}<h1>Welcome to Nebulux OS ${NX.esc(NX.version)}</h1><p>Everything you need is a click away. Here's a quick tour, at your own pace.</p><button class="btn primary" data-p="basics">Start the tour</button></div>`;
        if (pg === "basics") return `<h2>The basics</h2><div class="gs-grid">
          ${card("logo", "Start", "Press the Nebulux key or the logo on the taskbar. Type to find apps, settings, files and the web.", "Open Start", "start")}
          ${card("files", "Your files", "File Explorer has your folders, the Recycle Bin and USB drives. Ctrl + T opens a tab.", "Open File Explorer", "files")}
          ${card("store", "Apps and games", "Get real apps like Spotify, Discord, Steam and VLC, and lots of web apps, from the Nebulux Store.", "Open the Nebulux Store", "store")}
          ${card("google", "The web", "Google, YouTube and every website open in a full web browser with tabs.", "Open Google", "google")}
          ${card("wifi", "Wi-Fi and Bluetooth", "Click the Wi-Fi or battery icons on the right of the taskbar for quick settings.", "Open quick settings", "qs")}
          ${card("sticky", "Sticky Notes", "Quick colored notes that save as you type. They show up in Widgets too.", "Open Sticky Notes", "notes")}</div>`;
        if (pg === "keys") return `<h2>Shortcuts</h2><p class="gs-sub">The Nebulux key is the key with the logo, between Ctrl and Alt.</p><div class="gs-keys">${KEYS.map(([k, t]) => `<div><span>${k.split(" ").map((x) => (x === "+" || x === "/" || x === "or" ? `<i>${x}</i>` : `<kbd>${NX.esc(x)}</kbd>`)).join(" ")}</span><small>${NX.esc(t)}</small></div>`).join("")}</div>`;
        if (pg === "new") return `<h2>What's new in ${NX.esc(NX.version)}</h2><div class="gs-new">${NX.whatsNew.map((w) => `<div><b>${NX.esc(w[0])}</b><p>${NX.esc(w[1])}</p></div>`).join("")}</div>`;
        return `<h2>Make it yours</h2><div class="gs-grid">
          ${card("contrast", "Your look", "Pick a wallpaper, dark or light, and an accent color.", "Personalize", "personal")}
          ${card("moon", "Night light", "Warmer colors in the evening, on a schedule if you like.", "Display settings", "system")}
          ${card("mouse", "Mouse speed", "From Slower to Faster.", "Mouse settings", "devices")}
          ${card("user", "Accounts", "Add people who share this computer, each with a password.", "Accounts", "accounts")}
          ${card("restart", "Updates", "Nebulux OS updates itself. Later, Remind me or Never: you choose.", "Nebulux Update", "update")}
          ${card("taskbar", "Your taskbar", "Search for an app and press Pin to taskbar, or right-click it on the desktop.", "Open Start", "start")}</div>`;
      };
      const draw = () => {
        const i = PAGES.findIndex((p) => p[0] === pg);
        body.innerHTML = `<nav class="gs-nav">${PAGES.map(([id, t]) => `<button class="${id === pg ? "on" : ""}" data-p="${id}">${t}</button>`).join("")}</nav><main class="gs-main">${page()}<div class="gs-foot">${i > 0 ? `<button class="btn" data-p="${PAGES[i - 1][0]}">Back</button>` : "<span></span>"}${i < PAGES.length - 1 ? `<button class="btn primary" data-p="${PAGES[i + 1][0]}">Next</button>` : `<button class="btn primary" data-done="1">Done</button>`}</div></main>`;
        body.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { pg = b.dataset.p; draw(); }));
        const dn = body.querySelector("[data-done]"); if (dn) dn.onclick = () => NX.close("tips");
        body.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => {
          const g = b.dataset.go;
          if (g === "start") { NX.shell.toggleStart(true); return; }
          if (g === "qs") { NX.shell.openWifi(); return; }
          if (["personal", "system", "devices", "accounts", "update"].includes(g)) { go("settings", { page: g }); return; }
          go(g);
        }));
      };
      win.onopts = (o) => { if (o.page) { pg = o.page; draw(); } };
      draw();
    },
  };
})();
