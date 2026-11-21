// Google: a search page in a browser-style window. Google doesn't let other pages show it inside them, so searches and
// the shortcuts open Google in a new browser tab.
"use strict";
(function () {
  const LINKS = [["Gmail", "https://mail.google.com"], ["YouTube", "https://www.youtube.com"], ["Maps", "https://maps.google.com"], ["Drive", "https://drive.google.com"], ["News", "https://news.google.com"], ["Translate", "https://translate.google.com"]];
  const go = (q) => {
    q = String(q || "").trim(); if (!q) return false;
    if (!NX.netOK()) { NX.toast(NX.netWhy()); return false; }
    const isUrl = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(q) && !/\s/.test(q);
    const url = isUrl ? (/^https?:\/\//i.test(q) ? q : "https://" + q) : "https://www.google.com/search?q=" + encodeURIComponent(q);
    window.open(url, "_blank", "noopener"); return true;
  };
  NX.apps.google = { name: "Google", icon: "google", builtIn: true, w: 1000, h: 640, minW: 380, minH: 320, desc: "Search the web with Google.",
    open(body, win, opts) {
      body.classList.add("gapp");
      body.innerHTML = `<div class="g-bar"><button class="g-nav" disabled aria-label="Back">${NX.icon("back", 16)}</button><button class="g-nav" disabled aria-label="Forward">${NX.icon("fwd", 16)}</button><button class="g-nav g-home" aria-label="Home">${NX.icon("home", 16)}</button>
        <form class="g-addr">${NX.icon("lock", 14)}<input name="u" placeholder="Search Google or type a web address" aria-label="Search Google or type a web address" autocomplete="off"></form></div>
        <div class="g-page"><div class="g-logo"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
        <form class="g-search"><span class="g-si">${NX.icon("search", 18)}</span><input name="q" placeholder="Search Google" aria-label="Search Google" autocomplete="off"><button type="submit" class="btn primary">Search</button></form><div class="g-btns"><button type="button" data-g="s">Google Search</button><button type="button" data-g="l">I'm Feeling Lucky</button></div>
        <div class="g-links">${LINKS.map(([n, u]) => `<a class="g-tile" href="${u}" target="_blank" rel="noopener"><span>${n[0]}</span><b>${n}</b></a>`).join("")}</div>
        <p class="g-note">Results open in a new tab, because Google doesn't let other pages show it inside them.</p></div>`;
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
  NX.searchWeb = go;
})();
