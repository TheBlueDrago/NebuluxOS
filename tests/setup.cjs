// Goes through first-time setup like a person would: region, keyboard, (network), name, password, privacy, look.
// Used by the other tests. checks(true) also tries a too-short and a mismatched password first.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = async function setup(p, name, pw, ok, hooks) {
  const step = () => p.evaluate(() => (document.querySelector("#oobe h1") || {}).textContent || "");
  const next = async () => { await p.click("#oobe .ob-next"); await wait(250); };
  await p.waitForSelector("#oobe:not([hidden]) .ob-next", { timeout: 10000 });
  if (ok) ok(/Who's going to use|Add an account/.test(await step()), "setup starts by making your account: your name");
  await p.type("#oobe input[name=n]", name); await next();
  if (ok) {
    await p.type("#oobe input[name=p]", pw); await p.type("#oobe input[name=p2]", pw + "x"); await next();
    ok(/don't match/.test(await p.evaluate(() => document.querySelector("#oobe .ob-err").textContent)), "setup refuses passwords that don't match");
    await p.evaluate(() => { document.querySelector("#oobe input[name=p]").value = ""; document.querySelector("#oobe input[name=p2]").value = ""; });
  }
  await p.type("#oobe input[name=p]", pw); await p.type("#oobe input[name=p2]", pw); await next();
  if (ok) ok(/right country or region/.test(await step()), "then your country or region");
  await next();
  if (ok) ok(/right keyboard layout/.test(await step()), "then your keyboard layout");
  await next();
  if (/connect you to a network/.test(await step())) { if (ok) ok(true, "then the network"); if (hooks && hooks.network) await hooks.network(); await next(); }
  if (/Sign in with Google/.test(await step())) await next();
  if (ok) ok(/privacy settings/.test(await step()), "then privacy settings");
  await next();
  if (ok) ok(/Pick your look/.test(await step()) && await p.evaluate(() => document.querySelectorAll("#oobe [data-look]").length >= 7 && document.querySelector("#oobe [data-look=\"0\"]").classList.contains("on")), "then your look: Classic and the six themes");
  await next();
  await p.waitForFunction(() => !document.querySelector("#desktop").hidden && document.querySelector("#oobe").hidden, { timeout: 15000 });
  await wait(400);
};
