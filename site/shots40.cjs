// Screenshots of the Nebulux OS 4.0 features for the website (Edge on --remote-debugging-port=9333, muted):
// node site/shots40.cjs   (writes site/public/shots/qsearch.jpg, stage.jpg, widgets.jpg, calendar.jpg, themes.jpg, taskview40.jpg)
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1440, H = 900, URL = "file:///" + path.resolve(__dirname, "../index.html").split(path.sep).join("/") + "?fast";
const OUT = process.env.SHOTS_OUT || path.join(__dirname, "public", "shots");
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 });
  const c = await b.createBrowserContext(), p = await c.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: +process.env.DSF || 1 });
  await p.goto(URL, { waitUntil: "load" }); await wait(500);
  await require("../tests/setup.cjs")(p, "Alex", "nebula1");
  await p.evaluate(() => NX.setPref("wallpaper", 13)); // 4.4: Nebulux Horizon at sunrise
  const shot = async (n) => { await wait(800); await p.screenshot({ path: path.join(OUT, n + ".jpg"), type: "jpeg", quality: +process.env.Q || 86 }); console.log("shot", n); };
  const clean = () => p.evaluate(() => { document.querySelectorAll(".toast,.nx-pop").forEach((x) => x.remove()); NX.closeAll(); NX.shell.closeFlyouts(); });
  await p.evaluate(() => {
    NX.battery = { present: true, percent: 82, charging: false }; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" }));
    const d = new Date(), k = (n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    NX.setData("events", [{ id: "a", date: k(0), time: "16:30", title: "Soccer practice", told: "", color: "#22c55e" }, { id: "b", date: k(1), time: "09:00", title: "Science test", told: "", color: "#f97316" }, { id: "c", date: k(3), time: "", title: "Mia's birthday", told: "", color: "#ec4899" }, { id: "d", date: k(6), time: "18:00", title: "Movie night", told: "", color: "#7c5cff" }, { id: "e", date: k(-2), time: "", title: "Library books due", told: "", color: "#0ea5e9" }]);
    NX.setData("wx-place", { name: "Chicago, Illinois", lat: 41.85, lon: -87.65 }); NX.setData("wx", { key: "Chicago, Illinois", at: Date.now(), unit: "F", now: 41, code: 2, days: [] });
  });
  await wait(4000); await clean();
  // Quick Search
  await p.evaluate(() => NX.quickSearch()); await p.keyboard.type("set"); await shot("qsearch"); await p.keyboard.press("Escape");
  // Calendar
  await p.evaluate(() => NX.open("calendar")); await shot("calendar"); await clean();
  // desktop widgets
  await p.evaluate(() => NX.setPref("deskWidgets", ["clock", "weather", "events", "battery"])); await clean(); await shot("widgets");
  // Stage
  await p.evaluate(() => { NX.setPref("deskWidgets", []); NX.setPref("stage", true); NX.open("notes"); NX.open("calculator"); NX.open("clock"); NX.open("weather"); }); await wait(600); await shot("stage");
  await p.evaluate(() => { NX.setPref("stage", false); }); await clean();
  // Themes in Settings > Personalization
  await p.evaluate(() => NX.open("settings")); await wait(600);
  await p.evaluate(() => { const w = document.querySelector(".win[data-app=settings]"); [...w.querySelectorAll(".s-nav")].find((x) => /Personal/.test(x.textContent)).click(); }); await wait(500);
  await p.evaluate(() => { const t = document.querySelector('.win[data-app=settings] [data-look="1"]'); t.click(); }); await wait(500);
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=settings] .s-themes"); t.scrollIntoView({ block: "start" }); }); await shot("themes");
  await p.evaluate(() => { const t = NX.looks40[0]; NX.setPref("wallpaper", t.wall); NX.setPref("theme", t.theme); NX.setPref("accent", t.accent); NX.setPref("corners40", t.corners); NX.setPref("glass", t.glass); }); await clean();
  // Task View with live window pictures
  await p.evaluate(() => { NX.open("calendar"); NX.open("clock"); NX.open("weather"); NX.open("files"); }); await wait(1200);
  await p.evaluate(() => NX.taskView ? NX.taskView() : document.querySelector("#tb-tview").click()); await wait(900); await shot("taskview40");
  await p.keyboard.press("Escape"); await clean();
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
