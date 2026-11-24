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
const listeners = new Set(); let pageMarked = false;
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

// the Wi-Fi or Bluetooth chip this computer has, by name (lspci and lsusb), or "" when there is none
async function chip(kind) {
  const re = kind === "wifi" ? /(network controller|wireless|wi-?fi|802\.11|wlan)/i : /bluetooth/i;
  const pci = await run("lspci", [], 5000), usb = await run("lsusb", [], 5000);
  const line = [...pci.out.split("\n"), ...usb.out.split("\n")].find((l) => re.test(l) && !(kind === "wifi" && /ethernet/i.test(l)));
  return line ? line.replace(/^[0-9a-f:.]+\s+|^Bus \d+ Device \d+: ID [0-9a-f:]+\s+/i, "").replace(/^[^:]*controller:\s*/i, "").replace(/\s*\(rev [^)]*\)/, "").trim().slice(0, 80) : "";
}

// ---------- made-up devices for tests ----------
const fakeStart = () => ({ wifiOn: true, conn: "Home Wi-Fi", nets: [{ ssid: "Home Wi-Fi", signal: 82, secure: true }, { ssid: "Cafe Guest", signal: 55, secure: false }, { ssid: "Neighbor 5G", signal: 31, secure: true }, { ssid: "School Net", signal: 64, secure: true, enterprise: true }],
  btOn: true, bt: [{ mac: "11:22:33:44:55:66", name: "Nebulux Earbuds", paired: false, connected: false }, { mac: "AA:BB:CC:DD:EE:01", name: "Wireless Mouse", paired: true, connected: true, battery: 64 }], vol: 60, bright: 80, power: null });
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
    const hw = (await run("nmcli", ["-t", "-f", "WIFI-HW", "general"])).out.trim();
    const on = radio.out.trim() === "enabled";
    const dev = await run("nmcli", ["-t", "-f", "TYPE", "device"]);
    const hasWifi = dev.out.split("\n").some((l) => l.trim() === "wifi");
    if (!hasWifi) {
      const c = await chip("wifi");
      return { on, device: false, connected: null, networks: [], error: c ? "This computer's Wi-Fi chip (" + c + ") has no driver in Nebulux OS yet. A network cable or a USB Wi-Fi adapter works." : "This computer has no Wi-Fi chip that Nebulux OS can see (virtual computers like QEMU have none). A network cable works." };
    }
    if (/disabled|missing/i.test(hw) && !on) return { on, device: true, connected: null, networks: [], error: "Wi-Fi is switched off on the computer itself. Press its Wi-Fi or airplane key (or slide its Wi-Fi switch), then turn Wi-Fi on here. No such key or switch? Use Troubleshoot below and press Try to fix." };
    if (!on) return { on, device: true, connected: null, networks: [] };
    const list = await run("nmcli", ["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "auto"], 20000);
    const seen = new Map();
    for (const line of list.out.split("\n")) {
      if (!line.trim()) continue; const [use, ssid, signal, sec] = nmSplit(line);
      if (!ssid) continue; const n = { ssid, signal: +signal || 0, secure: !!(sec && sec !== "--"), enterprise: /802.1X/i.test(sec || ""), active: use === "*" };
      const old = seen.get(ssid); if (!old || n.active || (!old.active && n.signal > old.signal)) seen.set(ssid, n);
    }
    const networks = [...seen.values()].sort((a, b) => (b.active - a.active) || (b.signal - a.signal)).slice(0, 30);
    const act = networks.find((n) => n.active);
    return { on, device: true, connected: act ? act.ssid : null, networks };
  },
  async "POST /wifi/radio"(b) {
    const on = !!b.on; if (FAKE) { fake.wifiOn = on; return { ok: true }; }
    if (on) { const u = await run("rfkill", ["unblock", "wifi"]); if (!u.ok) await run("sudo", ["-n", "/usr/local/sbin/nebulux-netfix", "unblock"]); }
    const r = await run("nmcli", ["radio", "wifi", on ? "on" : "off"]); if (!r.ok) throw new Error(cleanErr(r.err)); return { ok: true };
  },
  async "POST /wifi/connect"(b) {
    if (!okSSID(b.ssid)) throw new Error("That network name doesn't look right.");
    // school and work networks (WPA2/WPA3-Enterprise): a username and a password, the usual PEAP with MSCHAPv2
    if (b.username != null) {
      const user = String(b.username), pw = String(b.password || "");
      if (!user || user.length > 128 || /[\x00-\x1f]/.test(user)) throw new Error("Type your username.");
      if (!pw || pw.length > 128 || /[\x00-\x1f]/.test(pw)) throw new Error("Type your password.");
      if (FAKE) { if (b.ssid === "School Net" && !(user === "student" && pw === "schoolpass")) throw new Error("The username or password is wrong."); fake.conn = b.ssid; return { ok: true }; }
      await run("nmcli", ["connection", "delete", "id", b.ssid], 10000);
      const add = await run("nmcli", ["connection", "add", "type", "wifi", "con-name", b.ssid, "ssid", b.ssid, "wifi-sec.key-mgmt", "wpa-eap", "802-1x.eap", "peap", "802-1x.phase2-auth", "mschapv2", "802-1x.identity", user, "802-1x.password", pw], 20000);
      if (!add.ok) throw new Error(cleanErr(add.err));
      const up = await run("nmcli", ["connection", "up", "id", b.ssid], 60000);
      if (!up.ok) { await run("nmcli", ["connection", "delete", "id", b.ssid], 10000); const e = cleanErr(up.err + " " + up.out); throw new Error(/secrets|auth|password|802-1x/i.test(e) ? "The username or password is wrong." : e); }
      return { ok: true };
    }
    if (!okPass(b.password)) throw new Error("Wi-Fi passwords are 8 to 63 characters.");
    if (FAKE) { if (b.ssid === "Neighbor 5G" && b.password !== "rightpass1") throw new Error("The password is wrong."); fake.conn = b.ssid; return { ok: true }; }
    const args = ["device", "wifi", "connect", b.ssid]; if (b.password) args.push("password", b.password);
    const r = await run("nmcli", args, 45000);
    if (!r.ok) { const e = cleanErr(r.err + " " + r.out); throw new Error(/secrets were required|password/i.test(e) ? "The password is wrong, or the network needs one." : e); }
    return { ok: true };
  },
  // Mobile hotspot: this computer shares its internet over Wi-Fi (NetworkManager's hotspot)
  async "GET /hotspot"() {
    if (FAKE) return { on: !!fake.hotspot, name: fake.hotspot ? fake.hotspot.name : "", clients: fake.hotspot ? 1 : 0 };
    const act = (await run("nmcli", ["-t", "-f", "NAME,TYPE,DEVICE", "connection", "show", "--active"])).out.split("\n").map(nmSplit).find((x) => x[0] === "Hotspot");
    if (!act) return { on: false };
    const ssid = (await run("nmcli", ["-g", "802-11-wireless.ssid", "connection", "show", "Hotspot"])).out.trim();
    return { on: true, name: ssid, device: act[2] };
  },
  async "POST /hotspot"(b) {
    if (!b.on) { if (FAKE) { fake.hotspot = null; return { ok: true }; } await run("nmcli", ["connection", "down", "Hotspot"], 15000); return { ok: true }; }
    if (!okSSID(b.name)) throw new Error("Give the hotspot a name.");
    if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 63 || /[\x00-\x1f]/.test(b.password)) throw new Error("The hotspot password needs 8 to 63 characters.");
    if (FAKE) { if (!fake.wifiOn) throw new Error("Turn on Wi-Fi first."); fake.hotspot = { name: b.name }; return { ok: true }; }
    const dev = (await run("nmcli", ["-t", "-f", "DEVICE,TYPE", "device"])).out.split("\n").map(nmSplit).find((x) => x[1] === "wifi");
    if (!dev) throw new Error("This computer has no Wi-Fi to share with.");
    // The hotspot is made with settings every phone and Wi-Fi chip agrees on: WPA2 with AES only, no protected
    // management frames, 2.4 GHz channel 6. (NetworkManager's quick hotspot turns on options that Realtek RTW89 chips
    // handle badly, and phones then say the right password is wrong.)
    await run("nmcli", ["connection", "down", "Hotspot"], 10000); await run("nmcli", ["connection", "delete", "id", "Hotspot"], 10000);
    const add = await run("nmcli", ["connection", "add", "type", "wifi", "ifname", dev[0], "con-name", "Hotspot", "autoconnect", "no", "ssid", b.name,
      "802-11-wireless.mode", "ap", "802-11-wireless.band", "bg", "802-11-wireless.channel", "6",
      "ipv4.method", "shared", "ipv6.method", "ignore",
      "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.proto", "rsn", "wifi-sec.pairwise", "ccmp", "wifi-sec.group", "ccmp", "wifi-sec.pmf", "disable", "wifi-sec.psk", b.password], 20000);
    if (!add.ok) throw new Error(cleanErr(add.err));
    const r = await run("nmcli", ["connection", "up", "id", "Hotspot"], 40000);
    if (!r.ok) { await run("nmcli", ["connection", "delete", "id", "Hotspot"], 10000); throw new Error(/not support|AP mode|failed to|802-11-wireless/i.test(r.err) ? "This computer's Wi-Fi chip can't share a hotspot." : cleanErr(r.err)); }
    return { ok: true };
  },
  // the connected Wi-Fi network's details: signal, band and channel, speed, security, addresses
  async "GET /wifi/details"() {
    if (FAKE) return fake.conn ? { ssid: fake.conn, signal: 82, freq: 5180, band: "5 GHz", channel: 36, rate: "866 Mbit/s", security: "WPA2", ip: "192.168.1.42/24", gateway: "192.168.1.1", dns: ["192.168.1.1"], device: "wlp2s0", mac: "3C:21:9C:00:11:22" } : { ssid: null };
    const dev = (await run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE", "device"])).out.split("\n").map(nmSplit).find((x) => x[1] === "wifi" && /^connected/.test(x[2] || ""));
    if (!dev) return { ssid: null };
    const show = (await run("nmcli", ["-t", "-f", "GENERAL.CONNECTION,GENERAL.HWADDR,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS", "device", "show", dev[0]])).out;
    const get = (k) => show.split("\n").filter((l) => l.startsWith(k)).map((l) => l.slice(l.indexOf(":") + 1).replace(/\\:/g, ":"));
    const list = (await run("nmcli", ["-t", "-f", "IN-USE,SSID,SIGNAL,FREQ,RATE,SECURITY,CHAN", "device", "wifi", "list", "--rescan", "no"], 8000)).out.split("\n").map(nmSplit).find((x) => x[0] === "*") || [];
    const freq = parseInt(list[3], 10) || 0;
    return { ssid: list[1] || get("GENERAL.CONNECTION")[0] || null, signal: +list[2] || 0, freq, band: freq >= 5925 ? "6 GHz" : freq >= 4900 ? "5 GHz" : freq ? "2.4 GHz" : "", channel: +list[6] || 0, rate: list[4] || "", security: list[5] || "", ip: get("IP4.ADDRESS")[0] || "", gateway: get("IP4.GATEWAY")[0] || "", dns: get("IP4.DNS"), device: dev[0], mac: get("GENERAL.HWADDR")[0] || "" };
  },
  // Wi-Fi networks this computer remembers, forgetting one, and joining a hidden network
  async "GET /wifi/known"() {
    if (FAKE) return { known: (fake.known || ["Home Wi-Fi", "School Wi-Fi"]).slice() };
    const r = await run("nmcli", ["-t", "-f", "NAME,TYPE", "connection", "show"]);
    return { known: r.out.split("\n").map(nmSplit).filter((x) => x[1] === "802-11-wireless" && x[0]).map((x) => x[0]).slice(0, 60) };
  },
  async "POST /wifi/forget"(b) {
    if (!okSSID(b.name)) throw new Error("That network name doesn't look right.");
    if (FAKE) { fake.known = (fake.known || ["Home Wi-Fi", "School Wi-Fi"]).filter((n) => n !== b.name); return { ok: true }; }
    const r = await run("nmcli", ["connection", "delete", "id", b.name], 15000); if (!r.ok) throw new Error(cleanErr(r.err)); return { ok: true };
  },
  async "POST /wifi/hidden"(b) {
    if (!okSSID(b.ssid)) throw new Error("Type the network's name.");
    if (!okPass(b.password)) throw new Error("Wi-Fi passwords are 8 to 63 characters.");
    if (FAKE) { if (b.ssid !== "Hidden Lab") throw new Error("No network called " + b.ssid + " answered. Check the name (capital letters count)."); fake.conn = b.ssid; return { ok: true }; }
    const args = ["device", "wifi", "connect", b.ssid, "hidden", "yes"]; if (b.password) args.push("password", b.password);
    const r = await run("nmcli", args, 45000);
    if (!r.ok) { const e = cleanErr(r.err + " " + r.out); throw new Error(/no network with ssid|not found/i.test(e) ? "No network called " + b.ssid + " answered. Check the name (capital letters count)." : /secrets were required|password/i.test(e) ? "The password is wrong." : e); }
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
    if (!show.ok || /No default controller/i.test(show.out + show.err)) { const c = await chip("bt"); return { available: false, on: false, devices: [], chip: c, error: c ? "This computer's Bluetooth chip (" + c + ") isn't working in Nebulux OS yet." : "This computer has no Bluetooth chip that Nebulux OS can see (virtual computers like QEMU have none)." }; }
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
    await run("rfkill", ["unblock", "bluetooth"]); await run("bluetoothctl", ["pairable", "on"], 5000);
    await run("bluetoothctl", ["--timeout", "10", "scan", "on"], 14000);
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
  // the microphone: mute or unmute it (the laptop's microphone key)
  async "POST /mic"(b) {
    const mute = !!b.mute; if (FAKE) { fake.micMuted = mute; return { ok: true, muted: mute }; }
    const p = await run("pactl", ["set-source-mute", "@DEFAULT_SOURCE@", mute ? "1" : "0"], 4000);
    if (!p.ok) await run("amixer", ["-q", "sset", "Capture", mute ? "nocap" : "cap"], 4000);
    return { ok: true, muted: mute };
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
  // the time zone: read it, set it, or look it up once from this computer's internet address (when asked)
  async "GET /timezone"() {
    if (FAKE) return { zone: fake.tz || "UTC" };
    const r = await run("timedatectl", ["show", "-p", "Timezone", "--value"], 4000);
    return { zone: r.out.trim() || "UTC" };
  },
  async "POST /timezone"(b) {
    let zone = String(b.zone || "");
    if (b.detect) {
      if (FAKE) zone = "America/Chicago";
      else {
        const get = async (u, k) => { const c = new AbortController(), t = setTimeout(() => c.abort(), 6000); try { const r = await fetch(u, { signal: c.signal }); return r.ok ? (await r.json())[k] : ""; } catch (e) { return ""; } finally { clearTimeout(t); } };
        zone = (await get("https://ipapi.co/json/", "timezone")) || (await get("https://worldtimeapi.org/api/ip", "timezone"));
        if (!zone) throw new Error("The time zone couldn't be looked up. Check the internet connection, or pick it yourself.");
      }
    }
    if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(zone) || zone.includes("..")) throw new Error("That time zone doesn't look right.");
    if (FAKE) { fake.tz = zone; return { ok: true, zone }; }
    const r = await run("sudo", ["-n", "/usr/local/sbin/nebulux-netfix", "timezone", zone], 10000);
    if (!r.ok) throw new Error("The time zone couldn't be changed on this computer.");
    return { ok: true, zone };
  },
  // what the computer's power button does: sleep (the usual), shut down, or nothing
  async "POST /powerkey"(b) {
    const what = { sleep: "suspend", off: "poweroff", nothing: "ignore" }[b.what]; if (!what) throw new Error("Pick Sleep, Shut down or Nothing.");
    if (FAKE) { fake.powerkey = what; return { ok: true }; }
    const r = await run("sudo", ["-n", "/usr/local/sbin/nebulux-netfix", "powerkey", what], 10000); if (!r.ok) throw new Error("That couldn't be changed on this computer."); return { ok: true };
  },
  async "GET /battery"() {
    if (FAKE) return { present: true, percent: 76, charging: false, minutes: 205 };
    let list = []; try { list = fs.readdirSync("/sys/class/power_supply"); } catch (e) { return { present: false }; }
    for (const d of list) {
      const base = "/sys/class/power_supply/" + d, rd = (f) => { try { return fs.readFileSync(base + "/" + f, "utf8").trim(); } catch (e) { return ""; } };
      if (rd("type") !== "Battery" || rd("scope") === "Device") continue;
      const cap = +rd("capacity"); if (!(cap >= 0)) continue;
      const status = rd("status"), charging = /^(Charging|Full)$/.test(status);
      // time left (or until full): energy and power, or charge and current, whichever the battery reports
      const now = +rd("energy_now") || +rd("charge_now"), full = +rd("energy_full") || +rd("charge_full"), rate = Math.abs(+rd("power_now") || +rd("current_now"));
      let minutes = 0;
      if (rate > 0 && now > 0) minutes = Math.round(((status === "Charging" ? Math.max(0, full - now) : status === "Discharging" ? now : 0) / rate) * 60);
      return { present: true, percent: Math.min(100, cap), charging, minutes: minutes > 0 && minutes < 48 * 60 ? minutes : 0 };
    }
    return { present: false };
  },
  async "POST /diag"(b) {
    if (b.stage) { if (!FAKE) fs.appendFile("/dev/ttyS0", "NEBULUX-BOOT " + String(b.stage).replace(/[^a-z-]/g, "").slice(0, 20) + " at " + os.uptime().toFixed(1) + "s\n", () => {}); return { ok: true }; }
    const line = "NEBULUX-DIAG " + (b.open ? "open=" + String(b.open).replace(/[^a-z0-9-]/gi, "").slice(0, 20) : ["ext=" + (b.ext ? 1 : 0), "screen=" + (+b.w || 0) + "x" + (+b.h || 0), "native=1"].join(" ")) + "\n";
    if (!FAKE) fs.appendFile("/dev/ttyS0", line, () => {});
    if (!FAKE && !b.open && fs.existsSync("/dev/ttyS0")) {
      const tree = await run("xwininfo", ["-root", "-children"], 5000), mouse = await run("xdotool", ["getmouselocation", "--shell"], 3000), act = await run("xdotool", ["getactivewindow", "getwindowname"], 3000);
      const lines = tree.out.split("\n").filter((l) => /0x[0-9a-f]+/.test(l)).slice(0, 40).map((l) => "NEBULUX-X " + l.trim()).join("\n");
      fs.appendFile("/dev/ttyS0", lines + "\nNEBULUX-X mouse " + mouse.out.replace(/\n/g, " ") + " active=" + act.out.trim() + "\n", () => {});
      // what Wi-Fi and Bluetooth say on this computer
      try { const w = await api["GET /wifi"](), bt = await api["GET /bt"](); fs.appendFile("/dev/ttyS0", "NEBULUX-HW wifi: " + (w.error || (w.device ? (w.on ? "on, " + w.networks.length + " networks" : "off") : "no device")) + "\nNEBULUX-HW bluetooth: " + (bt.error || (bt.available ? (bt.on ? "on" : "off") : "none")) + "\n", () => {}); } catch (e) { /* skip */ }
      // the network troubleshooter's fixes are allowed (sudo answers with the script's usage, not a password prompt)
      try { const nf = await run("sudo", ["-n", "/usr/local/sbin/nebulux-netfix"], 5000); fs.appendFile("/dev/ttyS0", "NEBULUX-HW netfix: " + (/usage: nebulux-netfix/.test(nf.err + nf.out) ? "allowed" : "NOT allowed: " + (nf.err || nf.out).trim().slice(0, 120)) + "\n", () => {}); } catch (e) { /* skip */ }
      // how long start-up took, and its slowest parts (to make it faster)
      const t = await run("systemd-analyze", ["time"], 8000), bl = await run("systemd-analyze", ["blame", "--no-pager"], 8000);
      fs.appendFile("/dev/ttyS0", "NEBULUX-BOOT " + t.out.replace(/\n/g, " ") + "\n" + bl.out.split("\n").slice(0, 15).map((l) => "NEBULUX-BOOT " + l.trim()).join("\n") + "\nNEBULUX-BOOT page-ready-after " + Math.round(os.uptime()) + "s\n", () => {});
    }
    return { ok: true };
  },
  async "POST /mouse"(b) {
    const v = Math.max(0, Math.min(10, Math.round(+b.speed))); if (!(v >= 0)) throw new Error("Pick a speed."); const accel = (v / 5 - 1).toFixed(2);
    if (FAKE) { fake.mouse = v; return { ok: true }; }
    const ids = (await run("xinput", ["list", "--id-only"])).out.split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
    for (const id of ids) await run("xinput", ["set-prop", id, "libinput Accel Speed", accel], 3000); // devices without it just say no
    return { ok: true };
  },
  // the touchpad: tap to click, and which way two-finger scrolling moves the page
  async "POST /touchpad"(b) {
    const tap = b.tap !== false, natural = b.natural !== false;
    if (FAKE) { fake.touchpad = { tap, natural }; return { ok: true }; }
    const ids = (await run("xinput", ["list", "--id-only"])).out.split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
    for (const id of ids) { await run("xinput", ["set-prop", id, "libinput Tapping Enabled", tap ? "1" : "0"], 3000); await run("xinput", ["set-prop", id, "libinput Natural Scrolling Enabled", natural ? "1" : "0"], 3000); }
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
  for (const d of list) { d.paired = pairedSet.has(d.mac); d.connected = false; if (d.paired) { const i = await run("bluetoothctl", ["info", d.mac], 5000); d.connected = /Connected:\s*yes/i.test(i.out); const bp = /Battery Percentage:\s*\S+\s*\((\d+)\)/i.exec(i.out); if (bp) d.battery = Math.min(100, +bp[1]); } }
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
    const k = url.searchParams.get("k") || "";
    if (k === "close") { extra.closeActive().then((done) => { if (!done) pushEvent({ key: "close" }); }).catch(() => pushEvent({ key: "close" })); return send(res, 200, '{"ok":true}'); }
    if (/^[a-z0-9-]{2,12}$/.test(k)) pushEvent({ key: k });
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
    if (rel === "/index.html" && !FAKE && !pageMarked) { pageMarked = true; fs.appendFile("/dev/ttyS0", "NEBULUX-BOOT page-requested at " + os.uptime().toFixed(1) + "s\n", () => {}); }
    if (rel === "/index.html") data = Buffer.from(String(data).replace("<head>", `<head><script>window.NX_NATIVE=${JSON.stringify({ token: TOKEN, fake: FAKE })};</script>`));
    send(res, 200, data, TYPES[ext] || "application/octet-stream", { "Cache-Control": "no-cache" });
  });
});
server.on("error", (e) => { console.error("Nebulux helper:", e.message); process.exit(1); });
// never go down over one bad request: log it and keep serving (Wi-Fi, files and the rest keep working)
process.on("uncaughtException", (e) => console.error("Nebulux helper kept going after:", e && e.stack || e));
process.on("unhandledRejection", (e) => console.error("Nebulux helper kept going after:", e && e.stack || e));
server.listen(PORT, HOST, () => console.log("Nebulux helper on http://" + HOST + ":" + PORT + " serving " + WWW + (FAKE ? " (made-up devices)" : "")));

// waking up from sleep: the clock jumps ahead while the computer sleeps, so the OS is told and shows the lock screen
let lastTick = Date.now();
setInterval(() => { const now = Date.now(); if (now - lastTick > 30000) pushEvent({ resumed: Math.round((now - lastTick) / 1000) }); lastTick = now; }, 5000);
if (FAKE) api["POST /fake/resume"] = async () => { pushEvent({ resumed: 600 }); return { ok: true }; };
