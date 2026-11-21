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

  if (!N) return;
  document.documentElement.classList.add("native");
  // settings changes reach the hardware (a short wait so dragging a slider doesn't flood the system)
  const later = {}; const soon = (k, fn) => { clearTimeout(later[k]); later[k] = setTimeout(fn, 120); };
  let syncing = false;
  document.addEventListener("nx:prefs", (e) => {
    if (!NX.me || syncing) return; const k = e.detail, p = NX.prefs();
    if (k === "volume") soon(k, () => NX.api("POST", "/volume", { volume: p.volume }).catch(() => {}));
    if (k === "brightness" && NX.hw.brightness) soon(k, () => NX.api("POST", "/brightness", { brightness: p.brightness }).catch(() => {}));
    if (k === "wifi") soon(k, () => NX.api("POST", "/wifi/radio", { on: p.wifi }).catch((er) => NX.toast(er.message)));
    if (k === "bt") soon(k, () => NX.api("POST", "/bt/power", { on: p.bt }).catch((er) => NX.toast(er.message)));
  });
  // the real battery (laptops); desktops have none, and the battery icon goes away
  NX.battery = null;
  const battery = () => NX.api("GET", "/battery").then((b) => { NX.battery = b; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" })); }).catch(() => {});
  battery(); setInterval(battery, 60000);
  // at sign-in: your volume goes to the speakers, and the Wi-Fi and Bluetooth switches show the real state
  document.addEventListener("nx:signin", async () => {
    try { const b = await NX.api("GET", "/brightness"); NX.hw.brightness = b.brightness != null; if (NX.hw.brightness) NX.api("POST", "/brightness", { brightness: NX.prefs().brightness }).catch(() => {}); } catch (e) { NX.hw.brightness = false; }
    NX.api("POST", "/volume", { volume: NX.prefs().volume }).catch(() => {});
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
