// Nebulux OS 1.2 apps in a browser tab: File Explorer (folders, new folder and text file, rename, copy and paste,
// the Recycle Bin), Notepad opening and saving real files, Paint saving to Pictures, Photos, Media Player, Snipping
// Tool, and the Windows key opening Start when it's let go.
// node tests/files.cjs [W H]   (needs Edge or Chrome with --remote-debugging-port=9333)
const puppeteer = require(process.env.PUPPETEER || "C:/nebulux-orbit/node_modules/puppeteer-core"), path = require("path"), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +process.argv[2] || 1366, H = +process.argv[3] || 768, URL = "file:///" + path.resolve(__dirname, "../index.html").replace(/\\/g, "/") + "?fast";
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };
(async () => {
  const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", protocolTimeout: 120000 }); const errs = [];
  const c = await b.createBrowserContext(), p = await c.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.setViewport({ width: W, height: H });
  await p.goto(URL, { waitUntil: "load" }); await wait(500);
  const shot = (n) => p.screenshot({ path: path.join(__dirname, "shots", "files-" + n + "-" + W + ".png") });
  const txt = (s) => p.evaluate((s) => (document.querySelector(s) || document.body).innerText, s || "body");
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 6000)) { if (await fn()) return true; await wait(150); } return false; };
  const names = () => p.evaluate(() => [...document.querySelectorAll(".win[data-app=files] .fx-item .fx-n")].map((x) => x.textContent));
  const item = (n) => p.evaluate((n) => { const it = [...document.querySelectorAll(".win[data-app=files] .fx-item")].find((x) => x.querySelector(".fx-n").textContent === n); if (!it) return null; const r = it.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, n);
  const pick = async (n) => { const at = await item(n); await p.mouse.click(at.x, at.y); await wait(120); };
  const dbl = async (n) => { const at = await item(n); await p.mouse.click(at.x, at.y, { clickCount: 2 }); await wait(400); };
  const tool = async (t) => { await p.click(`.win[data-app=files] [data-t=${t}]`); await wait(250); };
  const answer = async (v) => { if (v != null) { await p.evaluate(() => { document.querySelector(".nx-ask input").value = ""; }); await p.type(".nx-ask input", v); } await p.click(".nx-ask [type=submit]"); await wait(400); };

  // sign up
  await require("./setup.cjs")(p, "Ada", "nebula1");
  ok(await p.evaluate(() => !!document.querySelector("#tb-apps [data-app=files]") && !!document.querySelector("#icons [data-app=files]")), "File Explorer is on the taskbar and the desktop");

  // a real mouse click on a desktop icon opens the app (the windows layer used to swallow these clicks)
  { const r = await p.evaluate(() => { const e = document.querySelector("#icons [data-app=settings]").getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
    await p.mouse.click(r.x, r.y); await wait(600);
    ok(await p.evaluate(() => !!NX.wins.get("settings")), "a mouse click on a desktop icon opens the app");
    await p.evaluate(() => NX.close("settings")); await wait(250); }

  // the Windows key opens Start when it's let go
  await p.keyboard.down("Meta"); await wait(50); await p.keyboard.up("Meta"); await wait(300);
  ok(await p.evaluate(() => !document.querySelector("#start").hidden), "the Windows key opens Start");
  await p.keyboard.press("Escape"); await wait(200);

  // File Explorer
  await p.click("#tb-apps [data-app=files]"); await wait(600);
  ok(JSON.stringify(await names()) === JSON.stringify(["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"]), "File Explorer opens Home with your folders (" + (await names()) + ")");
  await dbl("Documents");
  ok((await names()).includes("Welcome.txt"), "Documents has a welcome file");
  await tool("newfolder"); await answer("Trips");
  ok((await names()).includes("Trips"), "New folder makes a folder");
  await tool("newtext"); await answer("Shopping list.txt");
  ok((await names()).includes("Shopping list.txt"), "New text file makes a text file");
  await pick("Shopping list.txt"); await tool("rename"); await answer("Groceries.txt");
  ok((await names()).includes("Groceries.txt") && !(await names()).includes("Shopping list.txt"), "Rename renames it");
  await dbl("Groceries.txt");
  ok(await until(() => p.evaluate(() => !!document.querySelector(".win[data-app=notepad]") && document.querySelector(".win[data-app=notepad] .wt-name").textContent === "Groceries.txt")), "a text file opens in Notepad");
  await p.type(".win[data-app=notepad] textarea", "milk, eggs"); await wait(900);
  ok(await p.evaluate(async () => (await NX.fs.read("/Documents/Groceries.txt")) === "milk, eggs"), "Notepad saves the file as you type");
  await p.evaluate(() => NX.close("notepad")); await wait(300);
  await p.evaluate(() => NX.focus("files"));
  await pick("Groceries.txt"); await tool("copy"); await dbl("Trips"); await tool("paste");
  ok(JSON.stringify(await names()) === '["Groceries.txt"]', "Copy and Paste copies into a folder");
  await p.click(".win[data-app=files] [data-n=back]"); await wait(400);
  await pick("Groceries.txt"); await tool("delete");
  ok(!(await names()).includes("Groceries.txt"), "Delete removes it from the folder");
  await p.click(".win[data-app=files] [data-go='::trash']"); await wait(400);
  ok((await names()).includes("Groceries.txt"), "and it's in the Recycle Bin");
  await shot("trash");
  await pick("Groceries.txt"); await tool("restore");
  ok(!(await names()).includes("Groceries.txt"), "Restore takes it out of the Recycle Bin");
  ok(await p.evaluate(async () => (await NX.fs.read("/Documents/Groceries.txt")) === "milk, eggs"), "and puts it back where it was");
  await p.click(".win[data-app=files] [data-n=back]"); await wait(400);
  ok((await names()).includes("Groceries.txt"), "the folder shows it again");
  await pick("Trips"); await tool("delete"); await p.click(".win[data-app=files] [data-go='::trash']"); await wait(300); await tool("empty"); await answer();
  ok((await names()).length === 0, "Empty Recycle Bin empties it");
  await p.click(".win[data-app=files] [data-go='/Documents']"); await wait(400);
  await p.click(".win[data-app=files] .fx-search input"); await p.keyboard.type("groc"); await wait(200);
  ok(JSON.stringify(await names()) === '["Groceries.txt"]', "Search finds files in the folder");
  await tool("view"); ok(await p.evaluate(() => document.querySelector(".win[data-app=files] .fx-list").classList.contains("list")), "Details view lists files with dates and sizes");
  await shot("explorer");

  // Notepad: Save to Documents
  await p.evaluate(() => NX.open("notepad")); await wait(400);
  await p.evaluate(() => { const t = document.querySelector(".win[data-app=notepad] textarea"); t.value = ""; t.dispatchEvent(new Event("input")); }); await p.type(".win[data-app=notepad] textarea", "Party plans\nCake"); await wait(600);
  await p.click(".win[data-app=notepad] [data-a=save]"); await wait(600);
  ok(await p.evaluate(async () => (await NX.fs.read("/Documents/Party plans.txt")) === "Party plans\nCake"), "Notepad's Save to Documents makes a text file named from the first line");
  await p.evaluate(() => NX.close("notepad")); await wait(300);

  // Paint saves into Pictures, and Photos shows it
  await p.evaluate(() => NX.open("paint")); await wait(900);
  const cv = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] canvas").getBoundingClientRect(); return { x: r.x + 60, y: r.y + 60 }; });
  await p.mouse.move(cv.x, cv.y); await p.mouse.down(); await p.mouse.move(cv.x + 120, cv.y + 40, { steps: 6 }); await p.mouse.up();
  const hit = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] [data-t=save]").getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return (e && (e.dataset.t || e.tagName + "#" + e.id + "." + e.className)) + " at " + Math.round(r.x) + "," + Math.round(r.y); });
  for (let k = 0; k < 3; k++) { await p.click(".win[data-app=paint] [data-t=save]"); await wait(900); if (await p.evaluate(async () => (await NX.fs.list("/Pictures")).entries.some((e) => /^Painting/.test(e.name)))) break; }
  if (!/^save/.test(hit)) console.log("  save button covered by:", hit);
  ok(await p.evaluate(async () => (await NX.fs.list("/Pictures")).entries.some((e) => /^Painting/.test(e.name))), "Paint saves the picture in Pictures");
  if (!(await p.evaluate(async () => (await NX.fs.list("/Pictures")).entries.some((e) => e.name === "Painting.png")))) console.log("  toasts:", await p.evaluate(() => NX.notes.slice(0, 3).map((n) => n.text).join(" | ")), "| pictures:", await p.evaluate(async () => (await NX.fs.list("/Pictures")).entries.map((e) => e.name).join(",")));
  await p.evaluate(() => NX.close("paint")); await wait(300);
  await p.evaluate(() => NX.open("photos")); await wait(700);
  ok(await until(() => p.evaluate(() => { const i = document.querySelector(".win[data-app=photos] .ph-tile img"); return !!i && i.naturalWidth > 0; })), "Photos shows your pictures");
  await p.click(".win[data-app=photos] .ph-tile"); await wait(500);
  ok(await until(() => p.evaluate(() => { const i = document.querySelector(".win[data-app=photos] .ph-view > img"); return !!i && i.naturalWidth > 0; })), "and opens one big");
  await shot("photos");
  await p.evaluate(() => NX.close("photos")); await wait(300);

  // Media Player and Snipping Tool open
  await p.evaluate(() => NX.open("media")); await wait(500);
  ok(/No music or videos yet/.test(await txt(".win[data-app=media]")), "Media Player opens and says where music and videos go");
  await p.evaluate(() => NX.close("media")); await wait(200);
  await p.evaluate(() => NX.open("snip")); await wait(400);
  ok(/Nebulux \+ Shift \+ S/.test(await txt(".win[data-app=snip]")), "Snipping Tool opens");
  await p.evaluate(() => NX.close("snip")); await wait(200);

  // ---------- 1.3: transparency, window keys, Alt + Tab, Lock, notifications, Task Manager ----------
  ok(await p.evaluate(() => !document.documentElement.classList.contains("nofx")), "Transparency effects are on in a browser tab");
  await p.evaluate(() => NX.open("settings", { page: "personal" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=transparency]").click()); await wait(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("nofx") && getComputedStyle(document.querySelector("#taskbar")).backdropFilter === "none"), "turning them off makes the taskbar and windows solid");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=transparency]").click()); await wait(200);
  await p.evaluate(() => NX.open("notepad")); await wait(300);
  const winKey = async (k) => { await p.keyboard.down("Meta"); await p.keyboard.press(k); await p.keyboard.up("Meta"); await wait(250); };
  await winKey("ArrowLeft");
  ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad]").getBoundingClientRect(); return r.x <= 1 && Math.abs(r.width - innerWidth / 2) < 3; }), "Windows + Left snaps the window to the left half");
  ok(await p.evaluate(() => document.querySelector("#start").hidden), "and doesn't open Start");
  await winKey("ArrowUp");
  ok(await p.evaluate(() => document.querySelector(".win[data-app=notepad]").classList.contains("maxed")), "Windows + Up maximizes it");
  await winKey("KeyD");
  ok(await p.evaluate(() => [...NX.wins.values()].every((w) => w.min)), "Windows + D shows the desktop");
  await winKey("KeyD");
  ok(await p.evaluate(() => NX.wins.get("notepad") && !NX.wins.get("notepad").min), "and pressing it again brings the windows back");
  await p.keyboard.down("Alt"); await p.keyboard.press("Tab"); await wait(150);
  ok(await p.evaluate(() => !document.querySelector("#switcher").hidden && document.querySelectorAll("#switcher .sw-item").length === NX.wins.size), "Alt + Tab shows your open windows");
  const target = await p.evaluate(() => document.querySelector("#switcher .sw-item.on span").textContent);
  await p.keyboard.up("Alt"); await wait(250);
  ok(await p.evaluate((t) => document.querySelector("#switcher").hidden && NX.topWin().app.name === t, target), "letting go of Alt switches to it (" + target + ")");
  NX_toasts: {
    await p.evaluate(() => NX.toast("A test notification"));
    await p.click("#tb-clock"); await wait(300);
    ok(/A test notification/.test(await txt("#cal")), "the notification center keeps your notifications");
    await p.click("#cal .nc-clear"); await wait(200);
    ok(/No new notifications/.test(await txt("#cal")), "Clear all clears them");
    await p.keyboard.press("Escape"); await wait(150);
    await p.click("#tb-qs"); await wait(250); await p.click("#qs [data-k=dnd]"); await wait(200); await p.keyboard.press("Escape");
    const before = await p.evaluate(() => document.querySelectorAll("#toasts .toast").length);
    await p.evaluate(() => NX.toast("Quiet please")); await wait(150);
    ok(await p.evaluate((b) => document.querySelectorAll("#toasts .toast").length === b && NX.notes[0].text === "Quiet please", before), "Do not disturb keeps notifications quiet, but saved");
    await p.evaluate(() => NX.setPref("dnd", false));
  }
  await p.keyboard.down("Control"); await p.keyboard.down("Shift"); await p.keyboard.press("Escape"); await p.keyboard.up("Shift"); await p.keyboard.up("Control"); await wait(500);
  ok(await p.evaluate(() => !!NX.wins.get("taskmgr")), "Ctrl + Shift + Esc opens Task Manager");
  ok(await p.evaluate(() => [...document.querySelectorAll(".win[data-app=taskmgr] .tm-row b")].some((b) => b.textContent === "Notepad")), "it lists the open apps");
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=taskmgr] .tm-row")].find((r) => /Notepad/.test(r.innerText)).querySelector("[data-end]").click()); await wait(300);
  ok(await p.evaluate(() => !NX.wins.get("notepad")), "End task closes an app");
  await p.evaluate(() => document.querySelector(".win[data-app=taskmgr] [data-tab=perf]").click()); await wait(1300);
  ok(/Memory/.test(await txt(".win[data-app=taskmgr]")) && await p.evaluate(() => !!document.querySelector(".win[data-app=taskmgr] .tm-graph")), "Performance shows the graphs");
  await shot("taskmgr");
  // Lock keeps your apps open
  await winKey("KeyL"); await wait(400);
  ok(await p.evaluate(() => !document.querySelector("#lock").hidden && !!NX.wins.get("taskmgr")), "Windows + L locks, and your apps stay open behind the lock screen");
  await p.mouse.click(W / 2, H / 2); await wait(400); await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter"); await wait(1200);
  ok(await p.evaluate(() => !document.querySelector("#desktop").hidden && !!NX.wins.get("taskmgr")), "unlocking brings you back to them");
  await p.evaluate(() => NX.close("taskmgr")); await wait(200);

  // ---------- 1.4: Windows 11 touches ----------
  ok(await p.evaluate(() => !!document.querySelector("#tb-start img.tb-neb") && /nebulux-64\.png/.test(document.querySelector("#tb-start img").src)), "the Start button is the Nebulux nebula");
  const narrow = W < 560;
  ok(await p.evaluate((narrow) => narrow ? !!document.querySelector("#tb-search") : /Search/.test(document.querySelector("#tb-search").innerText) && !!document.querySelector("#tb-tview").offsetWidth && !!document.querySelector("#tb-widgets").offsetWidth, narrow), narrow ? "the taskbar has Search (Task View and Widgets are on the keyboard on a phone)" : "the taskbar has a Search box, Task View and Widgets");
  await p.click("#tb-start"); await wait(300); await p.click("#start [data-allapps]"); await wait(250);
  ok(await p.evaluate(() => /All apps/.test(document.querySelector("#start").innerText) && document.querySelectorAll("#start .sm-letter").length >= 5), "Start has All apps, A to Z");
  await p.click("#start [data-back]"); await wait(200);
  ok(await p.evaluate(() => /Groceries\.txt/.test(document.querySelector("#start .sm-rec").innerText)), "Recommended shows files you opened recently");
  await p.keyboard.press("Escape"); await wait(200);
  await p.evaluate(() => { NX.open("notepad"); NX.open("calculator"); }); await wait(400);
  if (narrow) { await winKey("Tab"); await wait(200); } else { await p.click("#tb-tview"); await wait(300); }
  ok(await p.evaluate(() => !document.querySelector("#taskview").hidden && document.querySelectorAll("#taskview .tv-card").length === NX.wins.size), "Task View shows every open window");
  await shot("taskview");
  await p.evaluate(() => [...document.querySelectorAll("#taskview .tv-card")].find((c) => /Notepad/.test(c.innerText)).click()); await wait(250);
  ok(await p.evaluate(() => document.querySelector("#taskview").hidden && NX.topWin().id === "notepad"), "clicking a window in Task View switches to it");
  const mx = await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad] .wb-max").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (!narrow) { await p.mouse.move(mx.x, mx.y); await wait(900);
  ok(await p.evaluate(() => !document.querySelector("#snapfly").hidden && document.querySelectorAll("#snapfly .sf-lay").length === 4), "hovering over maximize shows snap layouts");
  await shot("snaplayouts");
  await p.evaluate(() => document.querySelectorAll("#snapfly .sf-lay")[3].querySelectorAll(".sf-zone")[3].click()); await wait(250);
  ok(await p.evaluate(() => { const r = document.querySelector(".win[data-app=notepad]").getBoundingClientRect(), A = document.querySelector("#windows").getBoundingClientRect(); return Math.abs(r.x - A.width / 2) < 3 && Math.abs(r.width - A.width / 2) < 3 && Math.abs(r.height - A.height / 2) < 3; }), "picking a zone snaps the window there (bottom-right quarter)"); }
  await p.evaluate(() => { NX.close("notepad"); NX.close("calculator"); }); await wait(300);
  if (narrow) { await winKey("KeyW"); await wait(400); } else { await p.click("#tb-widgets"); await wait(400); }
  ok(await p.evaluate(() => !document.querySelector("#widgets").hidden && /Weather/.test(document.querySelector("#widgets").innerText) && /Recent files/.test(document.querySelector("#widgets").innerText)), "Widgets opens with the weather and recent files");
  await p.keyboard.press("Escape"); await wait(200);
  await p.evaluate(async () => { await NX.fs.create(await NX.folder("Desktop"), "On my desktop.txt", false); NX.filesChanged(); }); await wait(500);
  ok(await p.evaluate(() => [...document.querySelectorAll("#icons .dicon.dfile")].some((d) => /On my desktop\.txt/.test(d.innerText))), "files in the Desktop folder show on the desktop");
  await shot("desktop-files");

  // ---------- 3.0: Settings like Windows 11, and web apps in the Store ----------
  await p.evaluate(() => NX.close("settings")); await wait(300);
  await p.evaluate(() => NX.open("settings")); await wait(400);
  ok(await p.evaluate(() => /Home/.test(document.querySelector(".win[data-app=settings] .s-main h1").textContent) && document.querySelectorAll(".win[data-app=settings] .s-hcard").length === 4), "Settings opens on Home, with your account, the PC, Wi-Fi and Bluetooth");
  await shot("settings-home");
  ok(await p.evaluate(() => ["Home", "System", "Bluetooth & devices", "Network & internet", "Personalization", "Apps", "Accounts", "Time & language", "Accessibility", "Privacy & security", "Nebulux Update"].every((n) => [...document.querySelectorAll(".win[data-app=settings] .s-nav span")].some((x) => x.textContent === n))), "the pages are the Windows 11 ones (with Nebulux Update)");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-p=system]").click()); await wait(250);
  await p.evaluate(() => [...document.querySelectorAll(".win[data-app=settings] .s-link")].find((b) => /About/.test(b.textContent)).click()); await wait(250);
  ok(await p.evaluate(() => /System.*About/.test(document.querySelector(".win[data-app=settings] .s-main h1").textContent) && /Device specifications/.test(document.querySelector(".win[data-app=settings]").innerText)), "About is inside System, with the path in the title");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-p=access]").click()); await wait(250);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=anim]").click()); await wait(150);
  ok(await p.evaluate(() => document.documentElement.classList.contains("noanim")), "Accessibility can turn animations off");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-pref=anim]").click()); await wait(150);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-p=privacy]").click()); await wait(250);
  await p.evaluate(() => document.querySelector("#s-clearrecent").click()); await wait(250);
  ok(await p.evaluate(() => NX.data("recent-files", []).length === 0), "Privacy & security clears recently opened files");
  await p.evaluate(() => NX.close("settings")); await wait(250);
  await p.evaluate(() => NX.open("store")); await wait(500);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=store] .st-row").length >= 8 && /Watch/.test(document.querySelector(".win[data-app=store]").innerText)), "the Store's Home has rows of apps (Watch, Listen, Chat and share...)");
  ok(await p.evaluate(() => ["netflix", "spotify", "whatsapp", "word", "excel", "discord", "xboxcloud", "chatgpt"].every((id) => NX.apps[id] && NX.apps[id].webapp)), "it has the big apps: Netflix, Spotify, WhatsApp, Word, Excel, Discord, Xbox Cloud Gaming, ChatGPT");
  await shot("store-home");
  await p.evaluate(() => document.querySelector('.win[data-app=store] .st-card[data-app=netflix]').click()); await wait(300);
  await p.evaluate(() => document.querySelector('.win[data-app=store] [data-get=netflix]').click());
  ok(await until(() => p.evaluate(() => NX.prefs().installed.includes("netflix")), 6000), "Get installs Netflix");
  ok(await p.evaluate(() => !!document.querySelector("#icons [data-app=netflix]")), "and it shows on the desktop");
  ok(await p.evaluate(() => { NX.close("store"); return true; })); await wait(300); await p.evaluate(() => NX.open("store")); await wait(500);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=store] .st-rowwrap .st-arrow.r").length >= 5), "every row of apps has arrow buttons");
  ok(await p.evaluate(() => ["steam", "minecraft", "vlc", "libreoffice", "gimp"].every((id) => NX.apps[id] && NX.apps[id].native)), "the Store has real apps too: Steam, Minecraft, VLC, LibreOffice, GIMP");
  await p.evaluate(() => NX.close("store")); await wait(200);

  // Start search: a details panel with Pin to taskbar (like Windows 11)
  await p.click("#tb-start"); await wait(300); await p.type("#start .sm-search input", "photos"); await wait(400);
  ok(await p.evaluate(() => /Pin to taskbar|Unpin from taskbar/.test((document.querySelector("#start .sm-detail") || {}).innerText || "")), "searching shows the app's details, with Pin to taskbar");
  const pinnedBefore = await p.evaluate(() => NX.prefs().pinned.includes("photos"));
  await p.evaluate(() => document.querySelector("#start .sm-detail [data-da=pin]").click()); await wait(300);
  ok(await p.evaluate((b) => NX.prefs().pinned.includes("photos") !== b && !!document.querySelector("#tb-apps [data-app=photos]") !== b, pinnedBefore), "Pin to taskbar in the search details puts it on the taskbar");
  await p.keyboard.press("Escape"); await wait(200);

  // Start search finds settings and files too
  await p.click("#tb-start"); await wait(300); await p.type("#start .sm-search input", "wallpaper"); await wait(500);
  ok(await p.evaluate(() => [...document.querySelectorAll("#start [data-spage]")].some((b) => b.dataset.spage === "personal")), "Start search finds settings (wallpaper: Personalization)");
  await p.evaluate(() => { const i = document.querySelector("#start .sm-search input"); i.value = ""; i.dispatchEvent(new Event("input")); }); await p.type("#start .sm-search input", "party"); await wait(800);
  ok(await p.evaluate(() => [...document.querySelectorAll("#start [data-sfile]")].some((b) => /Party plans.txt/.test(b.textContent))), "and files (party: Party plans.txt)");
  await p.keyboard.press("Escape"); await wait(200);

  // the battery: the bar goes down with the charge and changes color; Battery saver turns it yellow
  const setBatt = (percent, charging) => p.evaluate((percent, charging) => { NX.battery = { present: true, percent, charging }; document.dispatchEvent(new CustomEvent("nx:prefs", { detail: "battery" })); }, percent, charging);
  const bstate = () => p.evaluate(() => { const s = document.querySelector("#tb-tray .nx-batt"); return s ? { cls: s.getAttribute("class"), w: +s.querySelector(".nx-bfill").getAttribute("width"), t: document.querySelector("#tb-tray .tb-batt").title } : null; });
  await p.evaluate(() => { NX.setPref("saver", false); NX.setPref("saverAuto", true); });
  await setBatt(90, false); const b90 = await bstate();
  await setBatt(40, false); const b40 = await bstate();
  ok(b90 && b40 && b40.w < b90.w && /b-ok/.test(b40.cls) && /Battery 40%/.test(b40.t), "the battery bar goes down with the charge");
  await setBatt(40, true); ok(/b-charging/.test((await bstate()).cls), "it turns green while charging");
  await setBatt(9, false); ok(/b-critical/.test((await bstate()).cls) === false && /b-saver/.test((await bstate()).cls), "at 20% or less Battery saver turns on by itself, and the bar turns yellow");
  ok(await p.evaluate(() => document.documentElement.classList.contains("saver") && document.documentElement.classList.contains("noanim")), "Battery saver turns off effects and animations");
  await p.evaluate(() => NX.setPref("saver", false)); await wait(100);
  ok(/b-critical/.test((await bstate()).cls) && await p.evaluate(() => NX.prefs().saverAuto === false), "turning it off by hand keeps it off, and the bar is red at 10% or less");
  await setBatt(18, false); ok(/b-low/.test((await bstate()).cls), "orange at 20% or less");
  await setBatt(60, false); await p.click("#tb-tray"); await wait(300);
  ok(await p.evaluate(() => !!document.querySelector("#qs [data-k=saver]") && !document.querySelector("#qs [data-k=saver]").classList.contains("on")), "quick settings has Battery saver");
  await p.evaluate(() => document.querySelector("#qs [data-k=saver]").click()); await wait(200);
  ok(/b-saver/.test((await bstate()).cls) && await p.evaluate(() => document.querySelector("#qs [data-k=saver]").classList.contains("on")), "turning it on turns the battery bar yellow");
  await p.keyboard.press("Escape"); await wait(200);
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  ok(/Power & battery/.test(await txt(".win[data-app=settings]")) && /Battery saver is on/.test(await txt(".win[data-app=settings]")), "Settings > System shows the battery and Battery saver");
  await p.evaluate(() => { NX.close("settings"); NX.setPref("saver", false); NX.setPref("saverAuto", true); }); await setBatt(100, false); await wait(300);

  // 3.2: clipboard history (Nebulux + V)
  await p.evaluate(() => { NX.setData("clip-history", []); NX.open("notepad"); }); await wait(500);
  const npSel = ".win[data-app=notepad] textarea";
  await p.evaluate((s) => { const ta = document.querySelector(s); ta.value = ""; ta.focus(); }, npSel);
  await p.type(npSel, "hello nebula");
  await p.evaluate((s) => { const ta = document.querySelector(s); ta.focus(); ta.select(); document.dispatchEvent(new ClipboardEvent("copy", { bubbles: true })); }, npSel); await wait(200);
  await p.evaluate((s) => { const ta = document.querySelector(s); ta.value = "second copy"; ta.select(); document.dispatchEvent(new ClipboardEvent("copy", { bubbles: true })); }, npSel); await wait(200);
  ok(await p.evaluate(() => NX.clip.list().map((x) => x.t).join("|") === "second copy|hello nebula"), "copied text goes into clipboard history, newest first");
  await p.evaluate((s) => { const ta = document.querySelector(s); ta.value = ""; ta.focus(); }, npSel);
  await p.keyboard.down("Meta"); await p.keyboard.press("v"); await p.keyboard.up("Meta"); await wait(300);
  ok(await p.evaluate(() => !document.querySelector("#clip").hidden && document.querySelectorAll("#clip .cl-item").length === 2), "Nebulux + V opens clipboard history");
  await p.evaluate(() => document.querySelector("#clip [data-pin=\"1\"]").click()); await wait(150);
  ok(await p.evaluate(() => NX.clip.list()[0].pin && NX.clip.list()[0].t === "hello nebula"), "pinning moves an item to the top and keeps it");
  await p.evaluate(() => document.querySelector("#clip .cl-item[data-i=\"0\"]").click()); await wait(300);
  ok(await p.evaluate((s) => document.querySelector(s).value === "hello nebula" && document.querySelector("#clip").hidden, npSel), "clicking an item pastes it where you were typing");
  await p.keyboard.down("Meta"); await p.keyboard.press("v"); await p.keyboard.up("Meta"); await wait(300);
  await p.evaluate(() => document.querySelector("#clip .cl-clear").click()); await wait(150);
  ok(await p.evaluate(() => NX.clip.list().length === 1 && NX.clip.list()[0].pin), "Clear all keeps pinned items");
  await p.keyboard.press("Escape"); await wait(150);
  await p.evaluate(() => NX.setPref("cliphist", false));
  await p.evaluate((s) => { const ta = document.querySelector(s); ta.value = "secret"; ta.focus(); ta.select(); document.dispatchEvent(new ClipboardEvent("copy", { bubbles: true })); }, npSel); await wait(200);
  ok(await p.evaluate(() => !NX.clip.list().some((x) => x.t === "secret")), "with clipboard history off, nothing is kept");
  await p.evaluate(() => { NX.setPref("cliphist", true); NX.close("notepad"); }); await wait(300);

  // 3.2: Sticky Notes
  await p.evaluate(() => { NX.setData("sticky-notes", []); NX.open("notes"); }); await wait(500);
  ok(await p.evaluate(() => /No notes yet/.test(document.querySelector(".win[data-app=notes]").innerText)), "Sticky Notes opens empty");
  await p.click(".win[data-app=notes] [data-a=new]"); await wait(200);
  await p.keyboard.type("Buy milk");
  await p.click(".win[data-app=notes] [data-a=new]"); await wait(200);
  await p.keyboard.type("Call Sam");
  await wait(500);
  ok(await p.evaluate(() => NX.data("sticky-notes", []).map((n) => n.t).join("|") === "Call Sam|Buy milk"), "new notes save as you type, newest first");
  await p.evaluate(() => document.querySelector(".win[data-app=notes] .sn-note:last-child [data-c=sky]").click()); await wait(400);
  ok(await p.evaluate(() => NX.data("sticky-notes", []).find((n) => n.t === "Buy milk").c === "sky" && !!document.querySelector(".win[data-app=notes] .sn-note.c-sky")), "a note changes color");
  await p.type(".win[data-app=notes] .sn-q", "milk"); await wait(200);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=notes] .sn-note").length === 1), "search finds notes");
  await p.evaluate(() => { const q = document.querySelector(".win[data-app=notes] .sn-q"); q.value = ""; q.dispatchEvent(new Event("input")); });
  await p.evaluate(() => document.querySelector(".win[data-app=notes] .sn-note .sn-del").click()); await wait(400);
  ok(await p.evaluate(() => NX.data("sticky-notes", []).length === 1 && !document.querySelector(".win[data-app=notes] .sn-undo").hidden), "deleting a note offers Undo");
  await p.click(".win[data-app=notes] [data-a=undo]"); await wait(400);
  ok(await p.evaluate(() => NX.data("sticky-notes", []).length === 2), "Undo brings it back");
  await p.evaluate(() => NX.close("notes")); await wait(300);

  // 3.2: night light on a schedule
  ok(await p.evaluate(() => { const H = NX.shell.nightHours, at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; }; return H("21:00", "07:00", at(23, 0)) && H("21:00", "07:00", at(6, 59)) && !H("21:00", "07:00", at(7, 0)) && !H("21:00", "07:00", at(12, 0)) && H("13:00", "14:00", at(13, 30)); }), "night light hours work, also past midnight");
  await p.evaluate(() => { const d = new Date(), f = (n) => String(n).padStart(2, "0"), a = new Date(d - 3600000), b = new Date(+d + 3600000); NX.setPref("night", false); NX.setPref("nightFrom", f(a.getHours()) + ":" + f(a.getMinutes())); NX.setPref("nightTo", f(b.getHours()) + ":" + f(b.getMinutes())); NX.setPref("nightSched", true); }); await wait(300);
  ok(await p.evaluate(() => NX.prefs().night === true && document.querySelector("#night").classList.contains("on")), "inside the scheduled hours, night light turns on by itself");
  await p.evaluate(() => NX.open("settings", { page: "system" })); await wait(400);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=settings] [data-time]").length === 2), "Settings shows the night light hours");
  await p.evaluate(() => { NX.close("settings"); NX.setPref("nightSched", false); NX.setPref("night", false); }); await wait(300);

  // 3.2: virtual desktops
  const vis = (id) => p.evaluate((id) => { const w = document.querySelector(".win[data-app=" + id + "]"); return !!w && getComputedStyle(w).display !== "none"; }, id);
  const onBar = (id) => p.evaluate((id) => !!document.querySelector("#tb-apps [data-app=" + id + "].run, #tb-apps [data-app=" + id + "].on, #tb-apps [data-app=" + id + "][data-run]") || [...document.querySelectorAll("#tb-apps [data-app=" + id + "]")].some((b) => /run|open|active/.test(b.className)), id);
  await p.evaluate(() => { NX.closeAll(); NX.open("notepad"); }); await wait(400);
  await p.keyboard.down("Control"); await p.keyboard.down("Meta"); await p.keyboard.press("d"); await p.keyboard.up("Meta"); await p.keyboard.up("Control"); await wait(400);
  ok(await p.evaluate(() => NX.desks.list().length === 2 && NX.desks.list()[1].current), "Ctrl + Nebulux + D adds a desktop and goes to it");
  ok(!(await vis("notepad")), "the new desktop starts empty: Notepad stays on Desktop 1");
  await p.evaluate(() => NX.open("calculator")); await wait(400);
  await p.keyboard.down("Control"); await p.keyboard.down("Meta"); await p.keyboard.press("ArrowLeft"); await p.keyboard.up("Meta"); await p.keyboard.up("Control"); await wait(400);
  ok(await vis("notepad") && !(await vis("calculator")) && await p.evaluate(() => NX.desks.list()[0].current), "Ctrl + Nebulux + Left goes back: Notepad shows, Calculator stays on Desktop 2");
  ok(await p.evaluate(() => ![...document.querySelectorAll("#tb-apps [data-app=calculator]")].length), "the taskbar shows only this desktop's windows");
  await p.evaluate(() => NX.focus("calculator")); await wait(400);
  ok(await vis("calculator") && await p.evaluate(() => NX.desks.list()[1].current), "bringing up a window on another desktop goes there");
  await p.evaluate(() => NX.taskView()); await wait(400);
  ok(await p.evaluate(() => document.querySelectorAll("#taskview .tv-dk").length === 2 && !!document.querySelector("#taskview .tv-dkadd")), "Task View shows the desktops and New desktop");
  await p.evaluate(() => document.querySelector("#taskview .tv-dk:first-child").click()); await wait(400);
  ok(await p.evaluate(() => NX.desks.list()[0].current && !document.querySelector("#taskview").hidden), "clicking a desktop in Task View switches to it");
  await p.evaluate(() => { document.querySelector("#taskview").hidden = true; NX.desks.move("calculator", NX.desks.list()[0].id); }); await wait(300);
  ok(await vis("calculator") && await vis("notepad"), "a window can move to another desktop");
  await p.evaluate(() => { NX.desks.rename(NX.desks.list()[1].id, "School"); NX.desks.go(NX.desks.list()[1].id); }); await wait(300);
  ok(await p.evaluate(() => NX.desks.list()[1].name === "School" && /School/.test(document.querySelector("#deskflash").textContent)), "desktops can be renamed, and switching shows its name");
  await p.keyboard.down("Control"); await p.keyboard.down("Meta"); await p.keyboard.press("F4"); await p.keyboard.up("Meta"); await p.keyboard.up("Control"); await wait(400);
  ok(await p.evaluate(() => NX.desks.list().length === 1) && await vis("notepad") && await vis("calculator"), "Ctrl + Nebulux + F4 closes a desktop; its windows move over");
  await p.evaluate(() => NX.closeAll()); await wait(300);

  // 3.2: Widgets show Sticky Notes and the battery
  await p.evaluate(() => { NX.setData("sticky-notes", [{ id: "w1", t: "Widget note", c: "mint", at: Date.now() }]); NX.battery = { present: true, percent: 64, charging: false }; NX.widgets(); }); await wait(700);
  ok(await p.evaluate(() => /Widget note/.test(document.querySelector("#widgets").innerText) && /64%/.test(document.querySelector("#widgets .wg-batt").innerText)), "Widgets show your Sticky Notes and the battery");
  await p.evaluate(() => document.querySelector("#widgets [data-note=w1]").click()); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=notes]") && document.querySelector("#widgets").hidden), "a note in Widgets opens Sticky Notes");
  await p.evaluate(() => { NX.close("notes"); NX.battery = { present: true, percent: 100, charging: false }; }); await wait(300);

  // 3.2: the lock screen shows the network and the battery
  await p.evaluate(() => { NX.battery = { present: true, percent: 47, charging: false }; NX.shell.lockKeep(); }); await wait(1300);
  ok(await p.evaluate(() => /47%/.test(document.querySelector("#lk-status").textContent) && !!document.querySelector("#lk-status .nx-batt")), "the lock screen shows the network and the battery");
  await p.mouse.click(W / 2, H / 2); await wait(400); await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter"); await wait(1300);
  await p.evaluate(() => { NX.battery = { present: true, percent: 100, charging: false }; });

  // 3.2: File Explorer tabs
  await p.evaluate(() => { NX.closeAll(); NX.open("files", { place: "Documents" }); }); await wait(700);
  const tabsOf = () => p.evaluate(() => NX.wins.get("files").tabs.list());
  ok((await tabsOf()).length === 1 && (await tabsOf())[0].name === "Documents", "File Explorer starts with one tab");
  await p.focus(".win[data-app=files] .fx-list"); await p.keyboard.down("Control"); await p.keyboard.press("t"); await p.keyboard.up("Control"); await wait(600);
  ok((await tabsOf()).length === 2 && (await tabsOf())[1].on && (await tabsOf())[1].name === "Home", "Ctrl + T opens a new tab at Home");
  await p.evaluate(() => document.querySelector(".win[data-app=files] .fx-tab[data-tab=\"0\"]").click()); await wait(600);
  ok((await tabsOf())[0].on && /Party plans/.test(await txt(".win[data-app=files] .fx-list")), "clicking a tab goes back to its folder");
  await p.evaluate(() => NX.wins.get("files").tabs.add()); await wait(500);
  await p.evaluate(() => document.querySelector(".win[data-app=files] .fx-tabx[data-tabx=\"2\"]").click()); await wait(500);
  ok((await tabsOf()).length === 2, "a tab closes with its x");
  await p.focus(".win[data-app=files] .fx-list"); await p.keyboard.down("Control"); await p.keyboard.press("w"); await p.keyboard.up("Control"); await wait(500);
  ok((await tabsOf()).length === 1 && await p.evaluate(() => !!NX.wins.get("files")), "Ctrl + W closes the tab you're on");
  await p.evaluate(() => NX.close("files")); await wait(300);

  // 3.2: Get Started
  await p.evaluate(() => NX.open("tips")); await wait(500);
  ok(await p.evaluate(() => /Welcome to Nebulux OS/.test(document.querySelector(".win[data-app=tips]").innerText)), "Get Started opens with a welcome");
  await p.evaluate(() => document.querySelector(".win[data-app=tips] .gs-hero [data-p=basics]").click()); await wait(200);
  await p.evaluate(() => document.querySelector(".win[data-app=tips] .gs-foot [data-p=keys]").click()); await wait(200);
  ok(await p.evaluate(() => document.querySelectorAll(".win[data-app=tips] .gs-keys kbd").length > 20 && /Clipboard history/.test(document.querySelector(".win[data-app=tips]").innerText)), "it lists the shortcuts");
  await p.evaluate(() => document.querySelector(".win[data-app=tips] .gs-nav [data-p=more]").click()); await wait(200);
  await p.evaluate(() => document.querySelector(".win[data-app=tips] [data-go=personal]").click()); await wait(500);
  ok(await p.evaluate(() => !!document.querySelector(".win[data-app=settings]") && /Personalization|Background/.test(document.querySelector(".win[data-app=settings]").innerText)), "its buttons open the right place");
  await p.evaluate(() => { NX.close("settings"); NX.close("tips"); }); await wait(300);

  // 3.2: Focus sessions in Clock
  await p.evaluate(() => { NX.setPref("dnd", false); NX.open("clock"); }); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-v=fo]").click()); await wait(200);
  await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-a=fo25]").click()); await wait(300);
  ok(await p.evaluate(() => NX.focusSession.on() && NX.prefs().dnd === true && !!document.querySelector(".win[data-app=clock] .clk-ring")), "a focus session starts and turns on Do not disturb");
  await p.evaluate(() => NX.close("clock")); await wait(300);
  ok(await p.evaluate(() => NX.focusSession.on()), "it keeps going with Clock closed");
  await p.evaluate(() => NX.focusSession.finish(true)); await wait(200);
  ok(await p.evaluate(() => !NX.focusSession.on() && NX.prefs().dnd === false && NX.focusSession.today() === 1), "when it's done, Do not disturb goes back and the session counts");
  await p.evaluate(() => { NX.open("clock"); }); await wait(300); await p.evaluate(() => document.querySelector(".win[data-app=clock] [data-v=fo]").click()); await wait(200);
  ok(await p.evaluate(() => /1 session today/.test(document.querySelector(".win[data-app=clock]").innerText)), "Clock shows today's focus sessions");
  await p.evaluate(() => NX.close("clock")); await wait(300);

  // 3.2: color filters, Show desktop, Settings search
  await p.evaluate(() => NX.open("settings", { page: "access" })); await wait(400);
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-cf=gray]").click()); await wait(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains("cf-gray") && getComputedStyle(document.body).filter.includes("grayscale")), "Color filters turn the screen grayscale");
  await p.evaluate(() => document.querySelector(".win[data-app=settings] [data-cf=none]").click()); await wait(200);
  ok(await p.evaluate(() => !document.documentElement.classList.contains("cf-gray")), "and back");
  await p.click("#tb-showdesk"); await wait(300);
  ok(await p.evaluate(() => NX.wins.get("settings").min), "the corner of the taskbar shows the desktop");
  await p.click("#tb-showdesk"); await wait(300);
  ok(await p.evaluate(() => !NX.wins.get("settings").min), "and a second click brings the windows back");
  await p.evaluate(() => NX.close("settings")); await wait(300);
  await p.click("#tb-start"); await wait(300); await p.type("#start .sm-search input", "clipboard"); await wait(400);
  ok(await p.evaluate(() => [...document.querySelectorAll("#start [data-spage]")].some((b) => b.dataset.spage === "system")), "Start search finds new settings (clipboard: System)");
  await p.keyboard.press("Escape"); await wait(200);

  // 3.2: Photos slideshow
  await p.evaluate(() => NX.open("photos")); await wait(800);
  await p.evaluate(() => document.querySelector(".win[data-app=photos] [data-p=slide]").click()); await wait(800);
  ok(await p.evaluate(() => NX.wins.get("photos").slideshow.on() && document.querySelector(".win[data-app=photos] .ph").classList.contains("ph-show")), "Photos slideshow starts");
  await p.keyboard.press("Escape"); await wait(300);
  ok(await p.evaluate(() => !NX.wins.get("photos").slideshow.on() && !document.querySelector(".win[data-app=photos] .ph").classList.contains("ph-show")), "Esc stops the slideshow");
  await p.evaluate(() => NX.close("photos")); await wait(300);

  // 3.2: Calculator history
  await p.evaluate(() => { NX.setData("calc-history", []); NX.open("calculator"); }); await wait(400);
  await p.evaluate(() => { const k = (x) => document.querySelector(".win[data-app=calculator] [data-k=\"" + x + "\"]").click(); ["1", "2", "+", "3", "0", "="].forEach(k); ["c", "7", "*", "6", "="].forEach(k); }); await wait(200);
  await p.evaluate(() => document.querySelector(".win[data-app=calculator] .c-hbtn").click()); await wait(200);
  ok(await p.evaluate(() => { const H = [...document.querySelectorAll(".win[data-app=calculator] .c-hi b")].map((b) => b.textContent); return H.join(",") === "42,42"; }), "Calculator keeps a history of answers");
  await p.evaluate(() => document.querySelector(".win[data-app=calculator] .c-hi[data-h=\"1\"]").click()); await wait(200);
  ok(await p.evaluate(() => document.querySelector(".win[data-app=calculator] .c-val").textContent === "42" && document.querySelector(".win[data-app=calculator] .c-expr").textContent.includes("12 + 30")), "clicking an answer in History uses it again");
  await p.evaluate(() => NX.close("calculator")); await wait(300);

  // Sleep, then wake with a key
  await p.click("#tb-start"); await wait(300); await p.click("#start .sm-pwb"); await wait(150); await p.click("#start [data-pw=sleep]"); await wait(700);
  ok(await p.evaluate(() => !document.querySelector("#off").hidden && document.querySelector("#off").classList.contains("sleeping")), "Sleep turns the screen dark");
  await p.keyboard.press("Space"); await wait(400);
  ok(await p.evaluate(() => document.querySelector("#off").hidden && !document.querySelector("#lock").hidden), "a key wakes it to the lock screen");

  // adding a second account goes through setup too, and Cancel goes back to sign-in
  await p.evaluate(() => NX.shell.signOut()); await wait(600);
  await p.evaluate(() => document.querySelector("#lock [data-a=add]").click()); await wait(400);
  ok(await p.evaluate(() => !document.querySelector("#oobe").hidden && /Add an account/.test(document.querySelector("#oobe h1").textContent)), "Add account opens setup for the new account");
  await p.click("#oobe .ob-cancel"); await wait(300);
  ok(await p.evaluate(() => document.querySelector("#oobe").hidden && !document.querySelector("#lock").hidden), "Cancel goes back to the sign-in screen");

  // everything is still there after signing out and back in
  await p.evaluate(() => NX.shell.signOut()); await wait(600);
  await p.mouse.click(W / 2, H / 2); await wait(400); await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter"); await wait(1300);
  ok(await p.evaluate(async () => (await NX.fs.list("/Documents")).entries.map((e) => e.name).join(",") === "Groceries.txt,Party plans.txt,Welcome.txt"), "your files are still there after signing in again");
  ok(errs.length === 0, "no page errors " + errs.join(" | "));
  await c.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
