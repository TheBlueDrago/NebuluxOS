// Nebulux OS 3.3 apps, end to end in a browser: Camera (photo saved in Pictures, video in Videos), Voice Recorder
// (saved in Music), Weather (a city search, when online), the keyboard shortcut guide and a new background every day.
// Uses a made-up camera and microphone, never the real ones. node tests/apps.cjs (Edge or Chrome on port 9333, muted)
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, "shots"); let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 }); const c = await b.createBrowserContext(), p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  // a made-up camera and microphone (a moving picture and a tone), so the test never uses the real ones
  await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = async (c) => { const tracks = []; if (c.video) { const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d"); let t = 0; setInterval(() => { t++; g.fillStyle = "hsl(" + (t * 3 % 360) + ",70%,45%)"; g.fillRect(0, 0, 640, 360); g.fillStyle = "#fff"; g.font = "bold 60px sans-serif"; g.fillText("Test camera " + t, 40, 200); }, 50); tracks.push(...cv.captureStream(20).getVideoTracks()); } if (c.audio) { const ac = new AudioContext(), o = ac.createOscillator(), d = ac.createMediaStreamDestination(); o.connect(d); o.start(); tracks.push(...d.stream.getAudioTracks()); } return new MediaStream(tracks); }; });
  await p.setViewport({ width: 1366, height: 768 }); await p.goto("file:///C:/NebuluxOS/index.html?fast"); await wait(500);
  await require("C:/NebuluxOS/tests/setup.cjs")(p, "Ada", "nebula1");
  const shot = async (n) => { await wait(600); await p.screenshot({ path: path.join(OUT, "apps-" + n + "-1366.png") }); };
  await p.evaluate(() => { document.querySelectorAll(".toast").forEach((x) => x.remove()); NX.open("camera"); });
  await p.waitForFunction(() => { const v = document.querySelector(".win[data-app=camera] video"); return v && v.videoWidth > 0; }, { timeout: 10000 }).catch(() => {});
  await shot("camera");
  await p.click(".win[data-app=camera] .cam-shoot"); await wait(1500);
  const pics = await p.evaluate(async () => (await NX.fs.list(await NX.folder("Pictures"))).entries.map((e) => e.name).filter((n) => /^Photo/.test(n)));
  ok(pics.length === 1 && await p.evaluate(() => !document.querySelector(".cam-last").hidden), "Camera takes a photo and saves it in Pictures");
  // that photo as the background, from Photos
  await p.click(".win[data-app=camera] .cam-last"); await wait(800);
  await p.evaluate(() => document.querySelector(".win[data-app=photos] .ph-tile").click()); await wait(700);
  await p.evaluate(() => document.querySelector(".win[data-app=photos] .ph-wall").click()); await wait(1500);
  ok(await p.evaluate(() => NX.prefs().wallpaper === "custom" && !!NX.data("wall-custom", null)), "Photos makes a picture your background");
  await p.evaluate(() => { NX.setPref("wallpaper", 0); NX.closeAll(); });
  await shot("camera-after");
  await p.evaluate(() => { NX.closeAll(); NX.open("recorder"); }); await wait(500);
  await p.click(".win[data-app=recorder] .vr-go"); await wait(2500); await shot("recorder-rec"); await p.click(".win[data-app=recorder] .vr-go"); await wait(1500);
  const recs = await p.evaluate(async () => (await NX.fs.list(await NX.folder("Music"))).entries.map((e) => e.name).filter((n) => /^Recording/.test(n)));
  ok(recs.length === 1 && await p.evaluate(() => document.querySelectorAll(".vr-item audio").length === 1), "Voice Recorder records and saves it in Music"); await shot("recorder");
  // a short video
  await p.evaluate(() => { NX.closeAll(); NX.open("camera"); }); await p.waitForFunction(() => { const v = document.querySelector(".win[data-app=camera] video"); return v && v.videoWidth > 0; }, { timeout: 10000 }).catch(() => {});
  await p.click(".win[data-app=camera] [data-mode=video]"); await p.click(".win[data-app=camera] .cam-shoot"); await wait(2200);
  ok(await p.evaluate(() => !document.querySelector(".cam-rec").hidden), "Video mode records, with a timer showing"); await p.click(".win[data-app=camera] .cam-shoot"); await wait(1500);
  ok((await p.evaluate(async () => (await NX.fs.list(await NX.folder("Videos"))).entries.map((e) => e.name))).some((n) => /^Video .*\.webm$/.test(n)), "and the video is saved in Videos");
  await p.evaluate(() => { NX.closeAll(); NX.open("weather"); }); await wait(800); await shot("weather-empty");
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=weather] .wa-find input") && !!document.querySelector("[data-here]")), "Weather asks for a city or your location");
  await p.evaluate(() => { document.querySelector(".wa-find input").value = "Chicago"; document.querySelector(".wa-find").requestSubmit(); });
  const online = await p.waitForFunction(() => document.querySelector(".wa-now"), { timeout: 15000 }).then(() => true).catch(() => false); await shot("weather");
  if (online) ok(await p.evaluate(() => /Chicago/.test(document.querySelector(".wa-head h2").textContent) && document.querySelectorAll(".wa-hours > div").length >= 20 && document.querySelectorAll(".wa-days > div").length === 7), "it shows now, 24 hours and 7 days");
  else console.log("(offline: the forecast part was skipped)");
  if (online) {
    await p.evaluate(() => NX.wxInfo.refresh()); await wait(1500);
    await p.evaluate(() => NX.shell.lockKeep()); await wait(1300); await shot("lock-weather");
    ok(await p.evaluate(() => { const e = document.querySelector("#lk-wx"); return e && !e.hidden && /°/.test(e.textContent); }), "the lock screen shows the weather under the date");
    await p.keyboard.press("Enter"); await wait(400);
    const pw = await p.$("#lock input[type=password]"); if (pw) { await pw.type("nebula1"); await p.keyboard.press("Enter"); }
    await p.waitForFunction(() => !document.querySelector("#desktop").hidden, { timeout: 8000 }).catch(() => {});
  }
  await p.evaluate(() => { NX.closeAll(); NX.shortcuts(); }); await shot("keys");
  ok(await p.evaluate(() => document.querySelectorAll("#nx-keys .nk-row").length >= 18), "Nebulux + / shows the keyboard shortcuts");
  await p.keyboard.press("Escape"); ok(await p.evaluate(() => !document.querySelector("#nx-keys")), "and Escape closes it");
  await p.evaluate(() => { NX.setPref("wallpaper", 0); NX.setPref("dailyWall", true); }); await wait(300);
  ok(await p.evaluate(() => { const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000), pool = NX.wallpapers.map((w, i) => [w, i]).filter(([w]) => !w.light).map(([, i]) => i); return NX.prefs().wallpaper === pool[day % pool.length]; }), "A new background every day picks today's background");
  // Clock: world clocks
  await p.evaluate(() => { NX.closeAll(); NX.open("clock"); }); await wait(700);
  await p.type(".win[data-app=clock] .wc-add input", "Tokyo"); await p.keyboard.press("Enter"); await wait(1300); await shot("worldclock");
  ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=clock] .wc-row"); return !!r && /Tokyo/.test(r.textContent) && /\d/.test(r.querySelector("strong").textContent) && /Today|Tomorrow|Yesterday/.test(r.textContent); }), "Clock shows the time in another city");
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-wcdel]").click()); await wait(1200);
  ok(await p.evaluate(() => !document.querySelector(".win[data-app=clock] .wc-row") && NX.data("world-clocks", []).length === 0), "and removes it");
  await p.evaluate(() => NX.closeAll());
  // Calculator: the unit converter
  await p.evaluate(() => { NX.open("calculator"); }); await wait(600);
  await p.evaluate(() => document.querySelector(".win[data-app=calculator] [data-m=conv]").click()); await wait(300);
  const cv = async (cat, a, ua, ub) => p.evaluate((cat, a, ua, ub) => { const w = document.querySelector(".win[data-app=calculator]"), set = (s, v) => { const e = w.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === "INPUT" ? "input" : "change", { bubbles: true })); };
    set(".cv-cat", cat); set(".cv-a", a); set(".cv-ua", ua); set(".cv-ub", ub); return w.querySelector(".cv-b").textContent; }, cat, a, ua, ub);
  ok(await cv("Length", "1", "Miles", "Kilometers") === "1.609344", "Calculator converts 1 mile to 1.609344 km");
  ok(await cv("Temperature", "100", "Celsius", "Fahrenheit") === "212", "and 100 C to 212 F");
  ok(await cv("Weight", "1", "Kilograms", "Pounds") === "2.204622622", "and 1 kg to 2.204622622 lb");
  await shot("converter"); await p.evaluate(() => NX.closeAll());
  // Media Player: shuffle and repeat
  await p.evaluate(() => { NX.closeAll(); NX.open("media"); }); await wait(700);
  await p.click(".win[data-app=media] [data-mpc=shuffle]"); await p.click(".win[data-app=media] [data-mpc=repeat]"); await p.click(".win[data-app=media] [data-mpc=repeat]"); await wait(200);
  ok(await p.evaluate(() => NX.data("mp-shuffle", false) === true && NX.data("mp-repeat", "off") === "one" && document.querySelector("[data-mpc=repeat]").classList.contains("on") && document.querySelector("[data-mpc=repeat] i").textContent === "1"), "Media Player has Shuffle and Repeat (all, then this one)");
  await shot("media"); await p.evaluate(() => NX.closeAll());
  // the taskbar: drag File Explorer to after YouTube
  const tbr = async (id) => p.evaluate((id) => { const r = document.querySelector(`#tb-apps [data-app="${id}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, id);
  const f0 = await tbr("files"), y0 = await tbr("youtube");
  await p.mouse.move(f0.x, f0.y); await p.mouse.down(); await p.mouse.move(f0.x + 20, f0.y, { steps: 3 }); await p.mouse.move(y0.x + y0.w * .4, f0.y, { steps: 8 }); await p.mouse.up(); await wait(400);
  const order = await p.evaluate(() => NX.prefs().pinned.slice(0, 5).join(","));
  ok(order === "settings,google,youtube,files,store" && await p.evaluate(() => [...document.querySelectorAll("#tb-apps .tb-app")].map((b) => b.dataset.app).slice(0, 5).join(",")) === order && !(await p.evaluate(() => !!document.querySelector(".win[data-app=files]"))), "Dragging a taskbar app moves it (and doesn't open it): " + order);
  // Auto mode: light by day, dark at night
  await p.evaluate(() => { NX.open("settings", { page: "personal" }); }); await wait(700);
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=settings] [data-theme=auto]")][0].click()); await wait(300);
  ok(await p.evaluate(() => { const h = new Date().getHours(), want = h >= 7 && h < 19 ? "light" : "dark"; return NX.prefs().themeAuto === true && NX.prefs().theme === want && document.documentElement.dataset.theme === want; }), "Auto mode picks light by day and dark at night");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=settings] [data-theme=dark]")][0].click()); await wait(300);
  ok(await p.evaluate(() => NX.prefs().themeAuto === false && NX.prefs().theme === "dark"), "and choosing Dark turns Auto off");
  ok(!errs.length, "no page errors " + errs.join(" | "));
  console.log(failed ? failed + " failed" : "all passed"); process.exitCode = failed ? 1 : 0;
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
