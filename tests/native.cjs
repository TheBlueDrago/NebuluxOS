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
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/status of 40[034]/.test(m.text())) errs.push("console: " + m.text()); });
  await p.setViewport({ width: W, height: H });
  await p.goto(OS + "?fast", { waitUntil: "load" }); await wait(800);
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "load" }); await wait(800);
  const shot = (n) => p.screenshot({ path: path.join(__dirname, "shots", "native-" + n + "-" + W + ".png") });
  const txt = () => p.evaluate(() => document.body.innerText);
  const fake = () => p.evaluate(async () => (await fetch("/api/fake", { headers: { "x-nx": window.NX_NATIVE.token } })).json());
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 8000)) { if (await fn()) return true; await wait(200); } return false; };

  await p.evaluate(async () => fetch("/api/fake/reset", { method: "POST", headers: { "x-nx": window.NX_NATIVE.token } }));
  ok(await p.evaluate(() => NX.native === true && NX.webFrames === true), "the helper puts the OS in real-computer mode");
  ok(await p.evaluate(() => document.documentElement.getAttribute("data-nxext") === "1"), "the OS browser extension is running");
  ok(await p.evaluate(async () => (await fetch("/api/info")).status === 403), "system calls without this boot's key are refused");
  ok(await p.evaluate(async () => (await fetch("/system/helper/nebulux-helper.js")).status === 404), "the helper doesn't serve its own files");

  // sign up
  await p.mouse.click(W / 2, H / 2); await wait(450);
  ok(/It stays on this computer/.test(await txt()), "setup says the account stays on this computer");
  await p.type("#lk-panel input[name=n]", "Ada"); await p.type("#lk-panel input[name=p]", "nebula1"); await p.type("#lk-panel input[name=p2]", "nebula1");
  await p.click("#lk-panel button[type=submit]"); await wait(1500);
  ok(await p.evaluate(() => !document.querySelector("#desktop").hidden), "signed in");
  ok(await until(() => p.evaluate(() => { const b = document.querySelector("#tb-tray .tb-batt"); return !!b && /76%/.test(b.title); })), "the taskbar shows the real battery level");

  // Wi-Fi
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  ok(await until(() => p.evaluate(() => document.querySelectorAll("#s-wlist .s-net").length === 3)), "Settings lists the Wi-Fi networks nearby");
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
  await p.evaluate(() => document.querySelector("#s-bscan").click());
  ok(await until(() => p.evaluate(() => /Nearby/.test(document.querySelector("#s-blist").innerText) && /Nebulux Earbuds/.test(document.querySelector("#s-blist").innerText))), "Add device finds Bluetooth devices nearby");
  await p.evaluate(() => document.querySelector("[data-bpair]").click());
  ok(await until(async () => (await fake()).bt.find((d) => d.name === "Nebulux Earbuds").paired), "Pair pairs the device");
  ok(await until(() => p.evaluate(() => [...document.querySelectorAll("#s-blist .s-net")].some((r) => /Nebulux Earbuds/.test(r.innerText) && /Connected/.test(r.innerText) && r.querySelector("[data-brm]")))), "and it shows under your devices as connected");
  await shot("bt");

  // volume reaches the speakers
  await p.evaluate(() => { const s = document.querySelector("[data-pref=volume]"); s.value = 25; s.dispatchEvent(new Event("input")); });
  ok(await until(async () => (await fake()).vol === 25), "the volume slider changes the computer's volume");
  // Wi-Fi switch reaches the hardware
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
  ok(Math.abs(r1.y - r0.y - 202) < 4, "a website window drags smoothly, even over the page");
  await p.evaluate(() => NX.close("google")); await wait(300);

  // web apps in their own window
  await p.evaluate(() => NX.install ? NX.install("nebuluxai") : null); await wait(2500);
  await p.evaluate(() => NX.open("nebuluxai")); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=nebuluxai] iframe.webview")), "Nebulux AI opens in its own window");
  ok(await until(async () => p.frames().some((f) => /nebuluxai\.com/.test(f.url())), 15000), "with the real site inside");
  await shot("webapp");
  await p.evaluate(() => NX.close("nebuluxai")); await wait(300);

  // power reaches the computer
  await p.click("#tb-start"); await wait(300); await p.click("#start .sm-pwb"); await wait(150); await p.click("#start [data-pw=off]");
  ok(await until(async () => (await fake()).power === "poweroff", 5000), "Shut down turns the computer off");
  ok(errs.length === 0, "no page errors " + errs.join(" | "));
  await p.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
