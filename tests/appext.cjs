// The app-window add-on (system/app-ext): an app's own links stay in its window, other sites don't.
// Start Edge or Chrome with --remote-debugging-port=9335 --load-extension=<repo>/system/app-ext, then: node tests/appext.cjs
const http = require("http"), puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGES = { "/a.html": '<!doctype html><a id=s href="/b.html" target="_blank">same</a> <a id=x href="https://example.com/" target="_blank">other</a> <button id=w onclick="window.open(\'/b.html\')">open</button> <button id=pop onclick="window.open(\'/b.html\', \'signin\', \'width=400,height=500\')">pop</button>', "/b.html": "<!doctype html><title>B</title>B" };
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
const srv = http.createServer((q, r) => { const b = PAGES[q.url.split("?")[0]]; r.writeHead(b ? 200 : 404, { "content-type": "text/html" }); r.end(b || ""); }).listen(8765, async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:" + (process.env.PORT || 9335) }), p = await b.newPage(), A = "http://127.0.0.1:8765/a.html";
  const tabs = async () => (await b.pages()).length;
  const tryIt = async (sel) => { await p.goto(A); await wait(400); const n = await tabs(); await p.click(sel); await wait(900); return { url: p.url(), more: (await tabs()) - n }; };
  let r = await tryIt("#s"); ok(/b\.html$/.test(r.url) && r.more === 0, "a link to the same site stays in the app window");
  r = await tryIt("#w"); ok(/b\.html$/.test(r.url) && r.more === 0, "window.open to the same site stays in the app window");
  r = await tryIt("#pop"); ok(/a\.html$/.test(r.url) && r.more === 1, "a sign-in pop-up (with a size) still opens");
  r = await tryIt("#x"); ok(/a\.html$/.test(r.url) && r.more === 1, "a link to another site is left alone");
  for (const pg of await b.pages()) if (pg !== p && /8765|example\.com/.test(pg.url())) await pg.close().catch(() => {});
  await p.close(); b.disconnect(); srv.close();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
});
