#!/usr/bin/env node
// Nebulux OS system helper. On the real (USB) Nebulux OS it serves the OS screens to the built-in browser on
// http://127.0.0.1:7777 and lets them control the real computer: Wi-Fi (NetworkManager), Bluetooth (BlueZ), volume,
// brightness, battery, restart / shut down, and (in more.js) files, USB drives, a TV on HDMI, sound output, wireless
// display and screenshots.
//
// Safety:
//  - It listens on 127.0.0.1 only, so other computers can't reach it.
//  - Every /api call needs this boot's random key. The key is only written into the OS page itself, so other websites
//    can't read it, and the Host header must be 127.0.0.1:7777, which stops DNS-rebinding tricks.
//  - Commands are run with argument lists (never through a shell), and every value is checked first.
//
// Usage: node nebulux-helper.js [www folder]   (NX_FAKE=1 gives made-up devices, for tests on any computer)
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os");
const { execFile } = require("child_process");

const PORT = +(process.env.NX_PORT || 7777), HOST = "127.0.0.1";
const WWW = path.resolve(process.argv[2] || path.join(__dirname, "..", "..")), FAKE = process.env.NX_FAKE === "1";
const TOKEN = crypto.randomBytes(24).toString("hex");
// a second key, in a file only this person can read, for the window manager's shortcut script (nebulux-key)
const LOCALKEY = crypto.randomBytes(24).toString("hex");
if (!FAKE) { try { fs.writeFileSync(path.join(os.homedir(), ".nebulux-key"), LOCALKEY, { mode: 0o600 }); fs.chmodSync(path.join(os.homedir(), ".nebulux-key"), 0o600); } catch (e) { /* no home folder */ } }
const listeners = new Set();
const pushEvent = (obj) => { const line = "data: " + JSON.stringify(obj) + "\n\n"; for (const r of listeners) { try { r.write(line); } catch (e) { listeners.delete(r); } } };
const TYPES = { ".webp": "image/webp", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };

// ---------- running commands ----------
function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeout || 15000, maxBuffer: 1 << 20, env: Object.assign({}, process.env, { LC_ALL: "C" }) }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ""), err: String(stderr || (err && err.message) || "") });
    });
  });
}
// nmcli -t splits fields with ":" and escapes ":" inside values as "\:"
const nmSplit = (line) => { const out = []; let cur = ""; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === "\\" && i + 1 < line.length) { cur += line[++i]; } else if (c === ":") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
const okSSID = (s) => typeof s === "string" && s.length > 0 && s.length <= 32 && !/[\x00-\x1f]/.test(s);
const okPass = (s) => s == null || s === "" || (typeof s === "string" && s.length >= 8 && s.length <= 63 && !/[\x00-\x1f]/.test(s));
const okMAC = (s) => typeof s === "string" && /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(s);
const pct = (n) => Math.max(0, Math.min(100, Math.round(+n || 0)));
const cleanErr = (s) => String(s || "").replace(/^Error:\s*/i, "").split("\n").filter(Boolean)[0] || "Something went wrong.";

// ---------- made-up devices for tests ----------
const fakeStart = () => ({ wifiOn: true, conn: "Home Wi-Fi", nets: [{ ssid: "Home Wi-Fi", signal: 82, secure: true }, { ssid: "Cafe Guest", signal: 55, secure: false }, { ssid: "Neighbor 5G", signal: 31, secure: true }],
  btOn: true, bt: [{ mac: "11:22:33:44:55:66", name: "Nebulux Earbuds", paired: false, connected: false }, { mac: "AA:BB:CC:DD:EE:01", name: "Wireless Mouse", paired: true, connected: true }], vol: 60, bright: 80, power: null });
let fake = fakeStart();

// ---------- the API ----------
const api = {
  async "GET /info"() {
    const cpu = (os.cpus()[0] || {}).model || "Unknown";
    return { kernel: FAKE ? "6.1.0-nebulux" : os.release(), arch: os.arch(), cpu: cpu.replace(/\s+/g, " ").trim(), threads: os.cpus().length, memoryGB: Math.round(os.totalmem() / 1073741824 * 10) / 10, host: os.hostname(), uptime: Math.round(os.uptime()) };
  },
  async "GET /wifi"() {
    if (FAKE) return { on: fake.wifiOn, device: true, connected: fake.wifiOn ? fake.conn : null, networks: fake.wifiOn ? fake.nets.map((n) => Object.assign({ active: n.ssid === fake.conn }, n)) : [] };
    const radio = await run("nmcli", ["-t", "radio", "wifi"]);
    if (!radio.ok) return { on: false, device: false, connected: null, networks: [], error: "Wi-Fi control isn't available on this computer." };
    const on = radio.out.trim() === "enabled";
    const dev = await run("nmcli", ["-t", "-f", "TYPE", "device"]);
    const hasWifi = dev.out.split("\n").some((l) => l.trim() === "wifi");
    if (!hasWifi) return { on, device: false, connected: null, networks: [] };
    if (!on) return { on, device: true, connected: null, networks: [] };
    const list = await run("nmcli", ["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "auto"], 20000);
    const seen = new Map();
    for (const line of list.out.split("\n")) {
      if (!line.trim()) continue; const [use, ssid, signal, sec] = nmSplit(line);
      if (!ssid) continue; const n = { ssid, signal: +signal || 0, secure: !!(sec && sec !== "--"), active: use === "*" };
      const old = seen.get(ssid); if (!old || n.active || (!old.active && n.signal > old.signal)) seen.set(ssid, n);
    }
    const networks = [...seen.values()].sort((a, b) => (b.active - a.active) || (b.signal - a.signal)).slice(0, 30);
    const act = networks.find((n) => n.active);
    return { on, device: true, connected: act ? act.ssid : null, networks };
  },
  async "POST /wifi/radio"(b) {
    const on = !!b.on; if (FAKE) { fake.wifiOn = on; return { ok: true }; }
    const r = await run("nmcli", ["radio", "wifi", on ? "on" : "off"]); if (!r.ok) throw new Error(cleanErr(r.err)); return { ok: true };
  },
  async "POST /wifi/connect"(b) {
    if (!okSSID(b.ssid)) throw new Error("That network name doesn't look right.");
    if (!okPass(b.password)) throw new Error("Wi-Fi passwords are 8 to 63 characters.");
    if (FAKE) { if (b.ssid === "Neighbor 5G" && b.password !== "rightpass1") throw new Error("The password is wrong."); fake.conn = b.ssid; return { ok: true }; }
    const args = ["device", "wifi", "connect", b.ssid]; if (b.password) args.push("password", b.password);
    const r = await run("nmcli", args, 45000);
    if (!r.ok) { const e = cleanErr(r.err + " " + r.out); throw new Error(/secrets were required|password/i.test(e) ? "The password is wrong, or the network needs one." : e); }
    return { ok: true };
  },
  async "POST /wifi/disconnect"() {
    if (FAKE) { fake.conn = null; return { ok: true }; }
    const dev = await run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE", "device"]);
    for (const line of dev.out.split("\n")) { const [d, t, s] = nmSplit(line); if (t === "wifi" && /^connected/.test(s || "")) await run("nmcli", ["device", "disconnect", d]); }
    return { ok: true };
  },
  async "GET /net"() {
    if (FAKE) return { online: true, kind: fake.conn ? "wifi" : "ethernet", name: fake.conn || "Wired" };
    const r = await run("nmcli", ["-t", "-f", "TYPE,STATE,CONNECTION", "device"]);
    for (const line of r.out.split("\n")) { const [t, s, c] = nmSplit(line); if ((t === "ethernet" || t === "wifi") && s === "connected") return { online: true, kind: t, name: c || (t === "wifi" ? "Wi-Fi" : "Wired") }; }
    return { online: false, kind: null, name: null };
  },
  async "GET /bt"() {
    if (FAKE) return { available: true, on: fake.btOn, devices: fake.btOn ? fake.bt.filter((d) => d.paired) : [] };
    const show = await run("bluetoothctl", ["show"], 6000);
    if (!show.ok || /No default controller/i.test(show.out + show.err)) return { available: false, on: false, devices: [] };
    const on = /Powered:\s*yes/i.test(show.out);
    return { available: true, on, devices: on ? await btList(true) : [] };
  },
  async "POST /bt/power"(b) {
    const on = !!b.on; if (FAKE) { fake.btOn = on; return { ok: true }; }
    if (on) await run("rfkill", ["unblock", "bluetooth"]);
    const r = await run("bluetoothctl", ["power", on ? "on" : "off"], 8000); if (!r.ok || /Failed/i.test(r.out)) throw new Error("Bluetooth couldn't be turned " + (on ? "on." : "off.")); return { ok: true };
  },
  async "POST /bt/scan"() {
    if (FAKE) return { devices: fake.bt };
    await run("bluetoothctl", ["--timeout", "8", "scan", "on"], 12000);
    return { devices: await btList(false) };
  },
  async "POST /bt/pair"(b) {
    if (!okMAC(b.mac)) throw new Error("That device address doesn't look right.");
    if (FAKE) { const d = fake.bt.find((x) => x.mac === b.mac); if (!d) throw new Error("That device isn't nearby any more."); d.paired = d.connected = true; return { ok: true }; }
    const p = await run("bluetoothctl", ["--timeout", "25", "pair", b.mac], 30000);
    if (!/Pairing successful|AlreadyExists/i.test(p.out + p.err)) throw new Error("Pairing didn't finish. Put the device in pairing mode and try again.");
    await run("bluetoothctl", ["trust", b.mac], 8000);
    await run("bluetoothctl", ["--timeout", "15", "connect", b.mac], 20000);
    return { ok: true };
  },
  async "POST /bt/remove"(b) {
    if (!okMAC(b.mac)) throw new Error("That device address doesn't look right.");
    if (FAKE) { const d = fake.bt.find((x) => x.mac === b.mac); if (d) d.paired = d.connected = false; return { ok: true }; }
    await run("bluetoothctl", ["remove", b.mac], 8000); return { ok: true };
  },
  async "GET /volume"() {
    if (FAKE) return { volume: fake.vol };
    const p = await run("pactl", ["get-sink-volume", "@DEFAULT_SINK@"], 4000); const pm = /(\d+)%/.exec(p.out); if (p.ok && pm) return { volume: +pm[1] };
    const r = await run("amixer", ["-M", "sget", "Master"]); const m = /\[(\d+)%\]/.exec(r.out); return { volume: m ? +m[1] : null };
  },
  async "POST /volume"(b) {
    const v = pct(b.volume); if (FAKE) { fake.vol = v; return { ok: true }; }
    const p = await run("pactl", ["set-sink-volume", "@DEFAULT_SINK@", v + "%"], 4000);
    if (p.ok) { await run("pactl", ["set-sink-mute", "@DEFAULT_SINK@", v ? "0" : "1"], 4000); return { ok: true }; }
    await run("amixer", ["-q", "-M", "sset", "Master", v + "%", v ? "unmute" : "mute"]); return { ok: true };
  },
  async "GET /brightness"() {
    if (FAKE) return { brightness: fake.bright };
    const r = await run("brightnessctl", ["-m"]); const m = /,(\d+)%,/.exec(r.out); return { brightness: r.ok && m ? +m[1] : null };
  },
  async "POST /brightness"(b) {
    const v = Math.max(5, pct(b.brightness)); if (FAKE) { fake.bright = v; return { ok: true }; }
    await run("brightnessctl", ["-q", "set", v + "%"]); return { ok: true };
  },
  async "POST /power"(b) {
    const kind = b.kind === "restart" ? "reboot" : b.kind === "off" ? "poweroff" : b.kind === "sleep" ? "suspend" : null; if (!kind) throw new Error("Unknown power choice.");
    if (FAKE) { fake.power = kind; return { ok: true }; }
    setTimeout(() => run("systemctl", [kind]), 300); return { ok: true };
  },
  async "GET /battery"() {
    if (FAKE) return { present: true, percent: 76, charging: false };
    let list = []; try { list = fs.readdirSync("/sys/class/power_supply"); } catch (e) { return { present: false }; }
    for (const d of list) {
      const base = "/sys/class/power_supply/" + d, rd = (f) => { try { return fs.readFileSync(base + "/" + f, "utf8").trim(); } catch (e) { return ""; } };
      if (rd("type") !== "Battery" || rd("scope") === "Device") continue;
      const cap = +rd("capacity"); if (!(cap >= 0)) continue;
      return { present: true, percent: Math.min(100, cap), charging: /^(Charging|Full)$/.test(rd("status")) };
    }
    return { present: false };
  },
  async "POST /diag"(b) {
    const line = "NEBULUX-DIAG " + (b.open ? "open=" + String(b.open).replace(/[^a-z0-9-]/gi, "").slice(0, 20) : ["ext=" + (b.ext ? 1 : 0), "screen=" + (+b.w || 0) + "x" + (+b.h || 0), "native=1"].join(" ")) + "\n";
    if (!FAKE) fs.appendFile("/dev/ttyS0", line, () => {});
    return { ok: true };
  },
  async "POST /mouse"(b) {
    const v = Math.max(0, Math.min(10, Math.round(+b.speed))); if (!(v >= 0)) throw new Error("Pick a speed."); const accel = (v / 5 - 1).toFixed(2);
    if (FAKE) { fake.mouse = v; return { ok: true }; }
    const ids = (await run("xinput", ["list", "--id-only"])).out.split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
    for (const id of ids) await run("xinput", ["set-prop", id, "libinput Accel Speed", accel], 3000); // devices without it just say no
    return { ok: true };
  },
  async "POST /keyboard"(b) {
    const k = String(b.layout || ""); if (!/^[a-z]{2,5}(-intl)?$/.test(k)) throw new Error("Unknown keyboard layout.");
    if (FAKE) { fake.kb = k; return { ok: true }; }
    const [layout, variant] = k.split("-"); const r = await run("setxkbmap", variant ? ["-layout", layout, "-variant", variant] : ["-layout", layout]);
    if (!r.ok) throw new Error("That keyboard layout couldn't be set."); return { ok: true };
  },
  async "POST /fake/key"(b) { if (!FAKE) throw new Error("Not found"); pushEvent({ key: String(b.key || "") }); return { ok: true }; },
  async "GET /fake"() { if (!FAKE) throw new Error("Not found"); return fake; },
  async "POST /fake/reset"() { if (!FAKE) throw new Error("Not found"); fake = fakeStart(); return { ok: true }; },
};
async function btList(pairedOnly) {
  const all = await run("bluetoothctl", ["devices"], 6000), paired = await run("bluetoothctl", ["devices", "Paired"], 6000);
  const parse = (s) => s.split("\n").map((l) => /^Device\s+(\S+)\s+(.*)$/.exec(l.trim())).filter(Boolean).map((m) => ({ mac: m[1], name: m[2].trim() }));
  const pairedSet = new Set(parse(paired.out).map((d) => d.mac));
  const list = (pairedOnly ? parse(paired.out) : parse(all.out)).filter((d) => okMAC(d.mac)).slice(0, 40);
  for (const d of list) { d.paired = pairedSet.has(d.mac); d.connected = false; if (d.paired) { const i = await run("bluetoothctl", ["info", d.mac], 5000); d.connected = /Connected:\s*yes/i.test(i.out); } }
  // devices with no real name show their address as the name; list named ones first
  return list.sort((a, b) => (b.paired - a.paired) || ((a.name.replace(/-/g, ":") === a.mac) - (b.name.replace(/-/g, ":") === b.mac)));
}

// ---------- files, USB drives, displays and TV, sound output, casting, screenshots ----------
const extra = require("./more.js")({ api, run, FAKE });

// ---------- the server ----------
function send(res, code, body, type, extra) { res.writeHead(code, Object.assign({ "Content-Type": type || "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, extra || {})); res.end(body); }
// the session's watchdog checks this file: the OS page loaded and is talking to the helper
let lastAlive = 0; const ALIVE = path.join(os.homedir(), ".nebulux-alive");
const alive = () => { if (FAKE || Date.now() - lastAlive < 5000) return; lastAlive = Date.now(); fs.writeFile(ALIVE, String(lastAlive), () => {}); };
const server = http.createServer((req, res) => {
  if (req.headers.host !== HOST + ":" + PORT && req.headers.host !== "localhost:" + PORT) return send(res, 403, '{"error":"Forbidden"}');
  const url = new URL(req.url, "http://" + HOST + ":" + PORT);
  if (url.pathname === "/health") return send(res, 200, '{"ok":true}');
  // shortcuts from the window manager (nebulux-key), sent on to the OS page
  if (url.pathname === "/local/key" && req.method === "POST") {
    if (req.headers["x-nx-local"] !== LOCALKEY) return send(res, 403, "");
    const k = url.searchParams.get("k") || ""; if (/^[a-z-]{2,12}$/.test(k)) pushEvent({ key: k });
    return send(res, 200, '{"ok":true}');
  }
  // the OS page listens here for shortcuts and other news from the system
  if (url.pathname === "/api/events" && req.method === "GET") {
    if (url.searchParams.get("k") !== TOKEN) return send(res, 403, "");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" }); res.write(": hi\n\n");
    listeners.add(res); const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) { /* closed */ } }, 25000);
    req.on("close", () => { listeners.delete(res); clearInterval(ping); });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    alive();
    // pictures, music and videos load straight into the page, so for them the key can come in the address
    if (url.pathname === "/api/files/raw" && (req.method === "GET" || req.method === "HEAD")) { if (url.searchParams.get("k") !== TOKEN && req.headers["x-nx"] !== TOKEN) return send(res, 403, ""); return extra.rawFile(req, res, url); }
    if (req.headers["x-nx"] !== TOKEN) return send(res, 403, '{"error":"Forbidden"}');
    if (url.pathname === "/api/files/upload" && req.method === "POST") return extra.upload(req, res, url, send);
    const fn = api[req.method + " " + url.pathname.slice(4)]; if (!fn) return send(res, 404, '{"error":"Not found"}');
    const limit = url.pathname === "/api/files/write" ? 6 * 1048576 : 65536;
    let raw = ""; req.on("data", (c) => { raw += c; if (raw.length > limit) req.destroy(); });
    req.on("end", async () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, '{"error":"Bad request"}'); }
      try { send(res, 200, JSON.stringify(await fn(body || {}))); } catch (e) { send(res, 400, JSON.stringify({ error: String(e && e.message || e) })); }
    });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "");
  let rel = decodeURIComponent(url.pathname); if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(WWW, "." + rel);
  if (!file.startsWith(WWW + path.sep) || /[\\/]\./.test(path.relative(WWW, file)) || /^(system|tests)[\\/]/.test(path.relative(WWW, file))) return send(res, 404, "Not found", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    const ext = path.extname(file).toLowerCase();
    if (rel === "/index.html") data = Buffer.from(String(data).replace("<head>", `<head><script>window.NX_NATIVE=${JSON.stringify({ token: TOKEN, fake: FAKE })};</script>`));
    send(res, 200, data, TYPES[ext] || "application/octet-stream", { "Cache-Control": "no-cache" });
  });
});
server.on("error", (e) => { console.error("Nebulux helper:", e.message); process.exit(1); });
// never go down over one bad request: log it and keep serving (Wi-Fi, files and the rest keep working)
process.on("uncaughtException", (e) => console.error("Nebulux helper kept going after:", e && e.stack || e));
process.on("unhandledRejection", (e) => console.error("Nebulux helper kept going after:", e && e.stack || e));
server.listen(PORT, HOST, () => console.log("Nebulux helper on http://" + HOST + ":" + PORT + " serving " + WWW + (FAKE ? " (made-up devices)" : "")));
