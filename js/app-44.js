// Nebulux OS 4.4 apps.
//   Color Picker: pick any color on the screen (Nebulux + Shift + C), see it as HEX, RGB and HSL, copy it, keep the last ones.
"use strict";
(function () {
  const A = NX.apps;
  const hexOk = (h) => /^#[0-9a-f]{6}$/i.test(h);
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hslOf = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  };
  const formats = (h) => { const rgb = rgbOf(h), hsl = hslOf(rgb); return [["HEX", h.toUpperCase()], ["RGB", `rgb(${rgb.join(", ")})`], ["HSL", `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`]]; };
  const copy = (t) => { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); if (NX.clip) NX.clip.add(t); if (NX.native) NX.api("POST", "/clip", { text: t }).catch(() => {}); NX.toast("Copied " + t + "."); };
  // a name a person would use for the color, from its hue and lightness
  const nameOf = (h) => {
    const [hu, s, l] = hslOf(rgbOf(h));
    if (l < 8) return "Black"; if (l > 94) return "White"; if (s < 10) return l < 35 ? "Dark gray" : l > 70 ? "Light gray" : "Gray";
    const n = hu < 12 ? "Red" : hu < 35 ? "Orange" : hu < 60 ? "Yellow" : hu < 85 ? "Lime" : hu < 160 ? "Green" : hu < 190 ? "Teal" : hu < 210 ? "Cyan" : hu < 250 ? "Blue" : hu < 280 ? "Violet" : hu < 320 ? "Purple" : hu < 345 ? "Pink" : "Red";
    return l < 30 ? "Dark " + n.toLowerCase() : l > 72 ? "Light " + n.toLowerCase() : n;
  };
  NX.colorHistory = () => NX.data("colors", []);
  NX.colorKeep = (h) => { if (!hexOk(h)) return; h = h.toLowerCase(); NX.setData("colors", [h, ...NX.colorHistory().filter((x) => x !== h)].slice(0, 16)); document.dispatchEvent(new CustomEvent("nx:color", { detail: h })); };
  // pick from the screen: the browser's eyedropper (the whole screen on the USB, where Nebulux OS fills it)
  NX.colorPick = async () => {
    if (!window.EyeDropper) { NX.toast("Picking colors from the screen needs the Nebulux OS USB or a newer browser."); return null; }
    try { const r = await new window.EyeDropper().open(); if (r && hexOk(r.sRGBHex)) { NX.colorKeep(r.sRGBHex); return r.sRGBHex; } } catch (e) { /* Esc: nothing picked */ }
    return null;
  };
  A.colorpick = { name: "Color Picker", icon: "colorpick", builtIn: true, category: "Utilities", rating: "4.7", size: "1 MB", w: 420, h: 560, minW: 320, minH: 420,
    desc: "Pick any color on your screen and copy it as HEX, RGB or HSL.",
    open(body, win) {
      body.classList.add("cpk");
      let cur = NX.colorHistory()[0] || "#7c5cff";
      const draw = () => {
        const H = NX.colorHistory();
        body.innerHTML = `<div class="cpk-top"><div class="cpk-sw" style="--c:${cur}"></div><div class="cpk-name"><b>${NX.esc(nameOf(cur))}</b><small>${cur.toUpperCase()}</small></div></div>
          <button class="btn primary cpk-pick">${NX.icon("colorpick", 16)}Pick a color from the screen</button>
          <label class="cpk-own">Or type one <input type="color" value="${cur}" aria-label="Choose a color"></label>
          <div class="cpk-fmts">${formats(cur).map(([k, v]) => `<div class="cpk-f"><span>${k}</span><code>${NX.esc(v)}</code><button class="btn sm" data-copy="${NX.esc(v)}" aria-label="Copy ${k}">Copy</button></div>`).join("")}</div>
          <h4>Recent colors</h4><div class="cpk-hist">${H.length ? H.map((h) => `<button class="cpk-dot ${h === cur ? "on" : ""}" style="--c:${h}" data-h="${h}" title="${h.toUpperCase()}" aria-label="${NX.esc(nameOf(h))} ${h.toUpperCase()}"></button>`).join("") : `<p class="cpk-none">Colors you pick show up here.</p>`}</div>
          ${H.length ? `<button class="btn sm cpk-clear">Clear recent colors</button>` : ""}<p class="cpk-tip">Nebulux + Shift + C picks a color any time.</p>`;
        body.querySelector(".cpk-pick").onclick = async () => { const h = await NX.colorPick(); if (h) { cur = h.toLowerCase(); draw(); } };
        body.querySelector(".cpk-own input").onchange = (e) => { cur = e.target.value.toLowerCase(); NX.colorKeep(cur); draw(); };
        body.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
        body.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { cur = b.dataset.h; draw(); }));
        const cl = body.querySelector(".cpk-clear"); if (cl) cl.onclick = () => { NX.setData("colors", []); draw(); };
      };
      const onColor = (e) => { cur = e.detail; draw(); };
      document.addEventListener("nx:color", onColor); win.onclose = () => document.removeEventListener("nx:color", onColor);
      win.colors = { show: (h) => { if (hexOk(h)) { cur = h.toLowerCase(); draw(); } } };
      draw();
    } };
  // Nebulux + Shift + C: pick straight away, copy the HEX, and show it in Color Picker
  const quick = async () => { if (!NX.me) return; const h = await NX.colorPick(); if (!h) return; copy(h.toUpperCase()); NX.open("colorpick"); };
  NX.colorQuick = quick;
  addEventListener("keydown", (e) => { if (e.metaKey && e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === "C" || e.key === "c")) { e.preventDefault(); quick(); } }, true);
  document.addEventListener("nx:key", (e) => { if (e.detail === "color") quick(); });
})();
