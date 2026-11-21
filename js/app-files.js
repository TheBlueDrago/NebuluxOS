// File Explorer, Photos, Media Player and Snipping Tool.
// On the real Nebulux OS (from the USB) they use the computer's real files: your folders (Desktop, Documents,
// Downloads, Pictures, Music, Videos), the Recycle Bin and plugged-in USB drives. In a browser tab they use a small
// file store kept with your account in this browser.
"use strict";
(function () {
  const A = NX.apps, FOLDERS = ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"];
  const KINDS = { image: /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i, video: /\.(mp4|webm|mkv|mov|m4v|ogv)$/i, audio: /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/i, text: /\.(txt|md|csv|json|log|ini|cfg|conf|xml|html?|css|js|py|sh|yml|yaml)$/i, pdf: /\.pdf$/i };
  const kindOf = (n, dir) => dir ? "folder" : Object.keys(KINDS).find((k) => KINDS[k].test(n)) || "file";
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
      async drives() { return []; }, async mount() { throw new Error("USB drives open on the real Nebulux OS."); }, async eject() { return { ok: true }; },
      parent, join, base, sep: "/",
    };
  })();

  // ---------- files on the real computer (through the system helper) ----------
  const R = (function () {
    let pl = null;
    const sep = () => (pl && pl.sep) || "/";
    const parent = (p) => { const i = p.lastIndexOf(sep()); return i > 0 ? p.slice(0, i) : sep(); };
    return {
      async places() { pl = pl || await NX.api("GET", "/files/places"); return pl; },
      list: (p) => NX.api("POST", "/files/list", { path: p }),
      read: async (p) => (await NX.api("POST", "/files/read", { path: p })).text,
      write: (p, text) => NX.api("POST", "/files/write", { path: p, text }),
      create: (dir, name, folder) => NX.api("POST", "/files/new", { dir, name, folder: !!folder }),
      rename: (p, name) => NX.api("POST", "/files/rename", { path: p, name }),
      remove: (paths, permanent) => NX.api("POST", "/files/delete", { paths, permanent: !!permanent }),
      trash: () => NX.api("GET", "/files/trash"),
      restore: (ids) => NX.api("POST", "/files/restore", { ids }),
      emptyTrash: () => NX.api("POST", "/files/empty-trash"),
      copy: (paths, to, move) => NX.api("POST", "/files/copy", { paths, to, move: !!move }),
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
  NX.openFile = (e, list) => {
    if (e.dir) return NX.open("files", { path: e.path });
    const rf = NX.data("recent-files", []).filter((x) => x.path !== e.path); rf.unshift({ name: e.name, path: e.path, kind: e.kind || kindOf(e.name, false), at: Date.now() }); NX.setData("recent-files", rf.slice(0, 8));
    const k = e.kind || kindOf(e.name, false);
    if (k === "image") return NX.open("photos", { path: e.path, list: (list || []).filter((x) => x.kind === "image") });
    if (k === "video" || k === "audio") return NX.open("media", { path: e.path, list: (list || []).filter((x) => x.kind === "video" || x.kind === "audio") });
    if (k === "text") return NX.open("notepad", { file: e.path });
    NX.toast("Nebulux OS can't open " + (k === "pdf" ? "PDF files" : "this kind of file") + " yet.");
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
      body.innerHTML = `<div class="fx-top"><button class="wv-b" data-n="back" aria-label="Back" title="Back">${NX.icon("back", 16)}</button><button class="wv-b" data-n="fwd" aria-label="Forward" title="Forward">${NX.icon("fwd", 16)}</button><button class="wv-b" data-n="up" aria-label="Up one folder" title="Up">${NX.icon("up", 16)}</button><button class="wv-b" data-n="reload" aria-label="Refresh" title="Refresh">${NX.icon("restart", 16)}</button>
        <div class="fx-crumbs" aria-label="Location"></div><label class="fx-search">${NX.icon("search", 14)}<input placeholder="Search this folder" aria-label="Search this folder" spellcheck="false"></label></div>
        <div class="fx-tools"></div><div class="fx-main"><nav class="fx-side" aria-label="Places"></nav><section class="fx-list" tabindex="0" aria-label="Files"></section></div><div class="fx-status"></div>`;
      const $ = (s) => body.querySelector(s), listEl = $(".fx-list");
      const isTrash = () => cur === TRASH, isHome = () => cur === HOME;
      const selected = () => items.filter((e) => sel.has(e.path || e.id));
      const err = (e) => NX.toast(e && e.message || String(e));

      async function side() {
        places = places || await NX.fs.places().catch(() => null);
        try { drives = await NX.fs.drives(); } catch (e) { drives = []; }
        const row = (key, icon, label, extra) => `<button class="fx-place ${cur === key ? "on" : ""}" data-go="${NX.esc(key)}">${NX.icon(icon, 18)}<span>${NX.esc(label)}</span>${extra || ""}</button>`;
        $(".fx-side").innerHTML = row(HOME, "home", "Home") + (places ? places.folders.map((f) => row(f.path, "folder", f.name)).join("") : "") + row(TRASH, "recycle", "Recycle Bin") +
          (NX.native ? `<h4>USB drives</h4>` + (drives.length ? drives.map((d) => d.mount ? row(d.mount, "usb", d.label, `<i class="fx-eject" role="button" tabindex="0" data-eject="${NX.esc(d.dev)}" title="Eject ${NX.esc(d.label)}" aria-label="Eject ${NX.esc(d.label)}">${NX.icon("eject", 14)}</i>`) : `<button class="fx-place" data-mount="${NX.esc(d.dev)}">${NX.icon("usb", 18)}<span>${NX.esc(d.label)}</span></button>`).join("") : `<p class="fx-none">Plug in a USB drive and it shows up here.</p>`) : "");
        $(".fx-side").querySelectorAll("[data-go]").forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-eject]")) return; go(b.dataset.go); }));
        $(".fx-side").querySelectorAll("[data-mount]").forEach((b) => (b.onclick = async () => { try { const r = await NX.fs.mount(b.dataset.mount); await side(); go(r.mount); } catch (e) { err(e); } }));
        $(".fx-side").querySelectorAll("[data-eject]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const d = drives.find((x) => x.dev === b.dataset.eject); try { await NX.fs.eject(b.dataset.eject); NX.toast("It's safe to take out " + (d ? d.label : "the drive") + " now."); if (d && cur && cur.startsWith(d.mount)) go(HOME, true); else side(); } catch (er) { err(er); } }));
      }
      function crumbs() {
        const c = $(".fx-crumbs");
        if (isHome()) { c.innerHTML = `<span class="fx-cr">${NX.icon("home", 14)}Home</span>`; return; }
        if (isTrash()) { c.innerHTML = `<span class="fx-cr">${NX.icon("recycle", 14)}Recycle Bin</span>`; return; }
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
          : (isHome() ? "" : t("newfolder", "newfolder", "New folder") + t("newtext", "ftext", "New text file") + `<i class="fx-div"></i>`) + t("cut", "cut", "Cut", any && !isHome()) + t("copy", "copy", "Copy", any && !isHome()) + t("paste", "paste", "Paste", !!NX.fsClip && !isHome()) + t("rename", "rename", "Rename", one && !isHome()) + t("delete", "trash", "Delete", any && !isHome()) + `<span class="fx-sp"></span>` + t("view", view === "grid" ? "listv" : "grid", view === "grid" ? "Details" : "Icons");
        $(".fx-tools").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => act(b.dataset.t)));
      }
      function status() { const s = selected(); $(".fx-status").textContent = (loading ? "Loading... " : "") + items.length + (items.length === 1 ? " item" : " items") + (s.length ? `  ·  ${s.length} selected${s.length === 1 && s[0].size != null ? "  ·  " + size(s[0].size) : ""}` : ""); }
      function render() {
        const shown = q ? items.filter((e) => e.name.toLowerCase().includes(q)) : items;
        listEl.className = "fx-list " + view; tools(); status();
        if (!shown.length) { listEl.innerHTML = `<div class="fx-empty">${NX.icon(isTrash() ? "recycle" : "folder", 56)}<p>${q ? "Nothing here matches." : isTrash() ? "The Recycle Bin is empty." : "This folder is empty."}</p></div>`; return; }
        listEl.innerHTML = (view === "list" ? `<div class="fx-head"><span>Name</span><span>${isTrash() ? "Deleted" : "Date changed"}</span><span>Type</span><span>Size</span></div>` : "") + shown.map((e) => { const key = e.path || e.id;
          return `<button class="fx-item ${sel.has(key) ? "sel" : ""} ${NX.fsClip && NX.fsClip.move && NX.fsClip.paths.includes(e.path) ? "cutting" : ""}" data-k="${NX.esc(key)}" title="${NX.esc(e.name)}">${e.kind === "image" && view === "grid" && !isTrash() ? `<span class="fx-thumb" data-thumb="${NX.esc(e.path)}">${NX.icon("fimage", 44)}</span>` : NX.icon(ICON[e.kind] || "file", view === "grid" ? 44 : 20)}<span class="fx-n">${NX.esc(e.name)}</span>${view === "list" ? `<span class="fx-d">${NX.esc(isTrash() ? (e.deleted || "").replace("T", " ") : when(e.mtime))}</span><span class="fx-d">${e.dir ? "Folder" : (e.kind === "file" ? (e.name.includes(".") ? e.name.split(".").pop().toUpperCase() + " file" : "File") : e.kind[0].toUpperCase() + e.kind.slice(1))}</span><span class="fx-d">${e.dir ? "" : size(e.size)}</span>` : ""}</button>`; }).join("");
        listEl.querySelectorAll("[data-thumb]").forEach(async (t) => { try { const u = await NX.fs.url(t.dataset.thumb); t.innerHTML = `<img src="${NX.esc(u)}" alt="" loading="lazy">`; } catch (e) { /* keep the icon */ } });
      }
      // selecting only moves the highlight (redrawing the list would break double-clicks)
      function marks() { listEl.querySelectorAll(".fx-item").forEach((b) => b.classList.toggle("sel", sel.has(b.dataset.k))); tools(); status(); }
      async function load() {
        loading++; status();
        try {
          if (isHome()) { places = places || await NX.fs.places(); items = places.folders.map((f) => ({ name: f.name, path: f.path, dir: true, kind: "folder" })); parentPath = null; }
          else if (isTrash()) { items = (await NX.fs.trash()).entries; parentPath = null; }
          else { const r = await NX.fs.list(cur); cur = r.path; items = r.entries; parentPath = r.parent; }
          sel = new Set([...sel].filter((k) => items.some((e) => (e.path || e.id) === k)));
        } catch (e) { err(e); if (!isHome()) { cur = HOME; return load(); } } finally { loading--; }
        win.el.querySelector(".wt-name").textContent = (isHome() ? "Home" : isTrash() ? "Recycle Bin" : NX.fs.base(cur) || cur) + " - File Explorer";
        crumbs(); render(); side(); $(".fx-top [data-n=back]").disabled = !back.length; $(".fx-top [data-n=fwd]").disabled = !fwd.length; $(".fx-top [data-n=up]").disabled = !parentPath && isHome();
      }
      function go(p, noHist) { if (p === cur) return load(); if (cur && !noHist) { back.push(cur); fwd = []; } cur = p; sel.clear(); q = ""; $(".fx-search input").value = ""; load(); }
      const here = () => isHome() || isTrash() ? null : cur;
      async function act(k) {
        const s = selected();
        try {
          if (k === "view") { view = view === "grid" ? "list" : "grid"; NX.setData("fx-view", view); render(); return; }
          if (k === "newfolder" || k === "newtext") { const name = await NX.ask(body, { title: k === "newfolder" ? "New folder" : "New text file", input: true, value: k === "newfolder" ? "New folder" : "New text file.txt", ok: "Make it" }); if (!name) return; const r = await NX.fs.create(here(), name, k === "newfolder"); await load(); sel = new Set([r.path]); render(); return; }
          if (k === "cut" || k === "copy") { NX.fsClip = { move: k === "cut", paths: s.map((e) => e.path) }; NX.toast((k === "cut" ? "Cut " : "Copied ") + s.length + (s.length === 1 ? " item." : " items.") + " Open a folder and press Paste."); render(); return; }
          if (k === "paste") { if (!NX.fsClip || !here()) return; const c = NX.fsClip; const r = await NX.fs.copy(c.paths, here(), c.move); if (c.move) NX.fsClip = null; await load(); sel = new Set(r.paths); render(); return; }
          if (k === "rename") { const e = s[0]; const name = await NX.ask(body, { title: "Rename", input: true, value: e.name, ok: "Rename" }); if (!name || name === e.name) return; const r = await NX.fs.rename(e.path, name); await load(); sel = new Set([r.path]); render(); return; }
          if (k === "delete") {
            const onDrive = drives.some((d) => d.mount && cur.startsWith(d.mount));
            if (onDrive && !(await NX.ask(body, { title: "Delete for good?", text: `USB drives have no Recycle Bin, so ${s.length === 1 ? `"${s[0].name}"` : s.length + " items"} can't be brought back.`, ok: "Delete", danger: true }))) return;
            await NX.fs.remove(s.map((e) => e.path), onDrive); NX.toast(onDrive ? "Deleted." : "Moved to the Recycle Bin."); await load(); return;
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
      function openItem(e) { if (isTrash()) { NX.toast("Restore it first to open it."); return; } if (e.dir) go(e.path); else NX.openFile(e, items); }
      let lastClick = null;
      listEl.addEventListener("click", (ev) => {
        const b = ev.target.closest(".fx-item"); if (!b) { if (ev.target === listEl || ev.target.closest(".fx-empty")) { sel.clear(); marks(); } return; }
        const k = b.dataset.k, e = items.find((x) => (x.path || x.id) === k);
        if (ev.ctrlKey || ev.metaKey) { sel.has(k) ? sel.delete(k) : sel.add(k); }
        else if (ev.shiftKey && lastClick) { const keys = items.map((x) => x.path || x.id), a = keys.indexOf(lastClick), z = keys.indexOf(k); sel = new Set(keys.slice(Math.min(a, z), Math.max(a, z) + 1)); }
        else { if (sel.size === 1 && sel.has(k) && ev.detail === 1 && ev.pointerType === "touch") { openItem(e); return; } sel = new Set([k]); }
        lastClick = k; marks(); if (ev.pointerType === "touch" && !ev.ctrlKey) openItem(e);
      });
      listEl.addEventListener("dblclick", (ev) => { const b = ev.target.closest(".fx-item"); if (!b) return; const e = items.find((x) => (x.path || x.id) === b.dataset.k); if (e) openItem(e); });
      listEl.addEventListener("contextmenu", (ev) => {
        ev.preventDefault(); ev.stopPropagation(); const b = ev.target.closest(".fx-item");
        if (b && !sel.has(b.dataset.k)) { sel = new Set([b.dataset.k]); marks(); }
        const s = selected(), M = [];
        if (isTrash()) { if (s.length) M.push(["Restore", () => act("restore")], ["Delete for good", () => act("purge")]); M.push(["Empty Recycle Bin", () => act("empty")]); }
        else if (s.length) { if (s.length === 1) M.push(["Open", () => openItem(s[0])]); if (!isHome()) M.push(["Cut", () => act("cut")], ["Copy", () => act("copy")]); if (s.length === 1 && !isHome()) M.push(["Rename", () => act("rename")]); if (!isHome()) M.push(["Delete", () => act("delete")]); }
        else if (!isHome()) { M.push(["New folder", () => act("newfolder")], ["New text file", () => act("newtext")]); if (NX.fsClip) M.push(["Paste", () => act("paste")]); M.push(["Refresh", () => load()]); }
        if (M.length) NX.menu(ev.clientX, ev.clientY, M);
      });
      listEl.addEventListener("keydown", (ev) => {
        if (body.querySelector(".nx-ask")) return; const k = ev.key, c = ev.ctrlKey || ev.metaKey;
        if (k === "Delete") { ev.preventDefault(); act(isTrash() ? "purge" : "delete"); }
        else if (k === "F2" && sel.size === 1) { ev.preventDefault(); act("rename"); }
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
      if (opts.path) go(opts.path, true); else if (opts.place) NX.folder(opts.place).then((p) => go(p, true)).catch(() => go(HOME, true)); else go(HOME, true);
      setTimeout(() => listEl.focus(), 60);
    } };
  NX.filesChanged = () => document.dispatchEvent(new CustomEvent("nx:files"));

  // ---------- Photos ----------
  A.photos = { name: "Photos", icon: "photos", builtIn: true, w: 900, h: 620, minW: 360, minH: 300, desc: "See your pictures and screenshots.",
    open(body, win, opts) {
      body.classList.add("ph");
      let list = [], i = 0, zoom = 1, turn = 0;
      body.innerHTML = `<div class="ph-bar"><button class="wv-b" data-p="prev" aria-label="Previous" title="Previous">${NX.icon("back", 16)}</button><button class="wv-b" data-p="next" aria-label="Next" title="Next">${NX.icon("fwd", 16)}</button><span class="ph-name"></span><button class="wv-b" data-p="out" aria-label="Zoom out" title="Zoom out">${NX.icon("zoomout", 16)}</button><button class="wv-b" data-p="in" aria-label="Zoom in" title="Zoom in">${NX.icon("zoomin", 16)}</button><button class="wv-b" data-p="turn" aria-label="Rotate" title="Rotate">${NX.icon("rotate", 16)}</button><button class="wv-b" data-p="all" aria-label="All pictures" title="All pictures">${NX.icon("grid", 16)}</button></div><div class="ph-view"></div>`;
      const v = body.querySelector(".ph-view"), nm = body.querySelector(".ph-name");
      async function show() {
        const e = list[i]; if (!e) return gallery();
        nm.textContent = e.name + (list.length > 1 ? `  (${i + 1} of ${list.length})` : ""); win.el.querySelector(".wt-name").textContent = e.name + " - Photos";
        zoom = 1; turn = 0; v.innerHTML = `<img alt="${NX.esc(e.name)}" draggable="false">`; const img = v.querySelector("img");
        try { img.src = await NX.fs.url(e.path); } catch (er) { v.innerHTML = `<p class="ph-msg">${NX.esc(er.message)}</p>`; }
        img.onerror = () => { v.innerHTML = `<p class="ph-msg">This picture couldn't be shown.</p>`; };
      }
      const tf = () => { const img = v.querySelector("img"); if (img) img.style.transform = `scale(${zoom}) rotate(${turn}deg)`; };
      async function gallery() {
        nm.textContent = "Pictures"; win.el.querySelector(".wt-name").textContent = "Photos";
        let r; try { r = await NX.fs.list(opts.dir || await NX.folder("Pictures")); } catch (e) { v.innerHTML = `<p class="ph-msg">${NX.esc(e.message)}</p>`; return; }
        const shots = r.entries.find((x) => x.dir && x.name === "Screenshots"); let more = [];
        if (shots) { try { more = (await NX.fs.list(shots.path)).entries; } catch (e) { more = []; } }
        list = [...r.entries, ...more].filter((x) => x.kind === "image");
        v.innerHTML = list.length ? `<div class="ph-grid">${list.map((e, k) => `<button class="ph-tile" data-i="${k}" title="${NX.esc(e.name)}"><img alt="${NX.esc(e.name)}" loading="lazy"></button>`).join("")}</div>` : `<p class="ph-msg">No pictures yet. Screenshots and pictures you save go in Pictures.</p>`;
        v.querySelectorAll(".ph-tile").forEach(async (t) => { const e = list[+t.dataset.i]; t.onclick = () => { i = +t.dataset.i; show(); }; try { t.querySelector("img").src = await NX.fs.url(e.path); } catch (er) { /* skip */ } });
      }
      body.querySelector(".ph-bar").onclick = (e) => {
        const b = e.target.closest("[data-p]"); if (!b) return; const k = b.dataset.p;
        if (k === "prev" && list.length) { i = (i - 1 + list.length) % list.length; show(); } if (k === "next" && list.length) { i = (i + 1) % list.length; show(); }
        if (k === "in") { zoom = Math.min(6, zoom * 1.25); tf(); } if (k === "out") { zoom = Math.max(0.2, zoom / 1.25); tf(); } if (k === "turn") { turn = (turn + 90) % 360; tf(); } if (k === "all") gallery();
      };
      body.tabIndex = 0; body.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") body.querySelector("[data-p=prev]").click(); if (e.key === "ArrowRight") body.querySelector("[data-p=next]").click(); });
      const start = (o) => { if (o.path) { list = (o.list && o.list.length ? o.list : [{ name: NX.fs.base(o.path), path: o.path, kind: "image" }]); i = Math.max(0, list.findIndex((x) => x.path === o.path)); show(); } else gallery(); };
      win.onopts = start; start(opts);
    } };

  // ---------- Media Player ----------
  A.media = { name: "Media Player", icon: "media", builtIn: true, w: 860, h: 560, minW: 340, minH: 280, desc: "Play your music and videos.",
    open(body, win, opts) {
      body.classList.add("mp");
      let list = [], i = 0;
      body.innerHTML = `<div class="mp-stage"></div><div class="mp-side"><h4>Up next</h4><div class="mp-list"></div><button class="btn" data-lib="1">Music and videos</button></div>`;
      const st = body.querySelector(".mp-stage"), li = body.querySelector(".mp-list");
      async function play() {
        const e = list[i]; if (!e) return library(); win.el.querySelector(".wt-name").textContent = e.name + " - Media Player";
        const video = e.kind === "video";
        st.innerHTML = `${video ? "" : `<div class="mp-art">${NX.icon("faudio", 120)}<b>${NX.esc(e.name)}</b></div>`}<${video ? "video" : "audio"} controls autoplay playsinline></${video ? "video" : "audio"}><p class="mp-msg" hidden></p>`;
        const m = st.querySelector("video,audio"); m.volume = Math.max(0, Math.min(1, NX.prefs().volume / 100));
        m.onended = () => { if (i < list.length - 1) { i++; play(); } };
        m.onerror = () => { const p = st.querySelector(".mp-msg"); p.hidden = false; p.textContent = "This file can't be played. Nebulux OS plays MP4, WebM, MP3, WAV, OGG, M4A and FLAC."; };
        try { m.src = await NX.fs.url(e.path); } catch (er) { m.onerror(); }
        drawList();
      }
      function drawList() { li.innerHTML = list.map((e, k) => `<button class="mp-item ${k === i ? "on" : ""}" data-i="${k}">${NX.icon(e.kind === "video" ? "fvideo" : "faudio", 20)}<span>${NX.esc(e.name)}</span></button>`).join("") || `<p class="fx-none">Nothing to play yet.</p>`; li.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { i = +b.dataset.i; play(); })); }
      async function library() {
        win.el.querySelector(".wt-name").textContent = "Media Player"; list = [];
        for (const f of ["Music", "Videos"]) { try { list.push(...(await NX.fs.list(await NX.folder(f))).entries.filter((x) => x.kind === "audio" || x.kind === "video")); } catch (e) { /* skip */ } }
        st.innerHTML = `<div class="mp-art">${NX.icon("media", 96)}<b>${list.length ? "Pick something to play" : "No music or videos yet"}</b><small>${list.length ? "" : "Put them in your Music or Videos folders, or open them from a USB drive in File Explorer."}</small></div>`; i = -1; drawList();
      }
      body.querySelector("[data-lib]").onclick = library;
      const start = (o) => { if (o.path) { list = o.list && o.list.length ? o.list : [{ name: NX.fs.base(o.path), path: o.path, kind: kindOf(o.path, false) }]; i = Math.max(0, list.findIndex((x) => x.path === o.path)); play(); } else library(); };
      win.onopts = start; win.onclose = () => { const m = st.querySelector("video,audio"); if (m) { m.pause(); m.removeAttribute("src"); m.load(); } };
      start(opts);
    } };

  // ---------- screenshots: Snipping Tool, Windows + Shift + S and Print Screen ----------
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
    if (!quiet) NX.toast("Screenshot saved in Pictures" + (NX.native ? " > Screenshots." : "."));
    NX.filesChanged(); return r;
  };
  A.snip = { name: "Snipping Tool", icon: "snip", builtIn: true, w: 560, h: 460, minW: 320, minH: 300, desc: "Take a picture of your screen.",
    open(body, win) {
      body.classList.add("sn");
      body.innerHTML = `<div class="sn-bar"><button class="btn primary" data-s="0">${NX.icon("camera", 16)}New screenshot</button><label class="sn-delay">Wait <select aria-label="Wait before taking it"><option value="0">no time</option><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label></div><div class="sn-view"><p class="sn-tip">Tip: press <b>Windows + Shift + S</b> or <b>Print Screen</b> any time. Screenshots go in Pictures${NX.native ? " > Screenshots" : ""}.</p></div>`;
      const v = body.querySelector(".sn-view"), btn = body.querySelector("[data-s]");
      btn.onclick = async () => {
        const wait = +body.querySelector("select").value; btn.disabled = true;
        for (let s = wait; s > 0; s--) { btn.textContent = "Taking it in " + s + "..."; await new Promise((ok) => setTimeout(ok, 1000)); }
        NX.minimize("snip");
        try { const r = await NX.screenshot(true); NX.focus("snip"); v.innerHTML = `<img alt="Your screenshot"><div class="sn-acts"><button class="btn" data-o="open">Open in Photos</button><button class="btn" data-o="folder">Show in File Explorer</button></div>`;
          v.querySelector("img").src = await NX.fs.url(r.path); v.querySelector("[data-o=open]").onclick = () => NX.open("photos", { path: r.path });
          v.querySelector("[data-o=folder]").onclick = () => NX.open("files", { path: NX.fs.parent(r.path) }); NX.toast("Screenshot saved.");
        } catch (e) { NX.focus("snip"); NX.toast(e.message); }
        btn.disabled = false; btn.innerHTML = `${NX.icon("camera", 16)}New screenshot`;
      };
    } };
})();
