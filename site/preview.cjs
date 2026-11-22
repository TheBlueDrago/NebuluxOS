// Full-page pictures of the website (for checking before it goes live). Edge on 9333, site on 8797.
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.BASE || "http://127.0.0.1:8797", pages = (process.argv[2] || "/,/download,/features,/whats-new,/help").split(",");
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333" }); const c = await b.createBrowserContext(), p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  for (const [w, h, tag] of [[1440, 900, "desk"], [390, 844, "phone"]]) {
    await p.setViewport({ width: w, height: h });
    for (const u of pages) {
      await p.goto(BASE + u, { waitUntil: "networkidle0" }); await p.evaluate(async () => { document.querySelectorAll(".rise").forEach((e) => e.classList.add("in")); document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager")); for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); }); await wait(1200);
      const n = (u.replace(/\W+/g, "") || "home") + "-" + tag;
      await p.screenshot({ path: path.join(__dirname, "preview", n + ".jpg"), type: "jpeg", quality: 70, fullPage: true }); console.log("shot", n);
    }
  }
  console.log(errs.length ? "errors: " + errs.join(" | ") : "no page errors");
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
