// Google. On the real Nebulux OS (from the USB) this window is a real web browser that shows Google itself, with
// Back, Forward, Reload, Home and an address bar; links that open new tabs open here too. In a normal browser tab,
// Google doesn't let other pages show it inside them, so there it's a search page that opens Google in a new tab.
"use strict";
(function () {
  const HOME = "https://www.google.com/webhp?igu=1";
  // the shortcuts under the search box, each with its own logo (img/logos)
  const LINKS = [["Gmail", "https://mail.google.com", "gmail"], ["YouTube", "https://www.youtube.com", "youtube"], ["Maps", "https://maps.google.com", "gmaps"], ["Drive", "https://drive.google.com", "gdrive"], ["News", "https://news.google.com", "gnews"], ["Translate", "https://translate.google.com", "translate"]];
  // a typed web address, or else a Google search
  const resolve = (q, frame) => {
    q = String(q || "").trim(); if (!q) return "";
    if (/^https?:\/\/\S+$/i.test(q)) return q;
    if (/^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q)) return "https://" + q;
    return "https://www.google.com/search?q=" + encodeURIComponent(q) + (frame ? "&igu=1" : "");
  };
  const go = (q) => {
    const url = resolve(q, NX.webFrames); if (!url) return false;
    if (!NX.netOK()) { NX.toast(NX.netWhy()); return false; }
    if (NX.webFrames) { NX.open("google", { url }); return true; }
    window.open(url, "_blank", "noopener"); return true;
  };
  NX.searchWeb = go;
  NX.openWeb = (url) => { if (/^https?:/i.test(url)) NX.open("google", { url }); };

  // ---------- a website inside an OS window (real OS only) ----------
  NX.webView = (body, win, opts) => {
    const home = opts.home || opts.url || HOME;
    body.classList.add("webapp");
    // an app (YouTube, Netflix, Spotify...) looks like an app: no web address showing; only Google, the web browser, has the address bar
    if (win.app && win.app.url && win.id !== "google") body.classList.add("wv-app");
    body.innerHTML = `<div class="wv-bar"><button class="wv-b" data-w="back" aria-label="Back" title="Back">${NX.icon("back", 16)}</button><button class="wv-b" data-w="forward" aria-label="Forward" title="Forward">${NX.icon("fwd", 16)}</button><button class="wv-b" data-w="reload" aria-label="Reload" title="Reload">${NX.icon("restart", 16)}</button><button class="wv-b" data-w="home" aria-label="Home" title="Home">${NX.icon("home", 16)}</button>
      <form class="wv-addr">${NX.icon("lock", 14)}<input name="u" placeholder="Search Google or type a web address" aria-label="Search Google or type a web address" autocomplete="off" spellcheck="false"></form></div><div class="wv-load"><i></i></div>
      <div class="wv-view"><iframe class="webview" title="${NX.esc(win.app.name)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation allow-storage-access-by-user-activation" allow="fullscreen; autoplay; clipboard-read; clipboard-write; camera; microphone; geolocation; encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="wv-off" hidden></div></div>`;
    const f = body.querySelector("iframe"), addr = body.querySelector(".wv-addr"), ai = addr.querySelector("input"), off = body.querySelector(".wv-off"), load = body.querySelector(".wv-load");
    let current = "", pending = "";
    const busy = (on) => load.classList.toggle("on", on);
    const nav = (url) => {
      if (!url) return;
      if (!NX.netOK()) { pending = url; off.hidden = false; f.hidden = true; busy(false);
        off.innerHTML = `${NX.icon("wifioff", 44)}<b>You're not connected</b><p>${NX.esc(NX.netWhy())}</p><div><button class="btn primary" data-o="wifi">Wi-Fi settings</button><button class="btn" data-o="retry">Try again</button></div>`;
        off.querySelector("[data-o=wifi]").onclick = () => NX.open("settings", { page: "network" }); off.querySelector("[data-o=retry]").onclick = () => nav(pending); return; }
      off.hidden = true; f.hidden = false; pending = ""; current = url; busy(true); f.src = url; if (document.activeElement !== ai) ai.value = url;
    };
    f.addEventListener("load", () => busy(false));
    f._onloc = (url, title) => { current = url; if (document.activeElement !== ai) ai.value = url.replace(/[?&]igu=1(?=&|$)/, "").replace(/\?$/, ""); busy(false); win.el.querySelector(".wt-name").textContent = title ? title + " - " + win.app.name : win.app.name; };
    const send = (m) => { try { f.contentWindow.postMessage({ nx: m }, "*"); } catch (e) { /* not loaded yet */ } };
    body.querySelectorAll("[data-w]").forEach((b) => (b.onclick = () => { const k = b.dataset.w; if (k === "home") nav(home); else if (k === "reload") { if (pending || !current) nav(pending || current || home); else { busy(true); send("reload"); } } else send(k); }));
    addr.onsubmit = (e) => { e.preventDefault(); const url = resolve(ai.value, true); if (url) { ai.blur(); nav(url); } };
    // clicking the address bar selects it all at once (so typing replaces it), without losing the first letter typed
    let fresh = false;
    ai.onfocus = () => { ai.select(); fresh = true; };
    ai.onmouseup = (e) => { if (fresh) { e.preventDefault(); fresh = false; } };
    ai.onkeydown = () => { fresh = false; };
    const onNet = () => { if (pending && NX.netOK()) nav(pending); };
    addEventListener("online", onNet); document.addEventListener("nx:prefs", onNet);
    win.onclose = () => { removeEventListener("online", onNet); document.removeEventListener("nx:prefs", onNet); };
    win.onopts = (o) => { if (o.url) nav(o.url); else if (o.q) nav(resolve(o.q, true)); };
    nav(opts.q ? resolve(opts.q, true) : opts.url || home);
    return { nav };
  };

  NX.apps.google = { name: "Google", icon: "google", builtIn: true, browser: "https://www.google.com/", w: 1100, h: 700, minW: 380, minH: 320, desc: "Search the web with Google.",
    open(body, win, opts) {
      if (NX.webFrames) { NX.webView(body, win, Object.assign({ home: HOME }, opts)); return; }
      body.classList.add("gapp");
      body.innerHTML = `<div class="g-bar"><button class="g-nav" disabled aria-label="Back">${NX.icon("back", 16)}</button><button class="g-nav" disabled aria-label="Forward">${NX.icon("fwd", 16)}</button><button class="g-nav g-home" aria-label="Home">${NX.icon("home", 16)}</button>
        <form class="g-addr">${NX.icon("lock", 14)}<input name="u" placeholder="Search Google or type a web address" aria-label="Search Google or type a web address" autocomplete="off"></form></div>
        <div class="g-page"><div class="g-logo"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
        <form class="g-search"><span class="g-si">${NX.icon("search", 18)}</span><input name="q" placeholder="Search Google" aria-label="Search Google" autocomplete="off"><button type="submit" class="btn primary">Search</button></form><div class="g-btns"><button type="button" data-g="s">Google Search</button><button type="button" data-g="l">I'm Feeling Lucky</button></div>
        <div class="g-links">${LINKS.map(([n, u, l]) => `<a class="g-tile" href="${u}" target="_blank" rel="noopener"><span><img src="img/logos/${l}.png" alt="" width="26" height="26" onerror="this.replaceWith('${n[0]}')"></span><b>${n}</b></a>`).join("")}</div>
        <p class="g-note">Results open in a new tab, because Google doesn't let other pages show it inside them. On the real Nebulux OS (from the USB), Google opens right here.</p></div>`;
      const s = body.querySelector(".g-search"), a = body.querySelector(".g-addr"), qi = s.querySelector("input");
      s.onsubmit = (e) => { e.preventDefault(); if (go(qi.value)) { qi.value = ""; NX.toast("Opened Google in a new tab."); } else qi.focus(); };
      a.onsubmit = (e) => { e.preventDefault(); const i = a.querySelector("input"); if (go(i.value)) { i.value = ""; NX.toast("Opened in a new tab."); } };
      body.querySelector("[data-g=s]").onclick = () => s.requestSubmit ? s.requestSubmit() : s.onsubmit(new Event("submit"));
      body.querySelector("[data-g=l]").onclick = () => { const q = qi.value.trim(); if (!NX.netOK()) { NX.toast(NX.netWhy()); return; } window.open(q ? "https://www.google.com/search?btnI=1&q=" + encodeURIComponent(q) : "https://www.google.com/doodles", "_blank", "noopener"); };
      body.querySelectorAll(".g-tile").forEach((t) => (t.onclick = (e) => { if (!NX.netOK()) { e.preventDefault(); NX.toast(NX.netWhy()); } }));
      body.querySelector(".g-home").onclick = () => { qi.value = ""; qi.focus(); };
      setTimeout(() => qi.focus(), 60);
      if (opts.q) { qi.value = opts.q; }
      win.onopts = (o) => { if (o.q) { qi.value = o.q; qi.focus(); } };
    } };
})();
