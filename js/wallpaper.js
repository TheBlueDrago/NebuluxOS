// Nebulux OS wallpapers: nebula pictures (soft color clouds, a glowing swirl, stars) in img/wall-0.jpg ... wall-10.jpg.
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
  ];
  // each picture's own color, for the 4.0 Aura glass (worked out once from the pictures)
  NX.wallAura = ["#494085", "#21617c", "#a35324", "#2e3578", "#6d3360", "#cdc9f5", "#281b4b", "#321d4f", "#0e373c", "#dddaf3", "#231c44"];
  // ready-made pictures (painting them at start-up was slow without graphics acceleration); one picture for every size
  // your own picture (Settings > Personalization > Browse photos) is wallpaper "custom", kept for each person
  const own = () => (NX.me && NX.data ? NX.data("wall-custom", null) : null);
  NX.wallpaperURL = (i, ...r) => (i === "custom" ? own() || builtIn(0) : builtIn(i, ...r));
  const builtIn = (i) => { i = ((i | 0) % NX.wallpapers.length + NX.wallpapers.length) % NX.wallpapers.length; return new URL("img/wall-" + i + ".jpg", location.href).href; }; // a full address: CSS would read a short one from the css folder
})();
