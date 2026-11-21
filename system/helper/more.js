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
