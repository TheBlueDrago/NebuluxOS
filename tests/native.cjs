// Nebulux OS real-computer mode, end to end: the system helper (run with NX_FAKE=1 for made-up Wi-Fi and Bluetooth
// devices) serves the OS, and a browser with the OS extension loaded (like the USB's built-in browser) drives it.
// Checks: the helper's key is required, Wi-Fi connect (wrong and right password), Bluetooth add and pair, volume,
// real Google inside an OS window (search, address bar), pop-ups opening inside the OS instead of a new tab, web apps
// in their own windows, and Shut down reaching the computer.
//   NX_FAKE=1 node system/helper/nebulux-helper.js .     then start Edge or Chrome with
//   --remote-debugging-port=9334 --load-extension=<repo>/system/browser-ext, then: node tests/native.cjs [W H]
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +process.argv[2] || 1366, H = +process.argv[3] || 768, OS = "http://127.0.0.1:7777/";
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:" + (process.env.PORT || 9334), protocolTimeout: 120000 });
  for (const pg of await b.pages()) if (pg.url().startsWith(OS)) await pg.close();
  const p = await b.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/status of 40[034]/.test(m.text()) && !/report-only Content Security Policy/.test(m.text())) errs.push("console: " + m.text()); }); // (websites' own report-only notes aren't Nebulux OS errors)
  await p.setViewport({ width: W, height: H });
  await p.goto(OS + "?fast", { waitUntil: "load" }); await wait(800);
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "load" }); await wait(800);
  const shot = (n) => p.screenshot({ path: path.join(__dirname, "shots", "native-" + n + "-" + W + ".png") });
  const txt = () => p.evaluate(() => document.body.innerText);
  const fake = () => p.evaluate(async () => (await fetch("/api/fake", { headers: { "x-nx": window.NX_NATIVE.token } })).json());
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 8000)) { if (await fn()) return true; await wait(200); } return false; };

  await p.evaluate(async () => fetch("/api/fake/reset", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));
  await p.evaluate(async () => fetch("/api/fake/update-reset", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));
  ok(await p.evaluate(() => NX.native === true && NX.webFrames === true), "the helper puts the OS in real-computer mode");
  ok(await p.evaluate(() => document.documentElement.getAttribute("data-nxext") === "1"), "the OS browser extension is running");
  ok(await p.evaluate(async () => (await fetch("/api/info")).status === 403), "system calls without this boot's key are refused");
  ok(await p.evaluate(async () => (await fetch("/system/helper/nebulux-helper.js")).status === 404), "the helper doesn't serve its own files");

  // sign up
  ok(await until(() => p.evaluate(() => !document.querySelector("#oobe").hidden)), "the first start goes to first-time setup");
  // 3.2: with Wi-Fi off, the network step of setup offers to turn it on, and then lists the networks
  await p.evaluate(async () => { NX.realOnline = NX.online; NX.online = () => false; await fetch("/api/wifi/radio", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }, body: JSON.stringify({ on: false }) }); });
  await require("./setup.cjs")(p, "Ada", "nebula1", ok, { network: async () => {
    ok(await until(() => p.evaluate(() => /Turn on Wi-Fi/.test((document.querySelector("#oobe .ob-fix") || {}).textContent || ""))), "with Wi-Fi off, setup offers Turn on Wi-Fi");
    await p.evaluate(() => document.querySelector("#oobe .ob-fix").click());
    ok(await until(() => p.evaluate(() => document.querySelectorAll("#oobe .ob-net").length === 4)), "and then lists the networks nearby");
    await p.evaluate(() => { NX.online = NX.realOnline; });
  } });
  ok(await p.evaluate(() => !document.querySelector("#desktop").hidden), "signed in");
  ok(await until(() => p.evaluate(() => { const b = document.querySelector("#tb-tray .tb-batt"); return !!b && /76%/.test(b.title); })), "the taskbar shows the real battery level");

  // Wi-Fi
  await p.evaluate(() => NX.open("settings", { page: "network" })); await wait(400);
  ok(await until(() => p.evaluate(() => document.querySelectorAll("#s-wlist .s-net").length === 4)), "Settings lists the Wi-Fi networks nearby");
  ok(/Connected to Home Wi-Fi/.test(await txt()), "and says which one this computer is on");
  const connectTo = (name) => p.evaluate((name) => { const r = [...document.querySelectorAll("#s-wlist .s-net")].find((x) => x.querySelector("b").textContent === name); r.querySelector("[data-wc]").click(); }, name);
  await connectTo("Neighbor 5G"); await wait(200);
  ok(await p.evaluate(() => !!document.querySelector(".s-pwf input")), "a secured network asks for its password");
  await p.type(".s-pwf input", "short"); await p.click(".s-pwf [type=submit]"); await wait(200);
  ok(/at least 8 characters/.test(await txt()), "a too-short password is caught before trying");
  await p.evaluate(() => { document.querySelector(".s-pwf input").value = ""; }); await p.type(".s-pwf input", "wrongpass1"); await p.click(".s-pwf [type=submit]");
  ok(await until(() => p.evaluate(() => /password is wrong/.test(document.querySelector(".s-pwf .s-msg").textContent))), "a wrong password says so");
  await p.type(".s-pwf input", "rightpass1"); await p.click(".s-pwf [type=submit]");
  ok(await until(async () => (await fake()).conn === "Neighbor 5G"), "the right password connects to the network");
  ok(await until(() => p.evaluate(() => /Connected to Neighbor 5G/.test(document.body.innerText))), "and Settings shows the new connection");
  await shot("wifi");

  // Bluetooth
  await p.evaluate(() => NX.open("settings", { page: "devices" })); await wait(500);
  await p.evaluate(() => document.querySelector("#s-bscan").click());
  ok(await until(() => p.evaluate(() => /Nearby/.test(document.querySelector("#s-blist").innerText) && /Nebulux Earbuds/.test(document.querySelector("#s-blist").innerText))), "Add device finds Bluetooth devices nearby");
  await p.evaluate(() => document.querySelector("[data-bpair]").click());
  ok(await until(async () => (await fake()).bt.find((d) => d.name === "Nebulux Earbuds").paired), "Pair pairs the device");
  ok(await until(() => p.evaluate(() => [...document.querySelectorAll("#s-blist .s-net")].some((r) => /Nebulux Earbuds/.test(r.innerText) && /Connected/.test(r.innerText) && r.querySelector("[data-brm]")))), "and it shows under your devices as connected");
  await shot("bt");

  // volume reaches the speakers
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  await p.evaluate(() => { const s = document.querySelector("[data-pref=volume]"); s.value = 25; s.dispatchEvent(new Event("input")); });
  ok(await until(async () => (await fake()).vol === 25), "the volume slider changes the computer's volume");
  // Wi-Fi switch reaches the hardware
  await p.evaluate(() => NX.open("settings", { page: "network" })); await wait(400);
  await p.evaluate(() => { const t = document.querySelector("[data-pref=wifi]"); t.click(); });
  ok(await until(async () => (await fake()).wifiOn === false), "the Wi-Fi switch turns the computer's Wi-Fi off");
  await p.evaluate(() => { const t = document.querySelector("[data-pref=wifi]"); t.click(); });
  ok(await until(async () => (await fake()).wifiOn === true), "and back on");
  await p.evaluate(() => NX.open("settings", { page: "about" })); await wait(600);
  ok(/Linux 6\.1\.0-nebulux/.test(await txt()) && /Installed memory/.test(await txt()), "About shows the real kernel and memory");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  // Google inside an OS window
  await p.click("#tb-apps [data-app=google]");
  ok(await until(() => p.evaluate(() => !!document.querySelector(".win[data-app=google] iframe.webview"))), "Google opens as a browser window inside the OS");
  const gframe = async () => p.frames().find((f) => /google\.com/.test(f.url()));
  ok(await until(async () => !!(await gframe()), 15000), "real Google loads inside it");
  await wait(1500);
  const gt = await (await gframe()).evaluate(() => document.title).catch((e) => "error " + e.message);
  ok(/Google/.test(gt), "the page inside is Google itself (" + gt + ")");
  ok(await until(() => p.evaluate(() => /google\.com/.test(document.querySelector(".win[data-app=google] .wv-addr input").value))), "the address bar shows where it is");
  await shot("google");
  await p.click(".win[data-app=google] .wv-addr input"); await p.keyboard.type("nebulux os"); await p.keyboard.press("Enter");
  // (Google may show an automated test browser its "unusual traffic" page instead of results; that still counts)
  const SEARCHED = /google\.com\/(search\?q=nebulux|sorry\/.*nebulux)/;
  ok(await until(async () => p.frames().some((f) => SEARCHED.test(f.url())), 15000), "typing in the address bar searches Google in the window");
  if (!p.frames().some((f) => SEARCHED.test(f.url()))) console.log("  frames:", p.frames().map((f) => f.url().slice(0, 160)).join(" | "), "\n  bar:", await p.evaluate(() => document.querySelector(".win[data-app=google] .wv-addr input").value));
  await wait(2500); await shot("google-search");

  // a pop-up from a website opens inside the OS, not over it
  const before = (await b.pages()).length;
  const gf = p.frames().find((f) => SEARCHED.test(f.url()));
  await gf.evaluate(() => { window.open("https://example.com/", "_blank"); });
  ok(await until(async () => p.frames().some((f) => /example\.com/.test(f.url())), 15000), "a pop-up from a website opens in the OS window instead of a new tab");
  ok(await until(async () => (await b.pages()).length === before, 5000), "and no extra tab is left over");
  ok(await until(() => p.evaluate(() => /example\.com/.test(document.querySelector(".win[data-app=google] .wv-addr input").value))), "the address bar follows it");
  await p.click(".win[data-app=google] [data-w=back]");
  ok(await until(async () => !p.frames().some((f) => /example\.com/.test(f.url())) && p.frames().some((f) => SEARCHED.test(f.url())), 10000), "Back goes back to the search results");

  // dragging a window over a website still works
  const r0 = await p.evaluate(() => { const r = document.querySelector(".win[data-app=google]").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  await p.mouse.move(r0.x + 300, r0.y + 18); await p.mouse.down(); await p.mouse.move(r0.x + 250, r0.y + 220, { steps: 8 }); await p.mouse.up(); await wait(200);
  const r1 = await p.evaluate(() => { const r = document.querySelector(".win[data-app=google]").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  if (W >= 700) ok(Math.abs(r1.y - r0.y - 202) < 4, "a website window drags smoothly, even over the page"); // (phones open windows full screen)
  await p.evaluate(() => NX.close("google")); await wait(300);

  // web apps in their own window
  await p.evaluate(() => NX.install ? NX.install("nebuluxai") : null); await wait(2500);
  await p.evaluate(() => NX.open("nebuluxai")); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=nebuluxai] iframe.webview")), "Nebulux AI opens in its own window");
  ok(await until(async () => p.frames().some((f) => /nebuluxai\.com/.test(f.url())), 15000), "with the real site inside");
  await shot("webapp");
  await p.evaluate(() => NX.close("nebuluxai")); await wait(300);

  // ---------- 1.2: a TV on HDMI, sound on the TV, wireless display ----------
  const api = (m, u, body) => p.evaluate(async (m, u, body) => (await fetch("/api" + u, { method: m, headers: { "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json(), m, u, body);
  await api("POST", "/fake/reset-files");
  await api("POST", "/fake/tv", { on: true });
  ok(await until(async () => (await api("POST", "/display/get", {})).mode === "mirror", 9000), "plugging in a TV shows the same picture on it by itself");
  ok(await until(() => p.evaluate(() => /TV or monitor is connected/.test(document.querySelector("#toasts").innerText)), 4000), "and says so");
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(500);
  ok(await until(() => p.evaluate(() => /TV or monitor \(HDMI-1\)/.test(document.querySelector("#s-dlist").innerText) && document.querySelector("[data-dm=mirror]").classList.contains("on"))), "Settings shows the TV, set to Duplicate");
  await p.evaluate(() => document.querySelector("[data-dm=external]").click());
  ok(await until(async () => (await api("POST", "/display/get", {})).mode === "external"), "Second screen only shows Nebulux OS on the TV only");
  ok(await until(() => p.evaluate(() => document.querySelector("[data-dm=external]") && document.querySelector("[data-dm=external]").classList.contains("on"))), "and Settings shows it");
  await p.evaluate(() => document.querySelector("[data-dm=mirror]").click()); await until(async () => (await api("POST", "/display/get", {})).mode === "mirror");
  ok(await until(() => p.evaluate(() => /TV \(HDMI\)/.test(document.querySelector("#s-alist").innerText))), "the TV's speakers are offered for sound");
  await p.evaluate(() => [...document.querySelectorAll("#s-alist .s-net")].find((r) => /TV/.test(r.innerText)).querySelector("[data-ao]").click());
  ok(await until(async () => (await api("GET", "/audio")).outputs.find((o) => /TV/.test(o.label)).active), "Use this plays the sound on the TV");
  await shot("tv");
  await p.evaluate(() => document.querySelector("[data-cast=start]").click());
  ok(await until(async () => (await api("GET", "/cast")).running), "Wireless display: Connect starts casting");
  ok(await until(() => p.evaluate(() => !!document.querySelector("[data-cast=stop]"))), "and offers Stop");
  await p.evaluate(() => document.querySelector("[data-cast=stop]").click());
  ok(await until(async () => !(await api("GET", "/cast")).running), "Stop ends it");
  await api("POST", "/fake/tv", { on: false });
  ok(await until(() => p.evaluate(() => /TV or monitor was unplugged/.test(document.querySelector("#toasts").innerText)), 9000), "unplugging the TV is noticed");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  // ---------- 1.2: the real files, a USB drive, screenshots ----------
  await p.evaluate(() => NX.open("files")); await wait(800);
  const fxNames = () => p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-item .fx-n")].map((x) => x.textContent));
  ok(await until(() => p.evaluate(() => /MY USB/.test(document.querySelector(".win[data-app=files] .fx-side").innerText))), "File Explorer lists the plugged-in USB drive");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-place")].find((b) => /MY USB/.test(b.innerText)).click()); await wait(600);
  ok((await fxNames()).includes("From my USB.txt"), "opening it shows the files on it");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-item")].find((b) => /From my USB/.test(b.innerText)).click()); await wait(150);
  await p.click(".win[data-app=files] [data-t=copy]"); await wait(150);
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-place")].find((b) => b.innerText.trim() === "Documents").click()); await wait(500);
  await p.click(".win[data-app=files] [data-t=paste]"); await wait(600);
  ok(await until(async () => (await fxNames()).includes("From my USB.txt") && (await fxNames()).includes("Welcome.txt")), "a file copies from the USB drive into Documents");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-place")].find((b) => /MY USB/.test(b.innerText)).click()); await wait(500);
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-item")].find((b) => /From my USB/.test(b.innerText)).click()); await wait(150);
  await p.click(".win[data-app=files] [data-t=delete]"); await wait(300);
  ok(await p.evaluate(() => /USB drives have no Recycle Bin/.test((document.querySelector(".nx-ask") || {}).innerText || "")), "deleting on a USB drive warns it can't be brought back");
  await p.click(".nx-ask [type=submit]"); await wait(600);
  ok(await until(async () => !(await fxNames()).includes("From my USB.txt")), "and then deletes it");
  await p.evaluate(() => document.querySelector(".win[data-app=files] [data-eject]").click());
  ok(await until(() => p.evaluate(() => /safe to take out MY USB/.test(document.querySelector("#toasts").innerText))), "Eject says it's safe to take the drive out");
  ok(await until(() => p.evaluate(() => !/MY USB/.test(document.querySelector(".win[data-app=files] .fx-side").innerText))), "and the drive leaves the list");
  await shot("files");
  // the file rules: a key is needed, and nothing outside your folders or drives
  ok(await p.evaluate(async () => (await fetch("/api/files/raw?path=" + encodeURIComponent("C:/Windows/win.ini"))).status === 403), "file addresses without the key are refused");
  ok(await p.evaluate(async () => (await fetch(NX.rawURL("C:/Windows/win.ini"))).status === 404), "files outside your folders and USB drives can't be opened");
  ok(await p.evaluate(async () => { try { await NX.fs.list("C:/Windows"); return false; } catch (e) { return /only opens your own folders/.test(e.message); } }), "and folders outside them can't be listed");
  ok(await p.evaluate(async () => { const pl = await NX.fs.places(); try { await NX.fs.rename(pl.folders[1].path, "Stuff"); return false; } catch (e) { return /can't be changed/.test(e.message); } }), "your main folders can't be renamed or deleted");
  // screenshots: Windows + Shift + S
  await p.evaluate(() => NX.close("files")); await wait(300);
  await p.keyboard.down("Meta"); await p.keyboard.down("Shift"); await p.keyboard.press("KeyS"); await p.keyboard.up("Shift"); await p.keyboard.up("Meta");
  ok(await until(async () => p.evaluate(async () => { const pl = await NX.fs.places(); return (await NX.fs.list(pl.folders[3].path + (pl.sep) + "Screenshots")).entries.some((e) => /^Screenshot .*\.png$/.test(e.name)); })), "Windows + Shift + S saves a screenshot in Pictures > Screenshots");
  ok(await p.evaluate(() => document.querySelector("#start").hidden), "and doesn't open Start");
  ok(await until(() => p.evaluate(() => { const i = document.querySelector("#nx-snip img"); return !!i && i.naturalWidth > 0; })), "Nebulux + Shift + S lets you pick part of the screen");
  await p.evaluate(() => NX.snipTest.select(10, 10, 200, 120));
  ok(await until(async () => p.evaluate(async () => { const pl = await NX.fs.places(); return (await NX.fs.list(pl.folders[3].path + (pl.sep) + "Screenshots")).entries.some((e) => /\(part\)\.png$/.test(e.name)); })), "and saves just that part");
  ok(await until(() => p.evaluate(() => { const i = document.querySelector("#nx-shot img"); return !!i && i.naturalWidth > 0 && !document.querySelector("#nx-snip"); })), "with a picture of it floating in the corner");
  await p.evaluate(() => { const s = document.querySelector("#nx-shot"); if (s) s.remove(); });
  await p.evaluate(() => NX.open("photos")); await wait(800);
  ok(await until(() => p.evaluate(() => { const i = document.querySelector(".win[data-app=photos] .ph-tile img"); return !!i && i.naturalWidth > 0; })), "Photos shows the screenshot from the real files");
  await p.evaluate(() => NX.close("photos")); await wait(200);

  // ---------- 1.3: solid look by default here, Task Manager with the real processor ----------
  ok(await p.evaluate(() => document.documentElement.classList.contains("nofx")), "on the real OS, transparency is off by default (faster without graphics acceleration)");
  await p.evaluate(() => NX.open("taskmgr")); await wait(300);
  await p.evaluate(() => document.querySelector(".win[data-app=taskmgr] [data-tab=perf]").click());
  ok(await until(() => p.evaluate(() => /Processor\s*\d+%/.test(document.querySelector(".win[data-app=taskmgr]").innerText)), 6000), "Task Manager shows how busy the processor is");
  await p.evaluate(() => NX.close("taskmgr")); await wait(200);

  // ---------- 2.0: shortcuts caught by the window manager reach the OS ----------
  await p.evaluate(() => NX.open("notepad")); await wait(400);
  await api("POST", "/fake/key", { key: "start" });
  ok(await until(() => p.evaluate(() => !document.querySelector("#start").hidden), 4000), "the Windows key from the window manager opens Start");
  await api("POST", "/fake/key", { key: "desk" });
  ok(await until(() => p.evaluate(() => document.querySelector("#start").hidden && [...NX.wins.values()].every((w) => w.min)), 4000), "and Windows + D shows the desktop");
  await p.evaluate(() => NX.close("notepad")); await wait(200);
  ok(await p.evaluate(() => NX.browserOK === false && NX.webFrames === true), "with no real browser (the test helper), websites open in OS windows instead");

  // ---------- 3.1: real apps from the Store (Flathub), on the taskbar ----------
  await p.evaluate(() => NX.open("store")); await wait(500);
  await p.evaluate(() => document.querySelector(".win[data-app=store] .st-card[data-app=spotify]").click()); await wait(300);
  ok(await p.evaluate(() => /As a real app on this computer/.test(document.querySelector(".win[data-app=store]").innerText)), "the Store says Spotify installs as a real app");
  await p.evaluate(() => document.querySelector(".win[data-app=store] [data-get=spotify]").click());
  ok(await until(() => p.evaluate(() => NX.isNative("spotify") && NX.prefs().installed.includes("spotify")), 12000), "Get installs the real Spotify app");
  await p.evaluate(() => NX.close("store")); await wait(300);
  await p.evaluate(() => NX.open("spotify")); await wait(800);
  ok(await p.evaluate(() => !document.querySelector(".win[data-app=spotify]")), "it opens as its own app, not in a Nebulux OS window");
  ok(await until(() => p.evaluate(() => !!document.querySelector("#tb-apps [data-app=spotify].run")), 8000), "and shows on the taskbar while it's open");

  // ---------- 3.2: the clipboard from real apps and the browser joins clipboard history ----------
  await p.evaluate(async () => fetch("/api/fake/clip", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }, body: JSON.stringify({ text: "copied in a real app" }) }));
  ok(await until(() => p.evaluate(() => NX.clip.list().some((x) => x.t === "copied in a real app")), 6000), "text copied in real apps and the browser joins clipboard history");

  // ---------- 3.2: Settings > System > Storage ----------
  await p.evaluate(() => NX.open("settings", { page: "system" }));
  ok(await until(() => p.evaluate(() => /19.5 GB free/.test((document.querySelector("#s-store") || {}).innerText || "") && document.querySelectorAll("#s-store .s-str").length >= 5)), "Storage shows how full the USB is and what uses it");
  ok(await until(() => p.evaluate(() => !!document.querySelector("#s-stclean"))), "it offers to clean up temporary files");
  await p.evaluate(() => document.querySelector("#s-stclean").click());
  ok(await until(() => p.evaluate(() => [...document.querySelectorAll(".toast")].some((t) => /Cleaned up 320 MB/.test(t.textContent)) && !document.querySelector("#s-stclean"))), "Clean up frees them and says how much");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  // ---------- 3.2: the connected network's Properties, and the battery time left ----------
  await p.evaluate(() => NX.open("settings", { page: "network" }));
  await until(() => p.evaluate(() => !!document.querySelector("#s-wlist [data-wprop]")));
  await p.evaluate(() => document.querySelector("#s-wlist [data-wprop]").click());
  ok(await until(() => p.evaluate(() => { const t = (document.querySelector("#s-wlist .s-wprops") || {}).innerText || ""; return /5 GHz/.test(t) && t.includes("192.168.1.42") && t.includes("866 Mbit"); })), "Properties shows the band, speed and IP address of the Wi-Fi network");
  await p.evaluate(() => NX.close("settings")); await wait(300);
  ok(await until(() => p.evaluate(() => NX.battLeft() === "About 3 h 25 min left"), 35000), "the real battery says how long it lasts");

  await p.evaluate(() => NX.open("settings", { page: "devices" }));
  ok(await until(() => p.evaluate(() => /Wireless Mouse[\s\S]*battery 64%/.test((document.querySelector("#s-blist") || {}).innerText || ""))), "Bluetooth devices show their battery");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  await p.evaluate(() => NX.open("settings", { page: "devices" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=tpTap]").click()); await wait(1200);
  ok((await fake()).touchpad && (await fake()).touchpad.tap === false, "Touchpad settings turn tap to click off on the computer");
  await p.evaluate(() => { document.querySelector(".win[data-app=settings] [data-pref=tpTap]").click(); NX.close("settings"); }); await wait(1200);

  // ---------- 3.2: the power button, and signing in again after sleep ----------
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pkey=off]").click());
  ok(await until(async () => (await fake()).powerkey === "poweroff"), "Settings > System > Power sets what the power button does");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pkey=sleep]").click()); await until(async () => (await fake()).powerkey === "suspend");
  await p.evaluate(() => NX.close("settings")); await wait(300);
  await p.evaluate(async () => fetch("/api/fake/resume", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));
  ok(await until(() => p.evaluate(() => !document.querySelector("#lock").hidden)), "after sleep, the lock screen comes up");
  await p.mouse.click(W / 2, H / 2); await wait(500); await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter");
  ok(await until(() => p.evaluate(() => document.querySelector("#lock").hidden && !!NX.me)), "and signing in again goes back to the desktop");

  // ---------- 3.2: Snipping Tool crops a screenshot ----------
  await p.evaluate(() => { NX.closeAll(); NX.open("snip"); }); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=snip] [data-s]").click());
  await until(() => p.evaluate(() => { const i = document.querySelector(".win[data-app=snip] .sn-view img"); return !!i && i.naturalWidth === 320; }), 8000);
  await p.evaluate(() => document.querySelector(".win[data-app=snip] [data-o=crop]").click()); await wait(200);
  await p.evaluate(() => { const w = NX.wins.get("snip"), b = document.querySelector(".win[data-app=snip] .sn-view img").getBoundingClientRect(); w.snipSelect(b.width * 0.25, b.height * 0.25, b.width / 2, b.height / 2); document.querySelector(".win[data-app=snip] [data-c=save]").click(); });
  ok(await until(() => p.evaluate(() => { const w = NX.wins.get("snip"), i = document.querySelector(".win[data-app=snip] .sn-view img"); return !!w.snipLast && w.snipLast.name.endsWith("(cropped).png") && i.naturalWidth === 160 && i.naturalHeight === 100; }), 8000), "Snipping Tool crops a screenshot and saves just that part");
  await p.evaluate(() => NX.closeAll()); await wait(300);

  // ---------- 3.2: Mobile hotspot ----------
  await p.evaluate(() => NX.open("settings", { page: "network" }));
  await until(() => p.evaluate(() => !!document.querySelector("#s-hotf")));
  await p.evaluate(() => { const f = document.querySelector("#s-hotf"); f.n.value = "Ada Phone Share"; f.p.value = "share12345"; f.querySelector("[type=submit]").click(); });
  ok(await until(async () => (await fake()).hotspot && (await fake()).hotspot.name === "Ada Phone Share"), "Mobile hotspot turns on with its name and password");
  ok(await until(() => p.evaluate(() => /Sharing as Ada Phone Share/.test(document.querySelector("#s-hot").innerText) && /share12345/.test(document.querySelector("#s-hot").innerText))), "and shows what to pick on the phone");
  ok(await p.evaluate(() => !!document.querySelector("#s-hot .s-qr svg") && document.querySelectorAll("#s-hot .s-qr svg rect, #s-hot .s-qr svg path").length > 0), "with a QR code the phone can scan to join");
  await p.evaluate(() => document.querySelector("#s-hot").scrollIntoView()); await shot("hotspot-qr");
  await p.evaluate(() => document.querySelector("#s-hotoff").click());
  ok(await until(async () => !(await fake()).hotspot), "and turns off");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  await p.evaluate(() => NX.open("settings", { page: "time" })); await wait(400);
  await p.evaluate(() => { const s = document.querySelector(".win[data-app=settings] #s-kb"); s.value = "de"; s.dispatchEvent(new Event("change")); });
  ok(await until(async () => (await fake()).kb === "de"), "Settings > Time & language changes the keyboard layout on the computer");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  // ---------- 3.2: the time zone ----------
  ok(await until(async () => (await fake()).tz === "America/Chicago", 8000), "the time zone is looked up by itself after signing in");
  await p.evaluate(() => NX.open("settings", { page: "time" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=tzAuto]").click()); await wait(400);
  await p.evaluate(() => { const s = document.querySelector(".win[data-app=settings] #s-tz"); s.disabled = false; s.value = "Europe/Paris"; s.dispatchEvent(new Event("change")); });
  ok(await until(async () => (await fake()).tz === "Europe/Paris"), "with automatic off, a time zone can be picked");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  await p.evaluate(() => NX.hwKey("mic-mute"));
  ok(await until(async () => (await fake()).micMuted === true) && await p.evaluate(() => /Microphone off/.test(document.querySelector("#osd").textContent)), "the microphone key mutes the microphone, and says so");
  await p.evaluate(() => NX.hwKey("mic-mute")); await until(async () => (await fake()).micMuted === false);

  // ---------- 3.2: display scale ----------
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-scale=\"1.25\"]").click()); await wait(300);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] .nx-ask [type=submit], .win[data-app=settings] .nx-ask .primary").click());
  ok(await until(() => p.evaluate(async () => (await (await fetch("/api/scale", { headers: { "x-nx": window.NX_NATIVE.token } })).json()).scale === "1.25")), "Settings > System > Display > Scale saves the new size");
  await p.evaluate(async () => { await fetch("/api/scale", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }, body: JSON.stringify({ scale: "1" }) }); NX.close("settings"); }); await wait(300);

  // ---------- 3.2.1: apps from the web open as their own apps (no browser), streaming apps get protected video ----------
  const HDR = () => ({ "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" });
  await p.evaluate(async (h) => fetch("/api/fake/webapps-on", { method: "POST", headers: h, body: JSON.stringify({ on: true }) }), await p.evaluate(HDR));
  await p.evaluate(() => fetch("/api/webapp", { headers: { "x-nx": window.NX_NATIVE.token } }).then((r) => r.json()).then((r) => { NX.webAppOK = r.available; NX.drmReady = r.drm; }));
  await p.evaluate(() => { window.__launchSeen = ""; new MutationObserver(() => { const c = document.querySelector("#nx-launch .nl-card"); if (c) window.__launchSeen = c.innerText; }).observe(document.body, { childList: true, subtree: true }); NX.open("poki"); }); await wait(600);
  const opened = async () => (await p.evaluate(async () => (await (await fetch("/api/fake/webapps", { headers: { "x-nx": window.NX_NATIVE.token } })).json()).opened));
  ok(await until(async () => (await opened()).some((a) => a.id === "poki" && a.url === "https://poki.com/" && !a.drm)) && await p.evaluate(() => !document.querySelector(".win[data-app=poki]")), "Poki opens as its own app, not in a browser or a Nebulux OS window");
  ok(await until(() => p.evaluate(() => !!document.querySelector("#tb-apps [data-app=poki].run"))), "and it has its own place on the taskbar");
  ok(await p.evaluate(() => /Opening Poki/.test(window.__launchSeen)) && await until(() => p.evaluate(() => !document.querySelector("#nx-launch .nl-card"))), "a launch card says Opening Poki, and goes away once its window is up");
  await p.evaluate(() => { const b = document.querySelector("#tb-apps [data-app=poki]"), r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); });
  await p.evaluate(() => [...document.querySelectorAll("#ctx button")].find((b) => /Close window/.test(b.textContent)).click());
  ok(await until(() => p.evaluate(() => !document.querySelector("#tb-apps [data-app=poki]"))), "right-click Close window on the taskbar closes it");
  await p.evaluate(() => NX.open("netflix"));
  ok(await until(async () => (await opened()).some((a) => a.id === "netflix"), 4000) && await until(() => p.evaluate(() => NX.drmReady === true && NX.isNative("chrome")), 15000), "Netflix opens at once while its movie player is set up in the background");
  await p.evaluate(() => NX.open("google", { q: "nebulux os" }));
  ok(await until(async () => (await opened()).some((a) => a.id === "google" && a.url === "https://www.google.com/search?q=nebulux%20os")), "Google opens as its own Google app, with the search");
  await p.evaluate(async (h) => fetch("/api/fake/webapps-on", { method: "POST", headers: h, body: JSON.stringify({ on: false }) }), await p.evaluate(HDR)); await p.evaluate(() => { NX.webAppOK = false; });

  // ---------- 3.2: Known networks, a hidden network, Show password ----------
  await p.evaluate(() => NX.open("settings", { page: "network" }));
  ok(await until(() => p.evaluate(() => document.querySelectorAll("#s-known [data-forget]").length === 2)), "Known networks lists the saved Wi-Fi networks");
  await p.evaluate(() => [...document.querySelectorAll("#s-known .s-net")].find((r) => /School Wi-Fi/.test(r.textContent)).querySelector("[data-forget]").click());
  ok(await until(() => p.evaluate(() => document.querySelectorAll("#s-known [data-forget]").length === 1 && !/School Wi-Fi/.test(document.querySelector("#s-known").textContent))), "Forget removes a saved network");
  await p.evaluate(() => document.querySelector("#s-hidgo").click()); await wait(150);
  await p.type("#s-hidf [name=ssid]", "Hidden Lb"); await p.type("#s-hidf [name=pw]", "secretpass"); await p.evaluate(() => document.querySelector("#s-hidf [type=submit]").click());
  ok(await until(() => p.evaluate(() => /No network called Hidden Lb answered/.test(document.querySelector("#s-hidmsg").textContent))), "a hidden network with the wrong name says so");
  await p.evaluate(() => { const i = document.querySelector("#s-hidf [name=ssid]"); i.value = "Hidden Lab"; document.querySelector("#s-hidf [type=submit]").click(); });
  ok(await until(() => p.evaluate(() => document.querySelector("#s-hidf").hidden)), "joining a hidden network connects");
  await until(() => p.evaluate(() => [...document.querySelectorAll("#s-wlist .s-net")].some((x) => /School Net/.test(x.textContent))));
  ok(await p.evaluate(() => /School or work network/.test([...document.querySelectorAll("#s-wlist .s-net")].find((x) => /School Net/.test(x.textContent)).textContent)), "school and work networks are marked as such");
  await p.evaluate(() => [...document.querySelectorAll("#s-wlist .s-net")].find((x) => /School Net/.test(x.textContent)).querySelector("[data-wc]").click()); await wait(200);
  ok(await p.evaluate(() => !!document.querySelector("#s-wlist .s-pwf .s-pwu")), "and ask for a username as well as a password");
  await p.type("#s-wlist .s-pwf .s-pwu", "student"); await p.type("#s-wlist .s-pwf input[type=password]", "wrongpass"); await p.evaluate(() => document.querySelector("#s-wlist .s-pwf [type=submit]").click());
  ok(await until(() => p.evaluate(() => /username or password is wrong/.test((document.querySelector("#s-wlist .s-pwf .s-msg") || {}).textContent || ""))), "a wrong school password says so");
  await p.type("#s-wlist .s-pwf input[type=password]", "schoolpass"); await p.evaluate(() => document.querySelector("#s-wlist .s-pwf [type=submit]").click());
  ok(await until(async () => (await fake()).conn === "School Net"), "the right username and password connect to the school network");
  await until(() => p.evaluate(() => [...document.querySelectorAll("#s-wlist .s-net")].some((x) => x.textContent.includes("School Net") && x.textContent.includes("Connected")))); await wait(400);
  await p.evaluate(() => { const r = [...document.querySelectorAll("#s-wlist .s-net")].find((x) => /Neighbor 5G/.test(x.textContent)); r.querySelector("[data-wc]").click(); }); await wait(200);
  await p.evaluate(() => document.querySelector("#s-wlist .s-pwf [data-show]").click());
  ok(await p.evaluate(() => document.querySelector("#s-wlist .s-pwf input").type === "text" && document.querySelector("#s-wlist .s-pwf [data-show]").textContent === "Hide"), "Show password shows the Wi-Fi password while typing it");
  await p.evaluate(() => { NX.close("settings"); }); await wait(300);
  await p.evaluate(async () => fetch("/api/fake/reset", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));

  // ---------- 3.2: the network troubleshooter ----------
  await p.evaluate(() => NX.open("settings", { page: "network" })); await wait(500);
  await p.evaluate(() => document.querySelector("#s-diag").click());
  ok(await until(() => p.evaluate(() => document.querySelectorAll("#s-diagout .s-dc").length >= 5)), "the network troubleshooter runs its checks");
  const dtx = await p.evaluate(() => (document.querySelector("#s-diagout") || {}).innerText || "");
  ok(/Realtek RTL8852BE/.test(dtx) && /Driver: rtw89_8852be/.test(dtx) && /Everything works/.test(dtx), "it names the Wi-Fi chip and its driver, and says everything works" + (/Everything works/.test(dtx) ? "" : " [" + dtx.replace(/s+/g, " ").slice(0, 300) + "]"));
  await p.evaluate(() => document.querySelector("#s-drep").click());
  ok(await until(() => p.evaluate(async () => { const d = (await NX.fs.places()).folders.find((f) => f.name === "Documents"); return (await NX.fs.list(d.path)).entries.some((e) => /^Nebulux network report/.test(e.name)); })), "Save a report puts it in Documents");
  await p.evaluate(() => NX.close("settings")); await wait(400);
  await p.evaluate(() => NX.shell.troubleshoot());
  ok(await until(() => p.evaluate(() => document.querySelectorAll(".win[data-app=settings] #s-diagout .s-dc").length >= 5)), "Troubleshoot (from quick settings) opens the troubleshooter and runs it");
  await p.evaluate(() => NX.close("settings")); await wait(300);

  // ---------- 3.1: a USB that doesn't save changes offers a guest start ----------
  await p.evaluate(() => localStorage.clear()); await p.goto(OS + "?fast&nopersist", { waitUntil: "load" }); await wait(1200);
  ok(await until(() => p.evaluate(() => /doesn't save changes/.test((document.querySelector("#oobe h1") || {}).textContent || ""))), "a USB that doesn't save changes offers to skip setup");
  await p.click("#oobe .ob-guestgo");
  ok(await until(() => p.evaluate(() => !document.querySelector("#desktop").hidden && NX.me && NX.me.guest)), "Start without setting up goes straight to the desktop as Guest");
  await p.evaluate(() => NX.shell.signOut()); await wait(1200);
  ok(await p.evaluate(() => !!document.querySelector("#lk-panel .lk-guest") && !document.querySelector("#lk-panel input[type=password]")), "Guest signs in without a password");
  await p.evaluate(() => document.querySelector("#lk-panel .lk-guest").click()); await wait(900);
  ok(await p.evaluate(() => !document.querySelector("#desktop").hidden), "and one press signs Guest in");

  // ---------- 3.1: Nebulux OS updates itself, and says what's new ----------
  await p.evaluate(async () => fetch("/api/fake/update-reset", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));
  await p.goto(OS + "?fast&upd&nopersist", { waitUntil: "load" }); await wait(1200);
  await p.evaluate(() => document.querySelector("#lk-panel .lk-guest").click());
  ok(await until(() => p.evaluate(() => !!document.querySelector(".upd-pop")), 9000), "after sign-in, an update reminder pops up");
  ok(/Nebulux OS 3.2 is ready/.test(await txt()) && await p.evaluate(() => ["Later", "Remind me", "Never"].every((t) => [...document.querySelectorAll(".upd-pop button")].some((b) => b.textContent === t))), "it offers Later, Remind me and Never");
  await p.evaluate(() => document.querySelector(".upd-pop [data-u=remind]").click()); await wait(200);
  ok(await p.evaluate(() => !document.querySelector(".upd-pop") && NX.get("upd-remind", 0) - Date.now() > 29 * 60000), "Remind me asks again in 30 minutes");
  await p.evaluate(() => { NX.set("upd-remind", 0); NX.update.consider(); });
  ok(await until(() => p.evaluate(() => !!document.querySelector(".upd-pop")), 6000), "and asks again when the time comes");
  await p.evaluate(() => document.querySelector(".upd-pop [data-u=never]").click()); await wait(200);
  await p.evaluate(() => NX.update.consider()); await wait(4500);
  ok(await p.evaluate(() => NX.get("upd-skip") === "3.2" && !document.querySelector(".upd-pop")), "Never skips that update");
  await p.evaluate(() => { NX.set("upd-skip", null); NX.update.consider(); });
  ok(await until(() => p.evaluate(() => !!document.querySelector(".upd-pop")), 6000), "the reminder is back when it isn't skipped");
  await p.evaluate(() => document.querySelector(".upd-pop [data-u=later]").click()); await wait(200);
  ok(await p.evaluate(() => NX.get("upd-later") === "3.2" && !document.querySelector(".upd-pop")), "Later saves it for tonight");
  await p.evaluate(() => NX.open("settings", { page: "update" }));
  ok(await until(() => p.evaluate(() => /3.2 is ready. It installs tonight/.test((document.querySelector("#s-updnow") || {}).textContent || ""))), "Settings > Nebulux Update says it installs tonight");
  await p.evaluate(() => document.querySelector("#s-updgo").click());
  ok(await until(() => p.evaluate(() => /up to date/.test((document.querySelector("#s-updnow") || {}).textContent || "") && !NX.get("upd-later")), 8000), "Update now installs it");
  await p.evaluate(() => NX.close("settings")); await wait(300);
  await p.evaluate(() => { NX.set("seen-whatsnew-" + NX.me.id, "3.0"); NX.update.whatsNew(); });
  ok(await p.evaluate(() => document.querySelectorAll(".wn-pop .wn-item").length === NX.whatsNew.length && (/^\d+\.0$/.test(NX.version) ? document.querySelector(".wn-pop .wn-ver").textContent === NX.version : document.querySelector(".wn-pop").innerText.includes("What's new in Nebulux OS " + NX.version)) && document.querySelector(".wn-pop").innerText.includes(NX.version)), "after an update, What's new lists everything added");
  await p.evaluate(() => document.querySelector(".wn-pop [data-w=ok]").click()); await wait(200);
  await p.evaluate(() => NX.update.whatsNew());
  ok(await p.evaluate(() => !document.querySelector(".wn-pop")), "and shows only once");

  // Back up to a USB drive (Settings > System)
  await p.evaluate(async () => fetch("/api/fake/reset-files", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } })); // the USB drive was ejected earlier: plug it back in
  await p.evaluate(() => { NX.closeAll(); NX.open("settings", { page: "system" }); });
  ok(await until(() => p.evaluate(() => !!document.querySelector("#s-bkgo")), 8000), "Settings > System offers Back up to the USB drive");
  await p.evaluate(() => document.querySelector("#s-bkgo").click());
  ok(await until(() => p.evaluate(() => /^Done/.test(document.querySelector("#s-bkmsg").textContent)), 15000), "Back up now copies the files to the drive");
  ok(await p.evaluate(async () => { const b = NX.data("backup-last", {}); const l = await NX.fs.list(b.path); const names = l.entries.map((e) => e.name); return ["Documents", "Pictures"].every((n) => names.includes(n)); }), "and the backup has Documents and Pictures in it");
  await p.evaluate(() => NX.closeAll());

  // power reaches the computer
  await p.click("#tb-start"); await wait(300); await p.click("#start .sm-pwb"); await wait(150); await p.click("#start [data-pw=off]");
  ok(await until(async () => (await fake()).power === "poweroff", 5000), "Shut down turns the computer off");
  ok(errs.length === 0, "no page errors " + errs.join(" | "));
  await p.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
