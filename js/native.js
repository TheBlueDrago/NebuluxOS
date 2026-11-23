// Real-computer mode. When Nebulux OS boots from its USB, the system helper serves these pages and adds NX_NATIVE
// (with this boot's key). Then the OS controls the real hardware: Wi-Fi, Bluetooth, volume, brightness and power, and
// websites open inside OS windows. In a normal browser tab none of this runs, and the OS works as before.
"use strict";
(function () {
  const N = window.NX_NATIVE && typeof window.NX_NATIVE.token === "string" ? window.NX_NATIVE : null;
  NX.native = !!N;
  NX.webFrames = !!N; // websites show inside OS windows (the USB's browser lets them)
  NX.hw = { brightness: false, volume: false };
  NX.api = async (method, path, body) => {
    if (!N) throw new Error("Only on the real Nebulux OS.");
    const r = await fetch("/api" + path, { method, headers: { "x-nx": N.token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || "The system didn't answer.");
    return j;
  };

  // pages shown in OS windows say where they are, and pop-ups come here to open in a Google window
  addEventListener("message", (e) => {
    const d = e.data; if (!d || typeof d !== "object" || typeof d.nx !== "string") return;
    if (d.nx === "open" && e.source === window && typeof d.url === "string" && /^https?:/i.test(d.url)) { if (NX.me && NX.openWeb) NX.openWeb(d.url); return; }
    if (d.nx === "loc" || d.nx === "open") {
      for (const f of document.querySelectorAll("iframe.webview")) if (f.contentWindow === e.source) {
        if (d.nx === "loc" && f._onloc) f._onloc(String(d.url || ""), String(d.title || ""));
        if (d.nx === "open" && NX.me && NX.openWeb && /^https?:/i.test(d.url)) NX.openWeb(d.url);
      }
    }
  });
  // clicking inside a website doesn't reach the OS, so bring its window to the front when focus moves into it
  addEventListener("blur", () => setTimeout(() => {
    const a = document.activeElement; if (!a || a.tagName !== "IFRAME") return;
    const w = a.closest(".win"); if (w && NX.wins.has(w.dataset.app)) NX.focus(w.dataset.app);
    document.dispatchEvent(new CustomEvent("nx:framefocus"));
  }, 0));

  NX.browserOK = false; NX.browserRunning = false; NX.persistent = true;
  if (!N) return;
  addEventListener("load", () => NX.api("POST", "/diag", { stage: "page-ready" }).catch(() => {}));
  NX.api("GET", "/system").then((s) => { NX.persistent = s.persistent !== false && !(N.fake && /[?&]nopersist/.test(location.search)); document.dispatchEvent(new CustomEvent("nx:system")); }).catch(() => {});
  document.documentElement.classList.add("native");
  document.addEventListener("nx:winopen", (e) => NX.api("POST", "/diag", { open: e.detail }).catch(() => {}));
  // ---------- real apps (Flathub) ----------
  let tzDone = false;
  NX.scale = "1"; if (N) NX.api("GET", "/scale").then((r) => { NX.scale = r.scale || "1"; }).catch(() => {});
  NX.nativeInstalled = new Set(); NX.nativeRunning = new Set(); NX.nativeActive = new Set(); NX.nativeOK = false;
  // apps from the web opened as their own apps this session (window class NebuluxApp-<id>)
  NX.webOpened = new Set();
  const webWm = (id) => "nebuluxapp-" + id;
  const nativeMap = () => { const m = {}; for (const [id, a] of Object.entries(NX.apps)) if (a.native && NX.nativeInstalled.has(a.native.flatpak)) m[id] = a.native.wm; for (const id of NX.webOpened) if (!m[id]) m[id] = webWm(id); return m; };
  NX.isNative = (id) => { const a = NX.apps[id]; return !!(a && a.native && NX.nativeInstalled.has(a.native.flatpak)); };
  const nativeState = () => NX.api("GET", "/native").then((r) => { NX.nativeOK = !!r.available; NX.nativeInstalled = new Set(r.installed || []); return r; });
  nativeState().catch(() => {});
  NX.installNative = (id, onTick) => new Promise((done, fail) => {
    const a = NX.apps[id]; NX.api("POST", "/native/install", { app: a.native.flatpak }).catch(fail);
    const t = setInterval(async () => {
      let r; try { r = await nativeState(); } catch (e) { return; }
      const j = (r.jobs || {})[a.native.flatpak] || {};
      if (j.state === "done" || NX.nativeInstalled.has(a.native.flatpak)) { clearInterval(t); done(); }
      else if (j.state === "failed") { clearInterval(t); fail(new Error(j.msg || "The app couldn't be installed.")); }
      else if (onTick) onTick(j);
    }, 1500);
  });
  NX.uninstallNative = (id) => NX.api("POST", "/native/uninstall", { app: NX.apps[id].native.flatpak }).then(nativeState);
  // The launch card: while an app is starting (real apps and web apps can take a few seconds from a USB stick), its logo
  // and "Opening ..." show in the middle of the screen, so a click never looks like it did nothing. It goes away as soon
  // as the app's window is on screen (checked every second), or after 45 seconds.
  const launching = new Map();
  NX.launchCard = (id, wm) => {
    const a = NX.apps[id]; if (!a || launching.has(id)) return;
    let box = document.getElementById("nx-launch"); if (!box) { box = document.createElement("div"); box.id = "nx-launch"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const card = document.createElement("div"); card.className = "nl-card";
    card.innerHTML = `<div class="nl-ico">${NX.icon(a.icon || id, 64)}</div><b>Opening ${NX.esc(a.name)}</b><span class="nl-bar"><i></i></span>`;
    box.appendChild(card);
    const t0 = Date.now(), close = () => { if (!launching.has(id)) return; clearInterval(launching.get(id)); launching.delete(id); card.classList.add("out"); setTimeout(() => card.remove(), 260); };
    launching.set(id, setInterval(async () => {
      if (Date.now() - t0 > 45000) return close();
      try { const r = await NX.api("POST", "/native/running", { apps: { [id]: wm } }); if ((r.running || []).includes(id)) { close(); nativeRunning(); } } catch (e) { /* try again next second */ }
    }, 1000));
    return close;
  };
  NX.openNative = (id) => { const a = NX.apps[id]; if (NX.browserHide) NX.browserHide(); NX.nativeRunning.add(id); NX.shell && NX.shell.taskbar(); const close = NX.launchCard(id, a.native.wm); return NX.api("POST", "/native/open", { app: a.native.flatpak, wm: a.native.wm }).then((r) => { if (r && r.shown && close) close(); return r; }).catch((e) => { if (close) close(); NX.toast(e.message); }); };
  NX.nativeToggle = (id) => { const a = NX.apps[id]; return NX.api("POST", "/native/toggle", { wm: NX.isNative(id) ? a.native.wm : webWm(id) }).then(() => setTimeout(nativeRunning, 300)).catch(() => {}); };
  NX.nativeHideActive = () => { if (NX.nativeActive.size) NX.api("POST", "/native/hide", { apps: nativeMap() }).catch(() => {}); };
  async function nativeRunning() {
    const m = nativeMap(); if (!Object.keys(m).length) { if (NX.nativeRunning.size) { NX.nativeRunning.clear(); NX.shell && NX.shell.taskbar(); } return; }
    try { const r = await NX.api("POST", "/native/running", { apps: m }); const s = new Set(r.running || []), a = new Set(r.active || []); const changed = [...s].join() !== [...NX.nativeRunning].join() || [...a].join() !== [...NX.nativeActive].join(); NX.nativeRunning = s; NX.nativeActive = a; if (changed && NX.shell) NX.shell.taskbar(); } catch (e) { /* next time */ }
  }
  setInterval(() => { if (NX.me) nativeRunning(); }, 3000);

  // Apps from the web (Netflix, Poki, YouTube, Google...) open as their own apps: their own window, no tabs and no
  // address bar. Streaming apps need protected video, so the first one sets that up once (the Google Chrome engine,
  // from Flathub, out of sight: the window is still just "Netflix").
  // (and the cloud gaming services, which only accept Google Chrome)
  const DRM = new Set(["netflix", "disneyplus", "primevideo", "hulu", "max", "crunchyroll", "tubi", "spotify", "applemusic"]);
  NX.webAppOK = false; NX.drmReady = false;
  const webState = () => NX.api("GET", "/webapp").then((r) => { NX.webAppOK = !!r.available; NX.drmReady = !!r.drm; }).catch(() => {});
  webState();
  let drmJob = null;
  NX.webAppOpen = async (id, url) => {
    const a = NX.apps[id]; url = url || a.url || a.browser; if (!url) return;
    const drm = DRM.has(id);
    // the movie player (Google's engine) installs once in the background; the app opens right away and doesn't wait for it
    if (drm && !NX.drmReady && NX.apps.chrome && NX.apps.chrome.native && !drmJob) {
      NX.toast(a.name + " is opening. Its movie player is being set up in the background (a few minutes, only once); then close and open " + a.name + " again to watch.");
      drmJob = NX.installNative("chrome").then(() => { NX.drmReady = true; NX.toast("The movie player is ready. Close and open " + a.name + " again to watch."); }).catch((e) => { NX.toast("The movie player couldn't be set up: " + e.message); }).finally(() => { drmJob = null; });
    }
    NX.webOpened.add(id); NX.nativeRunning.add(id); NX.shell && NX.shell.taskbar();
    const close = NX.launchCard(id, webWm(id));
    try { const r = await NX.api("POST", "/webapp/open", { id, url, drm }); if (r && r.shown && close) close(); } catch (e) { if (close) close(); NX.toast(e.message); }
    setTimeout(nativeRunning, 1500);
  };
  // shortcuts caught by the window manager (so they work over the web browser too) come in here
  try { const es = new EventSource("/api/events?k=" + encodeURIComponent(N.token)); es.onmessage = (e) => { let d = {}; try { d = JSON.parse(e.data); } catch (er) { return; } if (d.key) document.dispatchEvent(new CustomEvent("nx:key", { detail: d.key })); if (d.resumed) document.dispatchEvent(new CustomEvent("nx:resumed", { detail: d.resumed })); }; } catch (e) { /* no event stream */ }
  // the real web browser (on the USB system): Google, YouTube and websites open in it, with tabs and Google sign-in
  NX.browserOpen = (url, app) => { NX.browserShown = true; NX.browserRunning = true; NX.shell && NX.shell.taskbar(); return NX.api("POST", "/browser/open", { url, app: !!app }).catch((e) => NX.toast(e.message)); };
  NX.browserHide = () => { if (!NX.browserRunning || NX.browserShown === false) return; NX.browserShown = false; NX.api("POST", "/browser/hide").catch(() => {}); };
  NX.browserToggle = () => NX.api("POST", "/browser/toggle").then((r) => { NX.browserShown = !!r.shown; NX.browserRunning = !!r.running; NX.shell && NX.shell.taskbar(); }).catch(() => {});
  const browserState = () => NX.api("GET", "/browser").then((b) => { const was = NX.browserRunning; NX.browserOK = !!b.available; NX.browserRunning = !!b.running; if (!b.running) NX.browserShown = false; if (was !== NX.browserRunning && NX.shell) NX.shell.taskbar(); }).catch(() => {});
  browserState(); setInterval(() => { if (NX.me && NX.browserOK) browserState(); }, 3000);
  // a file's own address, for pictures, music and videos (the key rides along, as they can't send headers)
  NX.rawURL = (p, dl) => "/api/files/raw?k=" + encodeURIComponent(N.token) + "&path=" + encodeURIComponent(p) + (dl ? "&dl=1" : "");
  NX.apiUpload = async (dir, name, blob) => {
    const r = await fetch("/api/files/upload?dir=" + encodeURIComponent(dir) + "&name=" + encodeURIComponent(name), { method: "POST", headers: { "x-nx": N.token }, body: blob });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || "The file couldn't be saved."); return j;
  };

  // a TV or monitor plugged in shows the same picture (like Windows), and USB drives open by themselves
  let lastExt = null, knownDrives = null, watching = false;
  let lastSig = null;
  async function watch(force) {
    if (!NX.me || watching) return; watching = true;
    try {
      const { sig } = await NX.api("GET", "/changes");
      if (!force && sig === lastSig) return; lastSig = sig;
      const d = await NX.api("POST", "/display/get", { probe: false });
      const ext = d.ext || null;
      if (lastExt !== null || ext) {
        if (ext && ext !== lastExt && d.mode === "internal") { // your last choice, or the same picture on both (like Windows)
          const m = NX.data("tv-mode", "mirror");
          try { await NX.api("POST", "/display/set", { mode: m }); NX.toast(m === "external" ? "A TV or monitor is connected, and Nebulux OS shows on it only." : "A TV or monitor is connected and shows the same picture. Change it in Settings > System."); } catch (e) { NX.toast(e.message); }
        } else if (ext && ext !== lastExt) NX.toast("A TV or monitor is connected. Choose how to use it in Settings > System.");
        if (!ext && lastExt) { NX.toast("The TV or monitor was unplugged."); NX.api("POST", "/display/set", { mode: "internal" }).catch(() => {}); }
        if (ext !== lastExt) document.dispatchEvent(new CustomEvent("nx:display"));
      }
      lastExt = ext || "";
      const { drives } = await NX.api("GET", "/drives"), ids = drives.map((x) => x.dev);
      if (knownDrives) for (const dr of drives) if (!knownDrives.includes(dr.dev)) {
        try { if (!dr.mount) await NX.api("POST", "/drives/mount", { dev: dr.dev }); NX.toast(dr.label + " is ready. Open it in File Explorer."); } catch (e) { NX.toast(e.message); }
      }
      if (knownDrives && (ids.length !== knownDrives.length || ids.some((x) => !knownDrives.includes(x)))) document.dispatchEvent(new CustomEvent("nx:drives"));
      knownDrives = ids;
    } catch (e) { /* the system will answer next time */ } finally { watching = false; }
  }
  setInterval(watch, 3000);
  document.addEventListener("nx:signin", () => { lastExt = null; knownDrives = null; lastSig = null; watch(true);
    setTimeout(() => NX.api("POST", "/diag", { ext: document.documentElement.hasAttribute("data-nxext"), w: innerWidth, h: innerHeight }).catch(() => {}), 2500);
    if (!document.documentElement.hasAttribute("data-nxext") && !N.fake) setTimeout(() => { if (!document.documentElement.hasAttribute("data-nxext")) { console.error("Nebulux OS: the web windows extension isn't running"); NX.toast("Web windows aren't fully ready: links that open new tabs may not work. Restart to fix it."); } }, 4000);
  });
  // settings changes reach the hardware (a short wait so dragging a slider doesn't flood the system)
  const later = {}; const soon = (k, fn) => { clearTimeout(later[k]); later[k] = setTimeout(fn, 120); };
  let syncing = false;
  document.addEventListener("nx:prefs", (e) => {
    if (!NX.me || syncing) return; const k = e.detail, p = NX.prefs();
    if (k === "mouse") soon(k, () => NX.api("POST", "/mouse", { speed: p.mouse }).catch(() => {}));
    if (k === "tzAuto" && p.tzAuto !== false) NX.api("POST", "/timezone", { detect: true }).then((r) => NX.toast("Time zone: " + String(r.zone).replace(/_/g, " ") + ".")).catch((e) => NX.toast(e.message));
    if (k === "tpTap" || k === "tpNatural") soon("touchpad", () => NX.api("POST", "/touchpad", { tap: p.tpTap !== false, natural: p.tpNatural !== false }).catch(() => {}));
    if (k === "volume") soon(k, () => NX.api("POST", "/volume", { volume: p.volume }).catch(() => {}));
    if (k === "brightness" && NX.hw.brightness) soon(k, () => NX.api("POST", "/brightness", { brightness: p.brightness }).catch(() => {}));
    if (k === "wifi") soon(k, () => NX.api("POST", "/wifi/radio", { on: p.wifi }).catch((er) => NX.toast(er.message)));
    if (k === "bt") soon(k, () => NX.api("POST", "/bt/power", { on: p.bt }).catch((er) => NX.toast(er.message)));
  });
  // the real battery (laptops); desktops have none, and the battery icon goes away
  NX.battery = null;
  const battery = () => NX.api("GET", "/battery").then((b) => { NX.battery = b; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" })); }).catch(() => {});
  const told = () => document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" }));
  if (N) { battery(); setInterval(battery, 30000); }
  else if (navigator.getBattery) navigator.getBattery().then((b) => {
    const read = () => { const t = b.charging ? b.chargingTime : b.dischargingTime; NX.battery = { present: true, percent: Math.round(b.level * 100), charging: b.charging, minutes: isFinite(t) && t > 0 ? Math.round(t / 60) : 0 }; told(); };
    read();
    ["levelchange", "chargingchange", "dischargingtimechange", "chargingtimechange"].forEach((ev) => b.addEventListener(ev, read));
  }).catch(() => {});
  // at sign-in: your volume goes to the speakers, and the Wi-Fi and Bluetooth switches show the real state
  document.addEventListener("nx:signin", async () => {
    try { const b = await NX.api("GET", "/brightness"); NX.hw.brightness = b.brightness != null; if (NX.hw.brightness) NX.api("POST", "/brightness", { brightness: NX.prefs().brightness }).catch(() => {}); } catch (e) { NX.hw.brightness = false; }
    NX.api("POST", "/volume", { volume: NX.prefs().volume }).catch(() => {});
    if (NX.prefs().keyboard) NX.api("POST", "/keyboard", { layout: NX.prefs().keyboard }).catch(() => {});
    // the time zone, looked up once each start when Set time zone automatically is on
    if (NX.prefs().tzAuto !== false && !tzDone) { tzDone = true; setTimeout(() => NX.api("POST", "/timezone", { detect: true }).catch(() => { tzDone = false; }), 3000); }
    NX.api("POST", "/mouse", { speed: NX.prefs().mouse }).catch(() => {});
    NX.api("POST", "/touchpad", { tap: NX.prefs().tpTap !== false, natural: NX.prefs().tpNatural !== false }).catch(() => {});
    try {
      const [w, b] = await Promise.all([NX.api("GET", "/wifi").catch(() => null), NX.api("GET", "/bt").catch(() => null)]);
      syncing = true;
      if (w && w.device) NX.setPref("wifi", !!w.on);
      if (b && b.available) NX.setPref("bt", !!b.on);
      if ((w && w.on) || (b && b.on)) NX.setPref("airplane", false);
    } finally { syncing = false; }
    document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "brightness" }));
  });
})();
