// Nebulux OS end to end, in a real (headless) browser: first-run setup, lock screen and sign-in (a wrong password is
// refused), the desktop, Start, windows (open, drag, maximize, minimize, close), Settings changes that stick, Google,
// the Store (install, open, uninstall), every store app, quick settings, sign out and back in, and no page errors.
// node tests/e2e.cjs [W H]   (needs Edge or Chrome running with --remote-debugging-port=9333)
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +process.argv[2] || 1366, H = +process.argv[3] || 768, URL = "file:///" + path.resolve(__dirname, "../index.html").replace(/\\/g, "/") + "?fast";
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 }); const errs = [], opened = [];
  const c = await b.createBrowserContext(), p = await c.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  c.on("targetcreated", async (t) => { if (t.type() === "page") { opened.push(t.url()); try { const pg = await t.page(); pg && (await pg.close()); } catch (e) {} } });
  await p.setViewport({ width: W, height: H, isMobile: W < 700, hasTouch: W < 700 });
  await p.evaluateOnNewDocument(() => { window.__opens = []; window.open = (u) => { window.__opens.push(String(u)); return null; }; });
  await p.goto(URL, { waitUntil: "load" }); await wait(600);
  const opensNow = () => p.evaluate(() => window.__opens.slice());
  const shot = (n) => p.screenshot({ path: path.join(__dirname, "shots", n + "-" + W + ".png") });
  const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!(e && !e.hidden && e.getBoundingClientRect().width > 0); }, s);
  const txt = () => p.evaluate(() => document.body.innerText);

  // first run: lock screen, then setup
  ok(await vis("#lock"), "boots to the lock screen");
  await shot("01-lock");
  await p.mouse.click(W / 2, H / 2); await wait(450);
  ok(/Welcome to Nebulux OS/.test(await txt()), "first run asks you to make an account");
  await p.type("#lk-panel input[name=n]", "Ada"); await p.type("#lk-panel input[name=p]", "nebula1"); await p.type("#lk-panel input[name=p2]", "nebula2");
  await p.click("#lk-panel button[type=submit]"); await wait(300);
  ok(/don't match/.test(await txt()), "mismatched passwords are refused");
  await p.evaluate(() => { document.querySelector("#lk-panel input[name=p2]").value = ""; }); await p.type("#lk-panel input[name=p2]", "nebula1");
  await shot("02-setup");
  await p.click("#lk-panel button[type=submit]"); await wait(1500);
  ok(await vis("#desktop") && !(await vis("#lock")), "making the account signs you in to the desktop");
  const stored = await p.evaluate(() => JSON.stringify(localStorage));
  ok(!stored.includes("nebula1"), "the password itself is never stored");
  await shot("03-desktop");

  // Start
  await p.click("#tb-start"); await wait(300);
  ok(await vis("#start") && /Pinned/.test(await txt()) && /Recommended/.test(await txt()), "Start opens with Pinned and Recommended");
  await shot("04-start");
  await p.type("#start .sm-search input", "sett"); await wait(200);
  ok(await p.evaluate(() => [...document.querySelectorAll("#start .sm-res b")].some((x) => x.textContent === "Settings")), "Start search finds Settings");
  await p.keyboard.press("Enter"); await wait(500);
  ok(await vis(".win[data-app=settings]") && !(await vis("#start")), "Enter in Start search opens Settings");

  // windows
  const box = () => p.evaluate(() => { const r = document.querySelector(".win[data-app=settings]").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const b0 = await box();
  await p.mouse.move(b0.x + 200, b0.y + 18); await p.mouse.down(); await p.mouse.move(b0.x + 120, b0.y + 60, { steps: 6 }); await p.mouse.up(); await wait(200);
  const b1 = await box(); ok(Math.abs(b1.x - (b0.x - 80)) < 3 && Math.abs(b1.y - (b0.y + 42)) < 3, "a window drags by its title bar");
  await p.mouse.move(b1.x + b1.w - 6, b1.y + b1.h - 6); await p.mouse.down(); await p.mouse.move(b1.x + b1.w + 60, b1.y + b1.h + 40, { steps: 5 }); await p.mouse.up(); await wait(200);
  const b2 = await box(); ok(b2.w > b1.w + 40 && b2.h > b1.h + 20, "a window resizes from its corner (" + [b1.w, b1.h, b2.w, b2.h].map(Math.round) + ")");
  if (!(b2.w > b1.w + 40)) console.log("  corner hits:", await p.evaluate((x, y) => document.elementsFromPoint(x, y).slice(0, 3).map((e) => e.className && e.className.baseVal == null ? e.className : e.tagName).join(" | "), b1.x + b1.w - 1, b1.y + b1.h - 1));
  await p.click(".win[data-app=settings] .wb-max"); await wait(250);
  const b3 = await box(); ok(b3.w >= W - 2 && b3.x <= 1, "Maximize fills the screen");
  await p.click(".win[data-app=settings] .wb-max"); await wait(250);
  ok(W < 700 ? (await box()).w >= W - 2 : (await box()).w < W - 10, W < 700 ? "on a phone, windows stay full screen" : "Restore brings it back");
  await p.click(".win[data-app=settings] .wb-min"); await wait(250);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=settings]").classList.contains("minimized")), "Minimize hides it");
  await p.click("#tb-apps [data-app=settings]"); await wait(250);
  ok(await p.evaluate(() => !document.querySelector(".win[data-app=settings]").classList.contains("minimized")), "its taskbar button brings it back");

  // Settings
  await p.evaluate(() => [...document.querySelectorAll(".s-nav")].find((x) => /Personalization/.test(x.textContent)).click()); await wait(300);
  await shot("05-settings");
  await p.evaluate(() => document.querySelector("[data-wall='3']").click()); await wait(200);
  await p.evaluate(() => document.querySelector("[data-theme=light]").click()); await wait(200);
  await p.evaluate(() => document.querySelector("[data-acc='#22c3ee']").click()); await wait(200);
  await p.evaluate(() => document.querySelector("[data-align=left]").click()); await wait(200);
  ok(await p.evaluate(() => document.documentElement.dataset.theme === "light" && getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() === "#22c3ee" && document.getElementById("desktop").classList.contains("tb-left")), "Personalization: light mode, accent color and taskbar alignment apply right away");
  await shot("06-light");
  await p.evaluate(() => document.querySelector("[data-theme=dark]").click()); await wait(150);
  await p.evaluate(() => document.querySelector("[data-align=center]").click()); await wait(150);
  await p.evaluate(() => [...document.querySelectorAll(".s-nav")].find((x) => /System/.test(x.textContent)).click()); await wait(200);
  await p.evaluate(() => { const s = document.querySelector("[data-pref=brightness]"); s.value = 60; s.dispatchEvent(new Event("input")); }); await wait(250);
  ok(await p.evaluate(() => +getComputedStyle(document.getElementById("dim")).opacity > 0.2), "Brightness dims the screen");
  await p.evaluate(() => { const s = document.querySelector("[data-pref=brightness]"); s.value = 100; s.dispatchEvent(new Event("input")); }); await wait(250);
  await p.evaluate(() => [...document.querySelectorAll(".s-nav")].find((x) => /Accounts/.test(x.textContent)).click()); await wait(200);
  await p.type("#s-old", "wrongpass"); await p.type("#s-new", "comet22"); await p.type("#s-new2", "comet22"); await p.click("#s-pw"); await wait(900);
  ok(/incorrect/.test(await p.evaluate(() => document.querySelector("#s-pwmsg").textContent)), "changing the password needs the right current one");
  await p.evaluate(() => { document.querySelector("#s-old").value = ""; }); await p.type("#s-old", "nebula1"); await p.click("#s-pw"); await wait(1200);
  ok(/password is changed/.test(await txt()), "Change password works");
  await p.click(".win[data-app=settings] .wb-close"); await wait(300);
  ok(!(await p.$(".win[data-app=settings]")), "Close closes it");

  // Wi-Fi and Bluetooth: the switch really blocks the web, real offline is noticed, Bluetooth offers Add device
  await p.evaluate(() => NX.setPref("wifi", false)); await wait(100);
  { const n0 = (await opensNow()).length; await p.evaluate(() => NX.searchWeb("test")); await wait(200);
    ok((await opensNow()).length === n0 && /Wi-Fi is off/.test(await txt()), "with Wi-Fi off, a search doesn't go out and says why"); }
  await p.evaluate(() => NX.setPref("wifi", true)); await p.setOfflineMode(true); await wait(400);
  ok(await p.evaluate(() => !NX.netOK()) && /connection was lost/.test(await txt()), "a real lost connection is noticed");
  await p.setOfflineMode(false); await wait(400);
  ok(await p.evaluate(() => NX.netOK()), "and coming back online too");
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  ok(await p.evaluate(() => !!document.querySelector("#s-btadd")) && /Connected to the internet/.test(await txt()), "Settings shows the real connection and a Bluetooth Add device button");
  await p.click(".win[data-app=settings] .wb-close"); await wait(250);

  // Google
  await p.click("#tb-apps [data-app=google]"); await wait(400);
  await shot("07-google");
  await p.type(".g-search input", "nebulux os"); await p.keyboard.press("Enter"); await wait(800);
  { const o = await opensNow(); ok(o.some((u) => /google\.com\/search\?q=nebulux%20os/.test(u)), "a Google search opens Google in a new tab (" + o.slice(-1) + ")"); }
  await p.click(".win[data-app=google] .wb-close"); await wait(250);

  // Store: install every app, open each one, then uninstall one
  await p.click("#tb-apps [data-app=store]"); await wait(400);
  await shot("08-store");
  const ids = await p.evaluate(() => [...document.querySelectorAll(".st-card")].map((x) => x.dataset.app));
  ok(ids.length >= 7, "the Store lists the apps (" + ids.join(", ") + ")");
  for (const id of ids) { await p.evaluate((id) => document.querySelector(`[data-get="${id}"]`).click(), id); await wait(60); }
  for (let i = 0; i < 40 && (await p.$(".st-prog")); i++) await wait(250);
  const inst = await p.evaluate(() => NX.prefs().installed);
  ok(ids.every((id) => inst.includes(id)), "Install installs them (" + inst.length + ")");
  await p.evaluate(() => document.querySelector("[data-app=paint]").click()); await wait(250);
  await shot("09-store-app");
  await p.click(".win[data-app=store] .wb-close"); await wait(250);
  for (const id of ids) {
    const isWeb = await p.evaluate((id) => !!NX.apps[id].url, id), before = (await opensNow()).length;
    await p.evaluate((id) => NX.open(id), id); await wait(600);
    if (isWeb) { ok((await opensNow()).length > before, id + " opens its website in a new tab"); continue; }
    ok(await vis(`.win[data-app=${id}]`) && !(await p.$(`.win[data-app=${id}] .app-error`)), id + " opens");
  }
  // try each app a little
  await p.evaluate(() => NX.focus("calculator")); await p.click(".win[data-app=calculator] [data-k='7']"); await p.click(".win[data-app=calculator] [data-k='*']"); await p.click(".win[data-app=calculator] [data-k='6']"); await p.click(".win[data-app=calculator] [data-k='=']"); await wait(100);
  ok((await p.evaluate(() => document.querySelector(".win[data-app=calculator] .c-val").textContent)) === "42", "Calculator: 7 × 6 = 42");
  await p.click(".win[data-app=calculator] [data-k='c']"); await p.click(".win[data-app=calculator] [data-k='1']"); await p.click(".win[data-app=calculator] [data-k='/']"); await p.click(".win[data-app=calculator] [data-k='0']"); await p.click(".win[data-app=calculator] [data-k='=']"); await wait(100);
  ok(/divide by zero/.test(await p.evaluate(() => document.querySelector(".win[data-app=calculator] .c-val").textContent)), "Calculator: dividing by zero doesn't break it");
  await p.evaluate(() => NX.focus("notepad")); await p.type(".win[data-app=notepad] textarea", "Hello from Nebulux"); await wait(700);
  ok((await p.evaluate(() => NX.data("np-text"))) === "Hello from Nebulux", "Notepad saves as you type");
  await p.evaluate(() => NX.focus("paint")); const cv = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] canvas").getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await p.mouse.move(cv[0] + 40, cv[1] + 40); await p.mouse.down(); await p.mouse.move(cv[0] + 200, cv[1] + 120, { steps: 8 }); await p.mouse.up(); await wait(100);
  ok(await p.evaluate(() => { const c = document.querySelector(".win[data-app=paint] canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) return true; return false; }), "Paint draws");
  await p.evaluate(() => NX.focus("clock")); await p.evaluate(() => [...document.querySelectorAll(".win[data-app=clock] .clk-tabs button")][1].click()); await wait(100);
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-a=sws]").click()); await wait(700);
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-a=sws]").click()); await wait(100);
  ok(/00:00\.[1-9]|00:00\.[0-9][1-9]|00:01/.test(await p.evaluate(() => document.querySelector(".win[data-app=clock] .clk-big").textContent)), "Clock: the stopwatch runs and pauses");
  await p.evaluate(() => NX.focus("snake")); await p.evaluate(() => document.querySelector(".win[data-app=snake] .snk-msg button").click()); await wait(600);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=snake] .snk-msg").hidden), "Comet Snake starts");
  await shot("10-apps");
  ok((await p.evaluate(() => NX.wins.size)) >= 5, "several windows can be open at once");
  await p.evaluate(() => NX.uninstall("snake")); await wait(300);
  ok(!(await p.$(".win[data-app=snake]")) && !(await p.evaluate(() => NX.prefs().installed.includes("snake"))), "Uninstall closes and removes an app");

  // quick settings and calendar
  await p.click("#tb-qs"); await wait(250); ok(await vis("#qs"), "quick settings open"); await shot("11-quick");
  await p.evaluate(() => document.querySelector("#qs [data-k=theme]").click()); await wait(150);
  ok(await p.evaluate(() => document.documentElement.dataset.theme === "light"), "the quick settings dark mode switch works");
  await p.evaluate(() => document.querySelector("#qs [data-k=theme]").click()); await wait(150);
  await p.click("#tb-clock"); await wait(250); ok(await vis("#cal") && !(await vis("#qs")), "the calendar opens (and quick settings close)");
  await p.mouse.click(W / 2, 24); await wait(150); ok(!(await vis("#cal")), "clicking elsewhere closes it");

  // sign out, wrong password, sign in again: settings and data are still there
  await p.click("#tb-start"); await wait(250); await p.click(".sm-pwb"); await p.evaluate(() => document.querySelector("[data-pw=out]").click()); await wait(900);
  ok(await vis("#lock") && !(await vis("#desktop")), "Sign out goes back to the lock screen");
  await p.mouse.click(W / 2, H / 2); await wait(400);
  await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter"); await wait(1200);
  ok(/incorrect/.test(await txt()), "the old password no longer works");
  await p.evaluate(() => { document.querySelector("#lk-panel input[name=p]").value = ""; }); await p.type("#lk-panel input[name=p]", "comet22"); await p.keyboard.press("Enter"); await wait(1500);
  ok(await vis("#desktop"), "the new password signs in");
  ok(await p.evaluate(() => NX.prefs().wallpaper === 3 && NX.prefs().accent === "#22c3ee" && NX.data("np-text") === "Hello from Nebulux"), "the wallpaper, accent and notes are still there");
  // shut down and turn on
  await p.click("#tb-start"); await wait(200); await p.click(".sm-pwb"); await p.evaluate(() => document.querySelector("[data-pw=off]").click()); await wait(1800);
  ok(await vis("#off") && /Turn on/.test(await txt()), "Shut down shows the off screen");
  await p.click(".off-on"); await wait(800); ok(await vis("#lock"), "Turn on boots to the lock screen");
  ok(!errs.length, "no page errors " + errs.join(" | ").slice(0, 400));
  console.log(failed ? failed + " FAILED" : "all passed");
  await c.close(); b.disconnect();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
