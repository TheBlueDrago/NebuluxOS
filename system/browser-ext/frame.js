// Runs in every web page. Inside the Nebulux OS page itself it passes "open this address" messages from the
// background script to the OS. Inside a website shown in an OS window it tells the window its address and title
// (for the address bar) and follows its Back, Forward and Reload buttons.
"use strict";
(function () {
  const OS_ORIGIN = "http://127.0.0.1:7777";
  if (location.origin === OS_ORIGIN || location.origin === "http://localhost:7777") {
    if (window.top !== window) return;
    document.documentElement.setAttribute("data-nxext", "1");
    chrome.runtime.onMessage.addListener((m) => { if (m && m.nx === "open" && /^https?:/i.test(m.url)) window.postMessage({ nx: "open", url: m.url }, location.origin); });
    return;
  }
  if (window.top === window) return;
  let isDirect = false; try { isDirect = window.parent === window.top; } catch (e) { isDirect = false; }
  const toOS = (msg) => { try { window.top.postMessage(msg, OS_ORIGIN); } catch (e) { /* the top page isn't the OS */ } };
  if (isDirect) {
    let last = "";
    const tell = () => { const t = location.href + "|" + document.title; if (t === last) return; last = t; toOS({ nx: "loc", url: location.href, title: document.title }); };
    tell(); document.addEventListener("DOMContentLoaded", tell); addEventListener("load", tell); addEventListener("hashchange", tell); addEventListener("popstate", tell);
    setInterval(tell, 800); // pages that change their address without loading (search results, for one)
    addEventListener("message", (e) => {
      if (e.source !== window.parent || e.origin !== OS_ORIGIN || !e.data) return;
      if (e.data.nx === "back") history.back(); else if (e.data.nx === "forward") history.forward(); else if (e.data.nx === "reload") location.reload();
    });
  }
  // links that try to replace the whole screen open in this window instead
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]"); if (!a) return;
    const t = (a.getAttribute("target") || "").toLowerCase();
    if (t === "_top" || t === "_parent") { e.preventDefault(); if (/^https?:/i.test(a.href)) location.href = a.href; }
  }, true);
})();
