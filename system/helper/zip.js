// Nebulux OS system helper: ZIP files for File Explorer ("Compress to ZIP file" and "Extract all").
// Plain Node, no extra programs: deflate from zlib, a small CRC-32, and the ZIP layout.
"use strict";
const zlib = require("zlib");

const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function dosTime(ms) {
  const d = new Date(ms || Date.now()), y = Math.max(1980, d.getFullYear());
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

// entries: [{ name: "folder/file.txt", data: Buffer, mtime, dir }]; folder names end with "/"
function makeZip(entries) {
  const parts = [], central = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.dir && !e.name.endsWith("/") ? e.name + "/" : e.name, "utf8");
    const raw = e.dir ? Buffer.alloc(0) : e.data, crc = e.dir ? 0 : crc32(raw);
    let body = raw, method = 0;
    if (!e.dir && raw.length > 64) { const z = zlib.deflateRawSync(raw); if (z.length < raw.length) { body = z; method = 8; } }
    const { time, date } = dosTime(e.mtime);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(method, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22);
    h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, name, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(e.dir ? (0o40755 << 16) | 0x10 : (0o100644 << 16) >>> 0, 38); c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += h.length + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

// returns [{ name, dir, data }]; names are checked so nothing lands outside the folder it is extracted into
function readZip(buf, maxTotal) {
  maxTotal = maxTotal || 1024 * 1048576;
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("That isn't a ZIP file, or it's damaged.");
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16), total = 0; const out = [];
  if (count > 20000) throw new Error("That ZIP file has too many files in it.");
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("That ZIP file is damaged.");
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString(flags & 0x0800 ? "utf8" : "latin1").split(String.fromCharCode(92)).join("/");
    p += 46 + nl + xl + cl;
    if (flags & 1) throw new Error("That ZIP file has a password. Nebulux OS can't open those yet.");
    const segs = name.split("/").filter((s) => s && s !== ".");
    if (!segs.length || name.startsWith("/") || /^[a-zA-Z]:/.test(name) || segs.some((s) => s === "..")) continue;
    const dir = name.endsWith("/");
    if (dir) { out.push({ name: segs.join("/"), dir: true }); continue; }
    total += usize; if (total > maxTotal) throw new Error("That ZIP file is too big to extract here.");
    const ls = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), body = buf.slice(ls, ls + csize);
    let data;
    if (method === 0) data = body; else if (method === 8) data = zlib.inflateRawSync(body); else throw new Error("That ZIP file uses a kind of packing Nebulux OS can't open.");
    out.push({ name: segs.join("/"), dir: false, data });
  }
  // everything in one folder (like a zipped-up folder): unpack its insides, so it isn't a folder inside a folder
  const tops = new Set(out.map((x) => x.name.split("/")[0])), top = [...tops][0];
  if (tops.size === 1 && out.some((x) => x.name.startsWith(top + "/"))) return out.filter((x) => x.name !== top).map((x) => ({ ...x, name: x.name.slice(top.length + 1) }));
  return out;
}

module.exports = { makeZip, readZip, crc32 };
