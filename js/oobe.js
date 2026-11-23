// First-time setup, like Windows 11's: region, keyboard, network (on the real computer), your name, a password,
// privacy, your look, then "Hi" while things get ready. It runs once, for the first account on this computer.
// NX.oobe(done) shows it; done(user) is called with the new, signed-in account.
"use strict";
(function () {
  const REGIONS = [["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"], ["IN", "India"], ["IE", "Ireland"], ["NZ", "New Zealand"], ["ZA", "South Africa"], ["NG", "Nigeria"], ["PH", "Philippines"], ["SG", "Singapore"], ["PK", "Pakistan"], ["BD", "Bangladesh"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"], ["CH", "Switzerland"], ["AT", "Austria"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["PL", "Poland"], ["PT", "Portugal"], ["GR", "Greece"], ["TR", "Turkey"], ["MX", "Mexico"], ["BR", "Brazil"], ["AR", "Argentina"], ["CO", "Colombia"], ["CL", "Chile"], ["PE", "Peru"], ["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"], ["TW", "Taiwan"], ["HK", "Hong Kong"], ["ID", "Indonesia"], ["MY", "Malaysia"], ["TH", "Thailand"], ["VN", "Vietnam"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["EG", "Egypt"], ["KE", "Kenya"], ["IL", "Israel"], ["UA", "Ukraine"]];
  const KEYBOARDS = [["us", "US"], ["gb", "United Kingdom"], ["us-intl", "US International"], ["ca", "Canadian French"], ["de", "German"], ["fr", "French"], ["es", "Spanish"], ["latam", "Latin American"], ["it", "Italian"], ["pt", "Portuguese"], ["br", "Portuguese (Brazil)"], ["se", "Swedish"], ["no", "Norwegian"], ["dk", "Danish"], ["fi", "Finnish"], ["nl", "Dutch"], ["pl", "Polish"], ["tr", "Turkish"], ["ru", "Russian"], ["ua", "Ukrainian"], ["jp", "Japanese"], ["kr", "Korean"], ["in", "Hindi"], ["ara", "Arabic"]];
  NX.keyboards = KEYBOARDS; // Settings > Time & language uses the same list
  const ACCENTS = ["#7c5cff", "#ff4fa3", "#22c3ee", "#34d399", "#f5a524", "#3b82f6"];
  const guessRegion = () => { const m = /-([A-Z]{2})\b/.exec(navigator.language || ""); const r = m && m[1]; return REGIONS.some((x) => x[0] === r) ? r : "US"; };
  const guessKeyboard = (r) => ({ GB: "gb", IE: "gb", DE: "de", AT: "de", CH: "de", FR: "fr", BE: "fr", ES: "es", MX: "latam", AR: "latam", CO: "latam", CL: "latam", PE: "latam", IT: "it", PT: "pt", BR: "br", SE: "se", NO: "no", DK: "dk", FI: "fi", NL: "nl", PL: "pl", TR: "tr", UA: "ua", JP: "jp", KR: "kr" }[r] || "us");

  NX.oobe = (done, setupOpts) => {
    setupOpts = setupOpts || {}; const first = !NX.users().length;
    const box = document.getElementById("oobe"); box.hidden = false;
    const st = { region: guessRegion(), kb: null, name: "", pass: "", location: true, tips: true, theme: "dark", accent: ACCENTS[0], wall: 0 };
    st.kb = guessKeyboard(st.region);
    const steps = ["name", "password", "region", "keyboard", ...(NX.native ? (first ? ["network", "google"] : ["google"]) : []), "privacy", "look"];
    let i = 0, back = false;
    const art = (k) => ({ region: "globe", keyboard: "kbd", network: "wifi", google: "google", name: "user", password: "lock", privacy: "shield", look: "brush" }[k]);
    function frame(title, sub, inner, opts) {
      opts = opts || {};
      box.innerHTML = `<div class="ob-card"><aside class="ob-art"><div class="ob-art-ic">${NX.icon(art(steps[i]) === "kbd" ? "keyboard" : art(steps[i]) === "shield" ? "shield" : art(steps[i]), 96)}</div><div class="ob-dots">${steps.map((_, k) => `<i class="${k === i ? "on" : k < i ? "done" : ""}"></i>`).join("")}</div></aside>
        <form class="ob-main" autocomplete="off"><h1>${title}</h1>${sub ? `<p class="ob-sub">${sub}</p>` : ""}<div class="ob-body">${inner}</div><p class="ob-err" role="alert"></p>
        <div class="ob-foot">${i > 0 ? `<button type="button" class="btn ob-back">Back</button>` : setupOpts.cancel ? `<button type="button" class="btn ob-cancel">Cancel</button>` : "<span></span>"}<span class="ob-sp"></span>${opts.skip ? `<button type="button" class="btn ob-skip">${opts.skip}</button>` : ""}<button type="submit" class="btn primary ob-next">${opts.next || "Next"}</button></div></form></div>`;
      const f = box.querySelector("form");
      const b = box.querySelector(".ob-back"); if (b) b.onclick = () => { i--; back = true; draw(); };
      const c = box.querySelector(".ob-cancel"); if (c) c.onclick = () => { box.hidden = true; box.innerHTML = ""; setupOpts.cancel(); };
      return f;
    }
    const err = (m) => { box.querySelector(".ob-err").textContent = m; };
    // a list you pick from, with a search box (region and keyboard)
    function pickList(items, cur, onPick) {
      return `<label class="ob-find">${NX.icon("search", 16)}<input placeholder="Search" aria-label="Search the list"></label><div class="ob-list" role="listbox">${items.map(([k, n]) => `<button type="button" role="option" class="ob-opt ${k === cur ? "on" : ""}" data-k="${k}">${NX.esc(n)}</button>`).join("")}</div>`;
    }
    function wireList(key) {
      const list = box.querySelector(".ob-list"), find = box.querySelector(".ob-find input");
      list.querySelectorAll(".ob-opt").forEach((o) => (o.onclick = () => { st[key] = o.dataset.k; list.querySelectorAll(".ob-opt").forEach((x) => x.classList.toggle("on", x === o)); }));
      find.oninput = () => { const q = find.value.trim().toLowerCase(); list.querySelectorAll(".ob-opt").forEach((o) => (o.hidden = !!q && !o.textContent.toLowerCase().includes(q))); };
      const on = list.querySelector(".on"); if (on) setTimeout(() => on.scrollIntoView({ block: "center" }), 0);
    }
    const next = () => { i++; back = false; draw(); };
    function draw() {
      const k = steps[i];
      if (k === "region") {
        const f = frame("Is this the right country or region?", "", pickList(REGIONS, st.region), { next: "Yes" }); wireList("region");
        f.onsubmit = (e) => { e.preventDefault(); st.kb = guessKeyboard(st.region); next(); };
      }
      if (k === "keyboard") {
        const f = frame("Is this the right keyboard layout?", "Pick the one that matches the letters on your keys.", pickList(KEYBOARDS, st.kb), { next: "Yes" }); wireList("kb");
        f.onsubmit = (e) => { e.preventDefault(); next(); };
      }
      if (k === "network") {
        const online = NX.online();
        const f = frame("Let's connect you to a network", online ? "You're already connected to the internet." : "You'll need an internet connection for Google, the weather and web apps.", online ? `<div class="ob-ok">${NX.icon("wifi", 28)}<b>Connected</b></div>` : `<div class="ob-nets"><p class="ob-sub">Looking for networks...</p></div>`, { skip: online ? null : "I don't have internet", next: "Next" });
        f.onsubmit = (e) => { e.preventDefault(); next(); };
        const sk = box.querySelector(".ob-skip"); if (sk) sk.onclick = next;
        if (!online) obNets();
      }
      if (k === "google") {
        // sign in to Google in the real web browser, so Gmail, YouTube and Drive are ready (only when there is one)
        if (!NX.browserOK || !NX.online()) { (back ? i-- : i++); back = false; return draw(); }
        const f = frame("Sign in with Google", "Sign in to your Google account to use Gmail, YouTube, Drive and more in the web browser. Your Nebulux OS password stays separate.",
          `<button type="button" class="ob-google">${NX.icon("google", 22)}<span>Sign in with Google</span></button><p class="ob-sub ob-gnote" hidden>The Google sign-in opens in the web browser. When you're done, minimize or close it to come back here.</p>`, { skip: "Skip for now", next: "Next" });
        f.querySelector(".ob-google").onclick = () => { f.querySelector(".ob-gnote").hidden = false; NX.browserOpen("https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmail.google.com%2F"); };
        f.onsubmit = (e) => { e.preventDefault(); next(); };
        box.querySelector(".ob-skip").onclick = next;
      }
      if (k === "name" && first && NX.native && NX.persistent === false && !back) {
        // this USB doesn't keep changes, so setup would come back at every start: offer a quick guest start too
        if (!box.dataset.guestOffered) {
          box.dataset.guestOffered = "1";
          const f = frame("This USB doesn't save changes", "Your account, files and settings won't be kept after you turn the computer off, so you can skip setup and start right away. To keep things, write the USB again with Rufus and set Persistent partition size to about 4 GB.",
            `<div class="ob-guest"><button type="button" class="btn primary ob-guestgo">Start without setting up</button><button type="button" class="btn ob-guestset">Set up an account anyway</button></div>`, { next: "Set up" });
          f.querySelector(".ob-guestgo").onclick = async () => { try { const u = await NX.addUser("Guest", "", { guest: true }); box.hidden = true; box.innerHTML = ""; done(u); } catch (e) { err(e.message); } };
          f.querySelector(".ob-guestset").onclick = () => draw();
          f.onsubmit = (e) => { e.preventDefault(); draw(); };
          return;
        }
      }
      if (k === "name") {
        const f = frame(first ? "Who's going to use this computer?" : "Add an account", first ? "Let's make your account. What name do you want to use?" : "What name should the new account use?", `<input class="ob-in" name="n" maxlength="24" placeholder="Name" aria-label="Name" value="${NX.esc(st.name)}" autocomplete="off">`);
        const n = f.querySelector("[name=n]"); setTimeout(() => n.focus(), 30);
        f.onsubmit = (e) => { e.preventDefault(); const bad = NX.nameProblem(n.value.trim()); if (bad) { err(bad); n.focus(); return; } if (NX.users().some((u) => u.name.toLowerCase() === n.value.trim().toLowerCase())) { err("There's already an account with that name."); return; } st.name = n.value.trim(); next(); };
      }
      if (k === "password") {
        const f = frame("Create a password you'll remember", "Make sure to pick something you'll remember. It stays on this computer and can't be recovered if you forget it.", `<input class="ob-in" name="p" type="password" maxlength="64" placeholder="Password" aria-label="Password" autocomplete="new-password"><input class="ob-in" name="p2" type="password" maxlength="64" placeholder="Confirm your password" aria-label="Confirm your password" autocomplete="new-password">`);
        const p1 = f.querySelector("[name=p]"), p2 = f.querySelector("[name=p2]"); setTimeout(() => p1.focus(), 30);
        f.onsubmit = (e) => { e.preventDefault(); if (p1.value.length < 4) { err("Passwords need at least 4 characters."); p1.focus(); return; } if (p1.value !== p2.value) { err("The two passwords don't match."); p2.value = ""; p2.focus(); return; } st.pass = p1.value; next(); };
      }
      if (k === "privacy") {
        const t = (key, title, text) => `<label class="ob-priv"><span><b>${title}</b><small>${text}</small></span><span class="tg"><input type="checkbox" data-k="${key}" ${st[key] ? "checked" : ""}><i></i></span></label>`;
        const f = frame("Choose privacy settings for your computer", "Nebulux OS keeps your files, accounts and passwords on this computer. It doesn't send anything about you to Nebulux.",
          t("location", "Weather where you are", "Widgets shows the weather for the city you type. Only the city name goes to the weather service.") + t("tips", "Tips", "Show tips and shortcuts in Widgets and notifications."), { next: "Accept" });
        f.querySelectorAll("[data-k]").forEach((c) => (c.onchange = () => (st[c.dataset.k] = c.checked)));
        f.onsubmit = (e) => { e.preventDefault(); next(); };
      }
      if (k === "look") {
        const f = frame("Let's make it yours", "Pick a mode, a color and a background. You can change them any time in Settings.",
          `<div class="ob-modes"><button type="button" class="ob-mode ${st.theme === "dark" ? "on" : ""}" data-theme="dark"><span class="ob-pv dark"></span>Dark</button><button type="button" class="ob-mode ${st.theme === "light" ? "on" : ""}" data-theme="light"><span class="ob-pv light"></span>Light</button></div>
           <div class="ob-accs">${ACCENTS.map((c) => `<button type="button" class="${c === st.accent ? "on" : ""}" data-acc="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div>
           <div class="ob-walls">${NX.wallpapers.slice(0, 4).map((w, k2) => `<button type="button" class="${k2 === st.wall ? "on" : ""}" data-wall="${k2}" title="${w.name}" aria-label="${w.name}"><img src="${NX.wallpaperURL(k2, 160, 90)}" alt=""></button>`).join("")}</div>`, { next: "Done" });
        const sel = (attr, key, val) => f.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { st[key] = val(b); f.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle("on", x === b)); }));
        sel("data-theme", "theme", (b) => b.dataset.theme); sel("data-acc", "accent", (b) => b.dataset.acc); sel("data-wall", "wall", (b) => +b.dataset.wall);
        f.onsubmit = (e) => { e.preventDefault(); finish(); };
      }
      const focusEl = box.querySelector(".ob-in") || box.querySelector(".ob-next"); if (focusEl && !box.querySelector(".ob-in")) setTimeout(() => focusEl.focus(), 30);
    }
    let obTries = 0;
    async function obNets() {
      const host = box.querySelector(".ob-nets"); if (!host) return; let w;
      try { w = await NX.api("GET", "/wifi"); } catch (e) { host.innerHTML = `<p class="ob-sub">${NX.esc(e.message)}</p>`; return; }
      if (!box.querySelector(".ob-nets")) return;
      // Wi-Fi isn't working: say why (the chip by name), and fix it right here
      const fixer = (text, btn) => {
        host.innerHTML = `<p class="ob-sub">${NX.esc(text)}</p><div class="ob-fixw"><button type="button" class="btn primary ob-fix">${btn}</button></div><p class="ob-sub ob-fixmsg"></p>`;
        const b = host.querySelector(".ob-fix"), m = host.querySelector(".ob-fixmsg");
        b.onclick = async () => {
          b.disabled = true; m.textContent = btn === "Turn on Wi-Fi" ? "Turning on Wi-Fi..." : "Trying to fix Wi-Fi. This takes up to half a minute...";
          try { if (btn === "Turn on Wi-Fi") await NX.api("POST", "/wifi/radio", { on: true }); else { const d = await NX.api("POST", "/net/diagnose", { fix: true }); if (!d.ok) m.textContent = d.summary; } } catch (e) { m.textContent = e.message; }
          obTries = 0; setTimeout(obNets, 1500);
        };
      };
      if (!w.device) { fixer((w.error || "This computer has no Wi-Fi that Nebulux OS can use.") + " A network cable works too, or press \"I don't have internet\".", "Try to fix"); return; }
      if (!w.on) { fixer(w.error || "Wi-Fi is off.", w.error ? "Try to fix" : "Turn on Wi-Fi"); return; }
      if (!(w.networks || []).length) {
        if (obTries++ < 5) { host.innerHTML = `<p class="ob-sub">Looking for networks...</p>`; setTimeout(obNets, 3000); return; }
        fixer("No Wi-Fi networks were found nearby.", "Try to fix"); return;
      }
      host.innerHTML = (w.networks || []).slice(0, 8).map((n, k) => `<div class="ob-net" data-n="${k}"><span>${NX.icon("wifi", 20)}<b>${NX.esc(n.ssid)}</b><small>${n.active ? "Connected" : n.secure ? "Secured" : "Open"}</small></span><button type="button" class="btn" data-c="${k}">${n.active ? "Connected" : "Connect"}</button></div>`).join("") || `<p class="ob-sub">No networks found yet.</p>`;
      host.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
        const n = w.networks[+b.dataset.c], row = b.closest(".ob-net"); if (n.active) return;
        const go = async (pw) => { const u = row.querySelector(".ob-user"); b.disabled = true; b.textContent = "Connecting..."; try { await NX.api("POST", "/wifi/connect", u ? { ssid: n.ssid, username: u.value.trim(), password: pw } : { ssid: n.ssid, password: pw }); b.textContent = "Connected"; err(""); } catch (e) { b.disabled = false; b.textContent = "Connect"; err(e.message); } };
        if (!n.secure) return go("");
        if (row.querySelector("input")) return;
        // school and work networks: a username as well as the password
        row.insertAdjacentHTML("beforeend", (n.enterprise ? `<input class="ob-in ob-user" placeholder="Username" aria-label="Username for ${NX.esc(n.ssid)}" autocomplete="username">` : "") + `<input type="password" class="ob-in" placeholder="${n.enterprise ? "Password" : "Network password"}" aria-label="Password for ${NX.esc(n.ssid)}">`);
        const pi = row.querySelector("input[type=password]"); (row.querySelector(".ob-user") || pi).focus(); pi.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); go(pi.value); } };
        b.onclick = () => go(pi.value);
      }));
    }
    // the end: make the account, apply the choices, and say hi while things get ready
    async function finish() {
      let u;
      try { u = await NX.addUser(st.name, st.pass); } catch (e) { i = steps.indexOf("name"); draw(); err(e.message); return; }
      NX.me = u;
      NX.setPref("theme", st.theme); NX.setPref("accent", st.accent); NX.setPref("wallpaper", st.wall); NX.setPref("region", st.region); NX.setPref("keyboard", st.kb); NX.setPref("tips", st.tips); NX.setPref("location", st.location);
      NX.me = null;
      const say = [["Hi", 1400], ["This might take a few minutes", 1700], ["Getting things ready", 1500], ["Don't turn off your computer", 1300]];
      const fast = NX.fast;
      box.innerHTML = `<div class="ob-hi"><h1></h1><span class="spin"></span></div>`; box.classList.add("hi");
      const h = box.querySelector("h1");
      for (const [t, ms] of say) { h.classList.remove("in"); h.textContent = t; void h.offsetWidth; h.classList.add("in"); await new Promise((ok) => setTimeout(ok, fast ? 60 : ms)); }
      box.classList.remove("hi"); box.hidden = true; box.innerHTML = "";
      done(u);
    }
    draw();
  };
})();
