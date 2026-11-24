// Task Manager (Ctrl + Shift + Esc): the open apps with End task, and how busy the computer is. On the real
// Nebulux OS it shows the processor and memory use of the computer itself.
"use strict";
(function () {
  const gb = (b) => (b / 1073741824).toFixed(1) + " GB";
  NX.apps.taskmgr = { name: "Task Manager", icon: "taskmgr", builtIn: true, w: 720, h: 520, minW: 360, minH: 360, desc: "See open apps and how busy the computer is.",
    open(body, win) {
      body.classList.add("tm");
      let tab = "apps", cpuHist = [], memHist = [], last = null, timer = 0;
      body.innerHTML = `<div class="tm-tabs" role="tablist"><button data-tab="apps" class="on" role="tab">Apps</button><button data-tab="perf" role="tab">Performance</button></div><div class="tm-body"></div>`;
      const box = body.querySelector(".tm-body");
      // a graph with faint grid lines, a fill that fades to the bottom, and a soft glow on the line
      const graph = (hist, color) => { const id = "tg" + color.slice(1), pts = hist.map((v, i) => `${(i / 59) * 300},${100 - Math.max(0, Math.min(100, v))}`).join(" "), grid = [20, 40, 60, 80].map((y) => `<line x1="0" x2="300" y1="${y}" y2="${y}" class="tm-gl"/>`).join("") + [50, 100, 150, 200, 250].map((x) => `<line y1="0" y2="100" x1="${x}" x2="${x}" class="tm-gl"/>`).join(""); return `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="tm-graph"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}${hist.length ? `<polyline points="0,100 ${pts} ${((hist.length - 1) / 59) * 300},100" fill="url(#${id})" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 4px ${color})"/>` : ""}</svg>`; };
      function draw() {
        body.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
        if (tab === "apps") {
          const list = [...NX.wins.values()];
          box.innerHTML = `<div class="tm-head"><span>Name</span><span>Status</span><span></span></div>` + list.map((w) => `<div class="tm-row"><span class="tm-app">${NX.icon(w.app.icon || w.id, 22)}<b>${NX.esc(w.app.name)}</b></span><span class="tm-st">${w.min ? "Minimized" : "Running"}</span><span><button class="btn sm" data-end="${w.id}" ${w.id === "taskmgr" ? "disabled" : ""}>End task</button></span></div>`).join("");
          box.querySelectorAll("[data-end]").forEach((b) => (b.onclick = () => { NX.close(b.dataset.end); draw(); }));
          return;
        }
        const s = last;
        box.innerHTML = `<div class="tm-perf"><div class="tm-card"><div class="tm-ch"><b>Processor</b><span>${s && s.cpu != null ? s.cpu + "%" : NX.native ? "Measuring..." : "Only on the real Nebulux OS"}</span></div>${graph(cpuHist, "#22d3ee")}<small>${s ? NX.esc([s.model, s.cores ? s.cores + " threads" : ""].filter(Boolean).join(" · ")) : ""}</small></div>
          <div class="tm-card"><div class="tm-ch"><b>Memory</b><span>${s && s.memTotal ? gb(s.memUsed) + " of " + gb(s.memTotal) : "Unknown"}</span></div>${graph(memHist, "#a78bfa")}<small>${s && s.memTotal ? Math.round((s.memUsed / s.memTotal) * 100) + "% in use" : ""}</small></div>
          <div class="tm-card tm-facts"><div><span>Open apps</span><b>${NX.wins.size}</b></div><div><span>Up time</span><b>${s && s.uptime ? new Date(s.uptime * 1000).toISOString().slice(11, 19) : "-"}</b></div></div></div>`;
      }
      async function tick() {
        try {
          if (NX.native) last = await NX.api("GET", "/stats");
          else { const m = performance.memory; last = { cpu: null, cores: navigator.hardwareConcurrency, model: "", memTotal: m ? m.jsHeapSizeLimit : 0, memUsed: m ? m.usedJSHeapSize : 0, uptime: Math.round(performance.now() / 1000) }; }
          if (last.cpu != null) cpuHist.push(last.cpu); if (last.memTotal) memHist.push((last.memUsed / last.memTotal) * 100);
          cpuHist = cpuHist.slice(-60); memHist = memHist.slice(-60);
        } catch (e) { /* try again next second */ }
        if (NX.wins.get("taskmgr") === win) draw();
      }
      body.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
      timer = setInterval(tick, 1000); tick();
      win.onclose = () => clearInterval(timer);
    } };
})();
