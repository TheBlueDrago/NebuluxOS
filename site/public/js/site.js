// The Nebulux OS website: the phone menu, things rising into view, the screenshot tabs, and the newest release.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  // the menu on phones
  const menu = $(".menu"), links = $(".links");
  if (menu && links) menu.onclick = () => { const open = links.classList.toggle("open"); menu.setAttribute("aria-expanded", open ? "true" : "false"); };

  // rise into view while scrolling
  const rise = $$(".rise");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    rise.forEach((el) => io.observe(el));
  } else rise.forEach((el) => el.classList.add("in"));

  // the big screenshot on the home page lies flat as you scroll to it
  const dev = $("#hero-device");
  if (dev) { const f = () => dev.classList.toggle("flat", scrollY > 80); addEventListener("scroll", f, { passive: true }); f(); }

  // the screenshot tabs
  const gal = $("#gal");
  if (gal) {
    $$("[data-shot]").forEach((b) => (b.onclick = () => {
      $$("[data-shot]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      gal.style.opacity = ".2";
      const img = new Image(); img.onload = () => { gal.src = img.src; gal.alt = "Nebulux OS: " + b.textContent; gal.style.opacity = "1"; }; img.src = "/shots/" + b.dataset.shot + ".jpg";
    }));
    ["desktop", "settings", "files", "quick", "lock"].forEach((n) => { const i = new Image(); i.loading = "lazy"; i.src = "/shots/" + n + ".jpg"; });
  }

  // the newest release (version, size, fingerprint), straight from where the downloads are
  if ($("[data-rel]")) fetch("/api/release", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((rel) => {
    if (!rel || !rel.version) return;
    const val = { version: rel.version, file: rel.file, size: (rel.size / 1e9).toFixed(1) + " GB", sha: rel.sha256 };
    $$("[data-rel]").forEach((el) => { const v = val[el.dataset.rel]; if (v) el.textContent = v; });
  }).catch(() => {});

  // the Download button says what's happening
  const go = $("#dl-go"), msg = $("#dl-msg");
  if (go && msg) go.addEventListener("click", () => { msg.textContent = "Your download is starting. It's about 1.3 GB."; });
})();
