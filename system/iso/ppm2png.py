#!/usr/bin/env python3
"""Turns a QEMU screendump (.ppm) into a .png, with no extra libraries.
   ppm2png.py in.ppm out.png      or      ppm2png.py --check in.ppm   (exit 0 when the Nebulux OS screens show:
   lots of the purple night-sky colors, not a black or text screen)"""
import sys, zlib, struct

def read_ppm(path):
    data = open(path, "rb").read()
    parts, i = [], 0
    while len(parts) < 4:
        while data[i:i + 1].isspace(): i += 1
        if data[i:i + 1] == b"#":
            while data[i:i + 1] not in (b"\n", b""): i += 1
            continue
        j = i
        while not data[j:j + 1].isspace(): j += 1
        parts.append(data[i:j]); i = j
    i += 1
    w, h = int(parts[1]), int(parts[2])
    return w, h, data[i:i + w * h * 3]

def write_png(path, w, h, rgb):
    raw = b"".join(b"\x00" + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))

def looks_like_os(w, h, rgb):
    step, purple, bright, total = 7, 0, 0, 0
    for p in range(0, w * h, step):
        r, g, b = rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]
        total += 1
        if b > 25 and b > g + 8 and r > g: purple += 1
        if b > 70: bright += 1
    # first-time setup is about 0.8 purple and 0.32 bright, the lock screen 0.73 and 0.56; the start-up screen is about 0.03 bright
    return total and purple / total > 0.35 and bright / total > 0.2

def fills_screen(w, h, rgb):
    # the right-most columns show the desktop, not the plain screen color behind it (#0b0620, set by the session)
    bare = 0
    for y in range(0, h, 4):
        for x in range(w - 6, w):
            r, g, b = rgb[(y * w + x) * 3:(y * w + x) * 3 + 3]
            if abs(r - 11) <= 3 and abs(g - 6) <= 3 and abs(b - 32) <= 3: bare += 1
    return bare < 0.3 * (h // 4) * 6

if __name__ == "__main__":
    try:
        if sys.argv[1] == "--full":
            w, h, rgb = read_ppm(sys.argv[2]); sys.exit(0 if fills_screen(w, h, rgb) else 1)
        if sys.argv[1] == "--check":
            w, h, rgb = read_ppm(sys.argv[2]); sys.exit(0 if looks_like_os(w, h, rgb) else 1)
        w, h, rgb = read_ppm(sys.argv[1]); write_png(sys.argv[2], w, h, rgb)
    except Exception as e:  # no screen yet
        print("ppm2png:", e); sys.exit(2)
