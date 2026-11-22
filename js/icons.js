// Nebulux OS icons: original SVGs in the Nebulux look (nebula gradients, soft glow). NX.icon(name, size).
"use strict";
(function () {
  let gid = 0;
  const grad = (a, b, c) => { const id = "g" + ++gid; return [id, `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` : `<stop offset="1" stop-color="${b}"/>`}</linearGradient></defs>`]; };
  const tile = (a, b, c, inner) => { const [id, d] = grad(a, b, c); return `${d}<rect x="2" y="2" width="44" height="44" rx="11" fill="url(#${id})"/>${inner}`; };
  const W = "#fff";
  const I = {
    // the Nebulux mark: a planet with an orbit ring and a small moon
    // the Nebulux logo: the Nebulux nebula (the same picture as nebuluxai.com)
    logo: () => { const id = "nl" + ++gid; return `<defs><clipPath id="${id}"><rect x="2" y="2" width="44" height="44" rx="12"/></clipPath></defs><image href="img/nebulux-128.png" x="2" y="2" width="44" height="44" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`; },
    settings: () => tile("#64748b", "#334155", null, `<g fill="none" stroke="${W}" stroke-width="3"><circle cx="24" cy="24" r="6"/><path d="M24 9v5M24 34v5M9 24h5M34 24h5M13.4 13.4l3.5 3.5M31.1 31.1l3.5 3.5M13.4 34.6l3.5-3.5M31.1 16.9l3.5-3.5" stroke-linecap="round"/></g>`),
    // Google keeps its own look: the four-color G on white
    google: () => `<rect x="2" y="2" width="44" height="44" rx="11" fill="#fff"/><g fill="none" stroke-width="6"><path d="M33.5 17.5A12 12 0 0 0 13 18" stroke="#ea4335"/><path d="M13 18a12 12 0 0 0 0 12" stroke="#fbbc05"/><path d="M13 30a12 12 0 0 0 20.5 1.5" stroke="#34a853"/><path d="M33.5 31.5A12 12 0 0 0 36 24H24" stroke="#4285f4"/></g>`,
    store: () => tile("#f472b6", "#a855f7", "#6366f1", `<path d="M14 18h20l-2 18H16z" fill="${W}"/><path d="M19 18v-3a5 5 0 0110 0v3" fill="none" stroke="${W}" stroke-width="3"/><circle cx="24" cy="27" r="3" fill="#a855f7"/>`),
    notepad: () => tile("#38bdf8", "#2563eb", null, `<rect x="13" y="11" width="22" height="27" rx="3" fill="${W}"/><path d="M17 19h14M17 24h14M17 29h9" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>`),
    calculator: () => tile("#34d399", "#0f766e", null, `<rect x="14" y="10" width="20" height="28" rx="4" fill="${W}"/><rect x="17" y="13" width="14" height="6" rx="1.5" fill="#0f766e"/><g fill="#0f766e"><circle cx="19" cy="24" r="1.8"/><circle cx="24" cy="24" r="1.8"/><circle cx="29" cy="24" r="1.8"/><circle cx="19" cy="29" r="1.8"/><circle cx="24" cy="29" r="1.8"/><circle cx="29" cy="29" r="1.8"/><circle cx="19" cy="34" r="1.8"/><circle cx="24" cy="34" r="1.8"/><circle cx="29" cy="34" r="1.8"/></g>`),
    paint: () => tile("#fb923c", "#e11d48", null, `<path d="M24 11c-8 0-14 6-14 13 0 5 4 7 7 6 2-1 2 3 5 4 8 2 15-4 15-11 0-7-5-12-13-12z" fill="${W}"/><circle cx="18" cy="21" r="2.2" fill="#e11d48"/><circle cx="24" cy="17" r="2.2" fill="#f59e0b"/><circle cx="30" cy="20" r="2.2" fill="#22c55e"/><circle cx="30" cy="27" r="2.2" fill="#3b82f6"/>`),
    clock: () => tile("#a78bfa", "#4c1d95", null, `<circle cx="24" cy="24" r="12" fill="${W}"/><path d="M24 16v8l5 3" stroke="#4c1d95" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    snake: () => tile("#22d3ee", "#0e7490", "#064e3b", `<path d="M13 32c0-6 6-6 9-6s9 0 9-6-5-7-9-7" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="13" r="3.4" fill="${W}"/><circle cx="34" cy="33" r="3" fill="#fde68a"/>`),
    ai: () => tile("#ff6fd8", "#7c5cff", "#22d3ee", `<path d="M24 11l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="${W}"/><circle cx="34" cy="34" r="2.5" fill="${W}"/>`),
    arcade: () => tile("#f43f5e", "#7c3aed", null, `<rect x="11" y="18" width="26" height="14" rx="7" fill="${W}"/><path d="M17 22v6M14 25h6" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="23" r="1.9" fill="#f43f5e"/><circle cx="33" cy="27" r="1.9" fill="#7c3aed"/>`),
    weather: () => tile("#60a5fa", "#1d4ed8", null, `<circle cx="20" cy="20" r="6" fill="#fde68a"/><path d="M17 33h14a5 5 0 000-10 7 7 0 00-13 1 4.5 4.5 0 00-1 9z" fill="${W}"/>`),
    search: () => `<circle cx="21" cy="21" r="10" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M29 29l9 9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
    wifi: () => `<g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M8 19a23 23 0 0132 0"/><path d="M14 26a14 14 0 0120 0"/></g><circle cx="24" cy="34" r="3.5" fill="currentColor"/>`,
    wifioff: () => `<g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity=".45"><path d="M8 19a23 23 0 0132 0"/><path d="M14 26a14 14 0 0120 0"/></g><circle cx="24" cy="34" r="3.5" fill="currentColor" opacity=".45"/><path d="M10 10l28 28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
    volume: () => `<path d="M9 19h7l9-7v24l-9-7H9z" fill="currentColor"/><path d="M31 18a8 8 0 010 12M35 14a14 14 0 010 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    leaf: () => `<path d="M38 9C21 9 10 17 10 29c0 3 .8 5.6 2.2 7.6C15 25 24 20 31 18c-8 4-14 10-17.2 20.4A12 12 0 0 0 20 40c12 0 18-12 18-31z" fill="currentColor"/>`,
    battery: () => `<rect x="7" y="16" width="30" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="3"/><rect x="11" y="20" width="18" height="8" rx="1.5" fill="currentColor"/><rect x="38" y="21" width="3.5" height="6" rx="1" fill="currentColor"/>`,
    bt: () => `<path d="M17 15l14 14-7 6V13l7 6-14 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    plane: () => `<path d="M24 8c2 0 3 2 3 4v9l13 7v4l-13-3v7l4 3v3l-7-2-7 2v-3l4-3v-7L8 32v-4l13-7v-9c0-2 1-4 3-4z" fill="currentColor"/>`,
    moon: () => `<path d="M31 34a13 13 0 01-11-22 13 13 0 1011 22z" fill="currentColor"/>`,
    sun: () => `<circle cx="24" cy="24" r="7" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 8v4M24 36v4M8 24h4M36 24h4M12.7 12.7l2.8 2.8M32.5 32.5l2.8 2.8M12.7 35.3l2.8-2.8M32.5 15.5l2.8-2.8"/></g>`,
    contrast: () => `<circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 11a13 13 0 010 26z" fill="currentColor"/>`,
    power: () => `<path d="M24 9v14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M15 15a13 13 0 1018 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
    user: () => `<circle cx="24" cy="18" r="7" fill="currentColor"/><path d="M10 39c1-8 7-12 14-12s13 4 14 12z" fill="currentColor"/>`,
    lock: () => `<rect x="12" y="21" width="24" height="18" rx="4" fill="currentColor"/><path d="M17 21v-5a7 7 0 0114 0v5" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
    signout: () => `<path d="M20 12h-7a3 3 0 00-3 3v18a3 3 0 003 3h7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M22 24h16M32 17l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    restart: () => `<path d="M36 24a12 12 0 11-4-9" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M33 9v7h-7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    arrow: () => `<path d="M12 24h24M27 15l9 9-9 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    back: () => `<path d="M36 24H12M21 15l-9 9 9 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    fwd: () => `<path d="M12 24h24M27 15l9 9-9 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    reload: () => `<path d="M36 24a12 12 0 11-4-9" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M33 9v7h-7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    home: () => `<path d="M9 23L24 10l15 13M14 19v18h20V19" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    min: () => `<path d="M14 24h20" stroke="currentColor" stroke-width="2.5"/>`,
    max: () => `<rect x="14" y="14" width="20" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
    restore: () => `<rect x="13" y="18" width="17" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M18 18v-3a2 2 0 012-2h13a2 2 0 012 2v13a2 2 0 01-2 2h-3" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
    close: () => `<path d="M15 15l18 18M33 15L15 33" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
    check: () => `<path d="M12 25l8 8 16-17" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    chevron: () => `<path d="M19 13l11 11-11 11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    up: () => `<path d="M13 29l11-11 11 11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    display: () => `<rect x="7" y="10" width="34" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 38h12M24 32v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    brush: () => `<path d="M30 9l9 9-15 15-9-9z" fill="currentColor"/><path d="M14 27c-5 0-6 5-6 10 5 0 10-1 10-6" fill="currentColor"/>`,
    apps: () => `<g fill="currentColor"><rect x="9" y="9" width="12" height="12" rx="3"/><rect x="27" y="9" width="12" height="12" rx="3"/><rect x="9" y="27" width="12" height="12" rx="3"/><rect x="27" y="27" width="12" height="12" rx="3"/></g>`,
    globe: () => `<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 24h28M24 10c6 6 6 22 0 28M24 10c-6 6-6 22 0 28" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
    info: () => `<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 22v10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="16" r="2.2" fill="currentColor"/>`,
    time: () => `<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 16v8l6 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    sound: () => `<path d="M9 19h7l9-7v24l-9-7H9z" fill="currentColor"/><path d="M31 18a8 8 0 010 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    taskbar: () => `<rect x="7" y="12" width="34" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M7 30h34" stroke="currentColor" stroke-width="3"/>`,
    star: () => `<path d="M24 8l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L24 32l-9.4 5.1 1.8-10.5-7.7-7.5 10.6-1.5z" fill="currentColor"/>`,
    download: () => `<path d="M24 9v20M15 21l9 9 9-9M11 38h26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    library: () => `<path d="M10 10h6v28h-6zM20 10h6v28h-6zM29 12l6-2 6 26-6 2z" fill="currentColor"/>`,
    trash: () => `<path d="M12 15h24M19 15v-3h10v3M15 15l2 22h14l2-22" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    bell: () => `<path d="M24 8a10 10 0 00-10 10v8l-4 6h28l-4-6v-8A10 10 0 0024 8z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 36a4 4 0 008 0" fill="none" stroke="currentColor" stroke-width="3"/>`,
    taskmgr: () => tile("#4ade80", "#15803d", null, `<rect x="11" y="12" width="26" height="24" rx="3" fill="${W}"/><path d="M14 28l5-6 4 4 5-8 6 7" fill="none" stroke="#15803d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    mouse: () => `<rect x="14" y="7" width="20" height="34" rx="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 7v11M14 18h20" stroke="currentColor" stroke-width="3"/>`,
    keyboard: () => `<rect x="5" y="13" width="38" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><rect x="10" y="18" width="4" height="4" rx="1"/><rect x="17" y="18" width="4" height="4" rx="1"/><rect x="24" y="18" width="4" height="4" rx="1"/><rect x="31" y="18" width="4" height="4" rx="1"/><rect x="14" y="27" width="20" height="4" rx="1"/></g>`,
    shield: () => `<path d="M24 6l15 6v10c0 10-6.5 17-15 20C15.5 39 9 32 9 22V12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M17 24l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    youtube: () => `<rect x="2" y="2" width="44" height="44" rx="11" fill="#fff"/><rect x="7" y="13" width="34" height="23" rx="7" fill="#ff0033"/><path d="M21 19l9 5.5-9 5.5z" fill="#fff"/>`,
    access: () => `<circle cx="24" cy="9" r="4" fill="currentColor"/><path d="M9 16l15 3 15-3M24 19v9l-6 13M24 28l6 13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    eye: () => `<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="currentColor"/>`,
    // apps added in 1.2
    files: () => tile("#fbbf24", "#f97316", null, `<path d="M10 16a3 3 0 013-3h7l3 3h12a3 3 0 013 3v13a3 3 0 01-3 3H13a3 3 0 01-3-3z" fill="${W}"/><path d="M10 21h28" stroke="#f97316" stroke-width="2.5"/>`),
    photos: () => tile("#38bdf8", "#6366f1", "#a855f7", `<rect x="11" y="13" width="26" height="22" rx="3.5" fill="${W}"/><path d="M14 31l7-8 5 5 3-3 5 6z" fill="#6366f1"/><circle cx="30" cy="19" r="2.6" fill="#f59e0b"/>`),
    media: () => tile("#fb7185", "#be185d", "#7c3aed", `<circle cx="24" cy="24" r="13" fill="${W}"/><path d="M21 18l9 6-9 6z" fill="#be185d"/>`),
    snip: () => tile("#2dd4bf", "#0369a1", null, `<path d="M12 18v-5a1 1 0 011-1h5M30 12h5a1 1 0 011 1v5M36 30v5a1 1 0 01-1 1h-5M18 36h-5a1 1 0 01-1-1v-5" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="5" fill="${W}"/>`),
    folder: () => `<path d="M6 14a4 4 0 014-4h9l4 4h15a4 4 0 014 4v17a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill="#f5b83d"/><path d="M6 19h36v16a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill="#fbcd5b"/>`,
    file: () => `<path d="M13 6h15l9 9v25a2 2 0 01-2 2H13a2 2 0 01-2-2V8a2 2 0 012-2z" fill="#e8e6f0"/><path d="M28 6v9h9" fill="#c9c5d8"/>`,
    ftext: () => `<path d="M13 6h15l9 9v25a2 2 0 01-2 2H13a2 2 0 01-2-2V8a2 2 0 012-2z" fill="#e8e6f0"/><path d="M28 6v9h9" fill="#c9c5d8"/><path d="M16 22h16M16 27h16M16 32h10" stroke="#5b6bd6" stroke-width="2.4" stroke-linecap="round"/>`,
    fimage: () => `<rect x="7" y="9" width="34" height="30" rx="4" fill="#dbeafe"/><path d="M10 35l9-11 7 7 4-4 8 8z" fill="#3b82f6"/><circle cx="31" cy="17" r="3.4" fill="#f59e0b"/>`,
    fvideo: () => `<rect x="6" y="10" width="36" height="28" rx="4" fill="#1f1b2e"/><path d="M20 18l10 6-10 6z" fill="#f472b6"/>`,
    faudio: () => `<circle cx="24" cy="24" r="17" fill="#ede9fe"/><path d="M27 13v15.5a5 5 0 11-3-4.6V16l8-2v4z" fill="#7c3aed"/>`,
    fpdf: () => `<path d="M13 6h15l9 9v25a2 2 0 01-2 2H13a2 2 0 01-2-2V8a2 2 0 012-2z" fill="#fee2e2"/><path d="M28 6v9h9" fill="#fca5a5"/><rect x="14" y="25" width="20" height="9" rx="2" fill="#dc2626"/>`,
    usb: () => `<rect x="15" y="17" width="18" height="25" rx="4" fill="currentColor"/><rect x="18" y="6" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M21 10h2M25 10h2" stroke="currentColor" stroke-width="2.5"/>`,
    tv: () => `<rect x="6" y="9" width="36" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M17 39h14M24 33v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    cast: () => `<path d="M7 16v-4a3 3 0 013-3h28a3 3 0 013 3v24a3 3 0 01-3 3H27" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M7 25a14 14 0 0114 14M7 32a7 7 0 017 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="39" r="2" fill="currentColor"/>`,
    cut: () => `<circle cx="15" cy="34" r="5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="33" cy="34" r="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 30L32 9M30 30L16 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    copy: () => `<rect x="16" y="16" width="22" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 31V11a3 3 0 013-3h16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    paste: () => `<rect x="11" y="11" width="26" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="18" y="7" width="12" height="7" rx="2" fill="currentColor"/>`,
    newfolder: () => `<path d="M6 14a4 4 0 014-4h9l4 4h15a4 4 0 014 4v17a4 4 0 01-4 4H10a4 4 0 01-4-4z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 21v12M18 27h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    rename: () => `<path d="M10 38l2-9 19-19 7 7-19 19z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M27 14l7 7" stroke="currentColor" stroke-width="3"/>`,
    grid: () => `<g fill="currentColor"><rect x="9" y="9" width="12" height="12" rx="2"/><rect x="27" y="9" width="12" height="12" rx="2"/><rect x="9" y="27" width="12" height="12" rx="2"/><rect x="27" y="27" width="12" height="12" rx="2"/></g>`,
    listv: () => `<g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M17 13h22M17 24h22M17 35h22"/><path d="M9 13h1M9 24h1M9 35h1"/></g>`,
    eject: () => `<path d="M24 10l13 15H11z" fill="currentColor"/><rect x="11" y="31" width="26" height="5" rx="1.5" fill="currentColor"/>`,
    recycle: () => `<path d="M14 15h20l-2 24H16z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M11 15h26M20 15v-4h8v4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    camera: () => `<rect x="7" y="15" width="34" height="23" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M17 15l3-5h8l3 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="26" r="6" fill="none" stroke="currentColor" stroke-width="3"/>`,
    zoomin: () => `<circle cx="21" cy="21" r="11" fill="none" stroke="currentColor" stroke-width="3"/><path d="M29 29l9 9M16 21h10M21 16v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    zoomout: () => `<circle cx="21" cy="21" r="11" fill="none" stroke="currentColor" stroke-width="3"/><path d="M29 29l9 9M16 21h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
    rotate: () => `<path d="M36 20a13 13 0 10-1 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M37 10v10H27" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const brand = (spec) => {
    const [, cols, text, fg] = spec.split(":"); const c = cols.split(",").filter((x) => /^#[0-9a-f]{3,8}$/i.test(x)); const id = "b" + ++gid;
    const stops = c.map((col, k) => `<stop offset="${c.length > 1 ? k / (c.length - 1) : 0}" stop-color="${col}"/>`).join("");
    const t = String(text || "").slice(0, 4), fs2 = t.length <= 1 ? 26 : t.length === 2 ? 20 : t.length === 3 ? 15 : 12;
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="11" fill="url(#${id})"/><rect x="2" y="2" width="44" height="22" rx="11" fill="#ffffff" opacity=".08"/><text x="24" y="${24 + fs2 * 0.36}" text-anchor="middle" font-family="Segoe UI Variable Display,Segoe UI,Inter,Arial,sans-serif" font-weight="700" font-size="${fs2}" fill="${/^#[0-9a-f]{3,8}$/i.test(fg) ? fg : "#fff"}" letter-spacing="-.3">${esc(t)}</text>`;
  };
  NX.icon = (name, size) => `<svg class="ico" viewBox="0 0 48 48" width="${size || 20}" height="${size || 20}" aria-hidden="true">${String(name).startsWith("brand:") ? brand(name) : (I[name] || I.apps)()}</svg>`;
})();
