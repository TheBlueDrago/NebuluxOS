// Nebulux OS runs full screen with no browser tabs showing. A page that opens a new tab or window (a link with
// target=_blank, window.open) would cover the OS with no way back, so every new tab is closed at once and its address
// opens in a Nebulux OS window instead. If the OS tab itself is ever sent to another site, it comes back to the OS.
"use strict";
const OS = "http://127.0.0.1:7777/";
const isOS = (u) => typeof u === "string" && (u.startsWith(OS) || u.startsWith("http://localhost:7777/"));
const blank = (u) => !u || u === "about:blank" || u.startsWith("chrome://newtab") || u.startsWith("chrome://new-tab-page");
const waiting = new Set();

async function osTab(exceptId) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((t) => t.id !== exceptId && isOS(t.url || t.pendingUrl));
}
async function route(tabId, url) {
  const home = await osTab(tabId);
  if (!home) return; // no OS tab: leave the browser alone
  try { await chrome.tabs.remove(tabId); } catch (e) { /* already closed */ }
  await chrome.tabs.update(home.id, { active: true });
  if (/^https?:/i.test(url)) chrome.tabs.sendMessage(home.id, { nx: "open", url }).catch(() => {});
}
chrome.tabs.onCreated.addListener((tab) => {
  const u = tab.pendingUrl || tab.url;
  if (isOS(u)) return;
  if (blank(u)) { waiting.add(tab.id); setTimeout(() => waiting.delete(tab.id), 15000); return; }
  route(tab.id, u);
});
chrome.tabs.onUpdated.addListener(async (id, info) => {
  if (!info.url) return;
  if (waiting.has(id)) { if (blank(info.url)) return; waiting.delete(id); if (!isOS(info.url)) route(id, info.url); return; }
  // the OS tab left the OS (it shouldn't, but never leave someone stuck on another site)
  if (!isOS(info.url) && !blank(info.url) && !info.url.startsWith("chrome")) {
    const other = await osTab(id);
    if (!other) { const tabs = await chrome.tabs.query({}); if (tabs.length === 1) chrome.tabs.update(id, { url: OS }); }
  }
});
