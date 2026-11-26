// Nebulux OS 3.3 apps, end to end in a browser: Camera (photo saved in Pictures, video in Videos), Voice Recorder
// (saved in Music), Weather (a city search, when online), the keyboard shortcut guide and a new background every day.
// Uses a made-up camera and microphone, never the real ones. node tests/apps.cjs (Edge or Chrome on port 9333, muted)
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(__dirname, "shots"), W = +process.argv[2] || 1366, H = +process.argv[3] || 768; let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 }); const c = await b.createBrowserContext(), p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/status of (429|50\d)/.test(m.text())) errs.push("console: " + m.text()); }); // (a busy weather service isn't a Nebulux OS error)
  // a made-up camera and microphone (a moving picture and a tone), so the test never uses the real ones
  await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getDisplayMedia = async () => { const cv = document.createElement("canvas"); cv.width = 800; cv.height = 450; const g = cv.getContext("2d"); g.fillStyle = "#334"; g.fillRect(0, 0, 800, 450); g.fillStyle = "#fff"; g.font = "bold 40px sans-serif"; g.fillText("Test screen", 40, 100); setInterval(() => g.fillRect(0, 0, 1, 1), 50); return cv.captureStream(10); }; });
  await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = async (c) => { const tracks = []; if (c.video) { const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d"); let t = 0; setInterval(() => { t++; g.fillStyle = "hsl(" + (t * 3 % 360) + ",70%,45%)"; g.fillRect(0, 0, 640, 360); g.fillStyle = "#fff"; g.font = "bold 60px sans-serif"; g.fillText("Test camera " + t, 40, 200); }, 50); tracks.push(...cv.captureStream(20).getVideoTracks()); } if (c.audio) { const ac = new AudioContext(), o = ac.createOscillator(), d = ac.createMediaStreamDestination(); o.connect(d); o.start(); tracks.push(...d.stream.getAudioTracks()); } return new MediaStream(tracks); }; });
  await p.setViewport({ width: W, height: H }); await p.goto("file:///C:/NebuluxOS/index.html?fast"); await wait(500);
  await require("C:/NebuluxOS/tests/setup.cjs")(p, "Ada", "nebula1");
  const shot = async (n) => { await wait(600); await p.screenshot({ path: path.join(OUT, "apps-" + n + "-" + W + ".png") }); };
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
  // Favorites
  await p.evaluate(() => document.querySelector(".win[data-app=photos] [data-p=fav]").click()); await wait(200);
  ok(await p.evaluate(() => NX.data("photo-favs", []).length === 1 && document.querySelector(".win[data-app=photos] .ph-fav").classList.contains("on")), "Photos: the heart makes a picture a favorite");
  // and Edit: a look, brighter, saved as a copy
  await p.evaluate(() => document.querySelector(".win[data-app=photos] [data-p=edit]").click()); await wait(300);
  await p.evaluate(() => { const r = document.querySelector(".ph-ed [data-ed=b]"); r.value = 130; r.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector(".ph-ed [data-look=bw]").click(); });
  ok(await p.evaluate(() => /grayscale\(1\)/.test(document.querySelector(".win[data-app=photos] .ph-view img").style.filter) && /brightness\(1\.3\)/.test(document.querySelector(".win[data-app=photos] .ph-view img").style.filter)), "Photos > Edit shows the changes right away");
  await shot("photos-edit");
  // Crop: keep the middle half
  const nat = await p.evaluate(() => { const i = document.querySelector(".win[data-app=photos] .ph-view img"); return [i.naturalWidth, i.naturalHeight]; });
  await p.evaluate(() => document.querySelector(".ph-ed [data-ed2=crop]").click());
  const ib = await p.evaluate(() => { const r = document.querySelector(".win[data-app=photos] .ph-view img").getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await p.mouse.move(ib[0] + ib[2] * .25, ib[1] + ib[3] * .25); await p.mouse.down(); await p.mouse.move(ib[0] + ib[2] * .75, ib[1] + ib[3] * .75, { steps: 6 }); await p.mouse.up(); await wait(200);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=photos] .ph-cbox")), "Photos > Edit > Crop shows the part you keep");
  await shot("photos-crop");
  await p.evaluate(() => document.querySelector(".ph-ed [data-ed2=save]").click()); await wait(1500);
  ok((await p.evaluate(async () => (await NX.fs.list(await NX.folder("Pictures"))).entries.map((e) => e.name))).some((n) => /\(edited\)\.jpg$/.test(n)) && await p.evaluate(() => !document.querySelector(".ph-ed")), "and saves the edited picture as a copy");
  const cropped = await p.evaluate(() => { const i = document.querySelector(".win[data-app=photos] .ph-view img"); return [i.naturalWidth, i.naturalHeight]; });
  ok(Math.abs(cropped[0] - nat[0] / 2) <= 3 && Math.abs(cropped[1] - nat[1] / 2) <= 3, "cropped to just that part (" + cropped.join("x") + " from " + nat.join("x") + ")");
  await p.evaluate(() => document.querySelector(".win[data-app=photos] [data-p=all]").click()); await wait(600);
  await p.evaluate(() => document.querySelector(".win[data-app=photos] [data-p=favs]").click()); await wait(600);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=photos] .ph-tile").length === 1 && !!document.querySelector(".win[data-app=photos] .ph-tile .ph-heart")), "and Favorites shows only those");
  await p.evaluate(() => { NX.setData("photo-favs", []); NX.setPref("wallpaper", 0); NX.closeAll(); });
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
  // saved cities
  await p.evaluate(() => document.querySelector(".win[data-app=weather] [data-star]").click()); await wait(400);
  ok(await p.evaluate(() => NX.data("wx-cities", []).some((c) => /Chicago/.test(c.name)) && /Chicago/.test(document.querySelector(".win[data-app=weather] .wa-cities").textContent)), "Weather saves a city to come back to");
  await p.evaluate(() => NX.setData("wx-cities", []));
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
  // Clock: a countdown to a day 10 days from now
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-v=cd]").click()); await wait(300);
  await p.evaluate(() => { const f = document.querySelector(".win[data-app=clock] .cd-new"), d = new Date(); d.setDate(d.getDate() + 10); f.n.value = "Trip"; f.d.value = d.toLocaleDateString("en-CA"); f.requestSubmit(); }); await wait(300);
  ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=clock] .cd-row"); return !!r && r.querySelector(".cd-n").textContent === "10" && /Trip/.test(r.textContent) && /days to go/.test(r.textContent); }), "Clock counts down the days to something: 10 days to go");
  await shot("countdown");
  await p.evaluate(() => { NX.setData("countdowns", []); NX.closeAll(); });
  // Calculator: the unit converter
  await p.evaluate(() => { NX.open("calculator"); }); await wait(600);
  await p.evaluate(() => document.querySelector(".win[data-app=calculator] [data-m=conv]").click()); await wait(300);
  const cv = async (cat, a, ua, ub) => p.evaluate((cat, a, ua, ub) => { const w = document.querySelector(".win[data-app=calculator]"), set = (s, v) => { const e = w.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === "INPUT" ? "input" : "change", { bubbles: true })); };
    set(".cv-cat", cat); set(".cv-a", a); set(".cv-ua", ua); set(".cv-ub", ub); return w.querySelector(".cv-b").textContent; }, cat, a, ua, ub);
  ok(await cv("Length", "1", "Miles", "Kilometers") === "1.609344", "Calculator converts 1 mile to 1.609344 km");
  ok(await cv("Temperature", "100", "Celsius", "Fahrenheit") === "212", "and 100 C to 212 F");
  ok(await cv("Weight", "1", "Kilograms", "Pounds") === "2.204622622", "and 1 kg to 2.204622622 lb");
  await shot("converter");
  // Scientific
  await p.evaluate(() => document.querySelector(".win[data-app=calculator] [data-m=sci]").click()); await wait(200);
  const sciR = await p.evaluate(() => { const E = (x) => { try { return NX.calcEval(x, true); } catch (e) { return "err"; } }; return [E("2^10"), +E("sin(30)").toFixed(9), +E("log(100)+ln(e)").toFixed(9), E("3!"), E("2(3+4)"), +E("sqrt(16)*π").toFixed(6), E("1/0"), E("2+*3"), E("-2^2"), E("10%"), +E("cos(60)").toFixed(9), E("(1+2")]; });
  ok(JSON.stringify(sciR) === JSON.stringify([1024, 0.5, 3, 6, 14, 12.566371, null, "err", -4, 0.1, 0.5, "err"]), "Scientific works out 2^10, sin(30), log, ln, 3!, brackets and pi: " + JSON.stringify(sciR));
  for (const k of ["2", "x^y", "8", "="]) await p.evaluate((k) => [...document.querySelectorAll(".win[data-app=calculator] .sc-keys button")].find((b) => b.textContent === k).click(), k);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=calculator] .sc-out").textContent === "256"), "and its buttons work: 2 ^ 8 = 256");
  await shot("scientific"); await p.evaluate(() => NX.closeAll());
  // Snipping Tool: draw on a screenshot
  await p.evaluate(() => { NX.closeAll(); NX.open("snip"); }); await wait(500);
  await p.click(".win[data-app=snip] [data-s]"); await p.waitForFunction(() => { const i = document.querySelector(".win[data-app=snip] .sn-view img"); return i && i.naturalWidth > 0; }, { timeout: 10000 }).catch(() => {});
  await p.evaluate(() => { NX.focus("snip"); document.querySelector(".win[data-app=snip] [data-o=draw]").click(); }); await wait(300);
  await p.evaluate(() => { const w = NX.wins.get("snip"); w.snipInk.line(20, 20, 200, 120); }); await shot("snip-draw");
  await p.evaluate(() => document.querySelector(".win[data-app=snip] [data-d=save]").click()); await wait(1500);
  const snipNames = await p.evaluate(async () => (await NX.fs.list(await NX.folder("Pictures"))).entries.map((e) => e.name).join(", "));
  ok(/\(drawing\)\.png/.test(snipNames), "Snipping Tool draws on a screenshot and saves it as a copy");
  await p.evaluate(() => NX.closeAll());
  // Media Player: shuffle and repeat
  await p.evaluate(() => { NX.closeAll(); NX.open("media"); }); await wait(700);
  await p.click(".win[data-app=media] [data-mpc=shuffle]"); await p.click(".win[data-app=media] [data-mpc=repeat]"); await p.click(".win[data-app=media] [data-mpc=repeat]"); await wait(200);
  ok(await p.evaluate(() => NX.data("mp-shuffle", false) === true && NX.data("mp-repeat", "off") === "one" && document.querySelector("[data-mpc=repeat]").classList.contains("on") && document.querySelector("[data-mpc=repeat] i").textContent === "1"), "Media Player has Shuffle and Repeat (all, then this one)");
  await shot("media");
  await p.evaluate(() => { NX.setData("mp-shuffle", false); NX.setData("mp-repeat", "off"); const b = [...document.querySelectorAll(".win[data-app=media] .mp-item")].find((x) => /Recording/.test(x.textContent)); b && b.click(); }); await wait(1200);
  ok(await p.evaluate(() => { const a = document.querySelector(".win[data-app=media] .mp-music"); return !!a && a.querySelectorAll(".mp-bars i").length === 28 && (a.classList.contains("playing") || document.querySelector(".win[data-app=media] video, .win[data-app=media] audio").paused); }), "a song shows dancing bars while it plays");
  await shot("media-song");
  await p.evaluate(() => { const m = document.querySelector(".win[data-app=media] video, .win[data-app=media] audio"); m.muted = true; m.play().catch(() => {}); document.querySelector(".win[data-app=media] .mp-stage").focus(); }); await wait(300);
  await p.keyboard.press("Space"); await wait(300);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=media] video, .win[data-app=media] audio").paused), "Space pauses Media Player");
  await p.evaluate(() => { const m = document.querySelector(".win[data-app=media] video, .win[data-app=media] audio"); if (m) { m.loop = true; m.muted = true; m.play().catch(() => {}); } NX.shell.lockKeep(); }); await wait(1600); await shot("lock-np");
  await p.waitForFunction(() => { const n = document.querySelector("#lk-np"); return !!n && /Recording/.test(n.textContent); }, { timeout: 4000 }).catch(() => {});
  ok(await p.evaluate(() => { const n = document.querySelector("#lk-np"); return !!n && /Recording/.test(n.textContent); }), "the lock screen shows what's playing");
  await p.evaluate(() => document.querySelector("#lk-np [data-lknp=play]").click()); await wait(300);
  ok(await p.evaluate(() => !NX.nowPlaying() || NX.nowPlaying().playing === false || document.querySelector(".win[data-app=media] video, .win[data-app=media] audio").paused), "and its pause button pauses it");
  await p.keyboard.press("Enter"); await wait(600); { const pw = await p.$("#lock input[type=password]"); if (pw) { await pw.type("nebula1"); await p.keyboard.press("Enter"); } } await p.waitForFunction(() => document.querySelector("#lock").hidden, { timeout: 8000 }).catch(() => {}); await wait(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll(".win[data-app=media] .mp-item")].find((x) => /Video/.test(x.textContent)); if (b) b.click(); }); await wait(800);
  ok(await p.evaluate(() => !document.pictureInPictureEnabled || !!document.querySelector(".win[data-app=media] .mp-pip")), "a video in Media Player has Picture in picture");
  await p.evaluate(() => { const m = document.querySelector(".win[data-app=media] video"); if (m) m.muted = true; document.querySelector("#tb-tray").click(); }); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector("#qs .qs-np") && /Video/.test(document.querySelector("#qs .qs-np").textContent)), "quick settings shows what's playing, with play and pause");
  await p.evaluate(() => NX.shell.closeFlyouts());
  await p.evaluate(() => NX.closeAll());
  // the taskbar: drag File Explorer to after YouTube
  const tbr = async (id) => p.evaluate((id) => { const r = document.querySelector(`#tb-apps [data-app="${id}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, id);
  const f0 = await tbr("files"), y0 = await tbr("youtube");
  await p.mouse.move(f0.x, f0.y); await p.mouse.down(); await p.mouse.move(f0.x + 20, f0.y, { steps: 3 }); await p.mouse.move(y0.x + y0.w * .4, f0.y, { steps: 8 }); await p.mouse.up(); await wait(400);
  const order = await p.evaluate(() => NX.prefs().pinned.slice(0, 5).join(","));
  ok(order === "settings,google,youtube,files,store" && await p.evaluate(() => [...document.querySelectorAll("#tb-apps .tb-app")].map((b) => b.dataset.app).slice(0, 5).join(",")) === order && !(await p.evaluate(() => !!document.querySelector(".win[data-app=files]"))), "Dragging a taskbar app moves it (and doesn't open it): " + order);
  // File Explorer: color tags
  await p.evaluate(() => { NX.closeAll(); NX.open("files", { place: "Pictures" }); }); await wait(900);
  const fx0 = await p.evaluate(() => { const b = document.querySelector(".win[data-app=files] .fx-item"), r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, b.title]; });
  await p.mouse.click(fx0[0], fx0[1], { button: "right" }); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Tag with a color/.test(b.textContent)).click()); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => b.textContent === "Green").click()); await wait(400);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=files] .fx-item .fx-tag") && [...document.querySelectorAll(".win[data-app=files] .fx-side .fx-place")].some((b) => /Green/.test(b.textContent))), "File Explorer: a file gets a color tag, and Tags shows in the sidebar");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-side .fx-place")].find((b) => /Green/.test(b.textContent)).click()); await wait(500);
  ok(await p.evaluate((n) => { const it = [...document.querySelectorAll(".win[data-app=files] .fx-item")]; return it.length === 1 && it[0].title === n && /Green tag/.test(document.querySelector(".win[data-app=files] .wt-name").textContent); }, fx0[2]), "and the Green tag lists just that file");
  await shot("tags");
  await p.mouse.click(fx0[0] + 0, fx0[1], { button: "right" }); await wait(200);
  await p.evaluate(() => { const b = [...document.querySelectorAll("#ctx button")].find((x) => x.textContent === "Properties"); if (b) b.click(); }); await wait(300);
  ok(await p.evaluate(() => { const d = document.querySelector(".fx-props"); return !!d && /Type/.test(d.textContent) && /Size/.test(d.textContent) && /Green/.test(d.textContent); }), "Properties shows a file's type, size and tag");
  await p.evaluate(() => { const d = document.querySelector(".fx-props"); if (d) d.remove(); NX.setData("file-tags", {}); });
  // File Explorer: Recent
  await p.evaluate(() => { NX.closeAll(); NX.setData("recent-files", [{ name: "Trip plan.txt", path: "/Documents/Trip plan.txt", kind: "text", at: Date.now() }]); NX.open("files"); }); await wait(800);
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-side .fx-place")].find((b) => /Recent/.test(b.textContent)).click()); await wait(500);
  ok(await p.evaluate(() => { const it = [...document.querySelectorAll(".win[data-app=files] .fx-item")]; return it.length === 1 && it[0].title === "Trip plan.txt" && /Recent/.test(document.querySelector(".win[data-app=files] .wt-name").textContent); }), "File Explorer: Recent shows the files you opened lately");
  await p.evaluate(() => { NX.setData("recent-files", []); NX.closeAll(); });
  // File Explorer: sorting
  await p.evaluate(() => { NX.closeAll(); NX.open("files", { place: "Pictures" }); }); await wait(900);
  await p.evaluate(() => document.querySelector(".win[data-app=files] [data-t=sort]").click()); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /^Size/.test(b.textContent)).click()); await wait(400);
  const sizes = await p.evaluate(async () => { const names = [...document.querySelectorAll(".win[data-app=files] .fx-item")].map((b) => b.title), all = (await NX.fs.list(await NX.folder("Pictures"))).entries; return names.map((n) => (all.find((e) => e.name === n) || {}).size || 0); });
  ok(sizes.length >= 2 && sizes.every((s, i) => !i || sizes[i - 1] >= s) && /Size/.test(await p.evaluate(() => document.querySelector(".win[data-app=files] [data-t=sort]").textContent)), "File Explorer sorts by size, largest first");
  await p.evaluate(() => NX.setData("fx-sort", { k: "name", d: 1 }));
  // Paint: a box and a fill
  await p.evaluate(() => { NX.closeAll(); NX.open("paint"); }); await wait(700);
  const cvb = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] canvas").getBoundingClientRect(); return [r.x, r.y]; });
  await p.evaluate(() => document.querySelector(".win[data-app=paint] [data-t=rect]").click());
  await p.mouse.move(cvb[0] + 40, cvb[1] + 40); await p.mouse.down(); await p.mouse.move(cvb[0] + 160, cvb[1] + 120, { steps: 6 }); await p.mouse.up(); await wait(200);
  ok(await p.evaluate(() => { const px = NX.wins.get("paint").paintTest.pixel(40, 80); return px[0] < 200 || px[2] < 200; }), "Paint draws a box");
  await p.evaluate(() => { const t = NX.wins.get("paint").paintTest; t.setCol("#22c55e"); t.fillAt(100, 80); });
  ok(await p.evaluate(() => { const t = NX.wins.get("paint").paintTest, inside = t.pixel(100, 80), outside = t.pixel(300, 200); return inside[1] > 150 && inside[0] < 80 && outside.join() === "255,255,255"; }), "and Fill pours color inside it, not outside");
  await shot("paint");
  // Notepad: line and column, word wrap
  await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); }); await wait(500);
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=notepad] textarea"); t.value = ""; t.focus(); }); await p.keyboard.type("ab"); await p.keyboard.press("Enter"); await p.keyboard.type("cd");
  ok(await p.evaluate(() => document.querySelector(".win[data-app=notepad] .np-pos").textContent === "Ln 2, Col 3"), "Notepad shows the line and column");
  await p.click(".win[data-app=notepad] [data-a=wrap]");
  ok(await p.evaluate(() => document.querySelector(".win[data-app=notepad] textarea").wrap === "off" && NX.data("np-wrap", true) === false), "and Word wrap turns off (and stays off)");
  await p.click(".win[data-app=notepad] [data-a=wrap]");
  // Notepad Versions: keep a version, change the text, go back
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=notepad] textarea"); t.value = "First draft"; t.dispatchEvent(new Event("input")); NX.wins.get("notepad").npKeep(true); t.value = "Second draft"; t.dispatchEvent(new Event("input")); }); await wait(600);
  await p.evaluate(() => document.querySelector(".win[data-app=notepad] [data-a=ver]").click()); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /First draft/.test(b.textContent)).click()); await wait(600);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=notepad] textarea").value === "First draft" && (NX.data("np-versions", {})[Object.keys(NX.data("np-versions", {}))[0]] || []).some((v) => v.t === "Second draft")), "Notepad Versions goes back to an earlier version, keeping the newer one");
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=notepad] textarea"); t.value = "ab\ncd"; t.dispatchEvent(new Event("input")); NX.setData("np-versions", {}); }); await wait(600);
  // Notepad tabs: a second note, named from its first line, and switching keeps each one
  await p.click(".win[data-app=notepad] .np-tadd"); await wait(300); await p.keyboard.type("Shopping list"); await wait(700);
  const tabsNow = await p.evaluate(() => NX.wins.get("notepad").np2.tabs());
  ok(tabsNow.length === 2 && tabsNow[1].on && tabsNow[1].name === "Shopping list", "Notepad tabs: a new tab is named from its first line");
  await p.evaluate(() => document.querySelector(".win[data-app=notepad] [data-ti='0']").click()); await wait(400);
  ok(await p.evaluate(() => /^ab\ncd$/.test(document.querySelector(".win[data-app=notepad] textarea").value)), "and switching back shows the first note");
  await shot("notepad-tabs");
  await p.evaluate(() => document.querySelector(".win[data-app=notepad] [data-tx='1']").click()); await wait(400);
  ok(await p.evaluate(() => NX.wins.get("notepad").np2.tabs().length === 1), "and a tab closes with its x");
  // Alt + F4 closes the window you're using
  await p.evaluate(() => { NX.closeAll(); NX.open("clock"); NX.open("weather"); }); await wait(500);
  await p.keyboard.down("Alt"); await p.keyboard.press("F4"); await p.keyboard.up("Alt"); await wait(400);
  ok(await p.evaluate(() => !NX.wins.has("weather") && NX.wins.has("clock")), "Alt + F4 closes the window you're using");
  // Keep on top (right-click a title bar)
  await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); NX.open("clock"); }); await wait(600);
  const tbN = await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad] .wt-name").getBoundingClientRect(); return [r.x + 10, r.y + r.height / 2]; });
  await p.evaluate(() => NX.focus("notepad")); await p.mouse.click(tbN[0], tbN[1], { button: "right" }); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Keep on top/.test(b.textContent)).click()); await wait(200);
  await p.evaluate(() => NX.focus("clock")); await wait(200);
  ok(await p.evaluate(() => +getComputedStyle(document.querySelector(".win[data-app=notepad]")).zIndex > +getComputedStyle(document.querySelector(".win[data-app=clock]")).zIndex), "Keep on top keeps a window above the others");
  await p.evaluate(() => NX.closeAll());
  // Sticky Notes on the desktop
  await p.evaluate(() => { NX.closeAll(); NX.open("notes"); }); await wait(500);
  await p.click(".win[data-app=notes] [data-a=new]"); await wait(200); await p.keyboard.type("Call grandma"); await wait(500);
  await p.evaluate(() => document.querySelector(".win[data-app=notes] .stn-pin").click()); await wait(900);
  ok(await p.evaluate(() => { const d = document.querySelector("#nx-dnotes .dn-note textarea"); return !!d && d.value === "Call grandma"; }), "a sticky note can be pinned to the desktop");
  await p.evaluate(() => NX.closeAll()); await wait(300);
  await p.evaluate(() => { const d = document.querySelector("#nx-dnotes .dn-note textarea"); d.focus(); d.value += " at 6"; d.dispatchEvent(new Event("input")); }); await wait(600);
  ok(await p.evaluate(() => NX.data("sticky-notes", []).some((n) => n.t === "Call grandma at 6" && n.pin)), "it stays there with the app closed, and saves what you type in it");
  await shot("desk-note");
  await p.evaluate(() => document.querySelector("#nx-dnotes .dn-un").click()); await wait(500);
  ok(await p.evaluate(() => !document.querySelector("#nx-dnotes") && !NX.data("sticky-notes", []).some((n) => n.pin)), "and comes off the desktop with its x");
  // Star Tiles: one move from solved, then solve it
  await p.evaluate(() => { NX.closeAll(); NX.install("tiles"); NX.open("tiles"); }); await wait(500);
  ok(await p.evaluate(() => { const c = NX.wins.get("tiles").tiles.cells(); return c.length === 16 && new Set(c).size === 16 && document.querySelectorAll(".win[data-app=tiles] .tl-c").length === 15; }), "Star Tiles deals a puzzle of 15 tiles");
  await p.evaluate(() => NX.wins.get("tiles").tiles.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15]));
  await p.evaluate(() => document.querySelector(".win[data-app=tiles] [data-i='15']").click()); await wait(200);
  ok(await p.evaluate(() => /Solved|New best/.test(document.querySelector(".win[data-app=tiles] .tl-msg").textContent) && NX.data("tiles-best", null).moves === 1), "and knows when it's solved, keeping your best");
  await shot("tiles");
  // ---------- 4.0 ----------
  // Quick Search: Nebulux + Space
  await p.evaluate(() => NX.closeAll()); await p.keyboard.down("Meta"); await p.keyboard.press("Space"); await p.keyboard.up("Meta"); await wait(300);
  ok(await p.evaluate(() => !!document.querySelector("#nx-qs input") && document.activeElement === document.querySelector("#nx-qs input")), "Nebulux + Space opens Quick Search");
  await p.keyboard.type("12*12"); await wait(300);
  ok(await p.evaluate(() => /= 144/.test(document.querySelector("#nx-qs .qs2-it").textContent)), "it does sums: 12*12 = 144");
  await p.evaluate(() => { const i = document.querySelector("#nx-qs input"); i.value = ""; }); await p.keyboard.type("camer"); await wait(500);
  ok(await p.evaluate(() => /Camera/.test(document.querySelector("#nx-qs .qs2-it.on").textContent)), "and finds apps");
  await shot("quicksearch");
  await p.keyboard.press("Enter"); await wait(600);
  ok(await p.evaluate(() => !document.querySelector("#nx-qs") && !!document.querySelector(".win[data-app=camera]")), "Enter opens the top result");
  await p.evaluate(() => NX.closeAll()); await p.evaluate(() => NX.quickSearch()); await p.keyboard.type("grocer"); await wait(900);
  ok(await p.evaluate(() => [...document.querySelectorAll("#nx-qs .qs2-it")].some((b) => /Groceries|grocer/i.test(b.textContent))), "and files");
  ok(await p.evaluate(() => { const a = NX.qsConvert("5 km in miles"), b = NX.qsConvert("212 f to c"), c = NX.qsConvert("2 cups to ml"), d = NX.qsConvert("5 km to kg"); return a.value === 3.1068560 && b.value === 100 && c.value === 473.17647 && d === null; }), "Quick Search converts: 5 km in miles, 212 f to c, 2 cups to ml");
  await p.evaluate(() => { const i = document.querySelector("#nx-qs input"); i.value = "5 km in miles"; i.dispatchEvent(new Event("input")); }); await wait(300);
  ok(await p.evaluate(() => /3\.1068/.test(document.querySelector("#nx-qs .qs2-it").textContent)), "and shows the answer first");
  await p.evaluate(() => { const i = document.querySelector("#nx-qs input"); i.value = "netfl"; i.dispatchEvent(new Event("input")); }); await wait(400);
  ok(await p.evaluate(() => [...document.querySelectorAll("#nx-qs .qs2-it")].some((b) => /Netflix/.test(b.textContent) && /Nebulux Store/.test(b.textContent))), "and apps you can get from the Nebulux Store");
  await p.keyboard.press("Escape"); await wait(200);
  // a hot corner can make a new sticky note
  await p.evaluate(() => NX.cornerActions.note[1]()); await wait(300);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.closest && !!document.activeElement.closest("#nx-dnotes")), "a hot corner can start a new sticky note on the desktop");
  await p.evaluate(() => { NX.setData("sticky-notes", []); NX.deskNotes(); });
  // Peek: Space on a file
  await p.evaluate(() => NX.open("files", { place: "Pictures" })); await wait(900);
  await p.evaluate(() => { const b = document.querySelector(".win[data-app=files] .fx-item"); b.click(); b.focus(); }); await wait(200);
  await p.keyboard.press("Space"); await wait(800);
  ok(await p.evaluate(() => !!document.querySelector("#nx-peek img")), "Space on a picture in File Explorer shows it right away (Peek)");
  await shot("peek");
  await p.keyboard.press("Space"); await wait(200);
  ok(await p.evaluate(() => !document.querySelector("#nx-peek")), "and Space closes it");
  // App Grid
  await p.evaluate(() => { NX.closeAll(); NX.appGrid(); }); await wait(400);
  ok(await p.evaluate(() => document.querySelectorAll("#nx-grid .ag-app").length >= 10), "the App Grid shows every app");
  await shot("appgrid");
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowRight"); await wait(100);
  ok(await p.evaluate(() => document.activeElement === document.querySelectorAll("#nx-grid .ag-app")[1]), "arrow keys move through the App Grid");
  await p.evaluate(() => document.querySelector("#nx-grid .ag-q").focus());
  await p.keyboard.type("weath"); await p.keyboard.press("Enter"); await wait(600);
  ok(await p.evaluate(() => !document.querySelector("#nx-grid") && !!document.querySelector(".win[data-app=weather]")), "and type + Enter opens one");
  // hot corners
  await p.evaluate(() => { NX.closeAll(); NX.setPref("corners", { tr: "grid" }); }); await p.mouse.move(W / 2, H / 2); await p.mouse.move(W - 1, 0, { steps: 5 }); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector("#nx-grid")), "a hot corner opens what you chose (top right: App Grid)");
  await p.evaluate(() => { document.querySelector("#nx-grid").remove(); NX.setPref("corners", {}); }); await p.mouse.move(W / 2, H / 2);
  // grow taskbar icons
  await p.evaluate(() => NX.setPref("magnify", true)); const tbi = await p.evaluate(() => { const r = document.querySelector("#tb-apps .tb-app").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(tbi[0], tbi[1], { steps: 3 }); await wait(200);
  ok(await p.evaluate(() => /scale\(1\.[2-6]/.test(document.querySelector("#tb-apps .tb-app .ico").style.transform)), "taskbar icons grow under the pointer when turned on");
  await p.evaluate(() => NX.setPref("magnify", false)); await p.mouse.move(W / 2, H / 3);
  // shake to find the pointer
  const found0 = await p.evaluate(() => NX.pointerFound || 0);
  for (let k = 0; k < 8; k++) { const sw = Math.min(220, W / 2 - 10); await p.mouse.move(k % 2 ? W / 2 + sw : W / 2 - sw, H / 3, { steps: 4 }); }
  ok(await p.evaluate((f) => (NX.pointerFound || 0) > f, found0), "shaking the pointer makes it easy to find");
  // a background that follows the day
  await p.evaluate(() => { NX.setPref("dailyWall", false); NX.setPref("dynWall", true); }); await wait(300);
  ok(await p.evaluate(() => NX.prefs().wallpaper === NX.dayWall(new Date().getHours()) && [NX.dayWall(8), NX.dayWall(13), NX.dayWall(18), NX.dayWall(23)].join() === "9,5,2,3"), "Background follows the day: morning, midday, sunset and night");
  await p.evaluate(() => { NX.setPref("dynWall", false); NX.setPref("wallpaper", 0); });
  // desktop widgets
  await p.evaluate(() => { NX.closeAll(); NX.setData("events", [{ id: "e1", date: "2099-01-01", time: "", title: "Far away", told: "", color: "#22c55e" }]); NX.open("settings", { page: "personal" }); }); await wait(700);
  await p.evaluate(() => ["clock", "events", "battery"].forEach((k) => { const c = document.querySelector(`.win[data-app=settings] [data-dwk=${k}]`); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); })); await wait(300);
  await p.evaluate(() => NX.closeAll()); await wait(300);
  ok(await p.evaluate(() => { const b = document.getElementById("nx-dwidgets"); return !!b && b.querySelectorAll(".dw").length === 3 && /Far away/.test(b.querySelector(".dw-ev").textContent) && /\d/.test(b.querySelector(".dw-clock b").textContent); }), "Desktop widgets show the clock, what's up next and the battery");
  await shot("deskwidgets");
  await p.evaluate(() => document.querySelector("#nx-dwidgets .dw-ev").click()); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=calendar]")), "and clicking Up next opens Calendar");
  await p.evaluate(() => { NX.setPref("deskWidgets", []); NX.setData("events", []); NX.closeAll(); }); await wait(200);
  // Stage
  await p.evaluate(() => { NX.closeAll(); NX.setPref("stage", true); NX.open("notepad"); NX.open("clock"); NX.open("weather"); }); await wait(900);
  ok(await p.evaluate(() => !NX.wins.get("weather").min && NX.wins.get("clock").min && NX.wins.get("notepad").min && document.querySelectorAll("#nx-stage .stg-card").length === 2), "Stage: only the window you're using stays out, the others wait on the left");
  await shot("stage");
  await p.evaluate(() => document.querySelector("#nx-stage [data-stage=notepad]").click()); await wait(700);
  ok(await p.evaluate(() => !NX.wins.get("notepad").min && NX.wins.get("weather").min && !!document.querySelector("#nx-stage [data-stage=weather]")), "and clicking a card swaps it in");
  await p.evaluate(() => { NX.setPref("stage", false); NX.closeAll(); }); await wait(400);
  ok(await p.evaluate(() => !document.getElementById("nx-stage") && !document.getElementById("desktop").classList.contains("stage")), "and Stage turns off cleanly");
  // auto-hide the taskbar
  await p.evaluate(() => NX.setPref("tbAuto", true)); await p.mouse.move(W / 2, H / 2); await wait(500);
  const tbTop = () => p.evaluate(() => document.getElementById("taskbar").getBoundingClientRect().top);
  ok(await tbTop() >= H - 2, "Hide the taskbar: it slides away");
  await p.mouse.move(W / 2, H - 1, { steps: 4 }); await wait(400);
  ok(await tbTop() < H - 30, "and comes back when the pointer touches the bottom");
  await p.mouse.move(W / 2, H / 2, { steps: 4 }); await wait(1100);
  ok(await tbTop() >= H - 2, "and slides away again after");
  await p.evaluate(() => NX.setPref("tbAuto", false)); await wait(400);
  // seconds in the clock and the battery percentage
  await p.evaluate(() => { NX.setPref("clockSec", true); NX.setPref("battPct", true); }); await wait(1200);
  ok(await p.evaluate(() => /\d:\d\d:\d\d/.test(document.getElementById("tb-time").textContent) && (!NX.batt() || /\d+%/.test((document.querySelector(".tb-bpct") || {}).textContent || ""))), "the taskbar can show seconds and the battery percentage");
  await p.evaluate(() => { NX.setPref("clockSec", false); NX.setPref("battPct", false); });
  // Screen time
  await p.evaluate(() => { NX.closeAll(); NX.open("weather"); }); await wait(300);
  await p.evaluate(() => { NX.screenTimeTick(1500); NX.screenTimeTick(1500); });
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(800);
  await p.evaluate(() => NX.screenTimeTick(30));
  ok(await p.evaluate(() => (NX.screenTime().weather || 0) >= 3000 && /Weather/.test(document.querySelector("#s-st").textContent) && /\d+ min/.test(document.querySelector("#s-st").textContent)), "Settings > System shows screen time for each app today");
  await p.evaluate(() => document.querySelector("#s-st").scrollIntoView()); await shot("screentime");
  // Reminders
  await p.evaluate(() => { NX.closeAll(); NX.setData("todos", []); NX.open("reminders"); }); await wait(500);
  await p.evaluate(() => { const f = document.querySelector(".win[data-app=reminders] .rm-add"); f.t.value = "Feed the cat"; const d = new Date(Date.now() - 60000); f.d.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); f.requestSubmit(); }); await wait(300);
  ok(await p.evaluate(() => /Feed the cat/.test(document.querySelector(".win[data-app=reminders] .rm-list").textContent) && /1 to do/.test(document.querySelector(".win[data-app=reminders] .rm-head").textContent)), "Reminders adds something to do");
  await p.evaluate(() => NX.todosTick()); await wait(300);
  ok(await p.evaluate(() => /Reminder: Feed the cat/.test((document.querySelector("#nx-alarm") || {}).textContent || "") && NX.data("todos", [])[0].rang), "and rings when it's due");
  await p.evaluate(() => document.querySelectorAll("#nx-alarm [data-al=off]").forEach((b) => b.click()));
  await shot("reminders");
  await p.evaluate(() => { const c = document.querySelector(".win[data-app=reminders] .rm-it input"); c.checked = true; c.dispatchEvent(new Event("change")); }); await wait(500);
  ok(await p.evaluate(() => NX.data("todos", [])[0].done && /All done/.test(document.querySelector(".win[data-app=reminders] .rm-head").textContent)), "and checks it off");
  await p.evaluate(() => { NX.closeAll(); NX.setData("todos", [{ id: "t1", text: "Return library book", due: "", done: false }]); NX.setPref("deskWidgets", ["todos"]); }); await wait(300);
  ok(await p.evaluate(() => /Return library book/.test((document.querySelector("#nx-dwidgets .dw-todo") || {}).textContent || "")), "a Reminders desktop widget lists what's left to do");
  await p.evaluate(() => NX.quickSearch()); await p.keyboard.type("library"); await wait(400);
  ok(await p.evaluate(() => [...document.querySelectorAll("#nx-qs .qs2-it")].some((b) => /Return library book/.test(b.textContent))), "and Quick Search finds reminders");
  await p.keyboard.press("Escape");
  await p.evaluate(() => { NX.setData("todos", []); NX.setPref("deskWidgets", []); NX.closeAll(); });
  // Calendar app
  await p.evaluate(() => { NX.closeAll(); NX.setData("events", []); NX.open("calendar"); }); await wait(600);
  await p.evaluate(() => { const f = document.querySelector(".win[data-app=calendar] .ca-add"); f.n.value = "Dentist"; f.t.value = "15:30"; f.querySelectorAll("[name=c]")[3].checked = true; f.requestSubmit(); }); await wait(300);
  ok(await p.evaluate(() => { const d = document.querySelector(".win[data-app=calendar] .ca-d.today i"); return !!d && /Dentist/.test(d.textContent) && NX.data("events", []).some((e) => e.title === "Dentist" && e.time === "15:30" && e.color === "#ec4899"); }), "Calendar adds an event, in its color, on today's square");
  await shot("calendar");
  await p.evaluate(() => document.querySelector(".win[data-app=calendar] [data-ca='1']").click()); await wait(200);
  ok(await p.evaluate(() => { const t = new Date(); t.setMonth(t.getMonth() + 1, 1); return document.querySelector(".win[data-app=calendar] .ca-head h2").textContent === t.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }), "and goes to the next month");
  await p.evaluate(() => { NX.setData("events", []); NX.closeAll(); });
  // Settings > Apps: search your apps
  await p.evaluate(() => { NX.closeAll(); NX.open("settings", { page: "apps" }); }); await wait(700);
  await p.type(".win[data-app=settings] .s-appq", "camer"); await wait(200);
  ok(await p.evaluate(() => { const v = [...document.querySelectorAll(".win[data-app=settings] [data-appn]")].filter((r) => !r.hidden).map((r) => r.dataset.appn); return v.length === 1 && v[0] === "camera"; }), "Settings > Apps finds an app as you type");
  // Magnifier
  await p.evaluate(() => NX.closeAll()); await p.mouse.move(300, 200);
  await p.keyboard.down("Meta"); await p.keyboard.press("Equal"); await p.keyboard.press("Equal"); await p.keyboard.up("Meta"); await wait(300);
  ok(await p.evaluate(() => NX.magnifier.level() === 2 && /scale\(2\)/.test(document.getElementById("desktop").style.transform)), "Nebulux + Plus zooms in (Magnifier)");
  await shot("magnifier");
  await p.keyboard.down("Meta"); await p.keyboard.press("Escape"); await p.keyboard.up("Meta"); await wait(200);
  ok(await p.evaluate(() => NX.magnifier.level() === 1 && !document.getElementById("desktop").style.transform), "and Nebulux + Esc stops it");
  // Caps Lock warning on password boxes
  ok(await p.evaluate(() => { const i = document.createElement("input"); i.type = "password"; document.body.appendChild(i); i.focus(); const ev = new KeyboardEvent("keydown", { key: "A", bubbles: true, modifierCapsLock: true }); i.dispatchEvent(ev); const shown = !!(i.nextElementSibling && i.nextElementSibling.classList.contains("nx-caps")); i.dispatchEvent(new KeyboardEvent("keyup", { key: "A", bubbles: true })); const gone = !(i.nextElementSibling && i.nextElementSibling.classList.contains("nx-caps")); i.remove(); return shown && gone; }), "a password box says when Caps Lock is on");
  // the accent color from your background
  await p.evaluate(() => { NX.setPref("wallpaper", 1); NX.setPref("accent", "auto"); }); await wait(300);
  const acc1 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  await p.evaluate(() => NX.setPref("wallpaper", 2)); await wait(300);
  const acc2 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  ok(/^hsl\(/.test(acc1) && /^hsl\(/.test(acc2) && acc1 !== acc2, "the accent color can follow the background (" + acc1 + ", " + acc2 + ")");
  await p.evaluate(() => { NX.setPref("accent", "#7c5cff"); NX.setPref("wallpaper", 0); });
  // Increase contrast
  await p.evaluate(() => NX.setPref("contrast", true)); await wait(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("hc") && getComputedStyle(document.documentElement).getPropertyValue("--line").trim() === "#ffffff66"), "Increase contrast makes outlines stronger");
  await p.evaluate(() => NX.setPref("contrast", false));
  // Start: folder shortcuts
  await p.evaluate(() => { NX.closeAll(); document.querySelector("#tb-start, .tb-start, [data-tb=start]").click(); }); await wait(500);
  await p.evaluate(() => document.querySelector('[data-place="Pictures"]').click()); await wait(800);
  ok(await p.evaluate(() => { const w = document.querySelector(".win[data-app=files]"); return !!w && /Pictures/.test(w.textContent); }), "Start's Pictures shortcut opens File Explorer at Pictures");
  await p.evaluate(() => NX.closeAll());
  // Themes
  const thBefore = await p.evaluate(() => JSON.stringify(NX.prefs()));
  await p.evaluate(() => { NX.closeAll(); NX.open("settings"); }); await wait(500);
  await p.evaluate(() => { const w = [...document.querySelectorAll(".win")].pop(); const b = [...w.querySelectorAll(".s-nav button, .s-side button, [data-pg]")].find((x) => /Personalization/.test(x.textContent)); b && b.click(); }); await wait(400);
  ok(await p.evaluate(() => { const b = document.querySelector('[data-look="2"]'); if (!b) return false; b.click(); const q = NX.prefs(); return q.wallpaper === 2 && q.accent === "#f97316" && q.corners40 === "square" && document.querySelector('[data-look="2"]').classList.contains("on"); }), "a Theme sets the background, accent, corners and glass in one click");
  await p.evaluate((j) => { const o = JSON.parse(j); ["wallpaper", "theme", "accent", "corners40", "glass"].forEach((k) => NX.setPref(k, o[k])); NX.closeAll && NX.closeAll(); }, thBefore);
  // Lock screen picture: saved for this computer, used when nobody is signed in
  await p.evaluate(() => NX.setPref("lockPic", 3)); await wait(150);
  ok(await p.evaluate(() => NX.get("lock-wall", 0) === 3), "the lock screen picture is saved for the lock screen");
  await p.evaluate(() => NX.setPref("lockPic", "match")); await wait(150);
  ok(await p.evaluate(() => NX.get("lock-wall", -1) === (typeof NX.prefs().wallpaper === "number" ? NX.prefs().wallpaper : 0)), "Same as my background follows the background");
  // Window buttons: Dots
  await p.evaluate(() => { NX.closeAll(); NX.setPref("wbtn", "dots"); NX.open("notepad"); }); await wait(500);
  ok(await p.evaluate(() => { const b = document.querySelector(".win .wb-close"); return getComputedStyle(b).borderRadius === "50%" && b.getBoundingClientRect().width === 14; }), "Dots window buttons are round");
  await p.evaluate(() => document.querySelector(".win .wb-close").click()); await wait(400);
  ok(await p.evaluate(() => !document.querySelector(".win[data-app=notepad]") || document.querySelector(".nx-dlg, .dlg")), "the red dot closes the window");
  await p.evaluate(() => { NX.setPref("wbtn", "plain"); NX.closeAll(); });
  // a count on Reminders' taskbar button when reminders are due
  await p.evaluate(() => { NX.closeAll(); NX.setData("todos", [{ id: "bd1", text: "Late one", done: false, due: "2020-01-01T09:00", rang: 1 }]); document.dispatchEvent(new CustomEvent("nx:todos")); NX.open("reminders"); }); await wait(600);
  ok(await p.evaluate(() => { const c = document.querySelector('.tb-app[data-app="reminders"] .tb-cnt'); return !!c && c.textContent === "1"; }), "Reminders' taskbar button shows how many are due");
  await p.evaluate(() => { NX.setData("todos", []); document.dispatchEvent(new CustomEvent("nx:todos")); NX.closeAll(); });
  // Pointer color
  await p.evaluate(() => NX.setPref("pointerColor", "accent")); await wait(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("nx-pc") && /cursor:url/.test(document.getElementById("nx-pointer").textContent) && getComputedStyle(document.body).cursor.includes("url(")), "an accent-colored pointer applies");
  await p.evaluate(() => NX.setPref("pointerColor", "white")); await wait(200);
  ok(await p.evaluate(() => !document.getElementById("nx-pointer") && !document.documentElement.classList.contains("nx-pc")), "White brings back the normal pointer");
  // system sounds (the test browser is muted)
  ok(await p.evaluate(() => { let n = 0; const o = NX.sounds.note; NX.sounds.note = () => n++; NX.setPref("noteSound", true); NX.toast("Sound test"); NX.setPref("noteSound", false); NX.toast("Quiet test"); NX.sounds.note = o; return n === 1 && NX.notes[0].text === "Quiet test"; }), "the notification sound plays only when it's on");
  ok(await p.evaluate(() => typeof NX.sounds.signin === "function"), "there's a sign-in chime");
  // the Recycle Bin on the desktop
  await p.evaluate(async () => { NX.closeAll(); const d = await NX.folder("Documents"); await NX.fs.write(d + "/bin test.txt", "x"); await NX.fs.remove([d + "/bin test.txt"]).catch(() => NX.fs.del && NX.fs.del([d + "/bin test.txt"])); NX.filesChanged(); }); await wait(900);
  ok(await p.evaluate(() => { const b = document.querySelector("#icons .dbin"); return !!b && /Recycle Bin/.test(b.textContent) && NX.binFull === true; }), "the desktop Recycle Bin shows it has something in it");
  await p.evaluate(() => document.querySelector("#icons .dbin").click()); await wait(800);
  ok(await p.evaluate(() => { const w = document.querySelector(".win[data-app=files]"); return !!w && /bin test/.test(w.textContent); }), "and opens the Recycle Bin");
  await p.evaluate(async () => { await NX.fs.emptyTrash(); NX.closeAll(); await NX.binCheck(); });
  ok(await p.evaluate(() => NX.binFull === false), "and is empty again after emptying it");
  // screen saver
  await p.evaluate(() => { NX.closeAll(); NX.saver.preview("stars"); }); await wait(900); await shot("saver-stars");
  ok(await p.evaluate(() => !!document.querySelector("#nx-saver.on canvas")), "the Starfield screen saver shows");
  await p.mouse.move(200, 200); await p.mouse.move(260, 240); await wait(600);
  ok(await p.evaluate(() => !document.querySelector("#nx-saver") && document.querySelector("#lock").hidden), "moving the mouse ends it (a preview doesn't lock)");
  await p.evaluate(() => NX.saver.preview("clock")); await wait(900); await shot("saver-clock");
  ok(await p.evaluate(() => /\d/.test(document.querySelector("#nx-saver .sv-clock b").textContent)), "the Floating clock screen saver shows the time");
  await p.keyboard.press("Shift"); await wait(600);
  await p.evaluate(() => { NX.closeAll(); NX.setPref("saver", false); NX.open("settings", { page: "personal" }); }); await wait(700);
  await p.evaluate(() => { const sel = document.querySelector("[data-saver]"); sel.value = "stars"; sel.dispatchEvent(new Event("change")); }); await wait(300);
  ok(await p.evaluate(() => NX.prefs().scrSaver === "stars" && NX.prefs().saver === false && !!document.querySelector("[data-saverpv]:not([disabled])")), "picking a screen saver in Settings doesn't touch battery saver");
  await p.evaluate(() => { NX.setPref("scrSaver", "off"); NX.closeAll(); });
  // quick settings: Edit hides and shows tiles
  await p.evaluate(() => { NX.closeAll(); NX.setPref("qsHide", []); NX.shell.closeFlyouts(); document.querySelector("#tb-qs").click(); }); await wait(400);
  await p.evaluate(() => document.querySelector("#qs .qs-editb").click()); await wait(200);
  await p.evaluate(() => document.querySelector('#qs .qs-editing [data-k="airplane"]').click()); await wait(200);
  await p.evaluate(() => document.querySelector("#qs .qs-done").click()); await wait(200);
  ok(await p.evaluate(() => !document.querySelector('#qs [data-k="airplane"]') && NX.prefs().qsHide.includes("airplane") && NX.prefs().airplane !== true && !!document.querySelector('#qs [data-k="snip"]')), "Edit in quick settings hides a tile (and there's a Screenshot tile)");
  await p.evaluate(() => { NX.setPref("qsHide", []); NX.shell.closeFlyouts(); });
  // the snap bar: drag a window to the top and drop it on a layout
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); }); await wait(700);
    const t0 = await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad] .wt-name").getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2 }; });
    await p.mouse.move(t0.x, t0.y); await p.mouse.down(); await p.mouse.move(t0.x + 80, t0.y + 60, { steps: 4 }); await p.mouse.move(W / 2, 200, { steps: 5 }); await p.mouse.move(W / 2, 40, { steps: 5 }); await wait(400);
    const zr = await p.evaluate(() => { const i = document.querySelector('#nx-snapbar.near [data-l="4"][data-z="2"]'); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (zr) { await p.mouse.move(zr.x, zr.y, { steps: 4 }); await wait(200); }
    await p.mouse.up(); await wait(500);
    ok(!!zr && await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad]").getBoundingClientRect(), A = document.querySelector("#windows").getBoundingClientRect(); return Math.abs(r.x - A.width * 2 / 3) < 3 && Math.abs(r.width - A.width / 3) < 3; }), "dragging a window to the top shows the snap bar, and dropping it on a zone snaps it there");
    await p.evaluate(() => NX.closeAll());
  }
  // desktop Stacks
  await p.evaluate(async () => { NX.closeAll(); const d = await NX.folder("Desktop"); for (const n of ["Stack a.txt", "Stack b.txt"]) await NX.fs.write(d + "/" + n, "x"); NX.filesChanged(); NX.setPref("stacks", true); }); await wait(900);
  ok(await p.evaluate(() => [...document.querySelectorAll("#icons .dstack")].some((x) => /Documents/.test(x.textContent))), "Use stacks piles the desktop's files by kind");
  await p.evaluate(() => [...document.querySelectorAll("#icons .dstack")].find((x) => /Documents/.test(x.textContent)).click()); await wait(500);
  ok(await p.evaluate(() => [...document.querySelectorAll("#nx-stack .stk-grid button")].filter((b) => /Stack [ab].txt/.test(b.textContent)).length === 2), "and a stack opens to show its files");
  await p.evaluate(async () => { NX.setPref("stacks", false); const d = await NX.folder("Desktop"); await NX.fs.remove([d + "/Stack a.txt", d + "/Stack b.txt"], true).catch(() => {}); NX.filesChanged(); }); await wait(500);
  // desktop icon sizes
  await p.evaluate(() => { NX.closeAll(); document.querySelector("#desktop").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: Math.min(innerWidth - 60, 600), clientY: 200 })); }); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Small icons/.test(b.textContent)).click()); await wait(300);
  const small = await p.evaluate(() => document.querySelector("#icons .dicon svg").getBoundingClientRect().width);
  await p.evaluate(() => { NX.setPref("iconSize", "large"); NX.shell.icons(); }); await wait(300);
  const large = await p.evaluate(() => document.querySelector("#icons .dicon svg").getBoundingClientRect().width);
  ok(small <= 32 && large >= 56 && await p.evaluate(() => document.querySelector("#icons").dataset.size === "large"), "right-click the desktop > View changes the icon size");
  await p.evaluate(() => { NX.setPref("iconSize", "medium"); NX.shell.icons(); });
  // File Explorer: the Preview pane
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.setData("fx-pv", false); NX.open("files", { place: "Documents" }); }); await wait(900);
    await p.evaluate(() => document.querySelector(".win[data-app=files] [data-t=preview]").click()); await wait(200);
    await p.evaluate(() => { const b = [...document.querySelectorAll(".win[data-app=files] .fx-item")].find((x) => /Welcome/.test(x.textContent)); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(700);
    ok(await p.evaluate(() => { const pv = document.querySelector(".win[data-app=files] .fx-pv"); return !pv.hidden && /Welcome.txt/.test(pv.textContent) && /Welcome to Nebulux OS/.test(pv.querySelector(".pv-txt").textContent); }), "File Explorer's Preview pane shows the selected file and its first lines");
    await p.evaluate(() => { NX.setData("fx-pv", false); NX.closeAll(); });
  }
  // Ctrl + Alt + Delete
  await p.evaluate(() => { NX.closeAll(); document.dispatchEvent(new CustomEvent("nx:key", { detail: "sec" })); }); await wait(400); await shot("ctrl-alt-del");
  ok(await p.evaluate(() => { const o = document.querySelector("#nx-sec"); return !!o && ["Lock", "Switch user", "Sign out", "Change a password", "Task Manager", "Cancel"].every((t) => [...o.querySelectorAll("button")].some((b) => b.textContent === t)); }), "Ctrl + Alt + Delete shows Lock, Switch user, Sign out, Change a password and Task Manager");
  await p.evaluate(() => document.querySelector("#nx-sec [data-sec=tm]").click()); await wait(600);
  ok(await p.evaluate(() => !document.querySelector("#nx-sec") && !!document.querySelector(".win[data-app=taskmgr]")), "and Task Manager opens from it");
  await p.evaluate(() => NX.closeAll());
  // Focus in the calendar flyout
  await p.evaluate(() => { NX.closeAll(); NX.shell.closeFlyouts(); document.querySelector("#tb-clock").click(); }); await wait(400);
  await p.evaluate(() => { document.querySelector("#cal [data-cf=plus]").click(); document.querySelector("#cal [data-cf=go]").click(); }); await wait(300);
  ok(await p.evaluate(() => NX.focusSession.on() && Math.round(NX.focusSession.len() / 60000) === 30 && NX.prefs().dnd === true && /Focusing/.test(document.querySelector("#cal .cal-focus").textContent)), "Focus in the calendar flyout starts a 30-minute session with Do not disturb");
  await p.evaluate(() => document.querySelector("#cal [data-cf=stop]").click()); await wait(200);
  ok(await p.evaluate(() => !NX.focusSession.on()), "and Stop ends it");
  await p.evaluate(() => NX.shell.closeFlyouts());
  // File Explorer: Gallery shows the pictures from Pictures, Desktop and Downloads
  await p.evaluate(async () => { NX.closeAll(); const cv = document.createElement("canvas"); cv.width = 40; cv.height = 30; cv.getContext("2d").fillRect(0, 0, 40, 30); const bl = await new Promise((r) => cv.toBlob(r, "image/png")); await NX.fs.upload(await NX.folder("Downloads"), "Gallery test.png", bl); NX.open("files"); }); await wait(800);
  await p.evaluate(() => document.querySelector('.win[data-app=files] [data-go="::gallery"]').click()); await wait(900);
  ok(await p.evaluate(() => { const w = document.querySelector(".win[data-app=files]"); return !!w.querySelector(".fx-gal") && [...w.querySelectorAll(".fx-item")].some((b) => /Gallery test.png/.test(b.textContent)) && /Gallery/.test(w.querySelector(".wt-name").textContent); }), "File Explorer's Gallery shows pictures from Downloads too");
  await p.evaluate(() => NX.closeAll());
  // app names on the taskbar
  if (W > 760) {
    await p.evaluate(() => { NX.closeAll(); NX.setPref("tbLabels", true); NX.open("clock"); }); await wait(600);
    ok(await p.evaluate(() => { const l = document.querySelector('.tb-app[data-app="clock"] .tb-lbl'); return !!l && getComputedStyle(l).display !== "none" && l.textContent === "Clock"; }), "Show app names on the taskbar puts the name next to the icon");
    await p.evaluate(() => { NX.setPref("tbLabels", false); NX.closeAll(); });
  }
  // a background for each desktop
  await p.evaluate(() => { NX.closeAll(); NX.taskView(); }); await wait(500);
  await p.evaluate(() => { const c = document.querySelector(".tv-dk"); const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 20, clientY: r.y + 20 })); }); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => b.textContent === "Solar Flare").click()); await wait(300);
  ok(await p.evaluate(() => /url\(/.test(document.querySelector("#desktop").style.getPropertyValue("--wall")) && NX.data("desks", [])[0].wall === 2), "right-click a desktop in Task View to give it its own background");
  await p.evaluate(() => { const c = document.querySelector(".tv-dk"); const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 20, clientY: r.y + 20 })); }); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Same as my background/.test(b.textContent)).click()); await wait(300);
  ok(await p.evaluate(() => !document.querySelector("#desktop").style.getPropertyValue("--wall")), "and Same as my background takes it off");
  await p.keyboard.press("Escape"); await p.evaluate(() => { const t = document.querySelector("#taskview"); if (t) t.hidden = true; NX.closeAll(); });
  // taskbar items
  await p.evaluate(() => { NX.closeAll(); NX.setPref("tbSearch", "hide"); NX.setPref("tbTaskView", false); NX.setPref("tbWidgets", false); }); await wait(200);
  ok(await p.evaluate(() => ["#tb-search", "#tb-tview", "#tb-widgets"].every((q) => getComputedStyle(document.querySelector(q)).display === "none")), "taskbar items: search, Task view and Widgets can be hidden");
  await p.evaluate(() => NX.setPref("tbSearch", "icon")); await wait(200);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector("#tb-search span")).display === "none" && getComputedStyle(document.querySelector("#tb-search")).display !== "none"), "and search can be just the icon");
  await p.evaluate(() => { NX.setPref("tbSearch", "box"); NX.setPref("tbTaskView", true); NX.setPref("tbWidgets", true); });
  // Night light strength
  await p.evaluate(() => { NX.setPref("night", true); NX.setPref("nightStr", 100); }); await wait(600);
  const nsHi = await p.evaluate(() => +getComputedStyle(document.querySelector("#night")).opacity);
  await p.evaluate(() => NX.setPref("nightStr", 10)); await wait(600);
  const nsLo = await p.evaluate(() => +getComputedStyle(document.querySelector("#night")).opacity);
  ok(nsHi > 0.35 && nsLo < 0.15, "Night light strength changes how warm it gets");
  await p.evaluate(() => { NX.setPref("night", false); NX.setPref("nightStr", 50); });
  // your own picture: Choose a fit
  const wBefore = await p.evaluate(() => NX.prefs().wallpaper);
  await p.evaluate(() => { const cv = document.createElement("canvas"); cv.width = 40; cv.height = 30; cv.getContext("2d").fillRect(0, 0, 40, 30); NX.setData("wall-custom", cv.toDataURL()); NX.setPref("wallpaper", "custom"); NX.setPref("wallFit", "fit"); NX.closeAll(); NX.open("settings", { page: "personal" }); }); await wait(700);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector("#desktop")).backgroundSize === "contain" && !!document.querySelector("button[data-wfit=fit].on")), "Choose a fit shows your own picture whole (Fit)");
  await p.evaluate((w) => { NX.setPref("wallFit", "fill"); NX.setPref("wallpaper", w); NX.closeAll(); }, wBefore);
  // drag a window into a corner: a quarter of the screen
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); }); await wait(700);
    const q0 = await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad] .wt-name").getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2 }; });
    const A = await p.evaluate(() => { const r = document.querySelector("#windows").getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y }; });
    await p.mouse.move(q0.x, q0.y); await p.mouse.down(); await p.mouse.move(q0.x + 60, q0.y + 60, { steps: 4 }); await p.mouse.move(A.x + A.w - 2, A.y + A.h - 20, { steps: 8 }); await wait(150); await p.mouse.up(); await wait(500);
    ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad]").getBoundingClientRect(), A = document.querySelector("#windows").getBoundingClientRect(); return Math.abs(r.x - A.width / 2) < 3 && Math.abs(r.width - A.width / 2) < 3 && Math.abs(r.height - A.height / 2) < 3; }), "dragging a window into a corner snaps it to a quarter");
    await p.evaluate(() => NX.closeAll());
  }
  // Snap Assist
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.open("calculator"); NX.open("clock"); NX.open("notepad"); }); await wait(700);
    await p.evaluate(() => NX.snap("notepad", "left")); await wait(400); await shot("snap-assist");
    ok(await p.evaluate(() => { const o = document.querySelector("#nx-assist.right"); return !!o && o.querySelectorAll(".as-card").length === 2; }), "after snapping a window left, Snap Assist offers the other windows on the right");
    await p.evaluate(() => document.querySelector('#nx-assist [data-as="clock"]').click()); await wait(500);
    ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=clock]").getBoundingClientRect(), A = document.querySelector("#windows").getBoundingClientRect(); return !document.querySelector("#nx-assist") && Math.abs(r.x - A.width / 2) < 3 && Math.abs(r.width - A.width / 2) < 3; }), "and picking one fills the right half");
    await p.evaluate(() => NX.closeAll());
  }
  // the lock screen shows the next event and reminders due (only while locked)
  await p.evaluate(() => { NX.closeAll(); const d = new Date(), k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); NX.setData("events", [{ id: "lk1", date: k, time: "23:58", title: "Lock test event", color: "#22c55e" }]); NX.setData("todos", [{ id: "lt", text: "Late", done: false, due: "2020-01-01T09:00", rang: 1 }]); NX.shell.lockKeep(); }); await wait(1600); await shot("lock-next");
  ok(await p.evaluate(() => { const e = document.querySelector("#lk-next"); return !!e && /Lock test event/.test(e.textContent) && /1 reminder due/.test(e.textContent); }), "the lock screen shows your next event and reminders due");
  await p.evaluate(() => NX.toast("Locked test note")); await wait(1300);
  ok(await p.evaluate(() => { const n = document.querySelector("#lk-status .lk-notes"); return !!n && +n.textContent.replace("+", "") >= 1 && !/Locked test note/.test(document.querySelector("#lock").innerText); }), "the lock screen shows how many notifications are waiting, not what they say");
  await p.keyboard.press("Enter"); await wait(600); { const pw = await p.$("#lock input[type=password]"); if (pw) { await pw.type("nebula1"); await p.keyboard.press("Enter"); } } await p.waitForFunction(() => document.querySelector("#lock").hidden, { timeout: 8000 }).catch(() => {}); await wait(400);
  await p.evaluate(() => { NX.setData("events", []); NX.setData("todos", []); });
  // desktop: Sort by name
  const deskBefore = await p.evaluate(() => NX.prefs().desktop.slice());
  await p.evaluate(() => { NX.closeAll(); document.querySelector("#desktop").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: Math.min(innerWidth - 60, 600), clientY: 200 })); }); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Sort by name/.test(b.textContent)).click()); await wait(300);
  ok(await p.evaluate(() => { const n = [...document.querySelectorAll("#icons .dicon:not(.dbin):not(.dfile)")].map((b) => b.textContent.trim()); return n.length > 1 && n.every((x, i) => !i || n[i - 1].localeCompare(x) <= 0); }), "right-click the desktop > Sort by name puts the icons A to Z");
  await p.evaluate((d) => { NX.setPref("desktop", d); NX.shell.icons(); }, deskBefore);
  // Quick Search before typing: recent apps and files
  await p.evaluate(() => { NX.closeAll(); NX.setPref("recent", ["calculator", "clock"]); NX.quickSearch(); }); await wait(300);
  ok(await p.evaluate(() => { const r = document.querySelector("#nx-qs .qs2-res"); return !!r && /Recent apps/i.test(r.textContent) && /Calculator/.test(r.textContent); }), "Quick Search shows your recent apps before you type");
  await p.keyboard.press("Enter"); await wait(600);
  ok(await p.evaluate(() => !document.querySelector("#nx-qs") && !!document.querySelector(".win[data-app=calculator]")), "and Enter opens the first one");
  await p.evaluate(() => NX.closeAll());
  // Settings search finds settings by name, not just page names
  await p.evaluate(() => { NX.closeAll(); NX.open("settings"); }); await wait(500);
  await p.type(".win[data-app=settings] .s-search input", "screen saver"); await wait(300);
  ok(await p.evaluate(() => [...document.querySelectorAll(".win[data-app=settings] .s-nav")].map((b) => b.textContent.trim()).join() === "Personalization"), "Find a setting: screen saver finds Personalization");
  await p.evaluate(() => NX.closeAll());
  // the tray's tooltip
  await p.evaluate(() => NX.setPref("volume", 42)); await wait(200);
  ok(await p.evaluate(() => /Volume: 42%/.test(document.querySelector("#tb-qs").title)), "pointing at the tray shows the volume and connection");
  // Paint: the Text tool
  await p.evaluate(() => { NX.closeAll(); NX.open("paint"); }); await wait(800);
  await p.evaluate(() => document.querySelector(".win[data-app=paint] [data-t=text]").click());
  const pc = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] canvas").getBoundingClientRect(); return { x: r.x + 40, y: r.y + 40 }; });
  await p.mouse.click(pc.x, pc.y); await wait(300);
  await p.keyboard.type("Hi"); await p.keyboard.press("Enter"); await wait(300);
  ok(await p.evaluate(() => { const c = document.querySelector(".win[data-app=paint] canvas"), d = c.getContext("2d").getImageData(0, 0, Math.min(c.width, 200), Math.min(c.height, 120)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n++; return n > 30; }), "Paint's Text tool writes text on the picture");
  await p.evaluate(() => NX.closeAll());
  // Start > All apps > Category
  await p.evaluate(() => { NX.closeAll(); NX.shell.closeFlyouts(); NX.setPref("allView", "list"); document.querySelector("#tb-start").click(); }); await wait(400);
  await p.evaluate(() => [...document.querySelectorAll("#start button")].find((x) => /All apps/.test(x.textContent)).click()); await wait(300);
  await p.evaluate(() => document.querySelector('#start [data-av="cat"]').click()); await wait(300);
  ok(await p.evaluate(() => { const c = [...document.querySelectorAll("#start .sm-cat")]; return c.length >= 2 && /Nebulux OS/.test(c[0].textContent) && NX.prefs().allView === "cat"; }), "All apps can show apps by category");
  await p.evaluate(() => document.querySelector("#start .sm-cat .sm-cat-h").click()); await wait(200);
  ok(await p.evaluate(() => document.querySelector("#start .sm-cat").classList.contains("open")), "and a category opens to show all its apps");
  await p.evaluate(() => { NX.setPref("allView", "list"); NX.shell.closeFlyouts(); });
  // Nebulux + Z: snap layouts for the window you're using
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); }); await wait(600);
    await p.evaluate(() => document.dispatchEvent(new CustomEvent("nx:key", { detail: "snapz" }))); await wait(300);
    ok(await p.evaluate(() => !document.querySelector("#snapfly").hidden && document.querySelectorAll("#snapfly .sf-lay").length >= 4), "Nebulux + Z shows the snap layouts");
    await p.keyboard.press("Escape"); await p.evaluate(() => { document.querySelector("#snapfly").hidden = true; NX.closeAll(); });
  }
  // holidays in the calendar (US region)
  ok(await p.evaluate(() => { NX.setPref("region", "US"); const h = NX.holidays(2026); return h.find((x) => x.title === "Thanksgiving").date === "2026-11-26" && h.find((x) => x.title === "Easter").date === "2026-04-05" && h.find((x) => x.title === "Memorial Day").date === "2026-05-25" && NX.calEvents().some((e) => e.holiday); }), "the calendar knows the holidays (Thanksgiving 2026 is Nov 26)");
  await p.evaluate(() => { NX.setPref("holidays", false); });
  ok(await p.evaluate(() => !NX.calEvents().some((e) => e.holiday)), "and they can be turned off");
  await p.evaluate(() => { NX.setPref("holidays", true); });
  ok(await p.evaluate(() => { const D = Date; const fake = new D("2026-11-26T10:00:00"); window.Date = class extends D { constructor(...a) { return a.length ? new D(...a) : new D(fake); } static now() { return fake.getTime(); } }; const g = NX.holidayGreeting(); window.Date = D; return g === "Happy Thanksgiving"; }), "on Thanksgiving the greeting says Happy Thanksgiving");
  // repeating events
  ok(await p.evaluate(() => { const d = new Date(), k = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); NX.setData("events", [{ id: "rp", date: k(d), time: "", title: "Practice", repeat: "week" }, { id: "m31", date: "2026-01-31", time: "", title: "Month end", repeat: "month" }]); const all = NX.calEvents(), w2 = new Date(d); w2.setDate(d.getDate() + 14); return all.some((e) => e.title === "Practice" && e.date === k(w2)) && all.filter((e) => e.title === "Month end").every((e) => e.date.endsWith("-31")) && NX.occursOn({ date: "2026-01-31", repeat: "year" }, "2027-01-31"); }), "repeating events show every week, month and year");
  await p.evaluate(() => NX.setData("events", []));
  // repeating reminders move on to the next time when checked off
  ok(await p.evaluate(() => { const t = { due: "2020-01-06T09:00", repeat: "week" }, n = NX.nextDue(t), d = new Date(n); return n.endsWith("T09:00") && d > new Date() && d.getDay() === 1; }), "a weekly reminder checked off moves to next week, same day and time");
  // Do not disturb on a schedule, and the hours boxes save
  ok(await p.evaluate(() => { NX.setPref("dnd", false); NX.setPref("dndFrom", "22:00"); NX.setPref("dndTo", "07:00"); NX.setPref("dndSched", true); NX.dndTick(new Date("2026-11-25T23:30:00")); const a = NX.prefs().dnd === true; NX.dndTick(new Date("2026-11-26T08:00:00")); const b = NX.prefs().dnd === false; NX.setPref("dndSched", false); return a && b; }), "Do not disturb comes on in quiet hours and goes off after");
  await p.evaluate(() => { NX.closeAll(); NX.setPref("nightSched", true); NX.open("settings", { page: "system" }); }); await wait(600);
  await p.evaluate(() => { const i = document.querySelector('.win[data-app=settings] [data-time="nightFrom"]'); i.value = "20:15"; i.dispatchEvent(new Event("change")); }); await wait(200);
  ok(await p.evaluate(() => NX.prefs().nightFrom === "20:15"), "changing the night light hours saves them");
  await p.evaluate(() => { NX.setPref("nightSched", false); NX.closeAll(); });
  // clipboard history search
  await p.evaluate(() => { NX.closeAll(); NX.setPref("cliphist", true); NX.setData("clip-history", []); ["one apple", "two pears", "three plums", "four kiwis", "five grapes"].forEach((t) => NX.clip.add(t)); NX.clip.toggle(); }); await wait(300);
  await p.type("#clip .cl-find input", "plum"); await wait(200);
  ok(await p.evaluate(() => [...document.querySelectorAll("#clip .cl-item")].filter((el) => !el.hidden).map((el) => el.querySelector(".cl-t").textContent).join() === "three plums"), "clipboard history can be searched");
  await p.evaluate(() => { NX.clip.close(); NX.setData("clip-history", []); });
  // Calculator > Dates
  await p.evaluate(() => { NX.closeAll(); NX.open("calculator"); }); await wait(500);
  ok(await p.evaluate(() => { document.querySelector(".win[data-app=calculator] [data-m=date]").click(); const set = (q, v) => { const i = document.querySelector(q); i.value = v; i.dispatchEvent(new Event("input")); }; set(".cd-a", "2026-11-25"); set(".cd-b", "2026-12-25"); set(".cd-c", "2026-01-30"); set(".cd-n", "30"); return /30 days/.test(document.querySelector(".cd-diff").textContent) && /March 1, 2026/.test(document.querySelector(".cd-sum").textContent); }), "Calculator's Dates counts the days between dates and adds days to a date");
  await p.evaluate(() => NX.closeAll());
  // the Photos desktop widget
  await p.evaluate(async () => { NX.closeAll(); const cv = document.createElement("canvas"); cv.width = 60; cv.height = 40; cv.getContext("2d").fillRect(0, 0, 60, 40); await NX.fs.upload(await NX.folder("Pictures"), "Widget pic.png", await new Promise((r) => cv.toBlob(r, "image/png"))); NX.setPref("deskWidgets", ["photo"]); }); await wait(1500);
  await p.evaluate(() => NX.deskWidgets && NX.deskWidgets()); await wait(300);
  ok(await p.evaluate(() => { const w = document.querySelector("#nx-dwidgets .dw-photo"); return !!w && (!!w.querySelector("img") || /Photos/.test(w.textContent)); }), "the Photos widget shows a picture from Pictures");
  await p.evaluate(() => NX.setPref("deskWidgets", []));
  // Quick Search: define a word (needs the internet; the test only checks it doesn't break without an answer)
  await p.evaluate(() => { NX.closeAll(); NX.quickSearch(); const i = document.querySelector("#nx-qs input"); i.value = "define nebula"; i.dispatchEvent(new Event("input")); }); await wait(2500);
  ok(await p.evaluate(() => { const r = document.querySelector("#nx-qs .qs2-res"); return !!r && /Search Google/.test(r.textContent); }), "Quick Search handles define a word");
  await p.keyboard.press("Escape");
  // Quick Search: time in a city
  await p.evaluate(() => { NX.closeAll(); NX.quickSearch(); const i = document.querySelector("#nx-qs input"); i.value = "time in tokyo"; i.dispatchEvent(new Event("input")); }); await wait(400);
  ok(await p.evaluate(() => /in Tokyo/.test(document.querySelector("#nx-qs .qs2-res").textContent)), "Quick Search tells the time in a city");
  await p.keyboard.press("Escape");
  // lock screen slideshow
  await p.evaluate(() => { NX.closeAll(); NX.setPref("lockPic", "show"); NX.shell.lockKeep(); }); await wait(800);
  const lw0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--wall"));
  await p.evaluate(() => NX.lockShowNext()); await wait(400);
  ok(await p.evaluate((w) => getComputedStyle(document.documentElement).getPropertyValue("--wall") !== w, lw0), "the lock screen slideshow moves to the next background");
  await p.keyboard.press("Enter"); await wait(600); { const pw = await p.$("#lock input[type=password]"); if (pw) { await pw.type("nebula1"); await p.keyboard.press("Enter"); } } await p.waitForFunction(() => document.querySelector("#lock").hidden, { timeout: 8000 }).catch(() => {}); await wait(400);
  await p.evaluate(() => NX.setPref("lockPic", "match"));
  // Peek and Shake
  if (W > 700) {
    await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); NX.open("calculator"); NX.open("clock"); }); await wait(700);
    const sd = await p.evaluate(() => { const r = document.querySelector("#tb-showdesk").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(sd.x, sd.y); await wait(800);
    ok(await p.evaluate(() => document.querySelector("#desktop").classList.contains("nx-peek") && +getComputedStyle(document.querySelector(".win")).opacity < 0.5), "resting on the far right of the taskbar peeks at the desktop");
    await p.mouse.move(600, 300); await wait(300);
    ok(await p.evaluate(() => !document.querySelector("#desktop").classList.contains("nx-peek")), "and the windows come back when the pointer leaves");
    const tb = await p.evaluate(() => { const r = document.querySelector(".win[data-app=clock] .wt-name").getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
    await p.mouse.move(tb.x, tb.y); await p.mouse.down();
    for (let k = 0; k < 6; k++) { await p.mouse.move(tb.x + (k % 2 ? -60 : 60), tb.y, { steps: 3 }); await wait(40); }
    await p.mouse.up(); await wait(500);
    ok(await p.evaluate(() => [...NX.wins.values()].filter((w) => !w.min).map((w) => w.id).join() === "clock"), "shaking a window minimizes the others");
    await p.evaluate(() => NX.closeAll());
  }
  // jump lists: right-click Notepad on the taskbar for its recent files
  await p.evaluate(async () => { NX.closeAll(); const d = await NX.folder("Documents"); await NX.fs.write(d + "/Jump list.txt", "hi"); NX.setData("recent-files", [{ name: "Jump list.txt", path: d + "/Jump list.txt", kind: "text", at: Date.now() }, { name: "Pic.png", path: "/x/Pic.png", kind: "image", at: Date.now() }]); NX.open("notepad"); }); await wait(600);
  await p.evaluate(() => { const b = document.querySelector('.tb-app[data-app="notepad"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 10, clientY: r.y })); }); await wait(300);
  ok(await p.evaluate(() => { const m = document.querySelector("#ctx"); return !m.hidden && /Recent/.test(m.textContent) && /Jump list.txt/.test(m.textContent) && !/Pic.png/.test(m.textContent); }), "right-clicking Notepad on the taskbar lists its recent files");
  await p.evaluate(() => { [...document.querySelectorAll("#ctx button")].find((b) => /Jump list/.test(b.textContent)).click(); }); await wait(600);
  ok(await p.evaluate(() => /hi/.test(document.querySelector(".win[data-app=notepad] textarea").value)), "and opens one with a click");
  await p.evaluate(() => { NX.setData("recent-files", []); NX.closeAll(); });
  // Corners and Glass
  await p.evaluate(() => { NX.setPref("corners40", "square"); NX.setPref("glass", "solid"); }); await wait(200);
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--r-win").trim() === "4px" && document.documentElement.dataset.glass === "solid"), "Square corners and solid glass apply");
  await p.evaluate(() => { NX.setPref("corners40", "round"); NX.setPref("glass", "frosted"); });
  // Accessibility: the large mouse pointer
  await p.evaluate(() => { NX.closeAll(); NX.open("settings", { page: "access" }); }); await wait(700);
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=settings] [data-pref=bigcursor]"); t.checked = true; t.dispatchEvent(new Event("change", { bubbles: true })); }); await wait(300);
  ok(await p.evaluate(async () => { if (!document.documentElement.classList.contains("bigcursor")) return false; const c = getComputedStyle(document.body).cursor, m = c.match(/url\("([^"]+)"\)/); if (!m) return false; const i = new Image(); i.src = m[1]; await i.decode(); return i.naturalWidth === 48; }), "Large mouse pointer gives a bigger pointer");
  await p.evaluate(() => { NX.setPref("bigcursor", false); NX.closeAll(); });
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
