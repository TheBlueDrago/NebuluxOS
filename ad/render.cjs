// Renders the Nebulux OS ad. node render.cjs stills out.png t1 t2 ...   |   node render.cjs mp4 out.mp4 [seconds]
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), fs = require("fs"), path = require("path"), http = require("http");
const [mode, out, ...rest] = process.argv.slice(2), D = __dirname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4" };
(async () => {
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split("?")[0]);
    const f = u === "/music.mp4" ? "C:/bhai/nebulux-ad.mp4" : u === "/mp4-muxer.js" ? path.join(D, "node_modules/mp4-muxer/build/mp4-muxer.js") : path.join(D, u === "/" ? "ad.html" : u);
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 1800000 });
  const c = await b.createBrowserContext(), p = await c.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.setViewport({ width: 1920, height: 1080 }); await p.goto(base + "/", { waitUntil: "load" }); await p.evaluate(() => window.__ready);
  if (mode === "stills") {
    const ts = rest.map(Number), shots = [];
    for (const t of ts) shots.push([t, await p.evaluate((t, v) => window.__still(t, v), t, !!process.env.VERT)]);
    const cols = process.env.VERT ? 5 : 3, w = process.env.VERT ? 360 : 640, h = process.env.VERT ? 640 : 360, url = await p.evaluate(async (shots, cols, w, h) => { const rows = Math.ceil(shots.length / cols), cc = document.createElement("canvas"); cc.width = cols * w; cc.height = rows * (h + 26); const g = cc.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cc.width, cc.height);
      for (let i = 0; i < shots.length; i++) { const im = new Image(); im.src = shots[i][1]; await im.decode(); const X = (i % cols) * w, Y = Math.floor(i / cols) * (h + 26); g.drawImage(im, X, Y + 24, w - 4, h); g.fillStyle = "#000"; g.font = "16px sans-serif"; g.fillText(shots[i][0] + "s", X + 4, Y + 17); } return cc.toDataURL("image/jpeg", .85); }, shots, cols, w, h);
    fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64")); console.log("sheet", out);
  } else {
    const t0 = Date.now(); const r = await p.evaluate((u, s, br, v) => { if (br) window.BR = br; return window.__render(u, s, v); }, base + "/music.mp4", +rest[0] || 0, +process.env.BR || 0, !!process.env.VERT);
    console.log("rendered", JSON.stringify(r), "in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
    const fd = fs.openSync(out, "w"), N = 4 * 1024 * 1024; for (let at = 0; at < r.bytes; at += N) fs.writeSync(fd, Buffer.from(await p.evaluate((a, n) => window.__chunk(a, n), at, N), "base64")); fs.closeSync(fd);
    console.log("saved", out, (fs.statSync(out).size / 1048576).toFixed(1) + " MB");
  }
  console.log(errs.length ? "errors: " + errs.slice(0, 4).join(" | ") : "no errors");
  await c.close(); b.disconnect(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
