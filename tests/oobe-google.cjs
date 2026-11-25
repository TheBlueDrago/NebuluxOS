// Setup's Sign in with Google step on the real-computer side (NX_FAKE helper with a made-up web browser, port 9334):
// closing the Google window comes back to the same step; signing in goes on to the next step by itself.
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OS = "http://127.0.0.1:7777/";
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:" + (process.env.PORT || 9334), protocolTimeout: 120000 });
  for (const pg of await b.pages()) if (pg.url().startsWith(OS)) await pg.close();
  const p = await b.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.setViewport({ width: 1366, height: 768 });
  await p.goto(OS + "?fast", { waitUntil: "load" }); await wait(800);
  const H = await p.evaluate(() => ({ "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }));
  const fb = (body) => p.evaluate(async (h, body) => (await fetch("/api/fake/browser", { method: "POST", headers: h, body: JSON.stringify(body) })).json(), H, body);
  await p.evaluate(async (h) => { await fetch("/api/fake/reset", { method: "POST", headers: h }); localStorage.clear(); }, H); await fb({ on: true, running: false, title: "" });
  await p.reload({ waitUntil: "load" }); await wait(1500);
  const step = () => p.evaluate(() => (document.querySelector("#oobe h1") || {}).textContent || "");
  const next = async () => { await p.click("#oobe .ob-next"); await wait(350); };
  await p.waitForSelector("#oobe .ob-next");
  await p.type("#oobe input[name=n]", "Ada"); await next();
  await p.type("#oobe input[name=p]", "nebula1"); await p.type("#oobe input[name=p2]", "nebula1"); await next();
  for (let k = 0; k < 4 && !/Sign in with Google/.test(await step()); k++) await next();
  ok(/Sign in with Google/.test(await step()), "setup has the Sign in with Google step");
  await p.click("#oobe .ob-google"); await wait(500);
  ok(await p.evaluate(() => !document.querySelector("#oobe .ob-gwait").hidden), "pressing it shows Finish signing in in the Google window");
  await fb({ running: false }); await wait(3000);
  ok(/Sign in with Google/.test(await step()) && await p.evaluate(() => /was closed/.test(document.querySelector("#oobe .ob-gnote").textContent) && !document.querySelector("#oobe .ob-google").hidden), "closing the Google window comes back to the same step");
  await p.click("#oobe .ob-google"); await wait(1500);
  await fb({ title: "Inbox (3) - ada@gmail.com - Gmail" }); await wait(1300);
  ok(await p.evaluate(() => /signed in to Google/.test(document.querySelector("#oobe").innerText)), "signing in says You're signed in to Google");
  await wait(1500);
  ok(/privacy settings/.test(await step()), "and goes on to the next step by itself");
  ok(!(await p.evaluate(async (h) => (await (await fetch("/api/browser/signin", { headers: h })).json()).running, H)), "the Google window is closed afterwards");
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await fb({ on: false, running: false }); await p.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
