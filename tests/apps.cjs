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
  await p.evaluate(() => document.querySelector(".ph-ed [data-ed2=save]").click()); await wait(1500);
  ok((await p.evaluate(async () => (await NX.fs.list(await NX.folder("Pictures"))).entries.map((e) => e.name))).some((n) => /\(edited\)\.jpg$/.test(n)) && await p.evaluate(() => !document.querySelector(".ph-ed")), "and saves the edited picture as a copy");
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
  // Increase contrast
  await p.evaluate(() => NX.setPref("contrast", true)); await wait(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("hc") && getComputedStyle(document.documentElement).getPropertyValue("--line").trim() === "#ffffff66"), "Increase contrast makes outlines stronger");
  await p.evaluate(() => NX.setPref("contrast", false));
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
