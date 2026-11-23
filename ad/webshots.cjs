// Pictures of the Nebulux OS website for the ad (the live site, with the owner pass), 1920x1080.
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), crypto = require("crypto"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "https://nebuluxos.thebluedragonstriker.workers.dev", OUT = path.join(__dirname, "shots");
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333" }); const c = await b.createBrowserContext(), p = await c.newPage();
  await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.2 });
  await p.setCookie({ name: "nxos_owner", value: crypto.createHash("sha256").update("nebuluxos-owner:nebuluxaiistuff").digest("hex"), domain: "nebuluxos.thebluedragonstriker.workers.dev", path: "/", secure: true, httpOnly: true });
  const open = async (u) => { await p.goto(BASE + u, { waitUntil: "networkidle0" }); await p.evaluate(async () => { document.querySelectorAll(".rise").forEach((e) => e.classList.add("in")); document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager")); for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } scrollTo(0, 0); }); await p.addStyleTag({ content: "html{scrollbar-width:none}::-webkit-scrollbar{display:none}" }); await wait(1200); };
  const at = async (name, sel, off) => { await p.evaluate((s, o) => { const e = s ? document.querySelector(s) : null; scrollTo(0, e ? e.getBoundingClientRect().top + scrollY - (o || 0) : 0); }, sel, off); await wait(500); await p.screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 92 }); console.log("shot", name); };
  await open("/");
  await at("web-hero", null);
  await at("web-device", "#hero-device", 120);
  await at("web-new", "#new", 40);
  await at("web-compare", "#compare", 20);
  await p.evaluate(() => { document.querySelector(".nav").style.position = "static"; });
  await p.screenshot({ path: path.join(OUT, "web-full.jpg"), type: "jpeg", quality: 85, fullPage: true }); console.log("shot web-full");
  // where the ad's website clip stops (in the picture's pixels: page pixels times the 1.2 scale)
  const stops = await p.evaluate(() => { scrollTo(0, 0); const top = (s) => { const e = document.querySelector(s); return e ? Math.round((e.getBoundingClientRect().top + scrollY - 40) * 1.2) : 0; }; const d = document.querySelector(".nav .btn.primary").getBoundingClientRect(); return { device: top("#hero-device"), new: top("#new"), compare: top("#compare"), dl: [Math.round((d.left + d.width / 2) * 1.2), Math.round((d.top + scrollY + d.height / 2) * 1.2)] }; });
  require("fs").writeFileSync(path.join(OUT, "web-stops.json"), JSON.stringify(stops)); console.log("stops", JSON.stringify(stops));
  await open("/download");
  await at("web-download", null);
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
