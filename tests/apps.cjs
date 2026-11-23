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
  await p.evaluate(() => { NX.closeAll(); NX.shortcuts(); }); await shot("keys");
  ok(await p.evaluate(() => document.querySelectorAll("#nx-keys .nk-row").length >= 18), "Nebulux + / shows the keyboard shortcuts");
  await p.keyboard.press("Escape"); ok(await p.evaluate(() => !document.querySelector("#nx-keys")), "and Escape closes it");
  await p.evaluate(() => { NX.setPref("wallpaper", 0); NX.setPref("dailyWall", true); }); await wait(300);
  ok(await p.evaluate(() => { const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000), pool = NX.wallpapers.map((w, i) => [w, i]).filter(([w]) => !w.light).map(([, i]) => i); return NX.prefs().wallpaper === pool[day % pool.length]; }), "A new background every day picks today's background");
  ok(!errs.length, "no page errors " + errs.join(" | "));
  console.log(failed ? failed + " failed" : "all passed"); process.exitCode = failed ? 1 : 0;
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
