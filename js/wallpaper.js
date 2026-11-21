// Nebulux OS wallpapers: nebulas painted on a canvas (soft color clouds, a glowing swirl, stars), made once per size.
// NX.wallpapers is the list; NX.wallpaperURL(i, w, h) gives a picture for the desktop, lock screen and previews.
"use strict";
(function () {
  NX.wallpapers = [
    { name: "Nebulux Bloom", sky: ["#0b0620", "#1b0b3d"], clouds: ["#ff4fa3", "#7c5cff", "#22d3ee"], ring: "#ffb0ef" },
    { name: "Aurora Drift", sky: ["#03131c", "#062a3a"], clouds: ["#22d3ee", "#34d399", "#7c5cff"], ring: "#a5f3fc" },
    { name: "Solar Flare", sky: ["#160606", "#3a0d12"], clouds: ["#f97316", "#ef4444", "#facc15"], ring: "#fed7aa" },
    { name: "Deep Orbit", sky: ["#02030d", "#0b1030"], clouds: ["#3b82f6", "#6366f1", "#a855f7"], ring: "#c7d2fe" },
    { name: "Rose Quartz", sky: ["#1a0614", "#3d0c2e"], clouds: ["#fb7185", "#f0abfc", "#c084fc"], ring: "#fbcfe8" },
    { name: "Daybreak", sky: ["#bfdcff", "#f5e1ff"], clouds: ["#93c5fd", "#f9a8d4", "#c4b5fd"], ring: "#ffffff", light: true },
  ];
  const cache = {};
  function seeded(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  NX.wallpaperURL = (i, w, h) => {
    w = Math.max(64, Math.round(w || 1920)); h = Math.max(64, Math.round(h || 1080)); i = ((i | 0) % NX.wallpapers.length + NX.wallpapers.length) % NX.wallpapers.length;
    const key = i + ":" + w + "x" + h; if (cache[key]) return cache[key];
    const W = NX.wallpapers[i], c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), rnd = seeded(1000 + i * 77), m = Math.max(w, h);
    let lg = g.createLinearGradient(0, 0, w, h); lg.addColorStop(0, W.sky[0]); lg.addColorStop(1, W.sky[1]); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = W.light ? "source-over" : "lighter";
    // soft color clouds
    for (let k = 0; k < 18; k++) {
      const x = w * (0.15 + rnd() * 0.7), y = h * (0.2 + rnd() * 0.6), r = m * (0.12 + rnd() * 0.28), col = W.clouds[k % 3];
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col + (W.light ? "44" : "24")); rg.addColorStop(1, col + "00"); g.fillStyle = rg; g.fillRect(0, 0, w, h);
    }
    // a glowing swirl through the middle, the Nebulux bloom
    g.save(); g.translate(w * 0.5, h * 0.52); g.rotate(-0.35);
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.ellipse(0, 0, m * (0.34 - k * 0.06), m * (0.09 - k * 0.015), 0, 0, Math.PI * 2);
      g.strokeStyle = W.ring + (k ? "30" : "55"); g.lineWidth = m * (0.006 + k * 0.004); g.shadowColor = W.clouds[k]; g.shadowBlur = m * 0.03; g.stroke();
    }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.11); core.addColorStop(0, "#ffffff" + (W.light ? "88" : "55")); core.addColorStop(0.35, W.clouds[0] + "44"); core.addColorStop(1, W.clouds[0] + "00");
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, m * 0.11, 0, Math.PI * 2); g.fill(); g.restore();
    g.globalCompositeOperation = "source-over"; g.shadowBlur = 0;
    // stars
    if (!W.light) for (let k = 0; k < (w * h) / 2600; k++) { const x = rnd() * w, y = rnd() * h, r = rnd() < 0.96 ? rnd() * 1.1 + 0.2 : rnd() * 2 + 1; g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    // a soft shade at the bottom, under the taskbar
    lg = g.createLinearGradient(0, h * 0.7, 0, h); lg.addColorStop(0, "rgba(0,0,0,0)"); lg.addColorStop(1, W.light ? "rgba(80,60,140,.18)" : "rgba(0,0,0,.35)"); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    let url = ""; try { url = c.toDataURL("image/jpeg", 0.9); } catch (e) { url = ""; }
    return (cache[key] = url);
  };
})();
