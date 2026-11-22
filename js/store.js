// Nebulux OS: storage and accounts. Everything is kept in this browser (localStorage), with an in-memory copy so the
// OS still works for the visit if the browser blocks storage. Passwords are never stored: only a salted PBKDF2 hash.
"use strict";
window.NX = window.NX || {};
(function () {
  const PRE = "nxos:", mem = {};
  NX.get = (k, d) => {
    try { const v = localStorage.getItem(PRE + k); if (v != null) return JSON.parse(v); } catch (e) { /* blocked */ }
    if (k in mem) { try { return JSON.parse(mem[k]); } catch (e) { /* bad */ } }
    return d;
  };
  NX.set = (k, v) => { mem[k] = JSON.stringify(v); try { localStorage.setItem(PRE + k, mem[k]); } catch (e) { /* this visit only */ } };
  NX.del = (k) => { delete mem[k]; try { localStorage.removeItem(PRE + k); } catch (e) { /* blocked */ } };
  NX.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  NX.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ---- hashing: WebCrypto PBKDF2, or a small SHA-256 fallback where WebCrypto is missing ----
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  function sha256Fallback(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = new TextEncoder().encode(str), l = bytes.length, n = (((l + 9) >> 6) + 1) << 4, w = new Uint32Array(n);
    for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[n - 1] = l * 8;
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const r = (x, c) => (x >>> c) | (x << (32 - c)), W = new Uint32Array(64);
    for (let i = 0; i < n; i += 16) {
      for (let t = 0; t < 64; t++) W[t] = t < 16 ? w[i + t] : (r(W[t-2],17) ^ r(W[t-2],19) ^ (W[t-2] >>> 10)) + W[t-7] + (r(W[t-15],7) ^ r(W[t-15],18) ^ (W[t-15] >>> 3)) + W[t-16];
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0, t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H = H.map((v, k) => (v + [a, b, c, d, e, f, g, h][k]) >>> 0);
    }
    return H.map((v) => v.toString(16).padStart(8, "0")).join("");
  }
  NX.hash = async (pw, salt) => {
    try {
      if (window.crypto && crypto.subtle) {
        const te = new TextEncoder(), k = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"]);
        return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: te.encode("nxos:" + salt), iterations: 120000, hash: "SHA-256" }, k, 256));
      }
    } catch (e) { /* fall back */ }
    let h = salt + ":" + pw; for (let i = 0; i < 2000; i++) h = sha256Fallback(h + salt); return "f:" + h;
  };
  const rand = (n) => { const b = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256)); return hex(b); };

  // ---- accounts ----
  NX.users = () => NX.get("users", []);
  const saveUsers = (L) => NX.set("users", L);
  NX.nameProblem = (n) => {
    n = String(n || "").trim();
    if (n.length < 2) return "Use at least 2 characters for your name.";
    if (n.length > 24) return "Use 24 characters or fewer.";
    if (!/^[\p{L}\p{N} ._'-]+$/u.test(n)) return "Use letters, numbers, spaces and . _ ' - only.";
    return "";
  };
  NX.addUser = async (name, pw, opts) => {
    opts = opts || {}; name = String(name || "").trim(); const bad = NX.nameProblem(name); if (bad) throw new Error(bad);
    if (!opts.guest && String(pw || "").length < 4) throw new Error("Use at least 4 characters for your password.");
    const L = NX.users(); if (L.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error("There's already an account with that name.");
    if (L.length >= 8) throw new Error("This device already has 8 accounts.");
    const salt = rand(16), u = { id: NX.uid(), name, guest: !!opts.guest, salt, hash: await NX.hash(opts.guest ? rand(16) : pw, salt), color: ["#7c5cff", "#ff4fa3", "#22c3ee", "#f5a524", "#34d399"][L.length % 5], at: Date.now(), fails: 0, lock: 0 };
    L.push(u); saveUsers(L); return u;
  };
  NX.checkPassword = async (id, pw) => {
    const L = NX.users(), u = L.find((x) => x.id === id); if (!u) throw new Error("That account is gone.");
    if (u.guest) return u; // the guest account has no password
    if (u.lock > Date.now()) throw new Error("Too many wrong tries. Wait " + Math.ceil((u.lock - Date.now()) / 1000) + " seconds and try again.");
    const ok = (await NX.hash(pw, u.salt)) === u.hash;
    u.fails = ok ? 0 : (u.fails || 0) + 1; if (u.fails >= 5) { u.fails = 0; u.lock = Date.now() + 30000; }
    saveUsers(L); if (!ok) throw new Error(u.lock > Date.now() ? "Too many wrong tries. Wait 30 seconds and try again." : "The password is incorrect. Try again.");
    return u;
  };
  NX.changePassword = async (id, oldPw, newPw) => {
    await NX.checkPassword(id, oldPw);
    if (String(newPw || "").length < 4) throw new Error("Use at least 4 characters for your new password.");
    const L = NX.users(), u = L.find((x) => x.id === id); u.salt = rand(16); u.hash = await NX.hash(newPw, u.salt); saveUsers(L);
  };
  NX.renameUser = (id, name) => {
    name = String(name || "").trim(); const bad = NX.nameProblem(name); if (bad) throw new Error(bad);
    const L = NX.users(); if (L.some((u) => u.id !== id && u.name.toLowerCase() === name.toLowerCase())) throw new Error("There's already an account with that name.");
    const u = L.find((x) => x.id === id); u.name = name; saveUsers(L);
  };
  NX.removeUser = (id) => { saveUsers(NX.users().filter((u) => u.id !== id)); NX.del("prefs:" + id); NX.del("data:" + id); };

  // ---- per-user preferences and app data ----
  const DEF = { theme: "dark", accent: "#7c5cff", wallpaper: 0, align: "center", clock24: false, brightness: 100, volume: 60, night: false,
    installed: [], pinned: ["files", "settings", "google", "youtube", "store"], desktop: ["files", "settings", "google", "youtube", "store"], recent: [], wifi: true, bt: true, airplane: false, mouse: 6 };
  NX.prefs = () => Object.assign({}, DEF, NX.me ? NX.get("prefs:" + NX.me.id, {}) : {});
  NX.setPref = (k, v) => { if (!NX.me) return; const p = NX.get("prefs:" + NX.me.id, {}); p[k] = v; NX.set("prefs:" + NX.me.id, p); document.dispatchEvent(new CustomEvent("nx:prefs", { detail: k })); };
  NX.data = (k, d) => { const all = NX.me ? NX.get("data:" + NX.me.id, {}) : {}; return k in all ? all[k] : d; };
  NX.setData = (k, v) => { if (!NX.me) return; const all = NX.get("data:" + NX.me.id, {}); all[k] = v; NX.set("data:" + NX.me.id, all); };
  NX.me = null;
})();
