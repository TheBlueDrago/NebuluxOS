// Nebulux OS wallpapers: nebula pictures (soft color clouds, a glowing swirl, stars) in img/wall-0.jpg ... wall-16.jpg; 17, Horizon Dynamic, shows 13 to 16 by the time of day and is the default.
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
    // painted by tools/wallgen.html (3.2.4)
    { name: "Silk Waves" },
    { name: "Star Dunes" },
    { name: "Polar Lights" },
    { name: "Morning Haze", light: true },
    { name: "Nebulux Four" }, // made for 4.0
    { name: "Aurora Ribbon" },
    { name: "Pearl Dawn", light: true },
    { name: "Nebulux Horizon" }, // 4.4: sunrise
    { name: "Horizon Day" },
    { name: "Horizon Dusk" },
    { name: "Horizon Night" },
    { name: "Horizon Dynamic", dynamic: true }, // 4.4: changes with the time of day, the default
  ];
  // the dynamic background: sunrise 5 to 8 in the morning, day until 5 in the evening, dusk until 8, then night
  NX.wallNow = () => { const h = new Date().getHours(); return h >= 5 && h < 8 ? 13 : h >= 8 && h < 17 ? 14 : h >= 17 && h < 20 ? 15 : 16; };
  NX.defaultWall = 17;
  let lastPick = NX.wallNow();
  setInterval(() => { const n = NX.wallNow(); if (n === lastPick) return; lastPick = n; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "wallpaper-time" })); }, 60000);
  // each picture's own color, for the 4.0 Aura glass (worked out once from the pictures)
  NX.wallAura = ["#494085", "#21617c", "#a35324", "#2e3578", "#6d3360", "#cdc9f5", "#281b4b", "#321d4f", "#0e373c", "#dddaf3", "#231c44", "#262854", "#f3e0ee", "#2b2163", "#1b2f6b", "#4a1a35", "#151236"];
  // ready-made pictures (painting them at start-up was slow without graphics acceleration); one picture for every size
  // your own picture (Settings > Personalization > Browse photos) is wallpaper "custom", kept for each person
  const own = () => (NX.me && NX.data ? NX.data("wall-custom", null) : null);
  NX.wallpaperURL = (i, ...r) => (i === "custom" ? own() || builtIn(NX.defaultWall) : builtIn(i, ...r));
  const builtIn = (i) => { i = ((i | 0) % NX.wallpapers.length + NX.wallpapers.length) % NX.wallpapers.length; if (NX.wallpapers[i].dynamic) i = NX.wallNow(); return new URL("img/wall-" + i + ".jpg", location.href).href; }; // a full address: CSS would read a short one from the css folder
})();
