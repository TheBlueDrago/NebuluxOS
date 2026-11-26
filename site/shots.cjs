// Takes the website's screenshots of Nebulux OS (run with Edge on --remote-debugging-port=9333, muted).
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1440, H = 900, URL = "file:///" + path.resolve(__dirname, "../index.html").split(path.sep).join("/") + "?fast";
const OUT = process.env.SHOTS_OUT || path.join(__dirname, "public", "shots");
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 });
  const c = await b.createBrowserContext(), p = await c.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: +process.env.DSF || 1 });
  await p.goto(URL, { waitUntil: "load" }); await wait(500);
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "load" }); await wait(600);
  await require("../tests/setup.cjs")(p, "Alex", "nebula1");
  await p.evaluate(() => NX.setPref("wallpaper", 13)); // 4.4: Nebulux Horizon at sunrise, the same in every screenshot
  const shot = async (n) => { await wait(700); await p.screenshot({ path: path.join(OUT, n + ".jpg"), type: "jpeg", quality: +process.env.Q || 86 }); console.log("shot", n); };
  const reset = async () => { await p.evaluate(() => { document.querySelectorAll(".nx-pop").forEach((x) => x.remove()); NX.closeAll(); NX.shell.closeFlyouts(); if (NX.clip) NX.clip.close(); }); await p.mouse.move(700, 450); };
  await p.evaluate(() => { NX.battery = { present: true, percent: 82, charging: false }; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" })); document.querySelectorAll(".toast,#toasts>*").forEach((x) => x.remove()); });
  await wait(4500);
  await shot("desktop");
  await p.click("#tb-start"); await shot("start");
  await p.type("#start .sm-search input", "photos"); await shot("search");
  await p.keyboard.press("Escape"); await reset();
  await p.evaluate(() => NX.open("settings")); await shot("settings");
  await reset(); await p.evaluate(() => NX.open("store")); await shot("store");
  await reset(); await p.evaluate(() => NX.open("files")); await shot("files");
  await reset(); await p.click("#tb-tray"); await shot("quick");
  await p.keyboard.press("Escape"); await reset();
  await p.evaluate(() => { NX.set("seen-whatsnew-" + NX.me.id, "3.0"); NX.update.whatsNew(); }); await shot("whatsnew");
  await reset();
  // 3.2
  await p.evaluate(() => { NX.setData("sticky-notes", [{ id: "a", t: "Groceries\n- milk\n- eggs\n- bread", c: "sun", at: Date.now() }, { id: "b", t: "Call Sam at 5", c: "rose", at: Date.now() - 4e5 }, { id: "c", t: "Science project: planets poster", c: "sky", at: Date.now() - 9e6 }, { id: "d", t: "Wi-Fi password is on the router", c: "mint", at: Date.now() - 9e7 }, { id: "e", t: "Practice piano 20 min", c: "violet", at: Date.now() - 2e8 }]); NX.open("notes"); }); await shot("notes");
  await reset(); await p.evaluate(() => { ["Meet at the library at 4", "https://nebuluxai.com", "Nebulux OS updates itself: Later, Remind me or Never.", "The quick brown fox jumps over the lazy dog"].forEach((t) => NX.clip.add(t)); NX.clip.toggle(); }); await shot("clip");
  await reset(); await p.evaluate(() => { NX.open("files", { place: "Documents" }); }); await wait(500); await p.evaluate(() => { const w = NX.wins.get("files"); w.tabs.add(); }); await wait(500); await p.evaluate(() => { const w = NX.wins.get("files"); w.tabs.to(0); }); await shot("tabs");
  await p.evaluate(() => { NX.open("notes"); NX.open("calculator"); NX.desks.add(true); NX.desks.add(true); NX.desks.rename(NX.desks.list()[1].id, "School"); NX.desks.rename(NX.desks.list()[2].id, "Games"); NX.taskView(); }); await shot("desks");
  await p.evaluate(() => { document.querySelector("#taskview").hidden = true; }); await reset();
  await p.evaluate(() => { NX.open("files"); NX.open("settings"); }); await wait(500);
  await p.evaluate(() => NX.shell.lockKeep()); await wait(600); await shot("lock");
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
