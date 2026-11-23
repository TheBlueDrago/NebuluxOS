// The Nebulux OS website (Cloudflare Worker + static files in ../public).
//
// - Maintenance: while MAINTENANCE is "on", everyone sees the "down for maintenance" page with the Nebulux reel,
//   except the owner. The owner opens /__owner/<OWNER_LINK>, then types the owner password: the same admin key as
//   Nebulux Sites (checked by asking the Nebulux Sites Worker), so there's one password for everything.
// - Downloads come from this site: /download/iso sends the newest Nebulux-OS-X.Y.iso from the NebuluxOS repo's
//   Releases. The repo is private, so this needs either the repo public, or a GITHUB_TOKEN secret on this Worker
//   (a read-only token for that repo: npx wrangler secret put GITHUB_TOKEN). Without either, it says so politely.
// - Self-updates: /update.json and /update/nebulux-update.tar.gz serve the newest release's update files, so a
//   Nebulux OS built with NX_UPDATE_URL=https://<this site>/update.json updates from here. They stay up during
//   maintenance, so computers keep updating.
"use strict";

const UA = { "user-agent": "nebuluxos-site", accept: "application/vnd.github+json" };
const SITES_CHECK = "https://nebuluxsites.thebluedragonstriker.workers.dev/api/admin/check";
const COOKIE = "nxos_owner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      const down = await maintenance(request, env, url);
      if (down) return down;
      if (url.pathname === "/api/release") return json(await release(env, ctx).then(publicInfo).catch(() => null) || await fallback(env, request), 200, { "cache-control": "public, max-age=300" });
      if (url.pathname === "/download/iso" || url.pathname === "/download/iso/") return download(env, ctx, request, "iso");
      if (url.pathname === "/update.json") return updateFeed(env, ctx, url);
      if (url.pathname === "/update/nebulux-update.tar.gz") return download(env, ctx, request, "bundle");
      return env.ASSETS.fetch(request);
    } catch (e) {
      return new Response("Something went wrong.", { status: 500 });
    }
  },
};

// ---------- the newest release on GitHub ----------
async function gh(env, path, extra) {
  const h = Object.assign({}, UA, extra || {});
  if (env.GITHUB_TOKEN) h.authorization = "Bearer " + env.GITHUB_TOKEN;
  return fetch("https://api.github.com/repos/" + (env.GH_REPO || "TheBlueDrago/NebuluxOS") + path, { headers: h, redirect: "manual" });
}
async function release(env, ctx) {
  const key = new Request("https://cache.nebuluxos/release");
  const hit = await caches.default.match(key);
  if (hit) return hit.json();
  const r = await gh(env, "/releases/latest");
  // GitHub's API limits how often Cloudflare's shared addresses may ask. Then the newest release is read straight from
  // its files (releases/latest/download/...), which has no such limit, so updates and downloads keep working.
  if (!r.ok) { const rel = await releaseFromFiles(env); ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(rel), { headers: { "cache-control": "max-age=600" } }))); return rel; }
  const j = await r.json();
  const iso = (j.assets || []).find((a) => /^Nebulux-OS-[\d.]+\.iso$/.test(a.name));
  const sum = (j.assets || []).find((a) => /\.iso\.sha256$/.test(a.name));
  const upd = (j.assets || []).find((a) => a.name === "update.json");
  const bundle = (j.assets || []).find((a) => a.name === "nebulux-update.tar.gz");
  if (!iso) throw new Error("No .iso in the newest release");
  let sha = "";
  if (sum) { const t = await assetText(env, sum).catch(() => ""); sha = (t.match(/^[0-9a-f]{64}/i) || [""])[0]; }
  const rel = { version: String(j.tag_name || "").replace(/^v/, ""), iso: pick(iso), sha256: sha, update: upd ? pick(upd) : null, bundle: bundle ? pick(bundle) : null };
  ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(rel), { headers: { "cache-control": "max-age=600" } })));
  return rel;
}
async function releaseFromFiles(env) {
  const base = "https://github.com/" + (env.GH_REPO || "TheBlueDrago/NebuluxOS") + "/releases";
  const u = await fetch(base + "/latest/download/update.json", { headers: UA });
  if (!u.ok) throw new Error("No update.json in the newest release (" + u.status + ")");
  const feed = await u.json(), v = String(feed.version || ""); if (!/^\d+(\.\d+)*$/.test(v)) throw new Error("Bad version");
  const at = (name, size) => ({ id: 0, name, size: size || 0, url: base + "/download/v" + v + "/" + name });
  const isoName = "Nebulux-OS-" + v + ".iso";
  let sha = "", size = 0;
  const s = await fetch(base + "/download/v" + v + "/" + isoName + ".sha256", { headers: UA }).catch(() => null);
  if (s && s.ok) sha = ((await s.text()).match(/^[0-9a-f]{64}/i) || [""])[0];
  const h = await fetch(base + "/download/v" + v + "/" + isoName, { method: "HEAD", headers: UA }).catch(() => null);
  if (h && h.ok) size = +h.headers.get("content-length") || 0;
  return { version: v, iso: at(isoName, size), sha256: sha, update: at("update.json"), bundle: at("nebulux-update.tar.gz", +feed.size || 0) };
}
const pick = (a) => ({ id: a.id, name: a.name, size: a.size, url: a.browser_download_url });
const publicInfo = (rel) => ({ version: rel.version, file: rel.iso.name, size: rel.iso.size, sha256: rel.sha256 });
async function fallback(env, request) {
  const r = await env.ASSETS.fetch(new Request(new URL("/release.json", request.url)));
  return r.ok ? r.json() : {};
}
// where an asset actually downloads from: a short-lived link straight to GitHub's file storage
async function assetLink(env, a) {
  if (!env.GITHUB_TOKEN || !a.id) return a.url; // works when the repo is public
  const r = await gh(env, "/releases/assets/" + a.id, { accept: "application/octet-stream" });
  const loc = r.headers.get("location");
  if (r.status >= 300 && r.status < 400 && loc) return loc;
  throw new Error("GitHub didn't give a download link (" + r.status + ")");
}
async function assetText(env, a) {
  const link = await assetLink(env, a);
  const r = await fetch(link, { headers: { "user-agent": UA["user-agent"] } });
  if (!r.ok) throw new Error("download failed " + r.status);
  return r.text();
}

async function download(env, ctx, request, kind) {
  let rel;
  try { rel = await release(env, ctx); } catch (e) { return notYet(request, env); }
  const a = kind === "iso" ? rel.iso : rel.bundle;
  if (!a) return new Response("Not found", { status: 404 });
  try { return new Response(null, { status: 302, headers: { location: await assetLink(env, a), "cache-control": "no-store" } }); }
  catch (e) { return notYet(request, env); }
}
async function updateFeed(env, ctx, url) {
  try {
    const rel = await release(env, ctx);
    if (!rel.update) return json({ error: "no update in the newest release" }, 404);
    const feed = JSON.parse(await assetText(env, rel.update));
    feed.bundle = url.origin + "/update/nebulux-update.tar.gz"; // the bundle comes from this site too
    return json(feed, 200, { "cache-control": "public, max-age=600" });
  } catch (e) {
    return json({ error: "updates aren't available right now" }, 404);
  }
}
async function notYet(request, env) {
  const r = await env.ASSETS.fetch(new Request(new URL("/download-soon", request.url)));
  return new Response(r.body, { status: 503, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store" } });
}
const json = (o, status, h) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, h || {}) });

// ---------- maintenance and the owner link ----------
async function sha(s) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function same(a, b) { return (await sha("x" + a)) === (await sha("x" + b)); }
const cookieOf = (req, name) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")); return m ? m[1] : ""; };
const tries = new Map(); // owner password tries per address (this copy of the Worker)
function allowTry(ip) {
  const now = Date.now(), t = (tries.get(ip) || []).filter((x) => now - x < 900000);
  if (t.length >= 8) return false;
  t.push(now); tries.set(ip, t); return true;
}
// always reachable, even during maintenance: the update feed (computers keep updating) and what the down page shows
const OPEN = /^\/(update\.json|update\/nebulux-update\.tar\.gz|nebulux-reel\.mp4|img\/nebulux-(64|128|256)\.png)$/;

async function maintenance(request, env, url) {
  if (env.MAINTENANCE !== "on") return null;
  const link = env.OWNER_LINK || "";
  const pass = link ? await sha("nebuluxos-owner:" + link) : "";
  if (pass && cookieOf(request, COOKIE) === pass) return null;
  if (OPEN.test(url.pathname)) return null;
  if (link && url.pathname.indexOf("/__owner/") === 0 && (await same(url.pathname.slice(9).replace(/\/$/, ""), link))) {
    if (request.method !== "POST") return ownerPage("");
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (!allowTry(ip)) return ownerPage("Too many tries. Wait 15 minutes.");
    const form = await request.formData().catch(() => null);
    const pw = form ? String(form.get("pw") || "") : "";
    if (!pw) return ownerPage("Type your owner password.");
    const q = new Request(SITES_CHECK, { headers: { "x-admin-key": pw } });
    const r = await (env.SITES ? env.SITES.fetch(q) : fetch(q)).catch(() => null);
    if (!r || !r.ok) return ownerPage("That password isn't right.");
    return new Response(null, { status: 302, headers: { location: "/", "cache-control": "no-store", "set-cookie": COOKIE + "=" + pass + "; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax" } });
  }
  return new Response(downPage(), { status: 503, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "retry-after": "86400", "x-robots-tag": "noindex" } });
}

const STYLE = `*{box-sizing:border-box}body{background:#05030c;color:#ede9fe;font-family:"Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;overflow-x:hidden;position:relative}body:before{content:"";position:fixed;inset:-20%;background:radial-gradient(40% 35% at 25% 20%,rgba(124,92,255,.38),transparent 70%),radial-gradient(35% 30% at 80% 25%,rgba(192,79,240,.26),transparent 70%),radial-gradient(45% 35% at 50% 100%,rgba(34,195,238,.12),transparent 70%);animation:drift 18s ease-in-out infinite alternate;z-index:-2}body:after{content:"";position:fixed;inset:0;z-index:-1;opacity:.7;background-image:radial-gradient(1px 1px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 70%,#ddd6fe,transparent),radial-gradient(1.5px 1.5px at 55% 15%,#fff,transparent),radial-gradient(1px 1px at 75% 60%,#fff,transparent),radial-gradient(1px 1px at 90% 30%,#c4b5fd,transparent),radial-gradient(1.5px 1.5px at 20% 90%,#fff,transparent),radial-gradient(1px 1px at 65% 85%,#e9d5ff,transparent),radial-gradient(1px 1px at 45% 45%,#fff,transparent);background-size:340px 340px;animation:tw 4s ease-in-out infinite alternate}@keyframes drift{to{transform:translate(3%,2%) scale(1.06)}}@keyframes tw{to{opacity:.35}}.box{position:relative;max-width:520px;width:100%;padding:40px 30px 36px;border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 40px 120px -40px rgba(0,0,0,.9)}.brand{display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:#c4b5fd;margin-bottom:12px}.brand img{width:26px;height:26px;border-radius:50%}h1{font-size:26px;font-weight:800;line-height:1.3;margin:0;letter-spacing:-.01em;background:linear-gradient(90deg,#fff,#e9d5ff 60%,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent}p{color:#b9b2df;max-width:420px;margin:14px auto 0;line-height:1.55}.reel{position:relative;width:min(300px,70vw);aspect-ratio:9/16;margin:0 auto 22px;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(168,85,247,.6);border:1px solid rgba(255,255,255,.12);background:#000}.reel video{width:100%;height:100%;object-fit:cover;display:block}.snd{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);border:0;border-radius:999px;padding:10px 16px;font:700 14px "Segoe UI",Inter,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);cursor:pointer;white-space:nowrap}form{margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center}input{font:inherit;font-size:16px;padding:13px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(5,4,15,.6);color:#ede9fe;min-width:230px;flex:1;outline:none}input:focus{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.2)}button.go{font:inherit;font-size:16px;padding:13px 22px;border-radius:14px;border:0;background:linear-gradient(135deg,#7c5cff,#c04ff0);color:#fff;font-weight:700;cursor:pointer}.err{color:#fca5a5}@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
const head = (t) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#05030c"><title>${t}</title><link rel="icon" href="/img/nebulux-64.png"><style>${STYLE}</style></head>`;
const REEL = `<div class="reel"><video id="reel" src="/nebulux-reel.mp4" autoplay loop playsinline preload="auto"></video><button type="button" id="snd" class="snd" hidden>Tap for sound</button></div><script>(function(){var v=document.getElementById("reel"),b=document.getElementById("snd");if(!v)return;function on(){v.muted=false;v.play();b.hidden=true;}v.muted=false;var p=v.play();if(p&&p.catch)p.catch(function(){v.muted=true;v.play();b.hidden=false;document.addEventListener("pointerdown",on,{once:true});});b.onclick=on;})();</script>`;
function downPage() {
  return head("Nebulux OS") + `<body><div class="box">${REEL}<div class="brand"><img src="/img/nebulux-64.png" alt="">Nebulux OS</div><h1>Nebulux OS is down for maintenance right now. Come back soon!</h1><p>Already using Nebulux OS? Nothing changes for you: it keeps working and keeps updating itself.</p></div></body></html>`;
}
function ownerPage(err) {
  return new Response(head("Owner sign-in: Nebulux OS") + `<body><div class="box"><div class="brand"><img src="/img/nebulux-64.png" alt="">Nebulux OS</div><h1>Owner sign-in</h1><p>Type your owner password to open the Nebulux OS website.</p><form method="post"><input type="password" name="pw" required autofocus placeholder="Owner password" aria-label="Owner password" autocomplete="current-password"><button class="go" type="submit">Enter</button></form>${err ? `<p class="err">${err}</p>` : ""}</div></body></html>`,
    { status: err ? 403 : 200, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
