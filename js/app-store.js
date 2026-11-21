// Nebulux Store: browse apps by category, open an app's page, install it (with a progress bar) and uninstall it from
// your Library. Installed apps appear in Start, on the desktop and in Settings > Apps.
"use strict";
(function () {
  const CATS = [["all", "Home"], ["Productivity", "Productivity"], ["Creativity", "Creativity"], ["Games", "Games"], ["Utilities", "Utilities"], ["Web", "Web apps"]];
  const storeApps = () => Object.entries(NX.apps).filter(([, a]) => !a.builtIn);
  const isIn = (id) => NX.prefs().installed.includes(id);
  NX.install = (id) => {
    const p = NX.prefs(); if (p.installed.includes(id)) return;
    NX.setPref("installed", [...p.installed, id]);
    if (!p.desktop.includes(id)) NX.setPref("desktop", [...NX.prefs().desktop, id]);
    NX.shell && NX.shell.refresh();
  };
  NX.uninstall = (id) => {
    if (!NX.apps[id] || NX.apps[id].builtIn) return;
    NX.close(id); const p = NX.prefs();
    NX.setPref("installed", p.installed.filter((x) => x !== id)); NX.setPref("pinned", NX.prefs().pinned.filter((x) => x !== id));
    NX.setPref("desktop", NX.prefs().desktop.filter((x) => x !== id)); NX.setPref("recent", NX.prefs().recent.filter((x) => x !== id));
    NX.shell && NX.shell.refresh(); NX.toast(NX.apps[id].name + " was uninstalled.");
  };
  NX.apps.store = { name: "Nebulux Store", icon: "store", builtIn: true, w: 1040, h: 680, minW: 420, minH: 380, desc: "Get apps and games for Nebulux OS.",
    open(body, win, opts) {
      body.classList.add("store");
      let view = opts.app ? "app:" + opts.app : "all", q = "", busy = {};
      const card = (id, a) => `<div class="st-card" data-app="${id}" tabindex="0" role="button" aria-label="${NX.esc(a.name)}">${NX.icon(a.icon || id, 52)}<b>${NX.esc(a.name)}</b><small>${a.category}</small><span class="st-rate">${NX.icon("star", 12)} ${a.rating || "4.5"}</span>${btn(id)}</div>`;
      const btn = (id) => busy[id] != null ? `<span class="st-prog"><i style="width:${busy[id]}%"></i></span>` : isIn(id) ? `<button class="btn" data-launch="${id}">Open</button>` : `<button class="btn primary" data-get="${id}">${NX.apps[id].url ? "Get" : "Install"}</button>`;
      const draw = () => {
        const list = storeApps().filter(([, a]) => (view === "all" || view === "library" || a.category === view) && (!q || (a.name + " " + a.desc + " " + a.category).toLowerCase().includes(q)));
        let main;
        if (view.startsWith("app:")) {
          const id = view.slice(4), a = NX.apps[id];
          main = !a ? `<p>That app isn't here.</p>` : `<button class="st-back" data-view="all">${NX.icon("back", 16)} Back</button>
            <div class="st-detail"><div class="st-dh">${NX.icon(a.icon || id, 96)}<div><h2>${NX.esc(a.name)}</h2><p class="st-pub">Nebulux · ${a.category}</p><p class="st-rate big">${NX.icon("star", 14)} ${a.rating || "4.5"} average</p>${btn(id)}${isIn(id) ? `<button class="btn ghost" data-remove="${id}">Uninstall</button>` : ""}</div></div>
            <h3>Description</h3><p>${NX.esc(a.desc)}</p><h3>Details</h3><div class="st-facts"><div><span>Size</span><b>${a.size || "1 MB"}</b></div><div><span>Works</span><b>${a.url ? "On the web, opens in a new tab" : "On this PC, no internet needed"}</b></div><div><span>Price</span><b>Free</b></div></div></div>`;
        } else if (view === "library") {
          const mine = storeApps().filter(([id]) => isIn(id));
          main = `<h2>Library</h2>${mine.length ? `<div class="st-lib">${mine.map(([id, a]) => `<div class="st-lrow">${NX.icon(a.icon || id, 36)}<b>${NX.esc(a.name)}</b><small>${a.category}</small><button class="btn" data-launch="${id}">Open</button><button class="btn ghost" data-remove="${id}">Uninstall</button></div>`).join("")}</div>` : `<p class="st-empty">You haven't installed anything yet. Find something on Home.</p>`}`;
        } else {
          main = (view === "all" && !q ? `<div class="st-hero"><div><small>Featured</small><h2>Make it yours</h2><p>Free apps and games made for Nebulux OS.</p><button class="btn primary" data-app-open="snake">Play Comet Snake</button></div>${NX.icon("snake", 120)}</div>` : "") +
            `<h2>${q ? "Results" : CATS.find((c) => c[0] === view)[1]}</h2>${list.length ? `<div class="st-grid">${list.map(([id, a]) => card(id, a)).join("")}</div>` : `<p class="st-empty">No apps match.</p>`}`;
        }
        body.innerHTML = `<aside class="st-side">${CATS.map(([k, n]) => `<button class="st-nav ${view === k ? "on" : ""}" data-view="${k}">${NX.icon(k === "all" ? "home" : k === "Games" ? "arcade" : k === "Creativity" ? "brush" : k === "Web" ? "globe" : k === "Utilities" ? "settings" : "apps", 18)}<span>${n}</span></button>`).join("")}<button class="st-nav lib ${view === "library" ? "on" : ""}" data-view="library">${NX.icon("library", 18)}<span>Library</span></button></aside>
          <section class="st-main"><label class="st-search">${NX.icon("search", 16)}<input placeholder="Search apps and games" value="${NX.esc(q)}" aria-label="Search apps and games"></label>${main}</section>`;
        wire();
      };
      const install = (id) => {
        if (busy[id] != null || isIn(id)) return; busy[id] = 0; draw();
        const t = setInterval(() => {
          if (!NX.wins.has("store")) { clearInterval(t); delete busy[id]; NX.install(id); return; }
          busy[id] = Math.min(100, busy[id] + 9 + Math.random() * 14);
          const bar = body.querySelector(`[data-app="${id}"] .st-prog i, .st-detail .st-prog i`); if (bar) bar.style.width = busy[id] + "%";
          if (busy[id] >= 100) { clearInterval(t); delete busy[id]; NX.install(id); NX.toast(NX.apps[id].name + " is installed. Find it in Start."); draw(); }
        }, 120);
      };
      function wire() {
        body.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { view = b.dataset.view; draw(); }));
        body.querySelectorAll(".st-card").forEach((c) => { const go = (e) => { if (e.target.closest("button")) return; view = "app:" + c.dataset.app; draw(); }; c.onclick = go; c.onkeydown = (e) => { if (e.key === "Enter") go(e); }; });
        body.querySelectorAll("[data-get]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); install(b.dataset.get); }));
        body.querySelectorAll("[data-launch]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); NX.open(b.dataset.launch); }));
        body.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); NX.uninstall(b.dataset.remove); draw(); }));
        body.querySelectorAll("[data-app-open]").forEach((b) => (b.onclick = () => { view = "app:" + b.dataset.appOpen; draw(); }));
        const si = body.querySelector(".st-search input"); si.oninput = () => { q = si.value.trim().toLowerCase(); if (view.startsWith("app:") || view === "library") view = "all"; const pos = si.selectionStart; draw(); const n = body.querySelector(".st-search input"); n.focus(); n.setSelectionRange(pos, pos); };
      }
      win.onopts = (o) => { if (o.app) { view = "app:" + o.app; draw(); } };
      const onPref = (e) => { if (e.detail === "installed") draw(); };
      document.addEventListener("nx:prefs", onPref); win.onclose = () => document.removeEventListener("nx:prefs", onPref);
      draw();
    } };
})();
