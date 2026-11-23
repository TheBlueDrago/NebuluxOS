// Saves the painted wallpapers from tools/wallgen.html as img/wall-6.jpg, wall-7.jpg, ...
// Run with Edge or Chrome on --remote-debugging-port=9333: node tools/wallgen.cjs
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), fs = require("fs"), path = require("path");
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 300000 }); const c = await b.createBrowserContext(), p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file:///" + path.join(__dirname, "wallgen.html").split(path.sep).join("/"), { waitUntil: "load" });
  const n = await p.evaluate(() => window.count);
  for (let i = 0; i < n; i++) {
    const url = await p.evaluate((i) => window.paint(i), i), out = path.join(__dirname, "..", "img", "wall-" + (6 + i) + ".jpg");
    fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64")); console.log("saved", path.basename(out), (fs.statSync(out).size / 1024).toFixed(0) + " KB");
  }
  console.log(errs.length ? "errors: " + errs.join(" | ") : "no errors");
  await c.close(); b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
