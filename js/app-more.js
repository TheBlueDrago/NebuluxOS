// Nebulux OS 3.3 apps: Camera, Weather and Voice Recorder, the keyboard shortcut guide (Nebulux + /), and a new
// background every day (Settings > Personalization).
"use strict";
(function () {
  const A = NX.apps, $ = (s, r) => (r || document).querySelector(s);
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`; };
  const save = async (folder, name, blob) => { const r = await NX.fs.upload(await NX.folder(folder), name, blob); NX.filesChanged && NX.filesChanged(); return r; };
  const camErr = (e, what) => e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? `Nebulux OS isn't allowed to use the ${what}. Allow it when you're asked, then try again.` : e && (e.name === "NotFoundError" || e.name === "OverconstrainedError") ? `No ${what} was found. Plug one in, then try again.` : e && e.name === "NotReadableError" ? `The ${what} is being used by another app. Close it, then try again.` : `The ${what} couldn't start.`;
  const recType = (kind) => ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].filter((t) => t.startsWith(kind)).find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";

  // ---------- Camera: photos and videos from the computer's camera, saved in Pictures > Camera and Videos ----------
  A.camera = { name: "Camera", icon: "camapp", builtIn: true, category: "Photo & video", w: 860, h: 600, minW: 360, minH: 360, desc: "Take photos and videos with your computer's camera.",
    open(body, win) {
      body.classList.add("cam");
      body.innerHTML = `<div class="cam-view"><video playsinline muted></video><div class="cam-msg" hidden></div><div class="cam-count" hidden></div><div class="cam-flash"></div><div class="cam-rec" hidden><i></i><span>0:00</span></div></div>
        <div class="cam-bar"><div class="cam-modes" role="radiogroup" aria-label="Photo or video"><button class="on" data-mode="photo" role="radio" aria-checked="true">Photo</button><button data-mode="video" role="radio" aria-checked="false">Video</button></div>
        <button class="cam-shoot" aria-label="Take a photo"><i></i></button>
        <div class="cam-side"><button class="cam-timer" title="Self-timer" aria-label="Self-timer: off">${NX.icon("time", 18)}<span>Off</span></button><button class="cam-last" aria-label="See your photos" hidden><img alt=""></button></div></div>`;
      const v = $("video", body), msg = $(".cam-msg", body), shoot = $(".cam-shoot", body), count = $(".cam-count", body), recBox = $(".cam-rec", body);
      let stream = null, mode = "photo", timer = 0, rec = null, chunks = [], recT0 = 0, tick = 0, busy = false;
      const show = (t) => { msg.hidden = !t; msg.textContent = t || ""; };
      const start = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { show("This computer can't use a camera here."); return; }
        show("Starting the camera...");
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); v.srcObject = stream; await v.play().catch(() => {}); show(""); }
        catch (e) { show(camErr(e, "camera")); }
      };
      const stop = () => { if (rec && rec.state !== "inactive") rec.stop(); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; clearInterval(tick); };
      win.onclose = stop;
      const countdown = (n) => new Promise((done) => { if (!n) return done(); count.hidden = false; let k = n; count.textContent = k; const t = setInterval(() => { k--; if (k <= 0) { clearInterval(t); count.hidden = true; done(); } else count.textContent = k; }, 1000); });
      const photo = async () => {
        if (!stream || !v.videoWidth || busy) return; busy = true;
        await countdown(timer);
        const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        body.querySelector(".cam-flash").classList.remove("go"); void body.offsetWidth; body.querySelector(".cam-flash").classList.add("go");
        c.toBlob(async (blob) => {
          try { const r = await save("Pictures", "Photo " + stamp() + ".jpg", blob); const last = $(".cam-last", body); $("img", last).src = URL.createObjectURL(blob); last.hidden = false; NX.toast("Saved in Pictures as " + r.name + "."); }
          catch (e) { NX.toast(e.message || "The photo couldn't be saved."); } finally { busy = false; }
        }, "image/jpeg", .92);
      };
      const video = async () => {
        if (!stream) return;
        if (rec && rec.state === "recording") { rec.stop(); return; }
        let s = stream; try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); s = new MediaStream([...stream.getVideoTracks(), ...mic.getAudioTracks()]); } catch (e) { /* video without sound */ }
        await countdown(timer);
        chunks = []; rec = new MediaRecorder(s, recType("video") ? { mimeType: recType("video") } : undefined);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          s.getAudioTracks().forEach((t) => t.stop()); clearInterval(tick); recBox.hidden = true; shoot.classList.remove("recording"); shoot.setAttribute("aria-label", "Start recording");
          try { const r = await save("Videos", "Video " + stamp() + ".webm", new Blob(chunks, { type: "video/webm" })); NX.toast("Saved in Videos as " + r.name + "."); } catch (e) { NX.toast(e.message || "The video couldn't be saved."); }
        };
        rec.start(1000); recT0 = Date.now(); recBox.hidden = false; shoot.classList.add("recording"); shoot.setAttribute("aria-label", "Stop recording");
        tick = setInterval(() => { const s2 = Math.floor((Date.now() - recT0) / 1000); $("span", recBox).textContent = Math.floor(s2 / 60) + ":" + String(s2 % 60).padStart(2, "0"); }, 250);
      };
      shoot.onclick = () => (mode === "photo" ? photo() : video());
      body.querySelector(".cam-modes").onclick = (e) => { const b = e.target.closest("[data-mode]"); if (!b || (rec && rec.state === "recording")) return; mode = b.dataset.mode; body.querySelectorAll("[data-mode]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); shoot.classList.toggle("video", mode === "video"); shoot.setAttribute("aria-label", mode === "photo" ? "Take a photo" : "Start recording"); };
      $(".cam-timer", body).onclick = (e) => { timer = { 0: 3, 3: 10, 10: 0 }[timer]; const b = e.currentTarget; $("span", b).textContent = timer ? timer + "s" : "Off"; b.setAttribute("aria-label", "Self-timer: " + (timer ? timer + " seconds" : "off")); b.classList.toggle("on", !!timer); };
      $(".cam-last", body).onclick = () => NX.open("photos");
      start();
    } };

  // ---------- Voice Recorder: record from the microphone, saved in Music > Recordings ----------
  A.recorder = { name: "Voice Recorder", icon: "recorder", builtIn: true, category: "Utilities", w: 520, h: 560, minW: 320, minH: 420, desc: "Record your voice, lessons or meetings.",
    open(body, win) {
      body.classList.add("vr");
      body.innerHTML = `<div class="vr-top"><canvas class="vr-wave" width="440" height="120" aria-hidden="true"></canvas><div class="vr-time">0:00</div><p class="vr-msg">Press the button to start recording.</p>
        <button class="vr-go" aria-label="Start recording"><i></i></button></div><h3>Recordings</h3><div class="vr-list"><p class="vr-none">Your recordings show up here. They're saved in Music.</p></div>`;
      const go = $(".vr-go", body), cv = $(".vr-wave", body), g = cv.getContext("2d"), t = $(".vr-time", body), m = $(".vr-msg", body), list = $(".vr-list", body);
      let stream = null, rec = null, chunks = [], t0 = 0, raf = 0, ac = null, an = null, tick = 0;
      const draw = () => {
        const W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
        const data = new Uint8Array(an ? an.frequencyBinCount : 64); if (an) an.getByteFrequencyData(data);
        const n = 48, bw = W / n; g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#7c5cff";
        for (let i = 0; i < n; i++) { const vv = an ? data[Math.floor(i * data.length / n / 1.6)] / 255 : 0, h = Math.max(4, vv * H * .9); g.globalAlpha = .45 + vv * .55; g.beginPath(); g.roundRect(i * bw + 2, (H - h) / 2, bw - 4, h, 3); g.fill(); }
        g.globalAlpha = 1; if (rec && rec.state === "recording") raf = requestAnimationFrame(draw);
      };
      draw();
      const stopAll = () => { cancelAnimationFrame(raf); clearInterval(tick); if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; if (ac) ac.close().catch(() => {}); ac = an = null; };
      win.onclose = () => { if (rec && rec.state === "recording") rec.stop(); stopAll(); };
      const item = (name, blob) => {
        const none = $(".vr-none", list); if (none) none.remove();
        const row = document.createElement("div"); row.className = "vr-item"; const url = URL.createObjectURL(blob);
        row.innerHTML = `<span>${NX.icon("recorder", 28)}</span><div><b>${NX.esc(name.replace(/\.webm$/, ""))}</b><audio controls src="${url}"></audio></div>`; list.prepend(row);
      };
      go.onclick = async () => {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { m.textContent = "This computer can't record here."; return; }
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch (e) { m.textContent = camErr(e, "microphone"); return; }
        try { ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 256; ac.createMediaStreamSource(stream).connect(an); } catch (e) { an = null; }
        chunks = []; rec = new MediaRecorder(stream, recType("audio") ? { mimeType: recType("audio") } : undefined);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stopAll(); go.classList.remove("on"); go.setAttribute("aria-label", "Start recording"); m.textContent = "Saving..."; draw();
          const blob = new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] }), name = "Recording " + stamp() + ".webm";
          try { const r = await save("Music", name, blob); item(r.name || name, blob); m.textContent = "Saved in Music as " + (r.name || name) + "."; } catch (e) { m.textContent = e.message || "The recording couldn't be saved."; }
        };
        rec.start(1000); t0 = Date.now(); go.classList.add("on"); go.setAttribute("aria-label", "Stop recording"); m.textContent = "Recording. Press the button again to stop.";
        tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); t.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 250);
        draw();
      };
    } };

  // ---------- Weather: now, the next 24 hours and the week, for your city or where you are ----------
  A.weather = { name: "Weather", icon: "weather", builtIn: true, category: "Utilities", w: 900, h: 640, minW: 360, minH: 420, desc: "The weather now, by the hour and for the week.",
    open(body) {
      body.classList.add("wa");
      const place = () => NX.data("wx-place", null);
      const unit = () => (NX.wxInfo && NX.wxInfo.fahrenheit() ? "F" : "C");
      const search = `<form class="wa-find"><input placeholder="Search for a city" aria-label="Search for a city" maxlength="60"><button class="btn primary" type="submit">Search</button><button class="btn" type="button" data-here>Use my location</button></form><p class="wa-err" role="status"></p>`;
      const setPlace = async (p) => { NX.setData("wx-place", p); if (NX.wxInfo) NX.wxInfo.refresh().catch(() => {}); draw(); };
      const wire = () => {
        const f = $(".wa-find", body), er = $(".wa-err", body);
        f.onsubmit = async (e) => { e.preventDefault(); const q = f.querySelector("input").value.trim(); if (!q) return; if (!NX.netOK()) { er.textContent = NX.netWhy(); return; } er.textContent = "Looking it up...";
          try { const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(q))).json(); const r = g.results && g.results[0]; if (!r) { er.textContent = "That city wasn't found. Try its full name."; return; } setPlace({ name: r.name + (r.admin1 ? ", " + r.admin1 : r.country ? ", " + r.country : ""), lat: r.latitude, lon: r.longitude }); }
          catch (e2) { er.textContent = "The weather service didn't answer. Try again in a moment."; } };
        $("[data-here]", body).onclick = async () => { if (!NX.netOK()) { er.textContent = NX.netWhy(); return; } er.textContent = "Finding where you are...";
          try { const j = await (await fetch("https://ipapi.co/json/")).json(); if (!(isFinite(j.latitude) && isFinite(j.longitude))) throw new Error("no place"); setPlace({ name: (j.city || "Your area") + (j.region ? ", " + j.region : ""), lat: +j.latitude, lon: +j.longitude }); }
          catch (e2) { er.textContent = "Your location couldn't be found. Search for your city instead."; } };
      };
      async function draw() {
        const p = place();
        if (!p) { body.innerHTML = `<div class="wa-empty">${NX.icon("weather", 96)}<h2>See the weather</h2><p>Search for your city, or use where you are.</p>${search}</div>`; wire(); return; }
        body.innerHTML = `<div class="wa-head"><div><h2>${NX.esc(p.name)}</h2><p class="wa-sub">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></div>${search}</div><div class="wa-body"><p class="wa-note">${NX.netOK() ? "Getting the weather..." : "Connect to the internet to see the weather."}</p></div>`;
        wire(); if (!NX.netOK()) return;
        try {
          const F = unit() === "F", u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=7${F ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : ""}`;
          const j = await (await fetch(u)).json(), c = j.current, I = NX.wxInfo, now = new Date(c.time).getTime(), r = (n) => Math.round(n);
          const hrs = j.hourly.time.map((t, i) => [t, j.hourly.temperature_2m[i], j.hourly.weather_code[i], j.hourly.precipitation_probability[i]]).filter(([t]) => new Date(t).getTime() >= now - 3600000).slice(0, 24);
          const tm = (s) => new Date(s).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          $(".wa-body", body).innerHTML = `<section class="wa-now">${I.icon(c.weather_code, 120)}<div><b>${r(c.temperature_2m)}°${unit()}</b><span>${I.name(c.weather_code)}</span><small>Feels like ${r(c.apparent_temperature)}°  ·  High ${r(j.daily.temperature_2m_max[0])}°  ·  Low ${r(j.daily.temperature_2m_min[0])}°</small></div>
              <dl><div><dt>Humidity</dt><dd>${r(c.relative_humidity_2m)}%</dd></div><div><dt>Wind</dt><dd>${r(c.wind_speed_10m)} ${F ? "mph" : "km/h"}</dd></div><div><dt>Sunrise</dt><dd>${tm(j.daily.sunrise[0])}</dd></div><div><dt>Sunset</dt><dd>${tm(j.daily.sunset[0])}</dd></div></dl></section>
            <h3>Next 24 hours</h3><div class="wa-hours">${hrs.map(([t, temp, code, pp], k) => `<div><span>${k ? new Date(t).toLocaleTimeString([], { hour: "numeric" }) : "Now"}</span>${I.icon(code, 34)}<b>${r(temp)}°</b><small>${pp ? pp + "%" : ""}</small></div>`).join("")}</div>
            <h3>This week</h3><div class="wa-days">${j.daily.time.map((t, k) => { const lo = Math.min(...j.daily.temperature_2m_min), hi = Math.max(...j.daily.temperature_2m_max), a = (j.daily.temperature_2m_min[k] - lo) / (hi - lo || 1) * 100, b = (j.daily.temperature_2m_max[k] - lo) / (hi - lo || 1) * 100;
              return `<div><span>${k ? new Date(t + "T12:00").toLocaleDateString(undefined, { weekday: "long" }) : "Today"}</span>${I.icon(j.daily.weather_code[k], 30)}<small>${j.daily.precipitation_probability_max[k] ? j.daily.precipitation_probability_max[k] + "%" : ""}</small><em>${r(j.daily.temperature_2m_min[k])}°</em><i><u style="left:${a}%;width:${Math.max(4, b - a)}%"></u></i><b>${r(j.daily.temperature_2m_max[k])}°</b></div>`; }).join("")}</div>
            <p class="wa-credit">Weather by Open-Meteo</p>`;
        } catch (e) { $(".wa-body", body).innerHTML = `<p class="wa-note">The weather service didn't answer. Try again in a moment.</p>`; }
      }
      draw();
    } };

  // ---------- The keyboard shortcut guide: Nebulux + / (or from Get Started) ----------
  const KEYS = [
    ["The basics", [["Nebulux", "Open or close Start"], ["Nebulux + D", "Show the desktop"], ["Nebulux + E", "Open File Explorer"], ["Nebulux + L", "Lock the computer"], ["Nebulux + W", "Widgets"], ["Nebulux + /", "This list of shortcuts"]]],
    ["Windows", [["Alt + Tab", "Switch between windows"], ["Nebulux + Tab", "Task View: every window and desktop"], ["Nebulux + Left or Right", "Snap a window to half the screen"], ["Nebulux + Up", "Make a window full size"], ["Nebulux + Down", "Make it smaller, then minimize it"], ["Nebulux + 1 to 9", "Open the app at that place on the taskbar"]]],
    ["Desktops", [["Ctrl + Nebulux + D", "Add a desktop"], ["Ctrl + Nebulux + Left or Right", "Switch desktops"], ["Ctrl + Nebulux + F4", "Close this desktop"]]],
    ["Handy", [["Nebulux + V", "Clipboard history"], ["Print Screen", "Take a screenshot"], ["Nebulux + Shift + S", "Snipping Tool"], ["Ctrl + Shift + Esc", "Task Manager"], ["Ctrl + C", "Copy"], ["Ctrl + V", "Paste"]]],
  ];
  NX.shortcuts = () => {
    let o = $("#nx-keys"); if (o) { o.remove(); return; }
    o = document.createElement("div"); o.id = "nx-keys"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Keyboard shortcuts");
    o.innerHTML = `<div class="nk-card"><div class="nk-head"><h2>Keyboard shortcuts</h2><button class="btn" data-close aria-label="Close">Close</button></div><div class="nk-grid">${KEYS.map(([h, rows]) => `<section><h3>${h}</h3>${rows.map(([k, t]) => `<div class="nk-row"><span>${k.split(" + ").map((x) => `<kbd>${NX.esc(x)}</kbd>`).join("<i>+</i>")}</span><p>${NX.esc(t)}</p></div>`).join("")}</section>`).join("")}</div></div>`;
    o.onclick = (e) => { if (e.target === o || e.target.closest("[data-close]")) o.remove(); };
    document.body.appendChild(o); $("[data-close]", o).focus();
  };
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.getModifierState && e.getModifierState("OS")) && (e.key === "/" || e.key === "?")) { e.preventDefault(); if (NX.me) NX.shortcuts(); }
    else if (e.key === "Escape" && $("#nx-keys")) $("#nx-keys").remove();
  });
  document.addEventListener("nx:key", (e) => { if (e.detail === "keys" && NX.me) NX.shortcuts(); });

  // ---------- A new background every day (Settings > Personalization) ----------
  const daily = () => {
    if (!NX.me || !NX.prefs().dailyWall) return;
    const p = NX.prefs(), day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const pool = NX.wallpapers.map((w, i) => [w, i]).filter(([w]) => !!w.light === (p.theme === "light")).map(([, i]) => i);
    const pick = pool[day % pool.length];
    if (pick != null && pick !== p.wallpaper) NX.setPref("wallpaper", pick);
  };
  NX.dailyWall = daily;
  // Auto mode: light from 7 AM, dark from 7 PM (Settings > Personalization > Choose your mode)
  NX.autoTheme = () => { if (!NX.me) return; const p = NX.prefs(); if (!p.themeAuto) return; const h = new Date().getHours(), want = h >= 7 && h < 19 ? "light" : "dark"; if (p.theme !== want) NX.setPref("theme", want); };
  setInterval(NX.autoTheme, 60000); setTimeout(NX.autoTheme, 1200);
  setInterval(daily, 60000); setTimeout(daily, 1500); document.addEventListener("nx:prefs", (e) => { if (e.detail === "dailyWall" || e.detail === "theme") daily(); });
})();
