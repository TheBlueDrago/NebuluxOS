// Nebulux OS system helper, part 2:
//   files (Documents, Downloads, Pictures, Music, Videos, Desktop, the Recycle Bin and plugged-in USB drives),
//   displays (a TV or monitor on HDMI: duplicate, second screen only, this screen only), sound output (speakers or
//   the TV), wireless casting to a Miracast TV, and screenshots.
// The computer's own drives are never shown or mounted: only removable drives, and never the Nebulux OS USB itself.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { spawn } = require("child_process");

module.exports = function more({ api, run, FAKE }) {
  // ---------- where files may live ----------
  const HOME = FAKE ? path.join(os.tmpdir(), "nx-fake-home") : os.homedir();
  const MEDIA = FAKE ? path.join(os.tmpdir(), "nx-fake-media") : path.join("/media", os.userInfo().username);
  const TRASH = path.join(HOME, ".local", "share", "Trash"), TFILES = path.join(TRASH, "files"), TINFO = path.join(TRASH, "info");
  const FOLDERS = ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"];
  for (const d of [...FOLDERS.map((f) => path.join(HOME, f)), path.join(HOME, "Pictures", "Screenshots"), TFILES, TINFO]) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) { /* read-only */ } }
  if (FAKE) seedFake();

  const real = (p) => { try { return fs.realpathSync(p); } catch (e) { return null; } };
  const ROOTS = () => [real(HOME), real(MEDIA)].filter(Boolean);
  const inside = (p, r) => p === r || p.startsWith(r + path.sep);
  // a path the OS may touch: inside the home folder or a USB drive, not hidden, after following links
  function safe(p, opts) {
    opts = opts || {};
    if (typeof p !== "string" || !p || p.length > 4096 || /\0/.test(p)) throw new Error("That place doesn't look right.");
    const abs = path.resolve(p);
    const r = opts.new ? (() => { const d = real(path.dirname(abs)); return d && path.join(d, path.basename(abs)); })() : real(abs);
    if (!r) throw new Error("That file or folder isn't there any more.");
    const root = ROOTS().find((x) => inside(r, x));
    if (!root) throw new Error("Nebulux OS only opens your own folders and USB drives.");
    if (path.relative(root, r).split(path.sep).some((s) => s.startsWith("."))) throw new Error("That's a hidden system folder.");
    if (opts.notRoot && isTop(r)) throw new Error("That folder can't be changed.");
    return r;
  }
  // the home folder, the drives folder, each drive's top folder and the main folders can't be renamed, moved or deleted
  const isTop = (r) => ROOTS().includes(r) || path.dirname(r) === real(MEDIA) || (path.dirname(r) === real(HOME) && FOLDERS.includes(path.basename(r)));
  const okName = (n) => typeof n === "string" && n.trim() === n && n.length > 0 && n.length <= 200 && !/[\\/\0\x00-\x1f]/.test(n) && n !== "." && n !== ".." && !n.startsWith(".");
  const nameErr = "Names can't be empty, start with a dot, or have / or \\ in them.";
  function unique(dir, name) {
    if (!fs.existsSync(path.join(dir, name))) return path.join(dir, name);
    const ext = path.extname(name), base = ext && ext !== name ? name.slice(0, -ext.length) : name;
    for (let i = 2; i < 1000; i++) { const t = path.join(dir, `${base} (${i})${ext}`); if (!fs.existsSync(t)) return t; }
    throw new Error("Too many files with that name.");
  }
  const KINDS = { image: /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i, video: /\.(mp4|webm|mkv|mov|m4v|ogv)$/i, audio: /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/i, text: /\.(txt|md|csv|json|log|ini|cfg|conf|xml|html?|css|js|py|sh|yml|yaml)$/i, pdf: /\.pdf$/i };
  const kindOf = (n, dir) => dir ? "folder" : Object.keys(KINDS).find((k) => KINDS[k].test(n)) || "file";
  const MIME = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif", ico: "image/x-icon", mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", ogv: "video/ogg", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac", aac: "audio/aac", opus: "audio/ogg", weba: "audio/webm", pdf: "application/pdf" };
  const entry = (dir, name) => { const p = path.join(dir, name); let st; try { st = fs.statSync(p); } catch (e) { return null; } const isDir = st.isDirectory(); return { name, path: p, dir: isDir, size: isDir ? null : st.size, mtime: st.mtimeMs, kind: kindOf(name, isDir) }; };

  api["GET /files/places"] = async () => ({ home: real(HOME), folders: FOLDERS.map((f) => ({ name: f, path: path.join(real(HOME), f) })), sep: path.sep });
  api["POST /files/list"] = async (b) => {
    const dir = safe(b.path); const st = fs.statSync(dir); if (!st.isDirectory()) throw new Error("That's a file, not a folder.");
    const names = fs.readdirSync(dir).filter((n) => !n.startsWith(".")).slice(0, 5000);
    const entries = names.map((n) => entry(dir, n)).filter(Boolean).sort((a, b2) => (b2.dir - a.dir) || a.name.localeCompare(b2.name, undefined, { numeric: true, sensitivity: "base" }));
    const root = ROOTS().find((x) => inside(dir, x));
    const parent = dir === root || path.dirname(dir) === real(MEDIA) ? null : path.dirname(dir); // a drive's top folder has nothing above it
    return { path: dir, name: path.basename(dir), parent, entries };
  };
  api["POST /files/read"] = async (b) => {
    const p = safe(b.path); const st = fs.statSync(p); if (st.isDirectory()) throw new Error("That's a folder.");
    if (st.size > 5 * 1048576) throw new Error("That file is too big to open as text (over 5 MB).");
    return { path: p, name: path.basename(p), text: fs.readFileSync(p, "utf8") };
  };
  api["POST /files/write"] = async (b) => {
    if (typeof b.text !== "string" || b.text.length > 5 * 1048576) throw new Error("That's too much text to save.");
    const p = safe(b.path, { new: true }); if (!okName(path.basename(p))) throw new Error(nameErr);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) throw new Error("There's a folder with that name.");
    fs.writeFileSync(p, b.text, "utf8"); return { path: p };
  };
  api["POST /files/new"] = async (b) => {
    const dir = safe(b.dir); if (!okName(b.name)) throw new Error(nameErr);
    const p = unique(dir, b.name); if (b.folder) fs.mkdirSync(p); else fs.writeFileSync(p, "", { flag: "wx" }); return { path: p, name: path.basename(p) };
  };
  api["POST /files/rename"] = async (b) => {
    const p = safe(b.path, { notRoot: true }); if (!okName(b.name)) throw new Error(nameErr);
    const t = path.join(path.dirname(p), b.name); if (t === p) return { path: p };
    if (fs.existsSync(t) && t.toLowerCase() !== p.toLowerCase()) throw new Error("There's already something called " + b.name + " here.");
    fs.renameSync(p, t); return { path: t };
  };
  const list = (ps) => { if (!Array.isArray(ps) || !ps.length || ps.length > 500) throw new Error("Pick some files first."); return ps.map((p) => safe(p, { notRoot: true })); };
  function moveTo(src, dest) { try { fs.renameSync(src, dest); } catch (e) { if (e.code !== "EXDEV") throw e; fs.cpSync(src, dest, { recursive: true, errorOnExist: true, force: false }); fs.rmSync(src, { recursive: true, force: true }); } }
  api["POST /files/delete"] = async (b) => {
    const ps = list(b.paths); let n = 0;
    for (const p of ps) {
      const onDrive = inside(p, real(MEDIA) || "\0");
      if (b.permanent || onDrive) { fs.rmSync(p, { recursive: true, force: true }); n++; continue; } // USB drives have no Recycle Bin, like Windows
      const id = path.basename(unique(TFILES, path.basename(p)));
      fs.writeFileSync(path.join(TINFO, id + ".trashinfo"), `[Trash Info]\nPath=${encodeURI(p)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`);
      moveTo(p, path.join(TFILES, id)); n++;
    }
    return { deleted: n };
  };
  api["GET /files/trash"] = async () => {
    const out = [];
    for (const id of fs.readdirSync(TFILES)) {
      let info = ""; try { info = fs.readFileSync(path.join(TINFO, id + ".trashinfo"), "utf8"); } catch (e) { /* no info */ }
      const from = decodeURI((/^Path=(.*)$/m.exec(info) || [])[1] || ""), when = (/^DeletionDate=(.*)$/m.exec(info) || [])[1] || "";
      const e = entry(TFILES, id); if (e) out.push(Object.assign(e, { id, path: null, from, deleted: when, name: path.basename(from) || id }));
    }
    return { entries: out.sort((a, b) => String(b.deleted).localeCompare(String(a.deleted))) };
  };
  const tid = (id) => { if (typeof id !== "string" || !id || id.includes("/") || id.includes("\\") || id.startsWith(".")) throw new Error("That item isn't in the Recycle Bin."); const p = path.join(TFILES, id); if (!fs.existsSync(p)) throw new Error("That item isn't in the Recycle Bin."); return p; };
  api["POST /files/restore"] = async (b) => {
    let n = 0;
    for (const id of b.ids || []) {
      const p = tid(id); let info = ""; try { info = fs.readFileSync(path.join(TINFO, id + ".trashinfo"), "utf8"); } catch (e) { /* none */ }
      let from = decodeURI((/^Path=(.*)$/m.exec(info) || [])[1] || ""); let dir;
      try { dir = safe(path.dirname(from)); } catch (e) { dir = path.join(real(HOME), "Documents"); }
      moveTo(p, unique(dir, path.basename(from) || id)); try { fs.rmSync(path.join(TINFO, id + ".trashinfo")); } catch (e) { /* none */ } n++;
    }
    return { restored: n };
  };
  api["POST /files/purge"] = async (b) => { for (const id of b.ids || []) { fs.rmSync(tid(id), { recursive: true, force: true }); fs.rmSync(path.join(TINFO, id + ".trashinfo"), { force: true }); } return { ok: true }; };
  api["POST /files/empty-trash"] = async () => { for (const d of [TFILES, TINFO]) for (const n of fs.readdirSync(d)) fs.rmSync(path.join(d, n), { recursive: true, force: true }); return { ok: true }; };
  api["POST /files/copy"] = async (b) => {
    const ps = list(b.paths), to = safe(b.to); if (!fs.statSync(to).isDirectory()) throw new Error("Paste into a folder.");
    const out = [];
    for (const p of ps) {
      if (inside(to, p)) throw new Error("A folder can't go inside itself.");
      const dest = b.move && path.dirname(p) === to ? p : unique(to, path.basename(p));
      if (b.move) { if (dest !== p) moveTo(p, dest); } else fs.cpSync(p, dest, { recursive: true, errorOnExist: true, force: false });
      out.push(dest);
    }
    return { paths: out };
  };
  api["POST /files/info"] = async (b) => { const p = safe(b.path); const e = entry(path.dirname(p), path.basename(p)); return Object.assign(e, { free: diskFree(p) }); };
  function diskFree(p) { try { const s = fs.statfsSync(p); return { free: s.bavail * s.bsize, total: s.blocks * s.bsize }; } catch (e) { return null; } }

  // ---------- raw files (pictures, music and videos play straight from here) ----------
  // Served with a sandbox policy, and web pages are shown as plain text, so a file can never run as part of the OS.
  function rawFile(req, res, url) {
    let p; try { p = safe(url.searchParams.get("path") || ""); } catch (e) { res.writeHead(404); return res.end(); }
    let st; try { st = fs.statSync(p); } catch (e) { res.writeHead(404); return res.end(); }
    if (st.isDirectory()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p).slice(1).toLowerCase(), type = MIME[ext] || (KINDS.text.test(p) ? "text/plain; charset=utf-8" : "application/octet-stream");
    const h = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'", "Content-Disposition": url.searchParams.get("dl") ? `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(p))}` : "inline" };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m) {
      let a = m[1] ? +m[1] : st.size - +m[2], z = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1; if (!m[1]) z = st.size - 1;
      if (a < 0 || a >= st.size || z < a) { res.writeHead(416, { "Content-Range": "bytes */" + st.size }); return res.end(); }
      res.writeHead(206, Object.assign(h, { "Content-Range": `bytes ${a}-${z}/${st.size}`, "Content-Length": z - a + 1 }));
      return fs.createReadStream(p, { start: a, end: z }).on("error", () => res.destroy()).pipe(res);
    }
    res.writeHead(200, Object.assign(h, { "Content-Length": st.size })); if (req.method === "HEAD") return res.end();
    fs.createReadStream(p).on("error", () => res.destroy()).pipe(res);
  }
  // saving a picture (Paint, screenshots) or any file the OS makes: POST /api/files/upload?dir=..&name=.. with the bytes
  function upload(req, res, url, send) {
    let dir, name = url.searchParams.get("name") || "";
    try { dir = safe(url.searchParams.get("dir") || ""); if (!okName(name)) throw new Error(nameErr); } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    const dest = unique(dir, name), tmp = dest + ".nxpart", w = fs.createWriteStream(tmp); let size = 0, failed = false;
    req.on("data", (c) => { size += c.length; if (size > 500 * 1048576) { failed = true; req.destroy(); w.destroy(); fs.rm(tmp, () => {}); send(res, 413, '{"error":"That file is too big (over 500 MB)."}'); } });
    req.pipe(w);
    w.on("finish", () => { if (failed) return; try { fs.renameSync(tmp, dest); send(res, 200, JSON.stringify({ path: dest, name: path.basename(dest) })); } catch (e) { send(res, 400, JSON.stringify({ error: e.message })); } });
    w.on("error", (e) => { if (!failed) send(res, 400, JSON.stringify({ error: e.message })); });
  }

  // ---------- USB drives ----------
  let fakeDrive = { dev: "/dev/sdb1", label: "MY USB", size: 16e9, fs: "vfat", mounted: path.join(MEDIA, "MY USB"), plugged: true };
  async function drives() {
    if (FAKE) return fakeDrive.plugged ? [{ dev: fakeDrive.dev, label: fakeDrive.label, size: fakeDrive.size, fs: fakeDrive.fs, mount: fakeDrive.mounted }] : [];
    const r = await run("lsblk", ["-J", "-b", "-o", "NAME,PATH,PKNAME,RM,HOTPLUG,TRAN,TYPE,LABEL,SIZE,MOUNTPOINT,FSTYPE"], 6000);
    let j; try { j = JSON.parse(r.out); } catch (e) { return []; }
    const live = await run("findmnt", ["-n", "-o", "SOURCE", "/run/live/medium"], 4000), bootPart = live.out.trim();
    const out = [], flat = [];
    (function walk(list, parent) { for (const d of list || []) { flat.push(Object.assign({ parentDisk: parent }, d)); walk(d.children, parent || d); } })(j.blockdevices, null);
    const bootDisk = (flat.find((d) => d.path === bootPart) || {}).parentDisk;
    for (const d of flat) {
      const disk = d.parentDisk || d; if (bootDisk && disk.path === bootDisk.path) continue; // never the Nebulux OS USB
      const removable = disk.rm === true || disk.rm === "1" || disk.hotplug === true || disk.hotplug === "1" || disk.tran === "usb";
      if (!removable || !d.fstype || !/^(vfat|exfat|ntfs|ntfs3|ext[234]|btrfs|iso9660|udf|hfsplus|f2fs)$/.test(d.fstype)) continue;
      if (d.type !== "part" && !(d.type === "disk" && !(d.children || []).length)) continue;
      out.push({ dev: d.path, label: d.label || "USB drive", size: +d.size || 0, fs: d.fstype, mount: d.mountpoint || null });
    }
    return out;
  }
  api["GET /drives"] = async () => ({ drives: await drives() });
  const findDrive = async (dev) => { const d = (await drives()).find((x) => x.dev === dev); if (!d) throw new Error("That drive isn't plugged in any more."); return d; };
  api["POST /drives/mount"] = async (b) => {
    const d = await findDrive(b.dev); if (d.mount) return { mount: d.mount };
    if (FAKE) { fakeDrive.mounted = path.join(MEDIA, "MY USB"); return { mount: fakeDrive.mounted }; }
    const r = await run("udisksctl", ["mount", "-b", d.dev, "--no-user-interaction"], 20000);
    const m = / at (.+?)\.?\s*$/m.exec(r.out); if (!r.ok || !m) throw new Error("The drive couldn't be opened. " + (r.err.split("\n")[0] || ""));
    return { mount: m[1] };
  };
  api["POST /drives/eject"] = async (b) => {
    const d = await findDrive(b.dev);
    if (FAKE) { fakeDrive.plugged = false; return { ok: true }; }
    if (d.mount) { const u = await run("udisksctl", ["unmount", "-b", d.dev, "--no-user-interaction"], 20000); if (!u.ok) throw new Error("A file on the drive is still open. Close it and try again."); }
    const pk = await run("lsblk", ["-n", "-o", "PKNAME", d.dev], 4000); const disk = pk.out.trim() ? "/dev/" + pk.out.trim().split("\n")[0] : d.dev;
    await run("udisksctl", ["power-off", "-b", disk, "--no-user-interaction"], 15000);
    return { ok: true };
  };

  // ---------- does this USB keep changes (a persistent partition made by Rufus)? ----------
  api["GET /system"] = async () => {
    if (FAKE) return { persistent: process.env.NX_FAKE_PERSIST !== "0" };
    let persistent = false;
    try { persistent = fs.readdirSync("/run/live/persistence").length > 0; } catch (e) { persistent = false; }
    if (!persistent) { const m = await run("findmnt", ["-n", "-o", "TARGET", "-t", "ext4,ext3,ext2,btrfs"], 4000); persistent = /\/run\/live\/persistence/.test(m.out); }
    return { persistent };
  };

  // ---------- what changed: screens plugged in or out, drives plugged in or out ----------
  api["GET /changes"] = async () => {
    if (FAKE) return { sig: (fakeDisp.tv ? "tv" : "") + (fakeDrive.plugged ? "usb" : "") };
    let sig = "";
    try { for (const d of fs.readdirSync("/sys/class/drm")) { if (!/-/.test(d)) continue; try { sig += d + "=" + fs.readFileSync("/sys/class/drm/" + d + "/status", "utf8").trim() + ";"; } catch (e) { /* no status */ } } } catch (e) { /* no screens info */ }
    try { sig += fs.readFileSync("/proc/partitions", "utf8").replace(/\s+/g, " "); } catch (e) { /* not Linux */ }
    try { sig += "|" + fs.readFileSync("/proc/self/mounts", "utf8").split("\n").filter((l) => l.includes("/media/")).length; } catch (e) { /* not Linux */ }
    return { sig };
  };

  // ---------- displays: a TV or monitor on HDMI ----------
  let fakeDisp = { tv: false, mode: "internal" };
  function parseXrandr(s) {
    const outs = []; let cur = null; const screen = /current (\d+) x (\d+)/.exec(s);
    for (const line of s.split("\n")) {
      let m = /^(\S+) (connected|disconnected)( primary)?( (\d+)x(\d+)\+(\d+)\+(\d+))?/.exec(line);
      if (m) { cur = { name: m[1], connected: m[2] === "connected", primary: !!m[3], active: !!m[4], w: +m[5] || 0, h: +m[6] || 0, x: +m[7] || 0, y: +m[8] || 0, modes: [] }; outs.push(cur); continue; }
      m = /^\s+(\d+)x(\d+)i?\s+(.*)$/.exec(line);
      if (m && cur) cur.modes.push({ w: +m[1], h: +m[2], current: m[3].includes("*"), preferred: m[3].includes("+") });
    }
    return { outs, screen: screen ? { w: +screen[1], h: +screen[2] } : null };
  }
  const isBuiltIn = (n) => /^(eDP|LVDS|DSI|eDP-?\d)/i.test(n);
  async function displays(probe) {
    if (FAKE) {
      const o = [{ name: "eDP-1", label: "Built-in screen", builtIn: true, active: fakeDisp.mode !== "external", w: 1920, h: 1080 }];
      if (fakeDisp.tv) o.push({ name: "HDMI-1", label: "TV or monitor (HDMI-1)", builtIn: false, active: fakeDisp.mode !== "internal", w: 3840, h: 2160 });
      return { outputs: o, mode: fakeDisp.tv ? fakeDisp.mode : "single", inner: "eDP-1", ext: fakeDisp.tv ? "HDMI-1" : undefined };
    }
    const r = await run("xrandr", probe ? ["--query"] : ["--current"], 8000); if (!r.ok) return { outputs: [], mode: "single", error: "Display control isn't available." };
    const { outs } = parseXrandr(r.out); const con = outs.filter((o) => o.connected);
    const inner = con.find((o) => isBuiltIn(o.name)) || con.find((o) => o.primary) || con[0], ext = con.find((o) => o !== inner);
    const label = (o) => o === inner ? (isBuiltIn(o.name) ? "Built-in screen" : "Main screen (" + o.name + ")") : "TV or monitor (" + o.name + ")";
    let mode = "single";
    if (inner && ext) mode = !ext.active ? "internal" : !inner.active ? "external" : (ext.x === inner.x && ext.y === inner.y ? "mirror" : "extend");
    return { outputs: con.map((o) => ({ name: o.name, label: label(o), builtIn: o === inner, active: o.active, w: o.w, h: o.h, best: (o.modes.find((m) => m.preferred) || o.modes[0] || {}) })), mode, inner: inner && inner.name, ext: ext && ext.name };
  }
  async function fitBrowser() {
    // there is no window manager, so the browser is moved and sized to the new screen by hand
    const r = await run("xrandr", ["--current"], 6000); const sc = parseXrandr(r.out).screen; if (!sc) return;
    const ids = (await run("xdotool", ["search", "--class", "NebuluxShell"], 5000)).out.split("\n").filter((x) => /^\d+$/.test(x.trim()));
    for (const id of ids) { await run("xdotool", ["windowmove", id, "0", "0"], 4000); await run("xdotool", ["windowsize", id, String(sc.w), String(sc.h)], 4000); }
  }
  api["POST /display/get"] = async (b) => displays(!!b.probe);
  api["POST /display/set"] = async (b) => {
    const mode = b.mode; if (!["mirror", "internal", "external"].includes(mode)) throw new Error("Pick how to use the screens.");
    if (FAKE) { if (!fakeDisp.tv) { if (mode === "internal") return displays(); throw new Error("No TV or monitor is plugged in. Plug it into the HDMI port and press Detect."); } fakeDisp.mode = mode; return displays(); }
    const d = await displays(true);
    if (!d.ext && mode === "internal" && d.inner) { await run("xrandr", ["--output", d.inner, "--auto", "--pos", "0x0", "--primary"], 15000); await fitBrowser(); return displays(); } // the TV was unplugged
    if (!d.inner || !d.ext) throw new Error("No TV or monitor is plugged in. Plug it into the HDMI port and press Detect.");
    const I = d.outputs.find((o) => o.name === d.inner), bw = I.best.w || I.w || 1920, bh = I.best.h || I.h || 1080;
    let args;
    if (mode === "mirror") args = ["--output", d.inner, "--auto", "--pos", "0x0", "--primary", "--output", d.ext, "--auto", "--same-as", d.inner, "--scale-from", bw + "x" + bh];
    if (mode === "internal") args = ["--output", d.inner, "--auto", "--pos", "0x0", "--primary", "--output", d.ext, "--off"];
    if (mode === "external") args = ["--output", d.ext, "--auto", "--pos", "0x0", "--primary", "--output", d.inner, "--off"];
    const r = await run("xrandr", args, 15000); if (!r.ok) throw new Error("The screens couldn't be changed. " + (r.err.split("\n")[0] || ""));
    await new Promise((ok) => setTimeout(ok, 700)); await fitBrowser();
    return displays();
  };
  api["POST /fake/tv"] = async (b) => { if (!FAKE) throw new Error("Not found"); fakeDisp.tv = !!b.on; if (!b.on) fakeDisp.mode = "internal"; return { ok: true }; };

  // ---------- sound output: the speakers, headphones or the TV ----------
  let fakeAudio = "speakers";
  async function audio() {
    if (FAKE) return { outputs: [{ id: "sink:speakers", label: "Speakers", active: fakeAudio === "speakers" }].concat(fakeDisp.tv ? [{ id: "sink:hdmi", label: "TV (HDMI)", active: fakeAudio === "hdmi" }] : []) };
    const sinks = await run("pactl", ["list", "sinks"], 6000), def = (await run("pactl", ["get-default-sink"], 4000)).out.trim(), cards = await run("pactl", ["list", "cards"], 6000);
    if (!sinks.ok) return { outputs: [] };
    const outs = [];
    for (const blk of sinks.out.split(/\n(?=Sink #)/)) { const n = /\n\s*Name: (.+)/.exec(blk), d = /\n\s*Description: (.+)/.exec(blk); if (n) outs.push({ id: "sink:" + n[1].trim(), label: (d ? d[1] : n[1]).trim().replace(/^Built-in Audio /, ""), active: n[1].trim() === def }); }
    // HDMI sound that needs the card switched to it (common on laptops)
    for (const blk of cards.out.split(/\n(?=Card #)/)) {
      const name = (/\n\s*Name: (.+)/.exec(blk) || [])[1], act = ((/\n\s*Active Profile: (.+)/.exec(blk) || [])[1] || "").trim(); if (!name) continue;
      const prof = /\n\s+(output:hdmi[^:\s]*)(?:\+input:[^:\s]*)?: ([^\n(]+)\(.*available: (yes|unknown)\)/g; let m;
      while ((m = prof.exec(blk))) { if (m[1] === act || outs.some((o) => /hdmi/i.test(o.id))) continue; outs.push({ id: "profile:" + name.trim() + "|" + m[1], label: m[2].trim().replace(/Digital Stereo \(HDMI\)( Output)?/, "TV or monitor (HDMI)"), active: false }); break; }
    }
    return { outputs: outs.slice(0, 12) };
  }
  api["GET /audio"] = async () => audio();
  api["POST /audio"] = async (b) => {
    const id = String(b.id || "");
    if (FAKE) { fakeAudio = /hdmi/.test(id) ? "hdmi" : "speakers"; return audio(); }
    if (!(await audio()).outputs.some((o) => o.id === id)) throw new Error("That sound output isn't there any more.");
    if (id.startsWith("profile:")) {
      const [card, prof] = id.slice(8).split("|"); const r = await run("pactl", ["set-card-profile", card, prof], 6000); if (!r.ok) throw new Error("The sound couldn't switch to the TV.");
      await new Promise((ok) => setTimeout(ok, 600)); const now = (await audio()).outputs.find((o) => /hdmi/i.test(o.id) && o.id.startsWith("sink:")); if (now) await run("pactl", ["set-default-sink", now.id.slice(5)], 4000);
    } else await run("pactl", ["set-default-sink", id.slice(5)], 4000);
    return audio();
  };

  // ---------- wireless display (Miracast) ----------
  let cast = null, fakeCast = false; const CAST = "/usr/bin/gnome-network-displays";
  const castWin = async () => (await run("xdotool", ["search", "--name", "Network Displays|gnome-network-displays"], 4000)).out.split("\n").filter((x) => /^\d+$/.test(x.trim()));
  api["GET /cast"] = async () => FAKE ? { available: true, running: fakeCast } : { available: fs.existsSync(CAST), running: !!(cast && cast.exitCode == null) };
  api["POST /cast/start"] = async () => {
    if (FAKE) { fakeCast = true; return { running: true }; }
    if (!fs.existsSync(CAST)) throw new Error("Wireless display isn't installed.");
    if (!(cast && cast.exitCode == null)) { cast = spawn(CAST, [], { detached: true, stdio: "ignore", env: Object.assign({}, process.env, { GDK_BACKEND: "x11" }) }); cast.unref(); }
    for (let i = 0; i < 20; i++) { await new Promise((ok) => setTimeout(ok, 300)); const w = await castWin(); if (w.length) { const sc = parseXrandr((await run("xrandr", ["--current"])).out).screen || { w: 1280 }; for (const id of w) { await run("xdotool", ["windowmove", id, String(Math.max(0, sc.w - 520)), "60"]); await run("xdotool", ["windowraise", id]); } break; } }
    return { running: true };
  };
  api["POST /cast/show"] = async () => { if (!FAKE) for (const id of await castWin()) { const sc = parseXrandr((await run("xrandr", ["--current"])).out).screen || { w: 1280 }; await run("xdotool", ["windowmove", id, String(Math.max(0, sc.w - 520)), "60"]); await run("xdotool", ["windowraise", id]); } return { ok: true }; };
  api["POST /cast/hide"] = async () => { if (!FAKE) for (const id of await castWin()) await run("xdotool", ["windowmove", id, "-4000", "-4000"]); return { ok: true }; };
  api["POST /cast/stop"] = async () => { if (FAKE) { fakeCast = false; return { running: false }; } try { if (cast) process.kill(-cast.pid); } catch (e) { /* gone */ } await run("pkill", ["-f", "gnome-network-displays"]); cast = null; return { running: false }; };

  // ---------- Task Manager: how busy the processor is, and memory ----------
  let lastCpu = null;
  api["GET /stats"] = async () => {
    const now = os.cpus().map((c) => c.times), sum = (t) => t.user + t.nice + t.sys + t.irq + t.idle;
    let cpu = null;
    if (lastCpu && lastCpu.length === now.length) { let busy = 0, all = 0; now.forEach((t, i) => { const d = sum(t) - sum(lastCpu[i]); all += d; busy += d - (t.idle - lastCpu[i].idle); }); cpu = all > 0 ? Math.round((busy / all) * 100) : 0; }
    lastCpu = now;
    let avail = os.freemem(); try { const mi = fs.readFileSync("/proc/meminfo", "utf8"); const m2 = /MemAvailable:\s+(\d+) kB/.exec(mi); if (m2) avail = +m2[1] * 1024; } catch (e) { /* not Linux */ }
    return { cpu, cores: now.length, model: ((os.cpus()[0] || {}).model || "").replace(/\s+/g, " ").trim(), memTotal: os.totalmem(), memUsed: os.totalmem() - avail, uptime: Math.round(os.uptime()) };
  };

  // ---------- the real web browser (Google, YouTube, websites) ----------
  // A full browser window with tabs, above Nebulux OS and just above its taskbar (the window manager keeps that strip
  // free). It has its own profile, so signing in to Google there stays signed in.
  let web = null; const WEBDIR = path.join(HOME, ".config", "nebulux-web");
  const browserOK = () => !FAKE && fs.existsSync("/usr/bin/chromium") && !!process.env.DISPLAY && fs.existsSync("/usr/bin/openbox");
  const webWins = async () => (await run("xdotool", ["search", "--class", "NebuluxWeb"], 4000)).out.split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
  api["GET /browser"] = async () => ({ available: browserOK(), running: !!(web && web.exitCode == null) });
  api["POST /browser/open"] = async (b) => {
    const url = String(b.url || ""); if (!/^https?:\/\/[^\s]{1,2000}$/i.test(url)) throw new Error("That web address doesn't look right.");
    if (!browserOK()) throw new Error("The web browser isn't available here.");
    const flags = (process.env.NX_BROWSER_FLAGS || "").split(" ").filter(Boolean);
    const p = spawn("chromium", ["--user-data-dir=" + WEBDIR, "--class=NebuluxWeb", "--no-first-run", "--no-default-browser-check", "--disable-session-crashed-bubble", "--password-store=basic", ...flags, b.app ? "--app=" + url : url], { detached: true, stdio: "ignore" });
    p.unref(); if (!(web && web.exitCode == null)) { web = p; p.on("exit", () => { if (web === p) web = null; }); }
    for (let k = 0; k < 15; k++) { await new Promise((ok) => setTimeout(ok, 300)); const w = await webWins(); if (w.length) { await run("xdotool", ["windowactivate", w[w.length - 1]], 4000); break; } }
    return { ok: true };
  };
  // the keyboard goes back to Nebulux OS when the browser steps aside (otherwise typing in Start went nowhere)
  const shellFocus = async () => { const s2 = (await run("xdotool", ["search", "--class", "NebuluxShell"], 4000)).out.split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)); for (const id of s2) { await run("xdotool", ["windowactivate", "--sync", id], 4000); await run("xdotool", ["windowfocus", id], 3000); } };
  api["POST /browser/show"] = async () => { const w = await webWins(); for (const id of w) { await run("xdotool", ["windowactivate", id], 4000); await run("xdotool", ["windowraise", id], 3000); } return { shown: w.length }; };
  api["POST /browser/hide"] = async () => { if (!(web && web.exitCode == null)) return { hidden: 0 }; const w = await webWins(); for (const id of w) await run("xdotool", ["windowminimize", id], 4000); await shellFocus(); return { hidden: w.length }; };
  api["POST /browser/toggle"] = async () => {
    const w = await webWins(); if (!w.length) return { running: false };
    const act = (await run("xdotool", ["getactivewindow"], 3000)).out.trim();
    if (w.includes(act)) { for (const id of w) await run("xdotool", ["windowminimize", id], 4000); await shellFocus(); return { running: true, shown: false }; }
    for (const id of w) await run("xdotool", ["windowactivate", id], 4000); return { running: true, shown: true };
  };

  // ---------- real apps (from Flathub, the Linux app store) ----------
  // Installed for this person (flatpak --user), started with flatpak run, and found on screen by their window class.
  const okApp = (s) => typeof s === "string" && /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+){2,}$/.test(s) && s.length < 120;
  const okWm = (s) => typeof s === "string" && /^[A-Za-z0-9._-]{1,60}$/.test(s);
  const FLATHUB = "https://dl.flathub.org/repo/flathub.flatpakrepo";
  let jobs = {}, fakeNative = new Set(), fakeRunning = new Set();
  const nativeList = async () => FAKE ? [...fakeNative] : (await run("flatpak", ["list", "--user", "--app", "--columns=application"], 15000)).out.split("\n").map((x) => x.trim()).filter(okApp);
  api["GET /native"] = async () => ({ available: FAKE || fs.existsSync("/usr/bin/flatpak"), installed: await nativeList(), jobs });
  api["POST /native/install"] = async (b) => {
    if (!okApp(b.app)) throw new Error("That app name doesn't look right.");
    if (jobs[b.app] && jobs[b.app].state === "installing") return jobs[b.app];
    jobs[b.app] = { state: "installing", started: Date.now(), msg: "Getting ready..." };
    if (FAKE) { setTimeout(() => { fakeNative.add(b.app); jobs[b.app] = { state: "done" }; }, 1500); return jobs[b.app]; }
    if (!fs.existsSync("/usr/bin/flatpak")) { jobs[b.app] = { state: "failed", msg: "App installs aren't available on this copy of Nebulux OS." }; return jobs[b.app]; }
    (async () => {
      const add = await run("flatpak", ["remote-add", "--user", "--if-not-exists", "flathub", FLATHUB], 60000);
      if (!add.ok) { jobs[b.app] = { state: "failed", msg: "Flathub couldn't be reached. Check the internet connection." }; return; }
      jobs[b.app].msg = "Downloading. The first app also downloads shared parts, so it can take a few minutes.";
      const p = spawn("flatpak", ["install", "--user", "-y", "--noninteractive", "flathub", b.app], { stdio: ["ignore", "pipe", "pipe"] });
      let tail = "";
      const take = (d) => { tail = (tail + d).slice(-2000); const m = /(\d{1,3})%/.exec(String(d)); if (m && jobs[b.app]) jobs[b.app].pct = Math.min(100, +m[1]); };
      p.stdout.on("data", take); p.stderr.on("data", take);
      p.on("error", () => { jobs[b.app] = { state: "failed", msg: "The installer couldn't start." }; });
      p.on("close", (code) => { jobs[b.app] = code === 0 ? { state: "done" } : { state: "failed", msg: /space|ENOSPC/i.test(tail) ? "There isn't enough space. On a USB that doesn't save changes, apps live in the computer's memory." : "The app couldn't be installed: " + (tail.trim().split("\n").pop() || "unknown error").slice(0, 160) }; });
    })();
    return jobs[b.app];
  };
  api["POST /native/uninstall"] = async (b) => {
    if (!okApp(b.app)) throw new Error("That app name doesn't look right.");
    if (FAKE) { fakeNative.delete(b.app); fakeRunning.delete(b.app); return { ok: true }; }
    await run("flatpak", ["uninstall", "--user", "-y", "--noninteractive", b.app], 180000); return { ok: true };
  };
  // the windows on screen with their class (one quick wmctrl call); a window id like 0x03a00004
  const windows = async () => FAKE ? [] : (await run("wmctrl", ["-lx"], 4000)).out.split("\n").map((l) => { const m = /^(0x[0-9a-f]+)\s+-?\d+\s+(\S+)/i.exec(l); return m ? { id: m[1], cls: m[2].toLowerCase() } : null; }).filter(Boolean);
  const mineOf = (all, wm) => { const w = String(wm || "").toLowerCase(); return w ? all.filter((x) => x.cls.split(".").includes(w)) : []; };
  const activeId = async () => +(await run("xdotool", ["getactivewindow"], 3000)).out.trim() || 0;
  api["POST /native/open"] = async (b) => {
    if (!okApp(b.app) || (b.wm && !okWm(b.wm))) throw new Error("That app name doesn't look right.");
    if (FAKE) { fakeRunning.add(b.wm || b.app); return { ok: true }; } // the made-up computer keeps window classes, like the real one
    const w = mineOf(await windows(), b.wm);
    if (w.length) { for (const x of w) await run("wmctrl", ["-i", "-a", x.id], 4000); return { ok: true, shown: true }; }
    const p = spawn("flatpak", ["run", b.app], { detached: true, stdio: "ignore" }); p.on("error", () => {}); p.unref();
    return { ok: true, started: true };
  };
  // which real apps have windows open (for the taskbar), and showing or hiding them from the taskbar
  api["POST /native/running"] = async (b) => {
    if (FAKE) return { running: Object.entries(b.apps || {}).filter(([, wm]) => fakeRunning.has(wm)).map(([app]) => app), active: [] };
    const all = await windows(), act = await activeId(), running = [], active = [];
    for (const [app, wm] of Object.entries(b.apps || {}).slice(0, 60)) { if (!okWm(wm)) continue; const mine = mineOf(all, wm); if (mine.length) { running.push(app); if (mine.some((x) => parseInt(x.id, 16) === act)) active.push(app); } }
    return { running, active };
  };
  api["POST /native/toggle"] = async (b) => {
    if (FAKE) return { ok: true };
    if (!okWm(b.wm)) throw new Error("That app name doesn't look right.");
    const w = mineOf(await windows(), b.wm); if (!w.length) return { running: false };
    const act = await activeId();
    if (w.some((x) => parseInt(x.id, 16) === act)) { for (const x of w) await run("xdotool", ["windowminimize", String(parseInt(x.id, 16))], 4000); await shellFocus(); return { running: true, shown: false }; }
    for (const x of w) await run("wmctrl", ["-i", "-a", x.id], 4000); return { running: true, shown: true };
  };
  api["POST /native/hide"] = async (b) => {
    if (FAKE) return { ok: true };
    const all = await windows(), act = await activeId();
    for (const wm of Object.values(b.apps || {}).slice(0, 60)) { if (!okWm(wm)) continue; for (const x of mineOf(all, wm)) if (parseInt(x.id, 16) === act || b.all) await run("xdotool", ["windowminimize", String(parseInt(x.id, 16))], 4000); }
    return { ok: true };
  };

  // ---------- the clipboard (for clipboard history): text copied in any app on the screen ----------
  let fakeClip = "";
  api["GET /clip"] = async () => {
    if (FAKE) return { text: fakeClip };
    const r = await run("xclip", ["-o", "-selection", "clipboard", "-t", "UTF8_STRING"], 2500);
    return { text: r.ok ? r.out.slice(0, 20000) : "" };
  };
  api["POST /clip"] = async (b) => {
    const text = String((b && b.text) || "").slice(0, 20000);
    if (FAKE) { fakeClip = text; return { ok: true }; }
    await new Promise((done) => {
      const p = spawn("xclip", ["-i", "-selection", "clipboard"], { stdio: ["pipe", "ignore", "ignore"] });
      p.on("error", () => done()); p.stdin.on("error", () => {}); p.stdin.end(text);
      setTimeout(done, 400); // xclip keeps running to hold the text; don't wait for it
    });
    return { ok: true };
  };
  if (FAKE) api["POST /fake/clip"] = async (b) => { fakeClip = String((b && b.text) || ""); return { ok: true }; };

  // ---------- virtual desktops: the window manager follows Nebulux OS (real apps stay on their desktop) ----------
  let fakeDesks = { count: 1, cur: 0 };
  api["POST /desks"] = async (b) => {
    const count = Math.max(1, Math.min(8, Math.round(+(b && b.count) || 1))), cur = Math.max(0, Math.min(count - 1, Math.round(+(b && b.cur) || 0)));
    if (FAKE) { fakeDesks = { count, cur }; return { ok: true }; }
    await run("wmctrl", ["-n", String(count)], 3000);
    await run("wmctrl", ["-s", String(cur)], 3000);
    return { ok: true };
  };
  if (FAKE) api["GET /fake/desks"] = async () => fakeDesks;

  // ---------- the network troubleshooter ----------
  // Checks, in order: is there a Wi-Fi chip, does it have a driver, did its firmware load, is it switched off, does
  // NetworkManager see it, is it connected, does the internet answer. Each check says what's wrong in plain words.
  // The report (everything it read) can be saved to Documents, to send to someone who can help.
  let lastNet = null;
  async function netRaw() {
    const t = (c, a, ms) => run(c, a, ms || 8000).then((r) => (r.out + (r.ok ? "" : r.err)).trim());
    const raw = {
      kernel: os.release(),
      pci: await t("lspci", ["-nnk"]),
      usb: await t("lsusb", []),
      rfkill: await t("rfkill", ["list"]),
      general: await t("nmcli", ["-t", "-f", "STATE,CONNECTIVITY,WIFI-HW,WIFI,NETWORKING", "general"]),
      devices: await t("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device"]),
      kernelLog: (await t("journalctl", ["-k", "-b", "--no-pager", "-o", "cat", "-n", "3000"], 10000)).split("\n").filter((l) => /firmware|rtw8|rtw89|iwlwifi|mt79|mt76|ath1[01]k|brcm|wlan|wlp|80211|bluetooth|btusb|btrtl/i.test(l)).slice(-60).join("\n"),
    };
    raw.modules = await t("sh", ["-c", "lsmod | grep -Ei 'rtw|iwl|mt7|ath|brcm|wl|cfg80211|bt' | head -40"]);
    return raw;
  }
  async function online() {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 7000);
    try { const r = await fetch("https://www.google.com/generate_204", { signal: ctl.signal }); return r.status === 204 || r.ok; } catch (e) { return false; } finally { clearTimeout(tm); }
  }
  function netChecks(raw, isOnline) {
    const out = [], add = (id, ok, title, detail) => out.push({ id, ok, title, detail });
    // the Wi-Fi chip, from lspci -nnk: its block shows "Kernel driver in use" when a driver took it
    const blocks = raw.pci.split(/\n(?=\S)/), wb = blocks.find((b) => /network controller|wireless|802\.11|wi-?fi/i.test(b.split("\n")[0]) && !/ethernet/i.test(b.split("\n")[0]));
    const usbWifi = raw.usb.split("\n").find((l) => /wireless|802\.11|wlan|wi-?fi/i.test(l));
    const chipName = wb ? wb.split("\n")[0].replace(/^[0-9a-f:.]+\s+/i, "").replace(/^[^:]*:\s*/, "").replace(/\s*\(rev [^)]*\)/, "").trim() : usbWifi ? usbWifi.replace(/^Bus \d+ Device \d+: ID [0-9a-f:]+\s+/i, "") : "";
    const tidy = (n) => n.replace(/\s*\[[0-9a-f]{4}:[0-9a-f]{4}\]/gi, "").replace(/\s*(Semiconductor|Technology)?\s*(Co\.,?\s*Ltd\.?|Corporation|Corp\.|Inc\.)/gi, "").replace(/\s+/g, " ").trim();
    const driver = wb ? ((wb.match(/Kernel driver in use:\s*(\S+)/) || [])[1] || "") : "";
    const devs = raw.devices.split("\n").map((l) => nm(l)).filter((d) => d[0]);
    const wifiDev = devs.find((d) => d[1] === "wifi"), eth = devs.find((d) => d[1] === "ethernet" && /^connected/.test(d[2] || ""));
    add("chip", !!chipName, chipName ? "Wi-Fi chip: " + tidy(chipName) : "No Wi-Fi chip found", chipName ? "" : "Nebulux OS can't see a Wi-Fi chip. Virtual computers (like QEMU) have none; on a real computer, a USB Wi-Fi adapter or a network cable works.");
    if (chipName && wb) add("driver", !!driver, driver ? "Driver: " + driver + " (Linux " + raw.kernel + ")" : "No driver for this chip", driver ? "" : "Linux " + raw.kernel + " has no driver for this chip. A newer Nebulux OS may add one; meanwhile a network cable or a USB Wi-Fi adapter works.");
    const fwFail = raw.kernelLog.split("\n").filter((l) => /firmware.*(fail|error|not found|missing)|failed to (load|request) firmware|direct firmware load .* failed/i.test(l));
    if (driver) add("firmware", !fwFail.length, fwFail.length ? "The chip's firmware didn't load" : "Firmware loaded", fwFail.length ? fwFail[0].slice(0, 200) : "");
    const hard = /Hard blocked:\s*yes/i.test(raw.rfkill.split(/\n(?=\d+:)/).filter((b) => /wireless lan|wlan/i.test(b)).join("\n"));
    const soft = /Soft blocked:\s*yes/i.test(raw.rfkill.split(/\n(?=\d+:)/).filter((b) => /wireless lan|wlan/i.test(b)).join("\n"));
    if (chipName) add("switch", !hard && !soft, hard ? "Wi-Fi is switched off on the computer" : soft ? "Wi-Fi is turned off" : "Wi-Fi is switched on", hard ? "Press the computer's Wi-Fi or airplane key (often F7 or Fn plus a key with an antenna), or slide its Wi-Fi switch." : soft ? "Press Try to fix, or turn Wi-Fi on in quick settings." : "");
    if (chipName) add("device", !!wifiDev, wifiDev ? "Wi-Fi is ready (" + wifiDev[0] + ")" : "Wi-Fi isn't ready", wifiDev ? "" : "The chip is there but no Wi-Fi device came up.");
    if (wifiDev) add("connected", /^connected/.test(wifiDev[2] || "") || !!eth, /^connected/.test(wifiDev[2] || "") ? "Connected to " + (wifiDev[3] || "Wi-Fi") : eth ? "Using a network cable" : "Not connected to a network", /^connected/.test(wifiDev[2] || "") || eth ? "" : "Open the Wi-Fi list and pick your network.");
    add("internet", isOnline, isOnline ? "The internet answers" : "The internet doesn't answer", isOnline ? "" : "Connected but no internet: the network may need a sign-in page, or the router may be offline.");
    const bad = out.find((c) => !c.ok);
    return { checks: out, ok: !bad, summary: bad ? bad.title : "Everything works", chip: tidy(chipName), driver };
  }
  const nm = (l) => { const o = []; let c = ""; for (let i = 0; i < l.length; i++) { if (l[i] === "\\" && i + 1 < l.length) c += l[++i]; else if (l[i] === ":") { o.push(c); c = ""; } else c += l[i]; } o.push(c); return o; };
  api["POST /net/diagnose"] = async (b) => {
    if (FAKE) {
      const raw = { kernel: "6.12.9+bpo-amd64", pci: "02:00.0 Network controller [0280]: Realtek Semiconductor Co., Ltd. RTL8852BE PCIe 802.11ax Wireless Network Controller [10ec:b852]\n\tKernel driver in use: rtw89_8852be\n\tKernel modules: rtw89_8852be", usb: "", rfkill: "0: phy0: Wireless LAN\n\tSoft blocked: no\n\tHard blocked: no", general: "connected:full:enabled:enabled:enabled", devices: "wlp2s0:wifi:connected:Home Wi-Fi", kernelLog: "rtw89_8852be 0000:02:00.0: loaded firmware rtw89/rtw8852b_fw-1.bin", modules: "rtw89_8852be" };
      if (b && b.fix) { /* nothing to fix in the made-up computer */ }
      lastNet = { raw, at: new Date().toISOString() }; return Object.assign(netChecks(raw, true), { fixed: !!(b && b.fix) });
    }
    if (b && b.fix) { await run("rfkill", ["unblock", "wifi"]); await run("nmcli", ["networking", "on"]); await run("nmcli", ["radio", "wifi", "on"]); await new Promise((r) => setTimeout(r, 2500)); }
    const raw = await netRaw(), isOnline = await online();
    lastNet = { raw, at: new Date().toISOString() };
    return Object.assign(netChecks(raw, isOnline), { fixed: !!(b && b.fix) });
  };
  api["POST /net/report"] = async () => {
    if (!lastNet) throw new Error("Run the troubleshooter first.");
    const r = lastNet.raw, file = path.join(HOME, "Documents", "Nebulux network report " + lastNet.at.slice(0, 19).replace(/[T:]/g, "-") + ".txt");
    const text = ["Nebulux OS network report", "Made " + lastNet.at, "Linux " + r.kernel, "",
      "== Chips (lspci -nnk) ==", r.pci, "", "== USB (lsusb) ==", r.usb, "", "== Switches (rfkill) ==", r.rfkill, "", "== NetworkManager ==", r.general, r.devices, "",
      "== Drivers loaded ==", r.modules, "", "== Kernel messages about Wi-Fi and Bluetooth ==", r.kernelLog, ""].join("\n");
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
    return { ok: true, path: "/Documents/" + path.basename(file) };
  };

  // ---------- updates: Nebulux OS updates itself ----------
  // An update is a small bundle of the Nebulux OS part of the system (its screens, apps, helper and browser add-on).
  // It's downloaded over https, checked against its sha256 fingerprint from the update feed, unpacked next to the
  // running copy, and switched to; the session starts on it, and goes back to the built-in copy if it doesn't start.
  const UPD = path.join(HOME, ".local", "share", "nebulux-update");
  const readTxt = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch (e) { return ""; } };
  const curVersion = () => readTxt(path.join(UPD, "current", "VERSION")) || readTxt("/opt/nebulux/VERSION") || "0";
  const feedURL = () => readTxt("/opt/nebulux/update-url");
  const ver = (v) => String(v || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let fakeUpd = { current: "3.1", latest: "3.2", installed: false }, updJob = null;
  async function readFeed() {
    const url = feedURL(); if (!/^https:\/\/\S+$/.test(url)) return null;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
    try { const r = await fetch(url, { signal: ctl.signal, redirect: "follow" }); if (r.status === 404) return { error: "No update has been published for this computer yet." }; if (!r.ok) return { error: "The update service answered " + r.status + "." }; const j = await r.json(); return j && typeof j.version === "string" ? j : { error: "The update service sent something unexpected." }; }
    catch (e) { return { error: "The update service couldn't be reached." }; } finally { clearTimeout(t); }
  }
  api["GET /update"] = async () => {
    if (FAKE) return { configured: true, current: fakeUpd.current, latest: fakeUpd.latest, available: newer(fakeUpd.latest, fakeUpd.current), notes: ["A made-up update for tests"], job: updJob };
    const current = curVersion(), f = await readFeed();
    if (!f) return { configured: false, current };
    if (f.error) return { configured: true, current, error: f.error, job: updJob };
    return { configured: true, current, latest: f.version, available: newer(f.version, current), notes: Array.isArray(f.notes) ? f.notes.slice(0, 30).map(String) : [], size: +f.size || 0, needsIso: !!f.needsIso, job: updJob };
  };
  if (FAKE) api["POST /fake/update-reset"] = async () => { fakeUpd = { current: "3.1", latest: "3.2" }; updJob = null; jobs = {}; fakeNative.clear(); fakeRunning.clear(); return { ok: true }; };
  api["POST /update/install"] = async () => {
    if (updJob && updJob.state === "installing") return updJob;
    updJob = { state: "installing", msg: "Downloading the update..." };
    if (FAKE) { setTimeout(() => { fakeUpd.current = fakeUpd.latest; updJob = { state: "done" }; }, 1200); return updJob; }
    (async () => {
      try {
        const f = await readFeed(); if (!f || f.error) throw new Error((f && f.error) || "Updates aren't set up on this copy of Nebulux OS.");
        if (!newer(f.version, curVersion())) { updJob = { state: "done", msg: "Nebulux OS is up to date." }; return; }
        if (!/^https:\/\/\S+$/.test(f.bundle || "") || !/^[0-9a-f]{64}$/i.test(f.sha256 || "")) throw new Error("The update's details are incomplete.");
        const r = await fetch(f.bundle, { redirect: "follow" }); if (!r.ok) throw new Error("The update couldn't be downloaded (" + r.status + ").");
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 200 * 1048576) throw new Error("The update is too big.");
        if (require("crypto").createHash("sha256").update(buf).digest("hex") !== f.sha256.toLowerCase()) throw new Error("The update didn't match its fingerprint, so it wasn't installed.");
        updJob.msg = "Installing...";
        const dir = path.join(UPD, "v" + String(f.version).replace(/[^0-9.]/g, "")), tmp = dir + ".part", file = path.join(UPD, "bundle.tar.gz");
        fs.mkdirSync(UPD, { recursive: true }); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true }); fs.writeFileSync(file, buf);
        const x = await run("tar", ["-xzf", file, "-C", tmp, "--no-same-owner"], 60000); fs.rmSync(file, { force: true });
        if (!x.ok) throw new Error("The update couldn't be unpacked.");
        if (readTxt(path.join(tmp, "VERSION")) !== String(f.version) || !fs.existsSync(path.join(tmp, "www", "index.html")) || !fs.existsSync(path.join(tmp, "helper", "nebulux-helper.js"))) throw new Error("The update is incomplete, so it wasn't installed.");
        fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
        const link = path.join(UPD, "current"), tl = link + ".new"; fs.rmSync(tl, { force: true }); fs.symlinkSync(dir, tl); fs.renameSync(tl, link);
        updJob = { state: "done", version: f.version, restart: true };
        // start again on the new version: the session restarts the helper and the screen
        setTimeout(() => { run("pkill", ["-f", "class=NebuluxShell"]); setTimeout(() => process.exit(0), 600); }, 1500);
      } catch (e) { updJob = { state: "failed", msg: e.message }; }
    })();
    return updJob;
  };

  // ---------- screenshots ----------
  api["POST /screenshot"] = async () => {
    const d = new Date(), pad = (n) => String(n).padStart(2, "0");
    const name = `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    const p = unique(path.join(real(HOME), "Pictures", "Screenshots"), name);
    if (FAKE) fs.writeFileSync(p, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    else { const r = await run("scrot", ["--overwrite", p], 10000); if (!r.ok) throw new Error("The screenshot couldn't be taken."); }
    return { path: p, name: path.basename(p) };
  };

  function seedFake() {
    const w = (p, s) => { const f = path.join(HOME, p); if (!fs.existsSync(f)) fs.writeFileSync(f, s); };
    w("Documents/Welcome.txt", "Welcome to Nebulux OS.\n");
    w("Pictures/Dot.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    fs.mkdirSync(path.join(MEDIA, "MY USB"), { recursive: true }); const u = path.join(MEDIA, "MY USB", "From my USB.txt"); if (!fs.existsSync(u)) fs.writeFileSync(u, "This file is on the USB drive.\n");
  }
  api["POST /fake/reset-files"] = async () => {
    if (!FAKE) throw new Error("Not found");
    for (const d of [HOME, MEDIA]) fs.rmSync(d, { recursive: true, force: true });
    for (const d of [...FOLDERS.map((f) => path.join(HOME, f)), path.join(HOME, "Pictures", "Screenshots"), TFILES, TINFO]) fs.mkdirSync(d, { recursive: true });
    fakeDrive = { dev: "/dev/sdb1", label: "MY USB", size: 16e9, fs: "vfat", mounted: path.join(MEDIA, "MY USB"), plugged: true }; fakeDisp = { tv: false, mode: "internal" }; fakeAudio = "speakers"; fakeCast = false;
    seedFake(); return { ok: true };
  };

  return { rawFile, upload, MEDIA_ROOT: () => real(MEDIA) };
};
