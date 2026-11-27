// File Explorer, Photos, Media Player and Snipping Tool.
// On the real Nebulux OS (from the USB) they use the computer's real files: your folders (Desktop, Documents,
// Downloads, Pictures, Music, Videos), the Recycle Bin and plugged-in USB drives. In a browser tab they use a small
// file store kept with your account in this browser.
"use strict";
(function () {
  const A = NX.apps, FOLDERS = ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"];
  const KINDS = { image: /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i, video: /\.(mp4|webm|mkv|mov|m4v|ogv)$/i, audio: /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/i, text: /\.(txt|md|csv|json|log|ini|cfg|conf|xml|html?|css|js|py|sh|yml|yaml|srt|vtt)$/i, pdf: /\.pdf$/i };
  const kindOf = (n, dir) => dir ? "folder" : Object.keys(KINDS).find((k) => KINDS[k].test(n)) || "file";
  const FOLD = { Desktop: "fdesk", Documents: "fdocs", Downloads: "fdl", Pictures: "fpics", Music: "fmusic", Videos: "fvids" };
  const iconOf = (e) => (e.dir && FOLD[e.name]) || (!e.dir && /\.zip$/i.test(e.name || "") && "fzip") || ICON[e.kind] || "file";
  const ICON = { folder: "folder", image: "fimage", video: "fvideo", audio: "faudio", text: "ftext", pdf: "fpdf", file: "file" };
  const size = (b) => b == null ? "" : b < 1024 ? b + " bytes" : b < 1048576 ? (b / 1024).toFixed(b < 10240 ? 1 : 0) + " KB" : b < 1073741824 ? (b / 1048576).toFixed(1) + " MB" : (b / 1073741824).toFixed(2) + " GB";
  const when = (t) => t ? new Date(t).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const okName = (n) => typeof n === "string" && n.trim() === n && n.length > 0 && n.length <= 200 && !/[\\/\0\x00-\x1f]/.test(n) && n !== "." && n !== ".." && !n.startsWith(".");
  const NAME_ERR = "Names can't be empty, start with a dot, or have / or \\ in them.";

  // ---------- files in a browser tab: a small store kept with your account ----------
  const L = (function () {
    const now = () => Date.now();
    const seed = () => { const m = { "/": { d: 1, m: now() } }; for (const f of FOLDERS) m["/" + f] = { d: 1, m: now() }; m["/Documents/Welcome.txt"] = { t: "Welcome to Nebulux OS.\n\nThis is File Explorer. Make folders and text files, and open them in Notepad.\n", m: now() }; return m; };
    const map = () => { const v = NX.data("vfs", null); return v && v["/"] ? v : seed(); };
    const save = (m) => { try { NX.setData("vfs", m); } catch (e) { throw new Error("This browser is out of room for files. Delete some, or use the real Nebulux OS from the USB."); } };
    const parent = (p) => p === "/" ? null : p.slice(0, p.lastIndexOf("/")) || "/";
    const join = (d, n) => (d === "/" ? "" : d) + "/" + n;
    const base = (p) => p.slice(p.lastIndexOf("/") + 1);
    const kids = (m, d) => Object.keys(m).filter((k) => k !== "/" && parent(k) === d);
    const tree = (m, p) => Object.keys(m).filter((k) => k === p || k.startsWith(p + "/"));
    const uniq = (m, d, n) => { if (!m[join(d, n)]) return join(d, n); const i = n.lastIndexOf("."), b = i > 0 ? n.slice(0, i) : n, e = i > 0 ? n.slice(i) : ""; for (let k = 2; k < 1000; k++) if (!m[join(d, `${b} (${k})${e}`)]) return join(d, `${b} (${k})${e}`); throw new Error("Too many files with that name."); };
    const ent = (m, k) => ({ name: base(k), path: k, dir: !!m[k].d, size: m[k].d ? null : (m[k].t != null ? new Blob([m[k].t]).size : m[k].s || 0), mtime: m[k].m, kind: kindOf(base(k), m[k].d) });
    const top = (p) => p === "/" || (parent(p) === "/" && FOLDERS.includes(base(p)));
    const need = (m, p, dir) => { if (!m[p]) throw new Error("That file or folder isn't there any more."); if (dir != null && !!m[p].d !== dir) throw new Error(dir ? "That's a file, not a folder." : "That's a folder."); return m[p]; };
    return {
      async places() { map(); return { home: "/", folders: FOLDERS.map((f) => ({ name: f, path: "/" + f })), sep: "/" }; },
      async list(p) { const m = map(); need(m, p, true); return { path: p, name: p === "/" ? "Home" : base(p), parent: parent(p), entries: kids(m, p).map((k) => ent(m, k)).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })) }; },
      // words inside text files: up to 10 files, with a bit of text around the word
      async searchText(q) { const m = map(), ql = String(q).toLowerCase(), out = []; for (const [k, n] of Object.entries(m)) { if (n.d || n.t == null || k.split("/").some((x) => x.startsWith("."))) continue; const i = n.t.toLowerCase().indexOf(ql); if (i >= 0) out.push({ name: base(k), path: k, snippet: n.t.slice(Math.max(0, i - 30), i + ql.length + 40).replace(/\s+/g, " ").trim() }); if (out.length >= 10) break; } return out; },
      async read(p) { const m = map(), n = need(m, p, false); if (n.t == null) throw new Error("That isn't a text file."); return n.t; },
      async write(p, text) { const m = map(); need(m, parent(p), true); if (m[p] && m[p].d) throw new Error("There's a folder with that name."); m[p] = { t: String(text), m: now() }; save(m); return { path: p }; },
      async create(dir, name, folder) { if (!okName(name)) throw new Error(NAME_ERR); const m = map(); need(m, dir, true); const p = uniq(m, dir, name); m[p] = folder ? { d: 1, m: now() } : { t: "", m: now() }; save(m); return { path: p, name: base(p) }; },
      async rename(p, name) { if (!okName(name)) throw new Error(NAME_ERR); const m = map(); need(m, p); if (top(p)) throw new Error("That folder can't be changed."); const t = join(parent(p), name); if (t === p) return { path: p }; if (m[t]) throw new Error("There's already something called " + name + " here."); for (const k of tree(m, p)) { m[t + k.slice(p.length)] = m[k]; delete m[k]; } save(m); return { path: t }; },
      async remove(paths, permanent) {
        const m = map(), bin = NX.data("vfs-trash", []);
        for (const p of paths) { need(m, p); if (top(p)) throw new Error("That folder can't be deleted."); const part = {}; for (const k of tree(m, p)) { part[k.slice(p.length) || "."] = m[k]; delete m[k]; } if (!permanent) bin.unshift({ id: "t" + now().toString(36) + Math.random().toString(36).slice(2, 6), from: p, deleted: new Date().toISOString().slice(0, 19), nodes: part }); }
        save(m); NX.setData("vfs-trash", bin.slice(0, 200)); return { deleted: paths.length };
      },
      async trash() { return { entries: NX.data("vfs-trash", []).map((t) => { const n = t.nodes["."] || {}; return { id: t.id, name: base(t.from), from: t.from, deleted: t.deleted, dir: !!n.d, size: n.d ? null : (n.t != null ? new Blob([n.t]).size : n.s || 0), kind: kindOf(base(t.from), n.d), mtime: n.m }; }) }; },
      async restore(ids) {
        const m = map(); let bin = NX.data("vfs-trash", []);
        for (const id of ids) { const t = bin.find((x) => x.id === id); if (!t) continue; let d = parent(t.from); if (!m[d] || !m[d].d) d = "/Documents"; const to = uniq(m, d, base(t.from)); for (const k of Object.keys(t.nodes)) m[k === "." ? to : to + k] = t.nodes[k]; bin = bin.filter((x) => x !== t); }
        save(m); NX.setData("vfs-trash", bin); return { restored: ids.length };
      },
      async emptyTrash() { NX.setData("vfs-trash", []); return { ok: true }; },
      async copy(paths, to, move) {
        const m = map(); need(m, to, true); const out = [];
        for (const p of paths) { need(m, p); if (to === p || to.startsWith(p + "/")) throw new Error("A folder can't go inside itself."); if (move && top(p)) throw new Error("That folder can't be moved."); if (move && parent(p) === to) { out.push(p); continue; } const dest = uniq(m, to, base(p)); for (const k of tree(m, p)) { m[dest + k.slice(p.length)] = JSON.parse(JSON.stringify(m[k])); if (move) delete m[k]; } out.push(dest); }
        save(m); return { paths: out };
      },
      async url(p) { const m = map(), n = need(m, p, false); if (n.u) return n.u; return "data:text/plain;charset=utf-8," + encodeURIComponent(n.t || ""); },
      async upload(dir, name, blob) {
        if (blob.size > 3 * 1048576) throw new Error("That's too big to keep in the browser (over 3 MB).");
        const u = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The file couldn't be read.")); r.readAsDataURL(blob); });
        const m = map(); need(m, dir, true); const p = uniq(m, dir, name); m[p] = { u, s: blob.size, m: now() }; save(m); return { path: p, name: base(p) };
      },
      // Compress to ZIP file, and Extract all (files kept in the browser are stored as they are, not packed smaller)
      async zip(paths) {
        const m = map(), files = [];
        for (const p of paths) { need(m, p); for (const k of tree(m, p).sort()) { const rel = base(p) + k.slice(p.length); files.push(m[k].d ? { name: rel + "/", data: new Uint8Array(0), mt: m[k].m } : { name: rel, data: await bytesOf(m[k]), mt: m[k].m }); } }
        const first = base(paths[0]), stem = paths.length === 1 && !m[paths[0]].d ? first.replace(/\.[^.]+$/, "") || first : first;
        return this.upload(parent(paths[0]), stem + ".zip", zipBlob(files));
      },
      async unzip(p) {
        const m = map(), n = need(m, p, false), items = await unzipBytes(await bytesOf(n));
        let total = 0; for (const it of items) total += it.data ? it.data.length : 0; if (total > 3 * 1048576) throw new Error("That's too big to extract in the browser (over 3 MB).");
        const d = uniq(m, parent(p), base(p).replace(/\.zip$/i, "") || "Extracted"); m[d] = { d: 1, m: now() };
        for (const it of items) {
          const segs = it.name.split("/"); if (segs.some((x) => !okName(x))) continue; let cur = d;
          for (let i = 0; i < segs.length - (it.dir ? 0 : 1); i++) { cur = join(cur, segs[i]); if (!m[cur]) m[cur] = { d: 1, m: now() }; }
          if (it.dir) continue; const nm = segs[segs.length - 1], fp = join(cur, nm);
          m[fp] = KINDS.text.test(nm) ? { t: new TextDecoder().decode(it.data), m: now() } : { u: await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(new Blob([it.data])); }), s: it.data.length, m: now() };
        }
        save(m); return { path: d, name: base(d), files: items.filter((x) => !x.dir).length };
      },
      async drives() { return []; }, async mount() { throw new Error("USB drives open on the real Nebulux OS."); }, async eject() { return { ok: true }; },
      parent, join, base, sep: "/",
    };
  })();

  // ---------- ZIP files in the browser ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function bytesOf(n) { if (n.t != null) return new TextEncoder().encode(n.t); return new Uint8Array(await (await fetch(n.u)).arrayBuffer()); }
  function zipBlob(files) {
    const parts = [], cen = []; let off = 0;
    for (const f of files) {
      const name = new TextEncoder().encode(f.name), crc = crc32(f.data), d = new Date(f.mt || Date.now()), dir = f.name.endsWith("/");
      const tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 0x031e, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(38, dir ? 0x41ed0010 : 0x81a40000, true); c.setUint32(42, off, true);
      parts.push(h, name, f.data); cen.push(c, name); off += 30 + name.length + f.data.length;
    }
    const size = cen.reduce((s, x) => s + x.byteLength, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, e], { type: "application/zip" });
  }
  async function unzipBytes(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("That isn't a ZIP file, or it's damaged.");
    const count = v.getUint16(e + 10, true), out = []; let p = v.getUint32(e + 16, true);
    for (let k = 0; k < count; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error("That ZIP file is damaged.");
      const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = new TextDecoder(flags & 0x0800 ? "utf-8" : "latin1").decode(b.subarray(p + 46, p + 46 + nl)).split("\\").join("/"); p += 46 + nl + xl + cl;
      if (flags & 1) throw new Error("That ZIP file has a password. Nebulux OS can't open those yet.");
      const segs = name.split("/").filter((s) => s && s !== "."); if (!segs.length || name.startsWith("/") || segs.includes("..")) continue;
      if (name.endsWith("/")) { out.push({ name: segs.join("/"), dir: true }); continue; }
      const ls = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), body = b.subarray(ls, ls + cs);
      let data; if (method === 0) data = body; else if (method === 8) data = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); else throw new Error("That ZIP file uses a kind of packing Nebulux OS can't open.");
      out.push({ name: segs.join("/"), dir: false, data });
    }
    // everything in one folder (like a zipped-up folder): unpack its insides, so it isn't a folder inside a folder
    const tops = new Set(out.map((x) => x.name.split("/")[0])), top = [...tops][0];
    if (tops.size === 1 && out.some((x) => x.name.startsWith(top + "/"))) return out.filter((x) => x.name !== top).map((x) => ({ ...x, name: x.name.slice(top.length + 1) }));
    return out;
  }

  // ---------- files on the real computer (through the system helper) ----------
  const R = (function () {
    let pl = null;
    const sep = () => (pl && pl.sep) || "/";
    const parent = (p) => { const i = p.lastIndexOf(sep()); return i > 0 ? p.slice(0, i) : sep(); };
    return {
      async places() { pl = pl || await NX.api("GET", "/files/places"); return pl; },
      list: (p) => NX.api("POST", "/files/list", { path: p }),
      read: async (p) => (await NX.api("POST", "/files/read", { path: p })).text,
      searchText: async (q) => (await NX.api("POST", "/files/search-text", { q })).hits || [],
      write: (p, text) => NX.api("POST", "/files/write", { path: p, text }),
      create: (dir, name, folder) => NX.api("POST", "/files/new", { dir, name, folder: !!folder }),
      rename: (p, name) => NX.api("POST", "/files/rename", { path: p, name }),
      remove: (paths, permanent) => NX.api("POST", "/files/delete", { paths, permanent: !!permanent }),
      trash: () => NX.api("GET", "/files/trash"),
      restore: (ids) => NX.api("POST", "/files/restore", { ids }),
      emptyTrash: () => NX.api("POST", "/files/empty-trash"),
      copy: (paths, to, move) => NX.api("POST", "/files/copy", { paths, to, move: !!move }),
      zip: (paths) => NX.api("POST", "/files/zip", { paths }),
      unzip: (p) => NX.api("POST", "/files/unzip", { path: p }),
      url: async (p) => NX.rawURL(p),
      upload: (dir, name, blob) => NX.apiUpload(dir, name, blob),
      drives: async () => (await NX.api("GET", "/drives")).drives,
      mount: (dev) => NX.api("POST", "/drives/mount", { dev }),
      eject: (dev) => NX.api("POST", "/drives/eject", { dev }),
      parent, join: (d, n) => d.replace(/[\\/]$/, "") + sep() + n, base: (p) => p.slice(p.lastIndexOf(sep()) + 1), get sep() { return sep(); },
    };
  })();
  NX.fs = NX.native ? R : L;
  NX.folder = async (name) => (await NX.fs.places()).folders.find((f) => f.name === name).path;
  NX.fsClip = null; // { move, paths }

  // open a file in the app that fits it
  // Open with (right-click a file): the apps that can open it, and Notepad for any file you want to read as text
  NX.openWith = (e, list) => {
    const k = e.kind || kindOf(e.name, false), O = [];
    if (k === "image") O.push(["Photos", () => NX.open("photos", { path: e.path, list: (list || []).filter((x) => x.kind === "image") }), "photos"], ["Paint", () => NX.open("paint", { path: e.path }), "paint"]);
    if (k === "video" || k === "audio") O.push(["Media Player", () => NX.open("media", { path: e.path, list: (list || []).filter((x) => x.kind === "video" || x.kind === "audio") }), "media"]);
    if (k === "pdf" && NX.apps.pdf) O.push(["PDF Viewer", () => NX.open("pdf", { path: e.path }), "pdfview"]);
    if (k !== "image" && k !== "video" && k !== "audio") O.push(["Notepad", () => NX.open("notepad", { file: e.path }), "notepad"]);
    return O;
  };
  NX.openFile = (e, list) => {
    if (e.dir) return NX.open("files", { path: e.path });
    const rf = NX.data("recent-files", []).filter((x) => x.path !== e.path); rf.unshift({ name: e.name, path: e.path, kind: e.kind || kindOf(e.name, false), at: Date.now() }); NX.setData("recent-files", rf.slice(0, 8));
    const k = e.kind || kindOf(e.name, false);
    if (k === "image") return NX.open("photos", { path: e.path, list: (list || []).filter((x) => x.kind === "image") });
    if (k === "video" || k === "audio") return NX.open("media", { path: e.path, list: (list || []).filter((x) => x.kind === "video" || x.kind === "audio") });
    if (k === "text") return NX.open("notepad", { file: e.path });
    if (k === "pdf" && NX.apps.pdf) return NX.open("pdf", { path: e.path });
    NX.toast("Nebulux OS can't open this kind of file yet. Right-click it and pick Open with to try an app.");
  };

  // a small question box inside a window (no browser pop-ups)
  NX.ask = (host, { title, text, value, ok, danger, input }) => new Promise((done) => {
    const box = document.createElement("div"); box.className = "nx-ask";
    box.innerHTML = `<form class="nx-ask-card" role="dialog" aria-label="${NX.esc(title)}"><b>${NX.esc(title)}</b>${text ? `<p>${NX.esc(text)}</p>` : ""}${input ? `<input value="${NX.esc(value || "")}" maxlength="200" aria-label="${NX.esc(title)}" spellcheck="false">` : ""}<p class="s-msg"></p><div><button type="button" class="btn" data-x="1">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" type="submit">${NX.esc(ok || "OK")}</button></div></form>`;
    host.appendChild(box); const f = box.querySelector("form"), i = box.querySelector("input");
    const end = (v) => { box.remove(); done(v); };
    box.querySelector("[data-x]").onclick = () => end(null);
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); end(null); } });
    f.onsubmit = (e) => { e.preventDefault(); if (input && !okName(i.value)) { box.querySelector(".s-msg").textContent = NAME_ERR; return; } end(input ? i.value : true); };
    setTimeout(() => { if (i) { i.focus(); const dot = i.value.lastIndexOf("."); i.setSelectionRange(0, dot > 0 ? dot : i.value.length); } else f.querySelector("[type=submit]").focus(); }, 30);
  });

  // ---------- File Explorer ----------
  A.files = { name: "File Explorer", icon: "files", builtIn: true, w: 1000, h: 620, minW: 380, minH: 340, desc: "Your files and folders, the Recycle Bin and USB drives.",
    open(body, win, opts) {
      body.classList.add("fx");
      const TRASH = "::trash", HOME = "::home";
      let cur = null, back = [], fwd = [], sel = new Set(), items = [], view = NX.data("fx-view", "grid"), q = "", places = null, drives = [], loading = 0, parentPath = null;
      body.innerHTML = `<div class="fx-tabs" role="tablist" aria-label="Tabs"></div><div class="fx-top"><button class="wv-b" data-n="back" aria-label="Back" title="Back">${NX.icon("back", 16)}</button><button class="wv-b" data-n="fwd" aria-label="Forward" title="Forward">${NX.icon("fwd", 16)}</button><button class="wv-b" data-n="up" aria-label="Up one folder" title="Up">${NX.icon("up", 16)}</button><button class="wv-b" data-n="reload" aria-label="Refresh" title="Refresh">${NX.icon("restart", 16)}</button>
        <div class="fx-crumbs" aria-label="Location"></div><label class="fx-search">${NX.icon("search", 14)}<input placeholder="Search this folder" aria-label="Search this folder" spellcheck="false"></label></div>
        <div class="fx-tools"></div><div class="fx-main"><nav class="fx-side" aria-label="Places"></nav><section class="fx-list" tabindex="0" aria-label="Files"></section><aside class="fx-pv" aria-label="Preview" hidden></aside></div><div class="fx-status"></div>`;
      const $ = (s) => body.querySelector(s), listEl = $(".fx-list");
      // tabs: each one has its own folder and its own Back and Forward
      let tabs = [{ cur: null, back: [], fwd: [] }], ti = 0;
      const tabName = (p) => (p === HOME || !p ? "Home" : p === TRASH ? "Recycle Bin" : p === "::recent" ? "Recent" : p === "::gallery" ? "Gallery" : String(p).startsWith("::tag:") ? p.slice(6)[0].toUpperCase() + p.slice(7) + " tag" : NX.fs.base(p) || p);
      function tabsDraw() {
        const T = $(".fx-tabs");
        T.innerHTML = tabs.map((t, i) => `<div class="fx-tab ${i === ti ? "on" : ""}" role="tab" aria-selected="${i === ti}" data-tab="${i}" title="${NX.esc(tabName(t.cur))}">${NX.icon(t.cur === TRASH ? "recycle" : t.cur === HOME || !t.cur ? "home" : "folder", 14)}<span>${NX.esc(tabName(t.cur))}</span><button class="fx-tabx" data-tabx="${i}" aria-label="Close tab" title="Close tab">${NX.icon("close", 10)}</button></div>`).join("") + `<button class="fx-tabadd" aria-label="New tab" title="New tab (Ctrl + T)">${NX.icon("plus", 14)}</button>`;
        T.querySelectorAll("[data-tab]").forEach((el) => { el.onclick = (e) => { if (e.target.closest("[data-tabx]")) return; tabTo(+el.dataset.tab); }; el.onauxclick = (e) => { if (e.button === 1) tabClose(+el.dataset.tab); }; });
        T.querySelectorAll("[data-tabx]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); tabClose(+b.dataset.tabx); }));
        T.querySelector(".fx-tabadd").onclick = () => tabNew();
      }
      const tabSave = () => { tabs[ti] = { cur, back, fwd }; };
      function tabTo(i) { if (i === ti || !tabs[i]) return; tabSave(); ti = i; ({ cur, back, fwd } = tabs[i]); sel.clear(); q = ""; $(".fx-search input").value = ""; load(); }
      function tabNew(p) { if (tabs.length >= 12) { NX.toast("That's a lot of tabs. Close one first."); return; } tabSave(); tabs.push({ cur: null, back: [], fwd: [] }); ti = tabs.length - 1; cur = null; back = []; fwd = []; go(p || HOME, true); }
      // for the keyboard shortcuts (js/keys.js): Ctrl + T, W, Tab, 1 to 9, Shift + T; F5 refreshes
      let closedTabs = []; win.refresh = () => load();
      function tabClose(i) {
        if (tabs.length > 1) { tabSave(); const t0 = tabs[i]; if (t0 && t0.cur) closedTabs = [...closedTabs, t0.cur].slice(-10); }
        if (tabs.length === 1) { NX.close(win.id); return; }
        tabSave(); tabs.splice(i, 1);
        if (i < ti || ti >= tabs.length) ti = Math.max(0, ti - (i <= ti ? 1 : 0));
        ti = Math.min(ti, tabs.length - 1); ({ cur, back, fwd } = tabs[ti]); sel.clear(); q = ""; $(".fx-search input").value = ""; load();
      }
      const isTrash = () => cur === TRASH, isHome = () => cur === HOME, isTag = () => String(cur).startsWith("::tag:"), isRecent = () => cur === "::recent", isGal = () => cur === "::gallery";
      // color tags: mark any file or folder Red, Orange, Yellow, Green, Blue or Purple; the sidebar lists everything with a tag
      const TAGS = { red: ["Red", "#ef4444"], orange: ["Orange", "#f97316"], yellow: ["Yellow", "#eab308"], green: ["Green", "#22c55e"], blue: ["Blue", "#3b82f6"], purple: ["Purple", "#a855f7"] };
      const tags = () => NX.data("file-tags", {});
      const tagDot = (e) => { const t = e.path && tags()[e.path]; return t && TAGS[t.c] ? `<i class="fx-tag" style="background:${TAGS[t.c][1]}" title="${TAGS[t.c][0]}"></i>` : ""; };
      // Properties: what a file is, how big, where, when it changed, and its tag
      const props = async (e) => {
        if (!e.dir && (e.size == null || !e.mtime)) { try { const r = await NX.fs.list(NX.fs.parent(e.path)); const f = r.entries.find((x) => x.path === e.path); if (f) e = Object.assign({}, e, f); } catch (er) { /* show what we have */ } }
        const d = document.createElement("div"); d.className = "nx-pop fx-props"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", e.name + " properties");
        const t = tags()[e.path], typ = e.dir ? "Folder" : e.kind === "file" ? (e.name.includes(".") ? e.name.split(".").pop().toUpperCase() + " file" : "File") : e.kind[0].toUpperCase() + e.kind.slice(1);
        const rows = [["Type", typ], ...(e.dir ? [] : [["Size", size(e.size) + (e.size > 1023 ? " (" + Number(e.size).toLocaleString() + " bytes)" : "")]]), ["Location", NX.fs.parent(e.path) || ""], ["Changed", e.mtime ? new Date(e.mtime).toLocaleString() : ""], ["Tag", t && TAGS[t.c] ? TAGS[t.c][0] : "None"]];
        d.innerHTML = `<div class="nx-pcard"><div class="nx-ph">${NX.icon(iconOf(e), 40)}<div><b>${NX.esc(e.name)}</b><small>${NX.esc(typ)}</small></div></div><dl class="fx-pl">${rows.filter((r) => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${NX.esc(v)}</dd>`).join("")}</dl><div class="nx-pbtns"><button class="btn primary" data-pok>OK</button></div></div>`;
        document.body.appendChild(d); const ok = d.querySelector("[data-pok]"); ok.onclick = () => d.remove(); ok.focus(); d.onkeydown = (ev) => { if (ev.key === "Escape") d.remove(); };
        if (e.dir) NX.fs.list(e.path).then((r) => { const dd = document.createElement("dd"), dt = document.createElement("dt"); dt.textContent = "Inside"; const n = r.entries.length; dd.textContent = n === 1 ? "1 item" : n + " items"; d.querySelector(".fx-pl").append(dt, dd); }).catch(() => {});
      };
      const setTag = (list, c) => { const T = Object.assign({}, tags()); for (const e of list) { if (!e.path) continue; if (c) T[e.path] = { c, name: e.name, dir: !!e.dir, kind: e.kind }; else delete T[e.path]; } NX.setData("file-tags", T); side(); render(); };
      const selected = () => items.filter((e) => sel.has(e.path || e.id));
      const err = (e) => NX.toast(e && e.message || String(e));

      async function side() {
        places = places || await NX.fs.places().catch(() => null);
        try { drives = await NX.fs.drives(); } catch (e) { drives = []; }
        const row = (key, icon, label, extra) => `<button class="fx-place ${cur === key ? "on" : ""}" data-go="${NX.esc(key)}">${NX.icon(icon, 18)}<span>${NX.esc(label)}</span>${extra || ""}</button>`;
        const pins = NX.data("fx-pins", []).filter((x) => x && x.path);
        $(".fx-side").innerHTML = row(HOME, "home", "Home") + row("::recent", "time", "Recent") + row("::gallery", "fimage", "Gallery") + (places ? places.folders.map((f) => row(f.path, FOLD[f.name] || "folder", f.name)).join("") : "") + row(TRASH, "recycle", "Recycle Bin") +
          (Object.keys(tags()).length ? `<h4>Tags</h4>` + Object.entries(TAGS).filter(([c]) => Object.values(tags()).some((t) => t.c === c)).map(([c, [n, col]]) => `<button class="fx-place ${cur === "::tag:" + c ? "on" : ""}" data-go="::tag:${c}"><i class="fx-tag big" style="background:${col}"></i><span>${n}</span></button>`).join("") : "") +
          (pins.length ? `<h4>Quick access</h4>` + pins.map((x) => row(x.path, "pin", x.name)).join("") : "") +
          (NX.native ? `<h4>USB drives</h4>` + (drives.length ? drives.map((d) => d.mount ? row(d.mount, "usb", d.label, `<i class="fx-eject" role="button" tabindex="0" data-eject="${NX.esc(d.dev)}" title="Eject ${NX.esc(d.label)}" aria-label="Eject ${NX.esc(d.label)}">${NX.icon("eject", 14)}</i>`) : `<button class="fx-place" data-mount="${NX.esc(d.dev)}">${NX.icon("usb", 18)}<span>${NX.esc(d.label)}</span></button>`).join("") : `<p class="fx-none">Plug in a USB drive and it shows up here.</p>`) : "");
        $(".fx-side").querySelectorAll("[data-go]").forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-eject]")) return; go(b.dataset.go); }));
        $(".fx-side").querySelectorAll("[data-go]").forEach((b) => { const pin = pins.find((x) => x.path === b.dataset.go); if (pin && b.querySelector("svg") && b.previousElementSibling && b.closest(".fx-side")) b.oncontextmenu = (e) => { if (!NX.data("fx-pins", []).some((x) => x.path === b.dataset.go)) return; e.preventDefault(); e.stopPropagation(); NX.menu(e.clientX, e.clientY, [["Open", () => go(pin.path)], ["Open in new tab", () => tabNew(pin.path)], ["Unpin from Quick access", () => pinFolder(pin, false)]]); }; });
        $(".fx-side").querySelectorAll("[data-mount]").forEach((b) => (b.onclick = async () => { try { const r = await NX.fs.mount(b.dataset.mount); await side(); go(r.mount); } catch (e) { err(e); } }));
        $(".fx-side").querySelectorAll("[data-eject]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const d = drives.find((x) => x.dev === b.dataset.eject); try { await NX.fs.eject(b.dataset.eject); NX.toast("It's safe to take out " + (d ? d.label : "the drive") + " now."); if (d && cur && cur.startsWith(d.mount)) go(HOME, true); else side(); } catch (er) { err(er); } }));
      }
      function crumbs() {
        const c = $(".fx-crumbs");
        if (isHome()) { c.innerHTML = `<span class="fx-cr">${NX.icon("home", 14)}Home</span>`; return; }
        if (isTrash()) { c.innerHTML = `<span class="fx-cr">${NX.icon("recycle", 14)}Recycle Bin</span>`; return; }
        if (isTag() || isRecent() || isGal()) { c.innerHTML = `<span class="fx-cr">${tabName(cur)}</span>`; return; }
        const S = NX.fs.sep, parts = []; let root = null, label = "";
        const drive = drives.find((d) => d.mount && (cur === d.mount || cur.startsWith(d.mount + S)));
        if (drive) { root = drive.mount; label = drive.label; } else if (places) { root = places.home; label = "Home"; }
        if (root && (cur === root || cur.startsWith(root + (root.endsWith(S) ? "" : S)))) {
          parts.push([drive ? root : HOME, label]);
          let acc = root; for (const seg of cur.slice(root.length).split(S).filter(Boolean)) { acc = NX.fs.join(acc, seg); parts.push([acc, seg]); }
        } else parts.push([cur, NX.fs.base(cur) || cur]);
        c.innerHTML = parts.map(([p, n], i) => `<button class="fx-cr" data-go="${NX.esc(p)}">${i === 0 ? NX.icon(drive ? "usb" : "home", 14) : ""}${NX.esc(n)}</button>`).join(`<span class="fx-crs">${NX.icon("chevron", 10)}</span>`);
        c.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
      }
      function tools() {
        const one = sel.size === 1, any = sel.size > 0, t = (k, icon, label, on) => `<button class="fx-t" data-t="${k}" ${on === false ? "disabled" : ""} title="${label}">${NX.icon(icon, 16)}<span>${label}</span></button>`;
        $(".fx-tools").innerHTML = isTrash() ? t("restore", "restart", "Restore", any) + t("purge", "trash", "Delete for good", any) + `<span class="fx-sp"></span>` + t("empty", "recycle", "Empty Recycle Bin", items.length > 0)
          : (isHome() || isTag() || isRecent() || isGal() ? "" : t("newfolder", "newfolder", "New folder") + t("newtext", "ftext", "New text file") + `<i class="fx-div"></i>`) + t("cut", "cut", "Cut", any && !isHome()) + t("copy", "copy", "Copy", any && !isHome()) + t("paste", "paste", "Paste", !!NX.fsClip && !isHome()) + t("rename", "rename", "Rename", any && !isHome() && !isTrash()) + t("delete", "trash", "Delete", any && !isHome()) + `<span class="fx-sp"></span>` + (isHome() || isGal() ? "" : t("sort", "listv", "Sort: " + { name: "Name", date: "Date", type: "Type", size: "Size" }[sort.k])) + t("view", view === "grid" ? "listv" : "grid", view === "grid" ? "Details" : "Icons") + t("preview", "eye", "Preview");
        { const pb = $(".fx-tools [data-t=preview]"); if (pb) pb.classList.toggle("on", NX.data("fx-pv", false)); }
        $(".fx-tools").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => act(b.dataset.t)));
        const sb = $(".fx-tools [data-t=sort]"); if (sb) sb.onclick = () => { const r = sb.getBoundingClientRect(); NX.menu(r.left, r.bottom + 4, [["Name", () => setSort("name")], ["Date changed", () => setSort("date")], ["Type", () => setSort("type")], ["Size", () => setSort("size")]].map(([t2, f]) => [t2 + ({ Name: "name", "Date changed": "date", Type: "type", Size: "size" }[t2] === sort.k ? (sort.d > 0 ? "  (up)" : "  (down)") : ""), f])); };
      }
      // the Preview pane (Preview in the toolbar): a big picture or the first lines of a text file, with its size and date
      let pvKey = null;
      async function pvDraw() {
        const pv = $(".fx-pv"); if (!pv) return; const on = NX.data("fx-pv", false); pv.hidden = !on; if (!on) { pvKey = null; return; }
        const s = selected(), e = s.length === 1 ? s[0] : null, key = e ? (e.path || e.id) + ":" + (e.mtime || "") : "none:" + s.length; if (key === pvKey) return; pvKey = key;
        if (!e) { pv.innerHTML = `<div class="pv-none">${NX.icon("eye", 40)}<p>${s.length > 1 ? s.length + " items selected" : "Select a file to see it here"}</p></div>`; return; }
        const k = e.kind || kindOf(e.name, e.dir);
        pv.innerHTML = `<div class="pv-pic">${NX.icon(e.dir ? (FOLD[e.name] || "folder") : ICON[k] || "file", 96)}</div><b class="pv-n">${NX.esc(e.name)}</b><dl class="pv-dl">${e.dir ? "<dt>Type</dt><dd>Folder</dd>" : `<dt>Type</dt><dd>${{ image: "Picture", video: "Video", audio: "Music", text: "Text", pdf: "PDF" }[k] || "File"}</dd>`}${e.size != null ? `<dt>Size</dt><dd>${size(e.size)}</dd>` : ""}${e.mtime ? `<dt>Changed</dt><dd>${new Date(e.mtime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</dd>` : ""}</dl><div class="pv-txt" hidden></div><button class="btn sm pv-open">Open</button>`;
        pv.querySelector(".pv-open").onclick = () => NX.openFile(e, items);
        if (k === "image" || k === "video") NX.fs.url(e.path).then((u) => { if (pvKey !== key) return; pv.querySelector(".pv-pic").innerHTML = k === "image" ? `<img src="${NX.esc(u)}" alt="">` : `<video src="${NX.esc(u)}" muted preload="metadata"></video>`; }).catch(() => {});
        if (k === "text") NX.fs.read(e.path).then((t) => { if (pvKey !== key) return; const x = pv.querySelector(".pv-txt"); if (/\.(md|markdown)$/i.test(e.name) && NX.mdHTML) { x.innerHTML = NX.mdHTML(String(t).slice(0, 4000)); x.classList.add("np-md", "pv-md"); } else x.textContent = String(t).slice(0, 1200); x.hidden = !t; }).catch(() => {});
      }
      function status() { pvDraw(); const s = selected(); $(".fx-status").textContent = (loading ? "Loading... " : "") + items.length + (items.length === 1 ? " item" : " items") + (s.length ? `  ·  ${s.length} selected${s.length === 1 && s[0].size != null ? "  ·  " + size(s[0].size) : ""}` : ""); }
      // sorting: by name, date, type or size (folders stay first); click a column in Details view, or Sort in Icons view
      let sort = NX.data("fx-sort", { k: "name", d: 1 });
      const ext = (e) => (e.dir ? "" : (e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : ""));
      const sorted = (list) => isGal() ? [...list].sort((a, b) => (b.mtime || 0) - (a.mtime || 0)) : isHome() || isRecent() ? list : [...list].sort((a, b) => (b.dir - a.dir) || sort.d * (sort.k === "date" ? (a.mtime || a.deleted || 0) - (b.mtime || b.deleted || 0) : sort.k === "size" ? (a.size || 0) - (b.size || 0) : sort.k === "type" ? ext(a).localeCompare(ext(b)) || a.name.localeCompare(b.name, undefined, { numeric: true }) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })));
      const setSort = (k) => { sort = { k, d: sort.k === k ? -sort.d : (k === "date" || k === "size" ? -1 : 1) }; NX.setData("fx-sort", sort); render(); };
      const arrow = (k) => (sort.k === k ? (sort.d > 0 ? " \u2191" : " \u2193") : "");
      function render() {
        const shown = sorted(q ? items.filter((e) => e.name.toLowerCase().includes(q)) : items);
        listEl.className = "fx-list " + view; tools(); status();
        if (!shown.length) { listEl.innerHTML = `<div class="fx-empty">${NX.icon(isTrash() ? "recycle" : "folder", 56)}<p>${q ? "Nothing here matches." : isTrash() ? "The Recycle Bin is empty." : isGal() ? "No pictures yet. Pictures in Pictures, Desktop and Downloads show here." : "This folder is empty."}</p></div>`; return; }
        listEl.classList.toggle("fx-gal", isGal());
        listEl.innerHTML = (view === "list" ? `<div class="fx-head"><button data-sort="name">Name${arrow("name")}</button><button data-sort="date">${isTrash() ? "Deleted" : "Date changed"}${arrow("date")}</button><button data-sort="type">Type${arrow("type")}</button><button data-sort="size">Size${arrow("size")}</button></div>` : "") + shown.map((e) => { const key = e.path || e.id;
          return `<button class="fx-item ${sel.has(key) ? "sel" : ""} ${NX.fsClip && NX.fsClip.move && NX.fsClip.paths.includes(e.path) ? "cutting" : ""}" data-k="${NX.esc(key)}" title="${NX.esc(e.name)}">${e.kind === "image" && view === "grid" && !isTrash() ? `<span class="fx-thumb" data-thumb="${NX.esc(e.path)}">${NX.icon("fimage", 44)}</span>` : NX.icon(iconOf(e), view === "grid" ? 44 : 20)}<span class="fx-n">${tagDot(e)}${NX.esc(e.name)}</span>${view === "list" ? `<span class="fx-d">${NX.esc(isTrash() ? (e.deleted || "").replace("T", " ") : when(e.mtime))}</span><span class="fx-d">${e.dir ? "Folder" : (e.kind === "file" ? (e.name.includes(".") ? e.name.split(".").pop().toUpperCase() + " file" : "File") : e.kind[0].toUpperCase() + e.kind.slice(1))}</span><span class="fx-d">${e.dir ? "" : size(e.size)}</span>` : ""}</button>`; }).join("");
        listEl.querySelectorAll("[data-thumb]").forEach(async (t) => { try { const u = await NX.fs.url(t.dataset.thumb); t.innerHTML = `<img src="${NX.esc(u)}" alt="" loading="lazy">`; } catch (e) { /* keep the icon */ } });
        // Home: your recent files under the folders, like Windows 11
        if (isHome() && !q && NX.prefs().showrecent !== false) { const rf = NX.data("recent-files", []).slice(0, 8);
          if (rf.length) { listEl.insertAdjacentHTML("beforeend", `<div class="fx-homerec"><h4>Recent</h4>${rf.map((r, k2) => `<button class="fx-hr" data-hr="${k2}">${NX.icon(ICON[r.kind] || "file", 22)}<span><b>${NX.esc(r.name)}</b><small>${NX.esc(NX.fs.base(NX.fs.parent(r.path)))}</small></span><small>${new Date(r.at).toLocaleDateString([], { month: "short", day: "numeric" })}</small></button>`).join("")}</div>`);
            listEl.querySelectorAll("[data-hr]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const r = rf[+b.dataset.hr]; if (r) NX.openFile(r); })); } }
      }
      // selecting only moves the highlight (redrawing the list would break double-clicks)
      function marks() { listEl.querySelectorAll(".fx-item").forEach((b) => b.classList.toggle("sel", sel.has(b.dataset.k))); tools(); status(); }
      async function load() {
        loading++; status();
        try {
          if (isHome()) { places = places || await NX.fs.places(); items = places.folders.map((f) => ({ name: f.name, path: f.path, dir: true, kind: "folder" })); parentPath = null; }
          else if (isTrash()) { items = (await NX.fs.trash()).entries; parentPath = null; }
          else if (isGal()) { items = []; for (const n of ["Pictures", "Desktop", "Downloads"]) { try { items.push(...(await NX.fs.list(await NX.folder(n))).entries.filter((e) => e.kind === "image")); } catch (e2) { /* skip */ } } parentPath = null; }
          else if (isRecent()) { items = NX.prefs().showrecent === false ? [] : NX.data("recent-files", []).map((f) => ({ name: f.name, path: f.path, dir: false, kind: f.kind || "file", mtime: f.at })); parentPath = null; }
          else if (isTag()) { const c = cur.slice(6); items = Object.entries(tags()).filter(([, t]) => t.c === c).map(([p, t]) => ({ name: t.name, path: p, dir: t.dir, kind: t.kind || (t.dir ? "folder" : "file") })); parentPath = null; }
          else { const r = await NX.fs.list(cur); cur = r.path; items = r.entries; parentPath = r.parent; }
          sel = new Set([...sel].filter((k) => items.some((e) => (e.path || e.id) === k)));
        } catch (e) { err(e); if (!isHome()) { cur = HOME; return load(); } } finally { loading--; }
        win.el.querySelector(".wt-name").textContent = (isHome() ? "Home" : isTrash() ? "Recycle Bin" : isRecent() ? "Recent" : isGal() ? "Gallery" : isTag() ? (TAGS[cur.slice(6)] || ["Tag"])[0] + " tag" : NX.fs.base(cur) || cur) + " - File Explorer";
        tabs[ti] = { cur, back, fwd }; tabsDraw();
        crumbs(); render(); side(); $(".fx-top [data-n=back]").disabled = !back.length; $(".fx-top [data-n=fwd]").disabled = !fwd.length; $(".fx-top [data-n=up]").disabled = !parentPath && isHome();
      }
      function go(p, noHist) { if (p === cur) return load(); if (cur && !noHist) { back.push(cur); fwd = []; } cur = p; sel.clear(); q = ""; $(".fx-search input").value = ""; load(); }
      const here = () => isHome() || isTrash() || isTag() || isRecent() || isGal() ? null : cur;
      async function act(k) {
        const s = selected();
        try {
          if (k === "view") { view = view === "grid" ? "list" : "grid"; NX.setData("fx-view", view); render(); return; }
          if (k === "preview") { NX.setData("fx-pv", !NX.data("fx-pv", false)); tools(); status(); return; }
          if (k === "newfolder" || k === "newtext") { const name = await NX.ask(body, { title: k === "newfolder" ? "New folder" : "New text file", input: true, value: k === "newfolder" ? "New folder" : "New text file.txt", ok: "Make it" }); if (!name) return; const r = await NX.fs.create(here(), name, k === "newfolder"); await load(); sel = new Set([r.path]); render(); return; }
          if (k === "cut" || k === "copy") { NX.fsClip = { move: k === "cut", paths: s.map((e) => e.path) }; NX.toast((k === "cut" ? "Cut " : "Copied ") + s.length + (s.length === 1 ? " item." : " items.") + " Open a folder and press Paste."); render(); return; }
          if (k === "paste") { if (!NX.fsClip || !here()) return; const c = NX.fsClip; const r = await NX.fs.copy(c.paths, here(), c.move); if (c.move) NX.fsClip = null; await load(); sel = new Set(r.paths); render(); return; }
          if (k === "zip") { NX.toast("Making the ZIP file..."); const r = await NX.fs.zip(s.map((e) => e.path)); await load(); sel = new Set([r.path]); render(); NX.toast("Made " + r.name + "."); return; }
          if (k === "unzip") { const r = await NX.fs.unzip(s[0].path); await load(); sel = new Set([r.path]); render(); NX.toast("Extracted " + r.files + (r.files === 1 ? " file" : " files") + " into " + r.name + "."); return; }
          // several at once (like Windows): one name for all of them, numbered, each keeping its own file type
          if (k === "rename" && s.length > 1) {
            const stem0 = s[0].name.replace(/\.[^.]+$/, "") || s[0].name, base = await NX.ask(body, { title: "Rename " + s.length + " items", text: "They'll be named like " + stem0 + " (1), " + stem0 + " (2) and so on.", input: true, value: stem0, ok: "Rename" });
            if (!base || !String(base).trim()) return; const b = String(base).trim(), done = [], und = []; let n = 0;
            for (const e of s) { n++; const ext = e.dir ? "" : (/\.[^.]+$/.exec(e.name) || [""])[0]; try { const r = await NX.fs.rename(e.path, b + " (" + n + ")" + ext); done.push(r.path); und.push([r.path, e.name]); } catch (er) { NX.toast(er.message); } }
            NX.fxUndo = und.length ? { renames: und } : null; await load(); sel = new Set(done); render(); return;
          }
          if (k === "rename") { const e = s[0]; const name = await NX.ask(body, { title: "Rename", input: true, value: e.name, ok: "Rename" }); if (!name || name === e.name) return; const r = await NX.fs.rename(e.path, name); NX.fxUndo = { renames: [[r.path, e.name]] }; await load(); sel = new Set([r.path]); render(); return; }
          if (k === "delete") {
            const onDrive = drives.some((d) => d.mount && cur.startsWith(d.mount));
            if (onDrive && !(await NX.ask(body, { title: "Delete for good?", text: `USB drives have no Recycle Bin, so ${s.length === 1 ? `"${s[0].name}"` : s.length + " items"} can't be brought back.`, ok: "Delete", danger: true }))) return;
            // remember what went to the Recycle Bin, so Ctrl + Z can put it back
            const before = onDrive ? null : new Set(((await NX.fs.trash().catch(() => ({ entries: [] }))).entries || []).map((x) => x.id));
            await NX.fs.remove(s.map((e) => e.path), onDrive);
            if (before) { const after = ((await NX.fs.trash().catch(() => ({ entries: [] }))).entries || []).filter((x) => !before.has(x.id)).map((x) => x.id); NX.fxUndo = after.length ? after : null; }
            NX.toast(onDrive ? "Deleted." : "Moved to the Recycle Bin. Press Ctrl + Z to undo."); await load(); return;
          }
          if (k === "restore") { await NX.fs.restore(s.map((e) => e.id)); NX.toast("Put back where it was."); await load(); return; }
          if (k === "purge" || k === "empty") {
            if (k === "purge") { if (!(await NX.ask(body, { title: "Delete for good?", text: "These can't be brought back.", ok: "Delete", danger: true }))) return; await purge(s); }
            else { if (!(await NX.ask(body, { title: "Empty the Recycle Bin?", text: "Everything in it will be deleted for good.", ok: "Empty it", danger: true }))) return; await NX.fs.emptyTrash(); }
            await load(); return;
          }
        } catch (e) { err(e); }
      }
      // deleting chosen Recycle Bin items for good
      async function purge(gone) {
        if (NX.native) { await NX.api("POST", "/files/purge", { ids: gone.map((e) => e.id) }); return; }
        NX.setData("vfs-trash", NX.data("vfs-trash", []).filter((t) => !gone.some((g) => g.id === t.id)));
      }
      // Quick access: up to 12 folders in the sidebar
      function pinFolder(e, on) {
        const L = NX.data("fx-pins", []).filter((x) => x.path !== e.path);
        if (on) { if (L.length >= 12) { NX.toast("Quick access has room for 12 folders."); return; } L.push({ path: e.path, name: e.name }); }
        NX.setData("fx-pins", L); NX.toast(on ? e.name + " is pinned to Quick access." : e.name + " is unpinned."); side();
      }
      win.fxPin = pinFolder;
      function openItem(e) { if (isTrash()) { NX.toast("Restore it first to open it."); return; } if (e.dir) go(e.path); else if (/\.zip$/i.test(e.name) && NX.fs.unzip && !isHome()) { NX.ask(body, { title: "Extract all?", text: `The files in "${e.name}" go into a new folder next to it.`, ok: "Extract" }).then((y) => { if (y) { sel = new Set([e.path]); act("unzip"); } }); } else NX.openFile(e, items); }
      let lastClick = null, typed = "", typedAt = 0;
      listEl.addEventListener("click", (ev) => {
        const sb = ev.target.closest("[data-sort]"); if (sb) { setSort(sb.dataset.sort); return; }
        const b = ev.target.closest(".fx-item"); if (!b) { if (ev.target === listEl || ev.target.closest(".fx-empty")) { sel.clear(); marks(); } return; }
        const k = b.dataset.k, e = items.find((x) => (x.path || x.id) === k);
        if (ev.ctrlKey || ev.metaKey) { sel.has(k) ? sel.delete(k) : sel.add(k); }
        else if (ev.shiftKey && lastClick) { const keys = items.map((x) => x.path || x.id), a = keys.indexOf(lastClick), z = keys.indexOf(k); sel = new Set(keys.slice(Math.min(a, z), Math.max(a, z) + 1)); }
        else { if (sel.size === 1 && sel.has(k) && ev.detail === 1 && ev.pointerType === "touch") { openItem(e); return; } sel = new Set([k]); }
        lastClick = k; marks(); if (ev.pointerType === "touch" && !ev.ctrlKey) openItem(e);
      });
      listEl.addEventListener("auxclick", (ev) => { if (ev.button !== 1) return; const b = ev.target.closest(".fx-item"); if (!b) return; const e = items.find((x) => (x.path || x.id) === b.dataset.k); if (e && e.dir && !isTrash()) { ev.preventDefault(); tabNew(e.path); } });
      listEl.addEventListener("dblclick", (ev) => { const b = ev.target.closest(".fx-item"); if (!b) return; const e = items.find((x) => (x.path || x.id) === b.dataset.k); if (e) openItem(e); });
      listEl.addEventListener("contextmenu", (ev) => {
        ev.preventDefault(); ev.stopPropagation(); const b = ev.target.closest(".fx-item");
        if (b && !sel.has(b.dataset.k)) { sel = new Set([b.dataset.k]); marks(); }
        const s = selected(), M = [];
        if (isTrash()) { if (s.length) M.push(["Restore", () => act("restore")], ["Delete for good", () => act("purge")]); M.push(["Empty Recycle Bin", () => act("empty")]); }
        else if (s.length) { if (s.length === 1) M.push(["Open", () => openItem(s[0])]); if (s.length === 1 && !s[0].dir && !isTrash()) { const ow = NX.openWith(s[0], items); if (ow.length) M.push(["Open with", () => NX.menu(ev.clientX + 12, ev.clientY + 12, ow.map(([n, go, ic]) => [n, go, ic]))]); } if (s.length === 1 && s[0].dir) { M.push(["Open in new tab", () => tabNew(s[0].path)]); const pinned = NX.data("fx-pins", []).some((x) => x.path === s[0].path); M.push([pinned ? "Unpin from Quick access" : "Pin to Quick access", () => pinFolder(s[0], !pinned)]); } if (!isHome()) M.push(["Cut", () => act("cut")], ["Copy", () => act("copy")]); if (!isHome()) M.push([s.length > 1 ? "Rename " + s.length + " items" : "Rename", () => act("rename")]); if (!isHome()) M.push(["Delete", () => act("delete")]); if (!isHome() && NX.fs.zip) { M.push(["Compress to ZIP file", () => act("zip")]); if (s.length === 1 && !s[0].dir && /\.zip$/i.test(s[0].name)) M.push(["Extract all", () => act("unzip")]); } if (s.length === 1 && !isTrash()) M.push(["Copy as path", () => { const t = s.map((e) => e.path).join(String.fromCharCode(10)); if (NX.clip) NX.clip.add(t); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => {}); if (NX.native) NX.api("POST", "/clip", { text: t }).catch(() => {}); NX.toast("Copied " + (s.length === 1 ? "the path" : s.length + " paths") + "."); }, "copy"]); M.push(["Properties", () => props(s[0])]); if (!isTrash()) M.push(["Tag with a color", () => NX.menu(ev.clientX + 12, ev.clientY + 12, [...Object.entries(TAGS).map(([c, [n]]) => [n, () => setTag(s, c)]), ["No tag", () => setTag(s, null)]])]); }
        else if (!isHome()) { M.push(["New folder", () => act("newfolder")], ["New text file", () => act("newtext")]); if (NX.fsClip) M.push(["Paste", () => act("paste")]); M.push(["Refresh", () => load()]); }
        if (M.length) NX.menu(ev.clientX, ev.clientY, M);
      });
      listEl.addEventListener("keydown", (ev) => {
        if (body.querySelector(".nx-ask")) return; const k = ev.key, c = ev.ctrlKey || ev.metaKey;
        // typing a name jumps to the first file that starts with it (letters typed close together build the name)
        if (k.length === 1 && k.trim() && !c && !ev.altKey && k !== " ") {
          const now = Date.now(); typed = now - typedAt < 700 ? typed + k.toLowerCase() : k.toLowerCase(); typedAt = now;
          const L = [...listEl.querySelectorAll(".fx-item")], hit = L.find((b) => (b.title || b.textContent).trim().toLowerCase().startsWith(typed));
          if (hit) { ev.preventDefault(); sel = new Set([hit.dataset.k]); lastClick = hit.dataset.k; marks(); hit.focus({ preventScroll: true }); hit.scrollIntoView({ block: "nearest" }); }
          return;
        }
        // the arrow keys move between files (Shift picks a range), Home and End go to the first and last, like Windows
        if (/^Arrow|^Home$|^End$/.test(k) && !c && !ev.altKey) {
          const L = [...listEl.querySelectorAll(".fx-item")]; if (!L.length) return; ev.preventDefault();
          const cur = L.find((b) => b === document.activeElement) || L.find((b) => sel.has(b.dataset.k)), i0 = cur ? L.indexOf(cur) : -1; let next = null;
          if (i0 < 0 || k === "Home") next = L[0]; else if (k === "End") next = L[L.length - 1];
          else if (view === "list" && (k === "ArrowUp" || k === "ArrowDown")) next = L[Math.max(0, Math.min(L.length - 1, i0 + (k === "ArrowDown" ? 1 : -1)))];
          else if (view === "list") next = cur;
          else { const r0 = cur.getBoundingClientRect(), dx0 = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0, dy0 = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0; let best = 1e9;
            for (const b of L) { if (b === cur) continue; const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - (r0.left + r0.width / 2), dy = r.top + r.height / 2 - (r0.top + r0.height / 2), along = dx * dx0 + dy * dy0, across = Math.abs(dx * dy0 + dy * dx0); if (along <= 4) continue; const d = along + across * 3; if (d < best) { best = d; next = b; } }
            if (!next) next = cur; }
          if (ev.shiftKey && cur) { const a = L.indexOf(L.find((b) => b.dataset.k === (lastClick || cur.dataset.k)) || cur), z = L.indexOf(next); sel = new Set(L.slice(Math.min(a, z), Math.max(a, z) + 1).map((b) => b.dataset.k)); }
          else { sel = new Set([next.dataset.k]); lastClick = next.dataset.k; }
          marks(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: "nearest" }); return;
        }
        if (k === "Delete") { ev.preventDefault(); act(isTrash() ? "purge" : "delete"); }
        else if (c && (k === "z" || k === "Z") && NX.fxUndo && NX.fxUndo.renames) { ev.preventDefault(); const L = NX.fxUndo.renames; NX.fxUndo = null; (async () => { for (const [p2, old] of L) { try { await NX.fs.rename(p2, old); } catch (er) { NX.toast(er.message); } } NX.toast("Renamed back."); load(); })(); }
        else if (c && (k === "z" || k === "Z") && NX.fxUndo) { ev.preventDefault(); const ids = NX.fxUndo; NX.fxUndo = null; NX.fs.restore(ids).then(() => { NX.toast("Put back."); NX.filesChanged && NX.filesChanged(); load(); }).catch((er) => NX.toast(er.message)); }
        else if (k === " " && sel.size === 1 && NX.peekFile && !isTrash()) { const e1 = items.find((x) => (x.path || x.id) === [...sel][0]); if (e1 && !e1.dir) { ev.preventDefault(); NX.peekFile(e1, items.filter((x) => !x.dir)); } }
        else if (k === "F2" && sel.size >= 1) { ev.preventDefault(); act("rename"); }
        else if (c && ev.shiftKey && /^n$/i.test(k) && !isHome() && !isTrash()) { ev.preventDefault(); act("newfolder"); } // Ctrl + Shift + N, like Windows
        else if (k === "Enter" && sel.size === 1) { ev.preventDefault(); openItem(selected()[0]); }
        else if (k === "Backspace" && !c) { ev.preventDefault(); nav("up"); }
        else if (c && /^[acxv]$/i.test(k)) { ev.preventDefault(); const l = k.toLowerCase(); if (l === "a") { sel = new Set(items.map((e) => e.path || e.id)); marks(); } else if (!isTrash()) act(l === "c" ? "copy" : l === "x" ? "cut" : "paste"); }
      });
      function nav(k) {
        if (k === "back" && back.length) { fwd.push(cur); cur = back.pop(); sel.clear(); load(); }
        if (k === "fwd" && fwd.length) { back.push(cur); cur = fwd.pop(); sel.clear(); load(); }
        if (k === "up") { if (parentPath) go(parentPath); else if (!isHome()) go(HOME); }
        if (k === "reload") load();
      }
      body.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => nav(b.dataset.n)));
      $(".fx-search input").oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
      const onDr = () => side(); document.addEventListener("nx:drives", onDr);
      const onFs = () => { if (!loading) load(); }; document.addEventListener("nx:files", onFs);
      win.onclose = () => { document.removeEventListener("nx:drives", onDr); document.removeEventListener("nx:files", onFs); };
      win.onopts = (o) => { if (o.path) go(o.path); else if (o.place) NX.folder(o.place).then(go); };
      win.tabs = { list: () => tabs.map((t, i) => ({ name: tabName(i === ti ? cur : t.cur), on: i === ti })), add: (p) => tabNew(p), to: tabTo, close: (i) => tabClose(i == null ? ti : i),
        // for the keyboard shortcuts (js/keys.js): Ctrl + Tab, 1 to 9, Shift + T
        count: () => tabs.length, go: (i) => tabTo(i), step: (d) => tabTo((ti + d + tabs.length) % tabs.length),
        reopen: () => { const p = closedTabs.pop(); if (p) tabNew(p); else NX.toast("There's no closed tab to bring back."); } };
      if (opts.path) go(opts.path, true); else if (opts.place) NX.folder(opts.place).then((p) => go(p, true)).catch(() => go(HOME, true)); else go(HOME, true);
      setTimeout(() => listEl.focus(), 60);
    } };
  NX.filesChanged = () => document.dispatchEvent(new CustomEvent("nx:files"));

  // ---------- Photos ----------
  A.photos = { name: "Photos", icon: "photos", builtIn: true, w: 900, h: 620, minW: 360, minH: 300, desc: "See your pictures and screenshots.",
    open(body, win, opts) {
      body.classList.add("ph");
      let list = [], i = 0, zoom = 1, turn = 0;
      body.innerHTML = `<div class="ph-bar"><button class="wv-b" data-p="prev" aria-label="Previous" title="Previous">${NX.icon("back", 16)}</button><button class="wv-b" data-p="next" aria-label="Next" title="Next">${NX.icon("fwd", 16)}</button><span class="ph-name"></span><button class="wv-b" data-p="out" aria-label="Zoom out" title="Zoom out">${NX.icon("zoomout", 16)}</button><button class="wv-b" data-p="in" aria-label="Zoom in" title="Zoom in">${NX.icon("zoomin", 16)}</button><button class="wv-b" data-p="turn" aria-label="Rotate" title="Rotate">${NX.icon("rotate", 16)}</button><button class="wv-b ph-infob" data-p="info" aria-label="File information" title="File information" aria-pressed="false" hidden>${NX.icon("info", 16)}</button>${NX.native ? `<button class="wv-b" data-p="ocr" aria-label="Copy the text in this picture" title="Copy the text in this picture">${NX.icon("copy", 16)}</button>` : ""}<button class="wv-b" data-p="all" aria-label="All pictures" title="All pictures">${NX.icon("grid", 16)}</button></div><div class="ph-view"></div>`;
      const v = body.querySelector(".ph-view"), nm = body.querySelector(".ph-name");
      // the slideshow: every picture, one after another, the whole window; Esc or a click stops it
      body.querySelector(".ph-bar").insertAdjacentHTML("beforeend", `<button class="wv-b ph-fav" data-p="fav" aria-label="Favorite" title="Favorite" aria-pressed="false" hidden><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z" fill="currentColor"/></svg></button><button class="btn sm ph-favs" data-p="favs" aria-pressed="false" title="Show only favorites"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z" fill="currentColor"/></svg>Favorites</button><button class="btn sm ph-edit-b" data-p="edit" title="Brightness, colors and filters" hidden>${NX.icon("brush", 14)}Edit</button><button class="btn sm ph-del" data-p="del" title="Delete (to the Recycle Bin)" aria-label="Delete" hidden>${NX.icon("trash", 14)}</button><button class="btn sm ph-wall" data-p="wall" title="Make this picture your background" hidden>${NX.icon("display", 14)}Set as background</button><button class="btn sm ph-slide" data-p="slide" title="Slideshow">${NX.icon("media", 14)}Slideshow</button>`);
      let slideT = 0;
      const slideStop = () => { if (!slideT) return; clearInterval(slideT); slideT = 0; body.classList.remove("ph-show"); };
      const slideGo = async () => {
        if (!list.length) await gallery();
        if (!list.length) { NX.toast("There are no pictures to show yet."); return; }
        if (!v.querySelector("img") || v.querySelector(".ph-grid")) { i = 0; await show(); }
        body.classList.add("ph-show"); body.focus();
        clearInterval(slideT); slideT = setInterval(() => { i = (i + 1) % list.length; show(); }, 4000);
      };
      v.addEventListener("click", () => slideStop());
      // Edit: brightness, contrast and color, a few looks, and rotating; the picture is saved as a copy next to it
      const LOOKS = { none: ["Original", ""], warm: ["Warm", "sepia(.25) saturate(1.2) hue-rotate(-8deg)"], cool: ["Cool", "saturate(1.05) hue-rotate(12deg) brightness(1.02)"], bw: ["Black and white", "grayscale(1)"], vintage: ["Vintage", "sepia(.55) contrast(.92) brightness(1.05)"], vivid: ["Vivid", "saturate(1.6) contrast(1.08)"] };
      let ed = null;
      const edFilter = () => ed ? `brightness(${ed.b / 100}) contrast(${ed.c / 100}) saturate(${ed.s / 100}) ${LOOKS[ed.look][1]}`.trim() : "";
      // the crop box drawn over the picture
      function cropBox() {
        let bx = v.querySelector(".ph-cbox"); const img = v.querySelector("img"), k = ed && ed.crop;
        if (!k || !img) { if (bx) bx.remove(); return; }
        if (!bx) { bx = document.createElement("div"); bx.className = "ph-cbox"; v.appendChild(bx); }
        const r = img.getBoundingClientRect(), vr = v.getBoundingClientRect();
        Object.assign(bx.style, { left: r.left - vr.left + v.scrollLeft + k.x * r.width + "px", top: r.top - vr.top + v.scrollTop + k.y * r.height + "px", width: k.w * r.width + "px", height: k.h * r.height + "px" });
      }
      function editClose() { const p = body.querySelector(".ph-ed"); if (p) p.remove(); ed = null; cropBox(); v.classList.remove("ph-cropping"); v.onpointerdown = v.onpointermove = v.onpointerup = null; const img = v.querySelector("img"); if (img) img.style.filter = ""; }
      function editOpen() {
        const img = v.querySelector("img"); if (!img || !list[i]) return; editClose(); ed = { b: 100, c: 100, s: 100, look: "none" };
        const pane = document.createElement("div"); pane.className = "ph-ed";
        const sl = (k, label, min, max) => `<label><span>${label}</span><input type="range" min="${min}" max="${max}" value="100" data-ed="${k}" aria-label="${label}"></label>`;
        pane.innerHTML = `${sl("b", "Brightness", 40, 160)}${sl("c", "Contrast", 40, 160)}${sl("s", "Color", 0, 200)}<div class="ph-looks">${Object.entries(LOOKS).map(([k, [n]]) => `<button class="${k === "none" ? "on" : ""}" data-look="${k}">${n}</button>`).join("")}</div><div class="ph-edacts"><button class="btn" data-ed2="rot">${NX.icon("rotate", 14)}Rotate</button><button class="btn" data-ed2="crop">${NX.icon("cut", 14)}Crop</button><button class="btn" data-ed2="reset">Reset</button><span class="fx-sp"></span><button class="btn" data-ed2="cancel">Cancel</button><button class="btn primary" data-ed2="save">Save a copy</button></div>`;
        body.appendChild(pane);
        const apply = () => { img.style.filter = edFilter(); };
        pane.oninput = (e) => { const r = e.target.closest("[data-ed]"); if (!r) return; ed[r.dataset.ed] = +r.value; apply(); };
        pane.onclick = async (e) => {
          const lk = e.target.closest("[data-look]"); if (lk) { ed.look = lk.dataset.look; pane.querySelectorAll("[data-look]").forEach((x) => x.classList.toggle("on", x === lk)); apply(); return; }
          const a = e.target.closest("[data-ed2]"); if (!a) return; const k2 = a.dataset.ed2;
          if (k2 === "rot") { turn = (turn + 90) % 360; ed.crop = null; cropBox(); tf(); }
          // Crop: drag over the part to keep (as parts of the picture you see, so it works after Rotate too)
          if (k2 === "crop") {
            const on = !v.classList.contains("ph-cropping"); v.classList.toggle("ph-cropping", on); a.classList.toggle("on", on);
            if (!on) return; let st = null;
            v.onpointerdown = (ev) => { if (!v.classList.contains("ph-cropping")) return; ev.preventDefault(); v.setPointerCapture(ev.pointerId); const r = img.getBoundingClientRect(); st = [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]; };
            v.onpointermove = (ev) => { if (!st) return; const r = img.getBoundingClientRect(), q = [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]; const s0 = [Math.max(0, Math.min(1, st[0])), Math.max(0, Math.min(1, st[1]))]; ed.crop = { x: Math.min(s0[0], q[0]), y: Math.min(s0[1], q[1]), w: Math.abs(q[0] - s0[0]), h: Math.abs(q[1] - s0[1]) }; cropBox(); };
            v.onpointerup = () => { st = null; if (ed.crop && (ed.crop.w < .02 || ed.crop.h < .02)) { ed.crop = null; cropBox(); } };
            return;
          }
          if (k2 === "reset") { ed.crop = null; cropBox(); ed = { b: 100, c: 100, s: 100, look: "none" }; pane.querySelectorAll("[data-ed]").forEach((x) => (x.value = 100)); pane.querySelectorAll("[data-look]").forEach((x) => x.classList.toggle("on", x.dataset.look === "none")); turn = 0; tf(); apply(); }
          if (k2 === "cancel") { turn = 0; tf(); editClose(); }
          if (k2 === "save") {
            const it = list[i], W0 = img.naturalWidth, H0 = img.naturalHeight, side = turn % 180 !== 0, c = document.createElement("canvas"); c.width = side ? H0 : W0; c.height = side ? W0 : H0;
            const g = c.getContext("2d"); g.filter = edFilter() || "none"; g.translate(c.width / 2, c.height / 2); g.rotate(turn * Math.PI / 180); g.drawImage(img, -W0 / 2, -H0 / 2);
            let outC = c; if (ed.crop) { const k = ed.crop, cc = document.createElement("canvas"); cc.width = Math.max(1, Math.round(k.w * c.width)); cc.height = Math.max(1, Math.round(k.h * c.height)); cc.getContext("2d").drawImage(c, Math.round(k.x * c.width), Math.round(k.y * c.height), cc.width, cc.height, 0, 0, cc.width, cc.height); outC = cc; }
            const png = /\.png$/i.test(it.name), blob = await new Promise((ok) => outC.toBlob(ok, png ? "image/png" : "image/jpeg", .92));
            try { const name = it.name.replace(/( \(edited\))?\.[^.]+$/, "") + " (edited)." + (png ? "png" : "jpg"), out = await NX.fs.upload(NX.fs.parent(it.path), name, blob); NX.filesChanged && NX.filesChanged(); NX.toast("Saved as " + out.name + ".");
              list.splice(i + 1, 0, { name: out.name, path: out.path, kind: "image" }); i++; show(); }
            catch (er) { NX.toast(er.message || "The picture couldn't be saved."); }
          }
        };
      }
      async function show() {
        const e = list[i]; if (!e) return gallery();
        nm.textContent = e.name + (list.length > 1 ? `  (${i + 1} of ${list.length})` : ""); win.el.querySelector(".wt-name").textContent = e.name + " - Photos";
        zoom = 1; turn = 0; v.innerHTML = `<img alt="${NX.esc(e.name)}" draggable="false">`; const img = v.querySelector("img"); body.querySelector(".ph-wall").hidden = false; body.querySelector(".ph-del").hidden = false; body.querySelector(".ph-edit-b").hidden = false; body.querySelector(".ph-favs").hidden = true; favMark(); editClose();
        try { img.src = await NX.fs.url(e.path); } catch (er) { v.innerHTML = `<p class="ph-msg">${NX.esc(er.message)}</p>`; }
        img.addEventListener("load", () => infoDraw()); infoDraw();
        img.onerror = () => { v.innerHTML = `<p class="ph-msg">This picture couldn't be shown.</p>`; };
        win.print = () => NX.printDoc(e.name, `<img src="${img.src}" alt="">`); // Ctrl + P
      }
      const tf = () => { const img = v.querySelector("img"); if (img) img.style.transform = `scale(${zoom}) rotate(${turn}deg)`; };
      let onlyFav = false;
      const infoDraw = () => {
        let pane = body.querySelector(".ph-info"); const on = NX.data("ph-info", false), e = list[i], img = body.querySelector(".ph-view img"), b = body.querySelector(".ph-infob");
        if (b) { b.hidden = !e; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }
        if (!on || !e) { if (pane) pane.remove(); return; }
        if (!pane) { pane = document.createElement("aside"); pane.className = "ph-info"; pane.setAttribute("aria-label", "File information"); body.appendChild(pane); }
        const sz = e.size == null ? "" : e.size < 1048576 ? (e.size / 1024).toFixed(0) + " KB" : (e.size / 1048576).toFixed(1) + " MB";
        const dims = img && img.naturalWidth ? img.naturalWidth + " x " + img.naturalHeight + " pixels" : "";
        const mp = img && img.naturalWidth ? (img.naturalWidth * img.naturalHeight / 1e6).toFixed(1) + " megapixels" : "";
        pane.innerHTML = `<h4>File information</h4><dl>${[["Name", e.name], ["Taken or saved", e.mtime ? new Date(e.mtime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""], ["Size", sz], ["Dimensions", dims], ["", mp], ["Folder", NX.fs.parent ? NX.fs.parent(e.path) : ""]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${NX.esc(v)}</dd>`).join("")}</dl><button class="btn sm" data-pfolder>Open the folder</button>`;
        pane.querySelector("[data-pfolder]").onclick = () => NX.open("files", { path: NX.fs.parent(e.path) });
      };
      win.phInfo = infoDraw;
      const favMark = () => { const e = list[i], on = !!e && NX.data("photo-favs", []).includes(e.path), b = body.querySelector(".ph-fav"); b.hidden = !e; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); };
      async function gallery() {
        nm.textContent = "Pictures"; win.el.querySelector(".wt-name").textContent = "Photos"; body.querySelector(".ph-wall").hidden = true; body.querySelector(".ph-del").hidden = true; body.querySelector(".ph-edit-b").hidden = true; body.querySelector(".ph-fav").hidden = true; body.querySelector(".ph-favs").hidden = false; editClose();
        let r; try { r = await NX.fs.list(opts.dir || await NX.folder("Pictures")); } catch (e) { v.innerHTML = `<p class="ph-msg">${NX.esc(e.message)}</p>`; return; }
        const shots = r.entries.find((x) => x.dir && x.name === "Screenshots"); let more = [];
        if (shots) { try { more = (await NX.fs.list(shots.path)).entries; } catch (e) { more = []; } }
        list = [...r.entries, ...more].filter((x) => x.kind === "image"); const favs = new Set(NX.data("photo-favs", []));
        if (onlyFav) list = list.filter((x) => favs.has(x.path));
        if (onlyFav && !list.length) { v.innerHTML = `<p class="ph-msg">No favorites yet. Open a picture and press the heart.</p>`; return; }
        v.innerHTML = list.length ? `<div class="ph-grid">${list.map((e, k) => `<button class="ph-tile" data-i="${k}" title="${NX.esc(e.name)}"><img alt="${NX.esc(e.name)}" loading="lazy">${favs.has(e.path) ? `<i class="ph-heart"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z" fill="currentColor"/></svg></i>` : ""}</button>`).join("")}</div>` : `<div class="ph-empty">${NX.icon("photos", 88)}<b>No pictures yet</b><p class="ph-msg">Screenshots, camera photos and pictures you save go in Pictures.</p><div class="ph-eb"><button class="btn primary" data-phe="camera">Open Camera</button><button class="btn" data-phe="shot">Take a screenshot</button></div></div>`;
        v.querySelectorAll("[data-phe]").forEach((b) => (b.onclick = () => { if (b.dataset.phe === "camera") NX.open("camera"); else if (NX.snipArea) NX.snipArea(); }));
        v.querySelectorAll(".ph-tile").forEach(async (t) => { const e = list[+t.dataset.i]; t.onclick = () => { i = +t.dataset.i; show(); }; try { t.querySelector("img").src = await NX.fs.url(e.path); } catch (er) { /* skip */ } });
      }
      body.querySelector(".ph-bar").onclick = (e) => {
        const b = e.target.closest("[data-p]"); if (!b) return; const k = b.dataset.p;
        if (k === "edit") { editOpen(); return; }
        if (k === "del" && list[i]) { const it = list[i]; NX.fs.remove([it.path]).then(() => { list.splice(i, 1); NX.filesChanged && NX.filesChanged(); NX.toast(it.name + " is in the Recycle Bin."); if (!list.length) gallery(); else { i = i % list.length; show(); } }).catch((er) => NX.toast(er.message)); return; }
        // File information (like Windows Photos): name, size, dimensions, date and where it is
        if (k === "info") { const on = !NX.data("ph-info", false); NX.setData("ph-info", on); infoDraw(); return; }
        if (k === "ocr" && list[i]) { NX.toast("Reading the text..."); NX.api("POST", "/ocr", { path: list[i].path }).then((r) => { const t = r.text || ""; if (!t) { NX.toast("No text was found in this picture."); return; } navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); if (NX.clip) NX.clip.add(t); NX.api("POST", "/clip", { text: t }).catch(() => {}); NX.toast("Copied the text: " + (t.length > 60 ? t.slice(0, 60) + "..." : t)); }).catch((e) => NX.toast(e.message)); return; }
        if (k === "fav" && list[i]) { const L = NX.data("photo-favs", []), pth = list[i].path; NX.setData("photo-favs", L.includes(pth) ? L.filter((x) => x !== pth) : [pth, ...L].slice(0, 500)); favMark(); return; }
        if (k === "favs") { onlyFav = !onlyFav; b.classList.toggle("on", onlyFav); b.setAttribute("aria-pressed", onlyFav); gallery(); return; }
        if (k === "wall" && list[i] && NX.setWallpaperFile) { const it = list[i]; (async () => { try { const blob = await (await fetch(await NX.fs.url(it.path))).blob(); const ext = (it.name.split(".").pop() || "").toLowerCase(); await NX.setWallpaperFile(new File([blob], it.name, { type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/" + (ext === "jpg" ? "jpeg" : ext || "jpeg") })); } catch (er) { NX.toast(er.message || "That picture couldn't be used."); } })(); return; }
        if (k === "prev" && list.length) { i = (i - 1 + list.length) % list.length; show(); } if (k === "next" && list.length) { i = (i + 1) % list.length; show(); }
        if (k === "in") { zoom = Math.min(6, zoom * 1.25); tf(); } if (k === "out") { zoom = Math.max(0.2, zoom / 1.25); tf(); } if (k === "turn") { turn = (turn + 90) % 360; tf(); } if (k === "all") { slideStop(); gallery(); } if (k === "slide") { if (slideT) slideStop(); else slideGo(); }
      };
      body.tabIndex = 0; body.addEventListener("keydown", (e) => { if (e.key === "Escape" && slideT) { e.stopPropagation(); slideStop(); return; } if (e.key === "ArrowLeft") body.querySelector("[data-p=prev]").click(); if (e.key === "ArrowRight") body.querySelector("[data-p=next]").click(); });
      const start = (o) => { if (o.path) { list = (o.list && o.list.length ? o.list : [{ name: NX.fs.base(o.path), path: o.path, kind: "image" }]); i = Math.max(0, list.findIndex((x) => x.path === o.path)); show(); } else gallery(); };
      win.onopts = start; start(opts);
      const oldClose = win.onclose; win.onclose = () => { slideStop(); if (oldClose) oldClose(); };
      win.slideshow = { on: () => !!slideT, start: slideGo, stop: slideStop, at: () => i };
    } };

  // ---------- Media Player ----------
  A.media = { name: "Media Player", icon: "media", builtIn: true, w: 860, h: 560, minW: 340, minH: 280, desc: "Play your music and videos.",
    open(body, win, opts) {
      body.classList.add("mp");
      let list = [], i = 0;
      body.innerHTML = `<div class="mp-stage"></div><div class="mp-side"><div class="mp-head"><h4>Up next</h4><span><button class="mp-c mp-speed" data-mpc="speed" title="Playback speed" aria-label="Playback speed">1x</button><button class="mp-c" data-mpc="shuffle" title="Shuffle" aria-label="Shuffle" aria-pressed="false"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button><button class="mp-c" data-mpc="repeat" title="Repeat: off" aria-label="Repeat: off"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg><i></i></button></span></div><div class="mp-list"></div><button class="btn" data-lib="1">Music and videos</button></div>`;
      const st = body.querySelector(".mp-stage"), li = body.querySelector(".mp-list");
      async function play() {
        const e = list[i]; if (!e) return library(); win.el.querySelector(".wt-name").textContent = e.name + " - Media Player";
        const video = e.kind === "video";
        st.innerHTML = `${video ? "" : musicArt(e)}<${video ? "video" : "audio"} controls autoplay playsinline></${video ? "video" : "audio"}><p class="mp-msg" hidden></p>`;
        const m = st.querySelector("video,audio"); m.volume = Math.max(0, Math.min(1, NX.prefs().volume / 100)); m.playbackRate = NX.data("mp-speed", 1); m.addEventListener("loadedmetadata", () => { m.playbackRate = NX.data("mp-speed", 1); });
        // the bars under a song dance while it plays and rest when it stops
        // a .webm with only sound in it (like a Voice Recorder recording) looks like a song, not a black video
        if (video) m.addEventListener("loadedmetadata", () => { if (m.videoWidth || st.querySelector(".mp-music")) return; m.insertAdjacentHTML("beforebegin", musicArt(e)); m.classList.add("mp-snd"); const a2 = st.querySelector(".mp-music"), on2 = () => a2.classList.toggle("playing", !m.paused && !m.ended); m.addEventListener("play", on2); m.addEventListener("pause", on2); m.addEventListener("ended", on2); on2(); });
        const art = st.querySelector(".mp-music"); if (art) { const on = () => art.classList.toggle("playing", !m.paused && !m.ended); m.addEventListener("play", on); m.addEventListener("pause", on); m.addEventListener("ended", on); }
        NX.nowPlaying = () => (document.body.contains(m) && m.currentSrc ? { name: e.name, video, playing: !m.paused, toggle: () => (m.paused ? m.play().catch(() => {}) : m.pause()), next: () => { if (list.length > 1) { i = (i + 1) % list.length; play(); } } } : null);
        // picture in picture: the video keeps playing in a small window on top while you do other things
        if (video && document.pictureInPictureEnabled) { st.insertAdjacentHTML("beforeend", `<button class="btn sm mp-pip" title="Picture in picture">${NX.icon("display", 14)}Picture in picture</button>`); st.querySelector(".mp-pip").onclick = () => (document.pictureInPictureElement ? document.exitPictureInPicture() : m.requestPictureInPicture()).catch((er) => NX.toast(er.message || "Picture in picture didn't start.")); }
        // what plays next: the same one again (Repeat one), a random one (Shuffle), the next one, or the first again (Repeat all)
        m.onended = () => { const rp = NX.data("mp-repeat", "off"); if (rp === "one") { m.currentTime = 0; m.play().catch(() => {}); return; }
          if (NX.data("mp-shuffle", false) && list.length > 1) { let k = i; while (k === i) k = Math.floor(Math.random() * list.length); i = k; play(); return; }
          if (i < list.length - 1) { i++; play(); } else if (rp === "all" && list.length) { i = 0; play(); } };
        m.onerror = () => { const p = st.querySelector(".mp-msg"); p.hidden = false; p.textContent = "This file can't be played. Nebulux OS plays MP4, WebM, MP3, WAV, OGG, M4A and FLAC."; };
        try { m.src = await NX.fs.url(e.path); } catch (er) { m.onerror(); }
        // captions: a .vtt or .srt file with the same name next to the video shows as subtitles (CC turns them off)
        if (video) captions(e, m).catch(() => {});
        drawList();
      }
      async function captions(e, m) {
        const dir = NX.fs.parent(e.path), stem = e.name.replace(/\.[^.]+$/, "").toLowerCase();
        const sub = ((await NX.fs.list(dir)).entries || []).find((x) => !x.dir && /\.(vtt|srt)$/i.test(x.name) && x.name.replace(/\.[^.]+$/, "").toLowerCase() === stem);
        if (!sub || !document.body.contains(m)) return;
        let t = await (await fetch(await NX.fs.url(sub.path))).text();
        if (/\.srt$/i.test(sub.name)) t = "WEBVTT\n\n" + t.replace(/\r/g, "").replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2");
        const u = URL.createObjectURL(new Blob([t], { type: "text/vtt" })), tr = document.createElement("track");
        tr.kind = "subtitles"; tr.label = "Captions"; tr.srclang = (navigator.language || "en").slice(0, 2); tr.src = u; tr.default = true; m.appendChild(tr);
        const show = () => { if (m.textTracks[0]) m.textTracks[0].mode = NX.data("mp-cc", true) ? "showing" : "hidden"; };
        tr.addEventListener("load", show); setTimeout(show, 50);
        st.insertAdjacentHTML("beforeend", `<button class="btn sm mp-cc ${NX.data("mp-cc", true) ? "on" : ""}" aria-pressed="${NX.data("mp-cc", true)}" title="Captions">CC</button>`);
        const b = st.querySelector(".mp-cc"); b.onclick = () => { NX.setData("mp-cc", !NX.data("mp-cc", true)); b.classList.toggle("on", NX.data("mp-cc", true)); b.setAttribute("aria-pressed", NX.data("mp-cc", true)); show(); };
        win.captions = { track: () => m.textTracks[0], file: sub.name };
      }
      const musicArt = (e) => `<div class="mp-art mp-music"><div class="mp-glow"></div>${NX.icon("faudio", 120)}<b>${NX.esc(e.name)}</b><div class="mp-bars" aria-hidden="true">${Array.from({ length: 28 }, (_, k) => `<i style="--d:${((k * 37) % 11) / 10 + 0.45}s;--h:${30 + ((k * 53) % 70)}%"></i>`).join("")}</div></div>`;
      function drawList() { li.innerHTML = list.map((e, k) => `<button class="mp-item ${k === i ? "on" : ""}" data-i="${k}">${NX.icon(e.kind === "video" ? "fvideo" : "faudio", 20)}<span>${NX.esc(e.name)}</span></button>`).join("") || `<p class="fx-none">Nothing to play yet.</p>`; li.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { i = +b.dataset.i; play(); })); }
      async function library() {
        win.el.querySelector(".wt-name").textContent = "Media Player"; list = [];
        for (const f of ["Music", "Videos"]) { try { list.push(...(await NX.fs.list(await NX.folder(f))).entries.filter((x) => x.kind === "audio" || x.kind === "video")); } catch (e) { /* skip */ } }
        st.innerHTML = `<div class="mp-art">${NX.icon("media", 96)}<b>${list.length ? "Pick something to play" : "No music or videos yet"}</b><small>${list.length ? "" : "Put them in your Music or Videos folders, or open them from a USB drive in File Explorer."}</small></div>`; i = -1; drawList();
      }
      body.querySelector("[data-lib]").onclick = library;
      const ctl = () => { const sh = NX.data("mp-shuffle", false), rp = NX.data("mp-repeat", "off"), s = body.querySelector("[data-mpc=shuffle]"), r = body.querySelector("[data-mpc=repeat]");
        s.classList.toggle("on", sh); s.setAttribute("aria-pressed", sh); r.classList.toggle("on", rp !== "off"); r.querySelector("i").textContent = rp === "one" ? "1" : ""; const t = "Repeat: " + { off: "off", all: "all", one: "this one" }[rp]; r.title = t; r.setAttribute("aria-label", t); };
      const SP = [0.5, 0.75, 1, 1.25, 1.5, 2], spLabel = () => { const b = body.querySelector("[data-mpc=speed]"); if (b) { const v = NX.data("mp-speed", 1); b.textContent = v + "x"; b.classList.toggle("on", v !== 1); } }; spLabel();
      body.querySelector(".mp-head").addEventListener("click", (e) => { const b = e.target.closest("[data-mpc=speed]"); if (!b) return; e.stopImmediatePropagation(); const v = SP[(SP.indexOf(NX.data("mp-speed", 1)) + 1) % SP.length]; NX.setData("mp-speed", v); const m = st.querySelector("video,audio"); if (m) m.playbackRate = v; spLabel(); NX.toast("Playback speed: " + v + "x"); }, true);
      body.querySelector(".mp-head").onclick = (e) => { const b = e.target.closest("[data-mpc]"); if (!b) return; if (b.dataset.mpc === "shuffle") NX.setData("mp-shuffle", !NX.data("mp-shuffle", false)); else NX.setData("mp-repeat", { off: "all", all: "one", one: "off" }[NX.data("mp-repeat", "off")]); ctl(); };
      ctl();
      const start = (o) => { if (o.path) { list = o.list && o.list.length ? o.list : [{ name: NX.fs.base(o.path), path: o.path, kind: kindOf(o.path, false) }]; i = Math.max(0, list.findIndex((x) => x.path === o.path)); play(); } else library(); };
      win.onopts = start; win.onclose = () => { const m = st.querySelector("video,audio"); if (m) { m.pause(); m.removeAttribute("src"); m.load(); } };
      st.tabIndex = -1; body.addEventListener("pointerdown", () => setTimeout(() => { if (!win.el.contains(document.activeElement)) st.focus({ preventScroll: true }); }, 0));
      // keys, like other players: Space plays or pauses, Left and Right skip 10 seconds, Up and Down change the volume, F for full screen
      win.el.addEventListener("keydown", (e) => {
        const m = st.querySelector("video,audio"); if (!m || e.target.closest("input, textarea, button")) return;
        if (e.key === " " || e.key === "k") { e.preventDefault(); if (m.paused) m.play().catch(() => {}); else m.pause(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); m.currentTime = Math.max(0, m.currentTime - 10); }
        else if (e.key === "ArrowRight") { e.preventDefault(); m.currentTime = Math.min(m.duration || 1e9, m.currentTime + 10); }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); m.volume = Math.max(0, Math.min(1, m.volume + (e.key === "ArrowUp" ? 0.1 : -0.1))); }
        else if ((e.key === "f" || e.key === "F") && m.tagName === "VIDEO") { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else m.requestFullscreen().catch(() => {}); }
      });
      start(opts);
    } };

  // ---------- screenshots: Snipping Tool, Nebulux + Shift + S and Print Screen ----------
  NX.screenshot = async (quiet) => {
    let r;
    if (NX.native) { await new Promise((ok) => setTimeout(ok, 250)); r = await NX.api("POST", "/screenshot"); }
    else {
      // in a browser tab, the browser asks which screen or tab to capture
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error("This browser can't take screenshots.");
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true }).catch(() => { throw new Error("No screen was picked."); });
      const v = document.createElement("video"); v.srcObject = s; v.muted = true; await v.play(); await new Promise((ok) => setTimeout(ok, 200));
      const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); s.getTracks().forEach((t) => t.stop());
      const blob = await new Promise((ok) => c.toBlob(ok, "image/png")); const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
      r = await NX.fs.upload(await NX.folder("Pictures"), `Screenshot ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`, blob);
    }
    // and on the clipboard, like Windows: Ctrl + V pastes it straight into any app
    let copied = false;
    if (r && r.path && NX.prefs().shotClip !== false) {
      if (NX.native) { try { await NX.api("POST", "/clip/image", { path: r.path }); copied = true; } catch (e) { /* not this time */ } }
      else if (navigator.clipboard && window.ClipboardItem) { try { const b = await (await fetch(await NX.fs.url(r.path))).blob(); await navigator.clipboard.write([new ClipboardItem({ "image/png": b.type === "image/png" ? b : new Blob([b], { type: "image/png" }) })]); copied = true; } catch (e) { /* the browser said no */ } }
    }
    if (!quiet) NX.toast("Screenshot saved in Pictures" + (NX.native ? " > Screenshots" : "") + (copied ? " and copied, so Ctrl + V pastes it." : "."));
    NX.filesChanged(); return r;
  };
  A.snip = { name: "Snipping Tool", icon: "snip", builtIn: true, w: 560, h: 460, minW: 320, minH: 300, desc: "Take a picture of your screen.",
    open(body, win) {
      body.classList.add("sn");
      // Crop: drag a box over the screenshot, then save just that part next to it
      const crop = (r) => {
        const v = body.querySelector(".sn-view"), img = v.querySelector("img"); if (!img || !img.naturalWidth) return;
        v.classList.add("sn-cropping"); const box = document.createElement("div"); box.className = "sn-box"; box.hidden = true; v.appendChild(box);
        const acts = v.querySelector(".sn-acts"); acts.innerHTML = `<span class="sn-hint">Drag over the part you want</span><button class="btn primary" data-c="save" disabled>Save crop</button><button class="btn" data-c="cancel">Cancel</button>`;
        let a = null, sel = null;
        const rel = (e) => { const b = img.getBoundingClientRect(); return { x: Math.max(0, Math.min(b.width, e.clientX - b.left)), y: Math.max(0, Math.min(b.height, e.clientY - b.top)), b }; };
        const show = (p, q) => { const ib = img.getBoundingClientRect(), vb = v.getBoundingClientRect(); sel = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y), bw: p.b.width, bh: p.b.height }; Object.assign(box.style, { left: ib.left - vb.left + v.scrollLeft + sel.x + "px", top: ib.top - vb.top + v.scrollTop + sel.y + "px", width: sel.w + "px", height: sel.h + "px" }); box.hidden = false; acts.querySelector("[data-c=save]").disabled = sel.w < 4 || sel.h < 4; };
        img.onpointerdown = (e) => { e.preventDefault(); a = rel(e); img.setPointerCapture(e.pointerId); };
        img.onpointermove = (e) => { if (a) show(a, rel(e)); };
        img.onpointerup = (e) => { if (a) show(a, rel(e)); a = null; };
        win.snipSelect = (x, y, w, h) => { const b = img.getBoundingClientRect(); show({ x, y, b }, { x: x + w, y: y + h, b }); };
        const done = () => { v.classList.remove("sn-cropping"); box.remove(); img.onpointerdown = img.onpointermove = img.onpointerup = null; };
        acts.querySelector("[data-c=cancel]").onclick = () => { done(); acts.innerHTML = `<button class="btn" data-o="open">Open in Photos</button>`; acts.querySelector("[data-o=open]").onclick = () => NX.open("photos", { path: r.path }); };
        acts.querySelector("[data-c=save]").onclick = async () => {
          if (!sel) return; const k = img.naturalWidth / sel.bw, c = document.createElement("canvas"); c.width = Math.round(sel.w * k); c.height = Math.round(sel.h * (img.naturalHeight / sel.bh));
          c.getContext("2d").drawImage(img, sel.x * k, sel.y * (img.naturalHeight / sel.bh), c.width, c.height, 0, 0, c.width, c.height);
          const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
          try { const name = NX.fs.base(r.path).replace(/\.png$/i, "") + " (cropped).png", out = await NX.fs.upload(NX.fs.parent(r.path), name, blob); done(); img.src = await NX.fs.url(out.path); win.snipLast = out; NX.toast("Saved as " + out.name + "."); NX.filesChanged && NX.filesChanged();
            acts.innerHTML = `<button class="btn" data-o="open">Open in Photos</button>`; acts.querySelector("[data-o=open]").onclick = () => NX.open("photos", { path: out.path }); }
          catch (er) { NX.toast(er.message); }
        };
      };
      win.snipCrop = crop;
      // Draw: a pen over the screenshot (four colors, Undo), saved as a copy at full size next to it
      const draw = (r) => {
        const v = body.querySelector(".sn-view"), img = v.querySelector("img"); if (!img || !img.naturalWidth) return;
        const b0 = img.getBoundingClientRect(), vb = v.getBoundingClientRect(), cv = document.createElement("canvas"); cv.className = "sn-ink";
        cv.width = Math.round(b0.width); cv.height = Math.round(b0.height); cv.style.left = (b0.left - vb.left + v.scrollLeft) + "px"; cv.style.top = (b0.top - vb.top + v.scrollTop) + "px"; v.appendChild(cv); v.classList.add("sn-drawing");
        const g = cv.getContext("2d"), COLS = ["#ef4444", "#facc15", "#3b82f6", "#ffffff"], strokes = []; let col = COLS[0], cur = null;
        const acts = v.querySelector(".sn-acts"); acts.innerHTML = `<span class="sn-pens">${COLS.map((c, i) => `<button class="${i ? "" : "on"}" data-pen="${c}" style="background:${c}" aria-label="Pen color ${c}"></button>`).join("")}</span><button class="btn" data-d="undo">Undo</button><button class="btn primary" data-d="save">Save drawing</button><button class="btn" data-d="cancel">Cancel</button>`;
        const paint = () => { g.clearRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = "round"; for (const s of strokes) { g.strokeStyle = s.c; g.lineWidth = 4; g.beginPath(); s.p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (s.p.length === 1) g.lineTo(s.p[0][0] + .1, s.p[0][1]); g.stroke(); } };
        const at = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
        cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { c: col, p: [at(e)] }; strokes.push(cur); paint(); };
        cv.onpointermove = (e) => { if (!cur) return; cur.p.push(at(e)); paint(); };
        cv.onpointerup = cv.onpointercancel = () => { cur = null; };
        win.snipInk = { strokes: () => strokes.length, line: (x0, y0, x1, y1) => { strokes.push({ c: col, p: [[x0, y0], [x1, y1]] }); paint(); } };
        const done = () => { cv.remove(); v.classList.remove("sn-drawing"); delete win.snipInk; };
        const back = (path) => { acts.innerHTML = `<button class="btn primary" data-o="crop">Crop</button><button class="btn primary" data-o="draw">Draw</button><button class="btn" data-o="open">Open in Photos</button>`; acts.querySelector("[data-o=open]").onclick = () => NX.open("photos", { path }); acts.querySelector("[data-o=crop]").onclick = () => crop({ path }); acts.querySelector("[data-o=draw]").onclick = () => draw({ path }); };
        acts.onclick = async (e) => {
          const pen = e.target.closest("[data-pen]"); if (pen) { col = pen.dataset.pen; acts.querySelectorAll("[data-pen]").forEach((x) => x.classList.toggle("on", x === pen)); return; }
          const d = e.target.closest("[data-d]"); if (!d) return;
          if (d.dataset.d === "undo") { strokes.pop(); paint(); }
          if (d.dataset.d === "cancel") { acts.onclick = null; done(); back(r.path); }
          if (d.dataset.d === "save") {
            if (!strokes.length) { NX.toast("Draw something first."); return; }
            const k = img.naturalWidth / cv.width, c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext("2d");
            x.drawImage(img, 0, 0); x.scale(k, img.naturalHeight / cv.height); x.lineCap = x.lineJoin = "round";
            for (const s of strokes) { x.strokeStyle = s.c; x.lineWidth = 4; x.beginPath(); s.p.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); if (s.p.length === 1) x.lineTo(s.p[0][0] + .1, s.p[0][1]); x.stroke(); }
            const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
            try { const name = NX.fs.base(r.path).replace(/( \(drawing\))?\.png$/i, "") + " (drawing).png", out = await NX.fs.upload(NX.fs.parent(r.path), name, blob); acts.onclick = null; done(); img.src = await NX.fs.url(out.path); win.snipLast = out; NX.toast("Saved as " + out.name + "."); NX.filesChanged && NX.filesChanged(); back(out.path); }
            catch (er) { NX.toast(er.message); }
          }
        };
      };
      win.snipDraw = draw;
      body.innerHTML = `<div class="sn-bar"><button class="btn primary" data-s="0">${NX.icon("camera", 16)}New screenshot</button><label class="sn-delay">Wait <select aria-label="Wait before taking it"><option value="0">no time</option><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label></div><div class="sn-view"><p class="sn-tip">Tip: press <b>Nebulux + Shift + S</b> or <b>Print Screen</b> any time. Screenshots go in Pictures${NX.native ? " > Screenshots" : ""}.</p></div>`;
      const v = body.querySelector(".sn-view"), btn = body.querySelector("[data-s]");
      // Record: film the screen into Videos (on the Nebulux OS USB with screen recording)
      if (NX.native) NX.api("GET", "/screenrec").then((r) => { if (!r.available || body.querySelector(".sn-rec")) return; btn.insertAdjacentHTML("afterend", `<button class="btn sn-rec" data-rec>${NX.icon("recorder", 16)}Record screen</button>`); body.querySelector("[data-rec]").onclick = () => NX.screenRec && NX.screenRec.start(); }).catch(() => {});
      btn.onclick = async () => {
        const wait = +body.querySelector("select").value; btn.disabled = true;
        for (let s = wait; s > 0; s--) { btn.textContent = "Taking it in " + s + "..."; await new Promise((ok) => setTimeout(ok, 1000)); }
        NX.minimize("snip");
        try { const r = await NX.screenshot(true); NX.focus("snip"); v.innerHTML = `<img alt="Your screenshot"><div class="sn-acts"><button class="btn" data-o="open">Open in Photos</button><button class="btn" data-o="folder">Show in File Explorer</button></div>`;
          v.querySelector("img").src = await NX.fs.url(r.path); v.querySelector("[data-o=open]").onclick = () => NX.open("photos", { path: r.path });
          v.querySelector("[data-o=folder]").onclick = () => NX.open("files", { path: NX.fs.parent(r.path) }); NX.toast("Screenshot saved.");
          v.querySelector(".sn-acts").insertAdjacentHTML("afterbegin", `<button class="btn primary" data-o="crop">Crop</button><button class="btn primary" data-o="draw">Draw</button>`); v.querySelector("[data-o=crop]").onclick = () => crop(r); v.querySelector("[data-o=draw]").onclick = () => draw(r);
          // Copy text (like Windows' Text actions): read the words in the screenshot, offline, and copy them
          if (NX.native) { v.querySelector("[data-o=draw]").insertAdjacentHTML("afterend", `<button class="btn" data-o="ocr">Copy text</button>`);
            v.querySelector("[data-o=ocr]").onclick = async (ev) => { const b = ev.currentTarget; b.disabled = true; b.textContent = "Reading..."; try { const t = (await NX.api("POST", "/ocr", { path: r.path })).text; if (!t) { NX.toast("No text was found in this screenshot."); } else { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); if (NX.clip) NX.clip.add(t); NX.api("POST", "/clip", { text: t }).catch(() => {}); NX.toast("Copied the text: " + (t.length > 60 ? t.slice(0, 60) + "..." : t)); } } catch (er) { NX.toast(er.message); } b.disabled = false; b.textContent = "Copy text"; }; }
        } catch (e) { NX.focus("snip"); NX.toast(e.message); }
        btn.disabled = false; btn.innerHTML = `${NX.icon("camera", 16)}New screenshot`;
      };
    } };
})();
