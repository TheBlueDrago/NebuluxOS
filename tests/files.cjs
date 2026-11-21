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
  await p.mouse.click(W / 2, H / 2); await wait(400);
  await p.type("#lk-panel input[name=n]", "Ada"); await p.type("#lk-panel input[name=p]", "nebula1"); await p.type("#lk-panel input[name=p2]", "nebula1");
  await p.click("#lk-panel button[type=submit]"); await wait(1400);
  ok(await p.evaluate(() => !!document.querySelector("#tb-apps [data-app=files]") && !!document.querySelector("#icons [data-app=files]")), "File Explorer is on the taskbar and the desktop");

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
  await p.evaluate(() => NX.open("paint")); await wait(500);
  const cv = await p.evaluate(() => { const r = document.querySelector(".win[data-app=paint] canvas").getBoundingClientRect(); return { x: r.x + 60, y: r.y + 60 }; });
  await p.mouse.move(cv.x, cv.y); await p.mouse.down(); await p.mouse.move(cv.x + 120, cv.y + 40, { steps: 6 }); await p.mouse.up();
  await p.click(".win[data-app=paint] [data-t=save]"); await wait(900);
  ok(await p.evaluate(async () => (await NX.fs.list("/Pictures")).entries.some((e) => e.name === "Painting.png")), "Paint saves the picture in Pictures");
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
  ok(/Windows \+ Shift \+ S/.test(await txt(".win[data-app=snip]")), "Snipping Tool opens");
  await p.evaluate(() => NX.close("snip")); await wait(200);

  // everything is still there after signing out and back in
  await p.evaluate(() => NX.shell.signOut()); await wait(600);
  await p.mouse.click(W / 2, H / 2); await wait(400); await p.type("#lk-panel input[name=p]", "nebula1"); await p.keyboard.press("Enter"); await wait(1300);
  ok(await p.evaluate(async () => (await NX.fs.list("/Documents")).entries.map((e) => e.name).join(",") === "Groceries.txt,Party plans.txt,Welcome.txt"), "your files are still there after signing in again");
  ok(errs.length === 0, "no page errors " + errs.join(" | "));
  await c.close(); b.disconnect();
  console.log(failed ? failed + " failed" : "all passed"); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
