// Nebulux OS app windows: links that would open a new browser window (target="_blank", or window.open with no size)
// stay in the app's own window when they go to the same service (youtube.com and youtu.be, google.com and
// gstatic.com and the like). Sign-in pop-ups (window.open with a size) and links to other sites are left alone.
(function () {
  "use strict";
  if (window.top !== window) return;
  const FAMILY = [["youtube.com", "youtu.be", "ytimg.com", "google.com", "googleusercontent.com", "gstatic.com"], ["x.com", "twitter.com"], ["facebook.com", "fb.com", "messenger.com"], ["microsoft.com", "live.com", "office.com", "microsoft365.com", "xbox.com", "bing.com"], ["netflix.com"], ["disneyplus.com", "disney.com"], ["amazon.com", "primevideo.com"]];
  const base = (h) => { const p = String(h || "").toLowerCase().replace(/^www\./, "").split("."); return p.slice(-2).join("."); };
  const same = (url) => {
    let u; try { u = new URL(url, location.href); } catch (e) { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    const a = base(location.hostname), b = base(u.hostname);
    return a === b || FAMILY.some((f) => f.includes(a) && f.includes(b));
  };
  // a click on a link that would open a new window
  addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey) return;
    const a = e.target && e.target.closest && e.target.closest("a[href]"); if (!a) return;
    const t = (a.getAttribute("target") || "").toLowerCase(); if (t !== "_blank" && t !== "_new") return;
    if (!same(a.href)) return;
    e.preventDefault(); e.stopImmediatePropagation(); location.assign(a.href);
  }, true);
  // window.open(url) with no window size: the same thing from a script
  const open0 = window.open;
  window.open = function (url, name, features) {
    if (url && !features && (!name || name === "_blank") && same(url)) { location.assign(new URL(url, location.href).href); return window; }
    return open0.apply(this, arguments);
  };
})();
