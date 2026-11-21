// The apps in the Nebulux Store. Each one runs in its own window and keeps its data with your account.
"use strict";
(function () {
  const A = NX.apps;

  // ---------- Notepad: saves as you type ----------
  A.notepad = { name: "Notepad", icon: "notepad", category: "Productivity", rating: "4.7", size: "1 MB", w: 760, h: 520, desc: "Write notes and lists. Everything saves by itself as you type, and stays with your account.",
    open(body, win) {
      body.classList.add("np");
      body.innerHTML = `<div class="np-bar"><button class="btn sm" data-a="new">New</button><button class="btn sm" data-a="dl">Download</button><span class="np-sp"></span><button class="btn sm" data-a="-" aria-label="Smaller text">A-</button><button class="btn sm" data-a="+" aria-label="Bigger text">A+</button></div><textarea spellcheck="true" placeholder="Start typing..." aria-label="Note"></textarea><div class="np-status"><span class="np-count"></span><span class="np-saved">Saved</span></div>`;
      const ta = body.querySelector("textarea"), cnt = body.querySelector(".np-count"), sv = body.querySelector(".np-saved");
      let size = NX.data("np-size", 15), t = 0; ta.value = NX.data("np-text", ""); ta.style.fontSize = size + "px";
      const count = () => { const s = ta.value; cnt.textContent = (s.trim() ? s.trim().split(/\s+/).length : 0) + " words · " + s.length + " characters"; };
      ta.oninput = () => { count(); sv.textContent = "Saving..."; clearTimeout(t); t = setTimeout(() => { NX.setData("np-text", ta.value); sv.textContent = "Saved"; }, 400); };
      body.querySelector(".np-bar").onclick = (e) => {
        const a = e.target.closest("button"); if (!a) return; const k = a.dataset.a;
        if (k === "new") { if (!ta.value || a.dataset.sure) { ta.value = ""; NX.setData("np-text", ""); count(); a.textContent = "New"; delete a.dataset.sure; } else { a.dataset.sure = 1; a.textContent = "Clear note?"; setTimeout(() => { a.textContent = "New"; delete a.dataset.sure; }, 3000); } }
        if (k === "dl") { const url = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" })), l = document.createElement("a"); l.href = url; l.download = "note.txt"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        if (k === "+" || k === "-") { size = Math.max(11, Math.min(32, size + (k === "+" ? 2 : -2))); ta.style.fontSize = size + "px"; NX.setData("np-size", size); }
      };
      win.onclose = () => { clearTimeout(t); NX.setData("np-text", ta.value); };
      count(); setTimeout(() => ta.focus(), 60);
    } };

  // ---------- Calculator: a real calculator (no eval), with keyboard keys ----------
  A.calculator = { name: "Calculator", icon: "calculator", category: "Utilities", rating: "4.8", size: "1 MB", w: 340, h: 520, minW: 300, minH: 440, desc: "Add, subtract, multiply and divide, with percent, square root and your keyboard.",
    open(body, win) {
      body.classList.add("calc");
      const K = [["%", "pct"], ["CE", "ce"], ["C", "c"], ["⌫", "bs"], ["1/x", "inv"], ["x²", "sq"], ["√x", "sqrt"], ["÷", "/"], ["7"], ["8"], ["9"], ["×", "*"], ["4"], ["5"], ["6"], ["−", "-"], ["1"], ["2"], ["3"], ["+", "+"], ["±", "neg"], ["0"], [".", "."], ["=", "="]];
      body.innerHTML = `<div class="c-disp"><small class="c-expr"></small><b class="c-val">0</b></div><div class="c-keys">${K.map(([l, k]) => `<button class="c-k ${/^[0-9.]$/.test(k || l) ? "num" : ""} ${(k || l) === "=" ? "eq" : ""}" data-k="${k || l}">${l}</button>`).join("")}</div>`;
      let cur = "0", prev = null, op = null, fresh = true, expr = "";
      const val = body.querySelector(".c-val"), ex = body.querySelector(".c-expr");
      const fmt = (n) => { if (!isFinite(n)) return "Can't divide by zero"; const s = Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0) ? n.toExponential(8) : String(+n.toPrecision(15)); return s; };
      const calc = (a, b, o) => o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : o === "/" ? (b === 0 ? Infinity : a / b) : b;
      const show = () => { val.textContent = cur; val.style.fontSize = cur.length > 14 ? "24px" : cur.length > 10 ? "32px" : ""; ex.textContent = expr; };
      const press = (k) => {
        if (cur === "Can't divide by zero" && k !== "c" && k !== "ce") { cur = "0"; prev = null; op = null; expr = ""; }
        if (/^[0-9]$/.test(k)) { cur = fresh || cur === "0" ? k : (cur.length < 16 ? cur + k : cur); fresh = false; }
        else if (k === ".") { if (fresh) { cur = "0."; fresh = false; } else if (!cur.includes(".")) cur += "."; }
        else if (["+", "-", "*", "/"].includes(k)) { const n = parseFloat(cur); if (op && !fresh) { prev = calc(prev, n, op); cur = fmt(prev); } else if (prev == null || !op) prev = n; op = k; fresh = true; expr = fmt(prev) + " " + { "+": "+", "-": "−", "*": "×", "/": "÷" }[k]; }
        else if (k === "=") { if (op) { const n = parseFloat(cur), r = calc(prev, n, op); expr = fmt(prev) + " " + { "+": "+", "-": "−", "*": "×", "/": "÷" }[op] + " " + fmt(n) + " ="; cur = fmt(r); prev = null; op = null; fresh = true; } }
        else if (k === "c") { cur = "0"; prev = null; op = null; fresh = true; expr = ""; }
        else if (k === "ce") { cur = "0"; fresh = true; }
        else if (k === "bs") { if (!fresh) { cur = cur.length > 1 ? cur.slice(0, -1) : "0"; if (cur === "-") cur = "0"; } }
        else if (k === "neg") { if (cur !== "0") cur = cur.startsWith("-") ? cur.slice(1) : "-" + cur; }
        else if (k === "pct") { const n = parseFloat(cur); cur = fmt(prev != null && op ? (prev * n) / 100 : n / 100); fresh = true; }
        else if (k === "sq") { const n = parseFloat(cur); cur = fmt(n * n); fresh = true; }
        else if (k === "sqrt") { const n = parseFloat(cur); cur = n < 0 ? "Invalid input" : fmt(Math.sqrt(n)); fresh = true; if (n < 0) setTimeout(() => { cur = "0"; show(); }, 1200); }
        else if (k === "inv") { const n = parseFloat(cur); cur = n === 0 ? "Can't divide by zero" : fmt(1 / n); fresh = true; }
        show();
      };
      body.querySelector(".c-keys").onclick = (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.k); };
      const key = (e) => {
        if (!win.el.classList.contains("active") || /input|textarea/i.test((document.activeElement || {}).tagName)) return;
        const m = { Enter: "=", "=": "=", Backspace: "bs", Escape: "c", Delete: "ce", "%": "pct" }[e.key] || (/^[0-9.+\-*/]$/.test(e.key) ? e.key : null);
        if (m) { e.preventDefault(); press(m); }
      };
      addEventListener("keydown", key); win.onclose = () => removeEventListener("keydown", key);
    } };

  // ---------- Paint: brush, colors, sizes, eraser, save as a picture ----------
  A.paint = { name: "Paint", icon: "paint", category: "Creativity", rating: "4.6", size: "2 MB", w: 900, h: 620, minW: 420, minH: 360, desc: "Draw and paint with brushes and colors, then save your picture.",
    open(body, win) {
      body.classList.add("paint");
      const COLS = ["#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#22d3ee", "#3b82f6", "#7c5cff", "#ec4899", "#8b5a2b", "#94a3b8"];
      body.innerHTML = `<div class="p-bar"><div class="p-cols">${COLS.map((c, i) => `<button data-col="${c}" class="${i === 8 ? "on" : ""}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div><label class="p-size">Size <input type="range" min="2" max="48" value="8"></label><button class="btn sm" data-t="brush">Brush</button><button class="btn sm" data-t="eraser">Eraser</button><button class="btn sm" data-t="undo">Undo</button><button class="btn sm" data-t="clear">Clear</button><button class="btn sm primary" data-t="save">Save picture</button></div><div class="p-wrap"><canvas></canvas></div>`;
      const cv = body.querySelector("canvas"), g = cv.getContext("2d"), wrap = body.querySelector(".p-wrap");
      let col = COLS[8], size = 8, tool = "brush", down = false, last = null; const hist = [];
      const resize = () => {
        const r = wrap.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
        const old = document.createElement("canvas"); old.width = cv.width; old.height = cv.height; old.getContext("2d").drawImage(cv, 0, 0);
        cv.width = Math.round(r.width); cv.height = Math.round(r.height); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(old, 0, 0);
      };
      const snap = () => { try { hist.push(g.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 20) hist.shift(); } catch (e) { /* too big */ } };
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); snap(); down = true; last = pos(e); g.beginPath(); g.fillStyle = tool === "eraser" ? "#fff" : col; g.arc(last[0], last[1], size / 2, 0, 7); g.fill(); };
      cv.onpointermove = (e) => { if (!down) return; const p = pos(e); g.strokeStyle = tool === "eraser" ? "#fff" : col; g.lineWidth = size; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
      cv.onpointerup = cv.onpointercancel = () => { down = false; };
      body.querySelector(".p-cols").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; col = b.dataset.col; tool = "brush"; body.querySelectorAll(".p-cols button").forEach((x) => x.classList.toggle("on", x === b)); };
      body.querySelector(".p-size input").oninput = (e) => (size = +e.target.value);
      body.querySelector(".p-bar").addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]"); if (!b) return; const t = b.dataset.t;
        if (t === "brush" || t === "eraser") { tool = t; body.querySelectorAll("[data-t=brush],[data-t=eraser]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (t === "undo" && hist.length) g.putImageData(hist.pop(), 0, 0);
        if (t === "clear") { snap(); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); }
        if (t === "save") { const l = document.createElement("a"); l.href = cv.toDataURL("image/png"); l.download = "painting.png"; document.body.appendChild(l); l.click(); l.remove(); NX.toast("Picture saved to your downloads."); }
      });
      body.querySelector("[data-t=brush]").classList.add("on");
      win.onresize = () => setTimeout(resize, 0); setTimeout(resize, 30);
    } };

  // ---------- Clock: time, stopwatch and timer ----------
  A.clock = { name: "Clock", icon: "clock", category: "Utilities", rating: "4.6", size: "1 MB", w: 520, h: 480, minW: 340, minH: 380, desc: "The time, a stopwatch with laps, and a timer that rings when it's done.",
    open(body, win) {
      body.classList.add("clk");
      body.innerHTML = `<div class="seg clk-tabs"><button data-v="clock" class="on">Clock</button><button data-v="sw">Stopwatch</button><button data-v="tm">Timer</button></div><div class="clk-face"></div>`;
      let v = "clock", swOn = false, swT = 0, swAt = 0, laps = [], tmLeft = 300000, tmOn = false, tmAt = 0, tmSet = 300000;
      const face = body.querySelector(".clk-face"), f2 = (n) => String(n).padStart(2, "0");
      const fmtMs = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100; return (h ? h + ":" : "") + f2(m) + ":" + f2(s) + "." + f2(cs); };
      const draw = () => {
        const now = performance.now();
        if (v === "clock") { const d = new Date(); face.innerHTML = `<div class="clk-big">${NX.fmtTime(d, true)}</div><div class="clk-sub">${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>`; }
        if (v === "sw") { const t = swT + (swOn ? now - swAt : 0); face.innerHTML = `<div class="clk-big mono">${fmtMs(t)}</div><div class="clk-btns"><button class="btn primary" data-a="sws">${swOn ? "Pause" : "Start"}</button><button class="btn" data-a="swl" ${swOn ? "" : "disabled"}>Lap</button><button class="btn" data-a="swr">Reset</button></div><ol class="clk-laps">${laps.map((l, i) => `<li><span>Lap ${laps.length - i}</span><b>${fmtMs(l)}</b></li>`).join("")}</ol>`; }
        if (v === "tm") { const left = tmOn ? tmLeft - (now - tmAt) : tmLeft; face.innerHTML = `<div class="clk-big mono">${fmtMs(left).slice(0, -3)}</div><div class="clk-btns">${tmOn ? "" : `<button class="btn" data-a="t1">1 min</button><button class="btn" data-a="t5">5 min</button><button class="btn" data-a="t10">10 min</button>`}</div><div class="clk-btns"><button class="btn primary" data-a="tms">${tmOn ? "Pause" : "Start"}</button><button class="btn" data-a="tmr">Reset</button></div>`;
 }
      };
      body.querySelector(".clk-tabs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; v = b.dataset.v; body.querySelectorAll(".clk-tabs button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
      face.onclick = (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a, now = performance.now();
        if (a === "sws") { if (swOn) { swT += now - swAt; swOn = false; } else { swAt = now; swOn = true; } }
        if (a === "swl") laps.unshift(swT + now - swAt);
        if (a === "swr") { swOn = false; swT = 0; laps = []; }
        if (a === "t1" || a === "t5" || a === "t10") { tmSet = tmLeft = { t1: 60000, t5: 300000, t10: 600000 }[a]; }
        if (a === "tms") { if (tmOn) { tmLeft -= now - tmAt; tmOn = false; } else if (tmLeft > 0) { tmAt = now; tmOn = true; } }
        if (a === "tmr") { tmOn = false; tmLeft = tmSet; }
        draw();
      };
      // the tick only updates the time text, so buttons are never rebuilt under the pointer
      const tick = setInterval(() => {
        const big = face.querySelector(".clk-big"); if (!big) return; const now = performance.now();
        if (v === "clock") { const d = new Date(); big.textContent = NX.fmtTime(d, true); }
        else if (v === "sw" && swOn) big.textContent = fmtMs(swT + now - swAt);
        else if (v === "tm" && tmOn) big.textContent = fmtMs(tmLeft - (now - tmAt)).slice(0, -3);
        if (tmOn && tmLeft - (now - tmAt) <= 0) { tmOn = false; tmLeft = tmSet; NX.toast("Time's up!"); NX.beep && NX.beep(); draw(); }
      }, 50);
      win.onclose = () => clearInterval(tick); draw();
    } };

  // ---------- Comet Snake: an original arcade game ----------
  A.snake = { name: "Comet Snake", icon: "snake", category: "Games", rating: "4.9", size: "1 MB", w: 560, h: 620, minW: 360, minH: 420, desc: "Steer a comet through space, collect stardust to grow, and don't hit your own tail. Arrow keys or WASD, or swipe.",
    open(body, win) {
      body.classList.add("snk");
      body.innerHTML = `<div class="snk-top"><span>Score <b class="snk-s">0</b></span><span>Best <b class="snk-b">${NX.data("snake-best", 0)}</b></span></div><div class="snk-wrap"><canvas></canvas><div class="snk-msg"><b>Comet Snake</b><span>Arrow keys or WASD to steer. Swipe on a touch screen.</span><button class="btn primary">Play</button></div></div>`;
      const cv = body.querySelector("canvas"), g = cv.getContext("2d"), msg = body.querySelector(".snk-msg"), N = 20;
      let sn, dir, nd, food, score, run = false, loop = 0, cell = 20;
      const size = () => { const r = body.querySelector(".snk-wrap").getBoundingClientRect(); const s = Math.max(200, Math.floor(Math.min(r.width, r.height) - 16)); cell = Math.floor(s / N); cv.width = cv.height = cell * N; draw(); };
      const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (sn.some((p) => p[0] === food[0] && p[1] === food[1])); };
      const reset = () => { sn = [[10, 10], [9, 10], [8, 10]]; dir = nd = [1, 0]; score = 0; body.querySelector(".snk-s").textContent = 0; place(); };
      const draw = () => {
        if (!sn) return; g.fillStyle = "#0b0620"; g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (((i * 37) % 10) / 20 + 0.1) + ")"; g.fillRect(((i * 97) % N) * cell + cell / 2, ((i * 53) % N) * cell + cell / 3, 1.5, 1.5); }
        g.fillStyle = "#fde68a"; g.beginPath(); g.arc(food[0] * cell + cell / 2, food[1] * cell + cell / 2, cell * 0.32, 0, 7); g.fill();
        sn.forEach((p, i) => { const t = i / sn.length; g.fillStyle = `hsl(${190 + t * 110},90%,${65 - t * 20}%)`; const pad = i ? cell * 0.14 : cell * 0.06; g.beginPath(); g.roundRect ? g.roundRect(p[0] * cell + pad, p[1] * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.3) : g.rect(p[0] * cell + pad, p[1] * cell + pad, cell - pad * 2, cell - pad * 2); g.fill(); });
      };
      const step = () => {
        dir = nd; const h = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || sn.some((p) => p[0] === h[0] && p[1] === h[1])) { end(); return; }
        sn.unshift(h); if (h[0] === food[0] && h[1] === food[1]) { score++; body.querySelector(".snk-s").textContent = score; place(); } else sn.pop(); draw();
      };
      const end = () => { run = false; clearInterval(loop); const best = Math.max(score, NX.data("snake-best", 0)); NX.setData("snake-best", best); body.querySelector(".snk-b").textContent = best; msg.querySelector("b").textContent = "Game over · " + score; msg.querySelector("button").textContent = "Play again"; msg.hidden = false; };
      const start = () => { reset(); msg.hidden = true; run = true; clearInterval(loop); loop = setInterval(step, 115); draw(); };
      msg.querySelector("button").onclick = start;
      const turn = (x, y) => { if (!run) return; if (x === -dir[0] && y === -dir[1]) return; nd = [x, y]; };
      const key = (e) => { if (!win.el.classList.contains("active")) return; const m = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (m && run) { e.preventDefault(); turn(m[0], m[1]); } };
      let ts = null; cv.addEventListener("touchstart", (e) => { ts = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
      cv.addEventListener("touchend", (e) => { if (!ts) return; const dx = e.changedTouches[0].clientX - ts[0], dy = e.changedTouches[0].clientY - ts[1]; if (Math.abs(dx) + Math.abs(dy) > 24) Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); ts = null; }, { passive: true });
      addEventListener("keydown", key); win.onclose = () => { clearInterval(loop); removeEventListener("keydown", key); };
      win.onresize = () => setTimeout(size, 0); reset(); setTimeout(size, 30);
    } };

  // ---------- web apps (open in a new tab) ----------
  A.nebuluxai = { name: "Nebulux AI", icon: "ai", category: "Web", rating: "4.8", size: "Web app", url: "https://nebuluxai.com", desc: "Chat with AI, make games and websites. Opens nebuluxai.com in a new tab." };
  A.arcade = { name: "Nebulux Arcade", icon: "arcade", category: "Web", rating: "4.7", size: "Web app", url: "https://nebuluxai.com/arcade", desc: "Play Nebula Royale, Nebula Brawl and dozens of free games. Opens in a new tab." };
})();
