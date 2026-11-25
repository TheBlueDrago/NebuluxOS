// Every app opens: on the real-computer side (the system helper with NX_FAKE=1 and the OS extension, port 9334),
// each built-in app opens its window without errors, and every app from the web opens as its own app.
//   NX_FAKE=1 node system/helper/nebulux-helper.js .   then   node tests/allapps.cjs
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OS = "http://127.0.0.1:7777/";
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:" + (process.env.PORT || 9334), protocolTimeout: 120000 });
  for (const pg of await b.pages()) if (pg.url().startsWith(OS)) await pg.close();
  const p = await b.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setViewport({ width: 1366, height: 768 });
  await p.goto(OS + "?fast", { waitUntil: "load" }); await wait(800);
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "load" }); await wait(800);
  const H = await p.evaluate(() => ({ "x-nx": window.NX_NATIVE.token, "Content-Type": "application/json" }));
  await p.evaluate(async (h) => { await fetch("/api/fake/reset", { method: "POST", headers: h }); await fetch("/api/fake/webapps-on", { method: "POST", headers: h, body: JSON.stringify({ on: true }) }); }, H);
  await require("./setup.cjs")(p, "Ada", "nebula1");
  await p.evaluate(() => fetch("/api/webapp", { headers: { "x-nx": window.NX_NATIVE.token } }).then((r) => r.json()).then((r) => { NX.webAppOK = r.available; }));
  const ids = await p.evaluate(() => { const all = Object.keys(NX.apps); NX.setPref("installed", all.filter((id) => !NX.apps[id].builtIn)); return all; });
  const opened = () => p.evaluate(async () => (await (await fetch("/api/fake/webapps", { headers: { "x-nx": window.NX_NATIVE.token } })).json()).opened.map((a) => a.id));
  const badWin = [], badWeb = [], badErr = [];
  for (const id of ids) {
    const e0 = errs.length;
    const kind = await p.evaluate((id) => { const a = NX.apps[id]; return a.url || a.browser ? "web" : a.native && !a.url ? "native" : "win"; }, id);
    if (kind === "native") continue; // real Flathub apps: installed from the Store, checked in native.cjs
    await p.evaluate((id) => { NX.closeAll(); NX.open(id); }, id); await wait(kind === "web" ? 400 : 900);
    if (kind === "web") { if (!(await opened()).includes(id)) badWeb.push(id); }
    else if (!(await p.evaluate((id) => { const w = document.querySelector(`.win[data-app="${id}"]`); return !!w && w.querySelectorAll("*").length > 8; }, id))) badWin.push(id);
    if (errs.length > e0) badErr.push(id + ": " + errs[e0]);
  }
  await p.evaluate(() => NX.closeAll());
  ok(!badWin.length, "every built-in app opens its window " + badWin.join(", "));
  ok(!badWeb.length, "every app from the web opens as its own app " + badWeb.join(", "));
  ok(!badErr.length, "no app shows an error " + badErr.join(" | "));
  // an app that takes too long to show its window: the card offers Try again
  await p.evaluate(() => { const now = Date.now; NX.launchCard("twitch", "nebuluxapp-never-there"); window.__dn = now; Date.now = () => now() + 25000; });
  ok(await p.evaluate(async () => { await new Promise((r) => setTimeout(r, 1600)); const c = document.querySelector("#nx-launch .nl-slow"); Date.now = window.__dn; return !!c && /Try again/.test(c.textContent); }), "an app that's slow to open offers Try again");
  await p.evaluate(() => { const b = document.querySelector("#nx-launch [data-nl=wait]"); if (b) b.click(); });
  await p.evaluate(async (h) => fetch("/api/fake/webapps-on", { method: "POST", headers: h, body: JSON.stringify({ on: false }) }), H);
  await p.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
