// Nebulux Update: Nebulux OS updates itself, and says what's new after an update.
// It checks for an update after you sign in and every few hours. When there is one, it asks:
//   Update now        installs it right away
//   Remind me later   asks again in 30 minutes
//   Never             skips that update; Settings > Nebulux Update can still install it any time
// Unless it was skipped, an update also installs by itself when the computer isn't being used: the next time the
// computer starts (before anyone signs in), or between 2 and 4 in the morning if it was left on.
// The choice is for the whole computer, not each account. After an update, everyone sees What's new once.
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const HOURS = 3, REMIND = 30 * 60000;
  let info = null, checking = null, remindT = 0, nightT = 0, asked = false;

  async function check() {
    if (!NX.native) return null;
    if (checking) return checking;
    checking = NX.api("GET", "/update").then((u) => { info = u; return u; }).catch((e) => { info = { error: e.message }; return info; }).finally(() => { checking = null; });
    return checking;
  }

  // the overlay while it installs; the screen starts again on the new version by itself
  function installing(v) {
    const o = $("#off"); if (!o) return;
    o.hidden = false; o.innerHTML = `<div class="off-msg upd-installing"><div class="upd-logo big"><span class="upd-ring"></span>${NX.icon("logo", 72)}</div><b>Updating to Nebulux OS ${NX.esc(v || "")}</b><div class="upd-bar"><i></i></div><small>Keep the computer on. It starts again by itself.</small></div>`;
  }
  async function install(onMsg) {
    const v = info && info.latest;
    const say = (t) => onMsg && onMsg(t);
    say("Downloading the update...");
    try { await NX.api("POST", "/update/install"); } catch (e) { say(e.message); throw e; }
    for (let i = 0; i < 600; i++) { // up to 10 minutes
      await new Promise((r) => setTimeout(r, 1000));
      let u; try { u = await NX.api("GET", "/update"); } catch (e) { continue; } // the helper is starting again
      const j = u.job || {};
      if (j.state === "failed") { say(j.msg || "The update didn't install."); throw new Error(j.msg || "The update didn't install."); }
      if (j.state === "installing") { say(j.msg || "Installing..."); continue; }
      if (j.state === "done") {
        NX.set("upd-later", null); NX.set("upd-skip", null); info = u;
        if (j.restart) { installing(j.version || v); setTimeout(() => location.reload(), 30000); return; }
        say("Nebulux OS is up to date."); NX.toast("Nebulux OS is updated."); return;
      }
    }
  }

  // the question: Later, Remind me, Never
  function ask(u) {
    if (asked || $(".upd-pop")) return; asked = true;
    const d = document.createElement("div"); d.className = "upd-pop nx-pop"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Nebulux OS update");
    const notes = (u.notes || []).slice(0, 8), big = /^\d+\.0$/.test(String(u.latest || ""));
    const tick = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    d.innerHTML = `<div class="upd-card">
      <div class="upd-hero"><i class="upd-orb a"></i><i class="upd-orb b"></i><i class="upd-orb c"></i>
        <div class="upd-logo"><span class="upd-ring"></span>${NX.icon("logo", 58)}</div>
        <span class="upd-pill">${NX.esc(u.current || "")}<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${NX.esc(u.latest)}</b></span>
        <h2>Nebulux OS ${NX.esc(u.latest)} is ready</h2>
        <p>${big ? "A big update with a whole new look. " : ""}Updating takes a minute and keeps your files, apps and settings.</p></div>
      <div class="upd-body">
        ${notes.length ? `<h4>What's in it</h4><div class="upd-notes">${notes.map((n, k) => `<div class="upd-n" style="--k:${k}"><i>${tick}</i><span>${NX.esc(n)}</span></div>`).join("")}</div>` : ""}
        ${u.needsIso ? `<p class="nx-pnote">This version also changes the core of Nebulux OS (its kernel and drivers). The update brings the new screens and apps; for everything, download the new Nebulux OS from nebuluxos.thebluedragonstriker.workers.dev and write it to your USB again.</p>` : ""}
        ${NX.persistent === false ? `<p class="nx-pnote">This USB doesn't save changes, so the update lasts until the computer restarts.</p>` : ""}
        <div class="upd-prog" hidden><div class="upd-bar"><i></i></div><small>Getting ready...</small></div>
        <div class="upd-acts"><button class="btn primary upd-go" data-u="now">${NX.icon("download", 16)}Update now</button><div class="upd-more"><button class="btn" data-u="remind">Remind me later</button><button class="btn" data-u="never">Never</button></div></div>
        <small class="upd-foot">Remind me later asks again in 30 minutes. If you don't update, it installs by itself the next time the computer starts. Never skips this update.</small>
      </div></div>`;
    document.body.appendChild(d);
    const close = () => { d.classList.add("out"); setTimeout(() => d.remove(), 220); asked = false; };
    d.querySelectorAll("[data-u]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.u;
      if (k === "now") {
        const pg = d.querySelector(".upd-prog"), msg = pg.querySelector("small"), acts = d.querySelector(".upd-acts");
        acts.hidden = true; d.querySelector(".upd-foot").hidden = true; pg.hidden = false; pg.classList.remove("failed", "done"); msg.textContent = "Getting ready..."; d.classList.add("working");
        try { await install((t) => { msg.textContent = t; }); if (!d.isConnected) return; if (!$("#off") || $("#off").hidden) { pg.classList.add("done"); msg.textContent = "Nebulux OS is up to date."; setTimeout(close, 1500); } }
        catch (e) { d.classList.remove("working"); pg.classList.add("failed"); msg.textContent = e.message || "The update didn't install."; acts.hidden = false; b.lastChild.textContent = "Try again"; }
        return;
      }
      if (k === "remind") { NX.set("upd-remind", Date.now() + REMIND); NX.toast("You'll be reminded in 30 minutes."); clearTimeout(remindT); remindT = setTimeout(consider, REMIND + 500); }
      if (k === "never") { NX.set("upd-skip", u.latest); NX.toast("Skipped. Settings > Nebulux Update can still install it."); }
      d.remove(); asked = false;
    }));
    const f = d.querySelector("[data-u=now]"); if (f) f.focus({ preventScroll: true });
  }

  // left on overnight: installs between 2 and 4 in the morning, when nobody has touched the computer for 20 minutes
  let lastUse = Date.now(); ["pointerdown", "keydown", "pointermove"].forEach((t) => addEventListener(t, () => (lastUse = Date.now()), { capture: true, passive: true }));
  function night() {
    clearInterval(nightT);
    nightT = setInterval(async () => {
      const h = new Date().getHours(); if (h < 2 || h >= 4 || Date.now() - lastUse < 20 * 60000) return;
      const u = await check(); if (!u || !u.available || NX.get("upd-skip", null) === u.latest) return;
      clearInterval(nightT); install().catch(() => night());
    }, 60000);
  }
  // the computer just started: install a waiting update before anyone signs in (shown as the Updating screen)
  async function atStart() {
    const u = await check(); if (!u || !u.available || u.configured === false || NX.get("upd-skip", null) === u.latest || NX.me) return;
    installing(u.latest); install().catch(() => { const o = $("#off"); if (o) { o.hidden = true; o.innerHTML = ""; } });
  }

  // after sign-in and every few hours: is there an update, and what did the person choose before?
  async function consider() {
    if (!NX.me) return;
    const u = await check(); if (!u || !u.available) return;
    if (NX.get("upd-skip", null) === u.latest) return; // Never
    const r = NX.get("upd-remind", 0); if (r > Date.now()) { clearTimeout(remindT); remindT = setTimeout(consider, r - Date.now() + 500); return; }
    NX.toast("A Nebulux OS update is ready: " + u.latest + ".");
    setTimeout(() => NX.me && ask(u), 3500);
  }

  // What's new: once for each person after an update (new accounts start on this version, so they don't see it)
  // a color and a small picture for each What's new item
  const WNC = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#f59e0b", "#60a5fa", "#a78bfa", "#fb7185"], WNI = ["spark", "brush", "apps", "search", "time", "folder", "sun", "bell"];
  const seenKey = (u) => "seen-whatsnew-" + u.id;
  function whatsNew() {
    if (!NX.me || NX.get(seenKey(NX.me), null) === NX.version || $(".wn-pop")) return;
    NX.set(seenKey(NX.me), NX.version);
    const d = document.createElement("div"); d.className = "wn-pop nx-pop"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "What's new");
    // a whole new version (like 4.0) gets a big welcome with buttons to try the main new things
    const big = /^\d+\.0$/.test(NX.version);
    d.innerHTML = `<div class="nx-pcard nx-pwide">${big ? `<div class="wn-hero"><i class="upd-orb a"></i><i class="upd-orb b"></i><i class="upd-orb c"></i><span class="wn-ver">${NX.esc(NX.version)}</span><div><b>A whole new Nebulux OS</b><small>A whole new look with Themes, plus Quick Search, Stage, desktop widgets, Calendar and much more.</small><div class="wn-try"><button class="btn primary" data-w="qs">Try Quick Search</button><button class="btn" data-w="grid">See every app</button><button class="btn" data-w="pers">Desktop extras</button><button class="btn" data-w="themes">Pick a theme</button></div></div></div>` : `<div class="nx-ph">${NX.icon("logo", 40)}<div><b>What's new in Nebulux OS ${NX.esc(NX.version)}</b><small>Everything that was added, in one place.</small></div></div>`}
      <div class="wn-list">${NX.whatsNew.map((w, k) => `<div class="wn-item" style="--k:${Math.min(k, 14)};--c:${WNC[k % WNC.length]}"><i class="wn-ic">${NX.icon(WNI[k % WNI.length], 16)}</i><div><b>${NX.esc(w[0])}</b><span>${NX.esc(w[1])}</span></div></div>`).join("")}</div>
      ${(NX.whatsNewBefore || []).length ? `<details class="wn-before"><summary>Earlier updates</summary><div class="wn-list">${NX.whatsNewBefore.map((w) => `<div class="wn-old"><b>${NX.esc(w[0])}</b><span>${NX.esc(w[1])}</span></div>`).join("")}</div></details>` : ""}
      <div class="nx-pbtns wn-foot"><button class="btn" data-w="more">See it in Settings</button><button class="btn primary" data-w="ok">OK</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("[data-w=ok]").onclick = () => d.remove();
    d.querySelector("[data-w=more]").onclick = () => { d.remove(); NX.open("settings", { page: "update" }); };
    d.querySelectorAll("[data-w=qs],[data-w=grid],[data-w=pers],[data-w=themes]").forEach((b) => (b.onclick = () => { d.remove(); const k = b.dataset.w; if (k === "qs" && NX.quickSearch) NX.quickSearch(); if (k === "grid" && NX.appGrid) NX.appGrid(); if (k === "pers") NX.open("settings", { page: "personal" }); if (k === "themes") { NX.open("settings", { page: "personal" }); setTimeout(() => { const t = document.querySelector(".win[data-app=settings] .s-themes"); if (t) t.scrollIntoView({ block: "start", behavior: "smooth" }); }, 450); } }));
    d.querySelector("[data-w=ok]").focus({ preventScroll: true }); d.querySelector(".nx-pcard").scrollTop = 0;
  }
  const add = NX.addUser;
  NX.addUser = async (...a) => { const u = await add(...a); if (u && u.id) NX.set(seenKey(u), NX.version); return u; };

  // tests skip the automatic check unless they ask for it (?upd)
  let every = 0;
  document.addEventListener("nx:signin", () => {
    const auto = !NX.fast || /[?&]upd(&|=|$)/.test(location.search);
    setTimeout(whatsNew, NX.fast ? 400 : 1600);
    if (!NX.native || !auto) return;
    setTimeout(consider, NX.fast ? 1500 : 8000);
    clearInterval(every); every = setInterval(consider, HOURS * 3600000);
    night();
  });
  // at start-up (the page loads once each time the computer starts)
  if (!NX.fast || /[?&]updstart/.test(location.search)) setTimeout(() => { if (NX.native) atStart(); }, NX.fast ? 600 : 4000);

  // Settings > Nebulux Update
  function fillSettings(q$) {
    const now = q$("#s-updnow"), c = q$("#s-updc"), box = q$("#s-updbox"); if (!now || !c) return;
    if (!NX.native) return;
    const draw = (u) => {
      if (!q$("#s-updnow")) return;
      if (!u || u.error) { now.textContent = (u && u.error) || "Couldn't check for updates."; c.innerHTML = `<button class="btn" id="s-updcheck">Check for updates</button>`; }
      else if (u.configured === false) { now.textContent = "This copy of Nebulux OS doesn't get updates."; c.innerHTML = ""; }
      else if (!u.available) { now.textContent = "You're up to date. Last checked just now."; c.innerHTML = `<button class="btn" id="s-updcheck">Check for updates</button>`; }
      else {
        const sk = NX.get("upd-skip", null) === u.latest;
        now.textContent = "Nebulux OS " + u.latest + " is ready" + (sk ? ". You skipped it." : ". It installs by itself the next time the computer starts.");
        c.innerHTML = `<button class="btn primary" id="s-updgo">Update now</button>`;
        if (box) box.innerHTML = (u.notes || []).length ? `<h3>In ${NX.esc(u.latest)}</h3><div class="s-card">${u.notes.map((n) => `<p class="s-note">${NX.esc(n)}</p>`).join("")}</div>` : "";
      }
      const ch = q$("#s-updcheck"); if (ch) ch.onclick = async () => { ch.disabled = true; now.textContent = "Checking for updates..."; draw(await check()); };
      const go = q$("#s-updgo"); if (go) go.onclick = async () => { go.disabled = true; go.textContent = "Updating..."; try { await install((t) => { if (q$("#s-updnow")) now.textContent = t; }); } catch (e) { go.disabled = false; go.textContent = "Try again"; } };
    };
    check().then(draw);
  }

  NX.update = { check, install, ask, consider, fillSettings, whatsNew, get info() { return info; } };
})();
