// Plays the finished MP4 in the browser: length, size, sound, and stills decoded from the file itself.
const puppeteer = require("C:/nebulux-orbit/node_modules/puppeteer-core"), fs = require("fs"), http = require("http"), path = require("path");
const file = process.argv[2], out = process.argv[3], ts = process.argv.slice(4).map(Number);
(async () => {
  const srv = http.createServer((q, r) => { if (q.url === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end("<!doctype html><body>"); } const st = fs.statSync(file), m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || ""); if (m) { const a = +m[1], b = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { "content-type": "video/mp4", "content-range": `bytes ${a}-${b}/${st.size}`, "accept-ranges": "bytes", "content-length": b - a + 1 }); fs.createReadStream(file, { start: a, end: b }).pipe(r); } else { r.writeHead(200, { "content-type": "video/mp4", "content-length": st.size, "accept-ranges": "bytes" }); fs.createReadStream(file).pipe(r); } });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 600000 }); const c = await b.createBrowserContext(), p = await c.newPage();
  await p.goto(base + "/");
  const r = await p.evaluate(async (u, ts) => {
    const v = document.createElement("video"); v.src = u; v.muted = true; v.preload = "auto"; document.body.appendChild(v); await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error("can't play")); });
    const buf = await (await fetch(u)).arrayBuffer(); let audio = 0; try { audio = (await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(buf)).duration; } catch (e) { audio = -1; }
    const cc = document.createElement("canvas"), cols = 3, w = 640, h = 360; cc.width = cols * w; cc.height = Math.ceil(ts.length / cols) * (h + 26); const g = cc.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cc.width, cc.height);
    for (let i = 0; i < ts.length; i++) { v.currentTime = ts[i]; await new Promise((ok) => (v.onseeked = ok)); const X = (i % cols) * w, Y = Math.floor(i / cols) * (h + 26); g.drawImage(v, X, Y + 24, w - 4, h); g.fillStyle = "#000"; g.font = "16px sans-serif"; g.fillText(ts[i] + "s (from the mp4)", X + 4, Y + 17); }
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, audio, sheet: cc.toDataURL("image/jpeg", .85) };
  }, base + "/v.mp4", ts);
  fs.writeFileSync(out, Buffer.from(r.sheet.split(",")[1], "base64")); delete r.sheet; console.log(JSON.stringify(r));
  await c.close(); b.disconnect(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
