// Builds the Nebulux OS website into site/public:
//   - every page in site/pages gets the shared header and footer
//   - What's new comes from the OS's own list (js/whatsnew.js), so the site and the OS always agree
//   - /try/ is Nebulux OS itself, running in the browser (copied from the repo)
//   - release.json: the version, size and fingerprint shown before GitHub answers
// Run: node site/build.cjs
"use strict";
const fs = require("fs"), path = require("path");
const SITE = __dirname, REPO = path.join(SITE, ".."), PUB = path.join(SITE, "public");

global.NX = {}; require(path.join(REPO, "js", "whatsnew.js"));
const VERSION = NX.version, NEWS = NX.whatsNew, BEFORE = NX.whatsNewBefore || [];
const REL = { version: VERSION, file: "Nebulux-OS-" + VERSION + ".iso", size: 1249689600, sha256: "3c79be28cd9bf5481fb401026481523c32380d0f4b48ea4f79771f8cd199daf8" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// line icons (no emojis)
const I = {
  usb: '<path d="M9 2h6v6H9z"/><path d="M7 8h10v9a5 5 0 0 1-10 0z"/><path d="M12 17v5"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9"/><path d="M3 3v6h6"/><path d="M4 13a8 8 0 0 0 14.6 4.5L21 15"/><path d="M21 21v-6h-6"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>',
  bt: '<path d="M7 7l10 10-5 5V2l5 5L7 17"/>',
  tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  key: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/><path d="M5 10h7v4H5z" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M15 6.5h.01M18 6.5h.01"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z"/>',
};
const icon = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const NAV = [["/", "Home"], ["/features", "Features"], ["/#compare", "Compare"], ["/whats-new", "What's new"], ["/download", "Download"], ["/help", "Help"]];

function layout(file, title, desc, body) {
  const here = "/" + file.replace(/\.html$/, "").replace(/^index$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#05030c">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="/shots/desktop.jpg">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/nebulux-64.png">
<link rel="stylesheet" href="/css/site.css">
</head>
<body>
<div class="sky" aria-hidden="true"></div>
<header class="nav"><div class="wrap">
  <a class="brand" href="/"><img src="/img/nebulux-64.png" alt="">Nebulux OS</a>
  <button class="menu" aria-label="Menu" aria-expanded="false">${icon("menu", 24)}</button>
  <nav class="links">${NAV.map(([h, t]) => `<a href="${h}"${h === here ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
  <a class="btn primary" href="/download">${icon("download", 18)}Download</a>
</div></header>
<main>
${body}
</main>
<footer><div class="wrap">
  <div><a class="brand" href="/"><img src="/img/nebulux-64.png" alt="">Nebulux OS</a><div>A whole computer on a USB stick.</div><div style="margin-top:14px">&copy; ${new Date().getFullYear()} Nebulux LLC. All rights reserved.</div></div>
  <nav>
    <div><b>Nebulux OS</b><a href="/features">Features</a><a href="/whats-new">What's new</a><a href="/try/" target="_blank" rel="noopener">Try it in your browser</a></div>
    <div><b>Get it</b><a href="/download">Download</a><a href="/download#install">Install guide</a><a href="/help">Help</a></div>
    <div><b>Nebulux LLC</b><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="https://nebuluxai.com">Nebulux AI</a></div>
  </nav>
</div></footer>
<script src="/js/site.js" defer></script>
</body>
</html>
`;
}

const fill = (s) => s
  .replace(/\{\{icon:(\w+)(?::(\d+))?\}\}/g, (_, n, sz) => icon(n, sz && +sz))
  .replace(/\{\{version\}\}/g, VERSION)
  .replace(/\{\{file\}\}/g, REL.file)
  .replace(/\{\{size\}\}/g, (REL.size / 1e9).toFixed(1) + " GB")
  .replace(/\{\{sha\}\}/g, REL.sha256)
  .replace(/\{\{news\}\}/g, NEWS.map((w) => `<div class="card rise"><h4>${esc(w[0])}</h4><p>${esc(w[1])}</p></div>`).join("\n"))
  .replace(/\{\{newsold\}\}/g, BEFORE.map((w) => `<div class="card rise"><h4>${esc(w[0])}</h4><p>${esc(w[1])}</p></div>`).join("\n"))
  .replace(/\{\{newstitles\}\}/g, NEWS.slice(0, 6).map((w) => `<li>${esc(w[0])}</li>`).join(""));

for (const f of fs.readdirSync(path.join(SITE, "pages"))) {
  if (!f.endsWith(".html")) continue;
  const src = fs.readFileSync(path.join(SITE, "pages", f), "utf8");
  const m = src.match(/^<!--\s*title:\s*(.+?)\s*\|\s*(.+?)\s*-->\n?/);
  if (!m) throw new Error(f + ": the first line needs <!-- title: ... | description -->");
  fs.writeFileSync(path.join(PUB, f), layout(f, m[1], m[2], fill(src.slice(m[0].length))));
  console.log("page", f);
}
fs.writeFileSync(path.join(PUB, "release.json"), JSON.stringify(REL));

// Nebulux OS itself at /try/
const TRY = path.join(PUB, "try");
fs.rmSync(TRY, { recursive: true, force: true });
fs.mkdirSync(TRY, { recursive: true });
fs.copyFileSync(path.join(REPO, "index.html"), path.join(TRY, "index.html"));
for (const d of ["css", "js", "img"]) fs.cpSync(path.join(REPO, d), path.join(TRY, d), { recursive: true });
console.log("try: Nebulux OS " + VERSION + " copied");

// no emojis anywhere on the site (owner rule)
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/u;
for (const f of fs.readdirSync(PUB)) if (/\.(html|css|js|json)$/.test(f) && EMOJI.test(fs.readFileSync(path.join(PUB, f), "utf8"))) throw new Error("emoji found in " + f);
console.log("ok");
