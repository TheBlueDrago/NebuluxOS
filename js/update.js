// Nebulux Update: Nebulux OS updates itself, and says what's new after an update.
// It checks for an update after you sign in and every few hours. When there is one, it reminds you, then asks:
//   Later      installs it tonight (between 2 and 4 in the morning, if the computer is on)
//   Remind me  asks again in 30 minutes
//   Never      skips that update; Settings > Nebulux Update can still install it any time
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
    o.hidden = false; o.innerHTML = `<div class="off-msg">${NX.icon("logo", 56)}<span class="spin"></span><b>Updating to Nebulux OS ${NX.esc(v)}</b><small>Keep the computer on. It starts again by itself.</small></div>`;
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
    const notes = (u.notes || []).slice(0, 8);
    d.innerHTML = `<div class="nx-pcard"><div class="nx-ph">${NX.icon("logo", 40)}<div><b>Nebulux OS ${NX.esc(u.latest)} is ready</b><small>You're on ${NX.esc(u.current)}. Updating takes a minute and keeps your files and settings.</small></div></div>
      ${notes.length ? `<ul class="nx-plist">${notes.map((n) => `<li>${NX.esc(n)}</li>`).join("")}</ul>` : ""}
      ${u.needsIso ? `<p class="nx-pnote">This version also changes the core of Nebulux OS (its kernel and drivers). The update brings the new screens and apps; for everything, download the new Nebulux OS from nebuluxos.thebluedragonstriker.workers.dev and write it to your USB.</p>` : ""}
      ${NX.persistent === false ? `<p class="nx-pnote">This USB doesn't save changes, so the update lasts until the computer restarts.</p>` : ""}
      <div class="nx-pbtns"><button class="btn" data-u="never">Never</button><button class="btn" data-u="remind">Remind me</button><button class="btn primary" data-u="later">Later</button></div>
      <small class="nx-pfoot">Later installs it tonight. Remind me asks again in 30 minutes. Never skips it, until you update from Settings.</small></div>`;
    document.body.appendChild(d);
    const close = () => { d.remove(); asked = false; };
    d.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.u;
      if (k === "later") { NX.set("upd-later", u.latest); NX.toast("Nebulux OS " + u.latest + " installs tonight."); night(); }
      if (k === "remind") { NX.set("upd-remind", Date.now() + REMIND); NX.toast("You'll be reminded in 30 minutes."); clearTimeout(remindT); remindT = setTimeout(consider, REMIND + 500); }
      if (k === "never") { NX.set("upd-skip", u.latest); NX.toast("Skipped. Settings > Nebulux Update can still install it."); }
      close();
    }));
    const f = d.querySelector("[data-u=later]"); if (f) f.focus({ preventScroll: true });
  }

  // tonight: installs between 2 and 4 in the morning
  function night() {
    clearInterval(nightT);
    nightT = setInterval(async () => {
      const later = NX.get("upd-later", null); if (!later) { clearInterval(nightT); return; }
      const h = new Date().getHours(); if (h < 2 || h >= 4) return;
      clearInterval(nightT);
      const u = await check(); if (!u || !u.available || u.latest !== later) { NX.set("upd-later", null); return; }
      install().catch(() => night());
    }, 60000);
  }

  // after sign-in and every few hours: is there an update, and what did the person choose before?
  async function consider() {
    if (!NX.me) return;
    const u = await check(); if (!u || !u.available) return;
    if (NX.get("upd-skip", null) === u.latest) return; // Never
    if (NX.get("upd-later", null) === u.latest) { night(); return; } // Later: tonight
    const r = NX.get("upd-remind", 0); if (r > Date.now()) { clearTimeout(remindT); remindT = setTimeout(consider, r - Date.now() + 500); return; }
    NX.toast("A Nebulux OS update is ready: " + u.latest + ".");
    setTimeout(() => NX.me && ask(u), 3500);
  }

  // What's new: once for each person after an update (new accounts start on this version, so they don't see it)
  const seenKey = (u) => "seen-whatsnew-" + u.id;
  function whatsNew() {
    if (!NX.me || NX.get(seenKey(NX.me), null) === NX.version || $(".wn-pop")) return;
    NX.set(seenKey(NX.me), NX.version);
    const d = document.createElement("div"); d.className = "wn-pop nx-pop"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "What's new");
    // a whole new version (like 4.0) gets a big welcome with buttons to try the main new things
    const big = /^\d+\.0$/.test(NX.version);
    d.innerHTML = `<div class="nx-pcard nx-pwide">${big ? `<div class="wn-hero"><span class="wn-ver">${NX.esc(NX.version)}</span><div><b>A whole new Nebulux OS</b><small>Quick Search, Stage, desktop widgets, Calendar, hot corners and much more.</small><div class="wn-try"><button class="btn primary" data-w="qs">Try Quick Search</button><button class="btn" data-w="grid">See every app</button><button class="btn" data-w="pers">Desktop extras</button></div></div></div>` : `<div class="nx-ph">${NX.icon("logo", 40)}<div><b>What's new in Nebulux OS ${NX.esc(NX.version)}</b><small>Everything that was added, in one place.</small></div></div>`}
      <div class="wn-list">${NX.whatsNew.map((w) => `<div class="wn-item"><b>${NX.esc(w[0])}</b><span>${NX.esc(w[1])}</span></div>`).join("")}</div>
      ${(NX.whatsNewBefore || []).length ? `<details class="wn-before"><summary>Earlier updates</summary><div class="wn-list">${NX.whatsNewBefore.map((w) => `<div class="wn-old"><b>${NX.esc(w[0])}</b><span>${NX.esc(w[1])}</span></div>`).join("")}</div></details>` : ""}
      <div class="nx-pbtns"><button class="btn" data-w="more">See it in Settings</button><button class="btn primary" data-w="ok">OK</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("[data-w=ok]").onclick = () => d.remove();
    d.querySelector("[data-w=more]").onclick = () => { d.remove(); NX.open("settings", { page: "update" }); };
    d.querySelectorAll("[data-w=qs],[data-w=grid],[data-w=pers]").forEach((b) => (b.onclick = () => { d.remove(); const k = b.dataset.w; if (k === "qs" && NX.quickSearch) NX.quickSearch(); if (k === "grid" && NX.appGrid) NX.appGrid(); if (k === "pers") NX.open("settings", { page: "personal" }); }));
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
    if (NX.get("upd-later", null)) night();
  });

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
        const sk = NX.get("upd-skip", null) === u.latest, lt = NX.get("upd-later", null) === u.latest;
        now.textContent = "Nebulux OS " + u.latest + " is ready" + (lt ? ". It installs tonight." : sk ? ". You skipped it." : ".");
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
